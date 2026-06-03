# Daily Streak System

## 1. Database Migration

Add to `public.profiles`:
- `current_streak` integer NOT NULL DEFAULT 0
- `longest_streak` integer NOT NULL DEFAULT 0
- `last_practice_date` date NULL

Create SECURITY DEFINER RPC `public.touch_streak(p_tz text)`:
- Authorizes `auth.uid()`.
- Computes `today := (now() AT TIME ZONE p_tz)::date`.
- Reads current row's `last_practice_date`, `current_streak`, `longest_streak`.
- Logic:
  - if `last = today` → no change, return current values.
  - else if `last = today - 1` → `current_streak += 1`.
  - else → `current_streak = 1`.
- `longest_streak = greatest(longest_streak, current_streak)`.
- `last_practice_date = today`.
- Returns `jsonb { current_streak, longest_streak, last_practice_date, changed }`.

No new grants needed (profiles already exposed; RPC runs as definer).

## 2. Client Integration

**Trigger points** (a "practice day" = opened a song or completed a quiz):
- `src/pages/SongPage.tsx` — call once on mount when `song` loads successfully.
- `src/components/ChorusQuiz.tsx` — call when quiz completes (inside `next()` finish branch).

**Helper**: `src/lib/streak.ts`
```ts
export async function touchStreak() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { data } = await supabase.rpc("touch_streak", { p_tz: tz });
  return data;
}
```
Fire-and-forget; on success dispatch a custom event so the badge refreshes.

**Hook update**: extend `src/hooks/useProgress.ts` `Progress` type with `current_streak`, `longest_streak`, `last_practice_date`, and add them to the select. Expose a `refresh` already available — listen to a `streak-updated` window event to re-fetch.

## 3. UI Widget

The app doesn't have a dedicated Profile page; the persistent "profile area" is the header (`src/components/AppLayout.tsx`) next to `CefrBadge`. Add a new `src/components/StreakBadge.tsx`:

- Pill with `Flame` icon (lucide) in neon orange.
- Primary text: `{current_streak} Days 🔥` (use icon, not emoji, for crisp rendering).
- Secondary text (smaller, muted): `Best: {longest_streak}`.
- Styling: neon orange via existing design tokens (use `text-accent`/custom HSL token; add `--neon-orange` to `index.css` if missing, follow existing neon-pink pattern with shadow glow).
- Hidden on very small screens if needed; show beside `CefrBadge`.

Mount `<StreakBadge />` in `AppLayout` header.

## Technical Notes
- Timezone handled client-side by passing IANA tz to the RPC so "today" matches the user's local calendar.
- Idempotent: multiple calls same day are no-ops.
- No race issues — single-row update keyed by `auth.uid()`.
- TypeScript types for `profiles` regenerate automatically after the migration; the new columns will be available without manual edits.

## Files Touched
- migration (new columns + `touch_streak` RPC)
- `src/lib/streak.ts` (new)
- `src/components/StreakBadge.tsx` (new)
- `src/components/AppLayout.tsx` (mount badge)
- `src/hooks/useProgress.ts` (extend type/select + event listener)
- `src/pages/SongPage.tsx` (trigger on song load)
- `src/components/ChorusQuiz.tsx` (trigger on quiz finish)
- `src/index.css` (optional neon-orange token if not present)
