SET lock_timeout = '3s';

-- Partnerships (PARTNERSHIPS_PLAN.md PR 1): the deal-as-data record behind the
-- dev-gated /partnerships page. One row per partner (Bryan Herber first): rates,
-- profit-split percentages, module toggles, utilities allowance. Every kernel
-- and RPC in the train reads this row — no per-person constants in code — so a
-- second partner joins by adding a row, never by writing code.
--
-- Dollars are numeric(10,2) matching pay_stubs/people_pay_config house style
-- (the plan draft said cents; the codebase convention won).
--
-- modules keys (jsonb so later mechanisms are additive without DDL):
--   profit_shares    §3   post profit splits on close of checked-off jobs
--   est_transfer     §4h  move bid-tagged estimating hours onto awarded jobs
--   weekly_statement §4   generate Sun–Sat statements w/ mutual acknowledgment
--   costing          §5   partner job-costing drill-in (checked-off jobs only)
--   require_sign          sign prompts + banner until an agreement is signed
--   auto_notice      §8a  auto-serve lapse notice — STAYS FALSE pending attorney
--   cap              §4a  weekly estimating cap — modeled, nothing built (off)
--   w2               §2b  W2 transition watch — modeled, nothing built (off)

CREATE TABLE IF NOT EXISTS public.partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES public.people(id) ON DELETE RESTRICT,
  display_name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  started_on date,
  field_rate numeric(10,2) NOT NULL DEFAULT 50.00 CHECK (field_rate >= 0),
  estimating_rate numeric(10,2) NOT NULL DEFAULT 35.00 CHECK (estimating_rate >= 0),
  farm_rate numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (farm_rate >= 0),
  company_first_pct numeric(5,2) NOT NULL DEFAULT 22.00 CHECK (company_first_pct >= 0 AND company_first_pct <= 100),
  partner_remainder_pct numeric(5,2) NOT NULL DEFAULT 50.00 CHECK (partner_remainder_pct >= 0 AND partner_remainder_pct <= 100),
  utilities_allowance numeric(10,2) NOT NULL DEFAULT 200.00 CHECK (utilities_allowance >= 0),
  modules jsonb NOT NULL DEFAULT '{"profit_shares": true, "est_transfer": true, "weekly_statement": true, "costing": true, "require_sign": true, "auto_notice": false, "cap": false, "w2": false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

COMMENT ON TABLE public.partnerships IS
  'Partner deal config (PARTNERSHIPS_PLAN.md): rates, split percentages, module toggles per partner person. Dev-only surface; partner-facing RPCs read it server-side. Rate/split changes apply from the NEXT generated statement week — statements stamp the rates they were priced at.';
COMMENT ON COLUMN public.partnerships.modules IS
  'Feature toggles for this partnership. auto_notice/cap/w2 default false: auto_notice awaits attorney sign-off (§8a delivery), cap/w2 are modeled but unbuilt.';

-- Append-only config change log: the Deal tab writes one row per save with the
-- changed keys, so "who changed the split and when" is always answerable.
CREATE TABLE IF NOT EXISTS public.partnership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'config_changed', 'status_changed')),
  patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.partnership_events IS
  'Append-only change log for partnerships config (created / config_changed / status_changed with the changed-keys patch). No UPDATE/DELETE.';

CREATE INDEX IF NOT EXISTS partnership_events_partnership_created_idx
  ON public.partnership_events (partnership_id, created_at DESC);

-- RLS: dev-only on both. Partner-facing reads never touch these tables
-- directly — the train's SECURITY DEFINER RPCs consume config server-side.
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs manage partnerships" ON public.partnerships;
CREATE POLICY "Devs manage partnerships" ON public.partnerships
  FOR ALL USING (public.is_dev()) WITH CHECK (public.is_dev());

DROP POLICY IF EXISTS "Devs read partnership events" ON public.partnership_events;
CREATE POLICY "Devs read partnership events" ON public.partnership_events
  FOR SELECT USING (public.is_dev());

DROP POLICY IF EXISTS "Devs insert partnership events" ON public.partnership_events;
CREATE POLICY "Devs insert partnership events" ON public.partnership_events
  FOR INSERT WITH CHECK (public.is_dev() AND actor_user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON TABLE public.partnerships TO authenticated;
GRANT SELECT, INSERT ON TABLE public.partnership_events TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
