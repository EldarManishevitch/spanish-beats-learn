import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { SectionedSongPlayer } from "@/components/SectionedSongPlayer";
import { ChorusQuiz } from "@/components/ChorusQuiz";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, Music, Trophy, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedSong, prefetchSong } from "@/lib/songCache";
// Streaks are only updated on quiz completion (see ChorusQuiz), not on song view.

type Song = { id: string; title: string; artist: string; genre: string; youtube_id: string | null; album_art_url: string | null };
type Line = { id: string; line_index: number; spanish_text: string; pronunciation: string | null; english_translation: string | null; start_seconds: number; end_seconds: number; is_chorus: boolean };
type Vocab = { word: string; hebrew: string; is_slang: boolean };
type Flag = { word: string; miss_count: number };

type QuizSection = "chorus" | "verse_1" | "verse_2" | "full";

const SongPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const cached = id ? getCachedSong(id) : undefined;
  const [song, setSong] = useState<Song | null>(cached?.song ?? null);
  const [lines, setLines] = useState<Line[]>(cached?.lines ?? []);
  const [vocab, setVocab] = useState<Vocab[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [tab, setTab] = useState<string>("lyrics");
  const [quizSection, setQuizSection] = useState<QuizSection>("full");
  // Non-blocking generation indicator: stays visible while realtime events keep
  // arriving from the background pipeline. Fades out after a quiet period.
  const [lastEventAt, setLastEventAt] = useState<number>(() => Date.now());
  const [isGenerating, setIsGenerating] = useState<boolean>(true);

  const loadVocab = async () => {
    if (!user || !id) return;
    const { data: v } = await supabase.from("saved_vocab").select("word, hebrew, is_slang").eq("source_song_id", id).eq("user_id", user.id);
    setVocab(v ?? []);
    const { data: f } = await supabase.from("practice_flags").select("word, miss_count").eq("user_id", user.id).eq("song_id", id);
    setFlags(f ?? []);
  };

  useEffect(() => {
    if (!id) return;
    const c = getCachedSong(id);
    if (c?.song) { setSong(c.song); setLines(c.lines ?? []); }
    else if (c?.promise) {
      c.promise.then(() => {
        const u = getCachedSong(id);
        if (u?.song) { setSong(u.song); setLines(u.lines ?? []); }
      });
    } else {
      prefetchSong(id);
      const u = getCachedSong(id);
      u?.promise?.then(() => {
        const f = getCachedSong(id);
        if (f?.song) { setSong(f.song); setLines(f.lines ?? []); }
      });
    }
    loadVocab();
    if (user && id) {
      supabase
        .from("user_search_history")
        .upsert(
          { user_id: user.id, song_id: id, viewed_at: new Date().toISOString() },
          { onConflict: "user_id,song_id" },
        )
        .then(({ error }) => { if (error) console.error("search history upsert failed", error); });
    }
  }, [id, user]);

  // Realtime: keep the song row + lyric lines live as the background pipeline
  // writes. INSERT appends a new Spanish line (translation rendered as skeleton);
  // UPDATE swaps the skeleton for the real translation; song UPDATEs refresh
  // title/artist/genre/sync status without a page refresh.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`song-page-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "songs", filter: `id=eq.${id}` },
        (payload) => {
          const next = payload.new as Song | null;
          if (next?.id) setSong((prev) => ({ ...(prev ?? next), ...next }));
          setLastEventAt(Date.now());
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lyric_lines", filter: `song_id=eq.${id}` },
        (payload) => {
          const row = payload.new as Line;
          setLines((prev) => {
            if (prev.some((l) => l.id === row.id)) return prev;
            return [...prev, row].sort((a, b) => a.line_index - b.line_index);
          });
          setLastEventAt(Date.now());
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lyric_lines", filter: `song_id=eq.${id}` },
        (payload) => {
          const row = payload.new as Line;
          setLines((prev) => prev.map((l) => (l.id === row.id ? { ...l, ...row } : l)));
          setLastEventAt(Date.now());
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "lyric_lines", filter: `song_id=eq.${id}` },
        (payload) => {
          const row = payload.old as { id?: string };
          if (row?.id) setLines((prev) => prev.filter((l) => l.id !== row.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Generation considered complete once song metadata + lyrics exist AND no
  // realtime events have arrived for a few seconds. Fully non-blocking.
  useEffect(() => {
    const QUIET_MS = 4000;
    const hasContent = Boolean(song?.title) && lines.length > 0 && lines.every((l) => l.english_translation);
    const tick = () => {
      const idleFor = Date.now() - lastEventAt;
      setIsGenerating(!(hasContent && idleFor > QUIET_MS));
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [song?.title, lines, lastEventAt]);

  // Progressive render: as soon as we have an :id, show the page shell. Header
  // fills in when song data lands; player mounts when youtube_id is known;
  // lyrics container is always present (lines stream in via realtime).
  const displaySong: Song = song ?? {
    id: id ?? "",
    title: "",
    artist: "",
    genre: "",
    youtube_id: null,
    album_art_url: null,
  };
  const headerReady = Boolean(song);
  const flaggedSet = new Set(flags.map((f) => f.word));

  return (
    <AppLayout>
      <Helmet>
        <title>{headerReady ? `${displaySong.title} by ${displaySong.artist} — Lyrics & translation | Ritmo` : "Loading song — Ritmo"}</title>
        {headerReady && (
          <>
            <meta name="description" content={`Spanish lyrics, English translation and pronunciation for ${displaySong.title} by ${displaySong.artist}. Learn Spanish while singing along.`} />
            <link rel="canonical" href={`https://spanish-beats-learn.lovable.app/song/${displaySong.id}`} />
            <meta property="og:title" content={`${displaySong.title} — ${displaySong.artist}`} />
            <meta property="og:description" content={`Spanish lyrics, English translation and pronunciation for ${displaySong.title} by ${displaySong.artist}.`} />
            <meta property="og:url" content={`https://spanish-beats-learn.lovable.app/song/${displaySong.id}`} />
            <meta property="og:type" content="music.song" />
            {displaySong.album_art_url && <meta property="og:image" content={displaySong.album_art_url} />}
            <script type="application/ld+json">{JSON.stringify({
              "@context": "https://schema.org",
              "@type": "MusicComposition",
              name: displaySong.title,
              composer: displaySong.artist,
              inLanguage: "es",
              description: `Spanish lyrics with English translation and pronunciation for ${displaySong.title} by ${displaySong.artist}.`,
            })}</script>
          </>
        )}
      </Helmet>
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-6 animate-fade-in">
        {displaySong.album_art_url ? (
          <img src={displaySong.album_art_url} alt={displaySong.title || "Song artwork"} className="h-24 w-24 rounded-xl object-cover shadow-neon-pink" />
        ) : (
          <Skeleton className="h-24 w-24 rounded-xl bg-primary/10" />
        )}
        <div className="space-y-2">
          {displaySong.genre ? (
            <Badge className={displaySong.genre === "reggaeton" ? "bg-primary text-primary-foreground mb-2" : "mb-2"} variant={displaySong.genre === "bachata" ? "secondary" : "default"}>{displaySong.genre}</Badge>
          ) : (
            <Skeleton className="h-5 w-20 bg-primary/10" />
          )}
          {displaySong.title ? (
            <h1 className="text-3xl md:text-4xl font-bold neon-text transition-opacity duration-300">{displaySong.title}</h1>
          ) : (
            <Skeleton className="h-9 w-64 bg-primary/10" />
          )}
          {displaySong.artist ? (
            <p className="text-lg text-muted-foreground transition-opacity duration-300">{displaySong.artist}</p>
          ) : (
            <Skeleton className="h-5 w-40 bg-primary/10" />
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === "vocab") loadVocab(); }} className="space-y-6">
        <TabsList className="glass">
          <TabsTrigger value="lyrics" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Music className="h-4 w-4 mr-2" /> Lyrics
          </TabsTrigger>
          <TabsTrigger value="vocab" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <BookOpen className="h-4 w-4 mr-2" /> Vocab {flaggedSet.size > 0 && <Badge className="ml-2 h-5 bg-destructive">{flaggedSet.size}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="quiz" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Trophy className="h-4 w-4 mr-2" /> Quiz
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lyrics">
          <h2 className="sr-only">Lyrics with translation</h2>
          <SectionedSongPlayer
            youtubeId={displaySong.youtube_id}
            songTitle={displaySong.title}
            songArtist={displaySong.artist}
            lines={lines}
            songId={displaySong.id}
            onPracticeQuiz={(sectionId) => { setQuizSection(sectionId); setTab("quiz"); }}
          />
        </TabsContent>

        <TabsContent value="vocab">
          <h2 className="sr-only">Vocabulary saved from this song</h2>
          {vocab.length === 0 && flags.length === 0 ? (
            <Card className="glass p-8 text-center">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Click words in the lyrics to save them here.</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {vocab.map((v) => {
                const flagged = flaggedSet.has(v.word);
                return (
                  <Card key={v.word} className={`glass p-4 ${flagged ? "ring-2 ring-destructive/50 pulse-flag" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold capitalize text-lg">{v.word}</h3>
                        <p className="text-primary">{v.hebrew}</p>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {v.is_slang && <Badge className="bg-accent text-accent-foreground">slang</Badge>}
                        {flagged && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />practice</Badge>}
                      </div>
                    </div>
                  </Card>
                );
              })}
              {flags.filter((f) => !vocab.find((v) => v.word === f.word)).map((f) => (
                <Card key={f.word} className="glass p-4 ring-2 ring-destructive/50 pulse-flag">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold capitalize text-lg">{f.word}</h3>
                    <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />needs practice</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Missed {f.miss_count}× in quiz</p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quiz">
          <h2 className="sr-only">Section quiz</h2>
          <ChorusQuiz songId={displaySong.id} lines={lines} songTitle={displaySong.title} songArtist={displaySong.artist} sectionId={quizSection} />
        </TabsContent>

      </Tabs>
    </AppLayout>
  );
};

export default SongPage;
