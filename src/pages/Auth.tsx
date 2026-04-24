import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Music, Sparkles } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

const Auth = () => {
  const { session, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && session) nav("/", { replace: true });
  }, [session, loading, nav]);

  const handleGoogle = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/",
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md glass rounded-2xl p-8 shadow-card-deep neon-border-pink animate-scale-in">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-neon animate-gradient flex items-center justify-center shadow-neon-pink mb-4">
            <Music className="h-8 w-8 text-background" />
          </div>
          <h1 className="text-4xl font-bold neon-text mb-2">Ritmo</h1>
          <p className="text-muted-foreground">למד ספרדית דרך באצ'אטה ורגאטון</p>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-accent" />
            Learn Spanish through Latin music
          </p>
        </div>
        <Button onClick={handleGoogle} size="lg" className="w-full bg-gradient-neon animate-gradient text-background font-semibold hover:opacity-90">
          Continue with Google
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-6">By continuing you agree to our terms.</p>
      </div>
    </div>
  );
};

export default Auth;
