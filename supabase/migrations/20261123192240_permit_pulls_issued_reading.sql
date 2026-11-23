SET lock_timeout = '3s';

-- Permits (punch list #405): each reading of a feed keeps its own start on the run's ledger row.
--
-- San Antonio's applications are read twice a night: by filing day, then by issued day. The second
-- reading starts thirty days before the newest issued day held, and the first reading writes
-- issued days too, so on a night the second reading fails its start still moves on. A month of
-- failed second readings alone would leave permits issued in that month reading as waiting.
--
-- `since` keeps the first reading's start as before. `issued_since` keeps the second reading's
-- start, and `issued_whole` says whether it read to its end. When the newest kept run's second
-- reading did not, the next one starts no later than that start (`permit-pull`). Null on a feed
-- read once and on every row written before this column.
--
-- Additive and idempotent: two nullable columns, no rewrite, no new table.

ALTER TABLE public.permit_pulls ADD COLUMN IF NOT EXISTS issued_since date;
ALTER TABLE public.permit_pulls ADD COLUMN IF NOT EXISTS issued_whole boolean;

COMMENT ON COLUMN public.permit_pulls.issued_since IS
  'Punch list #405: the start of the run''s second reading, by issued day, on a feed read twice (San Antonio''s applications). Null on a feed read once.';
COMMENT ON COLUMN public.permit_pulls.issued_whole IS
  'Punch list #405: true when the second reading read to its end, false when an error or the time budget stopped it or it never began. The next run''s second reading starts no later than issued_since while the newest kept value is false.';
