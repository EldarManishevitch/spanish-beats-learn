// Pipeline:
// 1. Search Genius for the track (using GENIUS_ACCESS_TOKEN).
// 2. Scrape full Spanish lyrics from the Genius song page HTML.
// 3. Send the lyrics to Gemini Flash to: split into lines, translate (Hebrew + English),
//    mark chorus lines, and distribute timestamps across the YouTube duration.
// 4. Insert the song + lyric_lines rows.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a Spanish-language music expert helping a Hebrew-speaking learner.
You will be given the full original Spanish lyrics of a song (from Genius) plus its approximate duration.

Your job:
- Split the lyrics into individual short lines (one lyrical phrase per line). Preserve the original Spanish exactly — do not paraphrase.
- For each line, provide a natural Hebrew translation (Hebrew script) and a natural English translation.
- Mark "is_chorus" = true ONLY for repeated hook/chorus lines (the recurring refrain). Verses, pre-chorus, and bridge are false.
- Distribute "start_seconds" and "end_seconds" sensibly across the song duration so the lyrics span the full track.
  The first chorus typically starts ~25-40% into the song. Lines should not overlap; end_seconds of one ≈ start_seconds of next.
- Genre is one of: "reggaeton", "bachata", "pop latino", "trap latino", "merengue", "salsa", "rock latino".
- difficulty is one of: "beginner", "intermediate", "advanced".
- Skip section headers like [Chorus], [Verse 1], [Intro], etc. — do not include them as lines.
- Aim for 25-60 lines depending on song length.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "save_song",
    description: "Save a song with translated, timed lyrics.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        artist: { type: "string" },
        genre: { type: "string", enum: ["reggaeton", "bachata", "pop latino", "trap latino", "merengue", "salsa", "rock latino"] },
        difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              spanish_text: { type: "string" },
              hebrew_translation: { type: "string" },
              english_translation: { type: "string" },
              start_seconds: { type: "number" },
              end_seconds: { type: "number" },
              is_chorus: { type: "boolean" },
            },
            required: ["spanish_text", "hebrew_translation", "english_translation", "start_seconds", "end_seconds", "is_chorus"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "artist", "genre", "difficulty", "lines"],
      additionalProperties: false,
    },
  },
};

// --- Helpers --------------------------------------------------------------

// Strip "(Official Audio)", "[Lyric Video]", " - Topic", emojis, etc. so Genius search hits.
function cleanYoutubeTitle(raw: string): string {
  return raw
    .replace(/\([^)]*(?:audio|video|lyric|official|hd|hq|visualizer|remix|live)[^)]*\)/gi, "")
    .replace(/\[[^\]]*(?:audio|video|lyric|official|hd|hq|visualizer|remix|live)[^\]]*\]/gi, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchGenius(query: string, token: string) {
  const r = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Genius search failed: ${r.status}`);
  const j = await r.json();
  const hit = j?.response?.hits?.find((h: any) => h.type === "song");
  if (!hit) return null;
  return {
    id: hit.result.id as number,
    title: hit.result.title as string,
    artist: hit.result.primary_artist?.name as string,
    url: hit.result.url as string,
  };
}

// Genius doesn't expose lyrics via API; scrape the song page.
async function fetchGeniusLyrics(songUrl: string): Promise<string> {
  const r = await fetch(songUrl, {
    headers: {
      // Genius blocks generic / bot UAs with 403. Mimic a real browser.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Referer: "https://genius.com/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "follow",
  });
  if (!r.ok) throw new Error(`Genius page fetch failed: ${r.status}`);
  const html = await r.text();

  // Modern Genius pages: lyrics live inside <div data-lyrics-container="true">...</div> blocks.
  const containers = [...html.matchAll(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi)];
  if (containers.length === 0) {
    // Legacy fallback
    const legacy = html.match(/<div class="lyrics">([\s\S]*?)<\/div>/i);
    if (!legacy) throw new Error("Could not locate lyrics on Genius page");
    return decodeAndStrip(legacy[1]);
  }

  return containers.map((m) => decodeAndStrip(m[1])).join("\n").trim();
}

function decodeAndStrip(fragment: string): string {
  return fragment
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// --- Handler --------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { youtube_id, title, channel, thumbnail, duration_seconds } = body ?? {};
    if (!youtube_id || !title) {
      return new Response(JSON.stringify({ error: "youtube_id and title are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // De-dupe by youtube_id
    const { data: existing } = await supabase.from("songs").select("id").eq("youtube_id", youtube_id).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ song_id: existing.id, existed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GENIUS_TOKEN = Deno.env.get("GENIUS_ACCESS_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GENIUS_TOKEN) throw new Error("GENIUS_ACCESS_TOKEN is not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // 1. Search Genius
    const cleaned = cleanYoutubeTitle(title);
    console.log("Searching Genius for:", cleaned);
    let geniusHit = await searchGenius(cleaned, GENIUS_TOKEN);
    if (!geniusHit && channel) {
      // Retry with channel name appended (helps for ambiguous titles)
      geniusHit = await searchGenius(`${cleaned} ${channel.replace(/\s*-?\s*Topic\s*$/i, "")}`, GENIUS_TOKEN);
    }
    if (!geniusHit) {
      return new Response(JSON.stringify({ error: "Could not find this song on Genius. Try a more specific search." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Genius hit:", geniusHit.title, "by", geniusHit.artist, geniusHit.url);

    // 2. Scrape full lyrics
    const rawLyrics = await fetchGeniusLyrics(geniusHit.url);
    if (!rawLyrics || rawLyrics.length < 50) {
      return new Response(JSON.stringify({ error: "Genius returned empty lyrics for this song." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Fetched lyrics length:", rawLyrics.length);

    // 3. Send to Gemini Flash for splitting, translation, chorus & timing
    const userPrompt = `Song title: "${geniusHit.title}"
Artist: ${geniusHit.artist}
Approx duration: ${duration_seconds ?? 210} seconds

Original Spanish lyrics from Genius (preserve text exactly, but split into one phrase per line and skip [Section] headers):

${rawLyrics}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "save_song" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again soon." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Lovable AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI translation failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return a tool call");
    const parsed = JSON.parse(toolCall.function.arguments);

    // 4. Persist
    const { data: song, error: songErr } = await supabase
      .from("songs")
      .insert({
        title: parsed.title || geniusHit.title,
        artist: parsed.artist || geniusHit.artist,
        genre: parsed.genre,
        difficulty: parsed.difficulty,
        youtube_id,
        album_art_url: thumbnail ?? null,
      })
      .select("id")
      .single();
    if (songErr) throw songErr;

    const rows = parsed.lines.map((l: any, i: number) => ({
      song_id: song.id,
      line_index: i,
      spanish_text: l.spanish_text,
      hebrew_translation: l.hebrew_translation,
      english_translation: l.english_translation,
      start_seconds: l.start_seconds,
      end_seconds: l.end_seconds,
      is_chorus: l.is_chorus,
    }));
    const { error: linesErr } = await supabase.from("lyric_lines").insert(rows);
    if (linesErr) throw linesErr;

    return new Response(JSON.stringify({
      song_id: song.id,
      existed: false,
      lines_count: rows.length,
      genius_url: geniusHit.url,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-lyrics error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
