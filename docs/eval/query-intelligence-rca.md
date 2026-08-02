# Query Intelligence — Root Cause Analysis (Phase 0)

**Date:** 2026-08-02  
**Corpus:** [`evals/audit/query-intelligence-corpus.json`](../../evals/audit/query-intelligence-corpus.json) (95 questions)  
**Method:** Offline structural audit (`npm run eval:qi-audit`) + baseline suggestion codes + short-circuit draft richness.  
**Live extractor A/B:** optional via `EVAL_LIVE=1 npm run eval:qi-audit` (OpenAI spend).

## Architectural confirmation

The rules classifier can short-circuit `PlannerExtractor` when `CLASSIFIER_SHORT_CIRCUIT` is on, `canSkipExtractor` is true, and confidence ≥ 0.85. Short-circuit drafts from `draftFromClassification`:

- Always have **empty `planFacets`**
- Usually have **1 draft query** (pattern or raw message)
- Capture only a handful of regex constraints

Downstream retrieval/ranking then executes that thin plan correctly — producing confidently wrong answers for open-ended NL.

## Layer attribution (exclusive primary, heuristic)

Source: `evals/audit/qi-audit-latest.json` (2026-08-02 offline run, 95 questions).

| Primary layer | Count | % |
|---|---|---|
| `ranking_failure` | 56 | 58.9% |
| `bad_generated_search_query` | 13 | 13.7% |
| `missing_data` | 9 | 9.5% |
| `misunderstanding` | 6 | 6.3% |
| `missing_facet` | 6 | 6.3% |
| `taxonomy_failure` | 5 | 5.3% |
| Other layers | 0 | 0% |

**Short-circuit assessment (same run):**

| Metric | Value |
|---|---|
| Legacy short-circuit eligible | **78.9%** of corpus |
| Thin short-circuit drafts (≤1 query, 0 facets) | **75.8%** |
| Short-circuit likely root cause | **26.3%** |
| Extractor / QI would help | **27.4%** |

Understanding-layer failures (`misunderstanding` + `missing_facet` + `bad_generated_search_query`) are **~26%** as exclusive primary — and short-circuit thin drafts cover most of the corpus even when ranking is labeled primary (geo/attribute Top-1). Pattern confidence ≠ semantic confidence.

**Go / no-go for Phase 1:** **GO** — replace rules-as-primary-understanding with Query Intelligence for non-trivial NL; keep rules for emergency / FAQ / exact commands / cache.

## Fit-verify

Fit-verify is post-hoc repair for multi-need / meal-time noise. Tokens are better spent on pre-retrieval understanding. Under `QUERY_INTELLIGENCE=1`, fit-verify defaults **off** (`FIT_VERIFY` unset). Re-enable only with measured lift.

## BusinessSearch-centric gap

Chat retrieval still resolves almost everything to `businesses`. Places/events/facts exist in the Knowledge Engine schema but are not first-class execution targets. QI `domains` / `entityKinds` prepare multi-entity retrieval; capability registry wiring remains staged.

## Optimisation priority (this phase)

1. Semantic understanding  
2. Retrieval recall  
3. Retrieval precision  
4. Ranking relevance  
5. Composition usefulness  
6. Grounding  
7. Latency  
8. LLM cost  

## Complexity to remove (when QI wins)

1. Search-family use of `draftFromClassification` as primary understanding  
2. Broad `canSkipExtractor` short-circuit for BUSINESS/DISCOVERY/PLACE/EVENT  
3. Resolver `force_*` sprawl for product/music/auto when QI draft is trusted  
4. Post-retrieval deepen loops that re-detect niches QI already encoded  
5. Fit-verify regex multi-need gate as “understanding”  
6. Celebration-only facet special-casing in planner prompt (generalize via QI facets)  
7. CI incentive that NL business queries *must* skip the extractor  
8. Duplicate constraint regex in `draftFromClassification`

## Flags

| Flag | Default | Role |
|---|---|---|
| `QUERY_INTELLIGENCE` | off | Serve QI for non-trivial NL |
| `QI_SHADOW` | off | Log QI without serving |
| `QI_TRUST_UNDERSTANDING` | on (with QI) | Skip non-safety force rules |
| `FIT_VERIFY` | unset → off when QI on | Post-hoc repair |
| `QUERY_TRACE` | off | Persist end-to-end traces |

## How to refresh this RCA

```bash
npm run eval:qi-audit
# Optional live extractor compare (billable OpenAI, not Places):
EVAL_LIVE=1 npm run eval:qi-audit
npm run eval:qi
```
