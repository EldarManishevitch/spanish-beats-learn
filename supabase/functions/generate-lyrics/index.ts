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
- For each line, also provide a "pronunciation" field: a phonetic guide using English letters that helps an English speaker pronounce the Spanish line. Use hyphens between syllables and CAPS for the stressed syllable (e.g., "Despacito" -> "Des-pah-SEE-toh", "Corazón" -> "Co-rah-SOHN"). Cover the entire line, not just one word. CRITICAL: the Spanish word "mí" (and "mi") MUST always be transliterated as "mee" — never "meh", "mih", or "may".
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

function buildAiRequest(model: string, systemPrompt: string, userPrompt: string, maxTokens: number) {
  return {
    model,
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

// Strip ALL non-name junk from a YouTube title/channel: bracketed labels
// (Official Audio, Lyric Video, 4K, Visualizer, ...), trailing channel suffixes
// (- Topic, VEVO, | Sony Music), emojis, etc. Keeps "feat./ft./with/con" credits.
const JUNK_KEYWORDS = [
  "official", "audio", "video", "lyric", "lyrics", "lyric video", "music video",
  "mv", "m/v", "visualizer", "visualiser", "hd", "hq", "4k", "8k",
  "remaster", "remastered", "anniversary", "edit", "extended", "version",
  "color coded", "color-coded", "sub español", "sub espanol", "sub eng",
  "english", "letra", "vevo", "topic", "explicit",
];
const FEAT_RE = /\s*[\(\[\{]\s*((?:feat\.?|ft\.?|featuring|con|with)\s+[^)\]\}]+)[\)\]\}]/i;
const trimSeparators = (s: string) =>
  s.replace(/^[\s\-–—|:•·]+|[\s\-–—|:•·]+$/g, "").replace(/\s+/g, " ").trim();
function cleanYoutubeTitle(raw: string): string {
  if (!raw) return "";
  let s = decodeHtmlEntities(raw)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, "");
  let feat = "";
  const m = s.match(FEAT_RE);
  if (m) { feat = ` ${m[1].replace(/\s+/g, " ").trim()}`; s = s.replace(FEAT_RE, " "); }
  s = s.replace(/[\(\[\{]([^\)\]\}]*)[\)\]\}]/g, (full, inner) => {
    const low = String(inner).toLowerCase();
    if (JUNK_KEYWORDS.some((k) => low.includes(k))) return " ";
    if (/^\s*(19|20)\d{2}\s*$/.test(inner)) return " ";
    return full;
  });
  s = s.replace(/\s*[|•·]\s*[^|•·]*$/g, " ");
  s = s.replace(/\s*[-–—]\s*(?:Topic|VEVO|Official(?:\s+(?:Audio|Video|Music))?|Music|Records)\s*$/i, "");
  s = s.replace(/\s*-\s*Topic\s*$/i, "").replace(/VEVO\s*$/i, "");
  s = s.replace(/\s+(?:HD|HQ|4K|8K|Official|Audio|Video|Visualizer|Lyrics?)\s*$/gi, "");
  s = trimSeparators(s);
  if (feat && !/feat\.?|ft\.?|featuring|with|con/i.test(s)) s = `${s}${feat}`;
  return trimSeparators(s);
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
  const pre = artist
    .replace(/genius\s+(english|spanish|romanizations?|translations?)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleanYoutubeTitle(pre);
}

function sanitizeTitle(title: string): string {
  const pre = title
    .replace(/\((?:english|spanish)\s+translation\)/gi, "")
    .replace(/\[(?:english|spanish)\s+translation\]/gi, "")
    .replace(/-\s*(?:english|spanish)\s+translation/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleanYoutubeTitle(pre);
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

// Parsed LRC line with its absolute start time in seconds.
type SyncedLine = { time: number; text: string };

function parseSyncedLrc(text: string): SyncedLine[] {
  const out: SyncedLine[] = [];
  for (const raw of text.split("\n")) {
    // LRC format: [mm:ss.xx] text  (multi-prefix lines also exist)
    const prefixes = raw.match(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g);
    if (!prefixes) continue;
    const content = raw.replace(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g, "").trim();
    // Skip metadata-only lines like [ar:Maluma] and empty markers.
    if (!content || /^\[[^\]]+\]$/.test(content)) continue;
    for (const p of prefixes) {
      const m = p.match(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/);
      if (!m) continue;
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) / 1000 : 0;
      out.push({ time: min * 60 + sec + frac, text: content });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

async function fetchLrclibLyrics(
  title: string,
  artist: string,
): Promise<{ plain: string; synced: SyncedLine[] } | null> {
  const pickFrom = (data: any) => {
    const syncedRaw = (data?.syncedLyrics || "").toString();
    const plainRaw = (data?.plainLyrics || "").toString();
    const synced = syncedRaw ? parseSyncedLrc(syncedRaw) : [];
    const plain = plainRaw.trim().length >= 50
      ? stripLrcTimestamps(plainRaw)
      : synced.length
        ? synced.map((l) => l.text).join("\n")
        : "";
    return plain.trim().length > 50 ? { plain, synced } : null;
  };
  try {
    const headers = { "User-Agent": "LovableLyrics/1.0 (https://lovable.dev)" };
    const exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const exactResponse = await fetch(exactUrl, { headers });

    if (exactResponse.ok) {
      const data = await exactResponse.json();
      const picked = pickFrom(data);
      if (picked) return picked;
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
    return pickFrom(hit);
  } catch (error) {
    console.error("lrclib lyrics fetch failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

// --- NetEase Cloud Music: free, no key. Strong Latin/pop catalog. -----------
async function fetchNeteaseLrc(
  title: string,
  artist: string,
): Promise<{ plain: string; synced: SyncedLine[] } | null> {
  if (!title) return null;
  const query = `${title} ${artist}`.trim();
  try {
    const searchUrl =
      `https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&limit=5`;
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: "https://music.163.com/",
      Cookie: "appver=2.0.2",
    };
    const sRes = await fetch(searchUrl, { headers });
    if (!sRes.ok) {
      console.warn("netease search failed:", sRes.status);
      return null;
    }
    const sData = await sRes.json();
    const songs: any[] = sData?.result?.songs ?? [];
    if (!songs.length) return null;
    // Prefer a hit whose artist roughly matches.
    const wantArtist = artist.toLowerCase();
    const pick = songs.find((s) =>
      Array.isArray(s.artists) &&
      s.artists.some((a: any) => wantArtist && String(a.name).toLowerCase().includes(wantArtist.split(/[, ]/)[0] ?? ""))
    ) ?? songs[0];
    if (!pick?.id) return null;

    const lyricUrl = `https://music.163.com/api/song/lyric?id=${pick.id}&lv=1&tv=-1`;
    const lRes = await fetch(lyricUrl, { headers });
    if (!lRes.ok) return null;
    const lData = await lRes.json();
    const lrc: string = lData?.lrc?.lyric ?? "";
    if (!lrc || lrc.length < 30) return null;
    const synced = parseSyncedLrc(lrc);
    if (synced.length < 4) return null;
    const plain = synced.map((s) => s.text).join("\n");
    if (plain.trim().length < 50) return null;
    return { plain, synced };
  } catch (error) {
    console.error("netease fetch failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

// --- Megalobiz: community LRC site, free, no key. ---------------------------
async function fetchMegalobizLrc(
  title: string,
  artist: string,
): Promise<{ plain: string; synced: SyncedLine[] } | null> {
  if (!title) return null;
  try {
    const query = `${title} ${artist}`.trim();
    const searchUrl = `https://www.megalobiz.com/search/all?qry=${encodeURIComponent(query)}&display=song`;
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    };
    const sRes = await fetch(searchUrl, { headers });
    if (!sRes.ok) {
      console.warn("megalobiz search failed:", sRes.status);
      return null;
    }
    const html = await sRes.text();
    const linkMatch = html.match(/<a[^>]+class="entity_name"[^>]+href="(\/lrc\/maker\/[^"]+)"/i);
    if (!linkMatch) return null;
    const lrcPageUrl = `https://www.megalobiz.com${linkMatch[1]}`;
    const pRes = await fetch(lrcPageUrl, { headers });
    if (!pRes.ok) return null;
    const pHtml = await pRes.text();
    // The LRC body lives in a div whose id starts with lrc_<digits>_
    const bodyMatch = pHtml.match(/<div[^>]+id="lrc_\d+_[^"]+"[^>]*>([\s\S]*?)<\/div>/i);
    if (!bodyMatch) return null;
    const lrcText = decodeAndStrip(bodyMatch[1]);
    if (lrcText.length < 30) return null;
    const synced = parseSyncedLrc(lrcText);
    if (synced.length < 4) return null;
    const plain = synced.map((s) => s.text).join("\n");
    if (plain.trim().length < 50) return null;
    return { plain, synced };
  } catch (error) {
    console.error("megalobiz fetch failed:", error instanceof Error ? error.message : error);
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

    // Validate youtube_id strictly — 11 chars, URL-safe base64 alphabet.
    if (typeof youtube_id !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(youtube_id)) {
      return jsonResponse({ error: "invalid youtube_id" }, 400);
    }

    // Length caps prevent token/cost abuse via direct edge function calls.
    if (typeof title !== "string" || title.length > 300) {
      return jsonResponse({ error: "invalid title" }, 400);
    }
    if (channel != null && (typeof channel !== "string" || channel.length > 200)) {
      return jsonResponse({ error: "invalid channel" }, 400);
    }

    // Never trust a client-supplied thumbnail URL — it ends up in a globally
    // readable table. Reconstruct it deterministically from the validated id.
    const safeThumb = `https://i.ytimg.com/vi/${youtube_id}/hqdefault.jpg`;

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

    // ===== Optimistic stub insert: create the song row IMMEDIATELY so the
    // client can navigate to /song/:id while the heavy work runs in the
    // background via EdgeRuntime.waitUntil. The row is filled in / updated
    // as lyrics arrive (realtime broadcasts the changes). =====
    const cleanedTitleEarly = cleanYoutubeTitle(title);
    const ytSplitForStub = splitTitleArtist(cleanedTitleEarly);
    const stubArtist = ytSplitForStub?.artist || (channel ? String(channel).replace(/\s*-?\s*Topic\s*$/i, "").trim() : "") || "Unknown";
    const stubTitle = ytSplitForStub?.title || cleanedTitleEarly || title;

    const { data: stubSong, error: stubError } = await supabase
      .from("songs")
      .insert({
        title: stubTitle,
        artist: stubArtist,
        genre: "pop latino",
        difficulty: "intermediate",
        youtube_id,
        album_art_url: safeThumb,
        is_synced: false,
      })
      .select("id")
      .single();

    if (stubError || !stubSong) {
      console.error("Stub song insert failed:", stubError);
      return jsonResponse({ error: "Failed to create song" }, 500);
    }

    const songId = stubSong.id;

    // Kick off background work and respond immediately with the song id.
    // EdgeRuntime.waitUntil keeps the function alive past the response.
    // @ts-ignore — EdgeRuntime is provided by the Supabase Edge runtime.
    EdgeRuntime.waitUntil(
      generateLyricsInBackground({
        supabase,
        songId,
        youtube_id,
        cleanedTitle: cleanedTitleEarly,
        channel: typeof channel === "string" ? channel : "",
        GENIUS_TOKEN,
        LOVABLE_API_KEY,
      }).catch((err) => {
        console.error("Background generation crashed:", err instanceof Error ? err.message : err);
      }),
    );

    return jsonResponse({ song_id: songId, pending: true, existed: false, lines: [] });
  } catch (error) {
    console.error("Unexpected generate-lyrics error:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

// ===== Background pipeline. All work after the optimistic stub-song
// response lives here. The function inserts placeholder lyric_lines
// (spanish_text + timestamps, english_translation = null) as soon as raw
// lyrics are scraped, then UPDATEs each row with the AI translation. The
// songs row is UPDATEd in place. Realtime broadcasts every change. =====
type BgArgs = {
  supabase: ReturnType<typeof createClient>;
  songId: string;
  youtube_id: string;
  cleanedTitle: string;
  channel: string;
  GENIUS_TOKEN: string;
  LOVABLE_API_KEY: string;
};

async function markSongFailed(
  supabase: ReturnType<typeof createClient>,
  songId: string,
  reason: string,
): Promise<void> {
  try {
    // Stash failure reason in the artist column suffix is too hacky; just
    // log. The frontend has its own timeout/error UX. We DO mark is_synced
    // false so nothing claims sync. Future: dedicated status column.
    console.error(`[song ${songId}] generation failed: ${reason}`);
    await supabase.from("songs").update({ is_synced: false }).eq("id", songId);
  } catch (e) {
    console.error("markSongFailed update failed:", e instanceof Error ? e.message : e);
  }
}

async function generateLyricsInBackground(args: BgArgs): Promise<void> {
  const { supabase, songId, youtube_id, cleanedTitle, channel, GENIUS_TOKEN, LOVABLE_API_KEY } = args;
  try {
    // ===== Genius lookup: race ALL query variants in parallel. The first
    // non-null candidate wins; the others are discarded. =====
    let geniusHit: { title: string; artist: string; url: string } | null = null;
    try {
      const geniusQueries = new Set<string>();
      geniusQueries.add(cleanedTitle);
      const simplified = simplifyForSearch(cleanedTitle);
      if (simplified) geniusQueries.add(simplified);
      const split = splitTitleArtist(cleanedTitle);
      if (split) geniusQueries.add(simplifyForSearch(`${split.artist} ${split.title}`));
      if (channel) {
        const ch = channel.replace(/\s*-?\s*(?:Topic|VEVO)\s*$/i, "").trim();
        if (ch) geniusQueries.add(`${simplifyForSearch(cleanedTitle)} ${ch}`);
      }
      console.log(`Searching Genius in parallel: ${geniusQueries.size} queries`);
      const geniusResults = await Promise.allSettled(
        [...geniusQueries].filter(Boolean).map((q) => searchGenius(q, GENIUS_TOKEN)),
      );
      for (const r of geniusResults) {
        if (r.status === "fulfilled" && r.value) {
          geniusHit = r.value;
          break;
        }
      }
    } catch (error) {
      console.error("Genius parallel search failed:", error instanceof Error ? error.message : error);
    }

    if (!geniusHit) {
      console.warn("Genius lookup failed — continuing with YouTube metadata only");
    } else {
      const COMPILATION_RE = /(awards?|nominees?|billboard|playlist|compilation|compilaci[oó]n|full album|[aá]lbum completo|mega ?mix|top \d+|best of|lo mejor de|sencillos del mes|monthly singles|hits of \d{4}|singles? of \d{4})/i;
      const COMPILATION_ARTIST_RE = /^(billboard|genius(\s+en\s+espa[nñ]ol)?|various artists|spotify|apple music|youtube)$/i;
      if (COMPILATION_RE.test(geniusHit.title) || COMPILATION_ARTIST_RE.test(geniusHit.artist.trim())) {
        console.warn("Rejecting Genius compilation/awards page:", geniusHit.title, "by", geniusHit.artist);
        geniusHit = null;
      }
    }

    let rawLyrics: string | null = null;
    let lyricsSource = "none";
    let syncedTimestamps: number[] = [];

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
      const { fetchSyairLrc, alignWithWhisper } = await import("../_shared/lyrics-sync.ts");

      // ===== Lyrics + sync race: ALL providers fire concurrently. =====
      // Lyrics text sources (5+): lrclib (×attempts), NetEase, Megalobiz,
      // Syair, Genius, Firecrawl web fallback.
      // Sync sources (5): lrclib-synced, NetEase-synced, Megalobiz-synced,
      // Syair-synced, Whisper alignment (kicked off in parallel below).
      type LyricResult = { src: string; text: string; synced: SyncedLine[] } | null;
      const lrclibPromises: Promise<LyricResult>[] = lrclibAttempts
        .filter((a) => a.title && a.artist)
        .map((attempt) =>
          fetchLrclibLyrics(attempt.title, attempt.artist).then((r) =>
            r && r.plain.length >= 50
              ? { src: "lrclib", text: r.plain, synced: r.synced }
              : null,
          ),
        );
      const neteasePromise: Promise<LyricResult> = (cleanTitle && cleanArtist)
        ? fetchNeteaseLrc(cleanTitle, cleanArtist).then((r) =>
            r ? { src: "netease", text: r.plain, synced: r.synced } : null,
          )
        : Promise.resolve(null);
      const megalobizPromise: Promise<LyricResult> = (cleanTitle && cleanArtist)
        ? fetchMegalobizLrc(cleanTitle, cleanArtist).then((r) =>
            r ? { src: "megalobiz", text: r.plain, synced: r.synced } : null,
          )
        : Promise.resolve(null);
      const syairPromise: Promise<LyricResult> = (cleanTitle && cleanArtist)
        ? fetchSyairLrc(cleanTitle, cleanArtist).then((r) =>
            r ? { src: "syair", text: r.plain, synced: r.synced } : null,
          )
        : Promise.resolve(null);
      const geniusPromise: Promise<LyricResult> = geniusHit
        ? fetchGeniusLyrics(geniusHit.url).then((t) =>
            t && t.length >= 50 ? { src: "genius", text: t, synced: [] as SyncedLine[] } : null,
          )
        : Promise.resolve(null);
      // Firecrawl web fallback now races alongside the others (no longer a
      // serial fallback). Its result is preferred only when no native source
      // returns usable plain text.
      const fbTitleEarly = ytSplit?.title || cleanTitle;
      const fbArtistEarly = ytSplit?.artist || cleanArtist;
      const firecrawlPromise: Promise<LyricResult> = (fbTitleEarly && fbArtistEarly)
        ? fetchWebFallbackLyrics(fbTitleEarly, fbArtistEarly, LOVABLE_API_KEY).then((t) =>
            t ? { src: "firecrawl", text: t, synced: [] as SyncedLine[] } : null,
          )
        : Promise.resolve(null);

      // Whisper alignment runs in parallel too. It needs plain text + youtube
      // audio. We kick it off as soon as ANY native source resolves with
      // usable plain text — the wrapper below races the providers internally
      // and starts whisper without waiting for all of them.
      let firstPlainResolve: (v: string | null) => void;
      const firstPlain = new Promise<string | null>((res) => { firstPlainResolve = res; });
      const tap = <T extends LyricResult>(p: Promise<T>): Promise<T> =>
        p.then((r) => {
          if (r && r.text && r.text.length >= 50) firstPlainResolve(r.text);
          return r;
        });
      const whisperPromise: Promise<{ src: "whisper"; synced: SyncedLine[] } | null> =
        (async () => {
          const plain = await Promise.race<string | null>([
            firstPlain,
            new Promise<null>((res) => setTimeout(() => res(null), 25000)),
          ]);
          if (!plain) return null;
          const aligned = await alignWithWhisper(youtube_id, plain, LOVABLE_API_KEY);
          if (aligned && aligned.synced.length > 0) {
            return { src: "whisper", synced: aligned.synced };
          }
          return null;
        })();

      const parallelResults = await Promise.all([
        ...lrclibPromises.map(tap),
        tap(neteasePromise),
        tap(megalobizPromise),
        tap(syairPromise),
        tap(geniusPromise),
        tap(firecrawlPromise),
      ]);
      // Ensure firstPlain resolves even if nothing usable came back, so the
      // whisper promise can wrap up.
      firstPlainResolve!(null);
      const whisperResult = await whisperPromise;

      const outcome = (src: string) =>
        parallelResults.some((r) => r?.src === src && r.synced.length > 0)
          ? "synced"
          : parallelResults.some((r) => r?.src === src)
            ? "plain"
            : "miss";
      console.log(
        `lyrics providers: lrclib=${outcome("lrclib")} netease=${outcome("netease")} megalobiz=${outcome("megalobiz")} syair=${outcome("syair")} genius=${outcome("genius")} firecrawl=${outcome("firecrawl")} whisper=${whisperResult ? "synced" : "miss"}`,
      );

      // Selection priority for plain text:
      //   1. any provider that returned real synced timestamps
      //   2. Genius / lrclib / NetEase / Megalobiz / Syair plain text
      //   3. Firecrawl web fallback
      const syncedHit = parallelResults.find((r) => r && r.synced.length > 0);
      const NATIVE_ORDER = ["genius", "lrclib", "netease", "megalobiz", "syair"];
      const nativeHit = NATIVE_ORDER
        .map((s) => parallelResults.find((r) => r?.src === s))
        .find((r) => !!r);
      const firecrawlHit = parallelResults.find((r) => r?.src === "firecrawl");
      const chosen = syncedHit ?? nativeHit ?? firecrawlHit ?? null;
      if (chosen) {
        rawLyrics = chosen.text;
        lyricsSource = chosen.synced.length > 0 ? `${chosen.src}_synced` : chosen.src;
        if (chosen.synced.length > 0) {
          syncedTimestamps = chosen.synced.map((s) => s.time);
        }
      }

      // If no provider gave timestamps but Whisper succeeded, adopt them.
      if (syncedTimestamps.length === 0 && whisperResult) {
        syncedTimestamps = whisperResult.synced.map((s) => s.time);
        lyricsSource = `${lyricsSource}+whisper_aligned`;
        console.log("whisper alignment adopted:", whisperResult.synced.length, "lines");
      }
    } catch (error) {
      console.error("Lyrics retrieval failed:", error instanceof Error ? error.message : error);
      await markSongFailed(supabase, songId, "Lyrics retrieval failed");
      return;
    }

    if (!rawLyrics || rawLyrics.length < 50) {
      console.error("Could not retrieve lyrics for:", cleanTitle, cleanArtist);
      await markSongFailed(supabase, songId, "No lyrics found");
      return;
    }

    // ===== Phase 1: insert placeholder lyric_lines (spanish_text + timestamps,
    // english_translation = null) so realtime subscribers see Spanish text
    // appear immediately, with skeletons in the translation slot. =====
    const cleanLines = rawLyrics
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^\[[^\]]+\]$/.test(l));
    const placeholderRows = cleanLines.map((text, index) => {
      const haveSync = syncedTimestamps.length > 0;
      const srcIdx = haveSync
        ? (cleanLines.length === 1
            ? 0
            : Math.min(
                syncedTimestamps.length - 1,
                Math.round((index * (syncedTimestamps.length - 1)) / Math.max(1, cleanLines.length - 1)),
              ))
        : 0;
      const start = haveSync ? syncedTimestamps[srcIdx] : 0;
      return {
        song_id: songId,
        line_index: index,
        spanish_text: text,
        hebrew_translation: null as string | null,
        english_translation: null as string | null,
        pronunciation: null as string | null,
        start_seconds: start,
        end_seconds: 0,
        is_chorus: false,
      };
    });

    if (placeholderRows.length === 0) {
      await markSongFailed(supabase, songId, "Lyrics split produced no lines");
      return;
    }

    const { error: phErr } = await supabase.from("lyric_lines").insert(placeholderRows);
    if (phErr) {
      console.error("Placeholder lyric_lines insert failed:", phErr);
      await markSongFailed(supabase, songId, "Failed to save placeholder lyrics");
      return;
    }

    // Flip is_synced now if we have real timestamps so the player switches
    // to synced mode the moment lines appear.
    if (syncedTimestamps.length > 0) {
      await supabase.from("songs").update({ is_synced: true }).eq("id", songId);
    }

    const inputLineCount = cleanLines.length;
    console.log(
      `Sending lyrics to AI: ${rawLyrics.length} characters, ${inputLineCount} lyric lines, source=${lyricsSource}`,
    );

    // ===== Phase 2: AI translation. =====
    let parsed: any;
    try {
      const userPrompt = `Song title: "${cleanTitle}"
Artist: ${cleanArtist}

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
        await markSongFailed(supabase, songId, `AI translation HTTP ${aiResponse.status}`);
        return;
      }

      let aiData = await aiResponse.json();
      let toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.warn("AI returned no tool call, retrying once");
        aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildAiRequest(`${SYSTEM_PROMPT}\nReturn ONLY by calling save_song.`, userPrompt, 12000)),
        });

        if (!aiResponse.ok) {
          console.error("AI translation retry error:", aiResponse.status, await aiResponse.text());
          await markSongFailed(supabase, songId, "AI translation retry failed");
          return;
        }

        aiData = await aiResponse.json();
        toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      }
      if (!toolCall?.function?.arguments) {
        await markSongFailed(supabase, songId, "AI did not return translated lyric lines");
        return;
      }
      parsed = JSON.parse(toolCall.function.arguments);

      const outputLineCount = Array.isArray(parsed.lines) ? parsed.lines.length : 0;
      if (inputLineCount >= 10 && outputLineCount < Math.ceil(inputLineCount * 0.8)) {
        console.error(
          `Incomplete AI translation: input=${inputLineCount}, output=${outputLineCount}`,
        );
        await markSongFailed(supabase, songId, "AI returned incomplete lyrics");
        return;
      }
    } catch (error) {
      console.error("AI translation logic failed:", error instanceof Error ? error.message : error);
      await markSongFailed(supabase, songId, "AI translation crashed");
      return;
    }

    // ===== Phase 3: UPDATE placeholder rows with AI translations. =====
    // Map synced timestamps onto AI lines (count may differ from cleanLines).
    const aiLines = (parsed.lines ?? []) as Array<any>;
    const n = aiLines.length;
    const m = syncedTimestamps.length;
    const haveSync = m > 0 && n > 0;
    const starts: number[] = new Array(n).fill(0);
    if (haveSync) {
      if (n === m) {
        for (let i = 0; i < n; i++) starts[i] = syncedTimestamps[i];
      } else {
        for (let i = 0; i < n; i++) {
          const srcIdx = n === 1 ? 0 : Math.min(m - 1, Math.round((i * (m - 1)) / (n - 1)));
          starts[i] = syncedTimestamps[srcIdx];
        }
      }
    }

    // UPDATE rows by (song_id, line_index). Stream them one-by-one with a
    // tiny gap so realtime broadcasts a visible "translations filling in"
    // wave rather than one big batch flash.
    const STREAM_DELAY_MS = 25;
    for (let index = 0; index < n; index++) {
      const line = aiLines[index];
      const start = haveSync ? starts[index] : 0;
      const wordCount = String(line.spanish_text ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length || 1;
      const estimatedSung = Math.max(1.8, Math.min(7, wordCount * 0.45 + 0.8));
      const nextStart = haveSync && index < n - 1 ? starts[index + 1] : Infinity;
      const end = haveSync ? Math.min(nextStart, start + estimatedSung) : 0;

      const patch = {
        spanish_text: line.spanish_text,
        english_translation: line.english_translation,
        pronunciation: line.pronunciation ?? null,
        start_seconds: start,
        end_seconds: end,
        is_chorus: Boolean(line.is_chorus),
      };

      // If this index already has a placeholder row, UPDATE it; otherwise INSERT.
      if (index < placeholderRows.length) {
        const { error: upErr } = await supabase
          .from("lyric_lines")
          .update(patch)
          .eq("song_id", songId)
          .eq("line_index", index);
        if (upErr) console.error(`update line ${index} failed:`, upErr.message);
      } else {
        const { error: insErr } = await supabase
          .from("lyric_lines")
          .insert({ song_id: songId, line_index: index, hebrew_translation: null, ...patch });
        if (insErr) console.error(`insert line ${index} failed:`, insErr.message);
      }
      if (STREAM_DELAY_MS > 0) await new Promise((r) => setTimeout(r, STREAM_DELAY_MS));
    }

    // If AI returned FEWER lines than placeholders, delete the extras so
    // the UI doesn't show un-translated junk at the end.
    if (n < placeholderRows.length) {
      const { error: delErr } = await supabase
        .from("lyric_lines")
        .delete()
        .eq("song_id", songId)
        .gte("line_index", n);
      if (delErr) console.error("trim excess placeholder rows failed:", delErr.message);
    }

    // ===== Phase 4: finalize song metadata (genre/difficulty/title/artist). =====
    const { error: songUpdErr } = await supabase
      .from("songs")
      .update({
        title: parsed.title || cleanTitle,
        artist: parsed.artist || cleanArtist,
        genre: parsed.genre || "pop latino",
        difficulty: parsed.difficulty || "intermediate",
        is_synced: syncedTimestamps.length > 0,
      })
      .eq("id", songId);
    if (songUpdErr) console.error("song finalize update failed:", songUpdErr.message);

    console.log(`[song ${songId}] generation complete: ${n} lines, source=${lyricsSource}`);
  } catch (error) {
    console.error("Background generation error:", error instanceof Error ? error.message : error);
    await markSongFailed(supabase, songId, "Unexpected background error");
  }
}
