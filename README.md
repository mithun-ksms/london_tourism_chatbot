# 🇬🇧 London Explorer — AI Travel Guide & Chatbot

A website that helps tourists explore London using live data and AI. Built as part of an Erasmus university project.

🌐 **Live website:** [mithun-ksms.github.io/london_tourism_chatbot](https://mithun-ksms.github.io/london_tourism_chatbot)

---

## 🤔 What does it do?

Imagine a travel guide that's available 24/7, knows real-time London information, and can answer any question you throw at it. That's London Explorer.

A visitor to the site can:

- Ask the **Jojo AI chatbot** (💂 bottom left corner) anything about London — "Is Dishoom worth the wait?", "What's the best free thing to do?", "How do I get from Heathrow to central London?" — and get a real, intelligent answer powered by Google's Gemini AI
- Check **live London weather** and a **5-day forecast**
- See the **real-time London Underground (Tube) status** — which lines are running, which are delayed
- **Convert any currency to British Pounds** using live exchange rates
- Generate a **personalised day-by-day London itinerary** — you pick the number of days, who you're travelling with, your interests and budget, and AI writes the plan
- Browse an **interactive map** of London
- Explore **must-visit attractions** with opening hours, ticket prices and fun facts
- Discover **day trip options** from London (Oxford, Bath, Cambridge, Brighton and more)
- Learn about **London's neighbourhoods** — Shoreditch, Notting Hill, Camden, Greenwich and more

---

## 🏗️ How it's built — the pipeline

Here's how everything connects, in plain English:

```
YOU (the visitor)
      │
      │  Opens the website in your browser
      ▼
GITHUB PAGES  ──────────────────────────────────────────────
  index.html                                               │
  (This is the actual website you see. It runs entirely   │
  in your browser — the design, buttons, chatbot window,  │
  map, everything visual lives here.)                     │
                                                           │
  When you click a button or ask a question, it sends     │
  a request to the backend ──────────────────────────────►│
                                                           │
RENDER (Backend Server — Node.js/Express)  ◄──────────────┘
  server.js
  (This is the "brain" running on a cloud server.
  It keeps all the secret API keys safe — they never
  touch your browser. It handles these requests:)

  ├── /api/weather      → asks OpenWeatherMap for London weather
  ├── /api/forecast     → asks OpenWeatherMap for 5-day forecast
  ├── /api/itinerary    → asks Google Gemini to write a travel plan
  ├── /api/chat         → asks Google Gemini to answer a question
  └── /webhook          → (legacy Dialogflow endpoint, kept for reference)

  Then sends the answer back to your browser ──────────────►

YOUR BROWSER receives the answer and shows it on screen
```

### The external services used:

| Service | What it does | Cost |
|---|---|---|
| **Google Gemini AI** | Powers the chatbot and itinerary generator | Free tier |
| **OpenWeatherMap** | Live weather and 5-day forecast | Free tier |
| **TfL (Transport for London) API** | Live Tube status | Free, no key needed |
| **ExchangeRate API** | Live currency conversion | Free, no key needed |
| **OpenStreetMap / Leaflet** | Interactive map | Free, no key needed |
| **GitHub Pages** | Hosts the frontend website | Free |
| **Render** | Hosts the backend server | Free tier |
| **UptimeRobot** | Pings the server every 5 mins to keep it awake | Free |

---

## 🔐 Why is there a backend at all?

Good question. The website could technically call all these APIs directly from the browser — but that would mean anyone who views the page source could steal your API keys and rack up charges on your account.

The backend server acts as a **secure middleman**: the website asks the server "what's the weather?", the server uses its secret key to ask OpenWeatherMap, then passes the answer back. Your keys stay safe on the server and never appear in any file on GitHub.

---

## 📁 What each file does

```
london_tourism_chatbot/
│
├── index.html          The entire website — all the HTML, CSS styling,
│                       and JavaScript that runs in your browser.
│                       This is what GitHub Pages serves to visitors.
│
├── config.js           One line: the URL of the backend server.
│                       Update this if the Render URL ever changes.
│
├── server.js           The backend server. Runs on Render (not your computer).
│                       Handles all API calls and keeps keys secret.
│
├── package.json        Tells Node.js which libraries the backend needs.
│                       Running "npm install" reads this and downloads them.
│
├── render.yaml         Tells Render exactly how to build and run the server.
│                       Prevents configuration errors on deployment.
│
├── .env.example        A template showing which secret keys are needed.
│                       Copy this to ".env" and fill in real keys to run locally.
│
├── .gitignore          Tells Git which files to never upload.
│                       The real ".env" file (with actual keys) is listed here
│                       so it can never accidentally end up on GitHub.
│
└── README.md           This file.
```

---

## 🚀 How to run it yourself

### What you need first
- A computer with Node.js installed (nodejs.org — download the LTS version)
- API keys for: OpenWeatherMap, Google Maps, TripAdvisor, Google Gemini

### Steps

**1. Download the code**
```
git clone https://github.com/mithun-ksms/london_tourism_chatbot.git
cd london_tourism_chatbot
```

**2. Install the dependencies**
```
npm install
```

**3. Set up your secret keys**

Copy the template:
```
cp .env.example .env
```

Open `.env` in any text editor and fill in your real keys:
```
WEATHER_API_KEY=paste_your_openweathermap_key_here
MAPS_API_KEY=paste_your_google_maps_key_here
TRIPADVISOR_API_KEY=paste_your_tripadvisor_key_here
GEMINI_API_KEY=paste_your_gemini_key_here
```

**4. Start the server**
```
npm start
```

You should see: `🚀 Server running at http://localhost:3000`

**5. Open the website**

Open `index.html` directly in your browser. The weather, chatbot and itinerary will all work now.

---

## 🌍 How it's deployed (live version)

| Part | Platform | URL |
|---|---|---|
| Frontend (website) | GitHub Pages | mithun-ksms.github.io/london_tourism_chatbot |
| Backend (server) | Render | london-tourism-chatbot.onrender.com |
| Uptime monitoring | UptimeRobot | Pings backend every 5 min |

When you push a change to GitHub, Render automatically detects it and redeploys the backend within 2 minutes. GitHub Pages updates within 1-5 minutes.

---

## 👤 Author

**Mithun Surriya** — Erasmus Exchange Student  
GitHub: [@mithun-ksms](https://github.com/mithun-ksms)  
Project: London Tourism AI Chatbot — BSc Computer Science Erasmus Project
