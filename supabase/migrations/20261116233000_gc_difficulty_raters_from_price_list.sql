SET lock_timeout = '3s';

-- GC difficulty rating (punch list #357, v2.7468): the rating's insert rule reads the price list, and the price
-- list names the estimators.
--
-- PR 2 (20261114110000_gc_difficulty_ratings) let the office write a rating (is_office_staff(): dev, owner,
-- assistant, controller) "until the Bid Board's price list says who may rate". PR 4 brought the price list with its
-- raters (office, estimator, master) and the client has obeyed it since, but this rule was never moved. So the two
-- disagreed: with the estimators ticked an estimator was offered the save and refused here, and with the masters or
-- the office unticked they lost the press and could still write. The owner's word of 2026-11-16: an estimator should
-- be able to rate.
--
--   1. The price list names the estimators: the next version, the newest one's numbers with `estimator` added to
--      raters. A published version is never changed, so this is a new row. A draft in progress gains the name too, so
--      publishing it does not take the estimators off again. Both run once: after any published version has named
--      the estimators, who may rate is the owner's and the controller's own choice and a second run changes nothing.
--   2. gc_difficulty_can_rate() — the one answer, the twin of difficultyCanRate() in src/lib/bids/difficultyPrice.ts:
--      a dev always; an estimator, the owner (master_technician), an assistant or a controller when the newest
--      published price list names their group (estimator, master, office, office); nobody else. With no published
--      list, or one whose raters is not a list, all three groups may, as the client reads it.
--   3. The insert rule on gc_difficulty_ratings asks that function. The new rule is made before the old one is
--      dropped, so there is no moment with neither.
--
-- Nothing else on the table moves: everyone signed in reads, a dev deletes, the guard stamps who and when and holds
-- the picks to the published criteria, and the restrictive fences (training mode, a digital twin, an archived
-- caller) stand as they did. A digital twin is an estimator by role and is still refused by its fence.

-- 1. The price list names the estimators.
UPDATE public.difficulty_price_versions d
SET body = jsonb_set(d.body, '{raters}', (
  SELECT jsonb_agg(g.name ORDER BY g.ord)
  FROM (VALUES ('office', 1), ('estimator', 2), ('master', 3)) AS g(name, ord)
  WHERE g.name = 'estimator' OR d.body->'raters' ? g.name
))
WHERE d.status = 'draft'
  AND jsonb_typeof(d.body->'raters') = 'array'
  AND NOT d.body->'raters' ? 'estimator'
  AND NOT EXISTS (
    SELECT 1 FROM public.difficulty_price_versions e
    WHERE e.status = 'published' AND jsonb_typeof(e.body->'raters') = 'array' AND e.body->'raters' ? 'estimator'
  );

INSERT INTO public.difficulty_price_versions (version, status, body, note, published_by_name, published_at)
SELECT
  p.version + 1,
  'published',
  jsonb_set(p.body, '{raters}', (
    SELECT jsonb_agg(g.name ORDER BY g.ord)
    FROM (VALUES ('office', 1), ('estimator', 2), ('master', 3)) AS g(name, ord)
    WHERE g.name = 'estimator' OR jsonb_typeof(p.body->'raters') IS DISTINCT FROM 'array' OR p.body->'raters' ? g.name
  )),
  format('Version %s''s numbers, with the estimators added to who may rate a GC: the owner''s word of 2026-11-16.', p.version),
  'the app',
  now()
FROM (
  SELECT v.version, v.body
  FROM public.difficulty_price_versions v
  WHERE v.status = 'published'
  ORDER BY v.version DESC
  LIMIT 1
) p
WHERE NOT EXISTS (
  SELECT 1 FROM public.difficulty_price_versions e
  WHERE e.status = 'published' AND jsonb_typeof(e.body->'raters') = 'array' AND e.body->'raters' ? 'estimator'
)
ON CONFLICT (version) WHERE status = 'published' DO NOTHING;

-- 2. Who may rate a GC. The default list and the role's group are the same as DIFFICULTY_RATERS_DEFAULT and
-- difficultyRaterOfRole() in src/lib/bids/difficultyPrice.ts; difficultyPrice.test.ts reads this file to hold them
-- equal.
CREATE OR REPLACE FUNCTION public.gc_difficulty_can_rate()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT COALESCE((
    SELECT u.role::text = 'dev'
        OR COALESCE(
             (
               SELECT CASE WHEN jsonb_typeof(p.body->'raters') = 'array' THEN p.body->'raters' END
               FROM public.difficulty_price_versions p
               WHERE p.status = 'published'
               ORDER BY p.version DESC
               LIMIT 1
             ),
             '["office","estimator","master"]'::jsonb
           ) ? (CASE u.role::text
                  WHEN 'estimator' THEN 'estimator'
                  WHEN 'master_technician' THEN 'master'
                  WHEN 'assistant' THEN 'office'
                  WHEN 'controller' THEN 'office'
                END)
    FROM public.users u
    WHERE u.id = auth.uid()
  ), false)
$fn$;

COMMENT ON FUNCTION public.gc_difficulty_can_rate() IS
  'GC difficulty rating (punch list #357, v2.7468): whether the caller may rate a GC. A dev always; an estimator, the owner (master_technician), an assistant or a controller when the newest published row of difficulty_price_versions names their group in body.raters (estimator, master, office, office); nobody else. With no published list, or raters not a list, all three groups may. The twin of difficultyCanRate() in src/lib/bids/difficultyPrice.ts; the insert rule on gc_difficulty_ratings asks it.';

REVOKE ALL ON FUNCTION public.gc_difficulty_can_rate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_difficulty_can_rate() TO authenticated;

-- 3. The insert rule asks the price list. Made first, then the old rule dropped.
DROP POLICY IF EXISTS gc_difficulty_ratings_insert_raters ON public.gc_difficulty_ratings;
CREATE POLICY gc_difficulty_ratings_insert_raters
  ON public.gc_difficulty_ratings FOR INSERT TO authenticated
  WITH CHECK (public.gc_difficulty_can_rate());

COMMENT ON POLICY gc_difficulty_ratings_insert_raters ON public.gc_difficulty_ratings IS
  'Whoever the Bid Board''s published price list lets rate a GC (gc_difficulty_can_rate()), a dev always. Replaced gc_difficulty_ratings_insert_office (is_office_staff()) in v2.7468.';

DROP POLICY IF EXISTS gc_difficulty_ratings_insert_office ON public.gc_difficulty_ratings;
