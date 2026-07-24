# Ask Ballito — Launch Readiness Security Program

Living assessment mapped to the 20-phase launch framework and 4-stage gate.
Last updated: 2026-07-21.

**Status legend:** Strong · Partial · Missing · N/A · Deferred

---

## Gate status

| Gate | Status | Exit criteria |
|---|---|---|
| 0 Gap matrix | Done | This document |
| 1 Automated scan | Done | Audit log below; Dependabot + CI; smoke green |
| 2 Authz / RLS | Done | Demo login locked; RLS matrix; authz smoke |
| 3 AI / cost | Done | Red-team smoke; monthly quota; spend alerts; admin usage; abuse suspend |
| 4 Prod ops | Done | Privacy/terms; launch checklist; robots.txt |

---

## Phase matrix (1–20)

| Phase | Topic | Status | Notes |
|---|---|---|---|
| 1 | Infrastructure & secrets | Partial | Zod env + `server-only` admin client; rotate keys before public launch (checklist). No OpenAI/service role in client. |
| 2 | Authentication | Partial | Supabase Google + magic link; magic-link RL; demo login hardened (Gate 2). MFA deferred. Verify JWT/refresh in Supabase dashboard. |
| 3 | Authorization | Strong | `requireAdmin` / `requireBusinessMember` on pages + Server Actions; chat schema rejects `system` role. |
| 4 | Supabase RLS | Strong | See RLS matrix below; lockdown `0006`–`0007`; local schema through `0018` verified. |
| 5 | API security | Strong | Chat/photo/discover RL fail-closed; Zod on chat; crons Bearer `CRON_SECRET`. |
| 6 | AI security | Partial | Injection sanitize + history wrap; red-team smoke (Gate 3); grounding helpers present. |
| 7 | Business logic | Partial | Anon→auth hybrid; quotas; no subscriptions yet. |
| 8 | Payment | N/A | Stripe not shipped. |
| 9 | File upload | Strong | Magic-byte sniff on Storage + menu import; size limits; no SVG. |
| 10 | XSS | Partial | Text-node rendering for assistant prose; CSP soft (`unsafe-inline`/`unsafe-eval`). |
| 11 | CSRF | Strong | SameSite cookies via Supabase SSR; Server Actions origin-bound. |
| 12 | SQL injection | Strong | Parameterized Supabase client; RPC locked to service_role. |
| 13 | Storage | Partial | Public `business-media` + private `business-media-private` for menu imports (signed URLs 15m). |
| 14 | Privacy / POPIA | Strong | Privacy/Terms/Cookies; `ai_logs` 90d purge; self-serve export/delete on Privacy page. |
| 15 | Logging | Strong | Sentry `sendDefaultPii: false` + `beforeSend` scrub; no secrets in abuse events. |
| 16 | Monitoring | Partial | Sentry + PostHog; abuse events; AI budget threshold events (Gate 3). Configure billing alerts in OpenAI/Google consoles. |
| 17 | Load / attack | Deferred | Schedule dedicated load/pen-test window post Gate 1–3. |
| 18 | Penetration testing | Deferred | ZAP/Burp manual window after staging URL exists. |
| 19 | Dependencies | Strong | Dependabot + CI `npm audit` (Gate 1). |
| 20 | Production checklist | Partial | See Launch checklist; owner must complete ops items. |

### AskBallito-specific AI cost & abuse

| Control | Status |
|---|---|
| Per-minute burst (20/min) | Strong |
| Anon daily (5/IP) | Strong |
| User daily (~50 turns) | Strong |
| User monthly quota | Strong (Gate 3) |
| Global daily ceiling (2000) | Strong |
| Spend threshold alerts (50/75/90/100%) | Strong (Gate 3) |
| Admin usage visibility | Strong (Gate 3) |
| Abuse suspend flag | Strong (Gate 3) |
| New-account ramp | Strong (24h / 20 units) |
| Lifetime quota | Deferred |
| Subscription / premium model gate | N/A |

---

## RLS matrix (summary)

| Table / object | Anon read | Auth read | Auth write | Notes |
|---|---|---|---|---|
| `cities` | Yes | Yes | No | Public registry |
| `businesses` (non-embedding cols) | Yes | Yes | No | Embeddings column revoked |
| `match_businesses` RPC | No | No | service_role | Lockdown 0007 |
| `profiles` | Own | Own | Own (not `is_admin` / abuse via admin) | Trigger locks `is_admin`; `abuse_suspended` via admin |
| `conversations` / `messages` | Own | Own | Own (roles limited) | |
| `ai_logs` | No | No | service_role | 90d purge cron |
| `business_members` | No | Own rows | service_role | |
| `business_claims` | No | Own | Insert own pending | Admin via service_role |
| `business_profiles` / specials / menu / gallery | Public SELECT | Public SELECT | service_role | Portal actions gated |
| `search_events` / `trending_queries` | No | No | service_role | Discover APIs use admin client + RL |
| `city_events` | Published | Published | service_role | |
| Storage `business-media` | Public objects | Public objects | service_role | Logos/gallery/specials |
| Storage `business-media-private` | No | Signed URL | service_role | Menu imports / sensitive |

---

## Gate 1 — Automated scan log

Recorded 2026-07-21:

- `npm run smoke:security` — green (redirect, sniff, Sentry scrub, chat schema)
- `npm audit`: triage via Dependabot + CI; run `npm audit fix` for non-breaking fixes. **Do not** `npm audit fix --force` (would downgrade Next). PostCSS advisory is transitive via Next — track Next upgrades.
- Headers: HSTS, CSP, nosniff, DENY frame, Referrer-Policy, Permissions-Policy in `next.config.ts`
- Residual accepted: CSP `'unsafe-inline'` / `'unsafe-eval'` until nonce CSP project
- Staging URL headers: run SecurityHeaders.com / Mozilla Observatory when URL exists

### CI / Dependabot

- [`.github/workflows/security.yml`](../.github/workflows/security.yml) — typecheck, lint, smoke:security / authz / ai-safety, npm audit
- [`.github/dependabot.yml`](../.github/dependabot.yml) — weekly npm
---

## Gate 2 — Authz notes

- Demo login: production requires `ENABLE_DEMO_LOGIN=true` **and** a non-default `DEMO_LOGIN_PASSWORD`; UI uses `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` (must match intent). Never set either on Vercel prod for public launch.
- Offline checks: `npm run smoke:authz` (schema + demo gate helpers + membership gate contracts)
- Prod migrations: local verified; remote requires `CONFIRM_PROD=1 npm run migrate` when `SUPABASE_DB_URL` points at prod

---

## Gate 3 — AI cost runbook

### Quotas (chat)

| Limit | Value |
|---|---|
| Burst | 20 / min / user or IP |
| Anon | 5 / 24h / IP |
| User daily | 100 units (~50 turns) |
| User monthly | 2000 units / 30d |
| Global daily | 2000 turns |

### Alerts

When global remaining crosses 50/75/90/100% of `AI_DAILY_BUDGET_TURNS` (default = global limit), emit PostHog/Sentry abuse-style event `ai_budget_threshold`.

Configure **OpenAI** and **Google Cloud** billing budgets in their consoles (hard backstop).

### Abuse suspend

`profiles.abuse_suspended` — when true, `/api/chat` returns 403. Admins set via Admin → AI usage.

### Red team

`npm run smoke:ai-safety` — injection patterns, system-role rejection, delimiter wrap.

---

## Gate 4 — Launch checklist (owner)

Ops (cannot be fully automated in-repo):

- [ ] Rotate OpenAI, Supabase service role, Upstash, Google, `CRON_SECRET`, Resend
- [ ] Vercel prod: Upstash set; `CRON_SECRET` set; `NEXT_PUBLIC_SITE_URL` correct; Auth redirect allowlist
- [ ] Vercel prod: `ENABLE_DEMO_LOGIN` / `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` **unset**
- [ ] Confirm Vercel crons: `/api/cron/purge-ai-logs` (03:00), `/api/cron/search-restudy` (04:00)
- [ ] SPF / DKIM / DMARC for Resend sending domain
- [ ] Supabase backup / PITR confirmed; restore dry-run noted
- [ ] OpenAI + Google billing alerts at 50/75/90/100%
- [ ] Sentry project receiving events; alert on `global_chat_cap` / `ai_budget_threshold`
- [ ] Privacy / Terms / Cookies linked in footer (app pages shipped)
- [ ] Support path for account deletion / data export documented for users
- [ ] Staging headers scan (SecurityHeaders / Observatory)
- [ ] Incident response contact + rollback plan written

### Incident response (minimal)

1. Disable chat via removing Upstash (fail-closed) or set emergency global cap to 0 via Redis if needed  
2. Suspend abusive users (`abuse_suspended`)  
3. Rotate compromised keys  
4. Review `ai_logs` / PostHog abuse events  
5. Communicate via status page / social if user-facing outage  

---

## Deferred (post-launch)

| Item | Why |
|---|---|
| Stripe / subscriptions | Product not live |
| MFA | OAuth + magic link + RL for v1 |
| Nonce CSP | Next/Maps project |
| Full ZAP/Burp + 1k-user load | Dedicated window |
| Signed media URLs | UUID paths accepted for v1 |
| Lifetime AI quota / new-account ramp | Add if abuse patterns appear |

---

## Commands

```bash
npm run smoke:security
npm run smoke:authz
npm run smoke:ai-safety
npm run typecheck
npm run lint
npm audit --audit-level=high
```

Migration `0018_profiles_abuse_suspended.sql` adds `profiles.abuse_suspended` and locks it against client updates (service_role / admin actions only).
