import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Music, BookOpen, Heart } from "lucide-react";

type DRTerm = {
  term: string;
  contextual: string;
  literal: string;
  english: string;
  song?: { title: string; artist: string; line?: string; translation?: string };
  category: "slang" | "expression" | "romantic" | "filler";
};

const DR_TERMS: DRTerm[] = [
  {
    term: "vaina",
    contextual: "thing / stuff / situation",
    literal: "pod, sheath",
    english: "thing / whatever",
    category: "slang",
    song: { title: "Propuesta Indecente", artist: "Romeo Santos", line: "Esta vaina me tiene loco", translation: "This whole thing has me crazy" },
  },
  {
    term: "tíguere",
    contextual: "a sharp street-smart guy, sometimes a player",
    literal: "tiger",
    english: "dude / slick guy",
    category: "slang",
    song: { title: "Bachata Rosa", artist: "Juan Luis Guerra" },
  },
  {
    term: "jevita / jevo",
    contextual: "girlfriend / boyfriend, or an attractive girl/guy",
    literal: "—",
    english: "babe / cutie",
    category: "romantic",
    song: { title: "Obsesión", artist: "Aventura", line: "Esa jevita me trae loco", translation: "That girl drives me crazy" },
  },
  {
    term: "chin",
    contextual: "a little bit",
    literal: "—",
    english: "a tiny bit",
    category: "slang",
    song: { title: "Eres Mía", artist: "Romeo Santos", line: "Dame un chin de tu amor", translation: "Give me a little of your love" },
  },
  {
    term: "qué lo qué",
    contextual: "Dominican greeting — 'what's up?'",
    literal: "what (is) the what",
    english: "what's up / what's good",
    category: "expression",
    song: { title: "Volví", artist: "Aventura" },
  },
  {
    term: "dímelo",
    contextual: "tell me / what's up — Aventura's signature ad-lib",
    literal: "tell it to me",
    english: "talk to me",
    category: "filler",
    song: { title: "Almost every Aventura track", artist: "Aventura", line: "Dímelo, dímelo", translation: "Talk to me, talk to me" },
  },
  {
    term: "manín / manito",
    contextual: "bro, friend",
    literal: "little brother",
    english: "bro / dude",
    category: "slang",
    song: { title: "Inmortal", artist: "Aventura" },
  },
  {
    term: "concón",
    contextual: "the crispy rice at the bottom of the pot; metaphorically, the best part",
    literal: "crispy bottom rice",
    english: "the best part / the crunch",
    category: "slang",
  },
  {
    term: "fokin",
    contextual: "Anglicism of 'fucking' — heavy emphasis word",
    literal: "—",
    english: "fucking",
    category: "slang",
    song: { title: "El Malo", artist: "Aventura", line: "Yo soy el fokin malo", translation: "I'm the freaking bad guy" },
  },
  {
    term: "mi amor / mi vida",
    contextual: "my love / my life — staple Bachata terms of endearment",
    literal: "my love / my life",
    english: "babe / sweetheart",
    category: "romantic",
    song: { title: "Te Extraño", artist: "Xtreme" },
  },
  {
    term: "guapo",
    contextual: "In DR specifically: angry, pissed off (NOT 'handsome')",
    literal: "handsome (in standard Spanish)",
    english: "angry / heated",
    category: "slang",
  },
  {
    term: "fula",
    contextual: "US dollars, or money in general",
    literal: "—",
    english: "cash / bucks",
    category: "slang",
  },
  {
    term: "klk",
    contextual: "Texted version of 'qué lo qué' — universal DR greeting in chats",
    literal: "—",
    english: "wassup",
    category: "expression",
  },
  {
    term: "bregar",
    contextual: "to deal with, to handle a situation",
    literal: "to struggle / toil",
    english: "to deal with it",
    category: "slang",
    song: { title: "Hermanita", artist: "Aventura", line: "Hay que bregar con esto", translation: "We've got to deal with this" },
  },
  {
    term: "moreno / morena",
    contextual: "Affectionate term for a dark-skinned love interest, common in Bachata romance",
    literal: "dark one",
    english: "my dark beauty",
    category: "romantic",
    song: { title: "La Morena", artist: "Romeo Santos" },
  },
  {
    term: "jangueo",
    contextual: "hanging out, partying",
    literal: "from English 'hang'",
    english: "kicking it / partying",
    category: "slang",
    song: { title: "Yo No Sé Mañana", artist: "Luis Enrique" },
  },
  {
    term: "diablo",
    contextual: "exclamation of shock — 'damn!'",
    literal: "devil",
    english: "damn / wow",
    category: "filler",
  },
  {
    term: "deja eso",
    contextual: "drop it, stop it, leave it alone",
    literal: "leave that",
    english: "let it go",
    category: "expression",
    song: { title: "Su Veneno", artist: "Aventura", line: "Deja eso, mi vida", translation: "Let it go, my love" },
  },
  {
    term: "papi chulo",
    contextual: "good-looking guy, sometimes a smooth talker — used flirtatiously",
    literal: "pimp daddy",
    english: "hot guy / lover boy",
    category: "romantic",
  },
  {
    term: "loco",
    contextual: "Used like 'man' or 'dude' at end of sentences — also 'crazy'",
    literal: "crazy",
    english: "man / dude",
    category: "filler",
    song: { title: "Volví", artist: "Aventura", line: "Loco, esto no se acaba", translation: "Man, this isn't over" },
  },
  {
    term: "se fue la luz",
    contextual: "the power went out — recurring slice-of-life image in DR music",
    literal: "the light went away",
    english: "the power's out",
    category: "expression",
    song: { title: "Ojalá Que Llueva Café", artist: "Juan Luis Guerra" },
  },
  {
    term: "tato",
    contextual: "all good, OK — shortening of 'está todo'",
    literal: "—",
    english: "all good / cool",
    category: "filler",
  },
];

const CATEGORY_LABEL: Record<DRTerm["category"], string> = {
  slang: "Street slang",
  expression: "Expression",
  romantic: "Romantic / Bachata",
  filler: "Filler / Ad-lib",
};

const DominicanSlangGuide = () => {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return DR_TERMS;
    return DR_TERMS.filter((t) =>
      [t.term, t.contextual, t.literal, t.english, t.song?.title ?? "", t.song?.artist ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [q]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Dominican Slang in Bachata Lyrics — A Listener's Guide",
    description:
      "A searchable guide to Dominican Spanish slang heard in Bachata lyrics by Romeo Santos, Aventura, Juan Luis Guerra, and more — contextual meanings, literal meanings, English equivalents, and song examples.",
    inLanguage: "en",
    about: ["Dominican slang", "Bachata lyrics", "Dominican Spanish", "Romeo Santos", "Aventura"],
    author: { "@type": "Organization", name: "Ritmo" },
    publisher: { "@type": "Organization", name: "Ritmo" },
    mainEntityOfPage: "https://spanish-beats-learn.lovable.app/dominican-slang-guide",
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Dominican Slang in Bachata: A Listener's Guide | Ritmo</title>
        <meta name="description" content="Searchable guide to Dominican Spanish slang in Bachata lyrics by Romeo Santos, Aventura, and Juan Luis Guerra — meanings, English equivalents, and song examples." />
        <link rel="canonical" href="https://spanish-beats-learn.lovable.app/dominican-slang-guide" />
        <meta property="og:title" content="Dominican Slang in Bachata Lyrics: A Listener's Guide" />
        <meta property="og:description" content="Decode the Dominican slang you hear in Bachata — Romeo Santos, Aventura, Juan Luis Guerra, and more. Searchable, song-grounded reference." />
        <meta property="og:url" content="https://spanish-beats-learn.lovable.app/dominican-slang-guide" />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="border-b border-border bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-soft">
              <Music className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Ritmo</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/reggaeton-slang-guide" className="text-muted-foreground hover:text-foreground">Reggaeton slang</Link>
            <Link to="/auth"><Button size="sm">Learn with songs</Button></Link>
          </nav>
        </div>
      </header>

      <main className="container py-10 md:py-14 max-w-4xl">
        <article>
          <p className="text-sm uppercase tracking-widest text-accent mb-3">Bachata lyrics guide</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Dominican Slang in Bachata Lyrics: what Romeo, Aventura, and Juan Luis Guerra are actually saying
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Bachata isn't sung in textbook Spanish. It's sung in Dominican Spanish — fast, slangy, full of dropped 's' sounds and street vocabulary that even other Spanish speakers have to translate. If you've ever wondered what <em>"qué lo qué, mi jevita"</em> means, or why Romeo keeps saying <em>"dímelo"</em> between verses, this guide is for you.
          </p>

          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a word, phrase, song, or artist..."
              aria-label="Search Dominican slang terms"
              className="pl-11 h-12 text-base"
            />
          </div>

          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" /> The Dominican Bachata vocabulary
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((t) => (
                <Card key={t.term} className="p-5 shadow-soft hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-xl font-bold">{t.term}</h3>
                    <Badge variant="outline">{CATEGORY_LABEL[t.category]}</Badge>
                  </div>
                  <p className="text-sm mb-2"><strong className="text-primary">In context:</strong> {t.contextual}</p>
                  {t.literal && t.literal !== "—" && (
                    <p className="text-sm text-muted-foreground mb-2"><strong>Literally:</strong> {t.literal}</p>
                  )}
                  <p className="text-sm text-muted-foreground mb-2"><strong>English:</strong> {t.english}</p>
                  {t.song && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs uppercase tracking-wide text-accent mb-1">Heard in</p>
                      <p className="text-sm font-semibold">{t.song.title} — {t.song.artist}</p>
                      {t.song.line && <p className="text-sm italic mt-1">"{t.song.line}"</p>}
                      {t.song.translation && <p className="text-xs text-muted-foreground mt-1">{t.song.translation}</p>}
                    </div>
                  )}
                </Card>
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No matches. Try a different word.</p>
            )}
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Heart className="h-6 w-6 text-primary" /> Why Bachata Spanish is its own dialect
            </h2>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Dominican Spanish is famous for dropping the 's' at the end of syllables — <em>"¿cómo estás?"</em> becomes <em>"¿cómo'tá?"</em>. Bachata lyrics lean into that, plus a heavy dose of street vocabulary (<em>tíguere</em>, <em>jevita</em>, <em>vaina</em>) that you won't find in a Spanish class.
              </p>
              <p>
                Aventura especially blended Bronx English with Dominican Spanish — Anthony "Romeo" Santos famously sings <em>"dímelo"</em> as an ad-lib the way American rappers say <em>"yeah"</em> or <em>"uh"</em>. It's filler that signals the genre.
              </p>
              <p>
                Older Bachata (Juan Luis Guerra, Frank Reyes) leans more romantic and poetic. Newer Bachata (Romeo, Prince Royce) blends in urban slang from reggaeton and trap. Both share the Dominican core: <em>qué lo qué, mi amor, dímelo</em>.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">How to use this guide</h2>
            <ul className="space-y-3 text-base text-muted-foreground list-disc pl-6">
              <li><strong className="text-foreground">Listen for the dropped 's'.</strong> "Lo' muchacho'" is "los muchachos". Once you tune your ear, the lyrics get twice as easy.</li>
              <li><strong className="text-foreground">Don't translate word-by-word.</strong> <em>Qué lo qué</em> is "what's up", not "what the what". <em>Guapo</em> means angry, not handsome.</li>
              <li><strong className="text-foreground">Use the romantic phrases carefully.</strong> <em>Mi amor</em>, <em>mi vida</em>, <em>moreno/a</em> are sweet in a love song but can sound corny in everyday talk.</li>
              <li><strong className="text-foreground">Hear it in real songs.</strong> The fastest way to lock in Dominican slang is to learn it inside a Bachata you already love.</li>
            </ul>
          </section>

          <section className="rounded-2xl p-8 bg-gradient-to-br from-primary/10 via-accent/10 to-transparent border border-border">
            <h2 className="text-2xl font-bold mb-2">Learn Dominican Spanish from real Bachata</h2>
            <p className="text-muted-foreground mb-5">
              Ritmo turns Romeo Santos, Aventura, and Juan Luis Guerra tracks into interactive Spanish lessons — slang explained line-by-line as you listen.
            </p>
            <Link to="/auth"><Button size="lg">Start with a Bachata you love</Button></Link>
          </section>
        </article>
      </main>
    </div>
  );
};

export default DominicanSlangGuide;
