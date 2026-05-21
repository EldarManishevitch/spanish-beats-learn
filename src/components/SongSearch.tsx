import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Result = { youtube_id: string; title: string; channel: string; thumbnail: string };

export const SongSearch = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("youtube-search", { body: { q: q.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data?.results ?? []);
    } catch (err) {
      console.error(err);
      toast({ title: "Search failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const pick = async (r: Result) => {
    setGeneratingId(r.youtube_id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lyrics", {
        body: { youtube_id: r.youtube_id, title: r.title, channel: r.channel, thumbnail: r.thumbnail },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      navigate(`/song/${data.song_id}`);
    } catch (err) {
      console.error(err);
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <Card id="tour-search" className="bg-white border border-secondary/15 shadow-soft p-5 mb-8 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Add a New Song</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Search YouTube for a Spanish track. We'll auto-generate lyrics, translations, and chorus markings.
      </p>
      <form onSubmit={search} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Shakira Hips Don't Lie"
          className="bg-white border-secondary/20 text-foreground placeholder:text-muted-foreground"
        />
        <Button type="submit" disabled={searching || q.trim().length < 2} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>

      {results.length > 0 && (
        <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
          {results.map((r) => (
            <div key={r.youtube_id} className="flex gap-3 items-center p-2 rounded-lg hover:bg-primary/5 transition-colors">
              <img src={r.thumbnail} alt="" className="h-14 w-20 object-cover rounded-md shrink-0" loading="lazy" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" dangerouslySetInnerHTML={{ __html: r.title }} />
                <p className="text-xs text-muted-foreground truncate">{r.channel}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={generatingId !== null}
                onClick={() => pick(r)}
              >
                {generatingId === r.youtube_id ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating…</>
                ) : (
                  <>Add <Badge variant="outline" className="ml-1">AI</Badge></>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
