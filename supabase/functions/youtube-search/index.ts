// Search YouTube for songs (Audio-Only versions preferred)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated caller to protect YouTube API quota
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { q } = await req.json();
    if (!q || typeof q !== "string" || q.length < 2 || q.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid query" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) {
      console.error("youtube-search: YOUTUBE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bias toward official single-track uploads ("official audio" / "topic" channels)
    // and stay within YouTube's Music category to block non-music channels.
    const query = encodeURIComponent(`${q} official audio topic`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=10&q=${query}&key=${YOUTUBE_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const t = await resp.text();
      console.error("YouTube API error", resp.status, t);
      return new Response(JSON.stringify({ error: "YouTube search failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const raw = (data.items ?? []).map((it: any) => ({
      youtube_id: it.id.videoId,
      title: it.snippet.title,
      channel: it.snippet.channelTitle,
      thumbnail: it.snippet.thumbnails?.medium?.url ?? it.snippet.thumbnails?.default?.url,
      published_at: it.snippet.publishedAt,
    })).filter((r: any) => r.youtube_id);

    // Blocklist: compilations, award shows, full albums, playlists, mixes — not single tracks.
    const BLOCK = [
      "awards", "nominees", "billboard", "full album", "álbum completo", "album completo",
      "playlist", "mix", "compilation", "compilación", "mega mix", "megamix",
      "top 100", "top 50", "top 40", "top 20", "top 10", "best of", "lo mejor de",
      "1 hour", "2 hours", "live stream", "tribute", "homenaje",
    ];
    const isBlocked = (r: any) => {
      const hay = `${r.title} ${r.channel}`.toLowerCase();
      return BLOCK.some((w) => hay.includes(w));
    };
    // Drop blocked entries from the first 3 positions; keep the rest as-is at the tail
    // so the next closest single-track match floats to the top.
    const head = raw.slice(0, 3);
    const tail = raw.slice(3);
    const cleanHead = head.filter((r: any) => !isBlocked(r));
    const skippedHead = head.filter((r: any) => isBlocked(r));
    const results = [...cleanHead, ...tail, ...skippedHead];


    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("youtube-search error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
