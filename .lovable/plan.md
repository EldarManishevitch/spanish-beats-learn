# Clean YouTube titles to "Artist — Song" only

Currently YouTube titles like `Rauw Alejandro - Touching The Sky (Official Visualizer) [4K] | Sony Music`
leak into the search dropdown, the "Add a New Song" card, the Dashboard's "Last Searched"
grid, and the SongPage header. Only the song name and the artist (including featured artists)
should remain.

## What changes

### 1. Shared cleaner

Introduce a single normalization function used by both edge functions and the frontend.
It strips, in order:

- All bracketed/parenthesized junk: `(...)`, `[...]`, `{...}` containing any of:
  `official, audio, video, lyric(s), lyric video, music video, mv, m/v,
  visualizer, hd, hq, 4k, 8k, remaster(ed), anniversary, edit, extended,
  version, color coded, sub español, sub eng, español, english, letra, lyrics`.
- Channel tail noise: trailing ` - Topic`, ` VEVO`, ` Official`, ` Records`, ` Music`,
  ` | <anything>`, ` • <anything>`.
- Emojis and pictographs.
- Stray separators left at the start/end (`-`, `–`, `—`, `|`, `:`).
- Collapsed whitespace.

It explicitly **preserves** `ft.`, `feat.`, `featuring`, `con`, `&`, ` x `,
and `with` collaborator markers, so featured artists stay attached to the artist
field (e.g. `Bad Bunny ft. Drake — Title`).

After cleanup, if the title still contains a separator (`-`, `–`, `—`), it is split
into `{ artist, title }`. Otherwise the original artist (from Genius / channel) is
kept and only the song title is cleaned.

### 2. youtube-search edge function

Each returned row is passed through the cleaner before responding:

- `title` → cleaned display title.
- `channel` → `Topic`/`VEVO` suffix stripped.

The search dropdown immediately shows clean names.

### 3. generate-lyrics edge function

- Replace the current narrow `cleanYoutubeTitle` with the shared cleaner.
- Apply it to both the YouTube-derived title AND to the title/artist returned by Genius
  before inserting into the `songs` table, so new rows are saved clean.

### 4. Frontend SongSearch

`SongSearch.tsx` currently does `title.split(" - ")` to guess title/artist for the
optimistic cache. It will call the shared cleaner first so the optimistic
`prefetchByYoutubeId` entry matches what the Dashboard / SongPage will eventually load.

### 5. One-time backfill of existing rows

A single data update (via the insert tool, not a migration) re-runs the cleaner over
existing `songs.title` and `songs.artist` values so the Dashboard's "Last Searched"
grid and previously generated SongPages all show clean titles immediately, not just
new searches.

## Technical details

**Files touched**
- `supabase/functions/youtube-search/index.ts` — apply cleaner to each result.
- `supabase/functions/generate-lyrics/index.ts` — replace `cleanYoutubeTitle`, also
  sanitize Genius-derived `title`/`artist` before persisting.
- `src/lib/cleanTitle.ts` (new) — shared cleaner used by `SongSearch.tsx`.
- `src/components/SongSearch.tsx` — clean before splitting `title - artist`.
- Data update on `public.songs` to rewrite existing `title` and `artist`.

**Featured-artist preservation rule**
The cleaner first protects featured-artist segments by checking for the keywords
above; only after the protected segment is set aside does it strip the remaining
brackets. So `Karol G (feat. Shakira) [Official Video]` → `Karol G feat. Shakira`,
not `Karol G`.

**Out of scope**
- No changes to lyric generation, quiz logic, or streak behavior.
- No schema changes — `songs.title` / `songs.artist` already store free text.
