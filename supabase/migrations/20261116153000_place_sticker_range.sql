-- Stickers before boxes, punch list #329, design section 10, PR 10 (v2.7406): These are on boxes.
--
-- Taunya's go of 2026-11-15 for PRs 8 to 10. A sticker printed with a name cannot shift anything: the tape reads G78
-- and it goes on the cage painted G78. So the scan need not be the only way a sticker goes on a box. The person who
-- stuck a roll types the range they used, *G78 to G150, cages, Arena*, and one press makes those boxes with their
-- stickers on them, the kind and the place. The scan then only adds what is inside.
--
-- place_sticker_range(job, names, kind, place, where) is a caller of place_sticker, once a sticker, and holds no rule
-- of its own about a sticker or a box: the gate, the box rule, the events' judge and every policy run as they do for
-- one scan. For each name, in the order handed:
--   made        the site had no live box of the name: the box is made on the job with the kind, the place and the
--               where line, and every blank sticker of the name goes on it.
--   took        the site has a live box of the name: its blank stickers go on that box, and nothing else of the box
--               changes.
--   already     no blank sticker of the name is left, and one is on a box: left as it is, and said.
--   no_sticker  no sticker of the name was printed for the site: nothing is made, and said. A box with no sticker is
--               Add a container's business.
--   held        the name's own writes were refused (a rule, a policy): undone, said with the reason, and the rest go on.
-- The site is the job's development, every job of it, or the job alone (on_site_site_job_ids, #351), read as the
-- caller: a sticker on a run of a job they cannot touch is not there for them, as for a scan.
--
-- The names come from the client's range parser (src/lib/materials/stickerNames.ts) as a plain list, as the mint's do.
-- The database reads no range. It holds what it can check on the list: each name under the box rule, 500 at most.
--
-- This is not the 200 empty boxes at print time the card rejected: it is told the range that was used, by the person
-- who used it, so it leaves no leftovers. A name with no sticker makes nothing.
--
-- No table is created, so no fence call is owed. One function, CREATE OR REPLACE, idempotent. The client's press calls
-- it, so the push follows the merge at once.

SET lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.place_sticker_range(
  p_job_id uuid,
  p_names text[],
  p_kind text DEFAULT 'cage',
  p_place_id uuid DEFAULT NULL,
  p_where_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_kind text := COALESCE(NULLIF(btrim(p_kind), ''), 'cage');
  v_names text[];
  v_name text;
  v_words text;
  v_site uuid[];
  v_box uuid;
  v_new boolean;
  v_any boolean;
  v_sticker uuid;
  v_answer jsonb;
  v_made text[] := '{}';
  v_took text[] := '{}';
  v_already text[] := '{}';
  v_none text[] := '{}';
  v_held jsonb := '[]'::jsonb;
  v_stickers integer := 0;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to put stickers on boxes.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot put a sticker on a box.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot put a sticker on a box.' USING ERRCODE = '42501';
  END IF;
  IF p_job_id IS NULL OR NOT public.on_site_can_touch_job(p_job_id) THEN
    RAISE EXCEPTION 'That job is not one you can reach. Ask the office to add you to its team.' USING ERRCODE = '42501';
  END IF;
  IF v_kind NOT IN ('cage', 'box', 'loose') THEN
    RAISE EXCEPTION 'A sticker goes on a cage, a box or a pile.';
  END IF;
  IF p_place_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.job_places p WHERE p.id = p_place_id AND p.job_id = p_job_id) THEN
    RAISE EXCEPTION 'That place is not on this job.';
  END IF;

  -- The names as the box rule saves them, each once, in the order handed.
  SELECT array_agg(d.n ORDER BY d.ord) INTO v_names
  FROM (
    SELECT q.n, min(q.ord) AS ord
    FROM (SELECT upper(btrim(t.x)) AS n, t.ord FROM unnest(COALESCE(p_names, '{}'::text[])) WITH ORDINALITY AS t(x, ord)) q
    WHERE q.n <> ''
    GROUP BY q.n
  ) d;
  IF v_names IS NULL THEN
    RAISE EXCEPTION 'Name the stickers that are on boxes, like G78 to G150.';
  END IF;
  IF array_length(v_names, 1) > 500 THEN
    RAISE EXCEPTION 'A range is 500 names at most. This one is %.', array_length(v_names, 1);
  END IF;
  FOREACH v_name IN ARRAY v_names LOOP
    v_words := public.box_name_words(v_name);
    IF v_words IS NOT NULL THEN
      RAISE EXCEPTION '%', v_words;
    END IF;
  END LOOP;

  SELECT array_agg(j) INTO v_site FROM public.on_site_site_job_ids(p_job_id) AS j;
  v_site := COALESCE(v_site, ARRAY[p_job_id]);

  FOREACH v_name IN ARRAY v_names LOOP
    BEGIN
      v_new := false;
      v_any := false;
      v_count := 0;
      -- Under the caller's own RLS: the site's live box of the name, if they may see one.
      SELECT c.id INTO v_box
      FROM public.job_containers c
      WHERE c.job_id = ANY (v_site) AND c.retired_at IS NULL AND upper(btrim(c.label)) = v_name
      ORDER BY (c.job_id = p_job_id) DESC, c.created_at
      LIMIT 1;

      FOR v_sticker IN
        SELECT s.id
        FROM public.box_stickers s
        JOIN public.sticker_runs r ON r.id = s.run_id
        WHERE s.box_name = v_name AND s.container_id IS NULL AND s.lost_at IS NULL AND r.job_id = ANY (v_site)
        ORDER BY s.number
      LOOP
        IF v_box IS NULL THEN
          v_answer := public.place_sticker(v_sticker, NULL, p_job_id, v_name, v_kind, p_where_note, p_place_id);
          IF (v_answer ->> 'ok')::boolean THEN
            v_box := (v_answer ->> 'container_id')::uuid;
            v_new := true;
            v_any := true;
            v_count := v_count + 1;
          END IF;
        ELSE
          v_answer := public.place_sticker(v_sticker, v_box);
          IF (v_answer ->> 'ok')::boolean THEN
            v_any := true;
            v_count := v_count + 1;
          END IF;
        END IF;
      END LOOP;

      IF v_any AND v_new THEN
        v_made := v_made || v_name;
      ELSIF v_any THEN
        v_took := v_took || v_name;
      ELSIF EXISTS (
        SELECT 1 FROM public.box_stickers s
        JOIN public.job_containers c ON c.id = s.container_id
        WHERE s.box_name = v_name AND s.lost_at IS NULL AND c.job_id = ANY (v_site)
      ) THEN
        v_already := v_already || v_name;
      ELSE
        v_none := v_none || v_name;
      END IF;
      -- Counted once the name's block is through, so a name undone below adds nothing.
      v_stickers := v_stickers + v_count;
    EXCEPTION WHEN OTHERS THEN
      -- This name's box and placings are undone with the block; the reason is the database's own words.
      v_held := v_held || jsonb_build_object('name', v_name, 'why', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'made', to_jsonb(v_made),
    'took', to_jsonb(v_took),
    'already', to_jsonb(v_already),
    'no_sticker', to_jsonb(v_none),
    'held', v_held,
    'stickers', v_stickers
  );
END;
$fn$;
COMMENT ON FUNCTION public.place_sticker_range(uuid, text[], text, uuid, text) IS 'Stickers before boxes (#329, section 10): These are on boxes. Puts the site''s blank stickers of the names handed on their boxes in one call, through place_sticker once a sticker: a name with no live box on the site makes one on p_job_id with the kind, the place and the where line (made), a name that is a live box takes its stickers (took), a name whose sticker is on a box already is left (already), a name no sticker was printed with makes nothing (no_sticker), and a name whose writes were refused is undone and said with the reason (held) while the rest go on. Answers { ok, made, took, already, no_sticker, held: [{ name, why }], stickers }. The names are a plain list under the box rule, 500 at most; the range is read on the client. SECURITY INVOKER, so the gate and every policy judge the caller.';
REVOKE EXECUTE ON FUNCTION public.place_sticker_range(uuid, text[], text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_sticker_range(uuid, text[], text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.place_sticker_range(uuid, text[], text, uuid, text) TO authenticated;
