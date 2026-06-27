You are a senior full-stack engineer and product designer.

Build a production-quality hackathon project called "StreamMind AI".

# PROJECT OVERVIEW

StreamMind AI is an AI-powered real-time co-pilot for KICK streamers and moderators.

Problem:

Large streamers receive thousands of chat messages every minute and cannot read or understand everything happening in chat.

Small streamers also struggle to moderate, answer questions, and understand audience sentiment.

StreamMind AI solves this problem by continuously analyzing KICK chat in real-time and surfacing only the most important information.

The system should reduce information overload and help streamers focus on creating content.

# TARGET USERS

Primary:
- KICK Streamers

Secondary:
- KICK Moderators

# CORE IDEA

Instead of showing every chat message, AI filters, summarizes, prioritizes, and provides actionable insights.

The AI receives additional context from the streamer before the stream starts.

# PRE-STREAM ONBOARDING FLOW

Create a setup wizard.

Step 1:
Ask:
"What is today's stream about?"

Examples:
- Valorant ranked with viewers
- Tech podcast about AI
- Japan travel IRL stream

Step 2:
Ask:
"What are today's goals?"

Multiple selections:

- Detect important questions
- Detect hype moments
- Moderate spam
- Track audience mood
- Never miss important messages
- Increase engagement

Step 3:
Ask:
"Anything AI should know?"

Examples:

- Highlight sponsorship questions.
- Ignore political discussions.
- Prioritize VIP viewers.
- Notify me when viewers ask to play together.

Store this context.

The AI should use this context during analysis.

# MAIN DASHBOARD

Create a responsive dashboard inspired by KICK's UI design.

Design:
- Dark theme
- KICK-inspired design language
- Black background
- Dark gray cards
- Bright green accent color
- Modern glassmorphism
- Gaming aesthetic

Dashboard Layout:

LEFT SIDEBAR

Items:
- Dashboard
- Live Chat
- AI Insights
- Moderator Alerts
- Settings

TOP NAVBAR

Show:
- Connected streamer
- Stream status
- Viewer count
- Notifications

MAIN CONTENT

Widget 1:
LIVE CHAT FEED

Show incoming messages in real-time.

Widget 2:
AI SUMMARY

Examples:

"Chat is mostly discussing PC specs and asking about the giveaway."

Update every 30 seconds.

Widget 3:
IMPORTANT QUESTIONS

Examples:

"What keyboard do you use?"

"Will you play with viewers?"

Questions should be ranked by importance.

Widget 4:
HYPE METER

Detect excitement spikes.

Display:
Low -> Medium -> High

Detect:
- Sudden increase in chat volume
- Repeated words
- Emotes spam
- Caps messages

Widget 5:
AUDIENCE MOOD

Show:
Positive %
Neutral %
Negative %

Widget 6:
MODERATOR ALERTS

Examples:

- Spam spike detected.
- Toxicity increased.
- User flooding chat.
- Repeated scam links detected.

Widget 7:
TRENDING TOPICS

Examples:

1. Giveaway
2. Valorant
3. PC Specs

# AI FEATURES

Use OpenRouter API.

Models should perform:

- Chat summarization
- Question extraction
- Sentiment analysis
- Topic extraction
- Spam detection
- Toxicity detection
- Recommendation generation

# STREAMER COPILOT

Create an AI recommendation panel.

Examples:

"Viewers are repeatedly asking about your PC setup."

"Engagement is dropping. Consider starting a poll."

"Audience sentiment decreased significantly."

# TECH STACK

Frontend:
- Next.js 15
- TypeScript
- TailwindCSS
- shadcn/ui

Backend:
- Next.js API routes

Database:
- Prisma + SQLite

Realtime:
- Socket.io

Charts:
- Recharts

Validation:
- Zod

Forms:
- React Hook Form

# AUTHENTICATION

Implement KICK OAuth login.

Use official KICK OAuth.

Required environment variables:

KICK_CLIENT_ID
KICK_CLIENT_SECRET
KICK_REDIRECT_URI

# KICK API

Use the official KICK Public API.

The application should be designed so chat messages can be ingested from KICK APIs and processed in real-time.

Create service abstractions:

services/kick.service.ts
services/ai.service.ts
services/analytics.service.ts

# FOLDER STRUCTURE

Use clean architecture.

src/
components/
app/
services/
lib/
types/
hooks/
prisma/

# CODE QUALITY

Use:
- Strict TypeScript
- Reusable components
- Modular architecture
- Error boundaries
- Loading states
- Empty states
- Responsive design

Generate all pages, layouts, components, and mock data necessary for a complete hackathon MVP.

Use realistic fake chat data initially.[PROJECT_DETIAL.md](file;file:///c%3A/Users/intel/OneDrive/Documents/HACKTHON%20PROJECT/KICK%20HACKTHON%20PROJECT/PROJECT_DETIAL.md) 