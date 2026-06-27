# StreamMind AI - Implementation Plan (Updated)

StreamMind AI is an AI-powered real-time co-pilot for KICK streamers and moderators. It parses incoming chat, pre-processes it through a rule engine to deduplicate and filter spam, and uses `google/gemini-2.5-flash` via OpenRouter to generate summaries, sentiment analyses, confidence-rated recommendations, and timeline alerts.

---

## User Review Required

> [!IMPORTANT]
> **Developer / Demo Mode Toggle:**
> The dashboard will include a prominent toggle between **Live KICK Mode** and **Simulated Demo Mode**. 
> - Clicking **"Use Demo Stream"** will immediately bypass OAuth and run a high-fidelity local websocket simulator that emits structured mock chat messages (including hype spikes, spam floods, and toxic lines) designed to demonstrate the AI analytics and dashboard widgets instantly.

> [!TIP]
> **Pre-Processing Pipeline (Token Saver):**
> We will implement the user-suggested pipeline to optimize LLM calls:
> `Incoming Chat` ➔ `Rule Engine (Regex / Length checks)` ➔ `Deduplicate (sliding window check)` ➔ `Extract Questions & Detect Spam` ➔ `Aggregate Statistics (Cap ratio, Speed, Emotes)` ➔ `Send consolidated context (unanswered questions, topics, highlights) to OpenRouter AI` ➔ `Dashboard UI`.

---

## Open Questions
- None. All major design decisions have been resolved based on your feedback. We are using `google/gemini-2.5-flash` as the primary engine and `meta-llama/llama-3.3-70b-instruct` as fallback.

---

## Proposed Changes

### Component 1: Next.js Boilerplate & Core Setup

#### [NEW] [package.json](file:///c:/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/package.json)
- Setup Next.js 15, TypeScript, TailwindCSS, ESLint, App Router.
- Install dependencies:
  - Prisma & `@prisma/client`
  - `socket.io` & `socket.io-client`
  - `recharts` (charts)
  - `openai` (OpenRouter API client)
  - `zod` (validation)
  - `react-hook-form` (forms)
  - `lucide-react` (icons)
  - `clsx` & `tailwind-merge`
  - `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-progress`
  - `react-hot-toast`

#### [NEW] [server.js](file:///c:/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/server.js)
- A Node HTTP wrapper starting Next.js and mounting Socket.io.
- Hosts the simulated demo socket, handles incoming live chat streams, runs the pre-processing pipeline, and handles OpenRouter updates.

---

### Component 2: Database Schema & Setup

#### [NEW] [prisma/schema.prisma](file:///c:/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/prisma/schema.prisma)
Configure SQLite database with:
- **StreamSession:** Stores active session configurations (theme, goals, custom instructions, mode: "live" | "demo").
- **ChatMessage:** Stores raw / filtered chat history (sender, text, timestamp, isSpam, isQuestion, sentiment, toxicity).
- **TimelineEvent:** Logs milestone stream events (e.g. "02:14 PM 🔥 Hype spike", "02:17 PM 🎮 Valorant request spike").
- **AIInsight:** Stores periodic summary logs, questions, trending topics, and recommendations (with confidence scores).

---

### Component 3: Service Abstractions & Pipeline

#### [NEW] [kick.service.ts](file:///c:/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/src/services/kick.service.ts)
- Connects to Kick's public API or simulates real-time chat.
- In Demo Mode, generates customized messages according to the onboarding setup (e.g., Valorant ranked) to simulate live viewer interactions.

#### [NEW] [pipeline.service.ts](file:///c:/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/src/services/pipeline.service.ts)
Implements the pre-processing pipeline:
- **Deduplication:** Filters out redundant messages in a 10-second sliding window.
- **Rule Engine:** Fast checks for spam patterns, CAPS ratio, emote count.
- **Question Extraction:** Simple linguistic checks (contains "?") to flag potential questions before AI refinement.
- **Aggregations:** Calculates chat velocity (messages/min), emote spam ratio, and hype scores.

#### [NEW] [ai.service.ts](file:///c:/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/src/services/ai.service.ts)
- OpenRouter client wrapper utilizing `google/gemini-2.5-flash` with structured JSON output.
- Performs chat summarization, question ranking, sentiment validation, trending topic extraction, and action recommendations with **AI Confidence Scores**.

#### [NEW] [analytics.service.ts](file:///c:/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/src/services/analytics.service.ts)
- Calculates live mood values, updates Hype Meter status (Low / Medium / High), and commits key milestones to the `TimelineEvent` table.

---

### Component 4: Pre-Stream Onboarding Wizard

#### [NEW] [page.tsx](file:///c:/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/src/app/page.tsx)
- Landing page with "Launch Onboarding" wizard.
- Three steps:
  - Theme Input (e.g., "Valorant Ranked with Viewers")
  - Goal Selection (e.g., Detect hype, Track mood)
  - Custom AI Context (e.g., "Highlight sponsorship questions")
- Adds a **"Use Demo Stream (No OAuth)"** fast-track button.

---

### Component 5: Main Live Dashboard

#### [NEW] [dashboard/page.tsx](file:///c:/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/src/app/dashboard/page.tsx)
KICK-inspired dark layout featuring:
- **Top Bar:** Connection state, Toggle Mode button ("Live KICK" vs "Simulated Demo"), viewer count, and live uptime.
- **Left Sidebar:** Dashboard, Live Chat, AI Insights, Alerts.
- **Widgets:**
  1. **Live Chat Feed:** Chat lines with badges (Mod, Sub) and indicators for spam/sentiment flags.
  2. **AI Summary:** Main bulletin updating every 30 seconds.
  3. **Important Questions:** List with **One-Click Actions** (`[Address]`, `[Pin]`, `[Ignore]`).
  4. **Hype Meter:** Gaming-inspired gauge showing LOW/MEDIUM/HIGH levels.
  5. **Audience Mood:** Recharts donut chart showing positive, neutral, and negative ratios.
  6. **Moderator Alerts:** Scrolling list of triggered events (toxicity, scam links, spam spike).
  7. **Trending Topics:** Badge grid listing top chat topics.
  8. **Streamer Co-Pilot:** Actionable recommendations with **AI Confidence Scores** and quick actions.
  9. **Timeline Events:** Displays a scrolling vertical timeline of stream achievements (hype spikes, game spikes) resulting in a **Post-Stream Recap** view when the session ends.

---

### Component 6: CSS & Design System

#### [MODIFY] [globals.css](file:///c:/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/src/app/globals.css)
- Gaming UI styling with deep space blacks, glassmorphism, and neon green (`#53FC18`) colors.

---

## Verification Plan

### Automated Tests
- Confirm compilation using `npm run build`.
- Check TypeScript strict compliance.

### Manual Verification
- Test Onboarding wizard flow.
- Click "Use Demo Stream" and verify that simulated chat instantly flows, sentiment charts render, hype meter reacts, co-pilot cards render with confidence values, and timeline entries trigger on hype spikes.
