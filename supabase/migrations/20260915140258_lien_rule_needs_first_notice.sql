-- v2.3469 — a "send" standing rule waits on a first notice.
--
-- Owner, 2026-09-14: "For this rule to work, at least one notice would have had
-- to go out first so that the office knows that all the information is correct."
-- The client kernel (lienDesk.ts `ruleWaitsOnFirstNotice`) now routes a GC's first
-- notice to the leader even under "send". This guard is the server-side teeth: a
-- rule approval (approval_mode = 'rule') is refused while no § 53.056 notice has
-- been recorded to that GC on any of its jobs. Mirrors the client's prior-notice
-- read (job_lien_filings, kind notice_53_056, not voided, joined on gc_customer_id).
SET lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.job_lien_desk_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_newly_approved boolean;
  v_gc uuid;
  v_prior boolean;
BEGIN
  NEW.updated_at := now();
  v_newly_approved := NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved');
  IF v_newly_approved THEN
    IF NEW.approval_mode IS NULL THEN
      RAISE EXCEPTION 'approval_mode is required when approving' USING ERRCODE = '23514';
    END IF;
    IF NEW.approval_mode = 'leader' THEN
      SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
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
    IF NEW.approved_by IS NULL THEN NEW.approved_by := auth.uid(); END IF;
  END IF;
  IF NEW.status = 'held' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'held') THEN
    IF NEW.held_at IS NULL THEN NEW.held_at := now(); END IF;
    IF NEW.held_by IS NULL THEN NEW.held_by := auth.uid(); END IF;
  END IF;
  IF NEW.status = 'sent' AND NEW.sent_at IS NULL THEN NEW.sent_at := now(); END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.job_lien_desk_items_guard() IS
  'Lien desk approval guard (v2.3405): a leader approval needs a master or dev; the spoken word needs its note and channel; v2.3469: a rule approval needs a recorded § 53.056 notice to the GC first.';
