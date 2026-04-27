# Add Phonetic Pronunciation to Lyrics

This work was already implemented in the previous turn. Re-confirming the plan so it can be re-applied / verified end-to-end.

## What changes for the user

- Every lyric line will now show three stacked rows:
  1. Spanish (original)
  2. Phonetic pronunciation in English letters (e.g. `Des-pah-SEE-toh`) — styled in italic neon-yellow accent
  3. English translation (italic muted)
- Newly generated songs will include the pronunciation. Existing songs in the library won't have it (the field will just be hidden) until they're regenerated.

## Technical changes

### 1. Database
- Add nullable `pronunciation TEXT` column to `lyric_lines`. (Already migrated.)

### 2. Edge function `supabase/functions/generate-lyrics/index.ts`
- **SYSTEM_PROMPT**: add a rule instructing the AI to output a `pronunciation` field per line — hyphenated by syllable, CAPS on the stressed syllable, covering the whole line (not just one word). Include the Despacito example.
- **TOOL `save_song` schema**: add `pronunciation: { type: "string" }` to each line item and include it in `required`.
- **Insert mapping**: write `line.pronunciation ?? null` into the new column when inserting `lyric_lines` rows.

### 3. Frontend types
- `src/pages/SongPage.tsx`: extend `Line` type with `pronunciation: string | null`. (Query already uses `select("*")`, so no query change needed.)
- `src/components/LyricsPlayer.tsx`: extend `Line` type with `pronunciation: string | null`.

### 4. `LyricsPlayer` UI
Inside each line block, render between the Spanish words and the English translation:

```tsx
{line.pronunciation && (
  <p className="text-sm text-accent/90 mt-1 italic tracking-wide">
    {line.pronunciation}
  </p>
)}
```

Uses the existing `--accent` neon-yellow token to clearly distinguish pronunciation from the muted English translation below it.

## Out of scope
- Backfilling pronunciation for existing songs (would require re-running AI on every stored song — can be done later as a one-off if desired).
- Quiz / TranslateWord changes — those don't surface pronunciation.
