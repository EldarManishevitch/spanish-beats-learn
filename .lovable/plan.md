# Ritmo — Learn Spanish Through Bachata & Reggaeton

A vibrant, dark-mode web app that teaches Hebrew speakers Spanish through Latin music. Neon pink + yellow accents, glassmorphic surfaces, Lucide icons.

## Auth & Profiles (Lovable Cloud)
- Google sign-in only
- `profiles` table: display_name, avatar_url, learning_level, created_at
- Auto-created on first login via trigger
- Protected routes redirect to `/auth`

## Database Schema
- **profiles** — user info
- **songs** — title, artist, genre (bachata/reggaeton), youtube_id, album_art_url, difficulty
- **lyric_lines** — song_id, line_index, spanish_text, hebrew_translation, start_seconds, end_seconds
- **slang_dictionary** — `term` (lowercased, unique-indexed), `contextual_meaning` (Hebrew), `is_urban_slang` (bool), `example_usage`
- **translations_cache** — word (lowercased), hebrew, pronunciation_hint
- **saved_vocab** — user_id, word, hebrew, source_song_id
- **quiz_attempts** — user_id, song_id, score, total, completed_at
- **practice_flags** — user_id, song_id, word, miss_count, last_missed_at (for quiz→vocab integration)

RLS on all tables; `slang_dictionary`, `songs`, `lyric_lines` publicly readable.

## Pages
1. **/auth** — Google sign-in, neon-glow card
2. **/** Dashboard — featured song cards with album art, "Slang of the Day" widget, recent activity
3. **/song/:id** — Player + lyrics + side panels (3 tabs: Lyrics / Vocab / Quiz)
4. **/vocab** — saved words with flashcard mode, slang vs standard separation, "needs practice" flags

## Interactive Player
- YouTube IFrame API embed
- Lyrics synced via `start_seconds` timestamps
- Active line animated with **framer-motion** spring (`stiffness: 120, damping: 20`), gently scrolled into viewport center, scale + neon-pink glow
- Click any Spanish word → translation popover

## Click-to-Translate (tiered lookup)
A `translate-word` edge function resolves words in this order:
1. **`slang_dictionary`** lookup (always `.toLowerCase()` on both client and server before query) — returns Hebrew + example usage + slang badge
2. **`translations_cache`** — previously translated generic words
3. **AI fallback** — Lovable AI Gateway (Gemini Flash) translates Spanish→Hebrew, result cached
- Pronunciation via browser `SpeechSynthesis` (Spanish voice)
- "Save to vocab" button in popover

## Vocabulary Side Panel
- "Slang of the Day" rotating card from `slang_dictionary` where `is_urban_slang = true`
- Saved words list per song
- Words with active `practice_flags` get a **pulsing red ring + "צריך תרגול" badge**

## Quiz Mode (Chorus Quiz)
- Fill-in-the-blanks generated from chorus lyrics
- Multiple-choice options (correct + 3 distractors from same song)
- **Wrong answer → insert/upsert into `practice_flags`** (increment miss_count) → that word shows red pulse in Vocab tab
- Correct answer later → decrement/clear flag
- Score saved to `quiz_attempts`

## Starter Content (seeded)
- 3 songs: Romeo Santos (Bachata), Daddy Yankee (Reggaeton), Bad Bunny (Reggaeton) — full lyrics, timestamps, Hebrew translations, chorus quiz
- ~15 urban slang terms: Perreo, Duro, Mami, Bellaco, Gato, Jevi, Brutal, Tirar, Janguear, Bregar, Chamaquito, Dura, Pichea, Bichote, Corillo

## Design System
- Background: `hsl(260 40% 6%)` deep purple-black
- Neon pink primary `hsl(330 100% 60%)`, neon yellow accent `hsl(55 100% 60%)`
- Glassmorphic cards with subtle backdrop-blur and neon border glow
- Tailwind tokens in `index.css` + `tailwind.config.ts` (no hardcoded colors)
- Lucide icons throughout (Music, Play, BookOpen, Sparkles, Trophy, Zap)
- Mobile-responsive: stacked layout on small screens, side-panel on desktop

## Tech
- React + Vite + TypeScript + Tailwind
- framer-motion for lyric animation
- Lovable Cloud (auth, DB, edge functions, AI Gateway)
- React Router, Tanstack Query, shadcn components
