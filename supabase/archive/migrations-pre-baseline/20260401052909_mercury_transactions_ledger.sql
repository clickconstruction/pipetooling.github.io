-- Ledger of Mercury bank transactions (synced via Edge Function). Dev-only read via RLS.

CREATE TABLE public.mercury_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mercury_id uuid NOT NULL UNIQUE,
  mercury_account_id uuid NOT NULL,
  amount numeric(18, 4) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL,
  posted_at timestamptz,
  status text NOT NULL,
  kind text NOT NULL,
  counterparty_id uuid,
  counterparty_name text,
  note text,
  external_memo text,
  dashboard_link text,
  mercury_category jsonb,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mercury_transactions_posted_at_desc_idx
  ON public.mercury_transactions (posted_at DESC NULLS LAST);

CREATE INDEX mercury_transactions_account_posted_idx
  ON public.mercury_transactions (mercury_account_id, posted_at DESC NULLS LAST);

COMMENT ON TABLE public.mercury_transactions IS 'Mercury API transactions; populated by sync-mercury-transactions Edge Function.';

ALTER TABLE public.mercury_transactions ENABLE ROW LEVEL SECURITY;

-- Devs only (client reads). Service role bypasses RLS for sync.
CREATE POLICY "mercury_transactions dev select"
  ON public.mercury_transactions
  FOR SELECT
  TO authenticated
  USING (public.is_dev());

-- Explicit no client writes; Edge Function uses service role.
CREATE POLICY "mercury_transactions no insert"
  ON public.mercury_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "mercury_transactions no update"
  ON public.mercury_transactions
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "mercury_transactions no delete"
  ON public.mercury_transactions
  FOR DELETE
  TO authenticated
  USING (false);

GRANT SELECT ON public.mercury_transactions TO authenticated;
GRANT ALL ON public.mercury_transactions TO service_role;
