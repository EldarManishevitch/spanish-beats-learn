# Lyrics Sync That Works Like Spotify / Apple Music

## How Spotify & Apple Music actually do it

Both rely on **per-line timestamps from the source** (Musixmatch's `richsync`/`subtitle`, Apple's TTML lyrics). They never *guess* where the intro ends — they just don't activate any line until the first real timestamp fires. If a track has no timed lyrics, they fall back to **static, non-highlighting lyrics** (Apple calls these "Lyrics", vs "Sync Lyrics"). They never pretend to sync.

That's the model we should copy. The earlier "guess the intro length" heuristic is wrong because real intros vary from 0s to 60s+ and no clamp covers them all.

## Root causes (generic, not song-specific)

1. **Backend collapses gaps.** `end_seconds` is forced to `nextStart`, so during any instrumental section (intro is just one case — also mid-song breaks, bridges, outros) the previous line stays "active" until the singer returns.
2. **Frontend trusts that bad `end_seconds`** for hundreds of legacy rows.
3. **Zero-timestamp songs fake a uniform spread** across the full track, which is wrong for every song with any intro/outro/break.

## What to change

### 1. Backend — preserve real LRC gaps (`supabase/functions/generate-lyrics/index.ts`)

- When AI line count == LRC line count, do a strict 1:1 timestamp mapping.
- Compute `end_seconds` per line so it reflects *singing*, not "the gap until the next line":
  ```
  estimatedSung = clamp(wordCount * 0.45 + 0.8, 1.8, 7)   // seconds
  end           = min(nextStart, start + estimatedSung)
  ```
  Last line uses `start + estimatedSung`. This automatically handles intros (line 1's `start` is whatever LRC says — 3s, 20s, 60s, anything), mid-song breaks, and outros, with zero heuristics.
- Persist a new boolean column `songs.is_synced` (true when we wrote real LRC timestamps, false otherwise). Used by the frontend to decide whether to highlight at all.

### 2. Frontend — cap legacy rows the same way at render time (`src/components/SectionedSongPlayer.tsx`)

Existing rows already have `end = nextStart`. Fix without a migration:
```
estimatedEnd = start + clamp(wordCount * 0.45 + 0.8, 1.8, 7)
effectiveEnd = min(line.end_seconds, estimatedEnd)
```
Use `effectiveEnd` in the `isActive` check. Highlight drops naturally during every instrumental, regardless of length.

### 3. Drop the "uniform spread" fake-sync for unsynced songs

Remove the existing `fallbackTimings` (which spreads lines 0 → duration). For songs without real timestamps:
- Render lyrics in **static mode** (Apple Music style): no highlight, no auto-scroll, full opacity on every line, manual scroll only.
- Show a small one-time pill at the top of the lyrics box:
  ```tsx
  <span className="… text-xs text-[#2C2A29]/60">
    Static lyrics — sync unavailable for this track
  </span>
  ```
- Detect via the new `songs.is_synced` flag (and as a safety net: `liveLines.every(l => l.start_seconds === 0 && l.end_seconds === 0)`).

This is exactly Apple Music's behavior and is honest to the user instead of pretending.

### 4. Generic intro indicator for *synced* songs

For songs with real timestamps, derive:
- `firstStart` = smallest `start_seconds` in the active section.
- `isIntro` = `videoReady && currentPlaybackTime < firstStart - 0.2`.

Render a subtle pill **above the first line** only while `isIntro` is true. Same component shows for intros of any length — 2s, 20s, or 60s — because it's bound to the real first timestamp, not a clamp:
```tsx
{isIntro && (
  <div className="flex justify-center mb-2 animate-fade-in">
    <span className="inline-flex items-center gap-1.5 rounded-full
                     border border-[#2C2A29]/15 bg-[#FBF9F6]
                     px-3 py-1 text-xs font-medium text-[#2C2A29]/70
                     transition-opacity duration-300">
      🎵 Instrumental…
    </span>
  </div>
)}
```
Hidden during mid-song gaps (Spotify/Apple don't show anything there either — just no active line).

### 5. Smooth handoff during mid-song gaps

When no line is active mid-song, keep the previously active line scrolled into view in its inactive style (`lastScrolledLineId` already does this — just don't reset it on null active). No new auto-scroll behavior.

## Migration

```sql
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS is_synced boolean NOT NULL DEFAULT false;

-- Backfill: any song whose lyric_lines have a non-zero start_seconds is synced.
UPDATE public.songs s
   SET is_synced = true
 WHERE EXISTS (
   SELECT 1 FROM public.lyric_lines l
    WHERE l.song_id = s.id AND l.start_seconds > 0
 );
```

No new RLS policy needed (column added to an existing readable table).

## Out of scope

- No re-translation, no schema changes beyond the one column.
- No color/layout changes to the lyrics card.
- Word-level karaoke-style highlighting (Spotify "Behind the Lyrics") — would need richsync data we don't have.

## Verification

1. Song with a 3s intro: pill shows for ~3s, line 1 activates on time.
2. Song with a 45s intro: pill shows for ~45s, no line falsely activates before the singer.
3. Mid-song 15s instrumental break: highlight drops within ~3–5s of the last sung line, returns when the next line starts.
4. Song without LRC sync: static lyrics, no highlight, "Static lyrics — sync unavailable" pill, manual scroll.
5. New song generated after deploy: `songs.is_synced = true`, `lyric_lines.end_seconds` reflects real silence.
