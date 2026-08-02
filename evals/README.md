# Eval harness — Search Quality & AI Evaluation Platform

Philosophy: if we can't measure it, we can't improve it.

## Suites

| Command | Purpose |
|---|---|
| `npm run eval:smoke` | Offline smoke: fixtures, grounding, pricing |
| `npm run eval:routing` | Classifier precision / extractor-skip / deterministic narration |
| `npm run eval:retrieval` | Legacy retrieval fixture size + gold ≥500 gate |
| `npm run eval:gold` | Full gold dataset schema + intent coverage gate |
| `npm run eval:qi` | Query Intelligence schema, short-circuit policy, gold fixtures |
| `npm run eval:qi-audit` | Forensic short-circuit vs understanding audit (95-q corpus) |
| `npm run verify:replies` | Exact-niche / ask-fit / composition gates |
| `EVAL_LIVE=1 npm run eval:platform` | **Live** Top-k + AI cost/latency against local/staging |
| `npm run eval:compare -- --prev=… --curr=…` | Previous vs current summary report |
| `EVAL_LIVE=1 npm run eval:label-candidates` | Dump Top-10 candidates for core labeling |
| `npm run eval:apply-labels` | Merge `evals/gold/labels/*.json` into questions |

## Gold dataset

- Source of truth: [`evals/gold/questions.json`](gold/questions.json) (≥500 questions)
- Schema/types: [`src/services/eval/types.ts`](../src/services/eval/types.ts)
- Regenerate: `npm run eval:generate-gold`
- Core (~180) use `labelingTier: "full"` — entity Top-1/Top-3 curated via labels workflow

### Engineering rule

Any change to search, ranking, taxonomy, knowledge cards, entity model, relationships, prompting, or caching must:

1. Keep offline gates green (`eval:smoke`, `eval:routing`, `eval:gold`)
2. Run `EVAL_LIVE=1 npm run eval:platform` locally (or `-- --limit=50` while iterating)
3. Attach `eval:compare` output when claiming an improvement

## Live platform

Requires `.env.local` pointed at local/staging Supabase + OpenAI.

```bash
npm run migrate   # includes 0028_eval_platform
EVAL_LIVE=1 npm run eval:platform -- --limit=50 --search-only
EVAL_LIVE=1 npm run eval:platform -- --core-only
```

- `skipAnswerCache` / `retry` prevent cache poisoning
- Results write to `evals/runs/*.json` and optionally `eval_runs` / `eval_results`
- Admin UI: `/admin/search-quality`

## Growing fixtures

1. Prefer adding to gold via `eval:generate-gold` templates or hand-edits to `questions.json`
2. Curate entity IDs under `evals/gold/labels/` (see labels README)
3. Keep `routing.json` for classifier CI until fully projected from gold
