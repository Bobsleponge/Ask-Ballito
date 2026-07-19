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

Open http://localhost:3000 — the root redirects to `/ballito`.

## Environment variables

See [.env.example](.env.example). Supabase and OpenAI are required; all other
integrations degrade gracefully until configured.

## Database

Migrations live in [`supabase/migrations`](supabase/migrations):

1. `0001_init.sql` — extensions (`vector`, `postgis`), tables, triggers, indexes
2. `0002_match_businesses.sql` — semantic search RPC
3. `0003_rls.sql` — Row Level Security policies
4. `0004_seed_cities.sql` — city registry seed
5. `0005_exclude_seed_from_match.sql` — exclude fake seed rows from search

Apply them with the Supabase SQL editor, or the Supabase CLI:

```bash
supabase db push        # if using a linked project + supabase/migrations
# or run each file against SUPABASE_DB_URL with psql
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
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run ingest -- <city>` | Ingest top businesses per vertical from Google Places |
| `npm run enrich -- <city>` | Place Details + review/LLM service keywords + re-embed |
| `npm run clear:seed` | Delete leftover seeded test businesses |
| `npm run smoke -- "<query>"` | End-to-end concierge smoke test |

## Security

- Supabase Row Level Security on all tables; service-role key is server-only
- Rate limiting (Upstash) on AI routes
- Zod validation on all inputs
- Prompt-injection defenses ([`src/lib/ai/safety.ts`](src/lib/ai/safety.ts))

## Deployment (Vercel)

1. Import the repo into Vercel
2. Add all environment variables from `.env.example`
3. Set the Supabase Auth redirect URL to `https://<your-domain>/auth/callback`
4. Deploy

Sentry source-map upload runs automatically when `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG`, and `SENTRY_PROJECT` are set.
