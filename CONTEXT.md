# Metis Project Context & Architecture Documentation

## Overview
**Metis** is a monorepo project comprising a **Next.js frontend client** and an **Express.js backend server** with **Better-Auth** authentication, **Prisma ORM**, and **Neon PostgreSQL**. It powers both the **Metis Web Platform** (dashboard, device approval pages) and the **Metis CLI** — an AI-powered developer assistant with Google OAuth device-flow authentication, multi-provider AI support (Google Gemini & OpenAI), conversation persistence, and three distinct interaction modes: Chat, Tool Calling, and Agentic (autonomous code generation).

---

## Repository Structure

```
metis/
├── client/                         # Next.js 16 App Router Frontend
│   ├── app/
│   │   ├── (auth)/                 # Auth Route Group
│   │   │   ├── layout.tsx          # Auth group layout
│   │   │   └── sign-in/
│   │   │       └── page.tsx        # Sign In page (Protected against logged-in users)
│   │   ├── approve/
│   │   │   └── page.tsx            # Device authorization approval page
│   │   ├── device/
│   │   │   ├── approve/
│   │   │   │   └── (page)          # Device code approval sub-route
│   │   │   └── page.tsx            # Device code entry/redirect page
│   │   ├── globals.css             # Design system & CSS tokens
│   │   ├── layout.tsx              # Root Layout
│   │   └── page.tsx                # Home Dashboard (Protected, session check & user profile)
│   ├── components/
│   │   ├── ui/                     # Shadcn UI primitives (badge, button, card, input, label, separator, spinner)
│   │   └── login-form.tsx          # Metis CLI styled Google OAuth Login Form
│   ├── lib/
│   │   ├── auth-client.ts          # Better-Auth client instance
│   │   └── utils.ts                # cn() utility (class-variance-authority helper)
│   ├── .env                        # Client environment variables
│   └── package.json                # Next.js scripts (runs on port 3001)
│
├── server/                         # Express 5.x Backend API, Auth Server & CLI
│   ├── prisma/
│   │   └── schema.prisma           # PostgreSQL Schema (User, Session, Account, Verification, DeviceCode, Conversation, Message)
│   ├── src/
│   │   ├── cli/                    # Metis CLI Application
│   │   │   ├── main.ts             # CLI entry point (Commander, ASCII banner, command registration)
│   │   │   ├── ai/
│   │   │   │   ├── providers.ts    # ProviderFactory class (multi-provider AI model resolution, error formatting)
│   │   │   │   └── service.ts      # AIService class (streaming via streamText, tool-aware, multi-provider)
│   │   │   ├── chat/
│   │   │   │   ├── chat.ts         # 💬 Chat mode — conversational AI session with message persistence, shared display/save utilities
│   │   │   │   ├── tool-chat.ts    # 🛠️ Tool Calling mode — interactive tool selection, provider-filtered tools, tool execution display
│   │   │   │   └── agent-chat.ts   # 🤖 Agentic mode — autonomous coding agent, intent classification, structured app generation
│   │   │   └── commands/
│   │   │       ├── auth/
│   │   │       │   ├── login.ts    # `metis login`  — Device Authorization OAuth flow
│   │   │       │   ├── logout.ts   # `metis logout` — Clear stored token (with confirmation prompt)
│   │   │       │   └── whoami.ts   # `metis whoami` — Display authenticated user profile
│   │   │       └── ai/
│   │   │           └── wakeup.ts   # `metis wakeup` — Mode selector hub (Chat, Tools, Agentic, Exit)
│   │   ├── config/
│   │   │   ├── index.ts            # Centralized config (multi-provider keys, model name, re-exports tools & agent)
│   │   │   ├── gemini.ts           # Re-export alias for config
│   │   │   ├── tools.ts            # Tool registry (Google Search, Code Execution, URL Context, OpenAI Web Search, Code Interpreter)
│   │   │   └── agent.ts            # Autonomous app generation (ApplicationSchema, generateApplication with structured output)
│   │   ├── lib/
│   │   │   ├── auth.ts             # Better-Auth server configuration (Prisma, Google OAuth, device auth plugin)
│   │   │   ├── config.ts           # CLI filesystem paths (CONFIG_DIR, TOKEN_FILE)
│   │   │   ├── db.ts               # Prisma Client with pg adapter, lazy loading, clean disconnect
│   │   │   └── token.ts            # Token management (store, read, clear, expiry check, requireAuth)
│   │   ├── routes/
│   │   │   └── device.routes.ts    # GET /device — redirects device code auth from backend → frontend
│   │   ├── services/
│   │   │   └── chat.ts             # ChatService class — conversation & message CRUD, AI message formatting
│   │   └── index.ts                # Express entry point & middleware (/api/auth/*splat, CORS, device routes, /health)
│   ├── .env                        # Server environment variables
│   └── package.json                # Express + CLI scripts (bin: metis → dist/cli/main.js)
│
├── CONTEXT.md                      # Project architecture & development context (this file)
└── .gitignore
```

---

## Environment & Port Mapping

| Service | Local URL | Port Command | Environment Variable |
|---|---|---|---|
| **Server (Express)** | `http://localhost:3000` | `pnpm dev` in `/server` | `PORT=3000` |
| **Client (Next.js)** | `http://localhost:3001` | `next dev -p 3001` in `/client` | `NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000` |

---

## Metis CLI

### Overview
The CLI is built with **Commander.js**, styled with **Chalk**, **Figlet** (ASCII banner), **Boxen** (framed output), and uses **@clack/prompts** for interactive UI. Terminal markdown rendering is powered by **marked** + **marked-terminal**. It is registered as a binary (`metis`) in `server/package.json`.

### Commands

| Command | File | Description |
|---|---|---|
| `metis login` | `cli/commands/auth/login.ts` | Authenticate via OAuth Device Authorization flow |
| `metis logout` | `cli/commands/auth/logout.ts` | Clear stored authentication token (with confirmation prompt) |
| `metis whoami` | `cli/commands/auth/whoami.ts` | Display current user's session profile (name, email, token, expiry) |
| `metis wakeup` | `cli/commands/ai/wakeup.ts` | Mode selector hub — launches Chat, Tool Calling, or Agentic sessions |

### CLI Authentication Flow (`metis login`)
1. Requests a **device code** from the backend (`POST /device/code`) via Better-Auth's `deviceAuthorization` plugin.
2. Displays a **user code** and **verification URL** in the terminal.
3. Optionally opens the browser to the verification URL.
4. **Polls** the backend (`device.token`) until the user approves the device in the browser.
5. On approval, resolves the user identity (via session API or direct DB lookup on `DeviceCode.userId`).
6. **Stores** the token + user data to `~/.better-auth/token.json`.
7. **Upserts** the user record in the database.

### Token Management (`lib/token.ts` + `lib/config.ts`)
- **Storage**: `~/.better-auth/token.json` (JSON with `access_token`, `refresh_token`, `token_type`, `scope`, `expires_at`, `created_at`, `user`).
- **Functions**: `getStoredToken()`, `storeToken()`, `clearStoredToken()`, `isTokenExpired()` (5-min buffer), `requireAuth()` (guard for protected CLI commands).

---

## AI Service & Providers

### Multi-Provider Architecture (`cli/ai/providers.ts`)
- **ProviderFactory** class dynamically resolves the AI `LanguageModel` based on environment configuration.
- Supports **`@ai-sdk/google`** (Google Gemini) and **`@ai-sdk/openai`** (OpenAI) providers.
- **Provider resolution logic** (`ProviderFactory.getModel()`):
  1. Explicit provider via `AI_PROVIDER` env var (`google`, `gemini`, `openai`).
  2. Auto-detection based on model name prefix (`gpt-*`, `o1*`, `o3*` → OpenAI; `gemini-*` → Google).
  3. Fallback based on available API keys (defaults to Google if both present).
- **Error formatting** (`ProviderFactory.formatError()`): Detects 429/quota/rate-limit errors and suggests switching to the alternative provider.
- Returns a `ResolvedModel` containing `model`, `providerName`, `modelName`, and `apiKey`.

### AIService (`cli/ai/service.ts`)
- Wraps the resolved model from `ProviderFactory`.
- `sendMessage()`: Streams AI responses via Vercel AI SDK `streamText`, supports:
  - `onChunk` callback for real-time streaming to terminal.
  - `onToolCall` callback for tool execution notifications.
  - Optional `tools` parameter (ToolSet) — falls back to `getEnabledTools()` if not provided.
  - `maxSteps: 5` for multi-step tool calling.
- `getMessage()`: Non-streaming wrapper that returns full content string.
- `getProviderInfo()`: Returns current provider name and model name.
- `getLanguageModel()`: Returns raw `LanguageModel` instance for direct use (e.g., `generateObject`).
- System prompt identifies Metis with current provider/model context.

### Tool Registry (`config/tools.ts`)
Integrated support for provider-specific tools:

| Tool ID | Name | Provider | Description |
|---|---|---|---|
| `google_search` | Google Search | Google | Real-time web search via Gemini |
| `google_code_execution` | Google Code Execution | Google | Python sandbox via Gemini |
| `google_url_context` | Google URL Context | Google | Fetch & analyze URL content (up to 20 URLs) |
| `openai_web_search` | OpenAI Web Search | OpenAI | Web search via OpenAI |
| `openai_code_interpreter` | OpenAI Code Interpreter | OpenAI | Python sandbox via OpenAI |

- **Functions**: `getEnabledTools()`, `enableTools()`, `toggleTool()`, `getEnabledToolNames()`, `resetTools()`.
- Tools are lazily instantiated via `getTool()` factory functions.
- Provider compatibility filtering ensures only compatible tools are offered.

---

## Chat Modes & Conversation System

### Wakeup Command (`metis wakeup`)
- Requires authentication (`requireAuth()`).
- Fetches user info from the database.
- Presents an interactive mode selector loop:
  - **💬 Chat with Metis** → `startChat()` from `chat/chat.ts`
  - **🛠️ Tool Calling** → `startToolChat()` from `chat/tool-chat.ts`
  - **🤖 Agentic Mode** → `startAgentChat()` from `chat/agent-chat.ts`
  - **❌ Exit Metis** → Ends session
- After a mode session ends, returns to the mode selector (loop).

### Chat Mode (`cli/chat/chat.ts`)
- Conversational AI with streaming responses rendered to terminal.
- Persists messages to database via `ChatService`.
- Auto-titles conversations based on first user message.
- Supports session resumption via `conversationId`.
- Displays previous messages when resuming a conversation.
- **Shared exports** used by all modes:
  - `displayMessage()` — Renders boxen-styled chat bubbles (user right-aligned, assistant left-aligned) with marked-terminal markdown formatting.
  - `displayMessages()` — Renders message history.
  - `saveMessage()` — Persists messages via `ChatService.addMessage()`.
  - `updateConversationTitle()` — Updates conversation title via `ChatService.updateConversationTitle()`.

### Tool Calling Mode (`cli/chat/tool-chat.ts`)
- Interactive tool selector via `@clack/prompts` `multiselect` — filters available tools by current AI provider.
- Displays enabled tool names in session info box.
- During AI responses, shows real-time tool execution status (search, code sandbox, URL fetch, map query labels).
- Tracks and displays executed tool names after response.
- Resets tool state on session exit.

### Agentic Mode (`cli/chat/agent-chat.ts`)
- **Intent Classification**: Uses `generateObject` with Zod schema to classify user input as a build request vs. general conversation.
- **Non-build requests**: Returns conversational AI response.
- **Build requests**: Executes `generateApplication()` from `config/agent.ts`:
  - Uses `generateObject` with `ApplicationSchema` to generate structured project output.
  - Creates folder structure, writes all files to disk.
  - Safety check: Auto-generates missing `script.js` for HTML web projects and patches `<script>` tag into HTML.
  - Displays file tree, creation progress, and setup commands.
  - Returns `GeneratedAppResult` with folder name, app directory, file list, and commands.
- Falls back to local session mode if database is offline.

### ChatService (`services/chat.ts`)
- Database-backed conversation & message management via Prisma.
- **Methods**:
  - `createConversation()` — Creates new conversation for a user with mode and title.
  - `getOrCreateConversation()` — Resumes existing or creates new conversation (includes messages on resume).
  - `addMessage()` — Adds a message (stringifies objects to JSON).
  - `getMessages()` — Retrieves ordered messages, parses JSON content.
  - `getUserConversations()` — Lists user's conversations with message counts.
  - `deleteConversation()` — Deletes conversation (with optional user ownership check).
  - `updateConversationTitle()` — Updates title (with optional user ownership check).
  - `formatMessagesForAI()` — Converts DB messages to Vercel AI SDK `ModelMessage[]` format.

---

## Key Authentication Setup Details

### 1. Backend Authentication (`server/src/lib/auth.ts`)
- Configured using **Better-Auth** with `prismaAdapter`.
- **Plugins**: `deviceAuthorization({ expiresIn: "30m", interval: "5s" })` enabled for CLI authentication flow.
- **Trusted Origins**: Includes `http://localhost:3001`, `http://127.0.0.1:3001`, and `process.env.FRONTEND_URL`.
- **Google Social Provider**: Configured with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **Express Route Handling** (`server/src/index.ts`):
  Uses `app.all("/api/auth/*splat", toNodeHandler(auth))` for Express 5 / `path-to-regexp` v8 compatibility.
  CORS enabled with `credentials: true` for origins `http://localhost:3001` and `http://127.0.0.1:3001`.
  Health check endpoint: `GET /health`.

### 2. Frontend Authentication (`client/lib/auth-client.ts`)
- Created using `createAuthClient` from `better-auth/react`.
- `baseURL` configured to `process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"`.

### 3. Route Protection Logic
- **Home Page (`client/app/page.tsx`)**:
  - Checks active session via `authClient.useSession()`.
  - Redirects unauthenticated users to `/sign-in`.
  - Renders user profile (avatar, name, email, user ID) with session verification badge and a Sign Out button calling `authClient.signOut()`.
- **Sign-In Page (`client/app/(auth)/sign-in/page.tsx`)**:
  - Checks active session via `authClient.useSession()`.
  - Redirects already-authenticated users to `/`.
  - Displays `LoginForm` with Google Social Sign-In (`authClient.signIn.social({ provider: "google", callbackURL: ... })`).

### 4. Device Authorization Pages (Frontend)
- **`/device`** — Device code entry / redirect page for CLI auth flow.
- **`/approve`** — Device authorization approval page where the user confirms the CLI device code.
- **Backend route** (`GET /device`) in `device.routes.ts` redirects from the backend to the frontend with the `user_code` query parameter.

---

## Database

### Prisma Schema (`server/prisma/schema.prisma`)
**Provider**: PostgreSQL (Neon) via `@prisma/adapter-pg`

| Model | Purpose |
|---|---|
| `User` | User profile (id, name, email, emailVerified, image, timestamps). Has relations to Sessions, Accounts, Conversations. |
| `Session` | Auth sessions (token, expiresAt, ipAddress, userAgent, linked to User) |
| `Account` | OAuth accounts (providerId, accountId, accessToken, refreshToken, linked to User) |
| `Verification` | Email/identity verification records |
| `DeviceCode` | Device authorization codes (deviceCode, userCode, userId, status, expiresAt, pollingInterval) |
| `Conversation` | Chat conversations (id via cuid, userId, title, mode [chat/tools/agentic], timestamps). Has relation to Messages. |
| `Message` | Chat messages (id via cuid, conversationId, role [user/assistant], content, createdAt). Indexed by conversationId. |

### Database Client (`server/src/lib/db.ts`)
- Uses **`@prisma/adapter-pg`** with a `pg.Pool` for connection management.
- **Lazy loading**: Sets `globalThis.__metis_db_loaded` flag so the CLI entry point knows whether to disconnect.
- **Clean disconnect**: `disconnectDb()` disconnects both Prisma and the underlying pg pool (critical for CLI commands to exit cleanly).
- **SSL handling**: Rewrites `sslmode=require` → `sslmode=verify-full`, suppresses TLS warnings.
- **Pool config**: `max: 5`, `connectionTimeoutMillis: 10000`, `idleTimeoutMillis: 5000`.

---

## Google Cloud Console OAuth Configuration
- **OAuth Client Type**: **Web Application** (Required for server-side OAuth callback redirect flow).
- **Authorized JavaScript origins**:
  - `http://localhost:3000`
  - `http://localhost:3001`
- **Authorized redirect URIs**:
  - `http://localhost:3000/api/auth/callback/google`

---

## Environment Variables Reference

### Backend (`server/.env`)
```env
PORT=3000
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FRONTEND_URL=http://localhost:3001
GOOGLE_GENERATIVE_AI_API_KEY=...      # Also accepts GEMINI_API_KEY
OPENAI_API_KEY=...                    # Optional, used if AI_PROVIDER=openai (also accepts OPENAI_KEY)
METIS_MODEL=gemini-2.5-flash          # Optional, also accepts METIS-MODEL or AI_MODEL
AI_PROVIDER=auto                      # Options: google, gemini, openai, auto (also accepts METIS_PROVIDER)
```

### Frontend (`client/.env`)
```env
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

---

## Key Dependencies

### Server
| Package | Purpose |
|---|---|
| `express` (v5) | HTTP server |
| `better-auth` | Authentication framework (Google OAuth, device authorization) |
| `@prisma/client` + `@prisma/adapter-pg` | Database ORM with PostgreSQL adapter |
| `pg` | PostgreSQL connection pool |
| `commander` | CLI framework |
| `@clack/prompts` | Interactive CLI prompts |
| `chalk`, `figlet`, `boxen` | CLI styling and ASCII art |
| `yocto-spinner` | CLI loading spinners |
| `marked` + `marked-terminal` | Terminal markdown rendering for chat responses |
| `ai` + `@ai-sdk/google` + `@ai-sdk/openai` | Vercel AI SDK with Google Gemini & OpenAI providers |
| `open` | Opens URLs in the user's browser |
| `zod` | Schema validation (tool configs, structured AI output) |
| `dotenv` | Environment variable loading |
| `tsup` | Build tool for ESM bundles |
| `tsx` | TypeScript execution for development |

### Client
- `next` (v16), `react`, Shadcn UI (badge, button, card, input, label, separator, spinner), `lucide-react`, `better-auth` client, `class-variance-authority`
