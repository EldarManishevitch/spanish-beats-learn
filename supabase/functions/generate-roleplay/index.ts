import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You write a 5-turn Spanish dialogue for a learner roleplay.
Setting: ALWAYS Latin-cultural (Havana, Medellín, Santo Domingo, San Juan reggaeton clubs, beach in Cartagena, salsa class in Cali, etc.).
Examples of vibes: "Ordering a Mojito in Havana", "Meeting a fan at a Reggaeton concert", "Asking for directions to a Bachata club in Santo Domingo", "Flirting at the beach in Cartagena", "Buying a beer at the colmado".
The character speaks 5 lines, each with the user's expected reply.
Adapt vocabulary to the learner's CEFR level: A1 simple present-tense, A2 includes street slang, B1 fast informal reggaeton lingo.
Pronunciation = English-letter phonetics, hyphenated, CAPS on stressed syllable.
Return through the deliver_scenario tool.`;

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

    const { scenario_hint } = await req.json().catch(() => ({}));

    const { data: profile } = await supabase
      .from("profiles").select("cefr_level, unlocked_conversations").eq("id", user.id).maybeSingle();

    // Server-side feature gate
    if (!profile?.unlocked_conversations) {
      return new Response(JSON.stringify({ error: "Feature locked" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const cefr = profile?.cefr_level ?? "A1";

    const { data: mastered } = await supabase
      .from("user_vocab_stats")
      .select("word")
      .eq("user_id", user.id).eq("is_mastered", true)
      .order("last_reviewed", { ascending: false })
      .limit(50);
    const masteredWords = (mastered ?? []).map((m) => m.word).join(", ");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("generate-roleplay: LOVABLE_API_KEY missing");
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `CEFR level: ${cefr}\nWords I already know: ${masteredWords || "(none yet)"}\nScenario hint: ${scenario_hint || "surprise me"}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "deliver_scenario",
            description: "Return a 5-turn Spanish roleplay scenario.",
            parameters: {
              type: "object",
              properties: {
                scenario_title: { type: "string" },
                character_name: { type: "string" },
                location: { type: "string" },
                dialogue_steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      spanish_text: { type: "string" },
                      pronunciation: { type: "string" },
                      english_translation: { type: "string" },
                      suggested_reply: { type: "string" },
                    },
                    required: ["spanish_text", "pronunciation", "english_translation", "suggested_reply"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["scenario_title", "character_name", "location", "dialogue_steps"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "deliver_scenario" } },
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
    const payload = args ? JSON.parse(args) : null;
    if (!payload) return new Response(JSON.stringify({ error: "empty AI response" }), { status: 500, headers: corsHeaders });

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), { status: 500, headers: corsHeaders });
  }
});
