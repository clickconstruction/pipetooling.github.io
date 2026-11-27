SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 2): a voided test lien record can be put back.
--
-- **Void** on a record in a job's Lien window, and **Take it back** on *Back from the clerk*, write one column:
-- job_lien_filings.voided_at. Nothing clears it again. Clearing it is one write, but the void does a second thing.
-- For a filed affidavit and a § 53.056 notice the trigger job_lien_filing_void_restores_paper (20261119050000) moves
-- each desk paper the record had sent. Where a newer live paper of that kind is on the job it sets the old paper
-- aside. Otherwise it puts the paper back on the desk, approved or drafted, and clears its tie and its sent day. It
-- kept no record of which paper it moved, which way, or what the sent day was, so nothing could undo it.
--
-- What this file makes, in order:
--
-- 1 · Three nullable columns on job_lien_desk_items, the void's memory, written by the trigger's function alone:
--       void_of_filing_ids   the records whose void moved or set aside this paper, oldest first. A list, because a
--                            paper put back can be sent again as a new record, and that record voided in its turn: one
--                            id would be overwritten, and the older record would then read as a record with no paper.
--                            Plain uuids with no foreign key: a record deleted later leaves an id nothing follows.
--       void_prior_sent_at   the paper's sent day before the newest of those voids cleared it. Null for a set aside
--                            paper, which keeps its sent day on the row.
--       void_stamped_at      when the newest of those voids wrote the paper. The guard stamps updated_at with the same
--                            now() in that write, so a paper whose updated_at still equals it has not been written
--                            since: it stands exactly as the void left it.
-- 2 · job_lien_filing_void_restores_paper(), restated from its newest definition (20261119050000) with one change:
--     each of its two writes also writes the memory. What a void does to a paper is otherwise as it was. The trigger
--     itself and the guard job_lien_desk_items_guard() are not touched.
-- 3 · lien_void_memory_since(): the instant from which a void's memory can be trusted, kept once. A record voided
--     before this file ran has no memory, and no memory then does not mean no paper moved. It answers one minute
--     after this file's own start, for two reasons. The trigger's new function is live only when this file commits,
--     after its now(). And voided_at is the clock of the device that pressed Void, which can run a little fast.
-- 4 · unvoid_test_lien_filing(p_filing_id): a developer alone, a ZZ test job alone (job_is_zz_test, 20261120163000),
--     and a refusal in words for everything else. It clears voided_at, the one column a void writes, and undoes
--     what the void did to each paper: a set aside paper stands again, and a paper put back goes to sent again, tied
--     to the record, with its old sent day. A paper that was written since the void, or that a later void touched,
--     refuses the whole call. A record voided before the memory is put back only when no desk paper of its kind was
--     on the job by then. A record that applied a paper already on record is refused: Undo was its take-back, and
--     Undo puts its own set aside notice back (v2.7508).
--
-- What was read and found to need nothing: job_lien_filings has no rule that holds one live record per job or per
-- month, in a constraint, an index or a kernel, so a record put back collides with nothing. The one such rule is
-- job_lien_desk_items_live_uniq, one live paper per job and kind that is not sent or missed, and this function only
-- ever moves a paper to sent or lifts a set aside off a sent paper. No other trigger fires on an update of a record:
-- its Activity line is written on insert alone, and a void writes none. A bill's pay offer, a release, a mail piece
-- and a sent copy are not changed by a void, so they are not changed here.
--
-- No row is written by this file. No table is made, so no fence is owed. Every statement is safe to run twice, and a
-- second run leaves lien_void_memory_since() at its first answer.

-- ---------- 1 · the void's memory, on the desk paper ----------

ALTER TABLE public.job_lien_desk_items
  ADD COLUMN IF NOT EXISTS void_of_filing_ids uuid[],
  ADD COLUMN IF NOT EXISTS void_prior_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_stamped_at timestamptz;

COMMENT ON COLUMN public.job_lien_desk_items.void_of_filing_ids IS
  'Punch list #443, row 2: the job_lien_filings rows whose void moved or set aside this paper, oldest first, written by job_lien_filing_void_restores_paper() alone. unvoid_test_lien_filing takes a record''s id off the end when it puts the paper back. Plain uuids with no foreign key: an id whose record was deleted is followed by nothing. Null on a paper no void has touched.';
COMMENT ON COLUMN public.job_lien_desk_items.void_prior_sent_at IS
  'Punch list #443, row 2: the paper''s sent_at before the newest void in void_of_filing_ids cleared it, so the un-void can give the day back. Null for a paper the void set aside, which keeps its sent day.';
COMMENT ON COLUMN public.job_lien_desk_items.void_stamped_at IS
  'Punch list #443, row 2: when the newest void in void_of_filing_ids wrote this paper. The guard stamps updated_at with the same now() in that write, so updated_at = void_stamped_at means nothing has written the paper since the void.';

-- ---------- 2 · a voided record puts its paper back, and remembers ----------

CREATE OR REPLACE FUNCTION public.job_lien_filing_void_restores_paper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
BEGIN
  FOR v_item IN
    SELECT i.id, i.job_id, i.kind, i.approved_at, i.sent_at
    FROM public.job_lien_desk_items i
    WHERE i.sent_filing_id = NEW.id
      AND i.kind = NEW.kind
      AND i.status = 'sent'
      AND i.voided_at IS NULL
    ORDER BY i.created_at DESC, i.id
    FOR UPDATE
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.job_lien_desk_items x
      WHERE x.job_id = v_item.job_id
        AND x.kind = v_item.kind
        AND x.id <> v_item.id
        AND x.voided_at IS NULL
        AND x.status NOT IN ('sent', 'missed')
    ) THEN
      -- One live paper per job and kind: a newer one is already on the desk, so this one is set aside. Its tie and
      -- its sent day stay on the row.
      UPDATE public.job_lien_desk_items
      SET voided_at = now(),
          void_of_filing_ids = array_append(void_of_filing_ids, NEW.id),
          void_prior_sent_at = NULL,
          void_stamped_at = now()
      WHERE id = v_item.id;
    ELSE
      UPDATE public.job_lien_desk_items
      SET status = CASE WHEN v_item.approved_at IS NOT NULL THEN 'approved' ELSE 'drafted' END,
          sent_filing_id = NULL,
          sent_at = NULL,
          void_of_filing_ids = array_append(void_of_filing_ids, NEW.id),
          void_prior_sent_at = v_item.sent_at,
          void_stamped_at = now()
      WHERE id = v_item.id;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.job_lien_filing_void_restores_paper() IS
  'Lien desk (v2.7892, a notice since v2.7911): when a filed affidavit or a notice record is voided, the paper it sent goes back in the same transaction: approved when it carries an approval, else drafted, its tie and sent day cleared; set aside when a newer live paper of its kind is on the job. Since punch list #443, row 2, each write also remembers the record, the sent day it cleared and when (void_of_filing_ids, void_prior_sent_at, void_stamped_at), so unvoid_test_lien_filing can undo it. Fired by the trigger of the same name on job_lien_filings.';

REVOKE EXECUTE ON FUNCTION public.job_lien_filing_void_restores_paper() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_lien_filing_void_restores_paper() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_lien_filing_void_restores_paper() FROM authenticated;

-- ---------- 3 · since when the memory is kept ----------

-- Made once, with its answer written into its body. A second run finds the function and leaves it alone. The answer
-- is written in UTC with its offset, so it reads the same under any session's date style or time zone.
DO $do$
BEGIN
  IF to_regprocedure('public.lien_void_memory_since()') IS NULL THEN
    EXECUTE format(
      'CREATE FUNCTION public.lien_void_memory_since() RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = public AS $f$ SELECT %L::timestamptz $f$',
      to_char((now() + interval '1 minute') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"')
    );
  END IF;
END
$do$;

COMMENT ON FUNCTION public.lien_void_memory_since() IS
  'Punch list #443, row 2: the instant from which a void of a lien record is known to have kept its memory on the desk paper it moved, one minute after migration lien_filing_unvoid_test first ran. Written once into the body and never replaced. Internal: unvoid_test_lien_filing asks it.';
REVOKE ALL ON FUNCTION public.lien_void_memory_since() FROM PUBLIC, anon, authenticated;

-- ---------- 4 · the un-void ----------

CREATE OR REPLACE FUNCTION public.unvoid_test_lien_filing(p_filing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_rec public.job_lien_filings%ROWTYPE;
  v_item record;
  v_remembered integer := 0;
  v_restored integer := 0;
  v_unset integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a developer can put a voided record back.' USING ERRCODE = 'P0001';
  END IF;
  -- The record is held until this transaction ends, and before any paper, which is the order a void takes them in.
  SELECT * INTO v_rec FROM public.job_lien_filings WHERE id = p_filing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The record is not there any more. Read the window again.' USING ERRCODE = 'P0001';
  END IF;
  IF v_rec.voided_at IS NULL THEN
    RAISE EXCEPTION 'This record is not voided.' USING ERRCODE = 'P0001';
  END IF;
  -- A record that applied a paper already on record: its Undo voided it and put its own set aside notice back
  -- (v2.7508, undoLienNoticeApply). Putting it back here would leave that notice on the desk beside it.
  IF v_rec.applied_from IS NOT NULL THEN
    RAISE EXCEPTION 'This record applied a paper already on record. Undo was its take-back. It stays voided.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.job_is_zz_test(v_rec.job_id) THEN
    RAISE EXCEPTION 'Only a record on a test job can be put back. This job is a real one.' USING ERRCODE = 'P0001';
  END IF;

  -- A void moves a paper for a filed affidavit and a § 53.056 notice alone (the trigger's own two kinds). A
  -- retainage notice's paper stays sent and tied through a void, and a release of record has no paper.
  IF v_rec.kind IN ('affidavit', 'notice_53_056') THEN
    -- Every paper that remembers this record's void, held, and each one checked before anything is written.
    FOR v_item IN
      SELECT i.id, i.status, i.sent_filing_id, i.voided_at, i.approved_at, i.updated_at, i.void_of_filing_ids, i.void_stamped_at
      FROM public.job_lien_desk_items i
      WHERE i.void_of_filing_ids @> ARRAY[p_filing_id]
      ORDER BY i.id
      FOR UPDATE
    LOOP
      v_remembered := v_remembered + 1;
      -- Still as the void left it: this record's void was the last to touch the paper, nothing has written the paper
      -- since, and it stands one of the two ways a void leaves a paper.
      IF v_item.void_of_filing_ids[array_upper(v_item.void_of_filing_ids, 1)] IS DISTINCT FROM p_filing_id
         OR v_item.void_stamped_at IS NULL
         OR v_item.updated_at IS DISTINCT FROM v_item.void_stamped_at
         OR NOT (
           (v_item.voided_at IS NOT NULL AND v_item.status = 'sent' AND v_item.sent_filing_id = p_filing_id)
           OR (v_item.voided_at IS NULL AND v_item.sent_filing_id IS NULL
               AND v_item.status = CASE WHEN v_item.approved_at IS NOT NULL THEN 'approved' ELSE 'drafted' END)
         ) THEN
        RAISE EXCEPTION 'The paper this record sent has moved on since the void. The record stays voided.' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;

    -- No paper remembers it. Past the memory's first instant that means the void moved no paper. Before it, nothing
    -- was kept, so the record goes back only when no desk paper of its kind was on the job by the day of the void.
    IF v_remembered = 0 AND v_rec.voided_at < public.lien_void_memory_since() THEN
      IF EXISTS (
        SELECT 1
        FROM public.job_lien_desk_items i
        WHERE i.job_id = v_rec.job_id
          AND i.kind = v_rec.kind
          AND i.created_at <= v_rec.voided_at
      ) THEN
        RAISE EXCEPTION 'This record was voided before the app kept what a void does to its desk paper. It stays voided.' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  -- The record first: voided_at is the one column a void writes. The void's trigger fires on live to voided alone.
  UPDATE public.job_lien_filings SET voided_at = NULL WHERE id = p_filing_id;

  -- Then each paper, the way it came. The rows are held from the check above. The guard stamps updated_at, and it
  -- stamps sent_at only when it is null, so the old sent day stands.
  IF v_remembered > 0 THEN
    FOR v_item IN
      SELECT i.id, i.voided_at, i.void_of_filing_ids, i.void_prior_sent_at
      FROM public.job_lien_desk_items i
      WHERE i.void_of_filing_ids @> ARRAY[p_filing_id]
      ORDER BY i.id
    LOOP
      IF v_item.voided_at IS NOT NULL THEN
        UPDATE public.job_lien_desk_items
        SET voided_at = NULL,
            void_of_filing_ids = NULLIF(trim_array(v_item.void_of_filing_ids, 1), '{}'::uuid[]),
            void_prior_sent_at = NULL,
            void_stamped_at = NULL
        WHERE id = v_item.id;
        v_unset := v_unset + 1;
      ELSE
        UPDATE public.job_lien_desk_items
        SET status = 'sent',
            sent_filing_id = p_filing_id,
            sent_at = v_item.void_prior_sent_at,
            void_of_filing_ids = NULLIF(trim_array(v_item.void_of_filing_ids, 1), '{}'::uuid[]),
            void_prior_sent_at = NULL,
            void_stamped_at = NULL
        WHERE id = v_item.id;
        v_restored := v_restored + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'job_id', v_rec.job_id, 'kind', v_rec.kind, 'papers_restored', v_restored, 'papers_unset_aside', v_unset);
END;
$$;

REVOKE ALL ON FUNCTION public.unvoid_test_lien_filing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unvoid_test_lien_filing(uuid) TO authenticated;

COMMENT ON FUNCTION public.unvoid_test_lien_filing(uuid) IS
  'Punch list #443, row 2: a developer puts one voided lien record back, on a job whose name or customer starts with ZZ. It clears voided_at and undoes what the void did to each desk paper that remembers it (void_of_filing_ids): a set aside paper stands again, and a paper put back on the desk goes to sent again, tied to the record, with its old sent day. Refuses everything else in words: a live record, a record that applied a paper already on record, a real job, a paper written since the void or touched by a later void, and a record voided before lien_void_memory_since() on a job that held a desk paper of its kind by then. Answers { ok, job_id, kind, papers_restored, papers_unset_aside }.';
