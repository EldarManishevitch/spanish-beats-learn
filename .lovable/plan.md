# Full Lyrics + Jump to Chorus

## 1. Seed full lyrics (data only — no schema changes)
Schema already has `is_chorus` on `lyric_lines`. Use the insert tool to:
- `DELETE FROM lyric_lines WHERE song_id IN (<3 demo song ids>)` to clear current partial seeds.
- `INSERT` ~30–50 lines per song (Romeo Santos, Daddy Yankee, Bad Bunny) with:
  - sequential `line_index`
  - accurate `start_seconds` / `end_seconds` aligned to the YouTube videos
  - `spanish_text` + `hebrew_translation`
  - `is_chorus = true` for chorus lines, `false` for verses

## 2. "Jump to Chorus" button in `LyricsPlayer.tsx`
- Compute `firstChorusIdx = lines.findIndex(l => l.is_chorus)`.
- Render a neon-styled `Button` (only when a chorus exists) above the lyrics column.
- On click:
  - `playerRef.current.seekTo(lines[firstChorusIdx].start_seconds, true)`
  - `playerRef.current.playVideo()`
  - `lineRefs.current[firstChorusIdx]?.scrollIntoView({ behavior: "smooth", block: "center" })`
  - Optimistically `setActiveIdx(firstChorusIdx)` so the highlight updates immediately.

## 3. No changes needed
- Schema (`is_chorus` already exists)
- `ChorusQuiz` (already filters by `is_chorus`)
- RLS policies (lyrics already public-read)

Approve to switch to default mode and execute.