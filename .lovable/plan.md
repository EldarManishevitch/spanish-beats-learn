# Daily Rotating Recommended Songs

Replace the current "Recommended For Your Level 🔥" list (which simply shows every song at-or-below the user's CEFR level) with a curated set of **exactly 6 songs that rotate once per day**.

## Behavior

- Pull all songs from the DB whose difficulty ≤ user's CEFR level (same filter as today).
- Deterministically shuffle that pool using today's date as the seed, then slice the first 6. Same user sees the same 6 all day; tomorrow they get a fresh set.
- If fewer than 6 songs match the user's level, fill the remainder from the challenging pool so the row always shows 6 cards when possible.
- "Explore Next Challenges 🚀" continues to show every harder song (minus any pulled in as fillers) — unchanged behavior, still fully clickable.

## Technical notes

- All logic stays client-side in `src/pages/Dashboard.tsx`. No schema or edge-function changes.
- Add a tiny seeded shuffle helper (mulberry32 + Fisher–Yates) keyed on `YYYY-MM-DD` so the pick is stable across reloads within the day.
- Bump the `songs` query limit so the daily pool has enough variety to pick from (currently 36 — keep or raise to ~100).
- Update the section subhead to read something like "6 songs picked for you today" to make the rotation obvious.
