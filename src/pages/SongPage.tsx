import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { LyricsPlayer } from "@/components/LyricsPlayer";
import { ChorusQuiz } from "@/components/ChorusQuiz";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, Music, Trophy, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedSong, prefetchSong } from "@/lib/songCache";

type Song = { id: string; title: string; artist: string; genre: string; youtube_id: string; album_art_url: string | null };
type Line = { id: string; line_index: number; spanish_text: string; pronunciation: string | null; english_translation: string | null; start_seconds: number; end_seconds: number; is_chorus: boolean };
type Vocab = { word: string; hebrew: string; is_slang: boolean };
type Flag = { word: string; miss_count: number };

const SongSkeleton = () => (
  <AppLayout>
    <div className="mb-4"><Skeleton className="h-5 w-16" /></div>
    <header className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-6">
      <Skeleton className="h-24 w-24 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-40" />
      </div>
    </header>
    <Skeleton className="h-10 w-72 mb-6" />
    <Skeleton className="aspect-video w-full rounded-xl mb-4" />
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  </AppLayout>
);

const SongPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const cached = id ? getCachedSong(id) : undefined;
  const [song, setSong] = useState<Song | null>(cached?.song ?? null);
  const [lines, setLines] = useState<Line[]>(cached?.lines ?? []);
  const [vocab, setVocab] = useState<Vocab[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);

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
  }, [id, user]);

  if (!song) return <SongSkeleton />;

  const flaggedSet = new Set(flags.map((f) => f.word));

  return (
    <AppLayout>
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-6 animate-fade-in">
        {song.album_art_url && <img src={song.album_art_url} alt={song.title} className="h-24 w-24 rounded-xl object-cover shadow-neon-pink" />}
        <div>
          <Badge className={song.genre === "reggaeton" ? "bg-primary text-primary-foreground mb-2" : "mb-2"} variant={song.genre === "bachata" ? "secondary" : "default"}>{song.genre}</Badge>
          <h1 className="text-3xl md:text-4xl font-bold neon-text">{song.title}</h1>
          <p className="text-lg text-muted-foreground">{song.artist}</p>
        </div>
      </header>

      <Tabs defaultValue="lyrics" className="space-y-6" onValueChange={(v) => v === "vocab" && loadVocab()}>
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
          <LyricsPlayer youtubeId={song.youtube_id} lines={lines} songId={song.id} />
        </TabsContent>

        <TabsContent value="vocab">
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
                        <h4 className="font-bold capitalize text-lg">{v.word}</h4>
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
                    <h4 className="font-bold capitalize text-lg">{f.word}</h4>
                    <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />needs practice</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Missed {f.miss_count}× in quiz</p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quiz">
          <ChorusQuiz songId={song.id} lines={lines} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default SongPage;
