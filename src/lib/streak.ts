import { supabase } from "@/integrations/supabase/client";

export type StreakResult = {
  current_streak: number;
  longest_streak: number;
  last_practice_date: string;
  changed: boolean;
};

export async function touchStreak(): Promise<StreakResult | null> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { data, error } = await supabase.rpc("touch_streak" as any, { p_tz: tz });
  if (error) {
    console.warn("touch_streak failed", error);
    return null;
  }
  window.dispatchEvent(new CustomEvent("streak-updated", { detail: data }));
  return data as StreakResult;
}
