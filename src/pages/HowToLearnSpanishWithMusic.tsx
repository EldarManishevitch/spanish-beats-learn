import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, Headphones, Repeat, BookOpen, Sparkles, Mic, ArrowRight } from "lucide-react";

const SITE = "https://spanish-beats-learn.lovable.app";
const URL = `${SITE}/guides/how-to-learn-spanish-with-music`;
const TITLE = "How to Learn Spanish with Music — A Practical Guide";
const DESC =
  "A step-by-step guide to learning Spanish through Reggaeton, Bachata, and Latin pop. Why songs beat textbooks, how to study lyrics, and the best genres to start with.";

const STEPS = [
  {
    icon: Headphones,
    title: "1. Pick a song you actually like",
    body: "Motivation beats method. Start with a Reggaeton hook or a Bachata chorus that's been stuck in your head — Bad Bunny, Romeo Santos, Karol G, Aventura. If the song bores you, you won't repeat it; repetition is the whole point.",
  },
  {
    icon: Repeat,
    title: "2. Loop the chorus, not the whole track",
    body: "Choruses repeat 4–6 times per song with the simplest grammar in the lyric. Loop just the chorus 5–10 times before you ever look at a translation. Your ear maps the sounds first; meaning lands faster afterward.",
  },
  {
    icon: BookOpen,
    title: "3. Read the lyrics in Spanish first",
    body: "Open the lyrics in Spanish only. Sound out every word out loud — even if you don't know what it means. This builds pronunciation muscle memory before English gets in the way.",
  },
  {
    icon: Sparkles,
    title: "4. Translate line-by-line, not word-by-word",
    body: "Reggaeton and Bachata lean on idioms (\"perreo\", \"tírame\", \"baby tranquila\") that don't translate one-to-one. Get the sense of each line, mark 2–3 words you want to remember, and move on.",
  },
  {
    icon: Mic,
    title: "5. Sing along, badly, on purpose",
    body: "Singing forces the mouth shapes Spanish actually needs — the rolled R, the soft D, the dropped final S in Caribbean accents. Karaoke is the fastest pronunciation drill ever invented.",
  },
  {
    icon: Music,
    title: "6. Stack a new song every 3–4 days",
    body: "One song mastered is more useful than ten songs half-learned. Add a new track only when you can sing the previous chorus from memory without the lyrics in front of you.",
  },
];

const GENRES = [
  {
    name: "Reggaeton",
    why: "Repetitive hooks, conversational slang, slow-medium tempo. Bad Bunny and Karol G are the gateway.",
    start: "\"Tití Me Preguntó\" · \"PROVENZA\" · \"Yonaguni\"",
  },
  {
    name: "Bachata",
    why: "Romantic storytelling, clear enunciation, slower tempo than reggaeton. Romeo Santos and Aventura over-articulate every word — perfect for learners.",
    start: "\"Propuesta Indecente\" · \"Obsesión\" · \"Eres Mía\"",
  },
  {
    name: "Latin Pop",
    why: "Cleaner studio vocals and more standard Spanish — fewer regional slang traps. Shakira, Camilo, Rosalía.",
    start: "\"Vivir Mi Vida\" · \"Tutu\" · \"DESPECHÁ\"",
  },
];

const FAQ = [
  {
    q: "How long until I see results?",
    a: "Most learners can sing one full chorus correctly within a week and recognize ~50 new words within a month — assuming you loop the same 3–5 songs daily.",
  },
  {
    q: "Is Reggaeton too explicit to learn from?",
    a: "Some tracks are. Plenty aren't — and even the explicit ones teach real spoken Spanish that textbooks skip. Pick songs that match your comfort level.",
  },
  {
    q: "Do I need to understand every word?",
    a: "No. Aim for the gist of each line plus 2–3 vocabulary words you commit to memory. That's how native speakers acquired their first language too.",
  },
  {
    q: "Should I start with Spain Spanish or Latin American Spanish?",
    a: "Latin American — specifically Caribbean (Puerto Rico, Dominican Republic, Colombia) — because that's where most modern Spanish-language music comes from. The accent is musical and the vocabulary is current.",
  },
];

const HowToLearnSpanishWithMusic = () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Learn Spanish with Music",
    description: DESC,
    step: STEPS.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title.replace(/^\d+\.\s*/, ""),
      text: s.body,
    })),
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESC} />
        <link rel="canonical" href={URL} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESC} />
        <meta property="og:url" content={URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESC} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
      </Helmet>

      <main className="container max-w-4xl py-10 md:py-16">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Ritmo</Link>
          <span className="mx-2">/</span>
          <span>Guides</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">How to learn Spanish with music</span>
        </nav>

        <header className="mb-10">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Guide · 6 min read</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            How to learn Spanish with music
          </h1>
          <p className="text-lg text-muted-foreground">
            Songs are the fastest way into spoken Spanish — they're repetitive, emotional, and full of the slang
            textbooks ignore. Here's how to actually study them.
          </p>
        </header>

        <section aria-labelledby="why" className="mb-12">
          <h2 id="why" className="text-2xl font-bold mb-4">Why music works (when classes don't)</h2>
          <p className="text-foreground/90 leading-relaxed mb-3">
            A typical reggaeton chorus repeats the same 15–20 words four to six times in three minutes.
            That's spaced repetition built into the format — the single most evidence-backed technique in
            language learning, smuggled in by a beat you'll voluntarily play on loop.
          </p>
          <p className="text-foreground/90 leading-relaxed">
            Bachata adds clarity: slower tempo, romantic storytelling, and singers who over-articulate every
            syllable. Between the two genres, you cover the rhythm of Caribbean Spanish — the accent most
            modern Latin music is sung in.
          </p>
        </section>

        <section aria-labelledby="steps" className="mb-12">
          <h2 id="steps" className="text-2xl font-bold mb-6">The six-step method</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.title} className="glass p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-semibold">{s.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </Card>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="genres" className="mb-12">
          <h2 id="genres" className="text-2xl font-bold mb-6">Where to start: three genres, ranked</h2>
          <div className="space-y-4">
            {GENRES.map((g) => (
              <Card key={g.name} className="glass p-5">
                <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
                  <h3 className="text-xl font-bold">{g.name}</h3>
                  <span className="text-xs text-muted-foreground">{g.start}</span>
                </div>
                <p className="text-foreground/90">{g.why}</p>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="ritmo" className="mb-12">
          <Card className="glass p-6 md:p-8 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <h2 id="ritmo" className="text-2xl font-bold mb-3">Doing this inside Ritmo</h2>
            <p className="text-foreground/90 mb-5">
              Ritmo turns the six-step method into one screen. Pick any Bachata or Reggaeton track, tap any word
              for instant pronunciation and English meaning, loop the chorus or any verse, and save the words
              you want to remember to a personal vocabulary deck that resurfaces them at the right time.
            </p>
            <Button asChild size="lg">
              <Link to="/">Try a song free <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </Card>
        </section>

        <section aria-labelledby="faq" className="mb-12">
          <h2 id="faq" className="text-2xl font-bold mb-6">FAQ</h2>
          <div className="space-y-4">
            {FAQ.map((f) => (
              <Card key={f.q} className="glass p-5">
                <h3 className="font-semibold mb-2">{f.q}</h3>
                <p className="text-muted-foreground">{f.a}</p>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="related" className="mb-4">
          <h2 id="related" className="text-2xl font-bold mb-4">Related guides</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link to="/reggaeton-slang-guide">
              <Card className="glass p-5 hover:border-primary/40 transition-colors">
                <h3 className="font-semibold mb-1">Reggaeton slang guide</h3>
                <p className="text-sm text-muted-foreground">The vocabulary every reggaeton lyric assumes you know.</p>
              </Card>
            </Link>
            <Link to="/dominican-slang-guide">
              <Card className="glass p-5 hover:border-primary/40 transition-colors">
                <h3 className="font-semibold mb-1">Dominican slang guide</h3>
                <p className="text-sm text-muted-foreground">Bachata is sung in Dominican Spanish. Here's the cheat sheet.</p>
              </Card>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
};

export default HowToLearnSpanishWithMusic;
