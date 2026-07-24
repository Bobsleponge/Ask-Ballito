# Reply accuracy verification

When a live answer is wrong (e.g. guitar restring → car repair cards):

1. **Capture the ask** and what was wrongly shown.
2. **Add a case** to `reply-accuracy.json`:
   - `expectExact: true` for specific job/product asks
   - `pool` with good + bad businesses
   - `expectKeepIds` / `expectDropIds`
   - `forbidCategorySubstrings` for categories that must never appear
3. **Run** `npm run verify:replies` until green.
4. Only then ship the guard/filter fix.

This is offline (no OpenAI / DB). It checks classification, composition strategy, and ask-fit filtering — the same gates that prevent padded “Ideas by vibe” replies.
