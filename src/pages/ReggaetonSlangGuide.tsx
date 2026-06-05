import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Music, BookOpen, Sparkles, AlertTriangle } from "lucide-react";

type Slang = {
  id: string;
  term: string;
  contextual_meaning: string;
  literal_meaning: string | null;
  english_equivalent: string | null;
  example_usage: string | null;
  example_song_title: string | null;
  example_song_artist: string | null;
  lyrics_snippet: string | null;
  lyrics_snippet_translation: string | null;
  is_urban_slang: boolean;
};

const CURSE_WORDS: { term: string; meaning: string; intensity: "mild" | "strong" | "very strong"; note: string }[] = [
  { term: "coño", meaning: "Damn / shit", intensity: "mild", note: "Universally used as an exclamation of surprise or frustration. In Spain and the Caribbean it's the everyday filler curse." },
  { term: "joder", meaning: "To fuck / fuck!", intensity: "strong", note: "Heard constantly in reggaeton hooks. As an interjection it just means 'damn it'." },
  { term: "mierda", meaning: "Shit", intensity: "mild", note: "Same range of uses as in English — both literal and exclamatory." },
  { term: "puta", meaning: "Whore / bitch", intensity: "very strong", note: "Highly offensive when directed at someone. In slang phrases like '¡qué puta madre!' it's an intensifier, not a name." },
  { term: "cabrón", meaning: "Bastard / dude", intensity: "strong", note: "Can be an insult or, between friends, an affectionate 'dude'. Tone and region decide which." },
  { term: "pendejo", meaning: "Idiot / dumbass", intensity: "strong", note: "Mexican staple. Calling someone pendejo is a real insult, not playful." },
  { term: "carajo", meaning: "Hell / damn", intensity: "mild", note: "'Vete al carajo' = 'go to hell'. Common in Puerto Rican reggaeton ad-libs." },
  { term: "chingar", meaning: "To fuck / mess up", intensity: "very strong", note: "Mexico's most loaded verb — 'no chingues' ranges from 'no way' to 'don't mess with me'." },
  { term: "verga", meaning: "Dick", intensity: "very strong", note: "Literal meaning is vulgar, but 'a la verga' is a generic 'what the hell' across Mexico and Central America." },
  { term: "culero", meaning: "Asshole", intensity: "strong", note: "Stronger than pendejo. Common in Mexican and Central American lyrics." },
  { term: "hijo de puta", meaning: "Son of a bitch", intensity: "very strong", note: "Universally understood, universally strong. Shortened to 'HP' in lyrics and chats." },
  { term: "maldito", meaning: "Damn / damned", intensity: "mild", note: "Adjective form of a curse. 'Maldita sea' = 'damn it'." },
];

const ReggaetonSlangGuide = () => {
  const [slang, setSlang] = useState<Slang[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("slang_dictionary")
        .select("id, term, contextual_meaning, literal_meaning, english_equivalent, example_usage, example_song_title, example_song_artist, lyrics_snippet, lyrics_snippet_translation, is_urban_slang")
        .order("term", { ascending: true });
      setSlang((data ?? []) as Slang[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return slang;
    return slang.filter((s) =>
      [s.term, s.contextual_meaning, s.english_equivalent ?? "", s.literal_meaning ?? "", s.example_song_title ?? "", s.example_song_artist ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [slang, q]);

  const filteredCurses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return CURSE_WORDS;
    return CURSE_WORDS.filter((w) => `${w.term} ${w.meaning} ${w.note}`.toLowerCase().includes(needle));
  }, [q]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Reggaeton Slang & Spanish Curse Words — A Lyrics Guide",
    description: "A searchable guide to urban Spanish slang and curse words from reggaeton, Latin trap, and dembow lyrics. Includes contextual meanings, literal meanings, English equivalents, and song examples.",
    inLanguage: "en",
    about: ["Reggaeton slang", "Spanish curse words", "Latin music lyrics", "Urban Spanish"],
    author: { "@type": "Organization", name: "Ritmo" },
    publisher: { "@type": "Organization", name: "Ritmo" },
    mainEntityOfPage: "https://spanish-beats-learn.lovable.app/reggaeton-slang-guide",
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Reggaeton Slang & Spanish Curse Words: Lyrics Guide | Ritmo</title>
        <meta name="description" content="Searchable guide to reggaeton slang and Spanish curse words from Bad Bunny, Karol G, Daddy Yankee — meanings, English equivalents, and song examples." />
        <link rel="canonical" href="https://spanish-beats-learn.lovable.app/reggaeton-slang-guide" />
        <meta property="og:title" content="Reggaeton Slang & Spanish Curse Words: Lyrics Guide" />
        <meta property="og:description" content="A searchable dictionary of urban Spanish slang and curse words from reggaeton, Latin trap, and dembow lyrics." />
        <meta property="og:url" content="https://spanish-beats-learn.lovable.app/reggaeton-slang-guide" />
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
            <Link to="/" className="text-muted-foreground hover:text-foreground">Discover</Link>
            <Link to="/auth"><Button size="sm">Learn with songs</Button></Link>
          </nav>
        </div>
      </header>

      <main className="container py-10 md:py-14 max-w-4xl">
        <article>
          <p className="text-sm uppercase tracking-widest text-accent mb-3">Lyrics guide</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Reggaeton Slang & Spanish Curse Words: a guide to what they actually mean in the lyrics
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            If you've ever sung along to Bad Bunny, Karol G, Daddy Yankee, J Balvin, Rauw Alejandro, or Anuel AA and wondered what half the words mean, you're in the right place. Standard Spanish textbooks skip the slang. Reggaeton, Latin trap, and dembow are built on it. This is a searchable, song-grounded reference to the urban Spanish slang and curse words you'll hear in real lyrics — what they literally mean, what they actually mean in context, and how to read them in the line.
          </p>

          <div className="relative mb-10">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a word, a meaning, or a song…"
              aria-label="Search the slang dictionary"
              className="pl-9 h-12 text-base"
            />
          </div>

          <section aria-labelledby="why" className="mb-12">
            <h2 id="why" className="text-2xl font-bold mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Why reggaeton Spanish is its own dialect
            </h2>
            <p className="text-foreground/90 leading-relaxed mb-3">
              Most reggaeton was born in Puerto Rico, then absorbed influences from Panama, the Dominican Republic, Colombia, and Mexico. The vocabulary that ended up in the hooks isn't generic "Spanish" — it's a blend of Caribbean street slang, AAVE-style English loans ("flow", "blunt", "real"), and producer-room shorthand. A word like <em>perreo</em> has no clean translation; the closest English gets is "grinding to the beat", but in Puerto Rico it also names the entire dance style and, by extension, the genre.
            </p>
            <p className="text-foreground/90 leading-relaxed">
              That's why a literal translation of a reggaeton lyric usually misses the point. The dictionary below gives you both layers — the literal meaning so you can dissect the line, and the contextual meaning so you actually understand the song.
            </p>
          </section>

          <section aria-labelledby="slang" className="mb-14">
            <h2 id="slang" className="text-2xl font-bold mb-2 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Urban Spanish slang dictionary
            </h2>
            <p className="text-muted-foreground mb-6">
              {loading ? "Loading terms…" : `${filtered.length} term${filtered.length === 1 ? "" : "s"} from real reggaeton, trap, and dembow lyrics.`}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((s) => (
                <Card key={s.id} className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-xl font-bold">{s.term}</h3>
                    {s.is_urban_slang && <Badge variant="secondary" className="text-xs">urban</Badge>}
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    <span className="text-muted-foreground">Means:</span> {s.contextual_meaning}
                  </p>
                  {s.english_equivalent && (
                    <p className="text-sm text-foreground/80 mb-1">
                      <span className="text-muted-foreground">English equivalent:</span> {s.english_equivalent}
                    </p>
                  )}
                  {s.literal_meaning && (
                    <p className="text-sm text-foreground/70 mb-1">
                      <span className="text-muted-foreground">Literal:</span> {s.literal_meaning}
                    </p>
                  )}
                  {s.example_song_title && (
                    <p className="text-xs text-accent mt-3">
                      Heard in <span className="font-medium">"{s.example_song_title}"</span>
                      {s.example_song_artist ? ` — ${s.example_song_artist}` : ""}
                    </p>
                  )}
                  {s.lyrics_snippet && (
                    <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-sm italic text-foreground/80">
                      "{s.lyrics_snippet}"
                      {s.lyrics_snippet_translation && (
                        <span className="block not-italic text-xs text-muted-foreground mt-1">
                          {s.lyrics_snippet_translation}
                        </span>
                      )}
                    </blockquote>
                  )}
                </Card>
              ))}
              {!loading && filtered.length === 0 && (
                <p className="text-muted-foreground col-span-full">No slang terms matched "{q}".</p>
              )}
            </div>
          </section>

          <section aria-labelledby="curses" className="mb-14">
            <h2 id="curses" className="text-2xl font-bold mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Spanish curse words you'll hear in lyrics
            </h2>
            <p className="text-muted-foreground mb-6">
              Strong language is part of the genre. Knowing which words are actual insults vs. ambient swearing keeps you from misreading a verse — or accidentally insulting someone in conversation. Each entry shows roughly how strong it lands.
            </p>

            <div className="grid gap-3">
              {filteredCurses.map((w) => (
                <Card key={w.term} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="sm:w-44 shrink-0">
                    <h3 className="text-lg font-bold">{w.term}</h3>
                    <Badge
                      variant="outline"
                      className={
                        w.intensity === "very strong"
                          ? "border-destructive text-destructive mt-1"
                          : w.intensity === "strong"
                          ? "border-accent text-accent mt-1"
                          : "mt-1"
                      }
                    >
                      {w.intensity}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">
                      <span className="text-muted-foreground">Translates to:</span> {w.meaning}
                    </p>
                    <p className="text-sm text-foreground/80">{w.note}</p>
                  </div>
                </Card>
              ))}
              {filteredCurses.length === 0 && (
                <p className="text-muted-foreground">No curse words matched "{q}".</p>
              )}
            </div>
          </section>

          <section aria-labelledby="how-to-use" className="mb-14">
            <h2 id="how-to-use" className="text-2xl font-bold mb-3">How to actually use this guide while listening</h2>
            <ol className="list-decimal pl-5 space-y-2 text-foreground/90">
              <li>
                <strong>Read the chorus, not the verse first.</strong> Reggaeton hooks repeat the same 3–5 slang words. Lock those in and the rest of the song decodes itself.
              </li>
              <li>
                <strong>Always check both meanings.</strong> Literal tells you what a word came from; contextual tells you what it means in 2024. They're often opposite.
              </li>
              <li>
                <strong>Match the artist's country.</strong> Bad Bunny (PR), Peso Pluma (MX), Karol G (CO), and Romeo Santos (DR) pull from different slang pools. The same word can be friendly in one and an insult in another.
              </li>
              <li>
                <strong>Don't drop curse words into normal conversation.</strong> What scans as ambient swearing in a Bad Bunny verse will land as aggressive in a coffee shop.
              </li>
            </ol>
          </section>

          <section aria-labelledby="learn" className="bg-muted/40 rounded-2xl p-8 text-center">
            <h2 id="learn" className="text-2xl font-bold mb-2">Want to learn these words inside real songs?</h2>
            <p className="text-muted-foreground mb-5 max-w-xl mx-auto">
              Ritmo turns reggaeton, Latin trap, and dembow tracks into interactive Spanish lessons — line-by-line translations, pronunciation, and quizzes on the exact slang above.
            </p>
            <Link to="/auth">
              <Button size="lg">Start learning Spanish with songs</Button>
            </Link>
          </section>
        </article>
      </main>

      <footer className="border-t border-border mt-8">
        <div className="container py-6 text-sm text-muted-foreground flex flex-col sm:flex-row gap-2 justify-between">
          <span>© Ritmo — Spanish through music.</span>
          <Link to="/" className="hover:text-foreground">Back to Ritmo →</Link>
        </div>
      </footer>
    </div>
  );
};

export default ReggaetonSlangGuide;
