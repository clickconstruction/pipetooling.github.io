SET lock_timeout = '3s';

-- A price sheet a digital twin read (punch list #308 PR 9; docs/migrations/20261111140000_price_sheet_robot.md).
--
-- The pricing twin already reads a bid's quote PDFs for a request the estimator queued. With this column it can leave
-- what it read as a price sheet too: a draft, with every row as printed, that the estimator opens on Takeoffs and
-- files with her own press. The twin files nothing. The column ties the draft to the request it was read for, so the
-- same house on the same request is one sheet, rewritten only on the twin's own word and never once a person has
-- filed a row of it.
--
-- One nullable column and its index. Additive and idempotent. No table is new, so no fence applier runs.

ALTER TABLE public.supply_papers
  ADD COLUMN IF NOT EXISTS robot_request_id uuid REFERENCES public.bid_price_matrix_requests(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.supply_papers.robot_request_id IS
  'The pricing request a digital twin read this price sheet for (punch list #308 PR 9). Null for a sheet a person read. twin-mcp put_price_sheet writes it as the service role; the twin files nothing.';

CREATE INDEX IF NOT EXISTS supply_papers_robot_request_idx ON public.supply_papers (robot_request_id) WHERE robot_request_id IS NOT NULL;
