-- Assistants: edit mercury_debit_card_nicknames (Banking Debit card nicknames modal).

CREATE POLICY "mercury_debit_card_nicknames assistant insert"
  ON public.mercury_debit_card_nicknames
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_assistant());

CREATE POLICY "mercury_debit_card_nicknames assistant update"
  ON public.mercury_debit_card_nicknames
  FOR UPDATE
  TO authenticated
  USING (public.is_assistant())
  WITH CHECK (public.is_assistant());

CREATE POLICY "mercury_debit_card_nicknames assistant delete"
  ON public.mercury_debit_card_nicknames
  FOR DELETE
  TO authenticated
  USING (public.is_assistant());
