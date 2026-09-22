SET lock_timeout = '3s';

-- The Contract sweep's Drive pass, remembered for the whole office (v2.3709,
-- to-dos/contract-sweep-refresh item 3). `drive-contract-scan` lists the
-- contract-looking files in the jobs Shared Drive and walks their folders — a
-- minute or more per scan (66 s measured 2026-09-21). Until now every browser
-- tab ran its own: one row here holds the last scan, and the function answers
-- from it while it is younger than an hour unless asked to scan again.
-- Service role only: the function reads and writes it; the client asks the
-- function. No policies on purpose.
CREATE TABLE IF NOT EXISTS public.drive_contract_scans (
  scope text PRIMARY KEY,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scanned_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.drive_contract_scans IS
  'The last Drive pass of the Contract sweep (drive-contract-scan), one row per scope (''contracts''): the matched files, the scan''s counts and when it ran. Service role only — the function serves it to the office while it is fresh.';

ALTER TABLE public.drive_contract_scans ENABLE ROW LEVEL SECURITY;

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
