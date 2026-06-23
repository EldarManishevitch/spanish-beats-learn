
## Goal
Make every stage of the song-generation pipeline run **fully in parallel**, and guarantee at least **3 concurrent sources** for each of the three critical data types: lyrics text, translation, and timestamp sync.

## Current state (audit of `supabase/functions/generate-lyrics/index.ts`)

| Stage | Sources today | Concurrency today | Issue |
|---|---|---|---|
| Genius song lookup | 4 query variants (cleaned / simplified / artist-title split / +channel) | **Sequential** — each only fires if the previous returned `null` | Slow worst case (4 round-trips) |
| Lyrics text | lrclib, NetEase, Megalobiz, Genius, Firecrawl web fallback | First 4 parallel; Firecrawl only runs **after** all 4 miss | Firecrawl not in the race |
| Sync (timestamps) | lrclib-synced, NetEase-synced, Megalobiz-synced, Whisper alignment | First 3 parallel; Whisper only runs **after** the race if none had timestamps | Whisper not in the race; only 3 parallel synced providers |
| Translation | `google/gemini-2.5-flash-lite` + one retry on same model | **Single source** | Below the 3-source minimum |

## Changes

### 1. Parallel Genius search (`searchGenius`)
Build all candidate queries up-front and `Promise.any` over them. Cleaned + simplified + artist/title split + `+channel` all fire at once; first non-null wins. Compilation/awards rejection logic stays. Falls back to `null` (continue without Genius) if all reject.

### 2. Lyrics — Firecrawl joins the parallel race
Move `fetchWebFallbackLyrics` into the same `Promise.all` batch as lrclib/NetEase/Megalobiz/Genius. Selection priority unchanged: prefer any provider that returned real timestamps, then prefer Genius/lrclib plain text, then any plain text, then Firecrawl as last-priority hit. Net effect: 5 lyric sources always running concurrently (vs 4 + sequential fallback), shaving 3–6 s when Genius/lrclib both miss.

### 3. Sync — add a 4th provider and parallelize Whisper
- Add a new LRC provider: **`fetchSyairLrc(title, artist)`** in `supabase/functions/_shared/lyrics-sync.ts` (Syair / lyricsify-style community LRC site, free, no key). Same `{ plain, synced }` shape as the existing three.
- Kick off **Whisper alignment** at the **same time** as the LRC providers, but make it depend on the first piece of plain text that arrives:
  - Start the LRC race.
  - As soon as any provider resolves with usable plain text, `await` Whisper using that plain text + `youtube_id`.
  - When the race resolves, if no provider gave timestamps but Whisper did, use Whisper's timestamps with the chosen plain text.
- Result: 4 LRC providers (lrclib, NetEase, Megalobiz, Syair) racing concurrently + Whisper running in parallel = **5 sync sources**, all guaranteed ≥3 concurrent.

### 4. Translation — race 3 AI models in parallel
Refactor the AI-translation block (`Phase 2` in `generateLyricsInBackground`) to fire **three model requests concurrently** through the Lovable AI gateway, all using the same `save_song` tool schema:
- `google/gemini-2.5-flash-lite` (current, fastest)
- `google/gemini-2.5-flash` (higher quality fallback)
- `openai/gpt-5-mini` (independent provider for robustness)

Use `Promise.any` with a per-request validator: a result only "wins" if it returns a valid tool call AND `lines.length >= ceil(inputLineCount * 0.8)`. First valid response wins; the others are discarded. If all three reject, mark the song failed (current behavior). Retry-on-empty-tool-call logic is removed (the race already provides redundancy).

### 5. Keep the existing safeguards
- Optimistic stub-insert + `EdgeRuntime.waitUntil` background pipeline stays unchanged.
- Realtime placeholder-insert → streaming UPDATE flow stays unchanged.
- Per-request `console.log` lines preserve the existing `sync providers: lrclib=… netease=…` style observability, extended to cover the new Syair + Whisper + 3 translation models.

## Technical notes

- All three new parallel batches use `Promise.allSettled` + manual "first acceptable" selection (not `Promise.any`) where we need to know which sources actually responded vs errored, so per-provider failures never reject the whole race.
- Whisper still respects its own 45 s audio-fetch timeout; if it loses the race against the LRC providers it's simply ignored.
- `openai/gpt-5-mini` and `google/gemini-2.5-flash` already work through the Lovable AI gateway with the same tool-call schema — no new secrets needed.
- No DB schema changes, no client changes, no new env vars.

## Files touched
- `supabase/functions/generate-lyrics/index.ts` — Genius parallel search, Firecrawl in race, Whisper in race, 3-model translation race.
- `supabase/functions/_shared/lyrics-sync.ts` — add `fetchSyairLrc` provider; export unchanged.
- `supabase/functions/resync-lyrics/index.ts` — pick up the new `fetchSyairLrc` in its existing parallel provider list (keeps resync at 4 LRC providers + Whisper too).
