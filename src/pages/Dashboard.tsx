import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Sparkles, Zap, Music2 } from "lucide-react";
import { SongSearch } from "@/components/SongSearch";

type Song = { id: string; title: string; artist: string; genre: string; album_art_url: string | null; difficulty: string };
type Slang = {
  term: string;
  contextual_meaning: string;
  example_usage: string | null;
  example_song_title: string | null;
  example_song_artist: string | null;
  lyrics_snippet: string | null;
};

const Dashboard = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [slang, setSlang] = useState<Slang | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("songs").select("*").then(({ data }) => setSongs(data ?? []));
    supabase
      .from("slang_dictionary")
      .select("term, contextual_meaning, example_usage, example_song_title, example_song_artist, lyrics_snippet")
      .eq("is_urban_slang", true)
      .not("example_song_title", "is", null)
      .then(({ data }) => {
        if (data?.length) setSlang(data[Math.floor(Math.random() * data.length)] as Slang);
      });
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
      <section className="mb-10 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold mb-2">
          <span className="neon-text">Suena</span> the Latin beat
        </h1>
        <p className="text-muted-foreground text-lg">Pick a song. Sing along. Pick up Spanish.</p>
      </section>

      {slang && (
        <Card className="glass mb-8 p-6 border-accent/40 shadow-neon-yellow animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge className="mb-2 bg-accent text-accent-foreground hover:bg-accent">Slang of the Day</Badge>
              <h3 className="text-2xl font-bold mb-1 capitalize">{slang.term}</h3>
              <p className="text-foreground/80 mb-4">{slang.contextual_meaning}</p>

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
                    <p className="text-primary font-semibold italic neon-text pl-1 border-l-2 border-primary/60 pl-3">
                      "{slang.lyrics_snippet}"
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <SongSearch />

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Featured Songs</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {songs.map((s) => (
            <Link key={s.id} to={`/song/${s.id}`} className="group">
              <Card className="glass overflow-hidden border-border/50 hover:border-primary/60 hover:shadow-neon-pink transition-all duration-300 hover:-translate-y-1">
                <div className="relative aspect-video overflow-hidden">
                  {s.album_art_url && <img src={s.album_art_url} alt={s.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  <div className="absolute top-3 right-3">
                    <Badge variant={s.genre === "bachata" ? "secondary" : "default"} className={s.genre === "reggaeton" ? "bg-primary text-primary-foreground" : ""}>
                      {s.genre}
                    </Badge>
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
          ))}
        </div>
      </section>
    </AppLayout>
  );
};

export default Dashboard;
