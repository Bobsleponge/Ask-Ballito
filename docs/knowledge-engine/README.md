# Knowledge Engine — Architecture notes

See the CTO plan for full design. Shipped foundations:

| Phase | Status |
|---|---|
| P0 Cost wins | Knowledge-card fast path, FTS owner sync, geo RPC, variety gate, dead v1 removal |
| P1 Pipeline + ownership | `knowledge-pipeline/`, `field_meta`, owner write-through |
| P2 Taxonomy | `taxonomy_*` + `listing_terms`, classify stage |
| P3 Structured cards | `rule` / `members` / `render` columns |
| P4 Places + FAQs | `places`, `city_faqs` + Ballito seeds |
| P5 Relations | `listing_relations` (LOCATED_IN, PART_OF, HOSTS) |
| P6 Search/Rank | `services/search`, openNow/verified/freshness weights |
| P7 Eval | Gold dataset (520+) + live `eval:platform` + `/admin/search-quality` |
| P8 Cleanup | HNSW migration, city-2 playbook |

Apply migrations: `npm run migrate`

Run pipeline: `npm run pipeline:run -- ballito`

Eval platform: see [`evals/README.md`](../evals/README.md) and [`docs/eval/baseline-report.md`](../eval/baseline-report.md).

Hard-constraint eligibility attributes: [`eligibility-attributes.md`](./eligibility-attributes.md).

