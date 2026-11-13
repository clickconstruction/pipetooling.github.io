SET lock_timeout = '3s';

-- A tech reads one look before a job exists (punch list #319 PR 7, v2.7006). The owner's idea of 2026-11-11, the part
-- he called the most novel: a technician sees the problem before it goes on a schedule. The office asks one tech from
-- the look's card. The ask rides a task card, which already reaches a tech with a push and sits on the Checklist, and
-- the task's link opens a page that shows that one look and nothing else of the customer's thread. The tech answers
-- there, and the answer lands on the thread as a team note. No new table, so no fence call.
--
--   1. On first_looks: who was asked (asked_tech_ids, the people the task was given to), the task (asked_task_id) and
--      when; the tech's read (tech_read: can_price or needs_visit), a note, who read it and when.
--   2. ask_tech_first_look(p_look_id, p_item_id): the office team. Reads the task's own people from
--      checklist_item_assignees, so the gate opens for exactly the people the task went to, never for a name the
--      caller hands in.
--   3. answer_first_look(p_look_id, p_read, p_note): an asked tech, or the office. Keeps the read on the look and
--      writes one team note on the person's thread.
--   4. Who reads a look: beside the office team and the job's team, a person the look was asked of. On both tables and
--      on the bucket.

ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS asked_tech_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS asked_task_id uuid;
ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS asked_tech_at timestamptz;
ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS tech_read text CHECK (tech_read IS NULL OR tech_read IN ('can_price', 'needs_visit'));
ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS tech_note text CHECK (tech_note IS NULL OR char_length(tech_note) <= 1000);
ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS tech_read_at timestamptz;
ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS tech_read_by uuid;
ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS tech_read_name text CHECK (tech_read_name IS NULL OR char_length(tech_read_name) <= 120);

COMMENT ON COLUMN public.first_looks.asked_tech_ids IS
  'First look (punch list #319 PR 7): the people the look was asked of, read from the task''s own assignees by ask_tech_first_look. Each may read this one look.';
COMMENT ON COLUMN public.first_looks.tech_read IS
  'First look (punch list #319 PR 7): the tech''s read before a job exists: can_price (from the photos) or needs_visit.';

CREATE OR REPLACE FUNCTION public.ask_tech_first_look(p_look_id uuid, p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot ask a tech.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot ask a tech.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office can ask a tech.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(array_agg(DISTINCT a.user_id), '{}') INTO v_ids FROM public.checklist_item_assignees a WHERE a.checklist_item_id = p_item_id;
  IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'That task has nobody on it.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.first_looks
     SET asked_tech_ids = v_ids, asked_task_id = p_item_id, asked_tech_at = now()
   WHERE id = p_look_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That look is not there.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true, 'asked', array_length(v_ids, 1));
END;
$$;

COMMENT ON FUNCTION public.ask_tech_first_look(uuid, uuid) IS
  'First look (punch list #319 PR 7): the office asks a tech to read a look before a job exists. The people asked are the task''s own assignees, read here. The office team only.';

REVOKE ALL ON FUNCTION public.ask_tech_first_look(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ask_tech_first_look(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.answer_first_look(p_look_id uuid, p_read text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_contact uuid;
  v_asked uuid[];
  v_name text;
  v_note text := nullif(btrim(left(coalesce(p_note, ''), 1000)), '');
  v_words text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot answer a look.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot answer a look.' USING ERRCODE = '42501';
  END IF;
  IF p_read NOT IN ('can_price', 'needs_visit') THEN
    RAISE EXCEPTION 'Pick one of the two answers.' USING ERRCODE = 'P0001';
  END IF;
  SELECT l.contact_id, l.asked_tech_ids INTO v_contact, v_asked FROM public.first_looks l WHERE l.id = p_look_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That look is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (v_me = ANY (v_asked) OR public.gc_office_team()) THEN
    RAISE EXCEPTION 'This look was not asked of you.' USING ERRCODE = '42501';
  END IF;
  v_name := public.follow_up_user_name(v_me);
  UPDATE public.first_looks
     SET tech_read = p_read, tech_note = v_note, tech_read_at = now(), tech_read_by = v_me, tech_read_name = left(coalesce(v_name, ''), 120)
   WHERE id = p_look_id;
  IF v_contact IS NOT NULL THEN
    v_words := 'First look, read from the photos: '
      || CASE WHEN p_read = 'can_price' THEN 'I can price it from this.' ELSE 'It needs a visit to price.' END
      || CASE WHEN v_note IS NOT NULL THEN ' ' || v_note ELSE '' END;
    INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, body)
    VALUES (v_contact, 'note', 'team', v_me, v_name, v_words);
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.answer_first_look(uuid, text, text) IS
  'First look (punch list #319 PR 7): an asked tech (or the office) answers a look: can_price or needs_visit, with a note. Kept on the look and written on the person''s thread as a team note.';

REVOKE ALL ON FUNCTION public.answer_first_look(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_first_look(uuid, text, text) TO authenticated;

-- A person the look was asked of reads that one look, its files and their bytes: beside the other read policies.
DROP POLICY IF EXISTS first_looks_select_asked ON public.first_looks;
CREATE POLICY first_looks_select_asked ON public.first_looks FOR SELECT TO authenticated
  USING (auth.uid() = ANY (asked_tech_ids));

DROP POLICY IF EXISTS first_look_files_select_asked ON public.first_look_files;
CREATE POLICY first_look_files_select_asked ON public.first_look_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.first_looks l WHERE l.id = first_look_files.look_id AND auth.uid() = ANY (l.asked_tech_ids)));

DROP POLICY IF EXISTS first_look_files_select_asked ON storage.objects;
CREATE POLICY first_look_files_select_asked ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'first-look-files'
    AND EXISTS (SELECT 1 FROM public.first_looks l WHERE l.id::text = (storage.foldername(name))[1] AND auth.uid() = ANY (l.asked_tech_ids))
  );
