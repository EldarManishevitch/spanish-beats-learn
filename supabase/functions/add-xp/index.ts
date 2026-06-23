// redeploy: ensure section_completed event_type is registered
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Server-controlled XP amounts. Clients cannot choose the amount — they can
// only declare which legitimate event occurred. Each event is recorded in the
// xp_ledger table with a uniqueness rule so the same event cannot grant XP
// twice (e.g. replaying the request just no-ops).
const XP_RULES: Record<string, { amount: number; refRequired: boolean }> = {
  // ref_id = `${song_id}:${question_index}` — one award per quiz question
  quiz_correct: { amount: 5, refRequired: true },
  // ref_id = normalised word — one award per word ever mastered
  word_mastered: { amount: 25, refRequired: true },
  // ref_id = YYYY-MM-DD — one award per day
  roleplay_completed: { amount: 50, refRequired: true },
  // ref_id = `${song_id}:${section_id}` — one award per micro-section per song.
  // Drives the dopamine loop on the Song page.
  section_completed: { amount: 10, refRequired: true },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ValidationResult = { ok: true } | { ok: false; error: string };

// deno-lint-ignore no-explicit-any
async function validateRef(admin: any, userId: string, event_type: string, ref_id: string): Promise<ValidationResult> {
  switch (event_type) {
    case "roleplay_completed": {
      // ref_id is expected to be today's UTC date. Reject anything that is
      // not today — otherwise a client could mint 50 XP per fake date string.
      if (!DATE_RE.test(ref_id)) return { ok: false, error: "ref_id must be a YYYY-MM-DD date" };
      const today = new Date().toISOString().slice(0, 10);
      if (ref_id !== today) return { ok: false, error: "ref_id must match today's UTC date" };
      return { ok: true };
    }
    case "quiz_correct":
    case "section_completed": {
      // ref_id format `${song_id}:${something}` — song_id must be a real row.
      const [songId] = ref_id.split(":");
      if (!songId || !UUID_RE.test(songId)) return { ok: false, error: "ref_id must start with a valid song id" };
      const { data, error } = await admin.from("songs").select("id").eq("id", songId).maybeSingle();
      if (error) return { ok: false, error: "could not verify song" };
      if (!data) return { ok: false, error: "song not found" };
      return { ok: true };
    }
    case "word_mastered": {
      // The word must already be marked mastered for THIS user. Mastery is
      // computed server-side by a trigger on user_vocab_stats, so this check
      // can no longer be forged from the client.
      const word = ref_id.trim().toLowerCase();
      if (!word) return { ok: false, error: "ref_id required" };
      const { data, error } = await admin
        .from("user_vocab_stats")
        .select("id")
        .eq("user_id", userId)
        .eq("word", word)
        .eq("is_mastered", true)
        .maybeSingle();
      if (error) return { ok: false, error: "could not verify word mastery" };
      if (!data) return { ok: false, error: "word is not mastered yet" };
      return { ok: true };
    }
    default:
      return { ok: false, error: "unsupported event_type" };
  }
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const event_type = String(body?.event_type ?? "");
    const ref_id = body?.ref_id == null ? "" : String(body.ref_id);

    const rule = XP_RULES[event_type];
    if (!rule) return json({ error: "invalid event_type" }, 400);
    if (rule.refRequired && !ref_id) return json({ error: "ref_id required" }, 400);
    if (ref_id.length > 200) return json({ error: "ref_id too long" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    // ---------------------------------------------------------------------
    // Server-side ref_id validation. The XP ledger's uniqueness constraint
    // stops double-awards, but on its own it would still let an authenticated
    // client farm XP by calling this endpoint with thousands of unique fake
    // ref_ids. Each event type therefore has to prove the ref_id corresponds
    // to a real, server-observable action before we credit anything.
    // ---------------------------------------------------------------------
    const refValidation = await validateRef(admin, userId, event_type, ref_id);
    if (!refValidation.ok) return json({ error: refValidation.error }, 400);


    // Idempotent insert: if this event was already credited, do nothing.
    const { data: inserted, error: ledgerErr } = await admin
      .from("xp_ledger")
      .insert({ user_id: userId, event_type, ref_id, amount: rule.amount })
      .select("id")
      .maybeSingle();

    if (ledgerErr) {
      // 23505 = unique_violation → already awarded, treat as no-op
      // deno-lint-ignore no-explicit-any
      if ((ledgerErr as any).code === "23505") {
        const { data: profile } = await admin
          .from("profiles").select("total_xp").eq("id", userId).maybeSingle();
        return json({ total_xp: profile?.total_xp ?? 0, awarded: 0, duplicate: true });
      }
      console.error("ledger insert failed", ledgerErr);
      return json({ error: "ledger insert failed" }, 500);
    }

    if (!inserted) return json({ error: "ledger insert failed" }, 500);

    const { data: profile, error: pErr } = await admin
      .from("profiles").select("total_xp").eq("id", userId).maybeSingle();
    if (pErr) throw pErr;
    const next = (profile?.total_xp ?? 0) + rule.amount;
    const { error: uErr } = await admin
      .from("profiles").update({ total_xp: next }).eq("id", userId);
    if (uErr) throw uErr;

    return json({ total_xp: next, awarded: rule.amount });
  } catch (e) {
    console.error("add-xp error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
