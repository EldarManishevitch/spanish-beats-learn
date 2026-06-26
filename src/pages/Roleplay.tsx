import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UnlockCelebration } from "@/components/UnlockCelebration";
import { useProgress } from "@/hooks/useProgress";
import { Mic, Volume2, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Step = { spanish_text: string; pronunciation: string; english_translation: string; suggested_reply: string };
type Scenario = { scenario_title: string; character_name: string; location: string; dialogue_steps: Step[] };

const Roleplay = () => {
  const { user } = useAuth();
  const { progress, addXp, recompute } = useProgress();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [turn, setTurn] = useState(0);
  const [revealedTwice, setRevealedTwice] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [unlock, setUnlock] = useState<{ open: boolean; title: string; subtitle?: string }>({ open: false, title: "" });

  const load = async () => {
    setLoading(true);
    setScenario(null);
    setTurn(0);
    setRevealedTwice({});
    setCompleted(false);
    try {
      const { data, error } = await supabase.functions.invoke("generate-roleplay", { body: {} });
      if (error) throw error;
      setScenario(data as Scenario);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load scenario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (progress?.unlocked_conversations && !scenario && !loading) load();
  }, [progress?.unlocked_conversations]);

  const speak = (t: string) => {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "es-ES"; u.rate = 0.85;
    speechSynthesis.speak(u);
  };

  const onReveal = async (i: number, step: Step) => {
    setRevealedTwice((prev) => {
      const n = (prev[i] ?? 0) + 1;
      if (n === 2 && user) {
        const word = step.spanish_text.split(/\s+/).find((w) => w.length > 4)?.toLowerCase().replace(/[¿¡!?.,;:""'()]/g, "");
        if (word) {
          supabase.functions
            .invoke("record-vocab", { body: { type: "track_reveal", word } })
            .then(() => toast.info(`"${word}" added to Review Room`));
        }
      }
      return { ...prev, [i]: n };
    });
  };

  const reply = async (suggestion: string) => {
    if (!scenario) return;
    if (turn + 1 >= scenario.dialogue_steps.length) {
      setCompleted(true);
      await addXp("roleplay_completed", new Date().toISOString().slice(0, 10));
      const r = await recompute();
      if (r?.unlock_changed) setUnlock({ open: true, title: "Conversations", subtitle: "50 words mastered!" });
      else if (r?.tier_changed) setUnlock({ open: true, title: progress?.cefr_level ?? "", subtitle: "CEFR rank up" });
      else toast.success("+50 XP");
    } else {
      setTurn(turn + 1);
    }
  };

  if (!progress) return <AppLayout><div className="py-20 text-center text-muted-foreground">Loading…</div></AppLayout>;

  if (!progress.unlocked_conversations) {
    return (
      <AppLayout>
        <LockedFeature
          title="Roleplay Scenarios"
          description="Master 50 words from songs to roleplay real Latin-life situations with the AI."
          current={progress.mastered_count}
          goal={50}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Helmet>
        <title>Roleplay — Practice Spanish in Latin scenarios | Ritmo</title>
        <meta name="description" content="Five-turn AI roleplays in real Latin settings — Havana mojitos, Cartagena beaches, Medellín reggaeton clubs — tuned to your CEFR level." />
        <link rel="canonical" href="https://spanish-beats-learn.lovable.app/roleplay" />
        <meta property="og:title" content="Roleplay — Ritmo" />
        <meta property="og:description" content="AI-led Spanish roleplays in real Latin-life scenarios, tuned to your CEFR level." />
        <meta property="og:url" content="https://spanish-beats-learn.lovable.app/roleplay" />
        <meta property="og:type" content="website" />
      </Helmet>
      <UnlockCelebration open={unlock.open} title={unlock.title} subtitle={unlock.subtitle} onClose={() => setUnlock({ open: false, title: "" })} />

      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold neon-text mb-2 flex items-center gap-3">
            <Mic className="h-8 w-8 text-primary" /> Roleplay
          </h1>
          {scenario && (
            <p className="text-muted-foreground">
              <span className="text-accent">{scenario.scenario_title}</span> · with {scenario.character_name} · {scenario.location}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> New scene
        </Button>
      </header>

      {loading && <Card className="glass p-12 text-center text-muted-foreground">Setting the scene…</Card>}

      {scenario && !completed && (
        <div className="space-y-4">
          {scenario.dialogue_steps.slice(0, turn + 1).map((step, i) => {
            const showHint = (revealedTwice[i] ?? 0) > 0;
            return (
              <Card key={i} className="glass p-5 max-w-2xl">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-xs uppercase tracking-widest text-accent">{scenario.character_name}</span>
                  <Button size="icon" variant="ghost" onClick={() => speak(step.spanish_text)} aria-label="Hear line pronounced">
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xl font-bold mb-1">{step.spanish_text}</p>
                <p className="text-sm text-accent/90 italic tracking-wide mb-1">{step.pronunciation}</p>
                {showHint ? (
                  <p className="text-sm text-muted-foreground italic">{step.english_translation}</p>
                ) : (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => onReveal(i, step)}>
                    Show translation
                  </Button>
                )}
                {showHint && (
                  <Button size="sm" variant="ghost" className="text-xs ml-2" onClick={() => onReveal(i, step)}>
                    Show again
                  </Button>
                )}
              </Card>
            );
          })}

          <div className="max-w-2xl space-y-2 pt-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Your reply</p>
            <Button
              variant="outline"
              className="w-full justify-start text-left h-auto py-3 border-primary/40 hover:border-primary"
              onClick={() => reply(scenario.dialogue_steps[turn].suggested_reply)}
            >
              <Sparkles className="h-4 w-4 mr-2 text-accent shrink-0" />
              {scenario.dialogue_steps[turn].suggested_reply}
            </Button>
          </div>
        </div>
      )}

      {completed && (
        <Card className="glass p-10 text-center neon-border-pink max-w-xl mx-auto">
          <Sparkles className="h-12 w-12 mx-auto text-accent mb-3" />
          <h2 className="text-2xl font-bold neon-text mb-2">¡Bien hecho!</h2>
          <p className="text-muted-foreground mb-6">+50 XP earned.</p>
          <Button onClick={load} className="bg-gradient-neon text-background">Another scene</Button>
        </Card>
      )}
    </AppLayout>
  );
};

export default Roleplay;
