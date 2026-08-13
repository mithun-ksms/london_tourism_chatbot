// ============================================================
// London Tourism Chatbot - Backend Server
// Built with Node.js + Express
// Uses Gemini AI for smart chat responses
// Uses real APIs for weather, directions, currency
// No Dialogflow needed - Gemini handles everything directly
// ============================================================

require("dotenv").config();
const express    = require("express");
const bodyParser = require("body-parser");
const axios      = require("axios");
const path       = require("path");

const app  = express();
const port = process.env.PORT || 3000;

// These middlewares let our server understand JSON requests
// and serve HTML/CSS/JS files from the same folder
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// ── API KEYS ─────────────────────────────────────────────
// All keys come from environment variables (Render dashboard)
// NEVER put real keys directly in code - anyone can see them
const WEATHER_API_KEY  = process.env.WEATHER_API_KEY;
const MAPS_API_KEY     = process.env.MAPS_API_KEY;
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY;
const CURRENCY_API_KEY = process.env.CURRENCY_API_KEY;

// Warn us in the logs if any key is missing when server starts
const requiredKeys = { WEATHER_API_KEY, MAPS_API_KEY, GEMINI_API_KEY };
for (const [name, value] of Object.entries(requiredKeys)) {
  if (!value) console.warn(`⚠️  Missing: ${name}`);
}

// ── SESSION MEMORY ────────────────────────────────────────
// We remember the last few messages per user so Gemini can
// give context-aware replies - "what about tomorrow?" makes
// sense because it knows what was discussed before
const conversationHistory = {};

// Clean up old sessions every 10 minutes to save memory
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const userId in conversationHistory) {
    if (conversationHistory[userId].timestamp < tenMinutesAgo) {
      delete conversationHistory[userId];
    }
  }
}, 5 * 60 * 1000);

// ── SERVE THE HOMEPAGE ────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ============================================================
// GEMINI AI CHAT - The main brain of the chatbot
// User sends a message, we add context, Gemini replies smartly
// ============================================================
app.post("/api/chat", async (req, res) => {
  const { message, userId = "default" } = req.body;

  if (!message) return res.status(400).json({ error: "No message" });

  console.log(`💬 ${userId}: "${message}"`);

  // Create a new conversation session if this is a new user
  if (!conversationHistory[userId]) {
    conversationHistory[userId] = { history: [], timestamp: Date.now() };
  }

  // Add user's message to the conversation history
  conversationHistory[userId].history.push({
    role:  "user",
    parts: [{ text: message }]
  });
  conversationHistory[userId].timestamp = Date.now();

  // Only keep last 10 messages to avoid sending too many tokens to Gemini
  if (conversationHistory[userId].history.length > 10) {
    conversationHistory[userId].history = conversationHistory[userId].history.slice(-10);
  }

  // ── SYSTEM INSTRUCTION ─────────────────────────────────
  // This tells Gemini who it is and how to behave
  // Think of it as Gemini's job description and personality guide
  const systemInstruction = `You are Jojo, a friendly and knowledgeable London tourism assistant.

Your personality:
- Warm, enthusiastic and genuinely helpful
- Keep responses concise - maximum 3 short paragraphs
- Always end with ONE relevant follow-up question
- Use emojis occasionally to feel friendly and approachable

Your expertise covers:
- London attractions (Tower of London, British Museum, Buckingham Palace, Borough Market, Tate Modern, etc.)
- Food and restaurants (from £5 street food to Michelin star dining, all cuisines)
- Transport (Tube zones, Oyster cards, Elizabeth line, night buses, river boats)
- Accommodation (best areas: Shoreditch, South Bank, Covent Garden, Notting Hill)
- Shopping (Oxford Street, Carnaby Street, Portobello Market, Brick Lane, Spitalfields)
- History and culture (Roman Londinium, Great Fire, Victorian era, Blitz, modern London)
- Events, theatre, nightlife, live music
- Safety tips (very safe city overall, normal urban precautions)
- Day trips (Bath 90min, Oxford 60min, Cambridge 50min, Windsor 40min, Stonehenge 2hrs)
- Hidden gems tourists usually miss
- Budget tips and free things to do (most major museums are FREE)
- Practical tips (contactless payment everywhere, tap in/out on tube, etc.)

Rules:
- Only answer questions about London and UK travel
- If asked about something else, warmly redirect to London topics
- Give approximate prices and note they may vary
- If unsure about something current, say "I'd recommend checking the official website"
- Never make up specific facts - be honest when uncertain`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: conversationHistory[userId].history,
        generationConfig: {
          temperature:     0.7,  // balanced between creative and factual
          maxOutputTokens: 500,  // keeps responses concise
          topP:            0.9
        }
      },
      { headers: { "Content-Type": "application/json" } }
    );

    // Dig into Gemini's response structure to get the actual text
    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!reply) throw new Error("Empty Gemini response");

    console.log(`✅ Jojo: "${reply.substring(0, 80)}..."`);

    // Save Gemini's reply to history so it remembers the conversation
    conversationHistory[userId].history.push({
      role:  "model",
      parts: [{ text: reply }]
    });

    return res.json({ reply });

  } catch (err) {
    console.error("❌ Gemini error:", err.response?.data || err.message);
    return res.json({ reply: "I'm having a little trouble right now — could you try asking again? 😊" });
  }
});

// ============================================================
// WEATHER - Proxied through our server to hide the API key
// If we called OpenWeatherMap directly from the browser,
// anyone could see the key in the network tab
// ============================================================
app.get("/api/weather", async (req, res) => {
  const city = req.query.city || "London";
  try {
    const { data } = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`
    );
    return res.json(data);
  } catch (err) {
    console.error("❌ Weather:", err.response?.data || err.message);
    return res.status(500).json({ error: "Could not fetch weather" });
  }
});

// Weather by GPS coordinates - for the "my location" button
app.get("/api/weather/coords", async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const { data } = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`
    );
    return res.json(data);
  } catch (err) {
    console.error("❌ Weather coords:", err.response?.data || err.message);
    return res.status(500).json({ error: "Could not fetch weather" });
  }
});

// 5-day forecast - shown in the forecast card
app.get("/api/weather/forecast", async (req, res) => {
  const city = req.query.city || "London";
  try {
    const { data } = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`
    );
    return res.json(data);
  } catch (err) {
    console.error("❌ Forecast:", err.response?.data || err.message);
    return res.status(500).json({ error: "Could not fetch forecast" });
  }
});

// ============================================================
// CURRENCY - Live exchange rates
// Free tier of exchangerate-api.com works without an API key
// ============================================================
app.get("/api/currency", async (req, res) => {
  const { from = "USD", to = "GBP", amount = 1 } = req.query;
  try {
    // Try paid API first if we have a key, otherwise use free endpoint
    let url = CURRENCY_API_KEY
      ? `https://v6.exchangerate-api.com/v6/${CURRENCY_API_KEY}/pair/${from}/${to}/${amount}`
      : `https://api.exchangerate-api.com/v4/latest/${from}`;

    const { data } = await axios.get(url);

    // The paid and free APIs have slightly different response formats
    let rate, converted;
    if (data.conversion_result) {
      rate      = data.conversion_rate;
      converted = data.conversion_result;
    } else {
      rate      = data.rates[to];
      converted = (parseFloat(amount) * rate).toFixed(2);
    }

    return res.json({
      from, to,
      amount:    parseFloat(amount),
      rate:      parseFloat(rate.toFixed(4)),
      result:    parseFloat(converted)
    });

  } catch (err) {
    console.error("❌ Currency:", err.response?.data || err.message);
    return res.status(500).json({ error: "Could not fetch exchange rates" });
  }
});

// ============================================================
// DIRECTIONS - Real Google Maps transit directions
// ============================================================
app.get("/api/directions", async (req, res) => {
  const { from, to, mode = "transit" } = req.query;
  if (!from || !to) return res.status(400).json({ error: "Need from and to" });

  try {
    const { data } = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      { params: { origin: from, destination: to, mode, region: "gb", key: MAPS_API_KEY } }
    );

    if (data.status !== "OK") {
      return res.status(400).json({ error: `Google Maps: ${data.status}` });
    }

    const route = data.routes[0].legs[0];
    return res.json({
      from:     route.start_address,
      to:       route.end_address,
      duration: route.duration.text,
      distance: route.distance.text,
      // Strip HTML tags from Google's step-by-step instructions
      steps: route.steps.map(s => ({
        instruction: s.html_instructions.replace(/<[^>]*>/g, ""),
        duration:    s.duration.text
      }))
    });

  } catch (err) {
    console.error("❌ Directions:", err.response?.data || err.message);
    return res.status(500).json({ error: "Could not fetch directions" });
  }
});

// ============================================================
// ITINERARY GENERATOR - Gemini creates a personalised plan
// Uses a different endpoint from chat because it needs a longer
// response and a very specific structured prompt
// ============================================================
app.post("/api/itinerary", async (req, res) => {
  const { days, visitType, interests, budget } = req.body;
  console.log(`📅 Generating ${days}-day itinerary for ${visitType}`);

  // Build a detailed prompt so Gemini knows exactly what format we want
  const prompt = `Create a detailed ${days}-day London itinerary for ${visitType} travelers.
Budget: ${budget} per person per day
Interests: ${interests.join(", ")}

Format exactly like this:
- Start each day with "Day 1:", "Day 2:" etc
- Use time format: "9:00 AM - 11:00 AM: Activity at Specific Place Name"
- Include specific restaurant recommendations for lunch and dinner
- Add transport tip between each location (tube line, bus number, walk time)
- End each day with a Budget Breakdown showing approximate costs
- Add 2-3 insider tips per day that most tourists don't know

Make it practical and realistic - consider opening hours, queues at popular spots, and realistic travel times.`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.8,   // slightly more creative for itineraries
          maxOutputTokens: 2000   // needs to be longer for multi-day plans
        }
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const itinerary = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!itinerary) throw new Error("Empty itinerary");

    return res.json({ itinerary });

  } catch (err) {
    console.error("❌ Itinerary:", err.response?.data || err.message);
    return res.status(500).json({ error: "Could not generate itinerary" });
  }
});

// ============================================================
// TFL TUBE STATUS - Live London Underground updates
// TfL has a free public API - no key needed
// ============================================================
app.get("/api/tube", async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://api.tfl.gov.uk/Line/Mode/tube/Status"
    );
    // Simplify TfL's big response to just name and status
    const lines = data.map(line => ({
      name:   line.name,
      status: line.lineStatuses[0]?.statusSeverityDescription || "Unknown",
      reason: line.lineStatuses[0]?.reason || null
    }));
    return res.json(lines);
  } catch (err) {
    console.error("❌ Tube:", err.message);
    return res.status(500).json({ error: "Could not fetch tube status" });
  }
});

// ── START ─────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`🚀 London Tourism Chatbot running on port ${port}`);
});
