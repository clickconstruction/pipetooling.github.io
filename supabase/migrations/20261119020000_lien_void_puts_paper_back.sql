SET lock_timeout = '3s';

-- Voiding a filed lien affidavit puts its paper back (v2.7892, the owner's pick of 2026-11-18).
--
-- Recording a filed affidavit marks the job's affidavit paper on the Lien desk as sent and ties it to the filing
-- (job_lien_desk_items.status = 'sent', sent_filing_id, sent_at). Void on that filing only set its voided_at. The
-- paper stayed sent and tied to a voided filing, so the Board read the lien as Served with no lien on file, and a
-- second record on the job never reached the paper. Taking it back by hand was refused for the office whenever the
-- leader had approved the paper with his own press: the guard read any move to approved as a new approval.
--
-- Two functions and one trigger, no table changes:
--
-- 1 · job_lien_desk_items_guard(): as 20261023150000_lien_sign_code.sql left it, with one block after its first
--     test. For an affidavit paper, a move from sent back to approved is not a new approval while the filing it was
--     tied to is voided and the approval on the row is untouched. Nothing else in the guard changes: a sent paper
--     whose filing is live, or a move that changes who approved, when or how, is a new approval as before.
-- 2 · job_lien_filing_void_restores_paper(): when an affidavit filing goes from live to voided, every live affidavit
--     paper that is sent and tied to it goes back, in the same transaction as the void. A paper that carries an
--     approval (approved_at) goes back to approved, with who approved it, when and how left as they were. A paper
--     recorded as filed before anyone approved it goes back to the office's draft. The tie and the sent day are
--     cleared. When the job already has a newer live affidavit paper (job_lien_desk_items_live_uniq allows one), the
--     old paper is set aside (voided_at) instead, and the newer one stands.
-- 3 · the trigger on job_lien_filings, AFTER UPDATE OF voided_at, for an affidavit going from live to voided only.
--
-- Every door that voids gets it: the Lien window, Back from the clerk, a client loaded before this shipped.
-- A § 53.056 notice's filing is not touched: the trigger is for kind 'affidavit'.
-- Nothing old moves: on 2026-11-18 no live paper was sent and tied to a voided filing, and (2) acts on a void, not
-- on rows as they stand.
--
-- Idempotent: CREATE OR REPLACE twice, DROP TRIGGER IF EXISTS then CREATE. No CREATE TABLE, so no fence calls.

-- ---------- 1 · the guard: the move back is not a new approval ----------

CREATE OR REPLACE FUNCTION public.job_lien_desk_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_signer_role text;
  v_newly_approved boolean;
  v_newly_signed boolean;
  v_newly_confirmed boolean;
  v_gc uuid;
  v_prior boolean;
  v_offer_changed boolean;
  v_code_signer uuid;
BEGIN
  NEW.updated_at := now();
  -- v2.5788: the leader's signing code. sign_lien_desk_item_with_code verified it in this transaction and
  -- named him here; a direct write never carries the setting, so mode 'code' is refused outside that function.
  v_code_signer := NULLIF(current_setting('lien.code_verified_for', true), '')::uuid;
  v_newly_approved := NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved');
  -- v2.7892: a filed affidavit that is voided puts its paper back (job_lien_filing_void_restores_paper). The approval
  -- already on the row stands, so the move from sent back to approved is no new approval and asks nobody again. It
  -- is that move only while the filing the paper was tied to is voided and the approval is left exactly as it was.
  IF v_newly_approved AND TG_OP = 'UPDATE' AND NEW.kind = 'affidavit' AND OLD.status = 'sent'
     AND OLD.approved_at IS NOT NULL
     AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at
     AND NEW.approved_by IS NOT DISTINCT FROM OLD.approved_by
     AND NEW.approval_mode IS NOT DISTINCT FROM OLD.approval_mode
     AND EXISTS (SELECT 1 FROM public.job_lien_filings f WHERE f.id = OLD.sent_filing_id AND f.voided_at IS NOT NULL) THEN
    v_newly_approved := false;
  END IF;
  IF v_newly_approved THEN
    IF NEW.approval_mode IS NULL THEN
      RAISE EXCEPTION 'approval_mode is required when approving' USING ERRCODE = '23514';
    END IF;
    IF NEW.approval_mode = 'leader' THEN
      -- v2.5788: with his code verified, the approval is the signer's act on whoever's screen; else the caller's own.
      SELECT u.role INTO v_role FROM public.users u WHERE u.id = COALESCE(v_code_signer, auth.uid());
      IF v_role IS DISTINCT FROM 'dev' AND v_role IS DISTINCT FROM 'master_technician' THEN
        RAISE EXCEPTION 'only a master or dev approves a lien notice; record the spoken word instead' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.approval_mode = 'word' THEN
      IF btrim(NEW.word_note) = '' OR NEW.word_channel = '' THEN
        RAISE EXCEPTION 'a notice sent on the leader''s word needs who said it, when, and how' USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.approval_mode = 'rule' AND NEW.kind = 'notice_53_056' THEN
      -- v2.3469: the rule only takes effect after a first notice to this GC was recorded.
      SELECT j.gc_customer_id INTO v_gc FROM public.jobs_ledger j WHERE j.id = NEW.job_id;
      SELECT EXISTS (
        SELECT 1
        FROM public.job_lien_filings f
        JOIN public.jobs_ledger j2 ON j2.id = f.job_id
        WHERE f.kind = 'notice_53_056'
          AND f.voided_at IS NULL
          AND v_gc IS NOT NULL
          AND j2.gc_customer_id = v_gc
      ) INTO v_prior;
      IF NOT v_prior THEN
        RAISE EXCEPTION 'the first notice to a GC comes to the leader; a standing rule starts with the second' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW.approved_at IS NULL THEN NEW.approved_at := now(); END IF;
    IF NEW.approved_by IS NULL THEN NEW.approved_by := COALESCE(v_code_signer, auth.uid()); END IF;
  END IF;
  -- v2.5077: a signature is the leader's own act. It is his when the row's signer is a master or dev
  -- and either the write is under his own sign-in (one press, or his own drawing) or he drew it on
  -- the signed-in user's screen (Leader here), which the row says. The office can never place his name.
  -- The pen train: or he signed the paper as printed with a pen, and the signed-in office user wrote
  -- it down — the row names who wrote it (signed_recorded_by) and how they know (signed_witness_how).
  v_newly_signed := NEW.signed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.signed_at IS DISTINCT FROM NEW.signed_at);
  IF v_newly_signed THEN
    IF NEW.signed_by IS NULL OR NEW.signer_signature_mode IS NULL OR NEW.signer_printed_name IS NULL OR btrim(NEW.signer_printed_name) = '' THEN
      RAISE EXCEPTION 'a signed lien notice names who signed, how, and the name the mark prints' USING ERRCODE = '23514';
    END IF;
    SELECT u.role INTO v_signer_role FROM public.users u WHERE u.id = NEW.signed_by;
    IF v_signer_role IS DISTINCT FROM 'dev' AND v_signer_role IS DISTINCT FROM 'master_technician' THEN
      RAISE EXCEPTION 'only a master or dev signs a lien notice' USING ERRCODE = '42501';
    END IF;
    IF NEW.signer_signature_mode = 'pen' THEN
      IF NEW.signed_witness_how IS NULL THEN
        RAISE EXCEPTION 'a pen signature says how the office knows: they watched him sign, he told them, or the signed page is in hand' USING ERRCODE = '23514';
      END IF;
      IF NEW.signed_recorded_by IS NULL THEN NEW.signed_recorded_by := auth.uid(); END IF;
      IF auth.uid() IS NOT NULL AND NEW.signed_recorded_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'a pen signature is written down by the signed-in user' USING ERRCODE = '42501';
      END IF;
      NEW.signed_on_device_of := NULL;
    ELSIF NEW.signer_signature_mode = 'code' THEN
      IF v_code_signer IS NULL OR v_code_signer IS DISTINCT FROM NEW.signed_by THEN
        RAISE EXCEPTION 'a signature by code is placed through sign_lien_desk_item_with_code, with the leader''s own code' USING ERRCODE = '42501';
      END IF;
    ELSIF auth.uid() IS NOT NULL AND NEW.signed_by IS DISTINCT FROM auth.uid() THEN
      IF NEW.signed_on_device_of IS DISTINCT FROM auth.uid() OR NEW.signer_signature_mode IS DISTINCT FROM 'draw' THEN
        RAISE EXCEPTION 'a lien notice is signed by the leader under his own sign-in, or drawn by him on this screen' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  -- The pen train: only the leader who signed confirms a pen signature, from his own sign-in. v2.5788: a code
  -- signature too — it was placed on someone else's screen, and his own sign-in may stand behind it or disown it.
  v_newly_confirmed := NEW.signed_leader_confirmed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.signed_leader_confirmed_at IS DISTINCT FROM NEW.signed_leader_confirmed_at);
  IF v_newly_confirmed THEN
    IF NEW.signer_signature_mode IS DISTINCT FROM 'pen' AND NEW.signer_signature_mode IS DISTINCT FROM 'code' THEN
      RAISE EXCEPTION 'only a pen or code signature is confirmed; a press or a drawing under his own sign-in is his own act already' USING ERRCODE = '23514';
    END IF;
    IF auth.uid() IS NOT NULL AND NEW.signed_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'only the leader who signed the paper confirms it, from his own sign-in' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- v2.4713: the pay offer is the leader's to give.
  v_offer_changed := (TG_OP = 'INSERT' AND NEW.offer_pct <> 0)
    OR (TG_OP = 'UPDATE' AND (OLD.offer_pct IS DISTINCT FROM NEW.offer_pct OR OLD.offer_by IS DISTINCT FROM NEW.offer_by));
  IF v_offer_changed THEN
    IF auth.uid() IS NOT NULL THEN
      SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
      IF v_role IS DISTINCT FROM 'dev' AND v_role IS DISTINCT FROM 'master_technician' THEN
        RAISE EXCEPTION 'only a master or dev offers a discount on a lien notice' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NEW.offer_pct = 0 THEN
      NEW.offer_by := NULL;
      NEW.offer_set_by := NULL;
      NEW.offer_set_at := NULL;
    ELSE
      NEW.offer_set_by := COALESCE(auth.uid(), NEW.offer_set_by);
      NEW.offer_set_at := now();
    END IF;
  END IF;
  IF NEW.status = 'held' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'held') THEN
    IF NEW.held_at IS NULL THEN NEW.held_at := now(); END IF;
    IF NEW.held_by IS NULL THEN NEW.held_by := auth.uid(); END IF;
  END IF;
  IF NEW.status = 'sent' AND NEW.sent_at IS NULL THEN NEW.sent_at := now(); END IF;
  RETURN NEW;
END;
$$;

-- ---------- 2 · a voided filing puts its paper back ----------

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
    SELECT i.id, i.job_id, i.approved_at
    FROM public.job_lien_desk_items i
    WHERE i.sent_filing_id = NEW.id
      AND i.kind = 'affidavit'
      AND i.status = 'sent'
      AND i.voided_at IS NULL
    ORDER BY i.created_at DESC, i.id
    FOR UPDATE
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.job_lien_desk_items x
      WHERE x.job_id = v_item.job_id
        AND x.kind = 'affidavit'
        AND x.id <> v_item.id
        AND x.voided_at IS NULL
        AND x.status NOT IN ('sent', 'missed')
    ) THEN
      -- One live paper per job and kind: a newer one is already on the desk, so this one is set aside.
      UPDATE public.job_lien_desk_items SET voided_at = now() WHERE id = v_item.id;
    ELSE
      UPDATE public.job_lien_desk_items
      SET status = CASE WHEN v_item.approved_at IS NOT NULL THEN 'approved' ELSE 'drafted' END,
          sent_filing_id = NULL,
          sent_at = NULL
      WHERE id = v_item.id;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.job_lien_filing_void_restores_paper() IS
  'Lien desk (v2.7892): when a filed affidavit is voided, the paper it sent goes back in the same transaction: approved when it carries an approval, else drafted, its tie and sent day cleared; set aside when a newer live paper is on the job. Fired by the trigger of the same name on job_lien_filings.';

REVOKE EXECUTE ON FUNCTION public.job_lien_filing_void_restores_paper() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_lien_filing_void_restores_paper() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_lien_filing_void_restores_paper() FROM authenticated;

-- ---------- 3 · the trigger ----------

DROP TRIGGER IF EXISTS job_lien_filing_void_restores_paper ON public.job_lien_filings;
CREATE TRIGGER job_lien_filing_void_restores_paper
  AFTER UPDATE OF voided_at ON public.job_lien_filings
  FOR EACH ROW
  WHEN (NEW.kind = 'affidavit' AND OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL)
  EXECUTE FUNCTION public.job_lien_filing_void_restores_paper();
