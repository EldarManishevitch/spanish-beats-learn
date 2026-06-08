import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Sparkles, Music2, Flame, Rocket } from "lucide-react";
import { SongSearch } from "@/components/SongSearch";
import { SiteTour } from "@/components/SiteTour";
import { prefetchSong } from "@/lib/songCache";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useAuth } from "@/contexts/AuthContext";
import { useProgress } from "@/hooks/useProgress";

// Map legacy difficulty labels to a CEFR rank so we can compare against the
// user's profile.cefr_level. Higher rank = harder material.
const DIFFICULTY_TO_CEFR: Record<string, "A1" | "A2" | "B1" | "B2"> = {
  beginner: "A1",
  intermediate: "A2",
  advanced: "B1",
  expert: "B2",
  a1: "A1", a2: "A2", b1: "B1", b2: "B2",
};
const CEFR_RANK: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4 };
const songCefr = (s: { difficulty?: string | null }) =>
  DIFFICULTY_TO_CEFR[(s.difficulty ?? "").toLowerCase()] ?? "A2";

// Seeded RNG so today's pick is stable across reloads but rotates daily.
const hashSeed = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const seededShuffle = <T,>(arr: T[], seed: string): T[] => {
  const rand = mulberry32(hashSeed(seed));
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

type Song = { id: string; title: string; artist: string; genre: string; album_art_url: string | null; difficulty: string };
type Slang = {
  term: string;
  contextual_meaning: string;
  example_usage: string | null;
  example_song_title: string | null;
  example_song_artist: string | null;
  lyrics_snippet: string | null;
  literal_meaning: string | null;
  english_equivalent: string | null;
  lyrics_snippet_translation: string | null;
};

const Dashboard = () => {
  const { user } = useAuth();
  const { progress } = useProgress();
  const [songs, setSongs] = useState<Song[]>([]);
  const [slang, setSlang] = useState<Slang | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const navigate = useNavigate();

  // Show the onboarding wizard the first time a user lands on the dashboard
  // after sign-up. We trust the `onboarding_completed` flag on profiles so the
  // wizard never appears again even if the user later clears local storage.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && !data.onboarding_completed) setOnboardingOpen(true);
      });
  }, [user]);

  const loadSongs = async () => {
    const { data } = await supabase
      .from("songs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(120);
    setSongs(data ?? []);
  };

  useEffect(() => {
    loadSongs();
    supabase
      .from("slang_dictionary")
      .select("term, contextual_meaning, example_usage, example_song_title, example_song_artist, lyrics_snippet, literal_meaning, english_equivalent, lyrics_snippet_translation")
      .eq("is_urban_slang", true)
      .not("example_song_title", "is", null)
      .then(({ data }) => {
        if (data?.length) setSlang(data[Math.floor(Math.random() * data.length)] as Slang);
      });

    const onGenerated = () => loadSongs();
    const onVisible = () => { if (document.visibilityState === "visible") loadSongs(); };
    window.addEventListener("song-generated", onGenerated);
    window.addEventListener("focus", onGenerated);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("song-generated", onGenerated);
      window.removeEventListener("focus", onGenerated);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const matchedSong = useMemo(() => {
    if (!slang?.example_song_title) return null;
    const t = slang.example_song_title.toLowerCase();
    const a = (slang.example_song_artist ?? "").toLowerCase();
    return songs.find(
      (s) => s.title.toLowerCase() === t && (!a || s.artist.toLowerCase().includes(a) || a.includes(s.artist.toLowerCase())),
    ) ?? null;
  }, [slang, songs]);

  return (
    <AppLayout>
      <Helmet>
        <title>Ritmo — Learn Spanish with Bachata & Reggaeton</title>
        <meta name="description" content="Pick a Spanish song and sing along to learn the language. Interactive lyrics, translations, pronunciation, and vocabulary drills." />
        <link rel="canonical" href="/" />
        <meta property="og:title" content="Ritmo — Learn Spanish with Bachata & Reggaeton" />
        <meta property="og:url" content="/" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Ritmo",
          url: "https://spanish-beats-learn.lovable.app/",
          description: "Learn Spanish through Bachata and Reggaeton lyrics with interactive translations, pronunciation guides, and vocabulary drills.",
        })}</script>
      </Helmet>
      <OnboardingWizard open={onboardingOpen} onComplete={() => setOnboardingOpen(false)} />
      <SiteTour />
      <section className="mb-10 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold mb-2">
          <span className="neon-text">Ritmo</span> - the spanish song teacher
        </h1>
        <p className="text-muted-foreground text-lg">Pick a song, Sing along & Pick up Spanish.</p>
      </section>

      {slang && (
        <Card className="glass mb-8 p-6 shadow-neon-yellow animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge className="mb-2 bg-accent text-accent-foreground hover:bg-accent">Slang of the Day</Badge>
              <h2 className="text-2xl font-bold mb-1 capitalize">{slang.term}</h2>
              <div className="space-y-1.5 mb-4 text-sm">
                {slang.literal_meaning && (
                  <p>
                    <span className="text-xs uppercase tracking-wider text-foreground font-semibold mr-2">Literal</span>
                    <span className="text-foreground">{slang.literal_meaning}</span>
                  </p>
                )}
                <p>
                  <span className="text-xs uppercase tracking-wider text-foreground font-semibold mr-2">Meaning</span>
                  <span className="text-foreground font-medium">{slang.contextual_meaning}</span>
                </p>
                {slang.english_equivalent && (
                  <p>
                    <span className="text-xs uppercase tracking-wider text-foreground font-semibold mr-2">English slang</span>
                    <span className="text-foreground">{slang.english_equivalent}</span>
                  </p>
                )}
                {slang.example_usage && (
                  <p>
                    <span className="text-xs uppercase tracking-wider text-foreground font-semibold mr-2">Example</span>
                    <span className="text-foreground italic">"{slang.example_usage}"</span>
                  </p>
                )}
              </div>

              {slang.example_song_title && (
                <div className="border-t border-border/50 pt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <Music2 className="h-3.5 w-3.5" />
                    <span>As heard in</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => matchedSong && navigate(`/song/${matchedSong.id}`)}
                    disabled={!matchedSong}
                    className={`group flex items-center gap-2 text-left ${
                      matchedSong ? "cursor-pointer hover:text-primary" : "cursor-default"
                    } transition-colors`}
                  >
                    {matchedSong && (
                      <span className="h-7 w-7 rounded-full bg-primary/90 flex items-center justify-center shadow-neon-pink shrink-0 group-hover:scale-110 transition-transform">
                        <Play className="h-3.5 w-3.5 text-background fill-background ml-0.5" />
                      </span>
                    )}
                    <span className="font-semibold">
                      {slang.example_song_title}
                      {slang.example_song_artist && (
                        <span className="text-muted-foreground font-normal"> · {slang.example_song_artist}</span>
                      )}
                    </span>
                  </button>
                  {slang.lyrics_snippet && (
                    <div className="border-l-2 border-primary/60 pl-3 space-y-1">
                      <p className="text-primary font-semibold italic neon-text">"{slang.lyrics_snippet}"</p>
                      {slang.lyrics_snippet_translation && (
                        <p className="text-xs text-muted-foreground italic">"{slang.lyrics_snippet_translation}"</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <SongSearch />

      {(() => {
        const userLevel = progress?.cefr_level ?? "A1";
        const userRank = CEFR_RANK[userLevel] ?? 1;
        const atLevel = songs.filter((s) => (CEFR_RANK[songCefr(s)] ?? 2) <= userRank);
        const above = songs.filter((s) => (CEFR_RANK[songCefr(s)] ?? 2) > userRank);
        const seed = `${user?.id ?? "guest"}:${userLevel}:${todayKey()}`;
        const shuffledAt = seededShuffle(atLevel, seed);
        const shuffledAbove = seededShuffle(above, seed + ":above");
        const recommended = shuffledAt.slice(0, 6);
        // Fill with challenging songs if the user's level pool is small.
        const fillers = recommended.length < 6 ? shuffledAbove.slice(0, 6 - recommended.length) : [];
        const recommendedFinal = [...recommended, ...fillers];
        const fillerIds = new Set(fillers.map((s) => s.id));
        const challenging = shuffledAbove.filter((s) => !fillerIds.has(s.id));

        const SongCard = ({ s, challenge }: { s: Song; challenge?: boolean }) => {
          const level = songCefr(s);
          return (
            <Link to={`/song/${s.id}`} className="group" onMouseEnter={() => prefetchSong(s.id)} onFocus={() => prefetchSong(s.id)} onTouchStart={() => prefetchSong(s.id)}>
              <Card className={`glass overflow-hidden transition-all duration-300 hover:-translate-y-1 ${challenge ? "hover:shadow-neon-yellow ring-1 ring-accent/40" : "hover:shadow-neon-pink"}`}>
                <div className="relative aspect-video overflow-hidden">
                  {s.album_art_url && <img src={s.album_art_url} alt={s.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    <Badge variant={s.genre === "bachata" ? "secondary" : "default"} className={s.genre === "reggaeton" ? "bg-primary text-primary-foreground" : ""}>
                      {s.genre}
                    </Badge>
                    {challenge ? (
                      <Badge className="bg-accent/95 text-accent-foreground border border-accent shadow-neon-yellow text-[10px] uppercase tracking-wider font-bold">
                        🚀 Level Up · {level}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-background/70 text-[10px] uppercase tracking-wider font-semibold">
                        {level}
                      </Badge>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-3 h-10 w-10 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-neon-pink">
                    <Play className="h-5 w-5 text-background fill-background ml-0.5" />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg truncate">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.artist}</p>
                </div>
              </Card>
            </Link>
          );
        };

        return (
          <>
            {recommendedFinal.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-bold">Recommended For Your Level 🔥</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">6 songs picked for you today · tuned for <span className="font-semibold text-primary">{userLevel}</span> · fresh batch tomorrow.</p>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {recommendedFinal.map((s) => <SongCard key={s.id} s={s} challenge={fillerIds.has(s.id)} />)}
                </div>
              </section>
            )}

            {challenging.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-1">
                  <Rocket className="h-5 w-5 text-accent" />
                  <h2 className="text-2xl font-bold">Explore Next Challenges 🚀</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">A stretch above <span className="font-semibold">{userLevel}</span> — fully unlocked, dive in whenever you're feeling brave.</p>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {challenging.map((s) => <SongCard key={s.id} s={s} challenge />)}
                </div>
              </section>
            )}

            {recommendedFinal.length === 0 && challenging.length === 0 && (
              <p className="text-muted-foreground">No songs yet — search above to add the first one.</p>
            )}
          </>
        );
      })()}
    </AppLayout>
  );
};

export default Dashboard;
