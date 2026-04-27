# Progress Tracking, Review Room, CEFR & Roleplay

A connected progression system: every quiz miss feeds a Review Room, every mastered word counts toward XP and a CEFR rank, and reaching A2 unlocks Daily Conversations and Roleplay scenarios with Latin-flavored AI dialogues.

## 1. Database changes

### New table `user_vocab_stats`
Tracks per-user mastery. We don't have a `vocab` table with stable word IDs, so we key by lowercase `word` (matches how `practice_flags` and `saved_vocab` already work).

Columns:
- `id` uuid PK
- `user_id` uuid (not null)
- `word` text (not null, lowercased)
- `fail_count` int default 0
- `correct_count` int default 0
- `is_mastered` bool default false
- `last_reviewed` timestamptz default now()
- `created_at` timestamptz default now()
- UNIQUE (`user_id`, `word`)

RLS: user can SELECT/INSERT/UPDATE/DELETE only their own rows.

### `profiles` table additions
- `cefr_level` text default `'A1'`
- `total_xp` int default `0`
- `unlocked_conversations` bool default `false`
- `mastered_count` int default `0` (cached for fast badge rendering)

### Helper Postgres function `recompute_cefr(p_user_id uuid)`
SECURITY DEFINER, recalculates `mastered_count`, `cefr_level`, and `unlocked_conversations` from `user_vocab_stats` + recent `quiz_attempts` accuracy. Called from edge functions and quiz handlers.

CEFR rules:
- A1: < 100 mastered
- A2: 100–300 mastered AND ≥ 80% avg accuracy across last 20 quiz attempts
- B1: > 300 mastered
Unlock flips to true once mastered ≥ 50.

## 2. Quiz logic (existing `ChorusQuiz.tsx`)

On wrong answer:
- Upsert `user_vocab_stats` for that word, `fail_count += 1`, `is_mastered = false`, `last_reviewed = now()`.
- Keep the existing `practice_flags` write (drives the in-song badge).

On correct answer:
- Upsert `user_vocab_stats`, `correct_count += 1`. If `correct_count >= 3` AND `fail_count == 0` (or `correct_count - fail_count >= 3`), set `is_mastered = true`.
- Clear the matching `practice_flags` row (already done).

On quiz finish: call `recompute_cefr(user.id)`. If `unlocked_conversations` flips true, dispatch a celebration event for the UI.

## 3. Review Room page (`/review`)

New route + nav entry "Review" with a `RotateCcw` icon.

Page layout:
- Header: "Review Room" + small CEFR badge + count of words to review.
- Two tabs: **Flashcards** and **Review Quiz**.

Flashcards:
- Fetch `user_vocab_stats` where `user_id = me AND fail_count > 0 AND is_mastered = false`.
- Join with `saved_vocab` (when present) for the English/Hebrew translation; fall back to calling our existing `translate-word` edge function for missing data and cache the result.
- 3-column responsive grid of neon-bordered cards. Click flips (CSS transform) — front shows Spanish word, back shows pronunciation + English translation.
- "Mark mastered" button on the back of each card → sets `is_mastered=true`, `fail_count=0`.

Review Quiz:
- Picks up to 10 review words and runs a multiple-choice quiz (Spanish → English) using the same shuffle/score pattern as `ChorusQuiz`.
- Correct answer decrements `fail_count` (floor 0); two consecutive correct → `is_mastered = true`.
- Wrong answer increments `fail_count`.
- Finish → toast with score + recompute CEFR.

## 4. CEFR badge + XP on profile/header

- Add a compact pill in `AppLayout` header next to user email: `A2 · Intermediate Perrero · 240 XP`.
- Tier names: A1 Novice, A2 Amigo, B1 Duro.
- XP awarded:
  - +5 per correct quiz answer
  - +25 per mastered word (granted once when `is_mastered` flips true)
  - +50 per completed Roleplay session

## 5. Daily Conversations (`/conversations`)

Locked until `unlocked_conversations = true`. Locked state shows a neon `Lock` icon, progress bar `mastered/50`, and "Master 50 words to unlock".

Unlocked state:
- Calls new edge function `generate-daily-phrases` (cached per user per day in a tiny `daily_phrases_cache` table: `user_id, date, payload jsonb`).
- AI returns 5 phrases tied to Latin-life situations (At the club, Ordering a drink, Asking for a dance, Greeting at the colmado, Catching a guagua).
- Each phrase rendered as the same `Spanish | Pronunciation | English` stack used in `LyricsPlayer`.
- "Practice" button opens a single-phrase pronunciation drill (uses `speechSynthesis`).

## 6. Roleplay engine

### Edge function `generate-roleplay`
- Auth required (verify_jwt = false in code; validate JWT manually like other functions).
- Input: `{ scenario_hint?: string }`. Reads caller's CEFR + last 50 mastered words from DB.
- Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with tool-calling for structured output.
- Tool schema returns:
  ```
  { scenario_title, character_name, location, dialogue_steps: [
      { spanish_text, pronunciation, english_translation, suggested_reply }
    ] (length 5)
  }
  ```
- System prompt enforces Latin-cultural settings (Havana, Medellín, Santo Domingo, San Juan reggaeton clubs, etc.) and CEFR-appropriate vocabulary. A2 unlocks "street slang" scenarios; B1 unlocks "fast-talk reggaeton".

### `RoleplayView.tsx` (`/roleplay`)
- Locked until A2 (mastered ≥ 100). Lock screen mirrors Daily Conversations.
- "New scenario" button → loads dialogue.
- Chat-like UI with neon-bordered bubbles. Each AI bubble shows Spanish / pronunciation (italic accent) / English.
- After each AI line, three "Smart Reply" chips (precomputed `suggested_reply` + 2 distractors generated alongside) plus a free-text input.
- "Hear" button per line uses speechSynthesis (es-ES).
- If user clicks the translation hint twice on the same line, that line's key word is auto-flagged into `user_vocab_stats` with `fail_count += 1` (Review Room integration).
- Completing all 5 turns → `+50 XP`, recompute CEFR, success toast with neon confetti style.

## 7. New level unlock celebration

Reusable `<UnlockCelebration tier="A2" />` modal: full-screen translucent overlay, gradient neon border, confetti-style animated dots, tagline "Nuevo nivel desbloqueado". Triggered:
- When `unlocked_conversations` flips to true.
- When CEFR tier changes (A1→A2, A2→B1).
The recompute helper returns `{ tier_changed, unlock_changed }`; client shows the modal accordingly.

## Technical notes

- New routes registered in `src/App.tsx`: `/review`, `/conversations`, `/roleplay` — all wrapped in `ProtectedRoute` and `AppLayout`.
- New nav links in `AppLayout` (hidden labels on mobile).
- Edge functions: `generate-daily-phrases`, `generate-roleplay`. Both authenticate via Supabase JWT in the Authorization header (manual verify), use service role only for DB writes.
- AI: Lovable AI Gateway with `LOVABLE_API_KEY` (already configured), tool-calling for structured JSON. Handle 429/402 with toast.
- Migrations:
  1. Create `user_vocab_stats` + RLS.
  2. Alter `profiles` (add 4 columns).
  3. Create `daily_phrases_cache` + RLS.
  4. Create `recompute_cefr(uuid)` SECURITY DEFINER function.
- Types regenerate automatically after migration.
- No changes to `LyricsPlayer` other than reusing its phonetic styling.
- Word identity: continue using lowercase trimmed words (consistent with existing `practice_flags`/`saved_vocab`). The `word_id` requirement is realized as the `(user_id, word)` unique key, since we have no separate words table.

## Files touched / created

Created:
- `supabase/migrations/<ts>_progress_tracking.sql`
- `src/pages/ReviewRoom.tsx`
- `src/pages/Conversations.tsx`
- `src/pages/Roleplay.tsx`
- `src/components/Flashcard.tsx`
- `src/components/CefrBadge.tsx`
- `src/components/UnlockCelebration.tsx`
- `src/components/LockedFeature.tsx`
- `src/hooks/useProgress.ts`
- `supabase/functions/generate-daily-phrases/index.ts`
- `supabase/functions/generate-roleplay/index.ts`

Edited:
- `src/App.tsx` — three new routes
- `src/components/AppLayout.tsx` — nav items + CEFR badge
- `src/components/ChorusQuiz.tsx` — write `user_vocab_stats`, award XP, call recompute, trigger unlock modal
- `supabase/config.toml` — register the two new functions

After approval I'll implement everything in one pass and verify the migration + edge functions deploy cleanly.
