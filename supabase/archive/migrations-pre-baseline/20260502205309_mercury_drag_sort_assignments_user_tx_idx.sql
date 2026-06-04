-- Banking Drag Sort: faster lookups by user + mercury transaction (list load filters by user_id; PK leads with mercury_transaction_id).

CREATE INDEX IF NOT EXISTS mercury_transaction_drag_sort_assignments_user_mercury_tx_idx
  ON public.mercury_transaction_drag_sort_assignments (user_id, mercury_transaction_id);
