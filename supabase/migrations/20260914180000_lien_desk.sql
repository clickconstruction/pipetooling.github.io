SET lock_timeout = '3s';

-- The Lien desk (v2.3405): the queue of § 53.056 notices the law says are
-- due per unpaid work month on sub jobs, drafted by the office, approved by
-- the leader (or sent on his spoken word with a note, or by a standing rule
-- per GC), then sent as a run and recorded in job_lien_filings.
--
-- "Due" items are never stored — they are derived from approved clock
-- sessions × open money × no live notice for the month. A row exists from
-- `drafted` on. One live row per (job, kind).

-- ---------- 1 · the desk items ----------

CREATE TABLE IF NOT EXISTS public.job_lien_desk_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'notice_53_056'
    CONSTRAINT job_lien_desk_items_kind_check CHECK (kind IN ('notice_53_056', 'affidavit')),
  -- 'YYYY-MM' work months this notice names; the earliest sets the deadline.
  months text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'drafted'
    CONSTRAINT job_lien_desk_items_status_check
    CHECK (status IN ('drafted', 'awaiting_approval', 'approved', 'held', 'sent', 'missed')),
  -- The draft of the notice form (LienNoticeFields) + the send plan.
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_note boolean NOT NULL DEFAULT true,
  drafted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  drafted_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  -- leader = the master clicked; word = the office recorded his spoken word; rule = the GC's standing rule.
  approval_mode text
    CONSTRAINT job_lien_desk_items_approval_mode_check CHECK (approval_mode IS NULL OR approval_mode IN ('leader', 'word', 'rule')),
  word_note text NOT NULL DEFAULT '',
  word_channel text NOT NULL DEFAULT ''
    CONSTRAINT job_lien_desk_items_word_channel_check CHECK (word_channel IN ('', 'phone', 'in_person', 'text')),
  held_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  held_at timestamptz,
  hold_reason text NOT NULL DEFAULT ''
    CONSTRAINT job_lien_desk_items_hold_reason_check CHECK (hold_reason IN ('', 'promised', 'call_first', 'rule')),
  hold_until date,
  sent_filing_id uuid REFERENCES public.job_lien_filings(id) ON DELETE SET NULL,
  sent_at timestamptz,
  pulled_back_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  pulled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz
);

COMMENT ON TABLE public.job_lien_desk_items IS
  'Lien desk (v2.3405): one row per (job, kind) from drafted on — the office''s draft of a § 53.056 notice (months it names, the form fields), the leader''s approval (mode leader | word | rule, with the spoken-word note), holds with a re-ask date, and the filing it became. Due items are derived, never stored.';

CREATE INDEX IF NOT EXISTS job_lien_desk_items_job_id_idx ON public.job_lien_desk_items (job_id);
CREATE UNIQUE INDEX IF NOT EXISTS job_lien_desk_items_live_uniq
  ON public.job_lien_desk_items (job_id, kind)
  WHERE voided_at IS NULL AND status NOT IN ('sent', 'missed');

ALTER TABLE public.job_lien_desk_items ENABLE ROW LEVEL SECURITY;

-- The office set (dev, assistant-like, the job's master) — same as job_lien_filings.
DROP POLICY IF EXISTS job_lien_desk_items_select_office ON public.job_lien_desk_items;
CREATE POLICY job_lien_desk_items_select_office
  ON public.job_lien_desk_items FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_lien_desk_items_insert_office ON public.job_lien_desk_items;
CREATE POLICY job_lien_desk_items_insert_office
  ON public.job_lien_desk_items FOR INSERT TO authenticated
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_lien_desk_items_update_office ON public.job_lien_desk_items;
CREATE POLICY job_lien_desk_items_update_office
  ON public.job_lien_desk_items FOR UPDATE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_lien_desk_items_delete_dev ON public.job_lien_desk_items;
CREATE POLICY job_lien_desk_items_delete_dev
  ON public.job_lien_desk_items FOR DELETE TO authenticated
  USING (public.is_dev());

-- The approval guard: a leader's click needs a leader; the spoken word needs
-- its note and channel; a standing rule is the office's to apply.
CREATE OR REPLACE FUNCTION public.job_lien_desk_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_newly_approved boolean;
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

DROP TRIGGER IF EXISTS job_lien_desk_items_guard ON public.job_lien_desk_items;
CREATE TRIGGER job_lien_desk_items_guard
  BEFORE INSERT OR UPDATE ON public.job_lien_desk_items
  FOR EACH ROW EXECUTE FUNCTION public.job_lien_desk_items_guard();

-- ---------- 2 · the standing rule per GC ----------

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS lien_notice_policy text NOT NULL DEFAULT 'ask',
  ADD COLUMN IF NOT EXISTS lien_notice_policy_note text,
  ADD COLUMN IF NOT EXISTS lien_notice_policy_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lien_notice_policy_set_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_lien_notice_policy_check') THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_lien_notice_policy_check
      CHECK (lien_notice_policy IN ('ask', 'send', 'hold'));
  END IF;
END $$;

COMMENT ON COLUMN public.customers.lien_notice_policy IS
  'Lien desk (v2.3405): the leader''s standing rule for § 53.056 notices on this GC''s jobs — ask (each notice comes to him) | send (the office sends without asking; he sees an FYI) | hold (every month parks until he calls; re-asked before each deadline).';

-- Only a leader sets the rule.
CREATE OR REPLACE FUNCTION public.set_customer_lien_notice_policy(p_customer_id uuid, p_policy text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
  IF v_role IS DISTINCT FROM 'dev' AND v_role IS DISTINCT FROM 'master_technician' THEN
    RAISE EXCEPTION 'only a master or dev sets a lien notice rule' USING ERRCODE = '42501';
  END IF;
  IF p_policy NOT IN ('ask', 'send', 'hold') THEN
    RAISE EXCEPTION 'policy must be ask, send or hold' USING ERRCODE = '23514';
  END IF;
  UPDATE public.customers
     SET lien_notice_policy = p_policy,
         lien_notice_policy_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
         lien_notice_policy_set_by = auth.uid(),
         lien_notice_policy_set_at = now()
   WHERE id = p_customer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_customer_lien_notice_policy(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_customer_lien_notice_policy(uuid, text, text) TO authenticated;

-- ---------- 3 · the statutory date, in SQL ----------

-- 15th of the Nth month after the work month, weekend-rolled (§ 53.056(a-1), § 53.003) —
-- the same rule as src/lib/jobs/lienDeadlines.ts noticeDeadlineForMonth.
CREATE OR REPLACE FUNCTION public.lien_notice_deadline(p_month text, p_property_kind text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d date;
BEGIN
  IF p_month !~ '^\d{4}-\d{2}$' THEN RETURN NULL; END IF;
  d := (to_date(p_month || '-15', 'YYYY-MM-DD')
        + make_interval(months => CASE WHEN p_property_kind = 'residential' THEN 2 ELSE 3 END))::date;
  IF extract(dow FROM d) = 6 THEN d := d + 2;
  ELSIF extract(dow FROM d) = 0 THEN d := d + 1;
  END IF;
  RETURN d;
END;
$$;

-- ---------- 4 · the count the Dashboard runs on ----------

-- Every (sub job, work month) with approved hours, money open, and its notice
-- deadline inside the window (default 30 days ahead; a week behind so a
-- missed month is seen). Office-gated; empty otherwise.
CREATE OR REPLACE FUNCTION public.list_lien_notice_months(p_within_days integer DEFAULT 30)
RETURNS TABLE (
  job_id uuid,
  work_month text,
  approved_hours numeric,
  deadline date,
  noticed boolean,
  open_balance numeric,
  customer_id uuid,
  gc_customer_id uuid,
  property_kind text,
  has_owner boolean,
  desk_item_id uuid,
  desk_status text,
  desk_months text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT public.is_dev()
        OR public.is_assistant()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician') AS ok
  ),
  jobs AS (
    SELECT j.id,
           j.customer_id,
           j.gc_customer_id,
           GREATEST(0, COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0))::numeric AS open_balance,
           COALESCE(ca.property_kind, '') AS property_kind,
           (
             COALESCE(btrim(jpo.mailing_address), '') <> ''
             OR (
               COALESCE(btrim(ca.owner_mailing_address), '') <> ''
               AND (COALESCE(btrim(ca.owner_name), '') <> '' OR COALESCE(btrim(ca.owner_company), '') <> '')
             )
           ) AS has_owner
    FROM public.jobs_ledger j
    LEFT JOIN public.customer_addresses ca ON ca.id = j.customer_address_id
    LEFT JOIN public.job_property_owners jpo ON jpo.job_id = j.id
    WHERE (SELECT ok FROM me)
      AND j.status = 'billed'
      AND j.gc_customer_id IS NOT NULL
      AND COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0) > 0
  ),
  months AS (
    SELECT cs.job_ledger_id AS job_id,
           to_char(cs.work_date::date, 'YYYY-MM') AS work_month,
           SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS approved_hours
    FROM public.clock_sessions cs
    JOIN jobs ON jobs.id = cs.job_ledger_id
    WHERE cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.clocked_out_at IS NOT NULL
      AND cs.clocked_out_at > cs.clocked_in_at
    GROUP BY 1, 2
  ),
  dated AS (
    SELECT m.job_id, m.work_month, m.approved_hours,
           public.lien_notice_deadline(m.work_month, jobs.property_kind) AS deadline,
           jobs.open_balance, jobs.customer_id, jobs.gc_customer_id, jobs.property_kind, jobs.has_owner
    FROM months m
    JOIN jobs ON jobs.id = m.job_id
  )
  SELECT d.job_id,
         d.work_month,
         round(d.approved_hours, 1) AS approved_hours,
         d.deadline,
         EXISTS (
           SELECT 1 FROM public.job_lien_filings f
           WHERE f.job_id = d.job_id AND f.kind = 'notice_53_056' AND f.voided_at IS NULL
             AND d.work_month = ANY (f.months_covered)
         ) AS noticed,
         d.open_balance,
         d.customer_id,
         d.gc_customer_id,
         d.property_kind,
         d.has_owner,
         i.id AS desk_item_id,
         i.status AS desk_status,
         i.months AS desk_months
  FROM dated d
  LEFT JOIN LATERAL (
    SELECT x.id, x.status, x.months
    FROM public.job_lien_desk_items x
    WHERE x.job_id = d.job_id AND x.kind = 'notice_53_056' AND x.voided_at IS NULL
      AND x.status NOT IN ('sent', 'missed')
    ORDER BY x.created_at DESC
    LIMIT 1
  ) i ON true
  WHERE d.deadline IS NOT NULL
    AND d.deadline <= CURRENT_DATE + GREATEST(0, p_within_days)
    AND d.deadline >= CURRENT_DATE - 7
  ORDER BY d.deadline, d.job_id, d.work_month;
$$;

COMMENT ON FUNCTION public.list_lien_notice_months(integer) IS
  'Lien desk (v2.3405): every (sub job, approved work month) with money open whose § 53.056 notice deadline is within p_within_days ahead (or a week behind), with whether a live notice names the month, whether an owner of record with a mailing address is on file, and the live desk item. Office roles only; empty otherwise.';

REVOKE EXECUTE ON FUNCTION public.list_lien_notice_months(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_lien_notice_months(integer) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
