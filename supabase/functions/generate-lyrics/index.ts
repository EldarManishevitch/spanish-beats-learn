// Pipeline:
// 1. Search Genius for the selected YouTube track.
// 2. Fetch plain Spanish lyrics from lrclib.net, falling back to Genius HTML scraping.
// 3. Send the original lyrics to Lovable AI only for line splitting + Hebrew/English translation.
// 4. Save the static lyrics sheet. Timestamps are stored as 0 placeholders because the table requires them,
//    but the app no longer uses time-based synchronization.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `You are a Spanish-language music expert helping an English-speaking learner.
You will be given original Spanish lyrics.

Your job:
- Split the lyrics into individual short lines, one lyrical phrase per line.
- You MUST translate every single line of the provided lyrics into natural, rhythmic English. Do not skip any verses or shorten the song. If the input has 60 lines, the output must have 60 lines.
- Preserve the original Spanish text exactly; do not paraphrase it.
- For each line, provide a natural English translation that reads smoothly while staying faithful to the meaning.
- Mark "is_chorus" = true ONLY for repeated hook/chorus lines. Verses, pre-chorus, bridge, intro, and outro are false.
- Skip section headers like [Chorus], [Verse 1], [Intro], etc. Do not include them as lyric lines.
- Genre is one of: "reggaeton", "bachata", "pop latino", "trap latino", "merengue", "salsa", "rock latino".
- difficulty is one of: "beginner", "intermediate", "advanced".`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "save_song",
    description: "Return translated lyric lines for a static lyrics sheet.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        artist: { type: "string" },
        genre: {
          type: "string",
          enum: ["reggaeton", "bachata", "pop latino", "trap latino", "merengue", "salsa", "rock latino"],
        },
        difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              spanish_text: { type: "string" },
              english_translation: { type: "string" },
              is_chorus: { type: "boolean" },
            },
            required: ["spanish_text", "english_translation", "is_chorus"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "artist", "genre", "difficulty", "lines"],
      additionalProperties: false,
    },
  },
};

function buildAiRequest(systemPrompt: string, userPrompt: string, maxTokens: number) {
  return {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
    tools: [TOOL],
    tool_choice: { type: "function", function: { name: "save_song" } },
  };
}

function cleanYoutubeTitle(raw: string): string {
  return raw
    .replace(/\([^)]*(?:audio|video|lyric|official|hd|hq|visualizer|remix|live)[^)]*\)/gi, "")
    .replace(/\[[^\]]*(?:audio|video|lyric|official|hd|hq|visualizer|remix|live)[^\]]*\]/gi, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeArtist(artist: string): string {
  return artist
    .replace(/genius\s+(english|spanish|romanizations?|translations?)/gi, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeTitle(title: string): string {
  return title
    .replace(/\((?:english|spanish)\s+translation\)/gi, "")
    .replace(/\[(?:english|spanish)\s+translation\]/gi, "")
    .replace(/-\s*(?:english|spanish)\s+translation/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTitleArtist(cleaned: string): { title: string; artist: string } | null {
  const m = cleaned.split(/\s+[-–—‒]\s+/);
  if (m.length < 2) return null;
  return { artist: m[0].trim(), title: m.slice(1).join(" - ").trim() };
}

async function searchGenius(query: string, token: string): Promise<{ title: string; artist: string; url: string } | null> {
  try {
    const response = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Genius search API error:", response.status, text);
      throw new Error(`Genius search failed: ${response.status}`);
    }

    const data = await response.json();
    const hit = data?.response?.hits?.find((h: any) => h.type === "song");
    if (!hit) return null;

    return {
      title: hit.result.title as string,
      artist: hit.result.primary_artist?.name as string,
      url: hit.result.url as string,
    };
  } catch (error) {
    console.error("Genius search request failed:", error instanceof Error ? error.message : error);
    throw error;
  }
}

async function fetchLrclibLyrics(title: string, artist: string): Promise<string | null> {
  try {
    const headers = { "User-Agent": "LovableLyrics/1.0 (https://lovable.dev)" };
    const exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const exactResponse = await fetch(exactUrl, { headers });

    if (exactResponse.ok) {
      const data = await exactResponse.json();
      const text = (data.plainLyrics || data.syncedLyrics || "").toString();
      if (text.trim().length > 50) return stripLrcTimestamps(text);
    } else {
      console.warn("lrclib exact lookup failed:", exactResponse.status, await exactResponse.text());
    }

    const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const searchResponse = await fetch(searchUrl, { headers });
    if (!searchResponse.ok) {
      console.warn("lrclib search failed:", searchResponse.status, await searchResponse.text());
      return null;
    }

    const results = await searchResponse.json();
    const hit = Array.isArray(results) ? results.find((x: any) => x.plainLyrics || x.syncedLyrics) : null;
    if (!hit) return null;

    const text = (hit.plainLyrics || hit.syncedLyrics || "").toString();
    return text.trim().length > 50 ? stripLrcTimestamps(text) : null;
  } catch (error) {
    console.error("lrclib lyrics fetch failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchGeniusLyrics(songUrl: string): Promise<string | null> {
  try {
    const response = await fetch(songUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Referer: "https://genius.com/",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Genius page fetch failed:", response.status, text.slice(0, 500));
      return null;
    }

    const html = await response.text();
    const containers = [...html.matchAll(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi)];
    if (containers.length > 0) {
      const lyrics = containers.map((m) => decodeAndStrip(m[1])).join("\n").trim();
      return lyrics.length > 50 ? lyrics : null;
    }

    const legacy = html.match(/<div class="lyrics">([\s\S]*?)<\/div>/i);
    if (!legacy) {
      console.warn("Could not locate lyrics on Genius page");
      return null;
    }

    const lyrics = decodeAndStrip(legacy[1]);
    return lyrics.length > 50 ? lyrics : null;
  } catch (error) {
    console.error("Genius lyrics scrape failed:", error instanceof Error ? error.message : error);
    return null;
  }
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

function stripLrcTimestamps(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function countInputLyricLines(text: string): number {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^\[[^\]]+\]$/.test(line))
    .length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const body = await req.json();
    const { youtube_id, title, channel, thumbnail } = body ?? {};

    if (!youtube_id || !title) {
      return jsonResponse({ error: "youtube_id and title are required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GENIUS_TOKEN = Deno.env.get("GENIUS_ACCESS_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL) return jsonResponse({ error: "Server configuration error: Missing SUPABASE_URL." }, 500);
    if (!SERVICE_ROLE) return jsonResponse({ error: "Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY." }, 500);
    if (!GENIUS_TOKEN) return jsonResponse({ error: "Server configuration error: Missing GENIUS_ACCESS_TOKEN." }, 500);
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "Server configuration error: Missing LOVABLE_API_KEY." }, 500);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: existing, error: existingError } = await supabase
      .from("songs")
      .select("id")
      .eq("youtube_id", youtube_id)
      .maybeSingle();
    if (existingError) {
      console.error("Existing song lookup failed:", existingError);
      return jsonResponse({ error: "Database lookup failed" }, 500);
    }
    if (existing) {
      return jsonResponse({ song_id: existing.id, existed: true });
    }

    const cleanedTitle = cleanYoutubeTitle(title);
    let geniusHit: { title: string; artist: string; url: string } | null = null;

    try {
      console.log("Searching Genius for:", cleanedTitle);
      geniusHit = await searchGenius(cleanedTitle, GENIUS_TOKEN);
      if (!geniusHit && channel) {
        geniusHit = await searchGenius(`${cleanedTitle} ${channel.replace(/\s*-?\s*Topic\s*$/i, "")}`, GENIUS_TOKEN);
      }
    } catch (error) {
      console.error("Genius search failed for selected track:", error instanceof Error ? error.message : error);
      return jsonResponse({ error: "Genius search failed. Please try another track." }, 502);
    }

    if (!geniusHit) {
      return jsonResponse({ error: "Could not find this song on Genius. Try a more specific search." }, 404);
    }

    let rawLyrics: string | null = null;
    let lyricsSource = "none";

    const cleanArtist = sanitizeArtist(geniusHit.artist);
    const cleanTitle = sanitizeTitle(geniusHit.title);
    const ytSplit = splitTitleArtist(cleanedTitle);

    const lrclibAttempts: Array<{ title: string; artist: string }> = [
      { title: cleanTitle, artist: cleanArtist },
    ];
    if (ytSplit) lrclibAttempts.push({ title: ytSplit.title, artist: ytSplit.artist });
    if (channel) {
      lrclibAttempts.push({
        title: cleanedTitle,
        artist: channel.replace(/\s*-?\s*Topic\s*$/i, "").trim(),
      });
    }

    try {
      for (const attempt of lrclibAttempts) {
        if (!attempt.title || !attempt.artist) continue;
        console.log("Trying lrclib:", attempt.title, "—", attempt.artist);
        rawLyrics = await fetchLrclibLyrics(attempt.title, attempt.artist);
        if (rawLyrics && rawLyrics.length >= 50) {
          lyricsSource = "lrclib";
          break;
        }
        rawLyrics = null;
      }

      if (!rawLyrics || rawLyrics.length < 50) {
        rawLyrics = await fetchGeniusLyrics(geniusHit.url);
        if (rawLyrics) lyricsSource = "genius";
      }
    } catch (error) {
      console.error("Lyrics retrieval failed:", error instanceof Error ? error.message : error);
      return jsonResponse({ error: "Lyrics retrieval failed. Please try another track." }, 502);
    }

    if (!rawLyrics || rawLyrics.length < 50) {
      console.error("Could not retrieve lyrics from lrclib or Genius for:", geniusHit.title, geniusHit.artist);
      return jsonResponse({ error: "Could not retrieve lyrics for this song. Try another track." }, 404);
    }

    const inputLineCount = countInputLyricLines(rawLyrics);
    console.log(
      `Sending lyrics to AI: ${rawLyrics.length} characters, ${inputLineCount} lyric lines, source=${lyricsSource}`,
    );

    let parsed: any;
    try {
      const userPrompt = `Song title: "${geniusHit.title}"
Artist: ${geniusHit.artist}

Original Spanish lyrics:

${rawLyrics}`;

      let aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildAiRequest(SYSTEM_PROMPT, userPrompt, 8192)),
      });

      if (!aiResponse.ok) {
        const text = await aiResponse.text();
        console.error("AI translation error:", aiResponse.status, text);
        if (aiResponse.status === 429) return jsonResponse({ error: "Rate limit exceeded, try again soon." }, 429);
        if (aiResponse.status === 402) {
          return jsonResponse({ error: "Lovable AI credits exhausted. Add credits in Settings → Workspace → Usage." }, 402);
        }
        return jsonResponse({ error: "AI translation failed" }, 502);
      }

      let aiData = await aiResponse.json();
      let toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.warn("AI returned no tool call, retrying once:", JSON.stringify(aiData).slice(0, 1000));
        aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildAiRequest(`${SYSTEM_PROMPT}\nReturn ONLY by calling save_song.`, userPrompt, 12000)),
        });

        if (!aiResponse.ok) {
          const text = await aiResponse.text();
          console.error("AI translation retry error:", aiResponse.status, text);
          return jsonResponse({ error: "AI translation failed" }, 502);
        }

        aiData = await aiResponse.json();
        toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      }
      if (!toolCall?.function?.arguments) throw new Error("AI did not return translated lyric lines");
      parsed = JSON.parse(toolCall.function.arguments);

      const outputLineCount = Array.isArray(parsed.lines) ? parsed.lines.length : 0;
      if (inputLineCount >= 10 && outputLineCount < Math.ceil(inputLineCount * 0.8)) {
        console.error(
          `Incomplete AI translation detected: input lines=${inputLineCount}, output lines=${outputLineCount}`,
        );
        return jsonResponse(
          { error: "AI returned incomplete lyrics. Please try again.", input_lines: inputLineCount, output_lines: outputLineCount },
          502,
        );
      }
    } catch (error) {
      console.error("AI translation logic failed:", error instanceof Error ? error.message : error);
      return jsonResponse({ error: "AI translation failed. Please try again." }, 502);
    }

    const { data: song, error: songError } = await supabase
      .from("songs")
      .insert({
        title: parsed.title || geniusHit.title,
        artist: parsed.artist || geniusHit.artist,
        genre: parsed.genre || "pop latino",
        difficulty: parsed.difficulty || "intermediate",
        youtube_id,
        album_art_url: thumbnail ?? null,
      })
      .select("id")
      .single();

    if (songError) {
      console.error("Song insert failed:", songError);
      return jsonResponse({ error: "Failed to save song" }, 500);
    }

    const rows = (parsed.lines ?? []).map((line: any, index: number) => ({
      song_id: song.id,
      line_index: index,
      spanish_text: line.spanish_text,
      hebrew_translation: line.hebrew_translation,
      english_translation: line.english_translation,
      start_seconds: 0,
      end_seconds: 0,
      is_chorus: Boolean(line.is_chorus),
    }));

    if (rows.length === 0) {
      return jsonResponse({ error: "AI returned no lyric lines" }, 502);
    }

    const { error: linesError } = await supabase.from("lyric_lines").insert(rows);
    if (linesError) {
      console.error("Lyric lines insert failed:", linesError);
      return jsonResponse({ error: "Failed to save lyrics" }, 500);
    }

    return jsonResponse({
      song_id: song.id,
      existed: false,
      lines_count: rows.length,
      lyrics_source: lyricsSource,
      genius_url: geniusHit.url,
    });
  } catch (error) {
    console.error("Unexpected generate-lyrics error:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "SERVICE_FAILED", message: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
