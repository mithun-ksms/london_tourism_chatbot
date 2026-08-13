// COMPREHENSIVE London Tourism Chatbot Webhook with All Intent Support
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
app.use(bodyParser.json());

// ==== API KEYS ====
// All keys are loaded from environment variables (set these in Render's
// dashboard, or in a local .env file that is NOT committed to git).
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const MAPS_API_KEY = process.env.MAPS_API_KEY;
const TRIPADVISOR_API_KEY = process.env.TRIPADVISOR_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Fail fast with a clear message if something is missing, instead of
// silently breaking later.
const requiredKeys = { WEATHER_API_KEY, MAPS_API_KEY, TRIPADVISOR_API_KEY, GEMINI_API_KEY };
for (const [name, value] of Object.entries(requiredKeys)) {
  if (!value) {
    console.warn(`⚠️  Missing environment variable: ${name}. Related features will not work until it's set.`);
  }
}

// ==== LOGGING SETUP ====
const LOG_FILE = "chatbot_logs.json";

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify({ logs: [] }, null, 2));
}

// Function to log interactions
function logInteraction(userId, intent, query, parameters, response, timestamp = new Date().toISOString()) {
  try {
    const logData = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    logData.logs.push({
      timestamp,
      userId,
      intent,
      query,
      parameters,
      response: response.substring(0, 500) // Limit response length
    });
    
    // Keep only last 1000 logs to prevent file from growing too large
    if (logData.logs.length > 1000) {
      logData.logs = logData.logs.slice(-1000);
    }
    
    fs.writeFileSync(LOG_FILE, JSON.stringify(logData, null, 2));
    console.log("📝 Logged interaction to", LOG_FILE);
  } catch (err) {
    console.error("❌ Error logging interaction:", err);
  }
}

const conversationHistory = {}; // Session history by user

// Auto-clear conversation history after 5 mins
setInterval(() => {
  const now = Date.now();
  for (const userId in conversationHistory) {
    if (conversationHistory[userId].timestamp && now - conversationHistory[userId].timestamp > 5 * 60 * 1000) {
      delete conversationHistory[userId];
      console.log(`🧹 Cleared session for user: ${userId}`);
    }
  }
}, 2 * 60 * 1000); // run every 2 mins

app.get("/", (req, res) => {
  res.send("✅ London Tourism Chatbot Webhook is running with Comprehensive Intent Support");
});

// ==== GEMINI AI RESPONSE ====
async function getGeminiResponse(userId, userQuery, parameters = {}, intentName = "") {
  console.log(`🧠 [Gemini] Starting request for ${userId}`);
  console.log(`📝 Query: "${userQuery}"`);
  console.log(`🎯 Intent: ${intentName}`);

  if (!conversationHistory[userId]) {
    conversationHistory[userId] = { history: [], timestamp: Date.now() };
  }

  // Validate and add user message
  if (userQuery && typeof userQuery === 'string') {
    conversationHistory[userId].history.push({ 
      role: "user", 
      content: userQuery.trim() 
    });
    conversationHistory[userId].timestamp = Date.now();
  }

  // Dynamic system message construction based on intent and parameters
  let systemMessage = "You are a helpful travel assistant for tourists in London. Keep your answers concise - maximum 2 short paragraphs. Focus on the most important information and end with a brief follow-up question.";

  // Enhanced parameter handling for more contextual responses
  const location = parameters.location || "London";
  const budget = parameters.budget_level || "";
  const profile = parameters.tourist_profile || "";
  const time = parameters.time || "";
  const concerns = parameters.safety_concerns || "";

  // Customize system message based on intent with enhanced context
  if (intentName === "currency_conversion") {
    const from = parameters.currency_from || "";
    const to = parameters.currency_to || "";
    systemMessage = `You are a currency conversion assistant. Give clear, concise exchange rates from ${from} to ${to} in 1-2 short sentences. Include approximate conversion rates and any relevant fees. End with a brief follow-up question.`;
  }
  else if (intentName === "accommodation_info") {
    let context = `in ${location}`;
    if (budget) context += ` with a ${budget} budget`;
    if (profile) context += ` suitable for ${profile} travelers`;
    systemMessage = `You are a London accommodation expert. Recommend 2-3 places to stay ${context} in 1-2 short paragraphs. Include key details like price range and location. End with a brief follow-up question.`;
  } 
  else if (intentName === "event_information") {
    const eventType = parameters.event_type || "events";
    let context = `upcoming ${eventType} in ${location}`;
    if (time) context += ` during ${time}`;
    systemMessage = `You are a London events specialist. List 2-3 ${context} in 1-2 short paragraphs. Include dates and brief descriptions. End with a brief follow-up question.`;
  }
  else if (intentName === "food_recommendations") {
    const cuisine = parameters.cuisine_type || "";
    let context = `${cuisine ? cuisine + ' ' : ''}restaurants in ${location}`;
    if (budget) context += ` with ${budget} prices`;
    if (profile) context += ` suitable for ${profile} travelers`;
    systemMessage = `You are a London food expert. Recommend 2-3 ${context} in 1-2 short paragraphs. Include key details like price range and specialty. End with a brief follow-up question.`;
  }
  else if (intentName === "london_history") {
    const attractionType = parameters.attraction_type || "";
    const era = parameters.era || "";
    let context = `${location}'s history`;
    if (attractionType) context += `, particularly ${attractionType}`;
    if (era) context += ` during the ${era} period`;
    systemMessage = `You are a London history expert. Share 1-2 short paragraphs about ${context}, focusing on key facts. End with a brief follow-up question.`;
  }
  else if (intentName === "safety_information") {
    let context = `safety in ${location}`;
    if (concerns) context += `, specifically about ${concerns}`;
    if (profile) context += ` for ${profile} travelers`;
    if (time) context += ` during ${time}`;
    systemMessage = `You are a London safety expert. Provide 1-2 short paragraphs of practical safety advice for ${context}. Include key tips and emergency numbers. End with a brief follow-up question.`;
  }
  else if (intentName === "shopping_information") {
    const shopType = parameters.shopping_type || "";
    let context = `shopping in ${location}`;
    if (shopType) context += ` for ${shopType}`;
    if (budget) context += ` with a ${budget} budget`;
    systemMessage = `You are a London shopping expert. Recommend 2-3 shopping spots ${context} in 1-2 short paragraphs. Include key details like what they're known for. End with a brief follow-up question.`;
  }
  else if (intentName === "transportation_info") {
    const from = parameters.location_from || "";
    const to = parameters.location_to || "";
    const transportType = parameters.transportation_type || "";
    let context = `getting from ${from} to ${to}`;
    if (transportType) context += ` using ${transportType}`;
    if (time) context += ` at ${time}`;
    systemMessage = `You are a London transportation expert. Provide clear, concise directions for ${context} in 1-2 short paragraphs. Include key transport options and tips. End with a brief follow-up question.`;
  }
  else if (intentName === "weather_inquiry") {
    const season = parameters.seasons || "";
    const condition = parameters.weather_condition || "";
    let context = `weather in ${location}`;
    if (season) context += ` during ${season}`;
    if (condition) context += ` that is ${condition}`;
    if (profile) context += ` for ${profile} travelers`;
    systemMessage = `You are a London weather expert. Give a brief, clear weather update for ${context} in 1-2 short sentences. Include key details like temperature and conditions. End with a brief follow-up question.`;
  }

  // Validate messages array
  const messages = [
    { role: "system", content: systemMessage },
    ...conversationHistory[userId].history.filter(msg => 
      msg && typeof msg === 'object' && 
      msg.role && typeof msg.role === 'string' &&
      msg.content && typeof msg.content === 'string'
    )
  ];

  try {
    // Gemini uses "user"/"model" roles (not "assistant"), and takes the
    // system prompt as a separate field rather than a message in the array.
    const geminiContents = messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        system_instruction: { parts: [{ text: systemMessage }] },
        contents: geminiContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 400
        }
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    console.log("📦 Gemini raw response:", JSON.stringify(response.data, null, 2));

    // Validate Gemini response
    const aiReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!aiReply) {
      console.error("❌ Gemini returned empty response");
      return "I apologize, but I couldn't get a proper response. Could you please try rephrasing your question?";
    }

    console.log("✅ Gemini success:", aiReply.substring(0, 100) + "...");

    // Validate before adding to history
    conversationHistory[userId].history.push({
      role: "assistant",
      content: aiReply
    });

    return aiReply;

  } catch (err) {
    console.error("❌ Gemini Error:", err.response ? err.response.data : err.message);
    return "I'm having trouble accessing information right now. Please try again shortly.";
  }
}

// ==== WEATHER API ====
async function getWeather(city = "London", season = "", condition = "", profile = "", safetyConcerns = "") {
  console.log("🌤️ Fetching weather for:", city);
  console.log("Additional weather parameters:", { season, condition, profile, safetyConcerns });
  
  try {
    const { data } = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city},uk&units=metric&appid=${WEATHER_API_KEY}`
    );
    
    // If we have a season parameter but not current weather data, use Gemini instead
    if (season && season !== "") {
      console.log("⚠️ Season parameter provided, API only provides current weather");
      return null; // Trigger Gemini fallback
    }
    
    let responseText = `🌤️ Currently ${data.weather[0].description} in ${city}, ${Math.round(data.main.temp)}°C (feels like ${Math.round(data.main.feels_like)}°C), humidity ${data.main.humidity}%, wind ${data.wind.speed} m/s.`;
    
    // Add clothing recommendations based on temperature
    const temp = Math.round(data.main.temp);
    if (temp < 5) {
      responseText += " I'd recommend a heavy coat, gloves, scarf, and a warm hat.";
    } else if (temp < 12) {
      responseText += " A warm jacket or coat would be appropriate for today.";
    } else if (temp < 18) {
      responseText += " A light jacket or sweater should be comfortable today.";
    } else {
      responseText += " It's quite mild, light clothing should be fine, but maybe bring a light layer for evening.";
    }
    
    // Add rain recommendation
    if (data.weather[0].description.includes("rain") || data.weather[0].description.includes("drizzle")) {
      responseText += " Don't forget an umbrella!";
    }
    
    // Add follow-up question
    responseText += " Would you like to know the forecast for the coming days or clothing recommendations?";
    
    return responseText;
  } catch (err) {
    console.error("❌ Weather API Error:", err.message);
    return null; // Return null to trigger fallback
  }
}

// ==== NEARBY ATTRACTIONS ====
async function getNearbyAttractions(location) {
  console.log("📍 Fetching attractions for:", location);
  try {
    const geo = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${MAPS_API_KEY}`
    );
    
    if (!geo.data.results || geo.data.results.length === 0) {
      console.error("❌ No geocoding results for location:", location);
      return null;
    }
    
    const { lat, lng } = geo.data.results[0].geometry.location;
    
    const places = await axios.get(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=500&type=tourist_attraction&key=${MAPS_API_KEY}`
    );
    
    const results = places.data.results || [];
    
    if (results.length === 0) {
      console.log("⚠️ No attractions found near location:", location);
      return null;
    }
    
    return `Top places near ${location}:
${results.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} ${p.rating ? `(${p.rating}★)` : ''}`).join("\n")}

Would you like more information about any of these attractions or directions to get there?`;
  } catch (err) {
    console.error("❌ Attraction API Error:", err.message);
    return null;
  }
}

// ==== CURRENCY CONVERSION ====
async function getCurrencyRate(from, to, amount = 1) {
  console.log("💱 Converting:", amount, from, "to", to);
  if (!from || !to) return null;
  
  try {
    from = String(from).toUpperCase();
    to = String(to).toUpperCase();
    
    const { data } = await axios.get(`https://open.er-api.com/v6/latest/${from}`);
    const rate = data.rates[to];
    return rate ? `${amount} ${from} ≈ ${(amount * rate).toFixed(2)} ${to} based on current exchange rates. Would you like to convert a different amount or currency?` : null;
  } catch (err) {
    console.error("❌ Currency API Error:", err.message);
    return null;
  }
}

// ==== TRIPADVISOR RESTAURANTS ====
async function getTripAdvisorRestaurants(location = "London", cuisineType = "", budgetLevel = "", touristProfile = "") {
  console.log("🍽️ Fetching restaurants in:", location);
  console.log("Additional parameters:", { cuisineType, budgetLevel, touristProfile });
  
  try {
    // Build query parameters
    let searchQuery = location;
    if (cuisineType) {
      searchQuery += ` ${cuisineType}`;
    }
    
    const res = await axios.get(
      `https://api.content.tripadvisor.com/api/v1/location/search?searchQuery=${encodeURIComponent(searchQuery)}&category=restaurants&language=en&key=${TRIPADVISOR_API_KEY}`
    );
    
    const data = res.data.data || [];
    
    if (data.length === 0) {
      console.log("⚠️ No restaurants found with TripAdvisor");
      return null;
    }
    
    // If we have budget or tourist profile parameters, we should mention them in the response
    // even though the TripAdvisor API doesn't filter by these
    let responsePrefix = `🍴 Popular restaurants in ${location}`;
    
    if (cuisineType) responsePrefix += ` serving ${cuisineType} cuisine`;
    if (budgetLevel) responsePrefix += ` with ${budgetLevel} prices`;
    if (touristProfile) responsePrefix += ` great for ${touristProfile}`;
    
    return `${responsePrefix}:
${data.slice(0, 5).map((r, i) => `${i + 1}. ${r.name}`).join("\n")}

Would you like more details about any of these restaurants or different cuisine options?`;
  } catch (err) {
    console.error("❌ TripAdvisor API Error:", err.message);
    return null;
  }
}

// ==== DIRECTIONS API ====
async function getDirections(origin, destination, transportType = "") {
  console.log("🗺️ Fetching directions from", origin, "to", destination);
  
  if (!origin || !destination) {
    console.log("⚠️ Missing origin or destination");
    return null;
  }
  
  try {
    // Convert addresses to coordinates
    const originGeo = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(origin)}&key=${MAPS_API_KEY}`);
    const destGeo = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${MAPS_API_KEY}`);
    
    if (!originGeo.data.results?.[0] || !destGeo.data.results?.[0]) {
      console.log("⚠️ Couldn't geocode locations");
      return null;
    }
    
    // Get directions
    let mode = "transit"; // Default to public transit
    if (transportType) {
      if (transportType.includes("walk")) mode = "walking";
      else if (transportType.includes("bic") || transportType.includes("cycl")) mode = "bicycling";
      else if (transportType.includes("car") || transportType.includes("driv")) mode = "driving";
    }
    
    const directions = await axios.get(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}&key=${MAPS_API_KEY}`
    );
    
    if (!directions.data.routes?.[0]) {
      console.log("⚠️ No routes found");
      return null;
    }
    
    const route = directions.data.routes[0];
    const leg = route.legs[0];
    
    let response = `🗺️ To get from ${leg.start_address} to ${leg.end_address}:\n\n`;
    response += `Total distance: ${leg.distance.text}\n`;
    response += `Estimated travel time: ${leg.duration.text}\n\n`;
    
    if (mode === "transit") {
      response += "Recommended route:\n";
      let stepCount = 1;
      for (const step of leg.steps) {
        if (step.travel_mode === "TRANSIT") {
          const transit = step.transit_details;
          response += `${stepCount}. Take the ${transit.line.short_name || transit.line.name} from ${transit.departure_stop.name} to ${transit.arrival_stop.name} (${step.duration.text})\n`;
        } else {
          response += `${stepCount}. ${step.html_instructions.replace(/<[^>]+>/g, '')} (${step.duration.text})\n`;
        }
        stepCount++;
      }
    } else {
      response += "Brief directions:\n";
      let stepCount = 1;
      for (const step of leg.steps.slice(0, 5)) {
        response += `${stepCount}. ${step.html_instructions.replace(/<[^>]+>/g, '')} (${step.distance.text})\n`;
        stepCount++;
      }
      if (leg.steps.length > 5) {
        response += `...and ${leg.steps.length - 5} more steps\n`;
      }
    }
    
    response += "\nWould you like information about alternative transport options or more detailed directions?";
    
    return response;
  } catch (err) {
    console.error("❌ Directions API Error:", err.message);
    return null;
  }
}

// Helper function to split long messages into chunks
function splitMessage(text, maxLength = 1000) {
  const parts = [];
  for (let i = 0; i < text.length; i += maxLength) {
    parts.push(text.slice(i, i + maxLength));
  }
  return parts;
}

// ==== HELPER FUNCTIONS ====
function toMessengerCard(text, title = "London Travel Info") {
  // Split text into chunks if it's too long
  const maxLength = 400;
  const chunks = [];
  let currentText = text;
  
  while (currentText.length > 0) {
    // Find the last space within the limit
    let chunk = currentText.slice(0, maxLength);
    if (currentText.length > maxLength) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > 0) {
        chunk = chunk.slice(0, lastSpace);
      }
    }
    chunks.push(chunk);
    currentText = currentText.slice(chunk.length).trim();
  }

  // Create rich content array
  const richContent = chunks.map(chunk => ({
    type: "info",
    title: title,
    subtitle: chunk.replace(/[^\x20-\x7E]/g, '').replace(/\n{2,}/g, '\n').trim()
  }));

  return {
    payload: {
      richContent: [richContent]
    },
    source: "london-tourism-chatbot"
  };
}

// ==== MAIN WEBHOOK ====
app.post("/webhook", async (req, res) => {
  try {
    const intent = req.body.queryResult.intent.displayName;
    const query = req.body.queryResult.queryText;
    const parameters = req.body.queryResult.parameters || {};
    const confidence = req.body.queryResult.intentDetectionConfidence || 0;
    const userId = req.body.session?.split("/").pop() || "default";

    console.log("\n📩 New Request:", { intent, query, confidence });
    console.log("Parameters:", JSON.stringify(parameters, null, 2));

    // Handle fallback intent with enhanced context
    if (intent === "Default Fallback Intent") {
      console.log("🤖 Handling fallback intent...");
      try {
        // Extract context from the query for better fallback responses
        const location = parameters.location || "London";
        const context = query.toLowerCase();
        
        let fallbackPrompt = query;
        if (context.includes("where") || context.includes("location")) {
          fallbackPrompt = `Tell me about locations or places in ${location}. ${query}`;
        } else if (context.includes("how") || context.includes("get")) {
          fallbackPrompt = `Give me directions or transportation advice in ${location}. ${query}`;
        } else if (context.includes("what") || context.includes("tell")) {
          fallbackPrompt = `Provide information about ${location}. ${query}`;
        }

        const responseText = await getGeminiResponse(userId, fallbackPrompt, parameters, intent);
        
        // Use messenger card for fallback responses
        const dialogflowResponse = toMessengerCard(responseText, "Travel Information");
        console.log("📤 Sending fallback response:", JSON.stringify(dialogflowResponse, null, 2));
        return res.json(dialogflowResponse);

      } catch (error) {
        console.error("❌ Fallback error:", error);
        return res.json(toMessengerCard(
          "I'm having trouble understanding that. Could you please rephrase your question?",
          "Sorry, I need help"
        ));
      }
    }

    let responseText = null;

    // Handle intents with confidence > 0.7
    if (confidence > 0.7) {
      switch (intent) {
        case "find_attractions":
        case "find_attractions_more_info":
        case "find_attractions.more_info":
          responseText = await getNearbyAttractions(parameters.location || "London");
          break;
          
        case "weather_inquiry":
        case "weather_inquiry_forecast":
        case "weather_inquiry.forecast_request":
          responseText = await getWeather(
            parameters.location || "London",
            parameters.seasons || "",
            parameters.weather_condition || "",
            parameters.tourist_profile || "",
            parameters.safety_concerns || ""
          );
          break;
          
        case "currency_conversion":
        case "currency_conversion_more_amounts":
        case "currency_conversion.more_amounts":
          responseText = await getCurrencyRate(
            parameters.currency_from, 
            parameters.currency_to, 
            parameters.number || 1
          );
          break;
          
        case "food_recommendations":
        case "food_recommendations_more_options":
        case "food_recommendations.more_options":
          responseText = await getTripAdvisorRestaurants(
            parameters.location || "London",
            parameters.cuisine_type || "",
            parameters.budget_level || "",
            parameters.tourist_profile || ""
          );
          break;
          
        case "transportation_info":
        case "transportation_info_alt_modes":
        case "transportation_info.alt_modes":
          // If we have from and to locations, use Directions API
          if (parameters.location_from && parameters.location_to) {
            responseText = await getDirections(
              parameters.location_from,
              parameters.location_to,
              parameters.transportation_type || ""
            );
          }
          
          // If API call fails or we don't have enough parameters, fall back to Gemini
          if (!responseText) {
            responseText = await getGeminiResponse(userId, query, parameters, intent);
          }
          break;
          
        case "accommodation_info":
        case "accommodation_info_budget_options":
        case "accommodation_info.budget_options":
        case "event_information":
        case "event_information_more_events":
        case "event_information.more_events":
        case "london_history":
        case "london_history_more_periods":
        case "london_history.more_periods":
        case "safety_information":
        case "safety_information_more_help":
        case "safety_information.more_help":
        case "shopping_information":
        case "shopping_information_more_shops":
        case "shopping_information.more_shops":
          // Use Gemini for these intents
          responseText = await getGeminiResponse(userId, query, parameters, intent);
          break;
          
        default:
          responseText = await getGeminiResponse(userId, query, parameters, intent);
      }
    }

    // If no response yet, use Gemini with enhanced context
    if (!responseText) {
      console.log("🤖 Trying Gemini with enhanced context...");
      responseText = await getGeminiResponse(userId, query, parameters, intent);
    }

    // Validate response text
    if (!responseText || typeof responseText !== 'string') {
      console.error("❌ Invalid response text:", responseText);
      responseText = "I apologize, but I couldn't process that request. Could you please rephrase your question?";
    }

    // Use messenger card for all responses
    const dialogflowResponse = toMessengerCard(responseText, intent.replace(/_/g, ' '));
    console.log("📤 Sending response:", JSON.stringify(dialogflowResponse, null, 2));
    return res.json(dialogflowResponse);

  } catch (error) {
    console.error("❌ Webhook error:", error);
    
    // Log the error interaction
    logInteraction(
      req.body.session?.split("/").pop() || "default",
      req.body.queryResult?.intent?.displayName || "unknown",
      req.body.queryResult?.queryText || "",
      req.body.queryResult?.parameters || {},
      `ERROR: ${error.message}`
    );

    // Use messenger card for error responses
    const errorResponse = toMessengerCard(
      "I'm having trouble right now. Could you try asking your question again?",
      "Sorry, I'm having trouble"
    );

    console.log("⚠️ Sending error response:", JSON.stringify(errorResponse, null, 2));
    return res.json(errorResponse);
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});

