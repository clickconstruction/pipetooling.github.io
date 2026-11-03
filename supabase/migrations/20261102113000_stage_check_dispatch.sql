SET lock_timeout = '3s';

-- Send a stage check to Dispatch (punch list #245 PR 1, v2.6360). A crew member on a stage checklist row hits a check
-- they cannot answer: the part is missing, the check is wrong for this job, the office has to decide. The press on the
-- row sends it to Dispatch as one more structured flavour of a dispatch request, pending_action 'stage_check', with the
-- job in job_ledger_id and, new here, the stage and the check in two columns, so the inbox opens the sheet with that row
-- open (PR 1), the context window and the self-close trigger know which row settled it (PR 2), and the Pipeline's mark
-- can say a stage is with Dispatch (PR 3). The reason and the crew's words ride in the title and as the first thread note,
-- as every request's do.
--
--   1. fixture_id and checklist_question_id on dispatch_requests, each ON DELETE SET NULL: a stage or a check deleted
--      leaves the request standing as a plain note with the job on it.
--   2. One open request per check per stage: a partial unique index over the two columns where the flavour is
--      stage_check and the row is open. A second send on the same check while one is open reads *Already with Dispatch*
--      on the phone, and the index holds the line when two phones send at once (the client reads 23505 as the same).
--
-- No policy changes: the crew inserts in their own name (dispatch_requests_insert), reads their own rows, and the
-- dispatch group and a dev read and close, as every request. pending_action has no CHECK (baseline), so the new value
-- needs no widening. The guard trigger keeps the two columns out of its list on purpose: Dispatch may re-point a request
-- at another check from the context window (PR 2), as it may close one.
--
-- Additive and idempotent. No table is created, so no fence call. The two foreign keys take a short SHARE ROW EXCLUSIVE on
-- jobs_ledger_fixtures and stage_checklist_templates; the index builds over a table of a few thousand rows. The client
-- writes and reads the two columns by name, which check:calls-ahead cannot see, so the push goes right after the merge.

ALTER TABLE public.dispatch_requests
  ADD COLUMN IF NOT EXISTS fixture_id uuid REFERENCES public.jobs_ledger_fixtures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checklist_question_id uuid REFERENCES public.stage_checklist_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.dispatch_requests.fixture_id IS 'The job stage a stage_check request is about (punch list #245): the inbox opens that stage''s checklist sheet. NULL on every other request.';
COMMENT ON COLUMN public.dispatch_requests.checklist_question_id IS 'The check a stage_check request is about (punch list #245): the sheet opens with that row open, and the request closes itself when the row is settled (PR 2). NULL on every other request.';
COMMENT ON COLUMN public.dispatch_requests.pending_action IS 'Stable token for in-app action affordances on the dispatch inbox row (NULL for plain text tasks). Known values: ''link_job_pictures'' (open Edit Job and focus the Customer Pictures input); ''find_property_owner''; ''open_job_account''; ''trip_charge_turnaway''; ''review_field_estimate''; ''running_late''; ''open_job_from_bid''; ''stage_check'' (punch list #245: a check the crew could not answer, with the stage in fixture_id and the check in checklist_question_id; the inbox row carries Open the job and Open the check).';

-- 2. One open request per check per stage.
CREATE UNIQUE INDEX IF NOT EXISTS dispatch_requests_one_open_stage_check_idx
  ON public.dispatch_requests (fixture_id, checklist_question_id)
  WHERE pending_action = 'stage_check' AND status = 'open';

COMMENT ON INDEX public.dispatch_requests_one_open_stage_check_idx IS 'One open stage_check request per stage and check (punch list #245): a second send while one is open reads Already with Dispatch.';
