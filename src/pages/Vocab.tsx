import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, Volume2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

type V = { id: string; word: string; hebrew: string; is_slang: boolean };

const Vocab = () => {
  const { user } = useAuth();
  const [vocab, setVocab] = useState<V[]>([]);

  const load = () => {
    if (!user) return;
    supabase.from("saved_vocab").select("id, word, hebrew, is_slang").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setVocab(data ?? []));
  };

  useEffect(load, [user]);

  const speak = (w: string) => {
    const u = new SpeechSynthesisUtterance(w);
    u.lang = "es-ES"; u.rate = 0.85;
    speechSynthesis.speak(u);
  };

  const remove = async (id: string) => {
    await supabase.from("saved_vocab").delete().eq("id", id);
    toast.success("Removed");
    load();
  };

  const slang = vocab.filter((v) => v.is_slang);
  const standard = vocab.filter((v) => !v.is_slang);

  const Section = ({ title, items, icon: Icon }: { title: string; items: V[]; icon: any }) => (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{title}</h2>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((v) => (
            <Card key={v.id} className="glass p-4 hover:shadow-neon-pink transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h4 className="font-bold text-lg capitalize">{v.word}</h4>
                  <p className="text-primary text-lg" dir="rtl">{v.hebrew}</p>
                </div>
                {v.is_slang && <Badge className="bg-accent text-accent-foreground">slang</Badge>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => speak(v.word)} className="flex-1">
                  <Volume2 className="h-3 w-3 mr-1" />Hear
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(v.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <AppLayout>
      <h1 className="text-4xl font-bold mb-2 neon-text">My Vocab</h1>
      <p className="text-muted-foreground mb-8">Words you've collected from songs.</p>

      {vocab.length === 0 ? (
        <Card className="glass p-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Open a song and click words to save them.</p>
        </Card>
      ) : (
        <>
          <Section title="Urban Slang" items={slang} icon={Sparkles} />
          <Section title="Standard Words" items={standard} icon={BookOpen} />
        </>
      )}
    </AppLayout>
  );
};

export default Vocab;
