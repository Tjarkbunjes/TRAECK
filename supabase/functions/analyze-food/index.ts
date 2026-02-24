import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

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

const SYSTEM_PROMPT = `You are a nutrition analysis assistant. Analyze the food in the provided image and estimate the nutritional values.

Rules:
- Identify each distinct food item visible in the image
- Estimate the serving size in grams based on visual cues (plate size, proportions)
- If the user provides a description, use it to refine your estimates (e.g. "200g chicken" means use 200g for chicken)
- Provide nutritional values for the ESTIMATED SERVING SIZE (not per 100g)
- Be realistic with estimates — use standard nutritional databases as reference
- If you cannot identify a food item, make your best guess
- Always respond in the language of the user's description, or English if no description is given

Respond ONLY with valid JSON in this exact format:
{
  "foods": [
    {
      "name": "food item name",
      "serving_grams": 150,
      "calories": 250,
      "protein": 30,
      "carbs": 5,
      "fat": 12,
      "sugar": 1,
      "saturated_fat": 3
    }
  ]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 500);
    }

    const { imageBase64, mimeType, description } = await req.json();

    if (!imageBase64) {
      return jsonResponse({ error: "imageBase64 is required" }, 400);
    }

    const userMessage = description
      ? `Analyze this food image. User description: "${description}"`
      : "Analyze this food image and estimate nutritional values.";

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
              {
                inlineData: {
                  mimeType: mimeType || "image/jpeg",
                  data: imageBase64,
                },
              },
              { text: userMessage },
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

    const parsed = JSON.parse(textContent);
    return jsonResponse(parsed);
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
