import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Props = {
  title: string;
  description: string;
  current: number;
  goal: number;
};

export const LockedFeature = ({ title, description, current, goal }: Props) => {
  const pct = Math.min(100, Math.round((current / goal) * 100));
  return (
    <Card className="glass p-10 text-center max-w-xl mx-auto border-accent/40">
      <div className="h-16 w-16 mx-auto rounded-2xl bg-accent/10 flex items-center justify-center mb-4 border border-accent/40">
        <Lock className="h-7 w-7 text-accent" />
      </div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6">{description}</p>
      <Progress value={pct} className="mb-2" />
      <p className="text-sm text-muted-foreground">
        <span className="text-primary font-bold">{current}</span> / {goal} mastered words
      </p>
    </Card>
  );
};
