import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Volume2, BookmarkPlus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Result = {
  word: string;
  translation: string;
  is_slang: boolean;
  example?: string | null;
  pronunciation_hint?: string | null;
  source: "slang" | "cache" | "ai";
};

const cleanWord = (w: string) => w.toLowerCase().replace(/[¿¡!?.,;:""'()]/g, "").trim();

export const TranslateWord = ({ word, songId }: { word: string; songId?: string }) => {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const cleaned = cleanWord(word);

  useEffect(() => {
    if (!open || result) return;
    setLoading(true);
    supabase.functions.invoke("translate-word", { body: { word: cleaned } })
      .then(({ data, error }) => {
        if (error) { toast.error("Translation failed"); return; }
        if (data?.error) { toast.error(data.error); return; }
        setResult(data as Result);
      })
      .finally(() => setLoading(false));
  }, [open, cleaned, result]);

  const speak = () => {
    const u = new SpeechSynthesisUtterance(cleaned);
    u.lang = "es-ES";
    u.rate = 0.85;
    speechSynthesis.speak(u);
  };

  const save = async () => {
    if (!user || !result) return;
    const { error } = await supabase.from("saved_vocab").upsert({
      user_id: user.id,
      word: cleaned,
      hebrew: result.translation,
      source_song_id: songId ?? null,
      is_slang: result.is_slang,
    }, { onConflict: "user_id,word" });
    if (error) toast.error("Could not save");
    else toast.success("Saved to vocab");
  };

  if (!cleaned) return <span>{word} </span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="hover:text-primary hover:underline decoration-dotted underline-offset-4 transition-colors cursor-pointer">
          {word}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 glass border-primary/40" align="center">
        {loading || !result ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold capitalize">{result.word}</h4>
              {result.is_slang && (
                <Badge className="bg-accent text-accent-foreground hover:bg-accent gap-1">
                  <Sparkles className="h-3 w-3" /> slang
                </Badge>
              )}
            </div>
            <p className="text-xl font-semibold text-primary">{result.translation}</p>
            {result.example && <p className="text-xs italic text-muted-foreground">"{result.example}"</p>}
            {result.pronunciation_hint && <p className="text-xs text-muted-foreground">{result.pronunciation_hint}</p>}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={speak} className="flex-1">
                <Volume2 className="h-3 w-3 mr-1" /> Hear
              </Button>
              {user && (
                <Button size="sm" onClick={save} className="flex-1 bg-primary hover:bg-primary/90">
                  <BookmarkPlus className="h-3 w-3 mr-1" /> Save
                </Button>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
