// record-vocab: the single server-side entry point for mutating
// user_vocab_stats.correct_count / fail_count / is_mastered.
//
// Direct client writes to those columns are revoked at the SQL grant layer,
// so all progression mutations must funnel through this edge function.
// Each action represents one legitimate, server-bounded game event so the
// magnitude of any single forged call is capped.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WORD_RE = /^[\p{L}\p{M}\-' ]{1,60}$/u;

type Action =
  | { type: "quiz_attempt"; word: string; is_correct: boolean }
  | { type: "review_correct"; stat_id: string }
  | { type: "review_wrong"; stat_id: string }
  | { type: "mark_mastered"; stat_id: string }
  | { type: "track_reveal"; word: string };

function parseAction(body: any): Action | { error: string } {
  const type = String(body?.type ?? "");
  switch (type) {
    case "quiz_attempt": {
      const word = String(body?.word ?? "").trim().toLowerCase();
      if (!WORD_RE.test(word)) return { error: "invalid word" };
      return { type, word, is_correct: !!body?.is_correct };
    }
    case "track_reveal": {
      const word = String(body?.word ?? "").trim().toLowerCase();
      if (!WORD_RE.test(word)) return { error: "invalid word" };
      return { type, word };
    }
    case "review_correct":
    case "review_wrong":
    case "mark_mastered": {
      const stat_id = String(body?.stat_id ?? "");
      if (!UUID_RE.test(stat_id)) return { error: "invalid stat_id" };
      return { type, stat_id } as Action;
    }
    default:
      return { error: "unsupported type" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const parsed = parseAction(body);
    if ("error" in parsed) return json({ error: parsed.error }, 400);

    const admin = createClient(url, service);
    const now = new Date().toISOString();

    // --- word-keyed actions: upsert by (user_id, word) ----------------------
    if (parsed.type === "quiz_attempt" || parsed.type === "track_reveal") {
      const word = parsed.word;
      const { data: existing, error: selErr } = await admin
        .from("user_vocab_stats")
        .select("id, correct_count, fail_count, is_mastered")
        .eq("user_id", userId)
        .eq("word", word)
        .maybeSingle();
      if (selErr) return json({ error: "lookup failed" }, 500);

      let correct_count = existing?.correct_count ?? 0;
      let fail_count = existing?.fail_count ?? 0;

      if (parsed.type === "quiz_attempt") {
        if (parsed.is_correct) correct_count += 1;
        else fail_count += 1;
      } else {
        // a 2nd reveal in roleplay → counts as one miss
        fail_count += 1;
      }

      if (existing) {
        const { error } = await admin
          .from("user_vocab_stats")
          .update({ correct_count, fail_count, last_reviewed: now })
          .eq("id", existing.id);
        if (error) return json({ error: "update failed" }, 500);
        return json({ ok: true, id: existing.id, correct_count, fail_count });
      }
      const { data: ins, error: insErr } = await admin
        .from("user_vocab_stats")
        .insert({ user_id: userId, word, correct_count, fail_count, last_reviewed: now })
        .select("id")
        .maybeSingle();
      if (insErr || !ins) return json({ error: "insert failed" }, 500);
      return json({ ok: true, id: ins.id, correct_count, fail_count });
    }

    // --- stat_id-keyed actions: must belong to caller -----------------------
    const { data: row, error: rowErr } = await admin
      .from("user_vocab_stats")
      .select("id, user_id, word, correct_count, fail_count, is_mastered")
      .eq("id", parsed.stat_id)
      .maybeSingle();
    if (rowErr) return json({ error: "lookup failed" }, 500);
    if (!row || row.user_id !== userId) return json({ error: "not found" }, 404);

    let correct_count = row.correct_count;
    let fail_count = row.fail_count;

    if (parsed.type === "review_correct") {
      correct_count += 1;
      fail_count = Math.max(0, fail_count - 1);
    } else if (parsed.type === "review_wrong") {
      fail_count += 1;
    } else {
      // mark_mastered: only allowed when the user has previously missed it
      // (i.e. it's actually a Review Room flashcard, not an arbitrary word).
      if (row.fail_count <= 0 && row.is_mastered) {
        return json({ ok: true, id: row.id, already_mastered: true });
      }
      correct_count = Math.max(correct_count, 3);
      fail_count = 0;
    }

    const { error: upErr } = await admin
      .from("user_vocab_stats")
      .update({ correct_count, fail_count, last_reviewed: now })
      .eq("id", row.id);
    if (upErr) return json({ error: "update failed" }, 500);

    // Re-read so the client sees the trigger-computed is_mastered.
    const { data: after } = await admin
      .from("user_vocab_stats")
      .select("id, correct_count, fail_count, is_mastered")
      .eq("id", row.id)
      .maybeSingle();
    return json({ ok: true, ...(after ?? {}) });
  } catch (e) {
    console.error("record-vocab error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
