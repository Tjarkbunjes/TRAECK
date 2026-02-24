import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const { imageUrl, description } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fetch the image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch image" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const imageBytes = await imageResponse.arrayBuffer();
    const base64Image = btoa(
      String.fromCharCode(...new Uint8Array(imageBytes)),
    );
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Build Gemini request
    const userMessage = description
      ? `Analyze this food image. User description: "${description}"`
      : "Analyze this food image and estimate nutritional values.";

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

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
                  mimeType,
                  data: base64Image,
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
      return new Response(
        JSON.stringify({ error: "AI analysis failed. Please try again." }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const geminiData = await geminiResponse.json();

    // Extract the text response
    const textContent =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    // Parse the JSON response
    const parsed = JSON.parse(textContent);

    return new Response(JSON.stringify(parsed), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
