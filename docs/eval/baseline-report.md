# Search Quality Baseline Report

**Date:** 2026-07-28  
**Run:** `5f753d31-3e3b-45cd-b860-34087c74c3e2` (local/staging, search-only, core-only)  
**Dataset:** 520 gold questions · 180 core · **173** with entity Top-1/Top-3 labels

**Optimisation north stars**

1. Highest search accuracy (Top-1 / Top-3 on curated core)
2. Lowest AI usage / cost per question
3. Lowest latency (deterministic path p50 &lt; 800ms)
4. Deterministic retrieval + explainable rankings
5. No hallucinations — structured knowledge first

---

## Measured baseline (search-only core)

| Metric | Value | Notes |
|---|---|---|
| Top-1 accuracy | **74.0%** | 173 labeled questions |
| Top-3 accuracy | **90.2%** | Strong recall into top 3 |
| Intent accuracy | **82.8%** | 149/180 on core (family matching) |
| LLM usage % | 0.0% | Search-only mode (no orchestrator LLM) |
| Cost per question | $0.00000 | Search-only (embeddings may be Redis-cached) |
| Latency p50 / p95 | **331 / 360 ms** | Under 800ms target |
| Cache hit % | 0.0% | `skipAnswerCache` / eval isolation |
| Knowledge card hit % | **15.0%** | Large expansion opportunity |
| SQL / hybrid / vector | hybrid path | Search-only uses hybrid retrieval |

> Re-run full orchestrator for LLM%/cost:  
> `EVAL_LIVE=1 npm run eval:platform -- --core-only --limit=50`

Offline classifier gate: `npm run eval:routing` (≥85% family precision on 215 fixtures).

---

## Biggest search weaknesses

1. **Attribute filters weak** — dog-friendly / generators / open-after-9pm often miss or return wrong entity types (pet stores for dog-friendly).
2. **Geo “near Salt Rock” Top-1 fragile** — many `-near` variants fail Top-1 while still hitting Top-3.
3. **Niche cuisine gaps** — Thai/surf lessons show ranking or inventory issues.
4. **Intent family misses** — some BUSINESS_SEARCH queries classified outside search family (generators, family-friendly, kids menu).
5. **Knowledge card coverage only 15%** on core discovery/business templates.

## Biggest metadata / taxonomy gaps

1. Businesses missing category/description — see `/admin/search-quality` coverage strip.
2. Attribute taxonomy for dog-friendly, generators, open-late not reliably on listings.
3. Emergency/accommodation intents rely on BUSINESS_SEARCH patterns — add dedicated aliases.
4. Relationship coverage (LOCATED_IN place → business) underused for “near X” queries.

---

## Highest-impact improvements (before Knowledge Engine migration)

1. **Ship attribute filters + listing_terms** for dog-friendly, generators, open-late — largest false-positive class.
2. **Expand knowledge cards** for top templates (breakfast, beaches, rainy day, dog-friendly restaurants) — raise 15% → 40%+.
3. **Geo / LOCATED_IN ranking** for Salt Rock / Junction / Lifestyle Centre — lift `-near` Top-1.
4. **Classifier patterns** for attribute-heavy business queries until core intent ≥90%.
5. **Curate remaining ~7 core gaps** + spot-check weak labels (Thai, romantic) before trusting Top-k as gospel.

---

## How to refresh

```bash
npm run migrate
EVAL_LIVE=1 npm run eval:label-candidates
npm run eval:apply-labels
EVAL_LIVE=1 npm run eval:platform -- --core-only
npm run eval:compare -- --prev=<old.json> --curr=<new.json>
```

Admin: `/admin/search-quality`
