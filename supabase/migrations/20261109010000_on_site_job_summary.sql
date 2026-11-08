SET lock_timeout = '3s';

-- Materials on site (punch list #209, v2.6743): a job's summary past the client's 5,000-row read.
--
-- The screens read a job's whole ledger (job_material_movements) and sum it on the device
-- (src/lib/materials/onSite.ts, containerLines and countDiffs); the store caps that read at 5,000 rows
-- (MOVEMENTS_LIMIT), so a job past it summed a part of its ledger and said nothing. This function is the
-- same arithmetic in SQL over the whole ledger, as on_site_line_on_hand (20261102100000) is for one
-- line, and answers in one call what the summary needs: every line of every container with its on hand,
-- its last touch, its last count and the Can't find presses since; the last count on each container; the
-- counts in the window with what the ledger expected; the Can't find presses in the window; the returns.
-- The client (onSiteStore.loadJob) calls it only when the ledger read came back capped, and prices the
-- shortfalls itself (the invoice price lives on the device; the book's is read beside the job).
--
-- SECURITY INVOKER: the ledger's own RLS (on_site_can_touch_job) decides what the caller sums, so a job
-- the caller may not touch answers empty, as the screens' read does. No table is created: no fence owed.

CREATE OR REPLACE FUNCTION public.on_site_job_summary(p_job_id uuid, p_since timestamptz DEFAULT (now() - interval '30 days'))
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  WITH m AS (
    SELECT id, at, quantity, reason, from_container_id, to_container_id, part_id, part_name, manufacturer, COALESCE(by_name, '') AS by_name,
           CASE WHEN part_id IS NOT NULL THEN 'id:' || part_id::text
                ELSE 'text:' || lower(regexp_replace(btrim(part_name), '\s+', ' ', 'g')) END AS pk
    FROM public.job_material_movements
    WHERE job_id = p_job_id
  ),
  -- One row per touch of a (container, part): a count sets the line; the from side takes, the to side adds.
  sides AS (
    SELECT id, at, pk, part_id, part_name, manufacturer, by_name, reason, from_container_id AS container_id,
           CASE WHEN reason = 'counted' THEN quantity END AS set_to,
           CASE WHEN reason = 'counted' THEN 0 ELSE -quantity END AS delta
    FROM m
    WHERE from_container_id IS NOT NULL AND reason <> 'delivered'
    UNION ALL
    SELECT id, at, pk, part_id, part_name, manufacturer, by_name, reason, to_container_id, NULL, quantity
    FROM m
    WHERE to_container_id IS NOT NULL AND reason IN ('delivered', 'moved')
  ),
  -- The segment a row is in: the number of counts on the line so far, this row's included.
  seq AS (
    SELECT s.*, SUM(CASE WHEN s.reason = 'counted' THEN 1 ELSE 0 END) OVER (PARTITION BY s.container_id, s.pk ORDER BY s.at, s.id::text ROWS UNBOUNDED PRECEDING) AS seg
    FROM sides s
  ),
  -- What a segment sums to: the count that opened it (if any) plus every change after it.
  segsum AS (
    SELECT container_id, pk, seg,
           SUM(CASE WHEN reason = 'counted' THEN set_to ELSE delta END)::integer AS total,
           SUM(CASE WHEN reason = 'cannot_find' THEN -delta ELSE 0 END)::integer AS cannot_find
    FROM seq
    GROUP BY 1, 2, 3
  ),
  latest AS (SELECT container_id, pk, MAX(seg) AS seg FROM seq GROUP BY 1, 2),
  first_touch AS (
    SELECT DISTINCT ON (container_id, pk) container_id, pk, part_id, part_name, manufacturer
    FROM seq ORDER BY container_id, pk, at, id::text
  ),
  last_touch AS (
    SELECT DISTINCT ON (container_id, pk) container_id, pk, at, by_name
    FROM seq ORDER BY container_id, pk, at DESC, id::text DESC
  ),
  counts AS (SELECT * FROM seq WHERE reason = 'counted'),
  last_line_count AS (
    SELECT DISTINCT ON (container_id, pk) container_id, pk, at, by_name, set_to, seg
    FROM counts ORDER BY container_id, pk, at DESC, id::text DESC
  ),
  lines AS (
    SELECT l.container_id, l.pk, f.part_id, f.part_name, f.manufacturer,
           COALESCE(ss.total, 0) AS on_hand,
           COALESCE(ss.cannot_find, 0) AS cannot_find_since_count,
           t.at AS last_touched_at, t.by_name AS last_touched_by,
           lc.at AS last_count_at, lc.by_name AS last_count_by,
           CASE WHEN lc.set_to IS NULL THEN NULL
                ELSE lc.set_to - COALESCE((SELECT p.total FROM segsum p WHERE p.container_id = l.container_id AND p.pk = l.pk AND p.seg = lc.seg - 1), 0) END AS last_count_diff
    FROM latest l
    JOIN segsum ss ON ss.container_id = l.container_id AND ss.pk = l.pk AND ss.seg = l.seg
    JOIN first_touch f ON f.container_id = l.container_id AND f.pk = l.pk
    JOIN last_touch t ON t.container_id = l.container_id AND t.pk = l.pk
    LEFT JOIN last_line_count lc ON lc.container_id = l.container_id AND lc.pk = l.pk
  ),
  diffs AS (
    SELECT c.id AS movement_id, c.at, c.by_name, c.container_id, c.pk, c.part_id, c.part_name, c.manufacturer,
           COALESCE((SELECT p.total FROM segsum p WHERE p.container_id = c.container_id AND p.pk = c.pk AND p.seg = c.seg - 1), 0) AS expected,
           c.set_to AS counted
    FROM counts c
    WHERE c.at >= p_since
  ),
  last_counts AS (
    SELECT DISTINCT ON (container_id) container_id, at, by_name
    FROM counts ORDER BY container_id, at DESC, id::text DESC
  )
  SELECT jsonb_build_object(
    'rows', (SELECT count(*) FROM m),
    'lines', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'container_id', container_id, 'part_key', pk, 'part_id', part_id, 'part_name', part_name, 'manufacturer', manufacturer,
        'on_hand', on_hand, 'cannot_find_since_count', cannot_find_since_count,
        'last_touched_at', last_touched_at, 'last_touched_by', last_touched_by,
        'last_count_at', last_count_at, 'last_count_by', last_count_by, 'last_count_diff', last_count_diff
      ) ORDER BY part_name, pk, container_id::text) FROM lines), '[]'::jsonb),
    'last_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('container_id', container_id, 'at', at, 'by_name', by_name)) FROM last_counts), '[]'::jsonb),
    'diffs', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'movement_id', movement_id, 'at', at, 'by_name', by_name, 'container_id', container_id, 'part_key', pk,
        'part_id', part_id, 'part_name', part_name, 'manufacturer', manufacturer, 'expected', expected, 'counted', counted
      ) ORDER BY at DESC) FROM diffs), '[]'::jsonb),
    'cannot_find', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'movement_id', id, 'at', at, 'by_name', by_name, 'container_id', from_container_id, 'part_key', pk,
        'part_id', part_id, 'part_name', part_name, 'manufacturer', manufacturer, 'quantity', quantity
      ) ORDER BY at DESC) FROM m WHERE reason = 'cannot_find' AND at >= p_since), '[]'::jsonb),
    'credits', (SELECT count(*) FROM m WHERE reason = 'returned')
  )
$fn$;

REVOKE ALL ON FUNCTION public.on_site_job_summary(uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.on_site_job_summary(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_site_job_summary(uuid, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.on_site_job_summary(uuid, timestamptz) IS 'Materials on site (#209, v2.6743): a job''s cages and boxes summed over its whole ledger in SQL — every line''s on hand, last touch, last count and Can''t find presses since; the last count per container; the counts and Can''t find presses since p_since with what the ledger expected; the returns. The same arithmetic as src/lib/materials/onSite.ts; the screens read it when a job''s ledger passes the 5,000 rows they read themselves. Runs as the caller.';
