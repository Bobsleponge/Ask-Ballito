# Knowledge Engine — Data Ownership

Single source of truth rules for Ask Ballito.

| Concern | Owner | Notes |
|---|---|---|
| Business listing scalars (name, phone, website, description, hours) | `businesses` | Owner portal **writes through** to `businesses` when claimed |
| Place landmarks | `places` | Admin / seed scripts |
| Events | `city_events` | Admin |
| Specials / menu / gallery | portal tables | Correct as-is |
| Taxonomy | `taxonomy_*` | Admin + offline pipeline |
| Listing tags | `listing_terms` | Pipeline / owner / admin + confidence |
| Relations | `listing_relations` | Pipeline / admin; predicates: LOCATED_IN, PART_OF, HOSTS |
| Knowledge cards | `knowledge_cards` | Rules admin-owned; members pipeline-owned |
| FAQ / emergency | `city_faqs` / `places` | Not TypeScript constants at runtime |
| AI-generated fields | Stored with `source=llm_enrichment` | Lower confidence; never overwrite owner/admin |
| Google Places | `provider` + `external_id` | Loses to owner on contact/hours when claimed |
| Cities | DB `cities` | `cities.ts` is UX helper until generated |

## Merge policy

`owner_claim` / `admin` > `google_places` > `llm_enrichment` > `heuristic`

Provenance lives in `businesses.field_meta` (and term/relation rows).

## Pipeline

Offline only: `src/services/knowledge-pipeline/`. Query path never runs LLM extract.
