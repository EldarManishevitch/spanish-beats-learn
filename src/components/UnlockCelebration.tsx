import { useEffect, useState } from "react";
import { Sparkles, Trophy } from "lucide-react";

type Props = { open: boolean; title: string; subtitle?: string; onClose: () => void };

export const UnlockCelebration = ({ open, title, subtitle, onClose }: Props) => {
  const [show, setShow] = useState(open);
  useEffect(() => {
    setShow(open);
    if (open) {
      const t = setTimeout(() => { setShow(false); onClose(); }, 4500);
      return () => clearTimeout(t);
    }
  }, [open, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-fade-in" onClick={() => { setShow(false); onClose(); }}>
      <div className="relative px-10 py-12 rounded-3xl glass shadow-neon-pink text-center max-w-md mx-4 animate-scale-in">
        <div className="absolute inset-0 rounded-3xl bg-gradient-neon opacity-10 animate-gradient pointer-events-none" />
        {[...Array(12)].map((_, i) => (
          <Sparkles
            key={i}
            className="absolute h-4 w-4 text-accent animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
        <Trophy className="h-16 w-16 mx-auto text-accent mb-4 relative" />
        <p className="text-sm uppercase tracking-widest text-accent mb-1 relative">¡Nuevo nivel desbloqueado!</p>
        <h2 className="text-3xl font-bold neon-text mb-2 relative">{title}</h2>
        {subtitle && <p className="text-muted-foreground relative">{subtitle}</p>}
      </div>
    </div>
  );
};
