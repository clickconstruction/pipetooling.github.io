-- Dev-editable friendly labels for Mercury account UUIDs (Banking page).

CREATE TABLE public.mercury_account_nicknames (
  mercury_account_id uuid PRIMARY KEY,
  nickname text NOT NULL CHECK (
    char_length(trim(nickname)) >= 1
    AND char_length(nickname) <= 120
  ),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mercury_account_nicknames IS 'Optional labels for mercury_transactions.mercury_account_id; dev-only via RLS.';

ALTER TABLE public.mercury_account_nicknames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercury_account_nicknames dev select"
  ON public.mercury_account_nicknames
  FOR SELECT
  TO authenticated
  USING (public.is_dev());

CREATE POLICY "mercury_account_nicknames dev insert"
  ON public.mercury_account_nicknames
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_dev());

CREATE POLICY "mercury_account_nicknames dev update"
  ON public.mercury_account_nicknames
  FOR UPDATE
  TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

CREATE POLICY "mercury_account_nicknames dev delete"
  ON public.mercury_account_nicknames
  FOR DELETE
  TO authenticated
  USING (public.is_dev());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_account_nicknames TO authenticated;
GRANT ALL ON public.mercury_account_nicknames TO service_role;
