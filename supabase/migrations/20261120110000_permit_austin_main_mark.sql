-- Permits: Austin's MAIN mark comes off the names already stored (punch list #405).
--
-- Austin's feed writes its mark for a contractor's main account into the name itself: asterisks
-- around MAIN ("Name, Inc.**MAIN**", "***Main", "*** MAIN") or the word in brackets ("(MAIN)").
-- `permit-pull` kept the name as it came, so `permits.contact` showed the mark and
-- `permits.builder_key` was made from it: a company with the mark and the same company without it
-- were two builders, and a name with a comma keyed to `main`, one builder for every such company.
--
-- `permit-pull` now strips the mark as it reads (`austinName` in `_shared/permitCities.ts`), but a
-- night's pull only rewrites the last ten days. This is the one-off for every older Austin row,
-- building and plumbing:
--   * `contact` loses the mark, by the same pattern the function reads with
--     (`AUSTIN_MAIN_MARK`; `src/lib/research/permitCities.test.ts` holds the two together). A
--     name that was nothing but the mark falls to the next name on the feed's record, as the
--     function reads it.
--   * `builder_key` goes back to null. The key is made in TypeScript (`builderKeyOf`, which splits
--     the person from the company) and the database has no twin of that split, so the migration
--     does not guess it: the next `permit-pull` run fills every null key, 6,000 rows a run.
--   * `raw` is not touched. It keeps the feed's own text, mark and all.
--
-- Order: `permit-pull` is deployed first, so a pull between the two cannot write the mark back.
-- Run twice it changes nothing: after the first run no Austin contact matches.
SET lock_timeout = '3s';

WITH mark AS (
  SELECT '\*+\s*main(?![a-z0-9])\**|\(\s*main(?:\s+(?:gc\s+)?account)?\s*\)'::text AS re
),
cleaned AS (
  SELECT
    p.id,
    COALESCE(
      NULLIF(btrim(regexp_replace(regexp_replace(p.contact, mark.re, ' ', 'gi'), '\s+', ' ', 'g')), ''),
      NULLIF(btrim(regexp_replace(regexp_replace(COALESCE(p.raw->>'applicant_org', ''), mark.re, ' ', 'gi'), '\s+', ' ', 'g')), ''),
      NULLIF(btrim(regexp_replace(regexp_replace(COALESCE(p.raw->>'contractor_full_name', ''), mark.re, ' ', 'gi'), '\s+', ' ', 'g')), ''),
      NULLIF(btrim(regexp_replace(regexp_replace(COALESCE(p.raw->>'applicant_full_name', ''), mark.re, ' ', 'gi'), '\s+', ' ', 'g')), '')
    ) AS name
  FROM public.permits p
  CROSS JOIN mark
  WHERE p.city = 'Austin'
    AND p.contact ~* mark.re
)
UPDATE public.permits p
SET contact = cleaned.name,
    builder_key = NULL
FROM cleaned
WHERE p.id = cleaned.id;
