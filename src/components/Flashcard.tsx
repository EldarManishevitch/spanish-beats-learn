import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, Check } from "lucide-react";

type Props = {
  word: string;
  pronunciation?: string | null;
  translation?: string | null;
  failCount: number;
  onMastered: () => void;
};

export const Flashcard = ({ word, pronunciation, translation, failCount, onMastered }: Props) => {
  const [flipped, setFlipped] = useState(false);

  const speak = (e: React.MouseEvent) => {
    e.stopPropagation();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "es-ES"; u.rate = 0.85;
    speechSynthesis.speak(u);
  };

  return (
    <Card
      onClick={() => setFlipped((f) => !f)}
      className="glass p-6 min-h-[180px] cursor-pointer transition-all hover:-translate-y-1"
    >
      {!flipped ? (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Spanish</span>
          <h3 className="text-3xl font-bold capitalize neon-text">{word}</h3>
          <span className="text-xs text-destructive">Missed {failCount}×</span>
          <Button size="sm" variant="ghost" onClick={speak}>
            <Volume2 className="h-3 w-3 mr-1" /> Hear
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
          {pronunciation && <p className="text-accent italic text-lg">{pronunciation}</p>}
          <p className="text-xl font-medium">{translation || "—"}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={(e) => { e.stopPropagation(); onMastered(); }}
          >
            <Check className="h-3 w-3 mr-1" /> Mark mastered
          </Button>
        </div>
      )}
    </Card>
  );
};
