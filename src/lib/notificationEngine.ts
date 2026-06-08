import { supabase } from "@/integrations/supabase/client";

// Curated, culturally-contextual notification copy. Kept server-side / internal
// only — never rendered in user-facing settings views. Order is intentional
// (index is the variant id stored in `profiles.last_sent_variant_id`).
export const NOTIFICATION_VARIANTS: readonly string[] = [
  "The weekend is near! Learn 3 key slang words from Romeo Santos' newest track before heading out to the club tonight 🕺🔥",
  "🌴 New Bad Bunny drop just landed. Decode the chorus in 60 seconds before your friends do.",
  "Karaoke night incoming? Master one Bachata chorus tonight and own the room 🎤",
  "Streak alert 🔥 — 90 seconds of lyrics keeps your streak alive and your Spanish sharp.",
  "Reggaeton recap: the 5 slang words from this week's top track, ready when you are.",
];

/**
 * Pick a random variant index from the pool, excluding `lastIndex` so the
 * same user never receives the same notification copy twice in a row.
 */
export function pickNextVariantIndex(
  poolSize: number,
  lastIndex: number | null | undefined,
): number {
  if (poolSize <= 0) return 0;
  if (poolSize === 1) return 0;

  let next = Math.floor(Math.random() * poolSize);
  if (lastIndex == null) return next;

  // Re-roll once if we landed on the previous variant. With pool > 1 this
  // guarantees a different message without biasing the distribution.
  if (next === lastIndex) {
    next = (next + 1 + Math.floor(Math.random() * (poolSize - 1))) % poolSize;
  }
  return next;
}

/**
 * Resolve the next notification message for a user and persist the choice
 * so future triggers don't repeat it.
 */
export async function getNextNotificationForUser(
  userId: string,
): Promise<{ index: number; message: string }> {
  const { data } = await supabase
    .from("profiles")
    .select("last_sent_variant_id")
    .eq("id", userId)
    .maybeSingle();

  const next = pickNextVariantIndex(
    NOTIFICATION_VARIANTS.length,
    (data as { last_sent_variant_id: number | null } | null)?.last_sent_variant_id ?? null,
  );

  await supabase
    .from("profiles")
    .update({ last_sent_variant_id: next })
    .eq("id", userId);

  return { index: next, message: NOTIFICATION_VARIANTS[next] };
}
