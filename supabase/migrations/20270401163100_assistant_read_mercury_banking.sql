-- Assistants: read-only Banking Sorting view (mercury_transactions + nickname labels).

CREATE POLICY "mercury_transactions assistant select"
  ON public.mercury_transactions
  FOR SELECT
  TO authenticated
  USING (public.is_assistant());

CREATE POLICY "mercury_account_nicknames assistant select"
  ON public.mercury_account_nicknames
  FOR SELECT
  TO authenticated
  USING (public.is_assistant());

CREATE POLICY "mercury_debit_card_nicknames assistant select"
  ON public.mercury_debit_card_nicknames
  FOR SELECT
  TO authenticated
  USING (public.is_assistant());
