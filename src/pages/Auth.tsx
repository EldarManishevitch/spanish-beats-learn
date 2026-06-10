import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
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
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.redirected) return;
      if (result.error) {
        toast.error(result.error.message || "Sign in failed. Please try again.");
        return;
      }
      nav("/", { replace: true });
    } catch (e) {
      toast.error("Sign in failed. Please try again in your default browser.");
    }
  };

  return (
    <>
      <Helmet>
        <title>Sign in to Ritmo — Learn Spanish through Latin music</title>
        <meta name="description" content="Sign in to Ritmo to save vocabulary and track your progress learning Spanish through Bachata and Reggaeton." />
        <link rel="canonical" href="/auth" />
        <meta property="og:title" content="Sign in to Ritmo" />
        <meta property="og:description" content="Sign in to Ritmo to save vocabulary, track your CEFR progress, and unlock the full catalog of Bachata and Reggaeton lessons." />
        <meta property="og:url" content="/auth" />
      </Helmet>
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md glass rounded-2xl p-8 shadow-card-deep neon-border-pink animate-scale-in">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-gradient-neon animate-gradient flex items-center justify-center shadow-neon-pink mb-4">
              <Music className="h-8 w-8 text-background" />
            </div>
            <h1 className="text-4xl font-bold neon-text mb-2">Ritmo — Learn Spanish through Latin music</h1>
            <p className="text-muted-foreground">למד ספרדית דרך באצ'אטה ורגאטון</p>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-accent" />
              Bachata, Reggaeton & more
            </p>
          </div>
          <Button onClick={handleGoogle} size="lg" className="w-full bg-gradient-neon animate-gradient text-background font-semibold hover:opacity-90">
            Continue with Google
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-6">By continuing you agree to our terms.</p>
        </div>
      </main>
    </>
  );
};

export default Auth;
