// Shared synced-lyric providers used by both generate-lyrics and resync-lyrics.
// Each provider returns { plain, synced } where `synced` is the parsed LRC
// (possibly empty). The four providers are designed to race in parallel.

export type SyncedLine = { time: number; text: string };

export function parseSyncedLrc(text: string): SyncedLine[] {
  const out: SyncedLine[] = [];
  for (const raw of text.split("\n")) {
    const prefixes = raw.match(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g);
    if (!prefixes) continue;
    const content = raw.replace(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g, "").trim();
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

export function stripLrcTimestamps(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
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

// --- lrclib.net ------------------------------------------------------------
export async function fetchLrclibLyrics(
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
    }
    const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const searchResponse = await fetch(searchUrl, { headers });
    if (!searchResponse.ok) return null;
    const results = await searchResponse.json();
    const hit = Array.isArray(results) ? results.find((x: any) => x.plainLyrics || x.syncedLyrics) : null;
    if (!hit) return null;
    return pickFrom(hit);
  } catch (e) {
    console.error("lrclib fetch failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// --- NetEase Cloud Music ---------------------------------------------------
export async function fetchNeteaseLrc(
  title: string,
  artist: string,
): Promise<{ plain: string; synced: SyncedLine[] } | null> {
  if (!title) return null;
  const query = `${title} ${artist}`.trim();
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: "https://music.163.com/",
      Cookie: "appver=2.0.2",
    };
    const sUrl = `https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&limit=5`;
    const sRes = await fetch(sUrl, { headers });
    if (!sRes.ok) return null;
    const sData = await sRes.json();
    const songs: any[] = sData?.result?.songs ?? [];
    if (!songs.length) return null;
    const wantArtist = (artist || "").toLowerCase().split(/[, ]/)[0] ?? "";
    const pick = songs.find((s) =>
      wantArtist && Array.isArray(s.artists) &&
      s.artists.some((a: any) => String(a.name).toLowerCase().includes(wantArtist))
    ) ?? songs[0];
    if (!pick?.id) return null;
    const lRes = await fetch(`https://music.163.com/api/song/lyric?id=${pick.id}&lv=1&tv=-1`, { headers });
    if (!lRes.ok) return null;
    const lData = await lRes.json();
    const lrc: string = lData?.lrc?.lyric ?? "";
    if (!lrc || lrc.length < 30) return null;
    const synced = parseSyncedLrc(lrc);
    if (synced.length < 4) return null;
    const plain = synced.map((s) => s.text).join("\n");
    if (plain.trim().length < 50) return null;
    return { plain, synced };
  } catch (e) {
    console.error("netease fetch failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// --- Megalobiz -------------------------------------------------------------
export async function fetchMegalobizLrc(
  title: string,
  artist: string,
): Promise<{ plain: string; synced: SyncedLine[] } | null> {
  if (!title) return null;
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    };
    const query = `${title} ${artist}`.trim();
    const sRes = await fetch(
      `https://www.megalobiz.com/search/all?qry=${encodeURIComponent(query)}&display=song`,
      { headers },
    );
    if (!sRes.ok) return null;
    const html = await sRes.text();
    const linkMatch = html.match(/<a[^>]+class="entity_name"[^>]+href="(\/lrc\/maker\/[^"]+)"/i);
    if (!linkMatch) return null;
    const pRes = await fetch(`https://www.megalobiz.com${linkMatch[1]}`, { headers });
    if (!pRes.ok) return null;
    const pHtml = await pRes.text();
    const bodyMatch = pHtml.match(/<div[^>]+id="lrc_\d+_[^"]+"[^>]*>([\s\S]*?)<\/div>/i);
    if (!bodyMatch) return null;
    const lrcText = decodeAndStrip(bodyMatch[1]);
    if (lrcText.length < 30) return null;
    const synced = parseSyncedLrc(lrcText);
    if (synced.length < 4) return null;
    const plain = synced.map((s) => s.text).join("\n");
    if (plain.trim().length < 50) return null;
    return { plain, synced };
  } catch (e) {
    console.error("megalobiz fetch failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// --- Syair (rentanadviser / syair community LRC mirror) --------------------
// Free, no key. Adds a 4th independent LRC source to the parallel race.
export async function fetchSyairLrc(
  title: string,
  artist: string,
): Promise<{ plain: string; synced: SyncedLine[] } | null> {
  if (!title) return null;
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    };
    const query = `${title} ${artist}`.trim();
    const sRes = await fetch(
      `https://syair.info/search?q=${encodeURIComponent(query)}`,
      { headers, signal: AbortSignal.timeout(10000) },
    );
    if (!sRes.ok) return null;
    const html = await sRes.text();
    // Pick first result link to a lyric page.
    const linkMatch = html.match(/<a[^>]+href="(\/lyrics\/[^"#?]+)"[^>]*>/i);
    if (!linkMatch) return null;
    const pageUrl = `https://syair.info${linkMatch[1]}`;
    const pRes = await fetch(pageUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!pRes.ok) return null;
    const pHtml = await pRes.text();
    // Try to locate a downloadable LRC block. Syair pages embed the LRC body
    // inside a <textarea> or a <pre> with class "lrc".
    let lrcText = "";
    const taMatch = pHtml.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i);
    if (taMatch) lrcText = decodeAndStrip(taMatch[1]);
    if (!lrcText || lrcText.length < 30) {
      const preMatch = pHtml.match(/<pre[^>]*class="[^"]*lrc[^"]*"[^>]*>([\s\S]*?)<\/pre>/i);
      if (preMatch) lrcText = decodeAndStrip(preMatch[1]);
    }
    if (!lrcText || lrcText.length < 30) return null;
    const synced = parseSyncedLrc(lrcText);
    if (synced.length < 4) return null;
    const plain = synced.map((s) => s.text).join("\n");
    if (plain.trim().length < 50) return null;
    return { plain, synced };
  } catch (e) {
    console.error("syair fetch failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// --- Whisper-based forced alignment via YouTube audio (best effort) --------
// Pulls audio through public cobalt-tools mirrors (no key required, may be
// rate-limited or offline), sends to Lovable AI gateway whisper, then aligns
// the timed segments to the given plain lyric lines by greedy word matching.
const COBALT_MIRRORS = [
  "https://api.cobalt.tools/api/json",
  "https://co.wuk.sh/api/json",
];

async function fetchYouTubeAudioUrl(youtubeId: string): Promise<string | null> {
  const url = `https://www.youtube.com/watch?v=${youtubeId}`;
  for (const endpoint of COBALT_MIRRORS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          url,
          downloadMode: "audio",
          audioFormat: "mp3",
          filenameStyle: "basic",
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const audioUrl: string | undefined = data?.url ?? data?.audio ?? data?.stream?.url;
      if (typeof audioUrl === "string" && audioUrl.startsWith("http")) return audioUrl;
    } catch (e) {
      console.warn("cobalt mirror failed:", endpoint, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

function normalizeWord(w: string): string {
  return w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

type WhisperSegment = { start: number; text: string };

async function transcribeWithTimestamps(
  audioBytes: Uint8Array,
  lovableApiKey: string,
): Promise<WhisperSegment[] | null> {
  const fd = new FormData();
  fd.append("file", new Blob([audioBytes], { type: "audio/mpeg" }), "audio.mp3");
  fd.append("model", "openai/gpt-4o-mini-transcribe");
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "segment");
  fd.append("language", "es");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableApiKey}` },
    body: fd,
  });
  if (!res.ok) {
    console.warn("whisper transcription failed:", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const data = await res.json();
  const segments = Array.isArray(data?.segments) ? data.segments : [];
  if (!segments.length) return null;
  return segments
    .map((s: any) => ({ start: Number(s.start) || 0, text: String(s.text ?? "") }))
    .filter((s: WhisperSegment) => s.text.trim().length > 0);
}

function alignLinesToSegments(
  plainLines: string[],
  segments: WhisperSegment[],
): number[] | null {
  // Greedy walk: for each lyric line, find the next segment whose normalized
  // tokens contain the first 2-3 normalized tokens of the lyric line.
  const segTokens = segments.map((s) => s.text.split(/\s+/).map(normalizeWord).filter(Boolean));
  const starts: number[] = new Array(plainLines.length).fill(-1);
  let cursor = 0;
  for (let i = 0; i < plainLines.length; i++) {
    const lineTokens = plainLines[i].split(/\s+/).map(normalizeWord).filter(Boolean);
    if (lineTokens.length === 0) { starts[i] = starts[i - 1] ?? 0; continue; }
    const probe = lineTokens.slice(0, Math.min(3, lineTokens.length));
    let found = -1;
    for (let j = cursor; j < segments.length; j++) {
      const st = segTokens[j];
      // need first probe token to appear and at least one more from probe nearby
      const idx = st.indexOf(probe[0]);
      if (idx === -1) continue;
      const tail = st.slice(idx + 1);
      const others = probe.slice(1).filter((p) => tail.includes(p) || st.includes(p));
      if (probe.length === 1 || others.length >= 1) { found = j; break; }
    }
    if (found !== -1) {
      starts[i] = segments[found].start;
      cursor = found + 1;
    }
  }
  // Backfill misses by linear interpolation between known anchors.
  const known: Array<{ i: number; t: number }> = [];
  starts.forEach((t, i) => { if (t >= 0) known.push({ i, t }); });
  if (known.length < Math.max(3, Math.floor(plainLines.length * 0.3))) {
    return null; // not enough anchors to trust alignment
  }
  for (let i = 0; i < plainLines.length; i++) {
    if (starts[i] >= 0) continue;
    // find surrounding known anchors
    const before = [...known].reverse().find((k) => k.i < i);
    const after = known.find((k) => k.i > i);
    if (before && after) {
      const ratio = (i - before.i) / (after.i - before.i);
      starts[i] = before.t + ratio * (after.t - before.t);
    } else if (before) {
      starts[i] = before.t + (i - before.i) * 2.5;
    } else if (after) {
      starts[i] = Math.max(0, after.t - (after.i - i) * 2.5);
    } else {
      starts[i] = 0;
    }
  }
  // Enforce monotonic
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] < starts[i - 1]) starts[i] = starts[i - 1] + 0.05;
  }
  return starts;
}

export async function alignWithWhisper(
  youtubeId: string,
  plainLyrics: string,
  lovableApiKey: string,
): Promise<{ synced: SyncedLine[] } | null> {
  try {
    const audioUrl = await fetchYouTubeAudioUrl(youtubeId);
    if (!audioUrl) {
      console.log("whisper-align: no audio URL (cobalt mirrors unavailable)");
      return null;
    }
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(45000) });
    if (!audioRes.ok) {
      console.warn("whisper-align: audio fetch failed", audioRes.status);
      return null;
    }
    const buf = new Uint8Array(await audioRes.arrayBuffer());
    if (buf.byteLength < 50_000 || buf.byteLength > 24 * 1024 * 1024) {
      console.warn("whisper-align: audio size out of range", buf.byteLength);
      return null;
    }
    const segments = await transcribeWithTimestamps(buf, lovableApiKey);
    if (!segments) return null;
    const plainLines = plainLyrics.split("\n").map((l) => l.trim()).filter(Boolean);
    const starts = alignLinesToSegments(plainLines, segments);
    if (!starts) {
      console.warn("whisper-align: not enough anchors");
      return null;
    }
    const synced: SyncedLine[] = plainLines.map((text, i) => ({ time: starts[i], text }));
    return { synced };
  } catch (e) {
    console.error("whisper-align failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Map a sorted array of synced start times onto N AI-translated lines, using
// strict 1:1 when counts match and proportional mapping otherwise.
export function mapTimestampsToLines(
  syncedTimestamps: number[],
  lineCount: number,
): number[] {
  const n = lineCount;
  const m = syncedTimestamps.length;
  const starts: number[] = new Array(n).fill(0);
  if (m === 0 || n === 0) return starts;
  if (n === m) {
    for (let i = 0; i < n; i++) starts[i] = syncedTimestamps[i];
  } else {
    for (let i = 0; i < n; i++) {
      const srcIdx = n === 1 ? 0 : Math.min(m - 1, Math.round((i * (m - 1)) / (n - 1)));
      starts[i] = syncedTimestamps[srcIdx];
    }
  }
  return starts;
}

export function endSecondsForLine(start: number, text: string, nextStart: number): number {
  const wordCount = String(text ?? "").trim().split(/\s+/).filter(Boolean).length || 1;
  const estimatedSung = Math.max(1.8, Math.min(7, wordCount * 0.45 + 0.8));
  return Math.min(nextStart, start + estimatedSung);
}
