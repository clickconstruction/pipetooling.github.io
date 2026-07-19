-- Report email subscriptions: office staff configure standing recipients who get
-- reports emailed to them, either for ALL reports or only reports authored by a
-- selected set of people. Delivery is both automatic (fired when a report is
-- created, next to the existing web-push send-report-notification) and manual
-- ("Send now" from the Recent Reports card on the Dashboard). This mirrors the
-- recurring-job-report subsystem: a config table + a Resend edge function
-- (send-report-email) + a per-report idempotency ledger.
--
-- Who can manage: dev / master_technician / assistant / controller (matches the
-- clock-strip schedule-email gate; deliberately EXCLUDES primary).

-- Management gate (no combined helper existed; is_dev/is_assistant/is_controller
-- are separate). SECURITY DEFINER + wrapped auth.uid() per the hot-tables RLS
-- convention (migration 20260605210913).
CREATE OR REPLACE FUNCTION public.can_manage_report_email_subscriptions()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = (SELECT auth.uid())
      AND users.role = ANY (ARRAY[
        'dev'::public.user_role,
        'master_technician'::public.user_role,
        'assistant'::public.user_role,
        'controller'::public.user_role
      ])
  );
$$;

COMMENT ON FUNCTION public.can_manage_report_email_subscriptions() IS
  'True when the caller may configure report-email recipients (dev/master_technician/assistant/controller). Excludes primary by design.';

-- ---------------------------------------------------------------------------
-- Subscriptions: one recipient (internal user OR external email) + a scope.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_email_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_email text,
  label text,
  all_authors boolean NOT NULL DEFAULT false,
  auto_send boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Exactly one recipient channel.
  CONSTRAINT report_email_subscriptions_one_recipient CHECK (
    (recipient_user_id IS NOT NULL AND recipient_email IS NULL)
    OR (recipient_user_id IS NULL AND recipient_email IS NOT NULL)
  )
);

COMMENT ON TABLE public.report_email_subscriptions IS
  'Standing report-email recipients. all_authors=true emails every report; else only reports whose author is in report_email_subscription_authors. auto_send drives the on-create email.';

CREATE INDEX IF NOT EXISTS idx_report_email_subscriptions_enabled
  ON public.report_email_subscriptions (enabled) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_report_email_subscriptions_recipient_user_id
  ON public.report_email_subscriptions (recipient_user_id);

DROP TRIGGER IF EXISTS update_report_email_subscriptions_updated_at ON public.report_email_subscriptions;
CREATE TRIGGER update_report_email_subscriptions_updated_at BEFORE UPDATE ON public.report_email_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Author filter: which authors a subscription is scoped to (when all_authors=false).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_email_subscription_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.report_email_subscriptions(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT report_email_subscription_authors_unique UNIQUE (subscription_id, author_user_id)
);

COMMENT ON TABLE public.report_email_subscription_authors IS
  'Authors (reports.created_by_user_id) a subscription is limited to. Ignored when the subscription has all_authors=true.';

CREATE INDEX IF NOT EXISTS idx_report_email_subscription_authors_subscription
  ON public.report_email_subscription_authors (subscription_id);
CREATE INDEX IF NOT EXISTS idx_report_email_subscription_authors_author
  ON public.report_email_subscription_authors (author_user_id);

-- ---------------------------------------------------------------------------
-- Dispatch ledger: one row per (subscription, report) actually emailed. Enforces
-- at-most-once delivery across the auto and manual paths.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_email_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.report_email_subscriptions(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email text,
  trigger text NOT NULL DEFAULT 'auto' CHECK (trigger IN ('auto', 'manual')),
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_email_dispatch_log_unique UNIQUE (subscription_id, report_id)
);

COMMENT ON TABLE public.report_email_dispatch_log IS
  'Idempotency ledger: one row per report emailed to a subscription (auto or manual). UNIQUE(subscription_id, report_id) prevents duplicate sends.';

CREATE INDEX IF NOT EXISTS idx_report_email_dispatch_log_report
  ON public.report_email_dispatch_log (report_id);

-- ---------------------------------------------------------------------------
-- RLS. Clients: manage config only (dev/master/assistant/controller). The edge
-- function uses the service role and bypasses RLS for sending + logging.
-- ---------------------------------------------------------------------------
ALTER TABLE public.report_email_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_email_subscription_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_email_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Report email managers select subscriptions" ON public.report_email_subscriptions;
CREATE POLICY "Report email managers select subscriptions" ON public.report_email_subscriptions
  FOR SELECT USING (public.can_manage_report_email_subscriptions());

DROP POLICY IF EXISTS "Report email managers insert subscriptions" ON public.report_email_subscriptions;
CREATE POLICY "Report email managers insert subscriptions" ON public.report_email_subscriptions
  FOR INSERT WITH CHECK (
    public.can_manage_report_email_subscriptions()
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Report email managers update subscriptions" ON public.report_email_subscriptions;
CREATE POLICY "Report email managers update subscriptions" ON public.report_email_subscriptions
  FOR UPDATE USING (public.can_manage_report_email_subscriptions())
  WITH CHECK (public.can_manage_report_email_subscriptions());

DROP POLICY IF EXISTS "Report email managers delete subscriptions" ON public.report_email_subscriptions;
CREATE POLICY "Report email managers delete subscriptions" ON public.report_email_subscriptions
  FOR DELETE USING (public.can_manage_report_email_subscriptions());

DROP POLICY IF EXISTS "Report email managers select authors" ON public.report_email_subscription_authors;
CREATE POLICY "Report email managers select authors" ON public.report_email_subscription_authors
  FOR SELECT USING (public.can_manage_report_email_subscriptions());

DROP POLICY IF EXISTS "Report email managers insert authors" ON public.report_email_subscription_authors;
CREATE POLICY "Report email managers insert authors" ON public.report_email_subscription_authors
  FOR INSERT WITH CHECK (public.can_manage_report_email_subscriptions());

DROP POLICY IF EXISTS "Report email managers delete authors" ON public.report_email_subscription_authors;
CREATE POLICY "Report email managers delete authors" ON public.report_email_subscription_authors
  FOR DELETE USING (public.can_manage_report_email_subscriptions());

-- Managers may read the dispatch history (e.g. to show "already sent"); no client
-- writes — only the service-role edge function inserts.
DROP POLICY IF EXISTS "Report email managers select dispatch log" ON public.report_email_dispatch_log;
CREATE POLICY "Report email managers select dispatch log" ON public.report_email_dispatch_log
  FOR SELECT USING (public.can_manage_report_email_subscriptions());

-- Deleted-records archive coverage for the root config table.
DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.report_email_subscriptions;
CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.report_email_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record();

-- Required after every CREATE TABLE: block writes from read-only (training mode) users.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
