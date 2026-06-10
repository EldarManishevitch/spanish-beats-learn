import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, ArrowRight, Sparkles } from "lucide-react";

const SITE = "https://spanish-beats-learn.lovable.app";
const URL = `${SITE}/guides/best-bachata-songs-for-spanish-learners`;
const TITLE = "10 Best Bachata Songs to Learn Spanish in 2026";
const DESC =
  "10 Bachata tracks perfect for Spanish learners — clean enunciation, repetitive hooks, and Dominican slang from Romeo Santos, Aventura, and Juan Luis Guerra.";

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
    title: "Obsesión",
    artist: "Aventura",
    level: "Beginner",
    slang: "\"es solo una obsesión\" = it's just an obsession · \"jevita\" = girl",
    why: "The chorus loops the same four-line confession over and over — by the third repeat you're singing the conditional tense (\"sería\", \"daría\") without realizing it. The verses are slow enough to hear every dropped 's'.",
  },
  {
    rank: 2,
    title: "Propuesta Indecente",
    artist: "Romeo Santos",
    level: "Beginner",
    slang: "\"propuesta indecente\" = indecent proposal · \"vaina\" = thing",
    why: "Romeo's diction is the cleanest in the genre and the hook asks one direct question on repeat. Great for picking up the polite-question construction (\"¿te gustaría...?\") you'll actually use in real conversations.",
  },
  {
    rank: 3,
    title: "Burbujas de Amor",
    artist: "Juan Luis Guerra",
    level: "Beginner",
    slang: "\"burbujas\" = bubbles · \"pecera\" = fishbowl",
    why: "Juan Luis Guerra sings like a Spanish teacher — every syllable lands. The lyrics are poetic but built from concrete nouns, so beginners can follow the imagery without a translator.",
  },
  {
    rank: 4,
    title: "Eres Mía",
    artist: "Romeo Santos",
    level: "Beginner",
    slang: "\"eres mía\" = you are mine · \"chin\" = a little bit",
    
    why: "The chorus is two words repeated for emphasis — the easiest way to internalize the verb \"ser\" in second person. Bonus: a Dominican slang word (\"chin\") slipped into every verse.",
  },
  {
    rank: 5,
    title: "Bachata Rosa",
    artist: "Juan Luis Guerra",
    level: "Intermediate",
    slang: "\"te regalo\" = I gift you · \"una rosa\" = a rose",
    why: "Pure storytelling Bachata. The verses walk through a list of gifts (\"te regalo una rosa, te regalo mi cintura\") that drills the indirect-object pronoun \"te\" in context — one of the trickiest patterns for English speakers.",
  },
  {
    rank: 6,
    title: "Volví",
    artist: "Aventura & Bad Bunny",
    level: "Intermediate",
    slang: "\"volví\" = I came back · \"loco\" = man/dude",
    why: "Two accents back-to-back: Romeo's Dominican-Bronx and Bad Bunny's Puerto Rican. Same word, two pronunciations — the fastest way to train your ear for regional differences in the same song.",
  },
  {
    rank: 7,
    title: "Te Extraño",
    artist: "Xtreme",
    level: "Beginner",
    slang: "\"te extraño\" = I miss you · \"mi vida\" = my love",
    why: "The hook is the title repeated — once you learn how Spanish builds \"to miss\" (literally \"you extrange me\"), the rest of the song clicks. Slow tempo and a single emotion make it ideal early listening.",
  },
  {
    rank: 8,
    title: "Darte un Beso",
    artist: "Prince Royce",
    level: "Beginner",
    slang: "\"darte un beso\" = to give you a kiss · \"papi chulo\" = lover boy",
    why: "Prince Royce was raised in New York, so his Spanish is unusually clear for non-native ears. The chorus drills the infinitive construction (\"quiero darte\", \"voy a darte\") that's everywhere in spoken Spanish.",
  },
  {
    rank: 9,
    title: "Su Veneno",
    artist: "Aventura",
    level: "Intermediate",
    slang: "\"su veneno\" = her poison · \"deja eso\" = let it go",
    why: "Story-song format with a clear beginning, middle, and end — perfect for jumping from one-chorus listening to following narrative lyrics. Heavy on Dominican expressions you'll hear in DR street Spanish.",
  },
  {
    rank: 10,
    title: "Ojalá Que Llueva Café",
    artist: "Juan Luis Guerra",
    level: "Intermediate",
    slang: "\"ojalá\" = I hope / may it · \"llueva\" = (it) rains (subjunctive)",
    why: "The single best song to internalize the Spanish subjunctive. \"Ojalá\" forces a subjunctive verb after it, and the whole song is built on the pattern — by the end you've practiced 8 different conjugations.",
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
  about: ["Bachata", "Spanish learning", "Dominican music", "Romeo Santos", "Aventura"],
};

const BestBachataSongsForSpanishLearners = () => {
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
            The 10 Best Bachata Songs to Learn Spanish
          </h1>
          <p className="text-lg text-muted-foreground">
            Hand-picked Bachata tracks with clean enunciation, repetitive hooks,
            and Dominican slang you'll actually use. Ranked roughly from easiest
            to hardest — start at #1 and work your way down.
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
            Every Bachata on this list passes three filters: a hook that repeats
            at least four times (so the grammar sticks), enunciation clean enough
            that a beginner can catch the words despite the famous Dominican
            dropped 's', and slang or grammar that's common enough to use outside
            the song. Most lists rank by chart position — this one ranks by how
            fast each track will move your Spanish forward.
          </p>
          <p className="text-foreground/90">
            For the deeper Dominican vocabulary (vaina, jevita, qué lo qué, dímelo),
            see the{" "}
            <Link to="/dominican-slang-guide" className="text-primary underline">
              Dominican Slang Guide
            </Link>
            . For the underlying method — how many times to loop a chorus, when to
            translate, when to sing — see{" "}
            <Link to="/guides/how-to-learn-spanish-with-music" className="text-primary underline">
              How to Learn Spanish with Music
            </Link>
            . Prefer urban beats?{" "}
            <Link to="/guides/best-reggaeton-songs-for-spanish-learners" className="text-primary underline">
              Best Reggaeton Songs to Learn Spanish
            </Link>
            .
          </p>
        </section>

        <section className="rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-background p-6 md:p-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Study these Bachatas the smart way
          </h2>
          <p className="text-muted-foreground mb-5 max-w-xl mx-auto">
            Ritmo loads any Bachata track with synced lyrics, tap-to-translate
            words, and a per-section quiz so you actually remember the Dominican slang.
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

export default BestBachataSongsForSpanishLearners;
