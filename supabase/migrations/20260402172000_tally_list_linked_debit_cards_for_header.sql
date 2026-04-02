-- Linked card labels for Job Tally header (nicknames via SECURITY DEFINER; cardholders cannot SELECT nicknames table directly).

CREATE OR REPLACE FUNCTION public.list_my_linked_mercury_debit_cards_for_tally()
RETURNS TABLE (
  mercury_debit_card_id uuid,
  nickname text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_my_linked_mercury_debit_cards_for_tally: not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    l.mercury_debit_card_id,
    nn.nickname
  FROM public.mercury_debit_card_user_links l
  LEFT JOIN public.mercury_debit_card_nicknames nn
    ON nn.mercury_debit_card_id = l.mercury_debit_card_id
  WHERE l.user_id = auth.uid()
  ORDER BY COALESCE(nn.nickname, ''), l.mercury_debit_card_id;
END;
$$;

COMMENT ON FUNCTION public.list_my_linked_mercury_debit_cards_for_tally() IS
  'Card-linked user: their linked debit card ids and optional staff nickname for Tally UI.';

REVOKE ALL ON FUNCTION public.list_my_linked_mercury_debit_cards_for_tally() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_linked_mercury_debit_cards_for_tally() TO authenticated;
