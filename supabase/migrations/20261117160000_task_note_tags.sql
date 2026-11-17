SET lock_timeout = '3s';

-- v2.7570 — Tag a teammate in a task note: the ground (punch list #375, PR 1 of six).
--
-- WHY. Tagging a teammate went live on job notes as #363 (jobs_ledger_note_tags, 20261116100000). The owner asked on
-- 2026-11-16 for the same in task notes. A task note is a checklist_instance_events row of kind 'comment', and it
-- tells nobody: no notice, no count, no line on the Dashboard. A tag is its own row: a name picked from a list, never
-- a word read back out of the note. No screen calls any of this yet.
--
-- LIFE OF A TAG
--   task_note_post_tagged()   posts a typed note and its tags in one transaction
--   the trigger below         a typed note by the tagged person, on any day of that task, answers their waiting tags
--   task_note_tag_done()      the tagged person: No reply needed, with no note
--   task_note_tags_seen()     the asker has seen the answers: they stop counting
-- A tag waits (cleared_at IS NULL) until the tagged person writes a note on that task ('answered', with the answering
-- note) or presses No reply needed ('done'). A tick, a stuck line, a moved line and every other line of the thread
-- answer nothing: only a 'comment' does. A cleared tag counts for the asker until asker_seen_at is set. The tag stays
-- with the task (item_id), not the day, so a note on tomorrow's row of a repeating task answers a tag made today.
--
-- WHY A TRIGGER HERE AND NOT ON JOBS. A job's notes table cannot tell a typed line from a stamp, so on jobs the
-- answer lives in the post function. A task's thread says what each line is, so the rule sits on the table, and the
-- boxes that insert a note straight (History, the Roadmap card, Review's Reopen with comment, My Inbox) answer a tag
-- from the first day with no client change. Like log_checklist_instance_transitions, it never fails the insert.
--
-- WHO. task_note_people() is the list for one day row: only people who can already open it. The task's own people
-- are whoever gave it and whoever has that day row, whatever their role but subcontractor or estimator. Then the
-- office as #363 counts it: dev, master_technician, assistant, controller. A primary, a helper or a superintendent is
-- on the list only when the task is theirs. Never an archived person, a digital twin or an account in training mode,
-- and a sample or walk-tester account only for a dev or another such account. The writer must be on that same list
-- to tag. A tag never opens a task to someone new.
--
-- The card planned this list from the task and both assignee lists. It reads the day row instead: a person on the
-- task's own list who no longer has this day (task_hand_on gives away one day of a repeating task and leaves the
-- task's list alone, 20261117120000) cannot read this day's thread, so offering them would break the rule above.
--
-- WRITES. There is no INSERT / UPDATE / DELETE policy and no write grant: the functions are the only writers.
-- task_note_post_tagged is SECURITY INVOKER on purpose: the note goes in under the caller's own row-level security,
-- exactly as the note box inserts it today, and only the tag rows go through the definer, which takes them only for
-- the note this same transaction has just posted (the marker of 20261116190000, under a name of its own).
--
-- Idempotent: the table and its indexes IF NOT EXISTS, the policy and the trigger dropped and remade, every function
-- CREATE OR REPLACE with its grants restated. It makes a table, so it ends with the four fence calls.

CREATE TABLE IF NOT EXISTS public.task_note_tags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES public.checklist_instance_events(id) ON DELETE CASCADE,
  instance_id      uuid NOT NULL REFERENCES public.checklist_instances(id) ON DELETE CASCADE,
  item_id          uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  tagged_user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tagged_name      text NOT NULL CHECK (btrim(tagged_name) <> ''),
  tagger_user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  cleared_at       timestamptz,
  cleared_how      text CHECK (cleared_how IN ('answered', 'done')),
  answer_event_id  uuid REFERENCES public.checklist_instance_events(id) ON DELETE SET NULL,
  asker_seen_at    timestamptz,
  CONSTRAINT task_note_tags_not_self CHECK (tagged_user_id <> tagger_user_id),
  CONSTRAINT task_note_tags_cleared_has_how CHECK ((cleared_at IS NULL) = (cleared_how IS NULL)),
  CONSTRAINT task_note_tags_one_per_person UNIQUE (event_id, tagged_user_id)
);

COMMENT ON TABLE public.task_note_tags IS
  'A teammate tagged in a task note (punch list #375): one row a person, waiting until they write a note on that task or press No reply needed. event_id is the note, instance_id its day row, item_id the task the tag stays with. tagged_name is the name as it was written in the note. Written only by task_note_post_tagged(), the answering trigger on checklist_instance_events, task_note_tag_done() and task_note_tags_seen(). v2.7570.';

CREATE INDEX IF NOT EXISTS idx_task_note_tags_tagged_open
  ON public.task_note_tags (tagged_user_id)
  WHERE cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_note_tags_tagger
  ON public.task_note_tags (tagger_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_note_tags_item_tagged_open
  ON public.task_note_tags (item_id, tagged_user_id)
  WHERE cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_note_tags_answer_event
  ON public.task_note_tags (answer_event_id)
  WHERE answer_event_id IS NOT NULL;
-- A day row is deleted in the ordinary run of things (a pruned far day, an older Forward), and its tags go with it.
CREATE INDEX IF NOT EXISTS idx_task_note_tags_instance
  ON public.task_note_tags (instance_id);
CREATE INDEX IF NOT EXISTS idx_task_note_tags_item
  ON public.task_note_tags (item_id);

ALTER TABLE public.task_note_tags ENABLE ROW LEVEL SECURITY;

-- The two people read their own rows. Anyone else reads a tag when they can read its note, so the task's thread says
-- who a note waits on: the sub-select runs under the caller's own row-level security on the thread.
DROP POLICY IF EXISTS task_note_tags_select ON public.task_note_tags;
CREATE POLICY task_note_tags_select ON public.task_note_tags
  FOR SELECT TO authenticated
  USING (
    tagged_user_id = (SELECT auth.uid())
    OR tagger_user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.checklist_instance_events e WHERE e.id = task_note_tags.event_id)
  );

REVOKE ALL ON public.task_note_tags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.task_note_tags TO authenticated;
GRANT ALL ON public.task_note_tags TO service_role;

-- The list for one day row, whoever asks. Internal: the functions below call it, no client does.
CREATE OR REPLACE FUNCTION public.task_note_people(p_instance_id uuid, p_with_test boolean)
RETURNS TABLE (user_id uuid, name text, role text, on_task boolean, gave boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  WITH task AS (
    SELECT i.id AS instance_id, it.created_by_user_id AS giver
    FROM public.checklist_instances i
    JOIN public.checklist_items it ON it.id = i.checklist_item_id
    WHERE i.id = p_instance_id
  ),
  own AS (
    SELECT t.giver AS uid FROM task t
    UNION
    SELECT a.user_id FROM public.checklist_instance_assignees a WHERE a.checklist_instance_id = p_instance_id
  )
  SELECT u.id, u.name, u.role::text,
         EXISTS (SELECT 1 FROM own o WHERE o.uid = u.id),
         EXISTS (SELECT 1 FROM task t WHERE t.giver = u.id)
  FROM public.users u
  WHERE EXISTS (SELECT 1 FROM task)
    AND u.archived_at IS NULL
    AND NOT u.is_digital_twin
    AND NOT u.read_only
    AND btrim(coalesce(u.name, '')) <> ''
    AND (p_with_test OR NOT (u.is_sample OR u.is_walk_tester))
    AND (
      u.role = ANY (ARRAY['dev', 'master_technician', 'assistant', 'controller']::public.user_role[])
      OR (
        u.role <> ALL (ARRAY['subcontractor', 'estimator']::public.user_role[])
        AND EXISTS (SELECT 1 FROM own o WHERE o.uid = u.id)
      )
    );
$$;

COMMENT ON FUNCTION public.task_note_people(uuid, boolean) IS
  'Who may be tagged in a note on this task day row (punch list #375): only people who can already open it. Whoever gave the task and whoever has this day row, whatever their role but subcontractor or estimator (on_task; gave marks the giver), then the office (dev, master_technician, assistant, controller). Never an archived person, a digital twin or an account in training mode; sample and walk-tester accounts only when p_with_test. SECURITY DEFINER + row_security off, internal to the task_note_* functions. v2.7570.';

REVOKE EXECUTE ON FUNCTION public.task_note_people(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.task_note_people(uuid, boolean) TO service_role;

-- The list at the note box: everyone the caller may tag on this day row, the task's own people first.
CREATE OR REPLACE FUNCTION public.task_note_taggable(p_instance_id uuid)
RETURNS TABLE (user_id uuid, name text, role text, on_task boolean, gave boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM public.task_note_people(p_instance_id, true) p WHERE p.user_id = v_me) THEN
    RAISE EXCEPTION 'Only the office and this task''s own people can tag a teammate on it' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.user_id, p.name, p.role, p.on_task, p.gave
    FROM public.task_note_people(p_instance_id, public.job_note_caller_sees_test()) p
    WHERE p.user_id <> v_me
    ORDER BY p.on_task DESC, lower(p.name), p.user_id;
END;
$$;

COMMENT ON FUNCTION public.task_note_taggable(uuid) IS
  'The list at a task''s note box (punch list #375): who the caller may tag on this day row, the task''s own people first, without the caller. Refuses a caller who is not the office or one of the task''s own people. Test logins follow job_note_caller_sees_test(). v2.7570.';

REVOKE EXECUTE ON FUNCTION public.task_note_taggable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_note_taggable(uuid) TO authenticated, service_role;

-- The tag rows for a note its writer has just posted. Called by task_note_post_tagged in the same transaction: the
-- marker is local to the transaction and no client can set it, since each request is its own transaction and
-- set_config is not exposed. Adding a tag after the post is not in the first version.
CREATE OR REPLACE FUNCTION public.task_note_tags_write(p_event_id uuid, p_tagged uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_me       uuid := auth.uid();
  v_instance uuid;
  v_item     uuid;
  v_actor    uuid;
  v_kind     text;
  v_ids      uuid[];
  v_missing  text;
  v_n        integer := 0;
BEGIN
  SELECT e.instance_id, i.checklist_item_id, e.actor_user_id, e.event_type INTO v_instance, v_item, v_actor, v_kind
  FROM public.checklist_instance_events e
  JOIN public.checklist_instances i ON i.id = e.instance_id
  WHERE e.id = p_event_id;
  IF v_me IS NULL OR v_instance IS NULL OR v_actor IS DISTINCT FROM v_me OR v_kind IS DISTINCT FROM 'comment' THEN
    RAISE EXCEPTION 'Only the note''s writer can tag a teammate in it' USING ERRCODE = '42501';
  END IF;
  IF current_setting('pt.task_note_just_posted', true) IS DISTINCT FROM p_event_id::text THEN
    RAISE EXCEPTION 'A teammate is tagged when the note is posted, not afterwards' USING ERRCODE = '22023';
  END IF;

  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_tagged, '{}'::uuid[])) AS x WHERE x IS NOT NULL AND x <> v_me);
  IF cardinality(v_ids) > 10 THEN
    RAISE EXCEPTION 'A note can tag ten people at most' USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_ids) > 0 THEN
    IF NOT EXISTS (SELECT 1 FROM public.task_note_people(v_instance, true) p WHERE p.user_id = v_me) THEN
      RAISE EXCEPTION 'Only the office and this task''s own people can tag a teammate on it' USING ERRCODE = '42501';
    END IF;
    SELECT string_agg(coalesce(nullif(btrim(u.name), ''), 'That person'), ', ' ORDER BY u.name) INTO v_missing
    FROM unnest(v_ids) AS x
    LEFT JOIN public.users u ON u.id = x
    WHERE NOT EXISTS (
      SELECT 1 FROM public.task_note_people(v_instance, public.job_note_caller_sees_test()) p WHERE p.user_id = x
    );
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION '% cannot be tagged on this task, so the note was not posted', v_missing USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.task_note_tags (event_id, instance_id, item_id, tagged_user_id, tagged_name, tagger_user_id)
    SELECT p_event_id, v_instance, v_item, u.id, btrim(u.name), v_me
    FROM public.users u WHERE u.id = ANY (v_ids)
    ON CONFLICT (event_id, tagged_user_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.task_note_tags_write(uuid, uuid[]) IS
  'Writes the tag rows for a task note its writer has just posted in this same transaction (the pt.task_note_just_posted marker), refusing a person task_note_people() does not list, ten at most. Returns the tags written. Called by task_note_post_tagged(). The answer to the writer''s own waiting tags is the trigger''s, not this function''s. v2.7570.';

REVOKE EXECUTE ON FUNCTION public.task_note_tags_write(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_note_tags_write(uuid, uuid[]) TO authenticated, service_role;

-- Post a typed note with its tags. SECURITY INVOKER: the insert runs under the caller's own policies on the thread.
CREATE OR REPLACE FUNCTION public.task_note_post_tagged(p_instance_id uuid, p_body text, p_tagged uuid[] DEFAULT '{}'::uuid[])
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
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body)
  VALUES (p_instance_id, 'comment', auth.uid(), v_body)
  RETURNING id INTO v_id;
  PERFORM set_config('pt.task_note_just_posted', v_id::text, true);
  PERFORM public.task_note_tags_write(v_id, p_tagged);
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.task_note_post_tagged(uuid, text, uuid[]) IS
  'Posts a typed task note and its tags in one transaction (punch list #375): the note under the caller''s own row-level security, as the note box inserts it, the tags through task_note_tags_write(). A refused tag posts nothing. Returns the note''s id. v2.7570.';

REVOKE EXECUTE ON FUNCTION public.task_note_post_tagged(uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_note_post_tagged(uuid, text, uuid[]) TO authenticated, service_role;

-- A typed note answers. AFTER INSERT on the thread, for a 'comment' alone: every tag that waits on the note's writer
-- on that task, on any of its day rows, is answered by this note. One word here changes what answers.
CREATE OR REPLACE FUNCTION public.task_note_answers_tags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.event_type = 'comment' AND NEW.actor_user_id IS NOT NULL THEN
    BEGIN
      UPDATE public.task_note_tags t
         SET cleared_at = now(), cleared_how = 'answered', answer_event_id = NEW.id
       WHERE t.tagged_user_id = NEW.actor_user_id
         AND t.cleared_at IS NULL
         AND t.event_id <> NEW.id
         AND t.item_id = (SELECT i.checklist_item_id FROM public.checklist_instances i WHERE i.id = NEW.instance_id);
    EXCEPTION WHEN OTHERS THEN
      -- The thread's history must never make a note fail (the rule of log_checklist_instance_transitions).
      RAISE WARNING 'task note tags were not answered for note %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.task_note_answers_tags() IS
  'Trigger on checklist_instance_events (punch list #375): a typed note (event_type comment) answers every tag that waits on its writer on that task, on any day row. No other kind of line answers. Never fails the insert. v2.7570.';

REVOKE EXECUTE ON FUNCTION public.task_note_answers_tags() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS task_note_answers_tags_trigger ON public.checklist_instance_events;
CREATE TRIGGER task_note_answers_tags_trigger
  AFTER INSERT ON public.checklist_instance_events
  FOR EACH ROW
  WHEN (NEW.event_type = 'comment')
  EXECUTE FUNCTION public.task_note_answers_tags();

-- The section's two lists in one read: what waits on me, and what I asked (still waiting, answered and not seen, or
-- cleared within the last seven days). A tagged person reads the note they were tagged in even after the task is
-- handed on, which is why this is a definer and not a join under their policies.
CREATE OR REPLACE FUNCTION public.task_note_tags_mine()
RETURNS TABLE (
  tag_id uuid,
  kind text,
  event_id uuid,
  instance_id uuid,
  item_id uuid,
  task_title text,
  task_date date,
  note_body text,
  note_created_at timestamptz,
  tagger_user_id uuid,
  tagger_name text,
  tagged_user_id uuid,
  tagged_name text,
  tagged_left boolean,
  created_at timestamptz,
  cleared_at timestamptz,
  cleared_how text,
  answer_event_id uuid,
  answer_body text,
  asker_seen_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT t.id,
         CASE WHEN t.tagged_user_id = auth.uid() AND t.cleared_at IS NULL THEN 'waiting' ELSE 'asked' END,
         t.event_id, t.instance_id, t.item_id, it.title, i.scheduled_date,
         n.body, n.created_at,
         t.tagger_user_id, coalesce(nullif(btrim(a.name), ''), 'A teammate'),
         t.tagged_user_id, t.tagged_name, coalesce(g.archived_at IS NOT NULL, false),
         t.created_at, t.cleared_at, t.cleared_how, t.answer_event_id, an.body, t.asker_seen_at
  FROM public.task_note_tags t
  JOIN public.checklist_instance_events n ON n.id = t.event_id
  JOIN public.checklist_instances i ON i.id = t.instance_id
  JOIN public.checklist_items it ON it.id = t.item_id
  LEFT JOIN public.users a ON a.id = t.tagger_user_id
  LEFT JOIN public.users g ON g.id = t.tagged_user_id
  LEFT JOIN public.checklist_instance_events an ON an.id = t.answer_event_id
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

COMMENT ON FUNCTION public.task_note_tags_mine() IS
  'The Tagged task notes section in one read (punch list #375): kind ''waiting'' for tags that wait on the caller, oldest first, and ''asked'' for the tags the caller made that still wait, were answered and not yet seen, or cleared within seven days. Carries the task''s title as written, the day row''s date, the note and the answer, and tagged_left when the tagged person is archived. v2.7570.';

REVOKE EXECUTE ON FUNCTION public.task_note_tags_mine() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_note_tags_mine() TO authenticated, service_role;

-- The number above Checklist: tags that wait on me, and answers to my own tags I have not seen.
CREATE OR REPLACE FUNCTION public.task_note_tags_count()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT count(*)::integer
  FROM public.task_note_tags t
  WHERE auth.uid() IS NOT NULL
    AND (
      (t.tagged_user_id = auth.uid() AND t.cleared_at IS NULL)
      OR (t.tagger_user_id = auth.uid() AND t.cleared_at IS NOT NULL AND t.asker_seen_at IS NULL)
    );
$$;

COMMENT ON FUNCTION public.task_note_tags_count() IS
  'The count above Checklist (punch list #375): the caller''s waiting task tags plus the cleared task tags they asked and have not seen. v2.7570.';

REVOKE EXECUTE ON FUNCTION public.task_note_tags_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_note_tags_count() TO authenticated, service_role;

-- No reply needed: the tagged person clears one tag with no note.
CREATE OR REPLACE FUNCTION public.task_note_tag_done(p_tag_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.task_note_tags
     SET cleared_at = now(), cleared_how = 'done'
   WHERE id = p_tag_id AND tagged_user_id = auth.uid() AND cleared_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

COMMENT ON FUNCTION public.task_note_tag_done(uuid) IS
  'No reply needed (punch list #375): the tagged person clears one waiting task tag with no note. False when the tag is not theirs or no longer waits. v2.7570.';

REVOKE EXECUTE ON FUNCTION public.task_note_tag_done(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_note_tag_done(uuid) TO authenticated, service_role;

-- The asker has had the answers on screen: they stop counting. Returns how many.
CREATE OR REPLACE FUNCTION public.task_note_tags_seen()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.task_note_tags
     SET asker_seen_at = now()
   WHERE tagger_user_id = auth.uid() AND cleared_at IS NOT NULL AND asker_seen_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.task_note_tags_seen() IS
  'Marks every cleared task tag the caller asked as seen (punch list #375), so an answer stops counting above Checklist once the You asked list has been on the asker''s screen. Returns how many. One function for each kind of tag: each section shows its own kind. v2.7570.';

REVOKE EXECUTE ON FUNCTION public.task_note_tags_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_note_tags_seen() TO authenticated, service_role;

-- Both kinds in one read, for the Needs you line and its window. The job rows are job_note_tags_mine() unchanged and
-- the task rows task_note_tags_mine(); source says which. note_id is the job note or the task note.
CREATE OR REPLACE FUNCTION public.note_tags_mine()
RETURNS TABLE (
  source text,
  tag_id uuid,
  kind text,
  note_id uuid,
  job_id uuid,
  job_name text,
  job_number text,
  job_kind text,
  customer_name text,
  instance_id uuid,
  item_id uuid,
  task_title text,
  task_date date,
  note_body text,
  note_created_at timestamptz,
  tagger_user_id uuid,
  tagger_name text,
  tagged_user_id uuid,
  tagged_name text,
  tagged_left boolean,
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
  SELECT x.source, x.tag_id, x.kind, x.note_id, x.job_id, x.job_name, x.job_number, x.job_kind, x.customer_name,
         x.instance_id, x.item_id, x.task_title, x.task_date, x.note_body, x.note_created_at,
         x.tagger_user_id, x.tagger_name, x.tagged_user_id, x.tagged_name, x.tagged_left,
         x.created_at, x.cleared_at, x.cleared_how, x.answer_note_id, x.answer_body, x.asker_seen_at
  FROM (
    SELECT 'job'::text AS source, j.tag_id, j.kind, j.note_id, j.job_id, j.job_name, j.job_number, j.job_kind, j.customer_name,
           NULL::uuid AS instance_id, NULL::uuid AS item_id, NULL::text AS task_title, NULL::date AS task_date,
           j.note_body, j.note_created_at, j.tagger_user_id, j.tagger_name, j.tagged_user_id, j.tagged_name,
           coalesce(g.archived_at IS NOT NULL, false) AS tagged_left,
           j.created_at, j.cleared_at, j.cleared_how, j.answer_note_id, j.answer_body, j.asker_seen_at
    FROM public.job_note_tags_mine() j
    LEFT JOIN public.users g ON g.id = j.tagged_user_id
    UNION ALL
    SELECT 'task'::text, k.tag_id, k.kind, k.event_id, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text,
           k.instance_id, k.item_id, k.task_title, k.task_date,
           k.note_body, k.note_created_at, k.tagger_user_id, k.tagger_name, k.tagged_user_id, k.tagged_name,
           k.tagged_left,
           k.created_at, k.cleared_at, k.cleared_how, k.answer_event_id, k.answer_body, k.asker_seen_at
    FROM public.task_note_tags_mine() k
  ) x
  ORDER BY x.created_at, x.tag_id;
$$;

COMMENT ON FUNCTION public.note_tags_mine() IS
  'Job tags and task tags in one read (punch list #375), oldest first: source is ''job'' or ''task'', the job rows from job_note_tags_mine() unchanged and the task rows from task_note_tags_mine(). tagged_left is true when the tagged person is archived, for the has-left words under You asked. v2.7570.';

REVOKE EXECUTE ON FUNCTION public.note_tags_mine() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.note_tags_mine() TO authenticated, service_role;

-- The number on the Needs you line: both kinds.
CREATE OR REPLACE FUNCTION public.note_tags_count()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.job_note_tags_count() + public.task_note_tags_count();
$$;

COMMENT ON FUNCTION public.note_tags_count() IS
  'Job tags and task tags counted together (punch list #375): job_note_tags_count() plus task_note_tags_count(). v2.7570.';

REVOKE EXECUTE ON FUNCTION public.note_tags_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.note_tags_count() TO authenticated, service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
