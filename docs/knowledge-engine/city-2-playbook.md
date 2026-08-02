# Multi-city launch playbook

City #2 does **not** require a schema redesign. Same Knowledge Engine tables.

## Steps

1. Insert/enable city in `cities` (DB) and `src/config/cities.ts` (`enabled: true`).
2. `npm run migrate` (already city-agnostic).
3. Seed taxonomy is global — no per-city copy needed.
4. `npm run ingest -- <city>` then `npm run enrich -- <city>`.
5. Seed `places` + `city_faqs` for that city (SQL or admin).
6. `POST/GET /api/cron/knowledge-cards` with city scope (or extend cron to loop enabled cities).
7. Run `npm run eval:routing` + retrieval gold set filtered by city.
8. Watch admin AI usage LLM% and cache hit rate.

## Do not

- Fork tables per city
- Hardcode city name in prompts (use `${cityName}`)
- Add a new entity spine for expansion
