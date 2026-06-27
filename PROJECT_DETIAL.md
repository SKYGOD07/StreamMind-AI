Final Tech Stack
Frontend: Next.js 15 + TypeScript + Tailwind + shadcn/ui
Backend: Next.js API Routes + Server Actions
Realtime: WebSocket / SSE
AI: OpenRouter API
Database: SQLite + Prisma (fast for hackathon)
Authentication: Kick OAuth
Streaming Data: Official Kick API
Deployment: Vercel
Extension: Browser Extension (Phase 2 only)
Current MVP: Separate dashboard website

The official KICK developer flow is:

Create a developer app.
Obtain Client ID + Client Secret.
Configure OAuth Redirect URI.
Use OAuth to access user/channel information.

For local development, Kick apps require proper OAuth configuration and redirect URIs.

Project Name
StreamMind AI
Folder Setup

Open the terminal inside Antigravity IDE.

Run:

npx create-next-app@latest .

Answer:

TypeScript? → Yes
ESLint? → Yes
Tailwind? → Yes
src directory? → Yes
App Router? → Yes
Turbopack? → Yes
Import alias? → Yes

After installation:

npm install prisma @prisma/client
npm install openai
npm install lucide-react
npm install recharts
npm install socket.io socket.io-client
npm install zod
npm install clsx tailwind-merge
npm install next-themes
npm install react-hook-form
npm install @radix-ui/react-dialog
npm install @radix-ui/react-select
npm install @radix-ui/react-progress
npm install react-hot-toast
npm install better-auth
npm install @nekiro/kick-api

The @nekiro/kick-api package already wraps the official Kick API and handles OAuth token management, which will save significant development time during the hackathon.

After Packages Install

Run:

npx prisma init
First MVP Features (24-hour realistic scope)
Page 1 — Onboarding

Questions:

What is today's stream theme?

Examples:
"Valorant ranked with viewers"

What are today's goals?

✓ Find important questions
✓ Detect hype moments
✓ Filter spam
✓ Track audience mood

Anything AI should know?

Example:
Highlight sponsorship questions.
Page 2 — Live Dashboard

Widgets:

Chat Feed

Live messages.

AI Summary

Example:

Chat mostly discussing:
- New skin bundle
- Giveaway
- PC specs
Hype Meter
LOW ▓▓▓░░

HIGH ▓▓▓▓▓
Important Questions
"What keyboard do you use?"

"Will you play with viewers?"
Sentiment
😊 65%
😐 25%
😡 10%
Moderator Alerts
Spam spike detected.

Toxicity increased by 40%.
Your First Task

Create the Next.js project and install the packages.

When finished, send me:

A screenshot of the folder structure.
Confirmation that npm run dev works.
Your Node version (node -v).