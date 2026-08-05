# Metis Project Context & Architecture Documentation

## Overview
**Metis** is a monorepo project comprising a **Next.js frontend client** and an **Express.js backend server** with **Better-Auth** authentication, **Prisma ORM**, and **Neon PostgreSQL**. It powers both the Metis Web Platform and Metis CLI developer workflows.

---

## Repository Structure

```
metis/
├── client/                 # Next.js 16 App Router Frontend
│   ├── app/
│   │   ├── (auth)/         # Auth Route Group
│   │   │   ├── layout.tsx  # Auth group layout
│   │   │   └── sign-in/    # Sign In page (Protected against logged-in users)
│   │   │       └── page.tsx
│   │   ├── globals.css     # Design system & CSS tokens
│   │   ├── layout.tsx      # Root Layout
│   │   └── page.tsx        # Home Dashboard (Protected, session check & user profile)
│   ├── components/
│   │   ├── ui/             # Shadcn UI primitives (button, card, input, label, separator)
│   │   └── login-form.tsx  # Metis CLI styled Google OAuth Login Form
│   ├── lib/
│   │   └── auth-client.ts  # Better-Auth client instance
│   ├── .env                # Client environment variables (NEXT_PUBLIC_BETTER_AUTH_URL)
│   └── package.json        # Next.js scripts (runs on port 3001)
│
├── server/                 # Express 5.x Backend API & Auth Server
│   ├── prisma/
│   │   └── schema.prisma   # PostgreSQL Schema (User, Session, Account, Verification)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── auth.ts     # Better-Auth server configuration (Prisma, Google OAuth, device authorization)
│   │   │   └── db.ts       # Prisma Client database instance
│   │   └── index.ts        # Express entry point & middleware (/api/auth/*splat)
│   ├── .env                # Server environment variables (PORT, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, etc.)
│   └── package.json        # Express server scripts (runs on port 3000)
└── CONTEXT.md              # Project architecture & development context
```

---

## Environment & Port Mapping

| Service | Local URL | Port Command | Environment Variable |
|---|---|---|---|
| **Server (Express)** | `http://localhost:3000` | `pnpm dev` in `/server` | `PORT=3000` |
| **Client (Next.js)** | `http://localhost:3001` | `next dev -p 3001` in `/client` | `NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000` |

---

## Key Authentication Setup Details

### 1. Backend Authentication (`server/src/lib/auth.ts`)
- Configured using **Better-Auth** with `prismaAdapter`.
- **Plugins**: `deviceAuthorization()` enabled for CLI authentication flow.
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
  - Displays `LoginForm` with Google Social Sign-In (`authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}/` })`).

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
```

### Frontend (`client/.env`)
```env
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```
