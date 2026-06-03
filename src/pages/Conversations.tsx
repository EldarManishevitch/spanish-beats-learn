import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LockedFeature } from "@/components/LockedFeature";
import { useProgress } from "@/hooks/useProgress";
import { MessageCircle, Volume2, RefreshCw } from "lucide-react";

type Phrase = { situation: string; spanish_text: string; pronunciation: string; english_translation: string };

const Conversations = () => {
  const { user } = useAuth();
  const { progress } = useProgress();
  const [phrases, setPhrases] = useState<Phrase[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (force = false) => {
    if (!user) return;
    setLoading(true);
    try {
      if (!force) {
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
          .from("daily_phrases_cache")
          .select("payload")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();
        if (data?.payload) {
          setPhrases((data.payload as any).phrases as Phrase[]);
          setLoading(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke("generate-daily-phrases", { body: { force } });
      if (error) throw error;
      setPhrases(data?.phrases ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (progress?.unlocked_conversations) load();
  }, [user, progress?.unlocked_conversations]);

  const speak = (text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES"; u.rate = 0.85;
    speechSynthesis.speak(u);
  };

  if (!progress) return <AppLayout><div className="py-20 text-center text-muted-foreground">Loading…</div></AppLayout>;

  if (!progress.unlocked_conversations) {
    return (
      <AppLayout>
        <LockedFeature
          title="Daily Conversations"
          description="Master 50 words from songs to unlock daily Latin-life phrases."
          current={progress.mastered_count}
          goal={50}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold neon-text mb-2 flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-primary" /> Daily Conversations
          </h1>
          <p className="text-muted-foreground">5 phrases para la vida latina. Refreshed each day.</p>
        </div>
        <Button variant="outline" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> New set
        </Button>
      </header>

      {loading && !phrases && <Card className="glass p-12 text-center text-muted-foreground">Generating phrases…</Card>}

      <div className="grid gap-4">
        {phrases?.map((p, i) => (
          <Card key={i} className="glass p-5">
            <p className="text-xs uppercase tracking-widest text-accent mb-2">{p.situation}</p>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-xl font-bold">{p.spanish_text}</p>
                <p className="text-sm text-accent/90 italic tracking-wide">{p.pronunciation}</p>
                <p className="text-sm text-muted-foreground italic">{p.english_translation}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => speak(p.spanish_text)} aria-label="Hear phrase pronounced">
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
};

export default Conversations;
