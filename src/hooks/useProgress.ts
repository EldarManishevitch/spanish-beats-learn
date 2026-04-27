import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Progress = {
  cefr_level: string;
  total_xp: number;
  unlocked_conversations: boolean;
  mastered_count: number;
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
      .select("cefr_level, total_xp, unlocked_conversations, mastered_count")
      .eq("id", user.id)
      .maybeSingle();
    if (data) setProgress(data as Progress);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const addXp = useCallback(async (amount: number) => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("total_xp")
      .eq("id", user.id)
      .maybeSingle();
    const next = (data?.total_xp ?? 0) + amount;
    await supabase.from("profiles").update({ total_xp: next }).eq("id", user.id);
    await refresh();
  }, [user, refresh]);

  const recompute = useCallback(async (): Promise<{ tier_changed: boolean; unlock_changed: boolean } | null> => {
    if (!user) return null;
    const { data, error } = await supabase.rpc("recompute_cefr" as any, { p_user_id: user.id });
    if (error) { console.error("recompute_cefr failed", error); return null; }
    await refresh();
    const r = data as any;
    return { tier_changed: !!r?.tier_changed, unlock_changed: !!r?.unlock_changed };
  }, [user, refresh]);

  return { progress, refresh, addXp, recompute };
};
