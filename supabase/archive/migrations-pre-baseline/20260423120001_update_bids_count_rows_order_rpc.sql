-- RPC to batch-update sequence_order for bids_count_rows (used by Counts drag reorder)
CREATE OR REPLACE FUNCTION public.update_bids_count_rows_order(
  p_bid_id uuid,
  p_ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_bid_for_pricing(p_bid_id) THEN
    RAISE EXCEPTION 'Access denied to bid';
  END IF;

  -- Update sequence_order for each id by its index (0-based) in the array
  UPDATE public.bids_count_rows bcr
  SET sequence_order = ord.seq - 1
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, seq)
  WHERE bcr.id = ord.id AND bcr.bid_id = p_bid_id;
END;
$$;

COMMENT ON FUNCTION public.update_bids_count_rows_order(uuid, uuid[]) IS 'Batch-update sequence_order for count rows. Used by Bids Counts drag reorder.';

GRANT EXECUTE ON FUNCTION public.update_bids_count_rows_order(uuid, uuid[]) TO authenticated;
