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
- For each line, also provide a "pronunciation" field: a phonetic guide using English letters that helps an English speaker pronounce the Spanish line. Use hyphens between syllables and CAPS for the stressed syllable (e.g., "Despacito" -> "Des-pah-SEE-toh", "Corazón" -> "Co-rah-SOHN"). Cover the entire line, not just one word.
- Mark "is_chorus" = true ONLY for repeated hook/chorus lines. Verses, pre-chorus, bridge, intro, and outro are false.
- Skip section headers like [Chorus], [Verse 1], [Intro], etc. Do not include them as lyric lines.
- Genre is one of: "reggaeton", "bachata", "pop latino", "trap latino", "merengue", "salsa", "rock latino".
- difficulty is one of: "beginner", "intermediate", "advanced".`;

const WEB_EXTRACT_SYSTEM_PROMPT = `You extract Spanish song lyrics from messy web-scrape text.
Input is raw markdown/text from lyrics websites (letras.com, azlyrics, musixmatch, genius, etc.) and may contain navigation, ads, related songs, comments, "Submit corrections", cookie banners, and translations.
Your job: return ONLY the original Spanish lyrics of the requested song, one line per row, in performance order. Skip section headers like [Chorus]. Skip everything that is not a sung lyric line. Do not invent lines. If the text does not actually contain the lyrics, return an empty string.
Output: plain text, no commentary, no markdown, no code fences.`;

async function fetchWebFallbackLyrics(
  title: string,
  artist: string,
  lovableApiKey: string,
): Promise<string | null> {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlKey) {
    console.warn("FIRECRAWL_API_KEY not set; skipping web fallback");
    return null;
  }

  const query = `${artist} ${title} letra lyrics Spanish`;
  console.log("Web fallback: searching Firecrawl for:", query);

  let searchData: any;
  try {
    const searchResponse = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 3,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    if (!searchResponse.ok) {
      console.error("Firecrawl search failed:", searchResponse.status, await searchResponse.text());
      return null;
    }
    searchData = await searchResponse.json();
  } catch (error) {
    console.error("Firecrawl request failed:", error instanceof Error ? error.message : error);
    return null;
  }

  const results: any[] = searchData?.data?.web ?? searchData?.data ?? [];
  const blobs = results
    .map((r: any) => {
      const md = (r.markdown ?? r.content ?? r.description ?? "").toString();
      const url = r.url ?? r.link ?? "";
      return md.length > 100 ? `Source: ${url}\n\n${md}` : null;
    })
    .filter(Boolean) as string[];

  if (blobs.length === 0) {
    console.warn("Web fallback: no usable scrape content from Firecrawl");
    return null;
  }

  const combined = blobs.join("\n\n---\n\n").slice(0, 30000);
  console.log(`Web fallback: sending ${combined.length} chars from ${blobs.length} sources to AI for extraction`);

  try {
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: WEB_EXTRACT_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Song: "${title}" by ${artist}\n\nScraped web content:\n\n${combined}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });
    if (!extractResponse.ok) {
      console.error("Web fallback extraction failed:", extractResponse.status, await extractResponse.text());
      return null;
    }
    const extractData = await extractResponse.json();
    const lyrics = (extractData.choices?.[0]?.message?.content ?? "").toString().trim();
    // Real song lyrics are virtually always >300 chars and have multiple lines.
    // Anything shorter is almost certainly a track-listing page or a snippet, not real lyrics.
    const lineCount = lyrics.split("\n").map((l) => l.trim()).filter(Boolean).length;
    if (lyrics.length < 300 || lineCount < 8) {
      console.warn(`Web fallback returned too little content (${lyrics.length} chars, ${lineCount} lines); discarding`);
      return null;
    }
    return lyrics;
  } catch (error) {
    console.error("Web fallback extraction request failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

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
              pronunciation: { type: "string", description: "Phonetic guide in English letters for the entire line, hyphenated by syllable, with CAPS on stressed syllable." },
              english_translation: { type: "string" },
              is_chorus: { type: "boolean" },
            },
            required: ["spanish_text", "pronunciation", "english_translation", "is_chorus"],
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
    // flash-lite is significantly faster than flash for this structured tool-call workload
    model: "google/gemini-2.5-flash-lite",
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

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function cleanYoutubeTitle(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/\([^)]*(?:audio|video|lyric|official|hd|hq|visualizer|remix|live|version|anniversary|edit|extended|remaster(?:ed)?|4k|mv|m\/v)[^)]*\)/gi, "")
    .replace(/\[[^\]]*(?:audio|video|lyric|official|hd|hq|visualizer|remix|live|version|anniversary|edit|extended|remaster(?:ed)?|4k|mv|m\/v)[^\]]*\]/gi, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Strip featuring credits and trailing junk for a more Genius-friendly query
function simplifyForSearch(s: string): string {
  return s
    .replace(/\s*[\(\[][^)\]]*(?:feat\.?|ft\.?|featuring|with|prod\.?|remix|version|edit)[^)\]]*[\)\]]/gi, "")
    .replace(/\s+(?:feat\.?|ft\.?|featuring|with)\s+.+$/i, "")
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GENIUS_TOKEN = Deno.env.get("GENIUS_ACCESS_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE || !GENIUS_TOKEN || !LOVABLE_API_KEY || !SUPABASE_ANON_KEY) {
      console.error("Missing required server config");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    // Require authenticated caller — this endpoint burns paid API credits
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { youtube_id, title, channel, thumbnail } = body ?? {};

    if (!youtube_id || !title) {
      return jsonResponse({ error: "youtube_id and title are required" }, 400);
    }

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
      const { data: cachedLines } = await supabase
        .from("lyric_lines")
        .select("id, line_index, spanish_text, pronunciation, english_translation, is_chorus")
        .eq("song_id", existing.id)
        .order("line_index");
      return jsonResponse({ song_id: existing.id, existed: true, lines: cachedLines ?? [] });
    }

    const cleanedTitle = cleanYoutubeTitle(title);
    let geniusHit: { title: string; artist: string; url: string } | null = null;

    try {
      console.log("Searching Genius for:", cleanedTitle);
      geniusHit = await searchGenius(cleanedTitle, GENIUS_TOKEN);

      // Fallback 1: simplified query (drop feat./version/remix junk)
      if (!geniusHit) {
        const simplified = simplifyForSearch(cleanedTitle);
        if (simplified && simplified !== cleanedTitle) {
          console.log("Genius retry with simplified query:", simplified);
          geniusHit = await searchGenius(simplified, GENIUS_TOKEN);
        }
      }

      // Fallback 2: just the part before " - " (typically "Artist - Title")
      if (!geniusHit) {
        const split = splitTitleArtist(cleanedTitle);
        if (split) {
          const q = simplifyForSearch(`${split.artist} ${split.title}`);
          console.log("Genius retry with artist+title split:", q);
          geniusHit = await searchGenius(q, GENIUS_TOKEN);
        }
      }

      // Fallback 3: append channel name
      if (!geniusHit && channel) {
        const ch = channel.replace(/\s*-?\s*(?:Topic|VEVO)\s*$/i, "").trim();
        geniusHit = await searchGenius(`${simplifyForSearch(cleanedTitle)} ${ch}`, GENIUS_TOKEN);
      }
    } catch (error) {
      console.error("Genius search failed for selected track:", error instanceof Error ? error.message : error);
      return jsonResponse({ error: "Genius search failed. Please try another track." }, 502);
    }

    if (!geniusHit) {
      console.warn("Genius lookup failed — continuing with YouTube metadata only");
    }

    let rawLyrics: string | null = null;
    let lyricsSource = "none";

    const ytSplit = splitTitleArtist(cleanedTitle);
    const cleanArtist = geniusHit ? sanitizeArtist(geniusHit.artist) : (ytSplit?.artist ?? channel ?? "");
    const cleanTitle = geniusHit ? sanitizeTitle(geniusHit.title) : (ytSplit?.title ?? cleanedTitle);

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
      // Fire lrclib attempts AND Genius scrape in parallel — first valid wins.
      const lrclibPromises = lrclibAttempts
        .filter((a) => a.title && a.artist)
        .map((attempt) =>
          fetchLrclibLyrics(attempt.title, attempt.artist).then((t) =>
            t && t.length >= 50 ? { src: "lrclib", text: t } : null,
          ),
        );
      const geniusPromise = geniusHit
        ? fetchGeniusLyrics(geniusHit.url).then((t) =>
            t && t.length >= 50 ? { src: "genius", text: t } : null,
          )
        : Promise.resolve(null);

      const parallelResults = await Promise.all([...lrclibPromises, geniusPromise]);
      const firstHit = parallelResults.find((r) => !!r) ?? null;
      if (firstHit) {
        rawLyrics = firstHit.text;
        lyricsSource = firstHit.src;
      }

      if (!rawLyrics || rawLyrics.length < 50) {
        console.warn("Genius + lrclib failed, attempting web search fallback (Firecrawl)");
        // Prefer YouTube-derived artist/title — Genius hits are often compilation pages
        // ("Genius en Español — Sencillos del Mes…") that poison the web search.
        const fbTitle = ytSplit?.title || cleanTitle;
        const fbArtist = ytSplit?.artist || cleanArtist;
        rawLyrics = await fetchWebFallbackLyrics(fbTitle, fbArtist, LOVABLE_API_KEY);
        if (rawLyrics) {
          lyricsSource = "web_fallback";
          console.log("Web fallback succeeded, lyrics length:", rawLyrics.length);
        }
      }
    } catch (error) {
      console.error("Lyrics retrieval failed:", error instanceof Error ? error.message : error);
      return jsonResponse({ error: "Lyrics retrieval failed. Please try another track." }, 502);
    }

    if (!rawLyrics || rawLyrics.length < 50) {
      console.error("Could not retrieve lyrics from lrclib, Genius, or web fallback for:", cleanTitle, cleanArtist);
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
      hebrew_translation: null,
      english_translation: line.english_translation,
      pronunciation: line.pronunciation ?? null,
      start_seconds: 0,
      end_seconds: 0,
      is_chorus: Boolean(line.is_chorus),
    }));

    if (rows.length === 0) {
      return jsonResponse(
        { error: "We couldn't find real lyrics for this track. Try picking a different YouTube result (e.g. an official audio/lyric video)." },
        404,
      );
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
      lines: rows.map((r, i) => ({
        id: `tmp-${i}`,
        line_index: r.line_index,
        spanish_text: r.spanish_text,
        pronunciation: r.pronunciation,
        english_translation: r.english_translation,
        is_chorus: r.is_chorus,
      })),
      lyrics_source: lyricsSource,
      genius_url: geniusHit.url,
    });
  } catch (error) {
    console.error("Unexpected generate-lyrics error:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
