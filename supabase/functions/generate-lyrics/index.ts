// Given a YouTube video (title + youtube_id), use Lovable AI to generate
// full lyrics, Hebrew + English translations, chorus markings, and estimated timestamps.
// Then create a new song row + lyric_lines.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a Spanish-language music expert helping a Hebrew-speaking learner.
Given a song's title, artist, and approximate duration, produce its full lyrics with translations and timing estimates.

Rules:
- Output 25-50 lines total covering verses, pre-chorus and chorus.
- Each line is one short Spanish lyric line.
- "is_chorus" must be true ONLY for repeated hook/chorus lines.
- Distribute "start_seconds" and "end_seconds" sensibly across the song duration.
- The first chorus typically starts ~25-40% into the song.
- "english_translation" should be natural English, not literal.
- "hebrew_translation" should be natural Hebrew using Hebrew script.
- Genre is one of: "reggaeton", "bachata", "pop latino", "trap latino", "merengue", "salsa".
- difficulty is one of: "beginner", "intermediate", "advanced".`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "save_song",
    description: "Save a song with its lyrics, translations, and timestamps.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        artist: { type: "string" },
        genre: { type: "string", enum: ["reggaeton", "bachata", "pop latino", "trap latino", "merengue", "salsa"] },
        difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              spanish_text: { type: "string" },
              hebrew_translation: { type: "string" },
              english_translation: { type: "string" },
              start_seconds: { type: "number" },
              end_seconds: { type: "number" },
              is_chorus: { type: "boolean" },
            },
            required: ["spanish_text", "hebrew_translation", "english_translation", "start_seconds", "end_seconds", "is_chorus"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "artist", "genre", "difficulty", "lines"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { youtube_id, title, channel, thumbnail, duration_seconds } = body ?? {};
    if (!youtube_id || !title) {
      return new Response(JSON.stringify({ error: "youtube_id and title are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // If song already exists for this youtube_id, return it
    const { data: existing } = await supabase.from("songs").select("id").eq("youtube_id", youtube_id).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ song_id: existing.id, existed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = `YouTube title: "${title}"
Channel: ${channel ?? "unknown"}
Approx duration: ${duration_seconds ?? 210} seconds

Extract the song title and artist from the YouTube title (strip "(Audio)", "Official Video", etc.). Generate full lyrics with chorus markings and reasonable timestamps that fit within the duration.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "save_song" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again soon." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Lovable AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return a tool call");
    const parsed = JSON.parse(toolCall.function.arguments);

    const { data: song, error: songErr } = await supabase
      .from("songs")
      .insert({
        title: parsed.title,
        artist: parsed.artist,
        genre: parsed.genre,
        difficulty: parsed.difficulty,
        youtube_id,
        album_art_url: thumbnail ?? null,
      })
      .select("id")
      .single();
    if (songErr) throw songErr;

    const rows = parsed.lines.map((l: any, i: number) => ({
      song_id: song.id,
      line_index: i,
      spanish_text: l.spanish_text,
      hebrew_translation: l.hebrew_translation,
      english_translation: l.english_translation,
      start_seconds: l.start_seconds,
      end_seconds: l.end_seconds,
      is_chorus: l.is_chorus,
    }));
    const { error: linesErr } = await supabase.from("lyric_lines").insert(rows);
    if (linesErr) throw linesErr;

    return new Response(JSON.stringify({ song_id: song.id, existed: false, lines_count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lyrics error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
