import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Check, X, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProgress } from "@/hooks/useProgress";
import { UnlockCelebration } from "@/components/UnlockCelebration";
import { touchStreak } from "@/lib/streak";
import { toast } from "sonner";

type Line = { id: string; line_index: number; spanish_text: string; english_translation: string | null; is_chorus: boolean };
type SectionId = "chorus" | "verse_1" | "verse_2" | "full";
type Q = { line: Line; missing: string; options: string[]; words: string[]; missingIdx: number };

const cleanWord = (w: string) => w.toLowerCase().replace(/[¿¡!?.,;:""'()]/g, "").trim();
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

export const ChorusQuiz = ({ songId, lines, songTitle, songArtist }: { songId: string; lines: Line[]; songTitle?: string; songArtist?: string }) => {
  const { user } = useAuth();
  const { addXp, recompute, progress } = useProgress();
  const [seed, setSeed] = useState(0);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [unlock, setUnlock] = useState<{ open: boolean; title: string; subtitle?: string }>({ open: false, title: "" });

  const questions = useMemo<Q[]>(() => {
    void seed;
    // Blocklist: words from song title and artist name should never be used.
    const metaWords = new Set(
      [songTitle ?? "", songArtist ?? ""]
        .join(" ")
        .split(/\s+/)
        .map(cleanWord)
        .filter(Boolean),
    );
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
    const titleNorm = normalize(songTitle ?? "");
    const artistNorm = normalize(songArtist ?? "");

    const isValidLyric = (text: string) => {
      const t = text.trim();
      if (!t) return false;
      // Reject section headers like [Chorus], (Intro), {Verse 1}
      if (/^[\[\(\{][^\]\)\}]*[\]\)\}]\s*:?\s*$/.test(t)) return false;
      const n = normalize(t);
      // Reject lines that are essentially the title or artist
      if (titleNorm && (n === titleNorm || (n.includes(titleNorm) && n.length <= titleNorm.length + 4))) return false;
      if (artistNorm && (n === artistNorm || (n.includes(artistNorm) && n.length <= artistNorm.length + 4))) return false;
      const words = t.split(/\s+/);
      if (words.length < 3) return false;
      // Must contain at least one real >3-char word that isn't metadata
      if (!words.some((w) => cleanWord(w).length > 3 && !metaWords.has(cleanWord(w)))) return false;
      return true;
    };

    const validLines = lines.filter((l) => isValidLyric(l.spanish_text));
    const allWords = Array.from(
      new Set(
        validLines
          .flatMap((l) => l.spanish_text.split(/\s+/).map(cleanWord))
          .filter((w) => w.length > 3 && !metaWords.has(w)),
      ),
    );
    if (!validLines.length || allWords.length < 4) return [];
    const count = Math.min(validLines.length, Math.floor(Math.random() * 4) + 5); // 5-8
    const picked = shuffle(validLines).slice(0, count);
    return picked.map((line) => {
      const words = line.spanish_text.split(/\s+/);
      const candidates = words
        .map((w, i) => ({ w, i, c: cleanWord(w) }))
        .filter((x) => x.c.length > 3 && !metaWords.has(x.c));
      const pick = candidates[Math.floor(Math.random() * candidates.length)] ?? { w: words[0], i: 0, c: cleanWord(words[0]) };
      const distractors = shuffle(allWords.filter((w) => w !== pick.c)).slice(0, 3);
      return {
        line,
        missing: pick.c,
        options: shuffle([pick.c, ...distractors]),
        words,
        missingIdx: pick.i,
      };
    });
  }, [lines, seed, songTitle, songArtist]);

  const q = questions[idx];

  const flagWrong = async (word: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("practice_flags")
      .select("id, miss_count")
      .eq("user_id", user.id).eq("song_id", songId).eq("word", word).maybeSingle();
    if (existing) {
      await supabase.from("practice_flags").update({ miss_count: existing.miss_count + 1, last_missed_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("practice_flags").insert({ user_id: user.id, song_id: songId, word, miss_count: 1 });
    }
  };

  const clearFlag = async (word: string) => {
    if (!user) return;
    await supabase.from("practice_flags").delete().eq("user_id", user.id).eq("song_id", songId).eq("word", word);
  };

  const updateVocabStat = async (word: string, isCorrect: boolean) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("user_vocab_stats")
      .select("id, fail_count, correct_count, is_mastered")
      .eq("user_id", user.id).eq("word", word).maybeSingle();
    const now = new Date().toISOString();
    if (existing) {
      const fc = isCorrect ? existing.fail_count : existing.fail_count + 1;
      const cc = isCorrect ? existing.correct_count + 1 : existing.correct_count;
      const mastered = isCorrect && cc >= 3 && fc === 0;
      await supabase.from("user_vocab_stats").update({
        fail_count: fc, correct_count: cc,
        is_mastered: mastered || existing.is_mastered,
        last_reviewed: now,
      }).eq("id", existing.id);
      if (mastered && !existing.is_mastered) await addXp("word_mastered", word);
    } else {
      await supabase.from("user_vocab_stats").insert({
        user_id: user.id, word,
        fail_count: isCorrect ? 0 : 1,
        correct_count: isCorrect ? 1 : 0,
        last_reviewed: now,
      });
    }
  };

  const choose = async (opt: string) => {
    if (answer) return;
    setAnswer(opt);
    const correct = opt === q.missing;
    if (correct) {
      setScore((s) => s + 1);
      await clearFlag(q.missing);
      await updateVocabStat(q.missing, true);
      await addXp("quiz_correct", `${songId}:${q.line.id}`);
    } else {
      await flagWrong(q.missing);
      await updateVocabStat(q.missing, false);
    }
  };

  const next = async () => {
    if (idx + 1 >= questions.length) {
      setDone(true);
      if (user) {
        await supabase.from("quiz_attempts").insert({ user_id: user.id, song_id: songId, score, total: questions.length });
        await touchStreak("quiz_completed");
        const r = await recompute();
        if (r?.unlock_changed) setUnlock({ open: true, title: "Conversations", subtitle: "50 words mastered!" });
        else if (r?.tier_changed) setUnlock({ open: true, title: progress?.cefr_level ?? "", subtitle: "CEFR rank up" });
      }
      toast.success(`Score: ${score}/${questions.length}`);
    } else {
      setIdx(idx + 1);
      setAnswer(null);
    }
  };

  const restart = () => { setSeed((s) => s + 1); setIdx(0); setAnswer(null); setScore(0); setDone(false); };

  if (!questions.length) return <p className="text-muted-foreground text-center py-8">No quiz lines available for this song.</p>;

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <>
        <UnlockCelebration open={unlock.open} title={unlock.title} subtitle={unlock.subtitle} onClose={() => setUnlock({ open: false, title: "" })} />
        <Card className="glass p-8 text-center neon-border-pink">
          <Trophy className="h-16 w-16 mx-auto text-accent mb-4" />
          <h3 className="text-3xl font-bold mb-2 neon-text">{pct}%</h3>
          <p className="text-muted-foreground mb-6">{score} / {questions.length} correct</p>
          <Button onClick={restart} className="bg-gradient-neon animate-gradient text-background">
            <RotateCcw className="h-4 w-4 mr-2" /> Play again
          </Button>
        </Card>
      </>
    );
  }

  return (
    <Card className="glass p-6 space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Question {idx + 1} / {questions.length}</span>
        <span>Score: <span className="text-primary font-bold">{score}</span></span>
      </div>
      <div className="text-lg md:text-xl leading-relaxed font-medium text-center">
        {q.words.map((w, i) => (
          <span key={i}>
            {i === q.missingIdx ? (
              <span className="inline-block min-w-[100px] px-3 py-1 mx-1 rounded-lg border-2 border-dashed border-primary/60 bg-primary/5">
                {answer ?? "___"}
              </span>
            ) : w}
            {" "}
          </span>
        ))}
      </div>
      {q.line.english_translation && (
        <p className="text-sm text-center text-muted-foreground italic">{q.line.english_translation}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((opt) => {
          const isCorrect = answer && opt === q.missing;
          const isWrong = answer === opt && opt !== q.missing;
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
