import { supabase } from "@/integrations/supabase/client";

export type StreakResult = {
  current_streak: number;
  longest_streak: number;
  last_practice_date: string;
  changed: boolean;
};

const ALLOWED_REASONS = ["quiz_completed"] as const;
type TouchReason = (typeof ALLOWED_REASONS)[number];

/**
 * Update the user's daily practice streak.
 *
 * IMPORTANT: per product rules, this MUST only be invoked when a user
 * COMPLETES a quiz. It must NOT fire on song-page load, lyrics scroll,
 * or any passive interaction. The `reason` argument is required and is
 * logged so we can audit every call site from the browser console.
 */
export async function touchStreak(reason: TouchReason = "quiz_completed"): Promise<StreakResult | null> {
  if (!ALLOWED_REASONS.includes(reason)) {
    console.error(`[streak] BLOCKED touch_streak call with disallowed reason="${reason}"`);
    return null;
  }

  // Audit log: caller + stack so we can verify only quiz completion triggers this.
  const stack = new Error().stack?.split("\n").slice(2, 5).join("\n  ");
  console.info(`[streak] touch_streak invoked — reason=${reason}\n  ${stack ?? "(no stack)"}`);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const startedAt = performance.now();
  const { data, error } = await supabase.functions.invoke("touch-streak", {
    body: { tz, reason },
  });
  const ms = Math.round(performance.now() - startedAt);

  if (error) {
    console.warn(`[streak] touch_streak FAILED (${ms}ms) reason=${reason}`, error);
    return null;
  }
  console.info(`[streak] touch_streak OK (${ms}ms) reason=${reason}`, data);
  window.dispatchEvent(new CustomEvent("streak-updated", { detail: data }));
  return data as StreakResult;
}
