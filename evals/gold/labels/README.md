# Gold labels

Curated Top-1 / Top-3 business UUIDs for `labelingTier: "full"` questions.

## Workflow

1. Dump candidates from staging/local:

```bash
EVAL_LIVE=1 npm run eval:label-candidates
# optional: -- --limit=20
```

2. For each file in `evals/gold/candidates/<id>.json`, copy chosen IDs into
   `evals/gold/labels/<id>.json`:

```json
{
  "questionId": "biz-best-breakfast",
  "expectTop1Ids": ["<uuid>"],
  "expectTop3Ids": ["<uuid>", "<uuid>", "<uuid>"],
  "notes": "Human curated"
}
```

3. Apply into the gold dataset:

```bash
npm run eval:apply-labels
```

Target: 150–200 core questions with entity gold before Knowledge Engine migration.
