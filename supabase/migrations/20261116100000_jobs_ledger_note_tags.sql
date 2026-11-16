SET lock_timeout = '3s';

-- v2.7385 — Tag a teammate in a job note: the ground (punch list #363, PR 2 of six).
--
-- WHY. Taunya asked on 2026-11-15 to tag a teammate with @name in a job note and have it reach that person, with a
-- count above Jobs. A job note (jobs_ledger_thread_notes) is one row with no reader and no read mark, so a question
-- in it reaches nobody. A tag is its own row: a name picked from a list, never a word read back out of the note,
-- because the team types @ to mean "at" and two people can share a first name. No screen calls any of this yet.
--
-- LIFE OF A TAG
--   job_note_post_tagged()   posts a typed note and its tags in one transaction, and answers the writer's own
--                            waiting tags on that job
--   job_note_tag_done()      the tagged person: No reply needed, with no note
--   job_note_tags_seen()     the asker has seen the answers: they stop counting
-- A tag waits (cleared_at IS NULL) until the tagged person posts a typed note on that job ('answered', with the
-- answering note) or presses No reply needed ('done'). Opening a job clears nothing. A cleared tag counts for the
-- asker until asker_seen_at is set. Rows stay: they are the record of who asked whom, and they go with their note.
--
-- WHO. job_note_people() is the list: the office (dev, master_technician, assistant, controller) and the job's crew
-- (its master, its team members and anyone on its schedule this week or last, when their role is helpers,
-- superintendent or primary). Not subcontractors, not estimators, not archived people, not digital twins, and not an
-- account in training mode (users.read_only), which could neither answer nor press No reply needed. Sample and
-- walk-tester accounts are offered only to a dev or to another such account, so a walk on a ZZ Test job is whole and
-- no real teammate is ever offered a test login. The writer must be on that same list to tag.
--
-- WRITES. There is no INSERT / UPDATE / DELETE policy: the functions are the only writers, so no client can rewrite
-- who asked whom. job_note_post_tagged is SECURITY INVOKER on purpose: the note is inserted under the caller's own
-- row-level security, exactly as the note box inserts it today, and only the tag rows go through the definer.

CREATE TABLE IF NOT EXISTS public.jobs_ledger_note_tags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id         uuid NOT NULL REFERENCES public.jobs_ledger_thread_notes(id) ON DELETE CASCADE,
  job_id          uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  tagged_user_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tagged_name     text NOT NULL CHECK (btrim(tagged_name) <> ''),
  tagger_user_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  cleared_at      timestamptz,
  cleared_how     text CHECK (cleared_how IN ('answered', 'done')),
  answer_note_id  uuid REFERENCES public.jobs_ledger_thread_notes(id) ON DELETE SET NULL,
  asker_seen_at   timestamptz,
  CONSTRAINT jobs_ledger_note_tags_not_self CHECK (tagged_user_id <> tagger_user_id),
  CONSTRAINT jobs_ledger_note_tags_cleared_has_how CHECK ((cleared_at IS NULL) = (cleared_how IS NULL)),
  CONSTRAINT jobs_ledger_note_tags_one_per_person UNIQUE (note_id, tagged_user_id)
);

COMMENT ON TABLE public.jobs_ledger_note_tags IS
  'A teammate tagged in a job note (punch list #363): one row a person, waiting until they answer on the job or press No reply needed. tagged_name is the name as it was written in the note. Written only by job_note_post_tagged(), job_note_tag_done() and job_note_tags_seen(). v2.7385.';

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_note_tags_tagged_open
  ON public.jobs_ledger_note_tags (tagged_user_id)
  WHERE cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_ledger_note_tags_tagger
  ON public.jobs_ledger_note_tags (tagger_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_ledger_note_tags_job_tagged_open
  ON public.jobs_ledger_note_tags (job_id, tagged_user_id)
  WHERE cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_ledger_note_tags_answer_note
  ON public.jobs_ledger_note_tags (answer_note_id)
  WHERE answer_note_id IS NOT NULL;

ALTER TABLE public.jobs_ledger_note_tags ENABLE ROW LEVEL SECURITY;

-- The two people read their own rows. Anyone else reads a tag when they can read its note, so the job's row says who
-- a note waits on: the sub-select runs under the caller's own row-level security on the notes.
DROP POLICY IF EXISTS jobs_ledger_note_tags_select ON public.jobs_ledger_note_tags;
CREATE POLICY jobs_ledger_note_tags_select ON public.jobs_ledger_note_tags
  FOR SELECT TO authenticated
  USING (
    tagged_user_id = (SELECT auth.uid())
    OR tagger_user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.jobs_ledger_thread_notes n WHERE n.id = jobs_ledger_note_tags.note_id)
  );

REVOKE ALL ON public.jobs_ledger_note_tags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.jobs_ledger_note_tags TO authenticated;
GRANT ALL ON public.jobs_ledger_note_tags TO service_role;

-- The list for one job, whoever asks. Internal: the functions below call it, no client does.
CREATE OR REPLACE FUNCTION public.job_note_people(p_job_id uuid, p_with_test boolean)
RETURNS TABLE (user_id uuid, name text, role text, on_job boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  WITH span AS (
    SELECT date_trunc('week', now() AT TIME ZONE 'America/Chicago')::date - 7 AS first_day,
           date_trunc('week', now() AT TIME ZONE 'America/Chicago')::date + 6 AS last_day
  ),
  crew AS (
    SELECT j.master_user_id AS uid FROM public.jobs_ledger j WHERE j.id = p_job_id
    UNION
    SELECT m.user_id FROM public.jobs_ledger_team_members m WHERE m.job_id = p_job_id
    UNION
    SELECT b.assignee_user_id FROM public.job_schedule_blocks b, span s
    WHERE b.job_id = p_job_id AND b.work_date BETWEEN s.first_day AND s.last_day
  )
  SELECT u.id, u.name, u.role::text, EXISTS (SELECT 1 FROM crew c WHERE c.uid = u.id)
  FROM public.users u
  WHERE EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id)
    AND u.archived_at IS NULL
    AND NOT u.is_digital_twin
    AND NOT u.read_only
    AND btrim(coalesce(u.name, '')) <> ''
    AND (p_with_test OR NOT (u.is_sample OR u.is_walk_tester))
    AND (
      u.role = ANY (ARRAY['dev', 'master_technician', 'assistant', 'controller']::public.user_role[])
      OR (
        u.role = ANY (ARRAY['helpers', 'superintendent', 'primary']::public.user_role[])
        AND EXISTS (SELECT 1 FROM crew c WHERE c.uid = u.id)
      )
    );
$$;

COMMENT ON FUNCTION public.job_note_people(uuid, boolean) IS
  'Who may be tagged in a note on this Pipeline job (punch list #363): the office, and the job''s master, crew and this week''s or last week''s dispatch when their role is helpers, superintendent or primary. Never a subcontractor, an estimator, an archived person, a digital twin or an account in training mode; sample and walk-tester accounts only when p_with_test. SECURITY DEFINER + row_security off, internal to the job_note_* functions. v2.7385.';

REVOKE EXECUTE ON FUNCTION public.job_note_people(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_note_people(uuid, boolean) TO service_role;

-- Whether the caller is offered test logins: a dev, or a sample or walk-tester account itself.
CREATE OR REPLACE FUNCTION public.job_note_caller_sees_test()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND (u.role = 'dev'::public.user_role OR u.is_sample OR u.is_walk_tester)
  );
$$;

COMMENT ON FUNCTION public.job_note_caller_sees_test() IS
  'True for a dev and for a sample or walk-tester account: the callers job_note_taggable() offers test logins to, so a walk on a ZZ Test job is whole and no real teammate is offered one. v2.7385.';

REVOKE EXECUTE ON FUNCTION public.job_note_caller_sees_test() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_note_caller_sees_test() TO service_role;

-- The list under the note box: everyone the caller may tag on this job, the job's crew first.
CREATE OR REPLACE FUNCTION public.job_note_taggable(p_job_id uuid)
RETURNS TABLE (user_id uuid, name text, role text, on_job boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM public.job_note_people(p_job_id, true) p WHERE p.user_id = v_me) THEN
    RAISE EXCEPTION 'Only the office and this job''s crew can tag a teammate on it' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.user_id, p.name, p.role, p.on_job
    FROM public.job_note_people(p_job_id, public.job_note_caller_sees_test()) p
    WHERE p.user_id <> v_me
    ORDER BY p.on_job DESC, lower(p.name), p.user_id;
END;
$$;

COMMENT ON FUNCTION public.job_note_taggable(uuid) IS
  'The list under a job''s note box (punch list #363): who the caller may tag on this job, crew first, without the caller. Refuses a caller who is not the office or on the job''s crew. v2.7385.';

REVOKE EXECUTE ON FUNCTION public.job_note_taggable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_note_taggable(uuid) TO authenticated, service_role;

-- The tag rows for a note its writer has just posted, and the answer it gives to the writer's own waiting tags on
-- that job. Called by job_note_post_tagged in the same transaction; a note older than two minutes takes no tag, since
-- adding a tag after the post is not in the first version.
CREATE OR REPLACE FUNCTION public.job_note_tags_write(p_note_id uuid, p_tagged uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_me      uuid := auth.uid();
  v_job     uuid;
  v_author  uuid;
  v_posted  timestamptz;
  v_ids     uuid[];
  v_missing text;
  v_n       integer := 0;
BEGIN
  SELECT n.job_id, n.author_user_id, n.created_at INTO v_job, v_author, v_posted
  FROM public.jobs_ledger_thread_notes n WHERE n.id = p_note_id;
  IF v_me IS NULL OR v_job IS NULL OR v_author IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Only the note''s writer can tag a teammate in it' USING ERRCODE = '42501';
  END IF;
  IF v_posted < now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'A teammate is tagged when the note is posted, not afterwards' USING ERRCODE = '22023';
  END IF;

  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_tagged, '{}'::uuid[])) AS x WHERE x IS NOT NULL AND x <> v_me);
  IF cardinality(v_ids) > 10 THEN
    RAISE EXCEPTION 'A note can tag ten people at most' USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_ids) > 0 THEN
    IF NOT EXISTS (SELECT 1 FROM public.job_note_people(v_job, true) p WHERE p.user_id = v_me) THEN
      RAISE EXCEPTION 'Only the office and this job''s crew can tag a teammate on it' USING ERRCODE = '42501';
    END IF;
    SELECT string_agg(coalesce(nullif(btrim(u.name), ''), 'That person'), ', ' ORDER BY u.name) INTO v_missing
    FROM unnest(v_ids) AS x
    LEFT JOIN public.users u ON u.id = x
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_note_people(v_job, public.job_note_caller_sees_test()) p WHERE p.user_id = x
    );
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION '% cannot be tagged on this job, so the note was not posted', v_missing USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.jobs_ledger_note_tags (note_id, job_id, tagged_user_id, tagged_name, tagger_user_id)
    SELECT p_note_id, v_job, u.id, btrim(u.name), v_me
    FROM public.users u WHERE u.id = ANY (v_ids)
    ON CONFLICT (note_id, tagged_user_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;

  -- A typed note on the job answers every tag that waits on its writer there.
  UPDATE public.jobs_ledger_note_tags t
     SET cleared_at = now(), cleared_how = 'answered', answer_note_id = p_note_id
   WHERE t.job_id = v_job AND t.tagged_user_id = v_me AND t.cleared_at IS NULL AND t.note_id <> p_note_id;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.job_note_tags_write(uuid, uuid[]) IS
  'Writes the tag rows for a note its writer posted within the last two minutes, refusing a person job_note_people() does not list, and marks the writer''s own waiting tags on that job answered by this note. Returns the tags written. Called by job_note_post_tagged(). v2.7385.';

REVOKE EXECUTE ON FUNCTION public.job_note_tags_write(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_note_tags_write(uuid, uuid[]) TO authenticated, service_role;

-- Post a typed note with its tags. SECURITY INVOKER: the insert runs under the caller's own policies on the notes.
CREATE OR REPLACE FUNCTION public.job_note_post_tagged(p_job_id uuid, p_body text, p_tagged uuid[] DEFAULT '{}'::uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_body text := btrim(coalesce(p_body, ''));
  v_id   uuid;
BEGIN
  IF v_body = '' THEN
    RAISE EXCEPTION 'Write the note first' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
  VALUES (p_job_id, auth.uid(), v_body)
  RETURNING id INTO v_id;
  PERFORM public.job_note_tags_write(v_id, p_tagged);
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.job_note_post_tagged(uuid, text, uuid[]) IS
  'Posts a typed job note and its tags in one transaction (punch list #363): the note under the caller''s own row-level security, the tags through job_note_tags_write(), which also answers the caller''s waiting tags on that job. A refused tag posts nothing. Returns the note''s id. v2.7385.';

REVOKE EXECUTE ON FUNCTION public.job_note_post_tagged(uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_note_post_tagged(uuid, text, uuid[]) TO authenticated, service_role;

-- The section's two lists in one read: what waits on me, and what I asked (still waiting, answered and not seen,
-- or cleared within the last seven days). A tagged person reads the note they were tagged in even after they lose
-- the job, which is why this is a definer and not a join under their policies.
CREATE OR REPLACE FUNCTION public.job_note_tags_mine()
RETURNS TABLE (
  tag_id uuid,
  kind text,
  note_id uuid,
  job_id uuid,
  job_name text,
  job_number text,
  job_kind text,
  customer_name text,
  note_body text,
  note_created_at timestamptz,
  tagger_user_id uuid,
  tagger_name text,
  tagged_user_id uuid,
  tagged_name text,
  created_at timestamptz,
  cleared_at timestamptz,
  cleared_how text,
  answer_note_id uuid,
  answer_body text,
  asker_seen_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT t.id,
         CASE WHEN t.tagged_user_id = auth.uid() AND t.cleared_at IS NULL THEN 'waiting' ELSE 'asked' END,
         t.note_id, t.job_id, j.job_name, j.hcp_number, j.kind, j.customer_name,
         n.body, n.created_at,
         t.tagger_user_id, coalesce(nullif(btrim(a.name), ''), 'A teammate'),
         t.tagged_user_id, t.tagged_name,
         t.created_at, t.cleared_at, t.cleared_how, t.answer_note_id, an.body, t.asker_seen_at
  FROM public.jobs_ledger_note_tags t
  JOIN public.jobs_ledger_thread_notes n ON n.id = t.note_id
  JOIN public.jobs_ledger j ON j.id = t.job_id
  LEFT JOIN public.users a ON a.id = t.tagger_user_id
  LEFT JOIN public.jobs_ledger_thread_notes an ON an.id = t.answer_note_id
  WHERE auth.uid() IS NOT NULL
    AND (
      (t.tagged_user_id = auth.uid() AND t.cleared_at IS NULL)
      OR (
        t.tagger_user_id = auth.uid()
        AND (t.cleared_at IS NULL OR t.asker_seen_at IS NULL OR t.cleared_at > now() - interval '7 days')
      )
    )
  ORDER BY t.created_at, t.id;
$$;

COMMENT ON FUNCTION public.job_note_tags_mine() IS
  'The Tagged job notes section in one read (punch list #363): kind ''waiting'' for tags that wait on the caller, oldest first, and ''asked'' for the tags the caller made that still wait, were answered and not yet seen, or cleared within seven days. Carries the note and the answer, so a tagged person reads that one note even after losing the job. v2.7385.';

REVOKE EXECUTE ON FUNCTION public.job_note_tags_mine() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_note_tags_mine() TO authenticated, service_role;

-- The number above Jobs: tags that wait on me, and answers to my own tags I have not seen.
CREATE OR REPLACE FUNCTION public.job_note_tags_count()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT count(*)::integer
  FROM public.jobs_ledger_note_tags t
  WHERE auth.uid() IS NOT NULL
    AND (
      (t.tagged_user_id = auth.uid() AND t.cleared_at IS NULL)
      OR (t.tagger_user_id = auth.uid() AND t.cleared_at IS NOT NULL AND t.asker_seen_at IS NULL)
    );
$$;

COMMENT ON FUNCTION public.job_note_tags_count() IS
  'The count above Jobs (punch list #363): the caller''s waiting tags plus the cleared tags they asked and have not seen. A question clears when it is answered, an answer when it is seen. v2.7385.';

REVOKE EXECUTE ON FUNCTION public.job_note_tags_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_note_tags_count() TO authenticated, service_role;

-- No reply needed: the tagged person clears one tag with no note.
CREATE OR REPLACE FUNCTION public.job_note_tag_done(p_tag_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.jobs_ledger_note_tags
     SET cleared_at = now(), cleared_how = 'done'
   WHERE id = p_tag_id AND tagged_user_id = auth.uid() AND cleared_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

COMMENT ON FUNCTION public.job_note_tag_done(uuid) IS
  'No reply needed (punch list #363): the tagged person clears one waiting tag with no note. False when the tag is not theirs or no longer waits. v2.7385.';

REVOKE EXECUTE ON FUNCTION public.job_note_tag_done(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_note_tag_done(uuid) TO authenticated, service_role;

-- The asker has had the answers on screen: they stop counting. Returns how many.
CREATE OR REPLACE FUNCTION public.job_note_tags_seen()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.jobs_ledger_note_tags
     SET asker_seen_at = now()
   WHERE tagger_user_id = auth.uid() AND cleared_at IS NOT NULL AND asker_seen_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.job_note_tags_seen() IS
  'Marks every cleared tag the caller asked as seen (punch list #363), so an answer stops counting above Jobs once the You asked list has been on the asker''s screen. Returns how many. v2.7385.';

REVOKE EXECUTE ON FUNCTION public.job_note_tags_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_note_tags_seen() TO authenticated, service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
