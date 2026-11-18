const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
});

const json = (data, status, origin) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
});

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://venkateshwari-p.github.io";
    const origin = request.headers.get("Origin") || "";

    if (origin !== allowedOrigin) return new Response("Origin not allowed", { status: 403 });

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders(allowedOrigin), "Access-Control-Max-Age": "86400" }
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST to ask AgriAI a question." }, 405, allowedOrigin);
    }
    if (!env.GEMINI_API_KEY) {
      return json({ error: "AgriAI is not configured yet. Please try again later." }, 503, allowedOrigin);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Please send a valid question." }, 400, allowedOrigin); }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const language = body.language === "ta" ? "Tamil" : "English";
    const crop = typeof body.crop === "string" ? body.crop.trim().slice(0, 60) : "";
    const profileInput = body.profile && typeof body.profile === "object" ? body.profile : {};
    const farmProfile = {
      stage: typeof profileInput.stage === "string" ? profileInput.stage.trim().slice(0, 60) : "",
      soil: typeof profileInput.soil === "string" ? profileInput.soil.trim().slice(0, 60) : "",
      irrigation: typeof profileInput.irrigation === "string" ? profileInput.irrigation.trim().slice(0, 60) : ""
    };
    if (!message) return json({ error: "Please enter a question." }, 400, allowedOrigin);
    if (message.length > 1200) {
      return json({ error: "Please keep your question under 1,200 characters." }, 413, allowedOrigin);
    }

    const instructions = [
      "You are ZORVENA AgriAI, an educational agriculture knowledge assistant.",
      "Answer in " + language + ". Give clear, practical, concise educational information for farmers.",
      "If a crop or farm profile details are supplied, use only those details to tailor the answer. Do not assume the farmer's location, variety, season, or any profile detail that is not supplied.",
      "Do not claim to have inspected a farm, soil sample, plant, image, weather feed, or market feed unless that data is provided.",
      "Do not invent sources, local regulations, product labels, pesticide registrations, or citations.",
      "For crop disease or pest questions, describe possibilities rather than making a definitive diagnosis; recommend confirmation by a local agricultural officer or qualified agronomist.",
      "Never provide hazardous pesticide mixing instructions, unsafe chemical use, or unsupported exact pesticide/fertiliser dosages.",
      "For crop variety, sowing dates, fertiliser quantities, irrigation schedules, or plant protection, explain that local crop, soil test, season, water quality, and official regional guidance are necessary.",
      "If essential details are missing, ask a short clarifying question instead of guessing.",
      "Be transparent that your answer is general educational guidance and not a substitute for local expert advice."
    ].join("\n");

    try {
      const model = env.GEMINI_MODEL || "gemini-3.1-flash-lite";
      const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(model) + ":generateContent";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-goog-api-key": env.GEMINI_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [{ role: "user", parts: [{ text:
            (crop ? "Selected crop: " + crop + "\n" : "") +
            (farmProfile.stage ? "Crop growth stage: " + farmProfile.stage + "\n" : "") +
            (farmProfile.soil ? "Soil type: " + farmProfile.soil + "\n" : "") +
            (farmProfile.irrigation ? "Irrigation method: " + farmProfile.irrigation + "\n" : "") +
            "Farmer question: " + message
        }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.4 }
        })
      });

      const result = await response.json();
      if (!response.ok) {
        return json({ error: "The AI service could not answer right now. Please check the API quota or try again later." }, 502, allowedOrigin);
      }

      const answer = (result.candidates?.[0]?.content?.parts || [])
        .map(part => part.text || "")
        .join("\n").trim();
      if (!answer) {
        return json({ error: "No answer was returned. Please try asking in a different way." }, 502, allowedOrigin);
      }
      return json({ answer }, 200, allowedOrigin);
    } catch {
      return json({ error: "AgriAI is temporarily unavailable. Please try again later." }, 502, allowedOrigin);
    }
  }
};
