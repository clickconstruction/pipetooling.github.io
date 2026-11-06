SET lock_timeout = '3s';

-- Needs a signature (punch list #237, PR 2, v2.6563). The author of a checklist marks an item *needs a signature*, and
-- whoever answers it signs the way the app signs a lien notice (src/lib/jobs/lienNoticeSignature.ts, v2.5077): the
-- record is the signature, not the mark — a symbol adopted with intent by one press, the signer's own act under their
-- sign-in, bound to the answer as given by a hash so a later change voids it. A signature item is not answered until
-- it is signed; Not here signs too (the owner's default: it is the claim an inspector would test). A signed row locks.
-- Take it back voids the row with a reason and the next press writes a new row; the voided row and its mark stay.
--
--   1. needs_signature on stage_checklist_templates: the author's toggle beside asks_photo.
--   2. The signature on stage_checklist_answers: signed_at, signed_by, signer_printed_name, signer_signature_mode
--      (type · draw), signer_signature_storage_path (a drawn mark's PNG, in the stage-checklist-photos bucket under
--      <job_id>/sig/…, which the photo-save sweep never reads since it is not photo_storage_path) and
--      signed_answer_hash (the question's words, the pick and the note at signing).
--   3. The void: voided_at, voided_by, voided_by_name, void_why. UNIQUE (fixture_id, question_id) becomes a partial
--      unique index on the live rows, so a stage and question keep one live answer and any number of voided ones.
--   4. The lock, stage_checklist_answers_signed_row_locks: a signature is written once, by its signer under their own
--      sign-in, with a pick, a name and a mode (a drawn one with its PNG); once signed, the pick, the note and the
--      signature never change; a void is written once, in the voider's own name, and a voided row's pick, note, stamp,
--      signature and void never change after it; its photo columns stay the sweep's to file. SECURITY INVOKER: auth.uid() is
--      the signer's.
--   5. promote_stage_checklist_item re-created to copy needs_signature to the company's row.
--
-- Additive and idempotent. No table is created, so no fence call. The client names the new columns in every answer
-- read and in every question read, so this is a *push right after the merge* migration: the deploy holds for it.

-- 1. The author's toggle.
ALTER TABLE public.stage_checklist_templates
  ADD COLUMN IF NOT EXISTS needs_signature boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.stage_checklist_templates.needs_signature IS 'Needs a signature (#237 PR 2): whoever answers signs, Not here too, and the row locks after. The author sets it where a wrong answer costs a wall or an inspection.';

-- 2. The signature on the answer.
ALTER TABLE public.stage_checklist_answers
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signer_printed_name text CHECK (signer_printed_name IS NULL OR length(signer_printed_name) BETWEEN 1 AND 120),
  ADD COLUMN IF NOT EXISTS signer_signature_mode text CHECK (signer_signature_mode IS NULL OR signer_signature_mode IN ('type', 'draw')),
  ADD COLUMN IF NOT EXISTS signer_signature_storage_path text CHECK (signer_signature_storage_path IS NULL OR length(signer_signature_storage_path) <= 300),
  ADD COLUMN IF NOT EXISTS signed_answer_hash text CHECK (signed_answer_hash IS NULL OR length(signed_answer_hash) <= 64),
  -- 3. The void.
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_by_name text NOT NULL DEFAULT '' CHECK (length(voided_by_name) <= 120),
  ADD COLUMN IF NOT EXISTS void_why text CHECK (void_why IS NULL OR length(void_why) <= 200);

COMMENT ON COLUMN public.stage_checklist_answers.signed_at IS 'Needs a signature (#237 PR 2): when the answer was signed. NULL on an unsigned row; a signature item is not answered until it is.';
COMMENT ON COLUMN public.stage_checklist_answers.signed_by IS 'The signer''s own sign-in: the lock trigger holds it to auth.uid() at signing.';
COMMENT ON COLUMN public.stage_checklist_answers.signer_printed_name IS 'The name the mark prints: the cursive name for a typed signature, the name under the ink for a drawn one.';
COMMENT ON COLUMN public.stage_checklist_answers.signer_signature_mode IS 'type = one press placed the name in cursive; draw = the signer drew it.';
COMMENT ON COLUMN public.stage_checklist_answers.signer_signature_storage_path IS 'A drawn mark''s PNG in the stage-checklist-photos bucket, <job_id>/sig/<answer_id>-<ms>.png; NULL for a typed signature. Not photo_storage_path, so the photo-save sweep leaves it where it is.';
COMMENT ON COLUMN public.stage_checklist_answers.signed_answer_hash IS 'The hash of the answer as given at signing (the question''s words, the pick, the note), src/lib/jobs/stageChecklistSignature.ts. The client reads the signature only while the hash still matches.';
COMMENT ON COLUMN public.stage_checklist_answers.voided_at IS 'Take it back (#237 PR 2): when this answer was taken back. The row and its signature stay; the next press writes a new live row for the stage and question.';
COMMENT ON COLUMN public.stage_checklist_answers.voided_by IS 'Who took the answer back.';
COMMENT ON COLUMN public.stage_checklist_answers.voided_by_name IS 'The voider''s name as the row keeps it.';
COMMENT ON COLUMN public.stage_checklist_answers.void_why IS 'Why the answer was taken back, in the voider''s words.';

-- 3. One live answer per stage and question; the voided ones stay beside it.
ALTER TABLE public.stage_checklist_answers DROP CONSTRAINT IF EXISTS stage_checklist_answers_fixture_id_question_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS stage_checklist_answers_live_idx ON public.stage_checklist_answers (fixture_id, question_id) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS stage_checklist_answers_voided_idx ON public.stage_checklist_answers (fixture_id, question_id) WHERE voided_at IS NOT NULL;

-- 4. The lock.
CREATE OR REPLACE FUNCTION public.stage_checklist_answer_signed_row_locks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_was_signed boolean := TG_OP = 'UPDATE' AND OLD.signed_at IS NOT NULL;
  v_was_voided boolean := TG_OP = 'UPDATE' AND OLD.voided_at IS NOT NULL;
  v_signs boolean := NEW.signed_at IS NOT NULL AND NOT v_was_signed;
  v_voids boolean := NEW.voided_at IS NOT NULL AND NOT v_was_voided;
BEGIN
  -- A signature is whole, or it is not one.
  IF v_signs THEN
    IF NEW.pick IS NULL THEN
      RAISE EXCEPTION 'A signature needs the answer it signs: pick Yes, No or Not here.' USING ERRCODE = '23514';
    END IF;
    IF NEW.signed_by IS NULL OR NEW.signed_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'A checklist answer is signed by the person who answered it, under their own sign-in.' USING ERRCODE = '42501';
    END IF;
    IF btrim(COALESCE(NEW.signer_printed_name, '')) = '' THEN
      RAISE EXCEPTION 'A signature needs the signer''s printed name.' USING ERRCODE = '23514';
    END IF;
    IF NEW.signer_signature_mode IS NULL THEN
      RAISE EXCEPTION 'A signature is typed or drawn.' USING ERRCODE = '23514';
    END IF;
    IF NEW.signer_signature_mode = 'draw' AND NEW.signer_signature_storage_path IS NULL THEN
      RAISE EXCEPTION 'A drawn signature needs its mark.' USING ERRCODE = '23514';
    END IF;
    IF btrim(COALESCE(NEW.signed_answer_hash, '')) = '' THEN
      RAISE EXCEPTION 'A signature binds to the answer as given.' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.signed_at IS NULL AND (NEW.signed_by IS NOT NULL OR NEW.signer_printed_name IS NOT NULL OR NEW.signer_signature_mode IS NOT NULL OR NEW.signer_signature_storage_path IS NOT NULL OR NEW.signed_answer_hash IS NOT NULL) THEN
    RAISE EXCEPTION 'A signature carries its time.' USING ERRCODE = '23514';
  END IF;
  -- A void is the voider's own act, with a reason, once.
  IF v_voids THEN
    IF NEW.voided_by IS NULL OR NEW.voided_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'An answer is taken back by the person pressing Take it back, under their own sign-in.' USING ERRCODE = '42501';
    END IF;
    IF length(btrim(COALESCE(NEW.void_why, ''))) < 3 THEN
      RAISE EXCEPTION 'Say why the answer is taken back.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  -- Once signed, the answer as signed stands: the pick, the note and the signature never change.
  IF v_was_signed AND (
    NEW.pick IS DISTINCT FROM OLD.pick
    OR NEW.note IS DISTINCT FROM OLD.note
    OR NEW.answered_at IS DISTINCT FROM OLD.answered_at
    OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
    OR NEW.signed_by IS DISTINCT FROM OLD.signed_by
    OR NEW.signer_printed_name IS DISTINCT FROM OLD.signer_printed_name
    OR NEW.signer_signature_mode IS DISTINCT FROM OLD.signer_signature_mode
    OR NEW.signer_signature_storage_path IS DISTINCT FROM OLD.signer_signature_storage_path
    OR NEW.signed_answer_hash IS DISTINCT FROM OLD.signed_answer_hash
  ) THEN
    RAISE EXCEPTION 'That answer is signed and locked. Take it back writes a new answer with a reason; the signed one stays.' USING ERRCODE = '23514';
  END IF;
  -- Once voided, the row is the record: the answer, the stamp, the signature and the void stand; the photo columns stay the sweep's.
  IF v_was_voided AND (
    NEW.pick IS DISTINCT FROM OLD.pick
    OR NEW.note IS DISTINCT FROM OLD.note
    OR NEW.answered_at IS DISTINCT FROM OLD.answered_at
    OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
    OR NEW.signer_signature_storage_path IS DISTINCT FROM OLD.signer_signature_storage_path
    OR NEW.voided_at IS DISTINCT FROM OLD.voided_at
    OR NEW.voided_by IS DISTINCT FROM OLD.voided_by
    OR NEW.voided_by_name IS DISTINCT FROM OLD.voided_by_name
    OR NEW.void_why IS DISTINCT FROM OLD.void_why
  ) THEN
    RAISE EXCEPTION 'That answer was taken back. It stays as it was; answer the question again.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS stage_checklist_answers_signed_row_locks ON public.stage_checklist_answers;
CREATE TRIGGER stage_checklist_answers_signed_row_locks
  BEFORE INSERT OR UPDATE ON public.stage_checklist_answers
  FOR EACH ROW EXECUTE FUNCTION public.stage_checklist_answer_signed_row_locks();
COMMENT ON FUNCTION public.stage_checklist_answer_signed_row_locks() IS 'Needs a signature (#237 PR 2): a signature is whole and the signer''s own; a signed row''s pick, note and signature never change; a void is the voider''s own, with a reason, and a voided row stays as it was. SECURITY INVOKER, so auth.uid() is the person pressing.';

-- 5. The promote copies the signature ask with the photo ask. Everything else as 20261104170000 left it.
CREATE OR REPLACE FUNCTION public.promote_stage_checklist_item(p_item_id uuid)
RETURNS public.stage_checklist_templates
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item public.stage_checklist_templates;
  v_company public.stage_checklist_templates;
BEGIN
  IF public.is_digital_twin() OR NOT (public.is_master_or_dev() OR public.is_assistant()) THEN
    RAISE EXCEPTION 'Only the office adds a check to the company''s list.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('stage_check.settle_note', 'Added to the company''s list', true);
  UPDATE public.stage_checklist_templates
     SET retired_at = now(), retired_by = auth.uid(), updated_at = now()
   WHERE id = p_item_id AND job_id IS NOT NULL AND retired_at IS NULL
  RETURNING * INTO v_item;
  PERFORM set_config('stage_check.settle_note', '', true);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That check is no longer on the job.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.stage_checklist_templates t
    WHERE t.job_id IS NULL AND t.retired_at IS NULL AND t.stage_kind = v_item.stage_kind AND lower(btrim(t.words)) = lower(btrim(v_item.words))
  ) THEN
    RAISE EXCEPTION 'The company''s list already asks that.';
  END IF;
  INSERT INTO public.stage_checklist_templates (stage_kind, sort_order, words, asks_photo, needs_signature, created_by, promoted_from)
  VALUES (
    v_item.stage_kind,
    (SELECT COALESCE(MAX(t.sort_order), 0) + 1 FROM public.stage_checklist_templates t WHERE t.job_id IS NULL AND t.retired_at IS NULL AND t.stage_kind = v_item.stage_kind),
    v_item.words,
    v_item.asks_photo,
    v_item.needs_signature,
    auth.uid(),
    v_item.id
  )
  RETURNING * INTO v_company;
  UPDATE public.stage_checklist_answers SET question_id = v_company.id, updated_at = now() WHERE question_id = v_item.id;
  RETURN v_company;
END
$$;
REVOKE ALL ON FUNCTION public.promote_stage_checklist_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_stage_checklist_item(uuid) TO authenticated;
COMMENT ON FUNCTION public.promote_stage_checklist_item(uuid) IS 'Adds one job item to the company''s list (#237 PR 1b), the office alone: copies its words, its photo ask and its signature ask (PR 2) to a new company row, retires the job''s row and moves the job''s answers to the copy. Returns the company''s row. Since #245 PR 2a it says so to the retire trigger first, so a stage check open on the item closes as added to the company''s list, not taken off.';
