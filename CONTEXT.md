# Metis Project Context & Architecture Documentation

## Overview
**Metis** is a monorepo project comprising a **Next.js frontend client** and an **Express.js backend server** with **Better-Auth** authentication, **Prisma ORM**, and **Neon PostgreSQL**. It powers both the **Metis Web Platform** (dashboard, device approval pages) and the **Metis CLI** — an AI-powered developer assistant with Google OAuth device-flow authentication and a Gemini-backed conversational AI.

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
│   │   ├── ui/                     # Shadcn UI primitives (button, card, input, label, separator)
│   │   └── login-form.tsx          # Metis CLI styled Google OAuth Login Form
│   ├── lib/
│   │   └── auth-client.ts          # Better-Auth client instance
│   ├── .env                        # Client environment variables
│   └── package.json                # Next.js scripts (runs on port 3001)
│
├── server/                         # Express 5.x Backend API, Auth Server & CLI
│   ├── prisma/
│   │   └── schema.prisma           # PostgreSQL Schema (User, Session, Account, Verification, DeviceCode)
│   ├── src/
│   │   ├── cli/                    # Metis CLI Application
│   │   │   ├── main.ts             # CLI entry point (Commander, ASCII banner, command registration)
│   │   │   ├── ai/
│   │   │   │   └── service.ts      # AIService class (Gemini via Vercel AI SDK, streaming)
│   │   │   └── commands/
│   │   │       ├── auth/
│   │   │       │   ├── login.ts    # `metis login`  — Device Authorization OAuth flow
│   │   │       │   ├── logout.ts   # `metis logout` — Clear stored token
│   │   │       │   └── whoami.ts   # `metis whoami` — Display authenticated user profile
│   │   │       └── ai/
│   │   │           └── wakeup.ts   # `metis wakeup` — Wake up Metis AI (chat, tools, agentic modes)
│   │   ├── config/
│   │   │   ├── index.ts            # Centralized config (Google API key, model name)
│   │   │   └── gemini.ts           # Re-export alias for config
│   │   ├── lib/
│   │   │   ├── auth.ts             # Better-Auth server configuration (Prisma, Google OAuth, device auth plugin)
│   │   │   ├── config.ts           # CLI filesystem paths (CONFIG_DIR, TOKEN_FILE)
│   │   │   ├── db.ts               # Prisma Client with pg adapter, lazy loading, clean disconnect
│   │   │   └── token.ts            # Token management (store, read, clear, expiry check, requireAuth)
│   │   ├── routes/
│   │   │   └── device.routes.ts    # GET /device — redirects device code auth from backend → frontend
│   │   └── index.ts                # Express entry point & middleware (/api/auth/*splat, CORS, device routes)
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
The CLI is built with **Commander.js**, styled with **Chalk**, **Figlet** (ASCII banner), **Boxen** (framed output), and uses **@clack/prompts** for interactive UI. It is registered as a binary (`metis`) in `server/package.json`.

### Commands

| Command | File | Description |
|---|---|---|
| `metis login` | `cli/commands/auth/login.ts` | Authenticate via OAuth Device Authorization flow |
| `metis logout` | `cli/commands/auth/logout.ts` | Clear stored authentication token |
| `metis whoami` | `cli/commands/auth/whoami.ts` | Display current user's session profile (name, email, token, expiry) |
| `metis wakeup` | `cli/commands/ai/wakeup.ts` | Wake up Metis AI — select between Chat, Tool Calling, and Agentic modes |

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

### AI Service & Providers (`cli/ai/service.ts` & `cli/ai/providers.ts`)
- Uses **Vercel AI SDK** (`ai` package) with support for **`@ai-sdk/google`** (Gemini) and **`@ai-sdk/openai`** providers.
- **ProviderFactory**: Dynamically resolves the AI model and provider based on environment configurations (`AI_PROVIDER`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`). Handles API quota/rate-limiting errors gracefully with user-friendly fallback suggestions.
- `AIService` class streams responses using `streamText` and collects text via `generateText`.
- **Tool Calling** (`config/tools.ts`): Integrated support for tools like Web Search (Google/OpenAI), Code Execution, and URL Context. These tools are dynamically injected into the stream context.

### Wakeup Command (`metis wakeup` & `cli/chat/chat.ts`)
- Requires authentication (`requireAuth()`).
- Fetches user info from the database and initializes a `ChatService` session.
- Presents an interactive mode selector:
  - **💬 Chat with Metis** — Conversational AI mode with support for returning to the main menu ("exit", "menu", "back"). Markdown formatting and AI streaming via `yocto-spinner` are fully supported.
  - **🛠️ Tool Calling** — Interactive selector for enabling tools like Web Search and Code Execution before starting a chat session.
  - **🤖 Agentic Mode** — Coming soon placeholder.
- **Interactive Menu Navigation**: Users can seamlessly back out from active chat sessions to the main mode selector.

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

### 2. Frontend Authentication (`client/lib/auth-client.ts`)
- Created using `createAuthClient` from `better-auth/react`.
- `baseURL` configured to `process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"`.

### 3. Route Protection Logic
- **Home Page (`client/app/page.tsx`)**:
  - Checks active session via `authClient.useSession()`.
  - Redirects unauthenticated users to `/sign-in`.
  - Renders user profile (avatar, name, email, user ID) and a Sign Out button calling `authClient.signOut()`.
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
| `User` | User profile (id, name, email, emailVerified, image, timestamps) |
| `Session` | Auth sessions (token, expiresAt, ipAddress, userAgent, linked to User) |
| `Account` | OAuth accounts (providerId, accountId, accessToken, refreshToken, linked to User) |
| `Verification` | Email/identity verification records |
| `DeviceCode` | Device authorization codes (deviceCode, userCode, userId, status, expiresAt, pollingInterval) |

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
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENAI_API_KEY=...                  # Optional, used if AI_PROVIDER=openai
METIS_MODEL=gemini-2.5-flash        # Optional, defaults to gemini-2.5-flash
AI_PROVIDER=auto                    # Options: google, openai, auto
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
| `ai` + `@ai-sdk/google` | Vercel AI SDK with Google Gemini provider |
| `open` | Opens URLs in the user's browser |
| `zod` | Schema validation |
| `dotenv` | Environment variable loading |
| `tsup` | Build tool for ESM bundles |
| `tsx` | TypeScript execution for development |

### Client
- `next` (v16), `react`, Shadcn UI, `better-auth` client
