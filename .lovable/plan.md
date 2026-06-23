# Expand synced lyrics coverage

Right now we only check lrclib.net for synced lyrics. When it 404s the song falls back to plain text + AI translation, which trips the "Static lyrics — sync unavailable" UI. We'll add two more community LRC sources and a Gemini-based forced-alignment pass, run all of them in parallel, and pick the first source that returns real per-line timestamps.

## Strategy

Race four sync providers concurrently in `generate-lyrics`. First one that returns synced lines wins; the rest are dropped.

```text
                  ┌─ lrclib.net (current)
                  │
race(Promise.any) ┼─ NetEase Cloud Music (search → lyric API)
                  │
                  ├─ Megalobiz (HTML scrape → .lrc download)
                  │
                  └─ Gemini forced alignment (audio URL → timed transcript → line align)
```

If all four fail to produce synced timestamps, we keep today's behavior: use whichever plain-text source returned (lrclib/Genius/Firecrawl) and render Static Mode.

## Changes

### 1. `supabase/functions/generate-lyrics/index.ts`

Add three new fetchers next to `fetchLrclibLyrics`, each returning the existing `{ plain, synced: SyncedLine[] }` shape so the rest of the pipeline doesn't change.

**a. NetEase Cloud Music** (free, no key)
- `GET https://music.163.com/api/search/get?s=<title artist>&type=1&limit=5` → pick best song id
- `GET https://music.163.com/api/song/lyric?id=<id>&lv=1&tv=-1` → returns `lrc.lyric` in standard LRC format
- Parse with existing `parseSyncedLrc`. Strong catalog for Latin/Spanish pop.

**b. Megalobiz** (free, no key)
- `GET https://www.megalobiz.com/search/all?qry=<title artist>&display=song` → scrape first `<a class="entity_name" href="/lrc/maker/...">`
- `GET https://www.megalobiz.com/lrc/maker/<slug>` → extract `<div ... id="lrc_<id>_lyrics">…</div>` LRC block
- Parse with `parseSyncedLrc`.

**c. Gemini forced alignment** (paid, Lovable AI credits)
- Only fires when we already have plain lyrics from lrclib/Genius/Firecrawl but no synced timestamps from a–b.
- Single call to `google/gemini-2.5-pro` via `https://ai.gateway.lovable.dev/v1/chat/completions` with:
  - YouTube URL as `fileData` part (`fileUri: https://www.youtube.com/watch?v=<id>`, `mimeType: video/youtube`). Gemini accepts public YouTube URLs natively.
  - The plain lyrics in the prompt.
  - A `force_align` tool schema requiring `[{ index, start_seconds }]` for every input line, monotonically increasing, `start_seconds >= 0`.
- Validate the tool output: must cover ≥90% of lines and be sorted; otherwise discard.

**d. Race them**
Replace the current `Promise.all([...lrclibPromises, geniusPromise])` block (lines ~594–607) with:

```ts
const syncProviders = [
  ...lrclibPromises,            // already returns { src:'lrclib', text, synced }
  fetchNeteaseLrc(cleanTitle, cleanArtist),
  fetchMegalobizLrc(cleanTitle, cleanArtist),
];
const results = await Promise.all(syncProviders);
const synced = results.find((r) => r?.synced.length > 0);
const plain  = synced ?? results.find((r) => r?.text) ?? (await geniusPromise) ?? null;

if (plain && !synced) {
  // Last-chance forced alignment against the YouTube audio
  const aligned = await alignWithGemini(youtube_id, plain.text, LOVABLE_API_KEY);
  if (aligned) { rawLyrics = plain.text; syncedTimestamps = aligned; lyricsSource = "gemini_aligned"; }
}
```

Everything downstream (`syncedTimestamps`, `is_synced`, `start_seconds`/`end_seconds` capping) stays as-is.

**e. Logging**
Log each provider's outcome (`lrclib=hit/miss`, `netease=hit/miss`, `megalobiz=hit/miss`, `gemini_align=hit/miss/skipped`) so we can see coverage in `edge_function_logs`.

### 2. Frontend
No changes. The existing `is_synced`/`effectiveTimings`/intro pill logic already handles whatever timestamps land in `lyric_lines`.

### 3. Database
No schema changes. `songs.is_synced` already exists.

## Out of scope
- Musixmatch (user declined; needs paid key anyway).
- Re-running alignment for already-saved unsynced songs (can add a backfill button later).
- Word-level karaoke highlighting.
- Translation changes.

## Verification
1. Pick the user's failing track from `/song/2e605231-…` and re-trigger generation — confirm `lyrics_source` in logs becomes `netease`/`megalobiz`/`lrclib_synced`/`gemini_aligned` instead of `genius`/`web_fallback`.
2. Open the song page → the "Static lyrics — sync unavailable" pill is gone, intro pill shows while `t < firstStart`, lines highlight on beat with gaps during instrumentals.
3. Spot-check 3 more "Spotify-synced but lrclib-missing" tracks — at least one of NetEase/Megalobiz/Gemini should hit each.
4. `edge_function_logs`: zero new 5xx, Gemini alignment only fires when the first three miss.

## Cost note
Gemini 2.5 Pro on a 3-minute YouTube video is roughly the same credit cost as a normal translation call. It only runs when lrclib, NetEase, and Megalobiz all miss, so most songs cost nothing extra.
