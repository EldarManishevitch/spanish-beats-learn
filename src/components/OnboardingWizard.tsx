import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Music, Sparkles, Check, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const GENRES = [
  { id: "bachata", label: "Bachata", emoji: "🌹" },
  { id: "reggaeton", label: "Reggaeton", emoji: "🔥" },
  { id: "salsa", label: "Salsa", emoji: "💃" },
  { id: "latin_pop", label: "Latin Pop", emoji: "✨" },
];

const GOALS = [
  { id: "festivals", label: "Understand songs at festivals & clubs", desc: "Catch every lyric on the dance floor" },
  { id: "fluent_fun", label: "Speak fluid Spanish for fun", desc: "Casual, natural conversation skills" },
  { id: "pronunciation", label: "Practice pronunciation", desc: "Sound like a native singer" },
];

type Props = { open: boolean; onComplete: () => void };

export const OnboardingWizard = ({ open, onComplete }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [genres, setGenres] = useState<string[]>([]);
  const [goal, setGoal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleGenre = (id: string) =>
    setGenres((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  const finish = async () => {
    if (!user || !goal) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        fav_genres: genres,
        learning_goal: goal,
        onboarding_completed: true,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save preferences. Please try again.");
      return;
    }
    toast.success("¡Vamos! Your dashboard is ready.");
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* gate — cannot close until done */ }}>
      <DialogContent
        className="max-w-xl neon-border-pink"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-center mb-2">
          <div className="h-14 w-14 rounded-2xl bg-gradient-neon animate-gradient flex items-center justify-center shadow-soft-lg">
            <Music className="h-7 w-7 text-primary-foreground" />
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-2">
          {[1, 2].map((n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                step === n ? "w-8 bg-primary" : n < step ? "w-4 bg-primary/60" : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <DialogTitle className="text-center text-2xl">
              <Sparkles className="h-5 w-5 inline mr-1.5 text-accent" />
              What music do you love?
            </DialogTitle>
            <DialogDescription className="text-center">
              We'll surface the right songs for you. Pick all that apply.
            </DialogDescription>
            <div className="grid grid-cols-2 gap-3 my-4">
              {GENRES.map((g) => {
                const active = genres.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGenre(g.id)}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10 shadow-soft"
                        : "border-border hover:border-primary/40 bg-card"
                    }`}
                  >
                    <div className="text-3xl mb-1">{g.emoji}</div>
                    <div className="font-semibold">{g.label}</div>
                    {active && (
                      <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <Button
              size="lg"
              onClick={() => setStep(2)}
              disabled={genres.length === 0}
              className="w-full bg-primary hover:bg-primary/90"
            >
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <DialogTitle className="text-center text-2xl">
              What's your main goal?
            </DialogTitle>
            <DialogDescription className="text-center">
              We'll tailor the experience to match.
            </DialogDescription>
            <div className="space-y-3 my-4">
              {GOALS.map((g) => {
                const active = goal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10 shadow-soft"
                        : "border-border hover:border-primary/40 bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          active ? "border-primary bg-primary" : "border-muted-foreground/40"
                        }`}
                      >
                        {active && <Check className="h-3 w-3 text-primary-foreground" />}
                      </span>
                      <div>
                        <div className="font-semibold">{g.label}</div>
                        <div className="text-sm text-muted-foreground">{g.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={finish}
                disabled={!goal || saving}
                className="flex-[2] bg-gradient-neon animate-gradient text-background font-semibold"
              >
                {saving ? "Saving…" : "Start learning"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
