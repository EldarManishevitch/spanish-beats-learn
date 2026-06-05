import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Progress = {
  cefr_level: string;
  total_xp: number;
  unlocked_conversations: boolean;
  mastered_count: number;
  current_streak: number;
  longest_streak: number;
  last_practice_date: string | null;
};

export const TIER_NAMES: Record<string, string> = {
  A1: "Novice",
  A2: "Amigo",
  B1: "Duro",
};

export const useProgress = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Progress | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("cefr_level, total_xp, unlocked_conversations, mastered_count, current_streak, longest_streak, last_practice_date")
      .eq("id", user.id)
      .maybeSingle();
    if (data) setProgress(data as Progress);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handler = () => { refresh(); };
    window.addEventListener("streak-updated", handler);
    return () => window.removeEventListener("streak-updated", handler);
  }, [refresh]);

  const addXp = useCallback(async (amount: number) => {
    if (!user) return;
    const { error } = await supabase.functions.invoke("add-xp", { body: { amount } });
    if (error) { console.error("add-xp failed", error); return; }
    await refresh();
  }, [user, refresh]);

  const recompute = useCallback(async (): Promise<{ tier_changed: boolean; unlock_changed: boolean } | null> => {
    if (!user) return null;
    const { data, error } = await supabase.functions.invoke("recompute-cefr", { body: {} });
    if (error) { console.error("recompute_cefr failed", error); return null; }
    await refresh();
    const r = data as any;
    return { tier_changed: !!r?.tier_changed, unlock_changed: !!r?.unlock_changed };
  }, [user, refresh]);

  return { progress, refresh, addXp, recompute };
};
