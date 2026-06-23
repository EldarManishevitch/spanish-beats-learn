import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Settings = () => {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("18:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("notifications_enabled, notifications_time")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEnabled(!!data.notifications_enabled);
          setTime(data.notifications_time || "18:00");
        }
        setLoading(false);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ notifications_enabled: enabled, notifications_time: time })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save settings.");
      return;
    }
    try {
      localStorage.setItem(
        "ritmo:notifications",
        JSON.stringify({ enabled, time }),
      );
    } catch { /* ignore */ }
    toast.success("Notification preferences saved.");
  };

  return (
    <AppLayout>
      <Helmet>
        <title>Notification settings | Ritmo</title>
        <meta name="description" content="Choose when Ritmo nudges you to learn Spanish through Latin music." />
        <link rel="canonical" href="/settings" />
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="mb-8 animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          <Bell className="h-7 w-7 inline -mt-1 mr-2 text-primary" />
          Notifications
        </h1>
        <p className="text-muted-foreground">
          Get culturally-relevant nudges that match your music taste — not generic streak reminders.
        </p>
      </header>

      <Card className="glass p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="font-semibold mb-1">Daily learning reminder</h2>
            <p className="text-sm text-muted-foreground">
              We'll surface a short, context-aware tip — always a fresh surprise.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={loading}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        <div className="border-t border-border pt-5">
          <label className="flex items-center gap-2 text-sm font-semibold mb-2">
            <Clock className="h-4 w-4 text-primary" />
            Preferred time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!enabled || loading}
            className="px-3 py-2 rounded-lg border-2 border-border bg-card focus:outline-none focus:border-primary disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Tip: 6 PM lines up with people heading out — peak relevance for nightlife copy.
          </p>
        </div>

        <Button
          onClick={save}
          disabled={saving || loading}
          className="mt-6 bg-primary hover:bg-primary/90"
        >
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </Card>
    </AppLayout>
  );
};

export default Settings;
