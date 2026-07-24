# Ask Ballito — Comprehensive Improvement Approaches

Living roadmap for the six improvement areas identified after launch-readiness work.
Companion to [`docs/launch-readiness.md`](./launch-readiness.md).

**Last implementation pass:** 2026-07-21 — Phase A/B items for cost, AI, perf, product, security, and ops are largely shipped. Deferred: Stripe, nonce CSP, live pen-test/load, external billing console alerts.

### Implementation status (snapshot)

| Area | Shipped | Deferred / ops |
|---|---|---|
| Cost & reliability | Pricing + `$` on logs/admin; 24h new-account ramp; embedding cache; planner cache (10m); OpenAI soft-fail SSE | Circuit breaker narration skip; Redis weather (optional) |
| AI quality | Offline `eval:smoke`; grounding metrics; sticky write+read; composition PostHog; hybrid lexical fallback | Live recall@k CI; phone OTP / doc upload verification |
| Performance / UX | Photo CDN cache; streaming skeletons; discover skeletons; dynamic detail sheet; explore `revalidate=600` | Bundle analyzer pass; tag revalidation on ingest |
| Product | Self-serve export/delete; claim verification method picker | Stripe subscriptions; multi-city ingest (playbook below) |
| Security / platform | Demo emails server-only; timing-safe cron; private `business-media-private` + signed URLs | Nonce CSP; ZAP/Burp window |
| Ops / DX | `schema_migrations` ledger; `0019`/`0020`; CI smokes + eval smoke | OpenAI/Google console budget emails |

**How to use:** Prefer shipping Phase A before B unless noted. Status markers: ✅ shipped · ⏳ deferred.

Suggested sprint order (cross-cutting):

1. Cost observability + new-account ramp ✅
2. Retrieval eval + grounding metrics ✅ (offline smoke)
3. Streaming UX + explore/photo cache ✅
4. POPIA delete/export + claim verification ✅ (method UI; OTP later)
5. Migration ledger + media hardening ✅ (CSP deferred)
6. Subscriptions / multi-city — playbook only

---

## 1. Cost & reliability

### Goal
Make AI spend predictable, visible, and resilient under outages or abuse — without killing local DX.

### Current state
- Quotas: burst 20/min, anon 5/day/IP, user daily ~50 turns, user monthly 2000 units, global 2000/day, **new-account 20 units / first 24h**
- Budget threshold events at 50/75/90/100% (`ai_budget_threshold`)
- Admin AI usage: estimated **$**, tokens, top services
- `ai_logs` stores tokens + `estimated_cost_usd`
- Embedding + planner Upstash caches; weather in-process 15m
- OpenAI errors → soft `upstream_unavailable` SSE/JSON

### Phase A — Cost observability ✅
Pricing table, `estimateCostUsd`, persist `$` on logs, admin $, PostHog cost property.

### Phase B — New-account ramp ✅
Stricter Upstash limiter for accounts &lt; 24h; abuse event on hit.

### Phase C — Cache expensive AI/subcalls ✅
Embedding cache 24h; planner cache 10m on `(city, message, stickyHash)`; skip flagged inputs (never reach extractor).

### Phase D — OpenAI outage resilience ✅ (soft-fail; circuit breaker optional)
Classify upstream errors; user-safe SSE/JSON; optional circuit breaker later.

### Primary files
- `src/config/ai-pricing.ts`, `src/lib/ai/logging.ts`, `src/lib/ai/upstream-errors.ts`
- `src/lib/security/rate-limit.ts`, `src/app/api/chat/route.ts`
- `src/services/planner/planner-cache.ts`, `src/lib/ai/embeddings.ts`

---

## 2. AI quality

### Goal
Fewer hallucinations, better niche-service match, sticky multi-turn constraints, and evidence for composition choices.

### Current state
Grounding metrics in prod; sticky write+read; hybrid lexical fallback; offline `eval:smoke`; composition PostHog.

### Phase A — Eval harness ✅ offline / ⏳ live recall@k
`evals/queries.json` + `scripts/eval-smoke.ts` in CI. Live retrieval eval still optional.

### Phase B — Grounding metrics ✅
`ungrounded-phones` + PostHog `grounding_violation`.

### Phase C — Retrieval upgrades ✅
Hybrid lexical ILIKE when vector recall is weak; related-query map remains.

### Phase D — Conversation memory ✅
`conversations.sticky_summary` write after turn; load into planner context + constraint merge.

### Phase E — Composition instrumentation ✅
`composition_strategy` server event.

### Primary files
- `src/services/ai/conversation.service.ts`, `src/services/planner/sticky-summary.ts`
- `src/services/ai/business-search.service.ts`, `src/lib/chat/grounding-metrics.ts`

---

## 3. Performance / UX

### Current state
Explore `revalidate=600`; photo CDN cache; streaming skeletons; dynamic `BusinessDetailSheet`; discover skeletons.

### Phase A–C ✅
Streaming skeletons, photo Cache-Control, deferred detail sheet import. Maps remain external deep links (no JS SDK).

---

## 4. Product

### Phase A — Account export/delete ✅
Privacy page self-serve controls.

### Phase B — Claim verification ✅ method UI / ⏳ OTP + document upload
Wizard picks `self_attestation` | `email_domain` | `phone_otp` | `document`; admin shows method.

### Phase C — Subscriptions ⏳ Stripe when ready

### Phase D — Multi-city launch playbook

1. Enable city in `src/config/cities.ts`
2. `npm run migrate` (schema is city-agnostic)
3. Ingest Places → enrich embeddings → seed discover + `city_events`
4. Smoke 10 concierge queries + eval fixtures for that city
5. Flip enable flag; watch shared global cost cap + grounding
6. Claim CTA + explore directory smoke

---

## 5. Security / platform

### Phase A ✅
Demo emails server-only; timing-safe cron; menu imports → private bucket.

### Phase B ✅
`business-media-private` + signed URLs (15m); public bucket for logos/gallery.

### Phase C–D ⏳
Nonce CSP; ZAP/Burp + load window on staging.

---

## 6. Ops / DX

### Phase A ✅
`schema_migrations` ledger; `0019_improvements_foundation.sql`; `0020_private_menu_media.sql`.

### Phase B ✅
CI smokes + `eval:smoke`.

### Phase C–D ⏳ / Partial
Owner: OpenAI/Google console budgets; Sentry alert rules.

---

## Cross-cutting dependency map

```text
Cost observability ──► Admin $ dashboards ──► Spend ops alerts
New-account ramp ──► Abuse patterns ──► Claim verification
Retrieval eval ──► Ranker/hybrid search ──► Multi-city quality bar
Streaming UX ──► Composition logging ──► Product decisions
Migration ledger ──► Safer feature migrations (subscriptions, sticky, cost column)
```
