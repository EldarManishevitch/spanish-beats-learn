import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flashcard } from "@/components/Flashcard";
import { useProgress } from "@/hooks/useProgress";
import { RotateCcw, BookOpen, Trophy, Check, X } from "lucide-react";
import { toast } from "sonner";

type Stat = { id: string; word: string; fail_count: number; correct_count: number };
type Vocab = { word: string; hebrew: string };

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

const ReviewRoom = () => {
  const { user } = useAuth();
  const { recompute, addXp } = useProgress();
  const [stats, setStats] = useState<Stat[]>([]);
  const [vocabMap, setVocabMap] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_vocab_stats")
      .select("id, word, fail_count, correct_count")
      .eq("user_id", user.id)
      .eq("is_mastered", false)
      .gt("fail_count", 0)
      .order("fail_count", { ascending: false });
    setStats((data ?? []) as Stat[]);

    const { data: v } = await supabase
      .from("saved_vocab")
      .select("word, hebrew")
      .eq("user_id", user.id);
    const map: Record<string, string> = {};
    (v as Vocab[] | null)?.forEach((x) => { map[x.word.toLowerCase()] = x.hebrew; });
    setVocabMap(map);
  };

  useEffect(() => { load(); }, [user]);

  const markMastered = async (s: Stat) => {
    await supabase.from("user_vocab_stats")
      .update({ is_mastered: true, fail_count: 0, last_reviewed: new Date().toISOString() })
      .eq("id", s.id);
    await addXp("word_mastered", s.word.toLowerCase());
    const r = await recompute();
    if (r?.unlock_changed) toast.success("¡Conversations unlocked!");
    if (r?.tier_changed) toast.success("CEFR rank up!");
    load();
  };

  return (
    <AppLayout>
      <Helmet>
        <title>Review Room — Spaced repetition for Spanish vocab | Ritmo</title>
        <meta name="description" content="Drill the Spanish words you keep missing with flashcards and a review quiz built from your own song history." />
        <link rel="canonical" href="https://spanish-beats-learn.lovable.app/review" />
        <meta property="og:title" content="Review Room — Ritmo" />
        <meta property="og:description" content="Flashcards and quiz to master the Spanish words you keep getting wrong." />
        <meta property="og:url" content="https://spanish-beats-learn.lovable.app/review" />
        <meta property="og:type" content="website" />
      </Helmet>
      <header className="mb-8">
        <h1 className="text-4xl font-bold neon-text mb-2 flex items-center gap-3">
          <RotateCcw className="h-8 w-8 text-primary" /> Review Room
        </h1>
        <p className="text-muted-foreground">{stats.length} word{stats.length === 1 ? "" : "s"} need your attention.</p>
      </header>



      <Tabs defaultValue="cards">
        <TabsList className="glass mb-6">
          <TabsTrigger value="cards" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <BookOpen className="h-4 w-4 mr-2" /> Flashcards
          </TabsTrigger>
          <TabsTrigger value="quiz" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Trophy className="h-4 w-4 mr-2" /> Review Quiz
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cards">
          <h2 className="sr-only">Flashcards</h2>
          {stats.length === 0 ? (
            <Card className="glass p-12 text-center">
              <RotateCcw className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No words to review. Take a song quiz to fill this up.</p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((s) => (
                <Flashcard
                  key={s.id}
                  word={s.word}
                  translation={vocabMap[s.word.toLowerCase()] ?? null}
                  pronunciation={null}
                  failCount={s.fail_count}
                  onMastered={() => markMastered(s)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quiz">
          <h2 className="sr-only">Review Quiz</h2>
          <ReviewQuiz stats={stats} vocabMap={vocabMap} onDone={load} />
        </TabsContent>

      </Tabs>
    </AppLayout>
  );
};

const ReviewQuiz = ({ stats, vocabMap, onDone }: { stats: Stat[]; vocabMap: Record<string, string>; onDone: () => void }) => {
  const { recompute, addXp } = useProgress();
  const questions = useMemo(() => {
    const eligible = stats.filter((s) => vocabMap[s.word.toLowerCase()]);
    const pool = shuffle(eligible).slice(0, 10);
    const allTrans = Object.values(vocabMap);
    return pool.map((s) => {
      const correct = vocabMap[s.word.toLowerCase()];
      const distractors = shuffle(allTrans.filter((t) => t !== correct)).slice(0, 3);
      return { stat: s, correct, options: shuffle([correct, ...distractors]) };
    });
  }, [stats, vocabMap]);

  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (questions.length === 0) {
    return (
      <Card className="glass p-8 text-center">
        <p className="text-muted-foreground">Save some translations from songs first to enable the review quiz.</p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="glass p-8 text-center neon-border-pink">
        <Trophy className="h-16 w-16 mx-auto text-accent mb-4" />
        <h3 className="text-3xl font-bold neon-text mb-2">{score}/{questions.length}</h3>
        <Button onClick={() => { setIdx(0); setAnswer(null); setScore(0); setDone(false); onDone(); }} className="bg-gradient-neon text-background">
          Done
        </Button>
      </Card>
    );
  }

  const q = questions[idx];

  const choose = async (opt: string) => {
    if (answer) return;
    setAnswer(opt);
    const correct = opt === q.correct;
    const s = q.stat;
    if (correct) {
      setScore((x) => x + 1);
      const newCorrect = s.correct_count + 1;
      const newFail = Math.max(0, s.fail_count - 1);
      const mastered = newCorrect >= 2 && newFail === 0;
      await supabase.from("user_vocab_stats").update({
        correct_count: newCorrect,
        fail_count: newFail,
        is_mastered: mastered,
        last_reviewed: new Date().toISOString(),
      }).eq("id", s.id);
      await addXp("quiz_correct", `review:${s.id}:${s.correct_count + 1}`);
      if (mastered) await addXp("word_mastered", s.word.toLowerCase());
    } else {
      await supabase.from("user_vocab_stats").update({
        fail_count: s.fail_count + 1,
        last_reviewed: new Date().toISOString(),
      }).eq("id", s.id);
    }
  };

  const next = async () => {
    if (idx + 1 >= questions.length) {
      setDone(true);
      const r = await recompute();
      if (r?.unlock_changed) toast.success("¡Conversations unlocked!");
      if (r?.tier_changed) toast.success("CEFR rank up!");
    } else {
      setIdx(idx + 1);
      setAnswer(null);
    }
  };

  return (
    <Card className="glass p-6 space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Question {idx + 1} / {questions.length}</span>
        <span>Score: <span className="text-primary font-bold">{score}</span></span>
      </div>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Translate</p>
        <h3 className="text-3xl font-bold capitalize neon-text">{q.stat.word}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {q.options.map((opt) => {
          const isCorrect = answer && opt === q.correct;
          const isWrong = answer === opt && opt !== q.correct;
          return (
            <Button
              key={opt}
              variant="outline"
              disabled={!!answer}
              onClick={() => choose(opt)}
              className={`h-auto py-3 ${isCorrect ? "border-green-500 bg-green-500/10 text-green-400" : ""} ${isWrong ? "border-destructive bg-destructive/10 text-destructive" : ""}`}
            >
              {isCorrect && <Check className="h-4 w-4 mr-1" />}
              {isWrong && <X className="h-4 w-4 mr-1" />}
              {opt}
            </Button>
          );
        })}
      </div>
      {answer && <Button onClick={next} className="w-full bg-primary hover:bg-primary/90">{idx + 1 >= questions.length ? "Finish" : "Next"}</Button>}
    </Card>
  );
};

export default ReviewRoom;
