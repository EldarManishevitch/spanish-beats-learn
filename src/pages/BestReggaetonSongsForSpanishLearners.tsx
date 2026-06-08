import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, ArrowRight, Sparkles } from "lucide-react";

const SITE = "https://spanish-beats-learn.lovable.app";
const URL = `${SITE}/guides/best-reggaeton-songs-for-spanish-learners`;
const TITLE = "10 Best Reggaeton Songs to Learn Spanish in 2026";
const DESC =
  "The 10 best Reggaeton songs for Spanish learners — slow-enough hooks, clean slang, and choruses you'll actually remember. From Bad Bunny and Karol G to Daddy Yankee and Rauw Alejandro.";

type Pick = {
  rank: number;
  title: string;
  artist: string;
  level: "Beginner" | "Intermediate";
  slang: string;
  why: string;
};

const PICKS: Pick[] = [
  {
    rank: 1,
    title: "Tití Me Preguntó",
    artist: "Bad Bunny",
    level: "Intermediate",
    slang: "\"tití\" = auntie · \"jeva\" = girl",
    why: "A spoken-word verse over a slow Dembow groove. Bad Bunny's diction is unusually clean here, and the chorus is built on one repeated question, so the grammar sticks fast.",
  },
  {
    rank: 2,
    title: "TQG",
    artist: "Karol G & Shakira",
    level: "Beginner",
    slang: "\"TQG\" = te quedó grande (you couldn't handle me)",
    why: "Two singers, two accents — Colombian and Barranquilla — back to back. Lyrics are conversational present-tense, perfect for picking up everyday verbs (ver, salir, querer).",
  },
  {
    rank: 3,
    title: "Provenza",
    artist: "Karol G",
    level: "Beginner",
    slang: "\"bebecita\" = baby · \"linda\" = pretty",
    why: "Karol G enunciates every syllable on this one. The chorus loops 6 times and uses simple commands (ven, llama, dime) you'll actually use in conversation.",
  },
  {
    rank: 4,
    title: "Despacito",
    artist: "Luis Fonsi & Daddy Yankee",
    level: "Beginner",
    slang: "\"despacito\" = slowly · \"pasito a pasito\" = step by step",
    why: "The most famous Reggaeton song ever and the easiest to study — diminutives in every line teach you a core Spanish grammar pattern (–ito / –ita) without a textbook.",
  },
  {
    rank: 5,
    title: "Me Porto Bonito",
    artist: "Bad Bunny & Chencho Corleone",
    level: "Intermediate",
    slang: "\"me porto bonito\" = I'll behave · \"bellaco\" = horny/up to no good",
    why: "Puerto Rican slang heavy — perfect once you've mastered textbook Spanish and want the real island accent. Listen for the dropped final S (\"loh\" instead of \"los\").",
  },
  {
    rank: 6,
    title: "Gasolina",
    artist: "Daddy Yankee",
    level: "Beginner",
    slang: "\"a ella le gusta\" = she likes · \"dale\" = go for it / OK",
    why: "The song that launched the genre. The hook is 4 words long and the verses are short imperative phrases — the easiest Reggaeton track to sing along to from day one.",
  },
  {
    rank: 7,
    title: "Todo de Ti",
    artist: "Rauw Alejandro",
    level: "Beginner",
    slang: "\"todo de ti\" = everything about you",
    why: "Synth-pop Reggaeton with a slower-than-average BPM. Rauw's pronunciation is one of the clearest in the genre, and the love-song vocabulary (corazón, mirada, beso) is high-yield.",
  },
  {
    rank: 8,
    title: "Con Calma",
    artist: "Daddy Yankee & Snow",
    level: "Beginner",
    slang: "\"con calma\" = chill / take it easy",
    why: "Repetitive on purpose — the chorus is literally two words. Use it to drill the rolled R in \"calma\" and the soft Caribbean D in \"dale\".",
  },
  {
    rank: 9,
    title: "Mi Gente",
    artist: "J Balvin & Willy William",
    level: "Beginner",
    slang: "\"mi gente\" = my people · \"prende\" = light it up",
    why: "Almost the entire song is built from 20 words. Great early track for getting comfortable with possessives (mi, tu, su) and the imperative.",
  },
  {
    rank: 10,
    title: "Hawái",
    artist: "Maluma",
    level: "Intermediate",
    slang: "\"fingir\" = to fake · \"postureo\" = showing off",
    why: "A breakup ballad with a Reggaeton beat. The verses use the present tense to tell a complete story — ideal for jumping from beginner choruses to following narrative lyrics.",
  },
];

const ITEM_LIST_JSONLD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: TITLE,
  description: DESC,
  numberOfItems: PICKS.length,
  itemListElement: PICKS.map((p) => ({
    "@type": "ListItem",
    position: p.rank,
    name: `${p.title} — ${p.artist}`,
    description: p.why,
  })),
};

const ARTICLE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  description: DESC,
  mainEntityOfPage: URL,
  inLanguage: "en",
  about: ["Reggaeton", "Spanish learning", "Latin music"],
};

const BestReggaetonSongsForSpanishLearners = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESC} />
        <link rel="canonical" href={URL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESC} />
        <meta property="og:url" content={URL} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESC} />
        <script type="application/ld+json">{JSON.stringify(ITEM_LIST_JSONLD)}</script>
        <script type="application/ld+json">{JSON.stringify(ARTICLE_JSONLD)}</script>
      </Helmet>

      <main className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-6">
          ← Back to Ritmo
        </Link>

        <header className="mb-10">
          <Badge className="mb-3 bg-primary/15 text-primary hover:bg-primary/15">
            <Sparkles className="h-3 w-3 mr-1" /> Guide
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
            The 10 Best Reggaeton Songs to Learn Spanish
          </h1>
          <p className="text-lg text-muted-foreground">
            Hand-picked tracks with clean hooks, useful slang, and choruses you'll
            actually remember. Ranked roughly from easiest to hardest — start at #1
            and work your way down.
          </p>
        </header>

        <section className="space-y-5 mb-12">
          {PICKS.map((p) => (
            <Card key={p.rank} className="p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0 h-12 w-12 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center">
                  {p.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
                    <h2 className="text-xl md:text-2xl font-semibold">{p.title}</h2>
                    <span className="text-muted-foreground">— {p.artist}</span>
                    <Badge variant="secondary" className="ml-auto">{p.level}</Badge>
                  </div>
                  <p className="text-sm text-primary font-medium mb-2">
                    <Music className="inline h-3.5 w-3.5 mr-1" /> Slang to learn: {p.slang}
                  </p>
                  <p className="text-foreground/90">{p.why}</p>
                </div>
              </div>
            </Card>
          ))}
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-3">How we picked these</h2>
          <p className="text-foreground/90 mb-3">
            Every song on this list passes three filters: a hook that repeats at
            least four times (so the grammar sticks), clean enough enunciation that
            a beginner can actually catch the words, and slang that's common enough
            to use outside the song. Most lists rank by chart position — this one
            ranks by how fast each track will move your Spanish forward.
          </p>
          <p className="text-foreground/90">
            For the deeper slang glossary (perreo, bellaco, dale, jevita), see the{" "}
            <Link to="/reggaeton-slang-guide" className="text-primary underline">
              Reggaeton Slang Guide
            </Link>
            . For the underlying method — how many times to loop a chorus, when to
            translate, when to sing — see{" "}
            <Link to="/guides/how-to-learn-spanish-with-music" className="text-primary underline">
              How to Learn Spanish with Music
            </Link>
            .
          </p>
        </section>

        <section className="rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-background p-6 md:p-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Study these songs the smart way
          </h2>
          <p className="text-muted-foreground mb-5 max-w-xl mx-auto">
            Ritmo loads any Reggaeton track with synced lyrics, tap-to-translate
            words, and a per-section quiz so you actually remember the slang.
          </p>
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
            <Link to="/">
              Start a song <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </section>
      </main>
    </div>
  );
};

export default BestReggaetonSongsForSpanishLearners;
