// Re-runs the synced-lyric provider race for an already-cached song and, if
// any provider returns real timestamps, updates lyric_lines.start_seconds /
// end_seconds in place and flips songs.is_synced = true. Translation / line
// splitting is preserved.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  fetchLrclibLyrics,
  fetchNeteaseLrc,
  fetchMegalobizLrc,
  fetchSyairLrc,
  alignWithWhisper,
  mapTimestampsToLines,
  endSecondsForLine,
} from "../_shared/lyrics-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function sanitizeArtist(a: string): string {
  return (a || "")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*Topic\s*$/i, "")
    .replace(/\s*\(.*?\)\s*$/g, "")
    .trim();
}

// Per-user-per-song rate limit (in-memory, best-effort) to prevent abuse of
// the expensive Whisper alignment call and unconstrained writes to shared
// lyric content. One resync per song per user per 24h.
const RESYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const recentResyncs = new Map<string, number>();
function rateLimitHit(userId: string, songId: string): boolean {
  const key = `${userId}:${songId}`;
  const now = Date.now();
  const last = recentResyncs.get(key);
  if (last && now - last < RESYNC_COOLDOWN_MS) return true;
  recentResyncs.set(key, now);
  // opportunistic cleanup
  if (recentResyncs.size > 5000) {
    for (const [k, t] of recentResyncs) {
      if (now - t > RESYNC_COOLDOWN_MS) recentResyncs.delete(k);
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE || !SUPABASE_ANON_KEY || !LOVABLE_API_KEY) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const songId = String(body?.song_id ?? "").trim();
    if (!songId) return jsonResponse({ error: "song_id required" }, 400);

    const userId = userData.user.id;
    if (rateLimitHit(userId, songId)) {
      return jsonResponse({
        success: false,
        message: "You've already requested a resync for this song recently. Try again later.",
      }, 429);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: song, error: songErr } = await supabase
      .from("songs")
      .select("id, title, artist, youtube_id, is_synced")
      .eq("id", songId)
      .maybeSingle();
    if (songErr || !song) return jsonResponse({ error: "Song not found" }, 404);

    const { data: existingLines, error: linesErr } = await supabase
      .from("lyric_lines")
      .select("id, line_index, spanish_text, start_seconds, end_seconds")
      .eq("song_id", songId)
      .order("line_index");
    if (linesErr) {
      return jsonResponse({ error: "Failed to load lyric lines" }, 500);
    }
    if (!existingLines?.length) {
      // Benign: lyrics are still being generated. Return 200 so the client
      // doesn't surface this as an error in the progressive UI.
      return jsonResponse({ success: false, message: "Lyrics are still being generated. Try again in a moment." }, 200);
    }

    const title = song.title;
    const artist = sanitizeArtist(song.artist || "");

    const providers = [
      fetchLrclibLyrics(title, artist).then((r) => r ? { src: "lrclib", ...r } : null),
      fetchNeteaseLrc(title, artist).then((r) => r ? { src: "netease", ...r } : null),
      fetchMegalobizLrc(title, artist).then((r) => r ? { src: "megalobiz", ...r } : null),
    ];
    const results = await Promise.all(providers);
    const outcome = (src: string) =>
      results.some((r) => r?.src === src && r.synced.length > 0) ? "synced" :
      results.some((r) => r?.src === src) ? "plain" : "miss";
    console.log(
      `resync providers: lrclib=${outcome("lrclib")} netease=${outcome("netease")} megalobiz=${outcome("megalobiz")}`,
    );

    let syncedTimestamps: number[] = [];
    let sourceLabel = "none";
    const syncedHit = results.find((r) => r && r.synced.length > 0);
    if (syncedHit) {
      syncedTimestamps = syncedHit.synced.map((s) => s.time);
      sourceLabel = `${syncedHit.src}_synced`;
    }

    // 4th provider: whisper alignment using whichever plain text we have
    // (existing AI-translated Spanish from the DB, or fresh plain text).
    if (syncedTimestamps.length === 0 && song.youtube_id) {
      const plain = (syncedHit ?? results.find((r) => !!r))?.plain
        ?? existingLines.map((l) => l.spanish_text).join("\n");
      const aligned = await alignWithWhisper(song.youtube_id, plain, LOVABLE_API_KEY);
      if (aligned && aligned.synced.length > 0) {
        syncedTimestamps = aligned.synced.map((s) => s.time);
        sourceLabel = "whisper_aligned";
        console.log("resync whisper alignment hit:", aligned.synced.length, "lines");
      }
    }

    if (syncedTimestamps.length === 0) {
      return jsonResponse({
        success: false,
        message: "No synced lyrics found for this track. Try again later or check the title/artist.",
      });
    }

    // Map onto existing translated lines
    const sorted = [...existingLines].sort((a, b) => a.line_index - b.line_index);
    const starts = mapTimestampsToLines(syncedTimestamps, sorted.length);
    const updates = sorted.map((line, i) => {
      const start = starts[i];
      const nextStart = i < sorted.length - 1 ? starts[i + 1] : Infinity;
      const end = endSecondsForLine(start, line.spanish_text, nextStart);
      return { id: line.id, start_seconds: start, end_seconds: end };
    });

    // Update lyric_lines individually (small N, single-batch ok via RPC would be nicer).
    for (const u of updates) {
      const { error } = await supabase
        .from("lyric_lines")
        .update({ start_seconds: u.start_seconds, end_seconds: u.end_seconds })
        .eq("id", u.id);
      if (error) {
        console.error("lyric_lines update failed:", error);
        return jsonResponse({ error: "Failed to update timestamps" }, 500);
      }
    }
    await supabase.from("songs").update({ is_synced: true }).eq("id", songId);

    return jsonResponse({
      success: true,
      source: sourceLabel,
      updated_lines: updates.length,
    });
  } catch (e) {
    console.error("resync-lyrics error:", e instanceof Error ? e.message : e);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
