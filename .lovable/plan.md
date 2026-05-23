## Goal
Every card, tab, input, and container shares the exact same border: **2.5px solid, color `hsl(var(--secondary) / 0.25)`** (Deep Blue #2B4257 @ 25% opacity).

## Problem
Borders are inconsistent today:
- `.glass` = 3px secondary/25
- Most page cards add `border-2 border-secondary/15` (2px, lighter) — overrides `.glass`
- `LyricsPlayer` = `border-2 border-secondary/15`
- `SongSearch` = `border-[3px] border-secondary/25`
- `ReviewRoom`/`SongPage` tabs = `border-2 border-secondary/15`
- Stray `border-destructive`, `border-accent/40`, `neon-border-pink` accents

## Changes

1. **`src/index.css`** — Set `.glass`, `.neon-border-pink`, `.neon-border-yellow` to `border-width: 2.5px; border-color: hsl(var(--secondary) / 0.25)`. This becomes the single source of truth.

2. **Remove ad-hoc border overrides** so `.glass` wins, or replace with `border-[2.5px] border-secondary/25`:
   - `src/pages/Dashboard.tsx`
   - `src/pages/Conversations.tsx`
   - `src/pages/Roleplay.tsx`
   - `src/pages/ReviewRoom.tsx` (cards + `TabsList`)
   - `src/pages/SongPage.tsx` (cards + `TabsList`; flagged-card `border-destructive` → `ring-2 ring-destructive/50` so the border stays uniform)
   - `src/components/UnlockCelebration.tsx`

3. **`src/components/LyricsPlayer.tsx`** — Video frame + lyrics panel → `border-[2.5px] border-secondary/25`.

4. **`src/components/SongSearch.tsx`** — Change `border-[3px]` → `border-[2.5px]` on the card and the input.

5. **Tabs** — `TabsList` in `ReviewRoom` and `SongPage` → `border-[2.5px] border-secondary/25`.

## Out of scope
- State accents (chorus left-bar, pulse-flag ring, internal dividers, small icon-chip border inside LockedFeature).

## Result
One border: 2.5px, Deep Blue #2B4257 @ 25% opacity — everywhere.