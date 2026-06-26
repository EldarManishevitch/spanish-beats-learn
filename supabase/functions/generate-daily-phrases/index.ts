import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You generate 5 short, useful Spanish phrases for an English-speaking learner who is into Latin music and culture (reggaeton, bachata, salsa).
Each phrase must come from a Latin-life situation: at the club, ordering a drink, asking for a dance, greeting at the colmado, catching a guagua, flirting at the beach, ordering tacos, asking for directions, paying the bill, joining a domino game.
Return them via the deliver_phrases tool.
Pronunciation = English-letter phonetics, hyphenated by syllable, CAPS on stressed syllable (e.g., "Des-pah-SEE-toh").`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { force } = await req.json().catch(() => ({ force: false }));
    const today = new Date().toISOString().slice(0, 10);

    if (!force) {
      const { data: cached } = await supabase
        .from("daily_phrases_cache")
        .select("payload").eq("user_id", user.id).eq("date", today).maybeSingle();
      if (cached?.payload) {
        return new Response(JSON.stringify(cached.payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("generate-daily-phrases: LOVABLE_API_KEY missing");
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: "Give me today's 5 Latin-life phrases." },
        ],
        tools: [{
          type: "function",
          function: {
            name: "deliver_phrases",
            description: "Return 5 Spanish phrases.",
            parameters: {
              type: "object",
              properties: {
                phrases: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      situation: { type: "string" },
                      spanish_text: { type: "string" },
                      pronunciation: { type: "string" },
                      english_translation: { type: "string" },
                    },
                    required: ["situation", "spanish_text", "pronunciation", "english_translation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["phrases"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "deliver_phrases" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit, try later" }), { status: 429, headers: corsHeaders });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: corsHeaders });
      return new Response(JSON.stringify({ error: "AI failed" }), { status: 500, headers: corsHeaders });
    }

    const j = await aiRes.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const payload = args ? JSON.parse(args) : { phrases: [] };

    await supabase.from("daily_phrases_cache").upsert(
      { user_id: user.id, date: today, payload },
      { onConflict: "user_id,date" },
    );

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-daily-phrases error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
