import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Music, Play, Sparkles, Languages, Zap } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

// Hardcoded snippet — Bad Bunny, "Tití Me Preguntó".
// We start the YouTube video at the chorus and auto-pause after exactly 10s,
// then drop a sign-in modal. The interactive lyric snippet below is fully
// client-side so guests get the "aha moment" without any auth call.
const PREVIEW = {
  youtubeId: "Cr8K88UcO0s",
  title: "Tití Me Preguntó",
  artist: "Bad Bunny",
  startSeconds: 41,
  durationMs: 10_000,
  lines: [
    "Tití me preguntó si tengo muchas novias",
    "Le dije que sí",
  ],
};

type WordGloss = { pron: string; en: string };
const GLOSSARY: Record<string, WordGloss> = {
  titi: { pron: "TEE-tee", en: "auntie (Caribbean term of endearment)" },
  "tití": { pron: "TEE-tee", en: "auntie (Caribbean term of endearment)" },
  me: { pron: "meh", en: "me / to me" },
  preguntó: { pron: "preh-goon-TOH", en: "asked" },
  si: { pron: "see", en: "if / whether" },
  tengo: { pron: "TEN-go", en: "I have" },
  muchas: { pron: "MOO-chas", en: "many" },
  novias: { pron: "NO-byas", en: "girlfriends" },
  le: { pron: "leh", en: "to her / to him" },
  dije: { pron: "DEE-heh", en: "I said / I told" },
  que: { pron: "keh", en: "that" },
  sí: { pron: "see", en: "yes" },
};

const cleanWord = (w: string) => w.toLowerCase().replace(/[¿¡!?.,;:""'()]/g, "").trim();

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
    __ytApiLoading?: boolean;
    __ytApiReady?: boolean;
    __ytReadyCallbacks?: Array<() => void>;
  }
}

const loadYouTubeAPI = (): Promise<void> =>
  new Promise((resolve) => {
    if (window.__ytApiReady && window.YT?.Player) return resolve();
    window.__ytReadyCallbacks = window.__ytReadyCallbacks || [];
    window.__ytReadyCallbacks.push(resolve);
    if (window.__ytApiLoading) return;
    window.__ytApiLoading = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      window.__ytApiReady = true;
      window.__ytReadyCallbacks?.forEach((cb) => cb());
      window.__ytReadyCallbacks = [];
    };
  });

const Landing = () => {
  const playerRef = useRef<any>(null);
  const stopTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [signinOpen, setSigninOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    return () => {
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, []);

  const ensurePlayer = (): Promise<void> =>
    new Promise((resolve) => {
      if (playerReady && playerRef.current) return resolve();
      loadYouTubeAPI().then(() => {
        if (!containerRef.current) return resolve();
        if (playerRef.current) return resolve();
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: PREVIEW.youtubeId,
          playerVars: { controls: 0, modestbranding: 1, rel: 0, playsinline: 1, start: PREVIEW.startSeconds },
          events: {
            onReady: () => {
              setPlayerReady(true);
              resolve();
            },
          },
        });
      });
    });

  const play = async () => {
    try {
      await ensurePlayer();
      if (!playerRef.current) return;
      playerRef.current.seekTo(PREVIEW.startSeconds, true);
      playerRef.current.playVideo();
      setPlaying(true);
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      stopTimer.current = window.setTimeout(() => {
        try { playerRef.current?.pauseVideo(); } catch { /* ignore */ }
        setPlaying(false);
        setSigninOpen(true);
      }, PREVIEW.durationMs);
    } catch (e) {
      console.error("preview play failed", e);
    }
  };


  const handleGoogle = async () => {
    setSigningIn(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.redirected) return;
      if (result.error) {
        toast.error(result.error.message || "Sign in failed. Please try again.");
      }
    } catch {
      toast.error("Sign in failed. Please try again in your default browser.");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Ritmo — Learn Spanish through Bad Bunny & Latin music</title>
        <meta name="description" content="Hit play on a real Bad Bunny chorus. Tap any word for instant pronunciation and English translation. Free 10-second preview, no signup required." />
        <link rel="canonical" href="/" />
        <meta property="og:title" content="Ritmo — Learn Spanish through Latin music" />
        <meta property="og:description" content="Tap any word in a Bad Bunny chorus to instantly see pronunciation and translation." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="/" />
      </Helmet>

      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" aria-label="Ritmo home" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-soft">
              <Music className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Ritmo</span>
          </Link>
          <Button onClick={() => setSigninOpen(true)} className="bg-primary hover:bg-primary/90">
            Sign in
          </Button>
        </div>
      </header>

      <main className="container py-10 md:py-16">
        <section className="text-center max-w-3xl mx-auto mb-10 animate-fade-in">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="h-3 w-3" /> Try it free — no signup
          </span>
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="neon-text">Sing</span> the chorus.
            <br className="hidden sm:inline" /> Speak the language.
          </h1>
          <p className="text-lg text-muted-foreground">
            Hit play on a real Bad Bunny chorus. Tap any word for instant pronunciation
            and English meaning — that's the whole product, right here.
          </p>
        </section>

        <section className="grid lg:grid-cols-5 gap-6 mb-16">
          {/* Video preview */}
          <Card className="glass lg:col-span-3 overflow-hidden p-0">
            <div className="relative aspect-video bg-black">
              {!playing && (
                <img
                  src={`https://i.ytimg.com/vi/${PREVIEW.youtubeId}/hqdefault.jpg`}
                  alt={`${PREVIEW.title} by ${PREVIEW.artist} — video preview`}
                  width={1280}
                  height={720}
                  fetchPriority="high"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none" />
              {!playing && (
                <button
                  type="button"
                  onClick={play}
                  aria-label={`Play 10-second preview of ${PREVIEW.title}`}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-black/55 via-black/65 to-black/80 hover:from-black/45 hover:via-black/55 hover:to-black/70 transition-colors group"
                >
                  <span className="h-20 w-20 rounded-full bg-primary flex items-center justify-center shadow-soft-lg group-hover:scale-110 transition-transform">
                    <Play className="h-9 w-9 text-primary-foreground fill-primary-foreground ml-1" />
                  </span>
                  <span className="text-white font-semibold text-lg drop-shadow-md">{PREVIEW.title}</span>
                  <span className="text-white text-sm drop-shadow-md">{PREVIEW.artist} · 10s preview</span>
                </button>
              )}
              {playing && (
                <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase animate-pulse">
                  Live · 10s
                </div>
              )}
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{PREVIEW.title}</p>
                <p className="text-sm text-muted-foreground">{PREVIEW.artist}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" /> Auto-stops at 10s
              </span>
            </div>
          </Card>

          {/* Interactive lyrics */}
          <Card className="glass lg:col-span-2 p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
              <Languages className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Tap any word</span>
            </div>
            <div className="space-y-4 mb-4">
              {PREVIEW.lines.map((line, li) => (
                <p key={li} className="text-base md:text-lg font-medium leading-relaxed">
                  {line.split(/\s+/).map((w, wi) => {
                    const c = cleanWord(w);
                    const has = Boolean(GLOSSARY[c]);
                    return (
                      <button
                        key={wi}
                        type="button"
                        disabled={!has}
                        onClick={() => has && setSelectedWord(c)}
                        className={`inline-block mr-1 px-1.5 py-0.5 rounded-md transition-all ${
                          has
                            ? "hover:bg-primary/15 hover:text-primary cursor-pointer"
                            : "opacity-70 cursor-default"
                        } ${selectedWord === c ? "bg-primary text-primary-foreground" : ""}`}
                      >
                        {w}
                      </button>
                    );
                  })}
                </p>
              ))}
            </div>
            <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 min-h-[120px]">
              {selectedWord && GLOSSARY[selectedWord] ? (
                <div className="space-y-2 animate-fade-in">
                  <p className="text-2xl font-bold capitalize neon-text">{selectedWord}</p>
                  <p className="text-sm">
                    <span className="text-xs uppercase tracking-wider font-semibold mr-2 text-muted-foreground">Sounds like</span>
                    <span className="italic">{GLOSSARY[selectedWord].pron}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-xs uppercase tracking-wider font-semibold mr-2 text-muted-foreground">English</span>
                    <span>{GLOSSARY[selectedWord].en}</span>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click on a highlighted word above to see how it sounds and what it means.
                </p>
              )}
            </div>
          </Card>
        </section>

        <section className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Ready for the whole song?
          </h2>
          <p className="text-muted-foreground mb-6">
            Sign in to unlock the full catalog, save vocabulary, run lyric quizzes,
            and track your CEFR progress as you go.
          </p>
          <Button size="lg" onClick={() => setSigninOpen(true)} className="bg-gradient-neon animate-gradient text-background font-semibold">
            Continue with Google
          </Button>
        </section>
      </main>

      <Dialog open={signinOpen} onOpenChange={setSigninOpen}>
        <DialogContent className="max-w-md neon-border-pink">
          <DialogHeader>
            <div className="h-14 w-14 rounded-2xl bg-gradient-neon animate-gradient flex items-center justify-center shadow-soft-lg mx-auto mb-3">
              <Music className="h-7 w-7 text-primary-foreground" />
            </div>
            <DialogTitle className="text-center text-2xl neon-text">
              Want to unlock the full song?
            </DialogTitle>
            <DialogDescription className="text-center">
              Sign in with Google instantly to keep playing, save the words you tapped,
              and start learning Spanish through the music you actually love.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={handleGoogle}
            disabled={signingIn}
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 font-semibold"
          >
            {signingIn ? "Opening Google…" : "Continue with Google"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            No spam. No credit card. Free forever for learners.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Landing;
