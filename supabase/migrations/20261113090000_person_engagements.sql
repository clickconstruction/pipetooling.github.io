SET lock_timeout = '3s';

-- Engagement history (punch list #315, upgrade 4a): what a person was to the company over time.
--
-- The roster row says what a person is today (people.kind, the start and end dates) and employment_stints says when
-- they worked. Neither says in what capacity: an employee for a year, then a subcontractor, has one roster row and
-- nothing that records the change, the day of it or the paper it rests on. On a large HR file that fact lived in the
-- narrative's prose, and every reader had to find it again.
--
-- person_engagements is that record, kept beside the roster and never on it:
--   * One row = one stretch in one capacity: the kind (employee or subcontractor), the first day, the last day (null
--     while it runs), where the fact comes from (source) with a reference to it (source_ref), and a note.
--   * No existing row or table changes. people.kind, employment_stints and charge_standings() stay as they are, and
--     nothing reads this table yet: the fact strip and the Timeline come in the next PR.
--   * A stretch is closed by its last day and never deleted. A row made by mistake is withdrawn with a reason
--     (withdrawn_at / withdrawn_by / withdrawn_why), the way a correction link is.
--   * Two live stretches of one person never share a day. The guard checks it under a lock a person, so two writers
--     at once cannot both pass.
--   * Devs read. Nobody writes the table directly: dev_engagement_write is the one door, a dry run by default, for
--     the dev seat's plan → apply and for the tab's Standing… window.
--
-- The list of kinds is the owner's call. This builds the two the card names and refuses any other; a third kind is
-- one line in a later migration.

CREATE TABLE IF NOT EXISTS public.person_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  kind text NOT NULL,
  started_on date NOT NULL,
  ended_on date,
  source text NOT NULL,
  source_ref text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  withdrawn_at timestamptz,
  withdrawn_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  withdrawn_why text,
  CONSTRAINT person_engagements_kind_check CHECK (kind IN ('employee', 'subcontractor')),
  CONSTRAINT person_engagements_source_check CHECK (source IN ('contract', 'payroll', 'owner', 'record', 'other')),
  CONSTRAINT person_engagements_days_in_order CHECK (ended_on IS NULL OR ended_on >= started_on),
  CONSTRAINT person_engagements_source_ref_length CHECK (length(source_ref) <= 300),
  CONSTRAINT person_engagements_note_length CHECK (length(note) <= 1000),
  CONSTRAINT person_engagements_withdrawn_with_why CHECK (
    (withdrawn_at IS NULL AND withdrawn_why IS NULL)
    OR (withdrawn_at IS NOT NULL AND withdrawn_why IS NOT NULL AND length(btrim(withdrawn_why)) BETWEEN 1 AND 200))
);

COMMENT ON TABLE public.person_engagements IS
  'HR files (punch list #315): one stretch of a person''s engagement in one capacity (employee or subcontractor): first day, last day (null while it runs), where the fact comes from and a note. Closed by its last day, withdrawn with a reason, never deleted; two live stretches of a person never share a day. Dev-only, written only by dev_engagement_write.';
COMMENT ON COLUMN public.person_engagements.source IS 'Where the fact comes from: contract (a signed paper), payroll (how they were paid), owner (the owner''s statement), record (another record on file), other. source_ref names it: a document, a paper, a date.';
COMMENT ON COLUMN public.person_engagements.ended_on IS 'The last day of the stretch, inclusive; null while it runs. Set once.';

CREATE INDEX IF NOT EXISTS person_engagements_person_idx ON public.person_engagements (person_id, started_on);

-- The guard. A stretch is what it was when made: after the insert only its last day (once), the note of who closed
-- it, and the withdrawal stamps may be set. Live stretches of one person may not share a day; the check runs under a
-- lock a person so two writers wait their turn.
CREATE OR REPLACE FUNCTION public.person_engagements_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_clash record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.person_id <> OLD.person_id OR NEW.kind <> OLD.kind OR NEW.started_on <> OLD.started_on
       OR NEW.source <> OLD.source OR NEW.source_ref <> OLD.source_ref OR NEW.note <> OLD.note
       OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.author_label IS DISTINCT FROM OLD.author_label
       OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'person_engagements: a stretch is what it was when made; withdraw it with a reason and record it again' USING ERRCODE = '23514';
    END IF;
    IF OLD.withdrawn_at IS NOT NULL THEN
      RAISE EXCEPTION 'person_engagements: a withdrawn stretch stays withdrawn' USING ERRCODE = '23514';
    END IF;
    IF OLD.ended_on IS NOT NULL AND NEW.ended_on IS DISTINCT FROM OLD.ended_on THEN
      RAISE EXCEPTION 'person_engagements: a closed stretch keeps its last day; withdraw it with a reason and record it again' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.withdrawn_at IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('person_engagements'), hashtext(NEW.person_id::text));
    SELECT e.kind, e.started_on, e.ended_on INTO v_clash
      FROM public.person_engagements e
     WHERE e.person_id = NEW.person_id AND e.withdrawn_at IS NULL AND e.id <> NEW.id
       AND e.started_on <= COALESCE(NEW.ended_on, 'infinity'::date)
       AND COALESCE(e.ended_on, 'infinity'::date) >= NEW.started_on
     ORDER BY e.started_on LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'person_engagements: these days overlap the % stretch from % to %; a person is in one capacity a day',
        v_clash.kind, v_clash.started_on, COALESCE(v_clash.ended_on::text, 'today') USING ERRCODE = '23P01';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS person_engagements_guard ON public.person_engagements;
CREATE TRIGGER person_engagements_guard BEFORE INSERT OR UPDATE ON public.person_engagements
  FOR EACH ROW EXECUTE FUNCTION public.person_engagements_guard();

ALTER TABLE public.person_engagements ENABLE ROW LEVEL SECURITY;

-- Devs read. No insert, update or delete policy exists and no such grant is made: the door below is the only writer.
DROP POLICY IF EXISTS person_engagements_dev_select ON public.person_engagements;
CREATE POLICY person_engagements_dev_select ON public.person_engagements FOR SELECT TO authenticated USING (public.is_dev());
REVOKE ALL ON public.person_engagements FROM anon, authenticated;
GRANT SELECT ON public.person_engagements TO authenticated;

-- ── the one door ─────────────────────────────────────────────────────────────────────────────────
-- p: { person_id, and exactly one of:
--      open:     { kind, started_on, ended_on?, source, source_ref?, note? }   a stretch that is not on file yet
--      change:   { kind, on, source, source_ref?, note? }                      the running stretch ends the day before
--                                                                              `on`, and a stretch of `kind` starts on it
--      close:    { ended_on }                                                  the running stretch ends that day
--      withdraw: { id, why } }                                                 a stretch made by mistake comes off
-- The reply names every stretch by its kind and days and carries no clock and no id the run made, so a plan and its
-- apply hash alike. `standing` is the person's live stretches after the write, oldest first.
CREATE OR REPLACE FUNCTION public.dev_engagement_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_dev_name text;
  v_dev_email text;
  v_label text;
  v_person uuid;
  v_person_name text;
  v_ops integer;
  op jsonb;
  v_kind text;
  v_source text;
  v_start date;
  v_end date;
  v_ref text;
  v_note text;
  v_why text;
  v_open public.person_engagements%ROWTYPE;
  v_row public.person_engagements%ROWTYPE;
  v_done jsonb := '[]'::jsonb;
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_engagement_write: devs only' USING ERRCODE = '42501';
  END IF;
  SELECT u.name, u.email INTO v_dev_name, v_dev_email FROM public.users u WHERE u.id = auth.uid();
  v_label := COALESCE(NULLIF(btrim(v_dev_name), ''), v_dev_email);
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'dev_engagement_write: no users row for the caller';
  END IF;
  IF COALESCE(p->>'person_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RAISE EXCEPTION 'dev_engagement_write: person_id is required';
  END IF;
  v_person := (p->>'person_id')::uuid;
  SELECT pe.name INTO v_person_name FROM public.people pe WHERE pe.id = v_person;
  IF v_person_name IS NULL THEN
    RAISE EXCEPTION 'dev_engagement_write: person % not found', v_person;
  END IF;
  v_ops := (p ? 'open')::int + (p ? 'change')::int + (p ? 'close')::int + (p ? 'withdraw')::int;
  IF v_ops <> 1 THEN
    RAISE EXCEPTION 'dev_engagement_write: name exactly one of open, change, close or withdraw';
  END IF;

  BEGIN
    -- One writer a person at a time, so the running stretch read here is the one the write acts on.
    PERFORM pg_advisory_xact_lock(hashtext('person_engagements'), hashtext(v_person::text));
    SELECT * INTO v_open FROM public.person_engagements e
     WHERE e.person_id = v_person AND e.withdrawn_at IS NULL AND e.ended_on IS NULL
     ORDER BY e.started_on DESC LIMIT 1;

    IF p ? 'open' OR p ? 'change' THEN
      op := COALESCE(p->'open', p->'change');
      IF jsonb_typeof(op) <> 'object' THEN
        RAISE EXCEPTION 'dev_engagement_write: open and change are objects';
      END IF;
      v_kind := COALESCE(op->>'kind', '');
      v_source := COALESCE(op->>'source', '');
      IF v_kind NOT IN ('employee', 'subcontractor') THEN
        RAISE EXCEPTION 'dev_engagement_write: kind is employee or subcontractor';
      END IF;
      IF v_source NOT IN ('contract', 'payroll', 'owner', 'record', 'other') THEN
        RAISE EXCEPTION 'dev_engagement_write: source is contract, payroll, owner, record or other: where the fact comes from';
      END IF;
      v_ref := btrim(COALESCE(op->>'source_ref', ''));
      v_note := btrim(COALESCE(op->>'note', ''));
      IF length(v_ref) > 300 OR length(v_note) > 1000 THEN
        RAISE EXCEPTION 'dev_engagement_write: source_ref is at most 300 characters and note at most 1,000';
      END IF;
      IF COALESCE(op->>(CASE WHEN p ? 'open' THEN 'started_on' ELSE 'on' END), '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'dev_engagement_write: % is a day, YYYY-MM-DD', CASE WHEN p ? 'open' THEN 'open.started_on' ELSE 'change.on' END;
      END IF;
      v_start := (op->>(CASE WHEN p ? 'open' THEN 'started_on' ELSE 'on' END))::date;
      v_end := NULL;
      IF p ? 'open' AND op ? 'ended_on' AND jsonb_typeof(op->'ended_on') <> 'null' THEN
        IF COALESCE(op->>'ended_on', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
          RAISE EXCEPTION 'dev_engagement_write: open.ended_on is a day, YYYY-MM-DD';
        END IF;
        v_end := (op->>'ended_on')::date;
      END IF;

      IF p ? 'change' THEN
        IF v_open.id IS NULL THEN
          RAISE EXCEPTION 'dev_engagement_write: no stretch is running to change; record one with open';
        END IF;
        IF v_open.kind = v_kind THEN
          RAISE EXCEPTION 'dev_engagement_write: the running stretch is already %', v_kind;
        END IF;
        IF v_start <= v_open.started_on THEN
          RAISE EXCEPTION 'dev_engagement_write: the change is on or before the running stretch''s first day (%)', v_open.started_on;
        END IF;
        UPDATE public.person_engagements e SET ended_on = v_start - 1, closed_by = auth.uid(), closed_at = now()
         WHERE e.id = v_open.id RETURNING * INTO v_row;
        v_done := v_done || jsonb_build_object('op', 'close', 'kind', v_row.kind, 'started_on', v_row.started_on, 'ended_on', v_row.ended_on);
      END IF;

      INSERT INTO public.person_engagements (person_id, kind, started_on, ended_on, source, source_ref, note, created_by, author_label)
      VALUES (v_person, v_kind, v_start, v_end, v_source, v_ref, v_note, auth.uid(), v_label)
      RETURNING * INTO v_row;
      v_done := v_done || jsonb_build_object('op', 'open', 'kind', v_row.kind, 'started_on', v_row.started_on, 'ended_on', v_row.ended_on,
        'source', v_row.source, 'source_ref', v_row.source_ref, 'note_chars', length(v_row.note));

    ELSIF p ? 'close' THEN
      op := p->'close';
      IF jsonb_typeof(op) <> 'object' OR COALESCE(op->>'ended_on', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'dev_engagement_write: close.ended_on is a day, YYYY-MM-DD';
      END IF;
      IF v_open.id IS NULL THEN
        RAISE EXCEPTION 'dev_engagement_write: no stretch is running to close';
      END IF;
      v_end := (op->>'ended_on')::date;
      IF v_end < v_open.started_on THEN
        RAISE EXCEPTION 'dev_engagement_write: the last day is before the stretch''s first day (%)', v_open.started_on;
      END IF;
      UPDATE public.person_engagements e SET ended_on = v_end, closed_by = auth.uid(), closed_at = now()
       WHERE e.id = v_open.id RETURNING * INTO v_row;
      v_done := v_done || jsonb_build_object('op', 'close', 'kind', v_row.kind, 'started_on', v_row.started_on, 'ended_on', v_row.ended_on);

    ELSE
      op := p->'withdraw';
      v_why := btrim(COALESCE(op->>'why', ''));
      IF jsonb_typeof(op) <> 'object' OR COALESCE(op->>'id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        RAISE EXCEPTION 'dev_engagement_write: withdraw names the stretch by id';
      END IF;
      IF length(v_why) NOT BETWEEN 1 AND 200 THEN
        RAISE EXCEPTION 'dev_engagement_write: withdraw needs why (1 to 200 characters)';
      END IF;
      SELECT * INTO v_row FROM public.person_engagements e WHERE e.id = (op->>'id')::uuid AND e.person_id = v_person FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'dev_engagement_write: no such stretch on this person''s file';
      END IF;
      IF v_row.withdrawn_at IS NOT NULL THEN
        RAISE EXCEPTION 'dev_engagement_write: that stretch was withdrawn already';
      END IF;
      UPDATE public.person_engagements e SET withdrawn_at = now(), withdrawn_by = auth.uid(), withdrawn_why = v_why
       WHERE e.id = v_row.id RETURNING * INTO v_row;
      v_done := v_done || jsonb_build_object('op', 'withdraw', 'kind', v_row.kind, 'started_on', v_row.started_on, 'ended_on', v_row.ended_on, 'why', v_row.withdrawn_why);
    END IF;

    v_out := jsonb_build_object(
      'dry_run', p_dry_run,
      'person', jsonb_build_object('id', v_person, 'name', v_person_name),
      'author_label', v_label,
      'changes', v_done,
      'standing', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', e.kind, 'started_on', e.started_on, 'ended_on', e.ended_on, 'source', e.source) ORDER BY e.started_on)
                              FROM public.person_engagements e WHERE e.person_id = v_person AND e.withdrawn_at IS NULL), '[]'::jsonb));
    IF p_dry_run THEN
      RAISE EXCEPTION USING ERRCODE = 'P0DRY', MESSAGE = 'dry run';
    END IF;
    RETURN v_out;
  EXCEPTION
    WHEN SQLSTATE 'P0DRY' THEN
      RETURN v_out;
  END;
END
$fn$;
COMMENT ON FUNCTION public.dev_engagement_write(jsonb, boolean) IS
  'HR files (punch list #315): record, change, close or withdraw a stretch of a person''s engagement, as the dev. change ends the running stretch the day before and starts the new kind on the day named. p_dry_run = true (default) performs and unwinds the write, returning what would be written. Devs only.';
REVOKE ALL ON FUNCTION public.dev_engagement_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_engagement_write(jsonb, boolean) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
