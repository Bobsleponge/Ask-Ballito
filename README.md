# Ask Ballito

A multi-region AI concierge platform. Ask in natural language and get tailored
recommendations for local businesses and things to do — starting in **Ballito**
and built to expand across South Africa (Umhlanga, Durban, Cape Town,
Johannesburg) with zero architectural changes. City is treated as **data**, not
code.

## Tech stack

- **Next.js (App Router) + React 19 + TypeScript** — server components, streaming UI
- **Tailwind CSS v4 + shadcn/ui + Framer Motion** — design system and motion
- **Supabase** — Postgres, Auth, Storage, Row Level Security
- **pgvector + OpenAI Embeddings** — semantic search (no keyword matching)
- **OpenAI Responses API** — modular AI services
- **Zustand / TanStack Query / React Hook Form / Zod** — state, data, forms, validation
- **Sentry + PostHog** — monitoring and product analytics
- **Resend** — transactional email
- **Google Places API** — business data (behind a provider abstraction)
- **Upstash Redis** — rate limiting
- **Vercel** — hosting

## Getting started

### Windows 11 (fresh machine)

**A. Install system tools** (Admin PowerShell) — no repo required yet:

```powershell
winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements
```

Or, after cloning, run the same installs via:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Install-Prereqs.ps1
```

**B. Start Docker Desktop** and wait until the engine is running (`docker info`). Open a **new** terminal so `git` / `node` are on PATH.

**C. Clone and bootstrap** (OpenAI key required):

```powershell
git clone https://github.com/Bobsleponge/Ask-Ballito.git
cd Ask-Ballito
$env:OPENAI_API_KEY = "sk-..."
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Setup-App.ps1
```

If you are already inside the repo with Node + Docker ready:

```powershell
$env:OPENAI_API_KEY = "sk-..."
npm run setup:local
```

**D. Run the app**

```powershell
npm run dev
```

Open http://localhost:3000 — the root redirects to `/ballito`.

`setup:local` starts local Supabase in Docker, writes `.env.local`, applies migrations, and seeds demo login accounts.

### macOS / Linux

```bash
# 1. Install Node 20+ and Docker; start Docker
# 2. Configure OpenAI (required)
export OPENAI_API_KEY=sk-...

# 3. Bootstrap (npm install + supabase start + .env.local + migrate)
npm run setup:local

# 4. Develop
npm run dev
```

Open http://localhost:3000 — the root redirects to `/ballito`.

### Manual setup (any OS)

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
# then fill in real keys (Supabase + OpenAI are required)

# 3. Run database migrations (see "Database" below)

# 4. Develop
npm run dev
```

## Environment variables

See [.env.example](.env.example). Supabase and OpenAI are required; all other
integrations degrade gracefully until configured.

## Database

Migrations live in [`supabase/migrations`](supabase/migrations):

1. `0001_init.sql` — extensions (`vector`, `postgis`), tables, triggers, indexes
2. `0002_match_businesses.sql` — semantic search RPC
3. `0003_rls.sql` — Row Level Security policies
4. `0004_seed_cities.sql` — city registry seed
5. `0005_exclude_seed_from_match.sql` **and** `00051_grants.sql` — exclude fake seed rows from search + table grants (apply both)
6. `0006_cap_match_businesses.sql` — cap public RPC `match_count` at 50
7. `0007_lockdown_data_access.sql` — revoke anon vector RPC; hide embeddings; protect profiles/messages
8. `0008_ai_logs_retention.sql` — `purge_old_ai_logs()` helper (90-day retention)
9. `0009_business_claims.sql` — `is_admin`, `business_members`, `business_claims` + RLS
10. `0010_allow_service_role_set_admin.sql` — service_role may set `is_admin`
11. `0011_business_owner_content.sql` — `business_profiles`, specials, `business-media` storage
12. `0012_business_offerings.sql` — owner services/keywords/menu jsonb on profiles
13. `0013_portal_stage2.sql` — menu items table, gallery, invites, listing attrs
14. `0014_search_events.sql` — search events + trending (service_role)
15. `0015_city_events.sql` — city calendar events
16. `0016_listing_vertical.sql` — `listing_vertical` on profiles
17. `0017_search_ingest.sql` — ingest/restudy timestamps on businesses
18. `0018_profiles_abuse_suspended.sql` — admin chat abuse suspend flag

Apply them with the Supabase SQL editor, the Supabase CLI, or:

```bash
npm run migrate                 # local DB (127.0.0.1 / localhost)
CONFIRM_PROD=1 npm run migrate  # required for remote / production URLs
```

Regenerate DB types after schema changes:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

## Ingesting & enriching business data

Businesses come from **Google Places**. Discovery ingest pulls top results for
each industry vertical in [`src/config/verticals.ts`](src/config/verticals.ts),
embeds them, and upserts into Supabase. Browse at `/ballito/explore`.

Then **enrich** to build a service/keyword index (hybrid): Place Details for
every business, Google reviews for service-heavy verticals, LLM extraction of
`services` / `keywords` / amenities, then re-embed for better chat matching
(e.g. “acrylic nails”).

```bash
npm run ingest -- ballito                              # discover + embed
npm run enrich -- ballito                              # details + SEO extract
npm run enrich -- ballito --vertical=beauticians --limit=10
npm run enrich -- ballito --force                      # re-enrich all
npm run clear:seed                                     # delete any fake provider=seed rows
```

Requires `GOOGLE_PLACES_API_KEY` and `OPENAI_API_KEY` in `.env.local`.

Data sources sit behind a provider abstraction
([`src/services/providers`](src/services/providers)). `GooglePlacesProvider` is
live; `Facebook`, `Directory`, and `ManualSubmission` providers are stubbed
against the same `BusinessDataProvider` interface.

## AI architecture

Modular services in [`src/services/ai`](src/services/ai):

- `IntentAnalysisService` — structured intent extraction (Responses API + Zod schema)
- `BusinessSearchService` — embed query → pgvector match → metadata re-rank
- `RecommendationService` — grounded, streamed concierge answers
- `ConversationService` — orchestrates the full turn

Prompts are **versioned and isolated** in
[`src/lib/ai/prompts`](src/lib/ai/prompts). Every AI call is logged to `ai_logs`
and mirrored to Sentry/PostHog.

## Scripts

| Script | Description |
| --- | --- |
| `npm run setup:local` | Docker Supabase + `.env.local` + migrations + demo accounts |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run ingest -- <city>` | Ingest top businesses per vertical from Google Places |
| `npm run enrich -- <city>` | Place Details + review/LLM service keywords + re-embed |
| `npm run clear:seed` | Delete leftover seeded test businesses |
| `npm run smoke -- "<query>"` | End-to-end concierge smoke test |
| `npm run smoke:security` | Offline security unit checks (redirect, history, CSP helpers) |

## Security

- Supabase Row Level Security on all tables; service-role key is server-only (`server-only` import guard)
- **Upstash required in production** — `/api/chat`, `/api/photo`, `/api/trending`, `/api/events`, magic-link, and menu import fail closed without it
- Hybrid chat: **5 anonymous turns / 24h per IP**, then sign-in; signed-in users get **20/min burst** + **~50 turns/day** (100 units at 2/turn for multi-call cost) + app-wide **2000 chats / 24h** ceiling
- Discover feeds (`/api/trending`, `/api/events`): **60/min per IP** + CDN `Cache-Control` (`s-maxage=60`)
- Menu AI import: **5/hour per user** + **20/day per business**
- `match_businesses` is **service_role only**; anon/authenticated cannot SELECT `embedding` / `embedding_text`
- Zod validation on chat inputs; client history roles limited to `user` | `assistant`
- Prompt-injection: current message + history sanitized; flagged turns dropped; model history delimited ([`src/lib/ai/safety.ts`](src/lib/ai/safety.ts))
- Auth callback uses `NEXT_PUBLIC_SITE_URL` (not request Host); `next` paths sanitized
- Magic-link rate limited (5/hour per IP and email)
- Security headers (HSTS, CSP, frame denial, nosniff) via [`next.config.ts`](next.config.ts)
  - Residual: CSP still allows `'unsafe-inline'` / `'unsafe-eval'` for Next + Maps (nonce CSP is a follow-up)
- Photo proxy: path allowlist, no redirects, image content-type allowlist, rate-limited
- Menu import / media uploads: MIME from **magic bytes** (not client `File.type`)
- Sentry: `sendDefaultPii: false` + `beforeSend` scrubbing (emails, bearer/JWT, request bodies/cookies)
- Rate-limit IP trust model: prefer `x-vercel-forwarded-for` (Vercel platform header)

### Pre-launch ops checklist

1. Set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` on Vercel production
2. Set **OpenAI** and **Google Cloud** billing budgets / alerts (hard backstop beyond app rate limits)
3. Restrict **Google Maps browser key** (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) to production HTTP referrers
4. Restrict **Places server key** (`GOOGLE_PLACES_API_KEY`) — never expose client-side; IP/API restrictions as applicable
5. Confirm Supabase Auth redirect allowlist includes `https://<domain>/auth/callback`
6. Confirm `NEXT_PUBLIC_SITE_URL` matches the production origin
7. Apply migrations `0006`–`0018` on the **production** database (`CONFIRM_PROD=1 npm run migrate`)
8. Confirm `CRON_SECRET` is set on Vercel so daily crons run (`/api/cron/search-restudy`, `/api/cron/purge-ai-logs`)

### `ai_logs` retention / PII

Every orchestrated chat turn (and AI sub-call) may persist **user message text and planner I/O** to `ai_logs` via the service-role client. Access is service-role only (RLS enabled, no public policies).

**Policy (launch):** retain `ai_logs` for **90 days**. Purge runs daily via Vercel cron `GET /api/cron/purge-ai-logs` (Bearer `CRON_SECRET`), which calls `public.purge_old_ai_logs(90)` (migration `0008`). Do not export raw `ai_logs` to third parties without a legal review.

## Deployment (Vercel)

1. Import the repo into Vercel
2. Add all environment variables from `.env.example`
3. Set the Supabase Auth redirect URL to `https://<your-domain>/auth/callback`
4. Deploy

Sentry source-map upload runs automatically when `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG`, and `SENTRY_PROJECT` are set.
