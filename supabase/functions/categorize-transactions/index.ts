import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are a spending categorization assistant. Categorize each credit card transaction based on the merchant name and description.

Categories (use exactly these keys):
- transport: Uber, Bolt, Taxi, Metro, Bus, Train, Fuel stations, Parking
- dining: Restaurants, Cafés, Bars, Fast food, Bakeries
- groceries: Supermarkets (Auchan, Continente, Lidl, Rewe, Edeka, etc.), Mini markets
- shopping: Clothing, Electronics, Amazon, El Corte Inglés, general retail
- entertainment: Cinema, Concerts, Spotify, Netflix, Games
- subscriptions: Recurring fixed-amount charges, memberships, insurance
- other: Anything that doesn't clearly fit the above categories

Respond ONLY with a JSON array: [{ "id": "...", "category": "..." }]
Match each input transaction by its id.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 500);
    }

    const { transactions } = await req.json();

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return jsonResponse({ error: "transactions array is required" }, 400);
    }

    const inputText = transactions
      .map((t: { id: string; merchant: string; description: string | null }) =>
        `{ "id": "${t.id}", "merchant": "${t.merchant}", "description": "${t.description || ''}" }`
      )
      .join("\n");

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            parts: [
              { text: `Categorize these transactions:\n${inputText}` },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", errText);
      return jsonResponse(
        { error: `Gemini API error: ${errText.slice(0, 500)}` },
        502,
      );
    }

    const geminiData = await geminiResponse.json();

    const textContent =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      return jsonResponse({ error: "No response from AI" }, 502);
    }

    const results: Array<{ id: string; category: string }> = JSON.parse(textContent);

    // Update transactions in database using service role
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const validCategories = new Set([
      "transport", "dining", "groceries", "shopping",
      "entertainment", "subscriptions", "other",
    ]);

    let updated = 0;
    for (const r of results) {
      if (!r.id || !r.category || !validCategories.has(r.category)) continue;

      const { error } = await adminClient
        .from("credit_card_transactions")
        .update({ category: r.category })
        .eq("id", r.id);

      if (!error) updated++;
    }

    return jsonResponse({ updated, total: results.length });
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
