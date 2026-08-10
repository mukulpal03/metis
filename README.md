# Metis ⚡

**Your AI coding assistant that lives in the terminal.**

Metis lets you chat with AI, run tools like web search and code sandboxes, and even generate entire apps — all from a single CLI command. Authenticate once through your browser, and you're in.

---

## What can Metis do?

### 💬 Chat
Talk to AI directly in your terminal. Responses stream in real-time with full markdown rendering. Every conversation is saved and can be picked up later.

### 🛠️ Tool Calling
Go beyond plain chat. Enable tools like **Google Search**, **Code Execution** (Python sandboxes), and **URL analysis** — the AI decides when to use them to give you better answers.

### 🤖 Agentic Mode
Describe what you want to build. Metis classifies your intent, generates the full project structure, writes every file, and drops it on your disk — ready to run.

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** (`npm i -g pnpm`)
- A **PostgreSQL** database ([Neon](https://neon.tech) free tier works)
- **Google Cloud** OAuth credentials
- An AI API key — **Google Gemini** and/or **OpenAI**

### Install

```bash
git clone https://github.com/mukulpal03/metis.git
cd metis

# Server
cd server && pnpm install

# Client
cd ../client && pnpm install
```

### Configure

Create `server/.env`:

```env
PORT=3000
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FRONTEND_URL=http://localhost:3001

# AI — at least one required
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key

# Optional
METIS_MODEL=gemini-2.5-flash       # default model
AI_PROVIDER=auto                   # auto | google | openai
```

Create `client/.env`:

```env
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

### Database Setup

```bash
cd server
npx prisma generate
npx prisma db push
```

### Run

```bash
# Terminal 1 — API server (port 3000)
cd server && pnpm dev

# Terminal 2 — Web dashboard (port 3001)
cd client && pnpm dev
```

### Use the CLI

```bash
cd server
pnpm build
npm link          # makes 'metis' available globally

metis login       # authenticate via browser
metis wakeup      # launch the AI mode selector
```

---

## CLI Commands

| Command        | What it does                                     |
| -------------- | ------------------------------------------------ |
| `metis login`  | Authenticate via Google OAuth device flow         |
| `metis logout` | Clear your stored token                          |
| `metis whoami` | Show your profile (name, email, token expiry)    |
| `metis wakeup` | Open the interactive mode selector               |

---

## How Authentication Works

```
metis login
  ↓ Requests a device code from the server
  ↓ Shows a user code + verification URL in your terminal
  ↓ Opens your browser to approve the device
  ↓ Polls until you approve
  ↓ Stores token locally at ~/.better-auth/token.json
  ✓ Done — you're authenticated
```

No tokens to copy-paste. Just approve in the browser and you're in.

---

## Available Tools

When in **Tool Calling** mode, you can enable any combination of these:

| Tool                    | Provider | What it does                       |
| ----------------------- | -------- | ---------------------------------- |
| Google Search           | Google   | Real-time web search               |
| Code Execution          | Google   | Run Python in a sandbox            |
| URL Context             | Google   | Fetch & analyze up to 20 URLs     |
| Web Search              | OpenAI   | Web search via OpenAI              |
| Code Interpreter        | OpenAI   | Run Python in a sandbox            |

Tools are automatically filtered to match your active AI provider.

---

## AI Provider Switching

Metis auto-detects which provider to use based on your model name:
- `gemini-*` → Google
- `gpt-*`, `o1*`, `o3*` → OpenAI

Or set `AI_PROVIDER` explicitly. If both API keys are present and no preference is set, it defaults to Google.

When you hit rate limits, Metis suggests switching to the other provider.

---

## Project Structure

```
metis/
├── client/                 # Web dashboard (Next.js)
│   ├── app/                # Pages — Home, Sign-In, Device Approval
│   ├── components/         # UI components
│   └── lib/                # Auth client, utilities
│
├── server/                 # API + CLI
│   ├── prisma/             # Database schema
│   └── src/
│       ├── cli/            # CLI app
│       │   ├── ai/         # AI service & provider resolution
│       │   ├── chat/       # Chat, Tool Calling, Agentic modes
│       │   └── commands/   # login, logout, whoami, wakeup
│       ├── config/         # Tool registry, agent config
│       ├── lib/            # Auth, DB, token management
│       ├── routes/         # Device auth routes
│       └── services/       # Conversation CRUD
│
└── CONTEXT.md              # Detailed architecture docs
```

---

## Tech Stack

**Server** — Express 5, Better-Auth, Prisma, PostgreSQL (Neon), Vercel AI SDK, Commander.js, Zod, tsup

**Client** — Next.js 16, React 19, Shadcn UI, Tailwind CSS 4, Better-Auth

**CLI UX** — Chalk, Figlet, Boxen, @clack/prompts, marked-terminal

---

## License

ISC

---

<p align="center">Built by <a href="https://github.com/mukulpal03">Mukul Pal</a></p>
