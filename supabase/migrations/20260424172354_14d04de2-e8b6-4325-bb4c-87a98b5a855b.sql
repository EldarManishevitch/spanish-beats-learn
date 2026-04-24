
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  learning_level text default 'beginner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are viewable by owner" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- handle new user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- SONGS
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  genre text not null check (genre in ('bachata','reggaeton')),
  youtube_id text not null,
  album_art_url text,
  difficulty text default 'beginner',
  created_at timestamptz not null default now()
);
alter table public.songs enable row level security;
create policy "Songs are public" on public.songs for select using (true);

-- LYRIC LINES
create table public.lyric_lines (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  line_index int not null,
  spanish_text text not null,
  hebrew_translation text not null,
  start_seconds numeric not null,
  end_seconds numeric not null,
  is_chorus boolean not null default false,
  unique(song_id, line_index)
);
alter table public.lyric_lines enable row level security;
create policy "Lyrics are public" on public.lyric_lines for select using (true);

-- SLANG DICTIONARY
create table public.slang_dictionary (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  contextual_meaning text not null,
  is_urban_slang boolean not null default true,
  example_usage text,
  created_at timestamptz not null default now()
);
create index idx_slang_term on public.slang_dictionary (term);
alter table public.slang_dictionary enable row level security;
create policy "Slang is public" on public.slang_dictionary for select using (true);

-- TRANSLATIONS CACHE
create table public.translations_cache (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  hebrew text not null,
  pronunciation_hint text,
  created_at timestamptz not null default now()
);
create index idx_translations_word on public.translations_cache (word);
alter table public.translations_cache enable row level security;
create policy "Cache is public read" on public.translations_cache for select using (true);

-- SAVED VOCAB
create table public.saved_vocab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  hebrew text not null,
  source_song_id uuid references public.songs(id) on delete set null,
  is_slang boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, word)
);
alter table public.saved_vocab enable row level security;
create policy "Users see own vocab" on public.saved_vocab for select using (auth.uid() = user_id);
create policy "Users add own vocab" on public.saved_vocab for insert with check (auth.uid() = user_id);
create policy "Users delete own vocab" on public.saved_vocab for delete using (auth.uid() = user_id);

-- QUIZ ATTEMPTS
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  score int not null,
  total int not null,
  completed_at timestamptz not null default now()
);
alter table public.quiz_attempts enable row level security;
create policy "Users see own attempts" on public.quiz_attempts for select using (auth.uid() = user_id);
create policy "Users add own attempts" on public.quiz_attempts for insert with check (auth.uid() = user_id);

-- PRACTICE FLAGS
create table public.practice_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  word text not null,
  miss_count int not null default 1,
  last_missed_at timestamptz not null default now(),
  unique(user_id, song_id, word)
);
alter table public.practice_flags enable row level security;
create policy "Users see own flags" on public.practice_flags for select using (auth.uid() = user_id);
create policy "Users insert own flags" on public.practice_flags for insert with check (auth.uid() = user_id);
create policy "Users update own flags" on public.practice_flags for update using (auth.uid() = user_id);
create policy "Users delete own flags" on public.practice_flags for delete using (auth.uid() = user_id);
