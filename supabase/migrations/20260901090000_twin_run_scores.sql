SET lock_timeout = '3s';

-- Twin confidence scoreboard (v2.2556): structured backtest scores.
-- Shadow runs already live in twin_shadow_runs; backtest results lived only in
-- freeform ledger notes, which a UI cannot read. One row per backtest run,
-- written at unseal (service role via twin-mcp / harness), seeded here with the
-- BT-6..BT-16 history so the scoreboard shows the program trajectory on day one.

CREATE TABLE IF NOT EXISTS public.twin_run_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_label text NOT NULL UNIQUE,            -- 'BT-16'
  kind text NOT NULL DEFAULT 'backtest',     -- backtest | shadow (shadows normally live in twin_shadow_runs)
  axis text,                                 -- confidence-scoreboard axis
  project_name text,
  twin_bid_number text,                      -- ZZ bid, e.g. '422'
  reference_bid_number text,                 -- e.g. '201'
  locked_total numeric,
  reference_value numeric,
  delta_pct numeric,                         -- (locked/reference - 1) * 100
  counts_note text,                          -- e.g. '96% · scope pass' / 'FS 9/9 (T3)'
  scope_verdict text,                        -- pass | fail | unknown
  gate_eligible boolean NOT NULL DEFAULT true,
  note text,                                 -- one-line lesson / blocker for the axis card
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.twin_run_scores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'twin_run_scores' AND policyname = 'twin_run_scores_staff_select'
  ) THEN
    CREATE POLICY twin_run_scores_staff_select ON public.twin_run_scores
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Seed: the backtest trajectory (deltas as stamped on the run ledgers).
INSERT INTO public.twin_run_scores
  (run_label, axis, project_name, twin_bid_number, reference_bid_number, delta_pct, counts_note, scope_verdict, gate_eligible, note, scored_at)
VALUES
  ('BT-6',  'kitchen/occupied', 'Pepper Lunch',           '409', '269', -39.0, NULL, 'pass', true,  'pre-doctrine: material-spec pricing; produced the loaded-tier rule', '2026-08-31T00:00:00Z'),
  ('BT-7',  'kitchen/occupied', 'HEB kitchen TI',         '410', '298', -17.0, NULL, 'pass', true,  'density-tier rule validated blind', '2026-08-31T04:00:00Z'),
  ('BT-8',  'proto/auto-service', 'Take 5 San Pedro',     '411', '298', -30.6, 'footage 0.60x', 'pass', true, 'untraced footage regressed; trace-or-1.6x rule; site-scope question still parked', '2026-08-31T08:00:00Z'),
  ('BT-11', 'small TI', 'ATI Schertz',                    '414', '34',  59.9,  NULL, 'pass', true,  'footage rows poison small jobs; produced the small-TI per-fixture rule', '2026-08-31T12:00:00Z'),
  ('BT-12', 'small TI', 'AutoZone 1604',                  '415', '67',  -2.6,  NULL, 'pass', true,  'small-TI rule validated, zero tuning', '2026-08-31T14:00:00Z'),
  ('BT-13', 'mid-size TI', 'SA Logistics Center',         '416', '188', 4.6,   '~94%', 'pass', true, 'Gate A run', '2026-08-31T15:00:00Z'),
  ('BT-14', 'kitchen/occupied', 'Proud Mary Coffee',      '417', '291', 3.5,   'FS 9/9 (T3 re-census)', 'pass', true, 'dollar landed; count misses now machine-covered by T3', '2026-08-31T16:00:00Z'),
  ('BT-15', 'institutional', 'TSAOG campus',              '421', '323', -28.0, 'scope FAIL', 'fail', false, 'VOID — reference priced the tenant fit-out; fetched set was core/shell. Produced the scope-match rule.', '2026-08-31T18:00:00Z'),
  ('BT-16', 'institutional', 'AISD Garcia MS',            '422', '201', -57.5, '96% · scope pass', 'pass', true, 'counts matched; gap is the district wage tier (~2.35x) — multiplier question on the b422 audit', '2026-08-31T22:00:00Z')
ON CONFLICT (run_label) DO NOTHING;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
