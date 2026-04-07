# Pickleball for Patriots 🇺🇸

This web application was developed for the Aggie Club of Engineers’ Pickle for Patriots charity event. It replaces a fragmented mix of Google Forms, spreadsheets, and third-party bracket tools with a unified platform for registration, qualifying play, bracket generation, scoring, and administration. On the public side, participants and spectators can follow the tournament in real time.

## Features 🛜

Public

- Team registration for recreational or competitive divisions (no player accounts).
- Public qualifying view (when published).
- Public bracket view (when published).

Admin (Clerk‑protected)

- Team management (review/withdraw).
- Qualifying court assignment + round robin style scoring.
- Auto/manual selection of qualifying teams for main bracket.
- Bracket generation, including manual seeding.
- Scoring and advancement for bracket play.
- Overrides to undo match results safely.

## Tournament Format (Rules) 🏆

Each division has two stages:

1. **Qualifying (Round Robin)**
   - Teams are grouped into courts (2–4 teams per court).
   - Matches per court:
     - 4 teams: 6 matches (single round robin)
     - 3 teams: 6 matches (double round robin)
     - 2 teams: 3 matches (best‑of‑3 style)
   - Ranking: wins → point differential → points scored.
   - Top two teams per court advance.

2. **Bracket (Single Elimination)**
   - Uses only qualified teams when qualifying courts exist.
   - Bracket size is next power of two; byes auto‑advance.

## Important Considerations 💭

- **Admin Access** is currently granted to any authenticated Clerk user.
- **Publish gates**: public qualifying/bracket pages only show data after publish.

## Routes 🚏

Public

- /qualifying/recreational
- /qualifying/competitive
- /bracket/recreational
- /bracket/competitive

Admin (Clerk‑protected)

- /admin (Dashboard)
- /admin/teams
- /admin/qualifying
- /admin/bracket
- /admin/scoring
- /admin/overrides

## Tech Stack 🧰

- Next.js
- Supabase (Postgres + Auth)
- Clerk (Authentication)
- Stripe (Payments - WIP)

## Getting Started (Webmaster Team) 🧑‍💻

### 1) Install Dependencies

```bash
npm install
```

### 2) Start Supabase Locally

```bash
supabase start
```

### 3) Apply Migrations + Seed Mock Data

```bash
supabase db reset
```

### 4) Run the App

```bash
npm run dev
```

### 5) Open

- App: http://localhost:3000
- Supabase: http://127.0.0.1:54323

## Environment Variables 📄

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

WIP:

- Stripe:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_REC`
  - `STRIPE_PRICE_COMP`
  - `STRIPE_PRICE_SPECTATOR`
