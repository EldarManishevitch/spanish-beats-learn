// Shared YouTube title/artist normalizer.
// Goal: keep ONLY the song name and the artist (including featured artists).
// Inline-duplicated inside edge functions (youtube-search, generate-lyrics) since
// Deno functions cannot import from src/.

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

/**
 * Normalize a raw YouTube video title or channel name down to clean text.
 * Preserves "feat./ft./featuring/with/con" collaborator credits.
 */
export function cleanYoutubeText(raw: string): string {
  if (!raw) return "";
  let s = stripEmoji(raw);

  // 1. Extract & protect a "feat. X" segment so the bracket sweep doesn't kill it.
  let feat = "";
  const featMatch = s.match(FEAT_RE);
  if (featMatch) {
    feat = ` ${featMatch[1].replace(/\s+/g, " ").trim()}`;
    s = s.replace(FEAT_RE, " ");
  }

  // 2. Strip any bracketed/parenthesized junk that contains a junk keyword.
  const bracketRe = /[\(\[\{]([^\)\]\}]*)[\)\]\}]/g;
  s = s.replace(bracketRe, (full, inner) => {
    const low = String(inner).toLowerCase();
    if (JUNK_KEYWORDS.some((k) => low.includes(k))) return " ";
    // bracket with year only → drop
    if (/^\s*(19|20)\d{2}\s*$/.test(inner)) return " ";
    return full;
  });

  // 3. Trailing channel/label noise after a pipe or bullet.
  s = s.replace(/\s*[|•·]\s*[^|•·]*$/g, " ");

  // 4. Trailing " - Topic" / " - VEVO" / " - Official ..." on the channel side.
  s = s.replace(/\s*[-–—]\s*(?:Topic|VEVO|Official(?:\s+(?:Audio|Video|Music))?|Music|Records)\s*$/i, "");

  // 5. Channel suffixes glued without a dash: "ArtistVEVO", "Artist - Topic".
  s = s.replace(/\s*-\s*Topic\s*$/i, "").replace(/VEVO\s*$/i, "");

  // 6. Loose trailing junk words.
  s = s.replace(/\s+(?:HD|HQ|4K|8K|Official|Audio|Video|Visualizer|Lyrics?)\s*$/gi, "");

  s = trimSeparators(s);
  if (feat && !/feat\.?|ft\.?|featuring|with|con/i.test(s)) s = `${s}${feat}`;
  return trimSeparators(s);
}

/**
 * Parse a cleaned YouTube title into { artist, title }.
 * Uses the first " - " (or en/em dash) as the separator. Falls back to
 * channel name when no separator is present.
 */
export function parseArtistTitle(
  rawTitle: string,
  rawChannel?: string,
): { title: string; artist: string } {
  const cleanedTitle = cleanYoutubeText(rawTitle);
  const cleanedChannel = cleanYoutubeText(rawChannel ?? "");
  const parts = cleanedTitle.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    return {
      artist: trimSeparators(parts[0]),
      title: trimSeparators(parts.slice(1).join(" - ")),
    };
  }
  return { artist: cleanedChannel, title: cleanedTitle };
}
