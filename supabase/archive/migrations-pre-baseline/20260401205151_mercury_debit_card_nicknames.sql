-- Dev-editable labels for Mercury debit card UUIDs (raw.debitCardInfo.id; Banking page).

CREATE TABLE public.mercury_debit_card_nicknames (
  mercury_debit_card_id uuid PRIMARY KEY,
  nickname text NOT NULL CHECK (
    char_length(trim(nickname)) >= 1
    AND char_length(nickname) <= 120
  ),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mercury_debit_card_nicknames IS 'Optional labels for Mercury debit card ids from mercury_transactions.raw; dev-only via RLS.';

ALTER TABLE public.mercury_debit_card_nicknames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercury_debit_card_nicknames dev select"
  ON public.mercury_debit_card_nicknames
  FOR SELECT
  TO authenticated
  USING (public.is_dev());

CREATE POLICY "mercury_debit_card_nicknames dev insert"
  ON public.mercury_debit_card_nicknames
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_dev());

CREATE POLICY "mercury_debit_card_nicknames dev update"
  ON public.mercury_debit_card_nicknames
  FOR UPDATE
  TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

CREATE POLICY "mercury_debit_card_nicknames dev delete"
  ON public.mercury_debit_card_nicknames
  FOR DELETE
  TO authenticated
  USING (public.is_dev());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_debit_card_nicknames TO authenticated;
GRANT ALL ON public.mercury_debit_card_nicknames TO service_role;
