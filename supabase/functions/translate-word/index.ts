import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated caller to prevent abuse of paid AI gateway
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

    const { word } = await req.json();
    if (!word || typeof word !== "string") {
      return new Response(JSON.stringify({ error: "word required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleaned = word
      .toLowerCase()
      .replace(/[¿¡!?.,;:""'()]/g, "")
      .trim();

    if (!cleaned) {
      return new Response(JSON.stringify({ error: "empty word" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. slang_dictionary (case-insensitive: term is stored lowercased)
    const { data: slang } = await supabase
      .from("slang_dictionary")
      .select("contextual_meaning, example_usage, is_urban_slang")
      .eq("term", cleaned)
      .maybeSingle();

    if (slang) {
      return new Response(JSON.stringify({
        word: cleaned,
        hebrew: slang.contextual_meaning,
        example: slang.example_usage,
        is_slang: true,
        source: "slang",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. translations_cache
    const { data: cached } = await supabase
      .from("translations_cache")
      .select("hebrew, pronunciation_hint")
      .eq("word", cleaned)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify({
        word: cleaned,
        hebrew: cached.hebrew,
        pronunciation_hint: cached.pronunciation_hint,
        is_slang: false,
        source: "cache",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. AI fallback
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You translate single Spanish words into Hebrew. Reply ONLY via the provided tool." },
          { role: "user", content: `Translate the Spanish word "${cleaned}" to Hebrew.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "translate",
            description: "Return Hebrew translation",
            parameters: {
              type: "object",
              properties: {
                hebrew: { type: "string", description: "Hebrew translation" },
                pronunciation_hint: { type: "string", description: "Phonetic Hebrew transliteration" },
              },
              required: ["hebrew", "pronunciation_hint"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "translate" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit, try again later" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!args?.hebrew) {
      return new Response(JSON.stringify({ error: "No translation" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // cache
    await supabase.from("translations_cache").upsert({
      word: cleaned,
      hebrew: args.hebrew,
      pronunciation_hint: args.pronunciation_hint,
    }, { onConflict: "word" });

    return new Response(JSON.stringify({
      word: cleaned,
      hebrew: args.hebrew,
      pronunciation_hint: args.pronunciation_hint,
      is_slang: false,
      source: "ai",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("translate-word error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
