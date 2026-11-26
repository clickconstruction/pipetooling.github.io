SET lock_timeout = '3s';

-- A box's own screen (punch list #398, v2.8612): what makes a box due a count, ruled the same in the database as on the
-- phone.
--
-- Two readings of the owner's answers of 2026-11-25. First, an added part counts its own line and not the box: the
-- Tally's Add a part writes a `delivered` row with the note *added on site* and, when the box held none of that part,
-- a `counted` row for the line with the note *counted as added* (src/lib/materials/addPart.ts, ADD_COUNT_NOTE). A box's
-- last count took the newest `counted` row of any line, so one add cleared the amber of an overdue box for the parts
-- nobody counted. Second, an empty box is due a count nowhere: its screen offers no Count tile (boxTiles asks for a
-- line to walk), while the list's Count chip, the Job Mode card's line and the office's chip counted it.
--
-- The client's rule is lastCountedAt, boxCountDue and lineIsCountable in src/lib/materials/onSite.ts. These two
-- functions copy it:
--
--   on_site_door_facts   `due` leaves out a `counted` row whose note is *counted as added*, and counts only a box that
--                        holds a line to count: a line with something on hand, or a Can't find since its last count.
--   on_site_job_summary  `last_counts` leaves out the same rows. Its `lines` keep them: an added part did count that
--                        line, and the line's own last count reads the add.
--
-- The note's words are one constant on each side. src/lib/materials/boxDueNote.test.ts reads this file and fails
-- when the words here and ADD_COUNT_NOTE part; supabase/tests/on_site_guards/70_box_due.sql plays both functions.
--
-- CREATE OR REPLACE of both, with the same arguments, the same answer and the same grants: the generated types do
-- not change, and the old client reads the new functions as the new client reads the old. No table is created, so
-- no fence is owed. SECURITY INVOKER as before: every table answers under the caller's own RLS.

-- ---------------------------------------------------------------------------------------------------------------
-- on_site_door_facts (first written by 20261120070000_on_site_door_facts.sql)

CREATE OR REPLACE FUNCTION public.on_site_door_facts(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  WITH site AS (
    SELECT p_job_id AS id
    UNION
    SELECT s FROM public.on_site_site_job_ids(p_job_id) AS s
  ),
  boxes AS (
    SELECT c.id
    FROM public.job_containers c
    WHERE c.job_id IN (SELECT id FROM site)
      AND c.retired_at IS NULL
      AND c.kind <> 'unsorted'
  ),
  -- The box's last count: the newest count of any line in it, an add's own count left out (#398).
  counted AS (
    SELECT m.from_container_id AS id, max(m.at) AS at
    FROM public.job_material_movements m
    WHERE m.reason = 'counted'
      AND m.taken_back_at IS NULL
      AND COALESCE(m.note, '') <> 'counted as added'
      AND m.from_container_id IN (SELECT id FROM boxes)
    GROUP BY m.from_container_id
  ),
  -- Every touch of a (box, part), as on_site_job_summary reads them: a count sets the line, the from side takes, the
  -- to side adds. A press taken back is left out, as its RLS leaves it out of every sum.
  m AS (
    SELECT id, at, quantity, reason, from_container_id, to_container_id,
           CASE WHEN part_id IS NOT NULL THEN 'id:' || part_id::text
                ELSE 'text:' || lower(regexp_replace(btrim(part_name), '\s+', ' ', 'g')) END AS pk
    FROM public.job_material_movements
    WHERE taken_back_at IS NULL
      AND (from_container_id IN (SELECT id FROM boxes) OR to_container_id IN (SELECT id FROM boxes))
  ),
  sides AS (
    SELECT id, at, pk, reason, from_container_id AS container_id,
           CASE WHEN reason = 'counted' THEN quantity END AS set_to,
           CASE WHEN reason = 'counted' THEN 0 ELSE -quantity END AS delta
    FROM m
    WHERE from_container_id IN (SELECT id FROM boxes) AND reason <> 'delivered'
    UNION ALL
    SELECT id, at, pk, reason, to_container_id, NULL, quantity
    FROM m
    WHERE to_container_id IN (SELECT id FROM boxes) AND reason IN ('delivered', 'moved')
  ),
  seq AS (
    SELECT s.*, SUM(CASE WHEN s.reason = 'counted' THEN 1 ELSE 0 END) OVER (PARTITION BY s.container_id, s.pk ORDER BY s.at, s.id::text ROWS UNBOUNDED PRECEDING) AS seg
    FROM sides s
  ),
  latest AS (SELECT container_id, pk, MAX(seg) AS seg FROM seq GROUP BY 1, 2),
  lines AS (
    SELECT q.container_id,
           SUM(CASE WHEN q.reason = 'counted' THEN q.set_to ELSE q.delta END) AS on_hand,
           SUM(CASE WHEN q.reason = 'cannot_find' THEN -q.delta ELSE 0 END) AS cannot_find
    FROM seq q
    JOIN latest l ON l.container_id = q.container_id AND l.pk = q.pk AND l.seg = q.seg
    GROUP BY q.container_id, q.pk
  ),
  -- A box with a line to count (lineIsCountable): something on hand, or a Can't find since the last count.
  holds AS (
    SELECT DISTINCT container_id AS id FROM lines WHERE on_hand > 0 OR cannot_find > 0
  )
  SELECT jsonb_build_object(
    'boxes', (SELECT count(*) FROM boxes),
    'due', (
      SELECT count(*)
      FROM boxes b
      JOIN holds h ON h.id = b.id
      LEFT JOIN counted k ON k.id = b.id
      WHERE k.at IS NULL OR k.at <= now() - interval '14 days'
    ),
    'stickers', (
      SELECT count(*)
      FROM public.box_stickers s
      JOIN public.sticker_runs r ON r.id = s.run_id
      WHERE r.job_id IN (SELECT id FROM site)
        AND s.container_id IS NULL
        AND s.lost_at IS NULL
    )
  )
$fn$;

REVOKE ALL ON FUNCTION public.on_site_door_facts(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.on_site_door_facts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_site_door_facts(uuid) TO authenticated;

COMMENT ON FUNCTION public.on_site_door_facts(uuid) IS 'Materials on site (#407, #398): what the Job Mode card''s press says of a job''s site, in one read under the caller''s own RLS — live boxes, the boxes due a count (a box with a line to count, never counted or 14 days since its last count, an added part''s own count left out) and the printed stickers on no box yet.';

-- ---------------------------------------------------------------------------------------------------------------
-- on_site_job_summary (first written by 20261109010000_on_site_job_summary.sql)

CREATE OR REPLACE FUNCTION public.on_site_job_summary(p_job_id uuid, p_since timestamptz DEFAULT (now() - interval '30 days'))
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  WITH m AS (
    SELECT id, at, quantity, reason, from_container_id, to_container_id, part_id, part_name, manufacturer, COALESCE(by_name, '') AS by_name,
           COALESCE(note, '') AS note,
           CASE WHEN part_id IS NOT NULL THEN 'id:' || part_id::text
                ELSE 'text:' || lower(regexp_replace(btrim(part_name), '\s+', ' ', 'g')) END AS pk
    FROM public.job_material_movements
    WHERE job_id = p_job_id
  ),
  -- One row per touch of a (container, part): a count sets the line; the from side takes, the to side adds.
  sides AS (
    SELECT id, at, pk, part_id, part_name, manufacturer, by_name, reason, note, from_container_id AS container_id,
           CASE WHEN reason = 'counted' THEN quantity END AS set_to,
           CASE WHEN reason = 'counted' THEN 0 ELSE -quantity END AS delta
    FROM m
    WHERE from_container_id IS NOT NULL AND reason <> 'delivered'
    UNION ALL
    SELECT id, at, pk, part_id, part_name, manufacturer, by_name, reason, note, to_container_id, NULL, quantity
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
  -- The box's last count: the newest count of any line in it, an add's own count left out (#398). The lines above
  -- keep that count: an added part did count its line.
  last_counts AS (
    SELECT DISTINCT ON (container_id) container_id, at, by_name
    FROM counts
    WHERE note <> 'counted as added'
    ORDER BY container_id, at DESC, id::text DESC
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

COMMENT ON FUNCTION public.on_site_job_summary(uuid, timestamptz) IS 'Materials on site (#209, v2.6743; #398, v2.8612): a job''s cages and boxes summed over its whole ledger in SQL — every line''s on hand, last touch, last count and Can''t find presses since; the last count per container, an added part''s own count left out; the counts and Can''t find presses since p_since with what the ledger expected; the returns. The same arithmetic as src/lib/materials/onSite.ts; the screens read it when a job''s ledger passes the 5,000 rows they read themselves. Runs as the caller.';
