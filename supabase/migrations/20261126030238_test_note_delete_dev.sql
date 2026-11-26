SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 13): a developer deletes a note on a test job, and a comment on a
-- test task's day.
--
-- Post note on a job's Activity writes one jobs_ledger_thread_notes row, and Post under a note a person was tagged in
-- on a task writes one checklist_instance_events row of kind comment. Neither table had a delete policy, so a note a
-- walk posted on a ZZ Test job stood on its Activity for good: four stood on one ZZ Test job on 2026-11-25. The
-- owner's answer of that day put row 13 among the eight take-backs that need a migration, each push on its own yes.
--
-- The least that opens the door, as bill_hand_ways_delete_dev and sent_documents_delete_dev open theirs: a delete
-- policy for a developer on each table and the grant, with the rule in the policy, so a direct DELETE past the screen
-- reaches no other row.
--
--   jobs_ledger_thread_notes_delete_dev   a dev; a note of a job whose own name or stored customer name starts with
--                                         ZZ (the ZZ convention, job_is_zz_test's test, written out since that
--                                         function is internal); and no tag names the note as its answer
--                                         (jobs_ledger_note_tags.answer_note_id is ON DELETE SET NULL, which would
--                                         forget the answer without a word). The note's own tags cascade.
--   checklist_instance_events_delete_dev  a dev; a comment (event_type 'comment', the one kind a person writes);
--                                         on an instance of a task whose title starts with ZZ; and no tag names the
--                                         comment as its answer (task_note_tags.answer_event_id, the same). The
--                                         comment's own tags cascade.
--
-- A job's note already lands in Deleted records when it goes: the archive trigger of 20260716120000 is on the notes
-- table itself, so a dev's delete is kept there too, with no second path. A comment has no such trigger and is not
-- kept; the screen's confirm says so. The four fences, laid when each table was made or fenced, are restrictive
-- policies and hold a read-only account, a twin and an archived caller back from these deletes too. No table is
-- created, so no fence is owed. Idempotent.

DROP POLICY IF EXISTS jobs_ledger_thread_notes_delete_dev ON public.jobs_ledger_thread_notes;
CREATE POLICY jobs_ledger_thread_notes_delete_dev ON public.jobs_ledger_thread_notes
  FOR DELETE TO authenticated
  USING (
    public.is_dev()
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.id = jobs_ledger_thread_notes.job_id
        AND (btrim(coalesce(j.job_name, ''), E' \t\n\r') ~* '^zz' OR btrim(coalesce(j.customer_name, ''), E' \t\n\r') ~* '^zz')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.jobs_ledger_note_tags t WHERE t.answer_note_id = jobs_ledger_thread_notes.id
    )
  );
GRANT DELETE ON TABLE public.jobs_ledger_thread_notes TO authenticated;
COMMENT ON POLICY jobs_ledger_thread_notes_delete_dev ON public.jobs_ledger_thread_notes IS
  'Punch list #443, row 13: a developer deletes a note on a ZZ test job when no tag names it as its answer. The note''s own tags cascade; Deleted records keeps the note. Nobody else deletes one.';

DROP POLICY IF EXISTS checklist_instance_events_delete_dev ON public.checklist_instance_events;
CREATE POLICY checklist_instance_events_delete_dev ON public.checklist_instance_events
  FOR DELETE TO authenticated
  USING (
    public.is_dev()
    AND checklist_instance_events.event_type = 'comment'
    AND EXISTS (
      SELECT 1
      FROM public.checklist_instances i
      JOIN public.checklist_items it ON it.id = i.checklist_item_id
      WHERE i.id = checklist_instance_events.instance_id
        AND btrim(coalesce(it.title, ''), E' \t\n\r') ~* '^zz'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.task_note_tags t WHERE t.answer_event_id = checklist_instance_events.id
    )
  );
GRANT DELETE ON TABLE public.checklist_instance_events TO authenticated;
COMMENT ON POLICY checklist_instance_events_delete_dev ON public.checklist_instance_events IS
  'Punch list #443, row 13: a developer deletes a comment on a day of a task whose title starts with ZZ, when no tag names it as its answer. The comment''s own tags cascade; nothing keeps the comment. Nobody else deletes one, and no other kind of event goes.';
