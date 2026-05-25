## Goal
Make song selection feel instant: cached songs return immediately, new songs navigate to a neon skeleton screen while generation runs in the background, and payloads stay lean.

## 1. Edge function: cached-song fast path (`supabase/functions/generate-lyrics/index.ts`)
The youtube_id existence check already exists (lines 404–415), but it returns only `{ song_id, existed: true }`. Upgrade it to also fetch and return the cached lyric lines so the client can render without an extra round trip:
- After finding `existing`, also `select("id, line_index, spanish_text, pronunciation, english_translation, is_chorus")` from `lyric_lines` ordered by `line_index`.
- Return `{ song_id, existed: true, lines: [...] }` containing only those four text fields plus `line_index` and `id`. No timestamps, no hebrew_translation, no genre metadata in the payload (song row is already in the `songs` table for the client to read separately if needed).
- Keep the non-cached return shape (`song_id, existed: false, lines_count, …`) unchanged.

## 2. Client cache + optimistic navigation (`src/lib/songCache.ts`)
Extend the in-memory cache to also key by `youtube_id` and hold optimistic metadata + an in-flight promise:
- Add `prefetchByYoutubeId(youtube_id, { title, artist, thumbnail })` that seeds a placeholder `song` (no id yet) so the pending page can render immediately.
- Add `registerGeneration(youtube_id, promise)` that stores the in-flight generate-lyrics promise, and once it resolves, copies the cached entry under the real `song_id` key (including `lines` if the edge function returned them).
- Add `getCachedByYoutubeId(youtube_id)`.

## 3. Instant navigation from search (`src/components/SongSearch.tsx`)
Stop blocking on the edge function before navigating:
- On `pick(r)`:
  1. Quick client-side lookup: `supabase.from("songs").select("id").eq("youtube_id", r.youtube_id).maybeSingle()`.
  2. If a row exists, call `prefetchSong(id)` and `navigate('/song/' + id)` immediately. Done.
  3. Otherwise, seed `prefetchByYoutubeId(r.youtube_id, { title, artist, thumbnail })`, fire `supabase.functions.invoke("generate-lyrics", …)` without awaiting, register its promise with `registerGeneration`, and `navigate('/song/pending/' + r.youtube_id)` right away.
- Toasts for failures move into the background promise's `.catch`, which also navigates back to `/` on hard failure.

## 4. New pending route (`src/App.tsx` + `src/pages/SongPending.tsx`)
- Add route `/song/pending/:youtubeId` → new `SongPending` page.
- `SongPending` reads optimistic metadata from songCache, renders the existing `SongSkeleton` look (neon-tinted placeholder for the player + lyric rows) plus the real title/artist/thumbnail at the top so the page feels populated.
- It awaits the registered generation promise. On success it `navigate('/song/' + song_id, { replace: true })`. On failure it shows a toast and `navigate('/', { replace: true })`.

## 5. SongPage skeleton polish (`src/pages/SongPage.tsx`)
- The page already shows `SongSkeleton` when `song` is null. Tint the skeleton with `bg-primary/10 animate-pulse` (neon-pink at low opacity) on the video frame and lyric rows so it matches the brand instead of plain gray.
- When the cached entry already includes `lines` (from step 1), seed both `song` and `lines` from the cache and skip the separate `lyric_lines` query.

## 6. Lean payload check
Verify no other code paths read fields we're dropping from the cached payload (hebrew_translation, start_seconds, end_seconds). `LyricsPlayer` only consumes spanish_text, pronunciation, english_translation, is_chorus — confirmed. No client change needed beyond the cache update.

## Out of scope
- Changing the slow generation pipeline itself (Genius/lrclib/Firecrawl/AI). Only the cached-hit path is being accelerated.
- Realtime push of partial lines during generation.
- Database schema changes.

## Result
- Cached song click → navigate + render in one round trip with lines already attached.
- New song click → page swap is instant; skeleton shows while AI runs; auto-redirect when ready.
- Payload shrinks to only the four text fields the UI uses.