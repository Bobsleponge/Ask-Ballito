# Eligibility-backed attributes (Knowledge Engine)

Hard-constraint eligibility (`filterByHardEligibility`) only accepts **known true** for required positive dims. Sparse enrichment therefore yields fewer primary results — by design (precision over fill).

## Required coverage

Every dimension the eligibility engine can require must be enrichable and taxonomy-linked:

| Constraint / environment | Business attribute | Taxonomy term(s) |
|---|---|---|
| `outdoorSeating` | `outdoorSeating` | `amenities:outdoor_seating`, `weather_fit:outdoor` |
| `outdoorPlay` / env outdoor | `outdoorPlay` | `weather_fit:outdoor` |
| `indoorPlay` / env indoor | `indoorPlay` | `weather_fit:indoor` |
| `rainFriendly` | `rainFriendly` | `weather_fit:rain_friendly` |
| `familyFriendly` | `familyFriendly` | `audience:family` |
| `kidsArea` | `kidsArea` | `amenities:kids_area`, `audience:kids` |
| `petFriendly` | `petFriendly` | `audience:pets` |
| `wheelchairAccessible` | `wheelchair` | `accessibility:wheelchair` |
| `seaView` | `seaView` | `amenities:ocean_view` |
| `wifi` | `wifi` | `amenities:wifi` |
| `quiet` | `noiseLevel=quiet` | `atmosphere:quiet` |
| `romantic` | `romantic` | `experience:romantic` |
| meals | `breakfast` / `lunch` / `dinner` | (attribute only today) |

## Measure fill rates

```sql
-- Example: share of businesses with outdoorPlay set (true or false)
select
  count(*) filter (where (metadata->'attributes'->>'outdoorPlay') is not null) as outdoor_play_set,
  count(*) filter (where (metadata->'attributes'->>'outdoorPlay') = 'true') as outdoor_play_true,
  count(*) filter (where (metadata->'attributes'->>'familyFriendly') is not null) as family_set,
  count(*) filter (where (metadata->'attributes'->>'indoorPlay') is not null) as indoor_play_set,
  count(*) filter (where (metadata->'attributes'->>'wifi') is not null) as wifi_set,
  count(*) as total
from businesses
where city_id = (select id from cities where slug = 'ballito');
```

Re-enrich leisure / family / dining verticals after prompt updates (`npm run enrich` — **billable**; only with explicit approval).

## Law

- Do not compensate missing attributes with ranking demotions or DISCOVERY section padding.
- Unknown ≠ true for hard requirements in primary results.
