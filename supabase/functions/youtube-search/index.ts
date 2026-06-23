// Search YouTube for songs — quota-free scrape of the public web results page.
// No more dependency on the official Data API v3 (which exhausts daily quota
// at 100 search calls / project). We fetch https://www.youtube.com/results,
// parse the embedded `ytInitialData` JSON, and extract videoRenderer items.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Title cleaner (kept in sync with src/lib/cleanTitle.ts) ---
const JUNK_KEYWORDS = [
  "official", "audio", "video", "lyric", "lyrics", "lyric video", "music video",
  "mv", "m/v", "visualizer", "visualiser", "hd", "hq", "4k", "8k",
  "remaster", "remastered", "anniversary", "edit", "extended", "version",
  "color coded", "color-coded", "sub español", "sub espanol", "sub eng",
  "english", "letra", "vevo", "topic", "explicit",
];
const FEAT_RE = /\s*[\(\[\{]\s*((?:feat\.?|ft\.?|featuring|con|with)\s+[^)\]\}]+)[\)\]\}]/i;
const stripEmoji = (s: string) =>
  s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, "");
const trimSeparators = (s: string) =>
  s.replace(/^[\s\-–—|:•·]+|[\s\-–—|:•·]+$/g, "").replace(/\s+/g, " ").trim();

function cleanYoutubeText(raw: string): string {
  if (!raw) return "";
  let s = stripEmoji(raw);
  let feat = "";
  const featMatch = s.match(FEAT_RE);
  if (featMatch) {
    feat = ` ${featMatch[1].replace(/\s+/g, " ").trim()}`;
    s = s.replace(FEAT_RE, " ");
  }
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

// --- Quota-free YouTube search via public results page scrape ---
type ScrapedResult = {
  youtube_id: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  published_at: string | null;
};

const YT_HEADERS: HeadersInit = {
  // Modern desktop UA — required for YouTube to return the rich
  // `ytInitialData` JSON inline (instead of a stripped-down or consent page).
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  // CONSENT cookie bypasses the EU/UK GDPR consent interstitial that
  // otherwise serves a different HTML shell with no search results.
  "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+000",
};

function extractYtInitialData(html: string): unknown | null {
  // YouTube embeds the SSR state as `var ytInitialData = {...};</script>` or
  // `window["ytInitialData"] = {...};`. Match both forms.
  const patterns = [
    /var ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/,
    /ytInitialData"?\]?\s*=\s*(\{[\s\S]+?\});\s*<\/script>/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      try { return JSON.parse(m[1]); } catch { /* try next */ }
    }
  }
  return null;
}

function walkVideoRenderers(node: unknown, out: ScrapedResult[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkVideoRenderers(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  const vr = obj.videoRenderer as Record<string, unknown> | undefined;
  if (vr && typeof vr.videoId === "string") {
    const id = vr.videoId as string;
    const titleRuns = (vr.title as { runs?: { text?: string }[] } | undefined)?.runs;
    const title = titleRuns?.[0]?.text ?? "";
    const owner = (vr.ownerText as { runs?: { text?: string }[] } | undefined)?.runs?.[0]?.text
      ?? (vr.longBylineText as { runs?: { text?: string }[] } | undefined)?.runs?.[0]?.text
      ?? "";
    const thumbs = (vr.thumbnail as { thumbnails?: { url: string }[] } | undefined)?.thumbnails ?? [];
    const thumb = thumbs[thumbs.length - 1]?.url ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    const published = (vr.publishedTimeText as { simpleText?: string } | undefined)?.simpleText ?? null;
    if (id && title && !out.some((r) => r.youtube_id === id)) {
      out.push({ youtube_id: id, title, channel: owner, thumbnail: thumb, published_at: published });
    }
  }
  for (const key of Object.keys(obj)) walkVideoRenderers(obj[key], out);
}

async function scrapeYouTubeSearch(query: string): Promise<ScrapedResult[]> {
  // sp=EgIQAQ%253D%253D filters to "videos only" (no channels/playlists).
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
  const resp = await fetch(url, { headers: YT_HEADERS, redirect: "follow" });
  if (!resp.ok) {
    throw new Error(`YouTube returned HTTP ${resp.status}`);
  }
  const html = await resp.text();

  // Primary path: parse ytInitialData and walk every videoRenderer in the tree.
  const data = extractYtInitialData(html);
  const out: ScrapedResult[] = [];
  if (data) walkVideoRenderers(data, out);

  // Fallback path: if ytInitialData wasn't found (rare layout change),
  // regex-scan the raw HTML for video IDs and synthesize minimal rows.
  if (out.length === 0) {
    const seen = new Set<string>();
    const idRe = /"videoId":"([A-Za-z0-9_-]{11})"/g;
    let m: RegExpExecArray | null;
    while ((m = idRe.exec(html)) !== null && out.length < 10) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        youtube_id: id,
        title: query,
        channel: "",
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        published_at: null,
      });
    }
  }
  return out.slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated caller to protect the endpoint.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { q } = await req.json();
    if (!q || typeof q !== "string" || q.length < 2 || q.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid query" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bias toward official single-track uploads ("official audio" / "topic" channels).
    const query = `${q} official audio`;

    let scraped: ScrapedResult[] = [];
    try {
      scraped = await scrapeYouTubeSearch(query);
    } catch (err) {
      console.error("youtube-search scrape failed", err);
      // Retry once with a cleaner query (just the user's text, no biasing).
      try {
        scraped = await scrapeYouTubeSearch(q);
      } catch (err2) {
        console.error("youtube-search retry failed", err2);
        // Contained failure — frontend healing flow expects a 200 with fallback flag.
        return new Response(
          JSON.stringify({ results: [], fallback: true, error: "YOUTUBE_SERVICE_UNAVAILABLE" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Exclude "Official Video" titles (consecutive, case-insensitive) to prefer
    // audio/lyric uploads that sync better. Keeps "Official Music Video",
    // "Official Audio", etc. Falls back to first original if filter empties.
    const filteredScraped = scraped.filter(
      (r) => !r.title.toLowerCase().includes("official video"),
    );
    const safeScraped = filteredScraped.length > 0
      ? filteredScraped
      : (scraped.length > 0 ? [scraped[0]] : []);

    const raw = safeScraped.map((r) => ({
      youtube_id: r.youtube_id,
      title: cleanYoutubeText(r.title) || r.title,
      channel: cleanYoutubeText(r.channel) || r.channel,
      thumbnail: r.thumbnail,
      published_at: r.published_at,
    })).filter((r) => r.youtube_id);

    // Blocklist: compilations, award shows, full albums, playlists, mixes — not single tracks.
    const BLOCK = [
      "awards", "nominees", "billboard", "full album", "álbum completo", "album completo",
      "playlist", "mix", "compilation", "compilación", "mega mix", "megamix",
      "top 100", "top 50", "top 40", "top 20", "top 10", "best of", "lo mejor de",
      "1 hour", "2 hours", "live stream", "tribute", "homenaje",
    ];
    const isBlocked = (r: { title: string; channel: string }) => {
      const hay = `${r.title} ${r.channel}`.toLowerCase();
      return BLOCK.some((w) => hay.includes(w));
    };
    // Drop blocked entries from the first 3 positions; keep the rest as-is at the tail.
    const head = raw.slice(0, 3);
    const tail = raw.slice(3);
    const cleanHead = head.filter((r) => !isBlocked(r));
    const skippedHead = head.filter((r) => isBlocked(r));
    const results = [...cleanHead, ...tail, ...skippedHead];

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("youtube-search error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
