SET lock_timeout = '3s';

-- v2.4923 — GC mode, the Board's B5-a: our number's money behind its own door, and the tables B5's
-- screens write (to-dos/gc-mode/mockups/board-b5.md on branch spike/gc-mode, approved 2026-10-08).
--   1) public.gc_money_team(): who reads and writes our number (dev, the leaders, the controller),
--      named once. The client's copy is GC_MONEY_TEAM in src/lib/gc/access.ts.
--   2) gc_project_money: our general conditions, contingency and fee, one row per GC project, behind
--      gc_money_team(). The expand step: each project's three values are copied from gc_projects,
--      whose columns stay, unwritten, until B6-a drops them (the contract step). Since door 1 those
--      columns are open to gc_office_team(), estimators included; on prod they are all 0 and nothing
--      writes them, so nothing has leaked.
--   3) Carry: which quote, or our budget, is a trade's number (gc_trade_packages).
--   4) Bid tabs: a trade's tab shared with the companies that quoted, and who opened it.
--   5) We sent our bid, We won this, We lost this and Bring it back, each stamping the company's day.
-- Every date default is public.app_today(), never CURRENT_DATE (#4951). Idempotent and additive.
-- See docs/migrations/20261008130000_gc_our_number.md.

-- 1) The money team.
CREATE OR REPLACE FUNCTION public.gc_money_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'controller')
  );
$$;

COMMENT ON FUNCTION public.gc_money_team() IS
  'GC mode (B5, v2.4923): who reads and writes our number (general conditions, contingency, fee): dev, the leaders (master_technician) and the controller. Change the audience here, never in a policy. The client''s copy is GC_MONEY_TEAM in src/lib/gc/access.ts; access.test.ts fails when they differ.';

REVOKE EXECUTE ON FUNCTION public.gc_money_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_money_team() TO authenticated, service_role;

-- 2) Our number.
CREATE TABLE IF NOT EXISTS public.gc_project_money (
  project_id uuid PRIMARY KEY REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  general_conditions numeric NOT NULL DEFAULT 0
    CONSTRAINT gc_project_money_gc_not_negative CHECK (general_conditions >= 0),
  contingency_pct numeric NOT NULL DEFAULT 0
    CONSTRAINT gc_project_money_contingency_range CHECK (contingency_pct >= 0 AND contingency_pct <= 100),
  fee_pct numeric NOT NULL DEFAULT 0
    CONSTRAINT gc_project_money_fee_range CHECK (fee_pct >= 0 AND fee_pct <= 100),
  updated_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_project_money IS
  'GC mode (B5, v2.4923): our number''s three inputs on a GC project, what we add on top of the trades: general conditions in dollars, contingency and fee in percent. Only gc_money_team() reads or writes it. No row reads as zeros.';

-- The expand step: each project's values, as they are today.
INSERT INTO public.gc_project_money (project_id, general_conditions, contingency_pct, fee_pct)
SELECT project_id, general_conditions, contingency_pct, fee_pct FROM public.gc_projects
ON CONFLICT (project_id) DO NOTHING;

ALTER TABLE public.gc_project_money ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_project_money_team ON public.gc_project_money;
CREATE POLICY gc_project_money_team ON public.gc_project_money FOR ALL TO authenticated
  USING ((SELECT public.gc_money_team())) WITH CHECK ((SELECT public.gc_money_team()));
REVOKE ALL ON public.gc_project_money FROM anon;

-- 3) Carry: an ask on this trade, or our budget, never both.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_invites_id_package' AND conrelid = 'public.gc_invites'::regclass) THEN
    ALTER TABLE public.gc_invites ADD CONSTRAINT gc_invites_id_package UNIQUE (id, package_id);
  END IF;
END $$;

ALTER TABLE public.gc_trade_packages
  ADD COLUMN IF NOT EXISTS carried_invite_id uuid,
  ADD COLUMN IF NOT EXISTS carry_budget boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_trade_packages_carried_on_this_trade' AND conrelid = 'public.gc_trade_packages'::regclass) THEN
    -- A deleted ask clears the carry, never the trade's own id (Postgres 15's column list).
    ALTER TABLE public.gc_trade_packages ADD CONSTRAINT gc_trade_packages_carried_on_this_trade
      FOREIGN KEY (carried_invite_id, id) REFERENCES public.gc_invites (id, package_id) ON DELETE SET NULL (carried_invite_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_trade_packages_carry_one' AND conrelid = 'public.gc_trade_packages'::regclass) THEN
    ALTER TABLE public.gc_trade_packages ADD CONSTRAINT gc_trade_packages_carry_one
      CHECK (NOT (carried_invite_id IS NOT NULL AND carry_budget));
  END IF;
END $$;

COMMENT ON COLUMN public.gc_trade_packages.carried_invite_id IS
  'GC mode (B5, v2.4923): the quote we carry as this trade''s number (an ask on this trade). Null with carry_budget false: nothing carried yet.';
COMMENT ON COLUMN public.gc_trade_packages.carry_budget IS
  'GC mode (B5, v2.4923): true when we carry our own budget as this trade''s number, with no quote.';

-- 4) Bid tabs.
CREATE TABLE IF NOT EXISTS public.gc_bid_tabs (
  package_id uuid PRIMARY KEY REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  shared_on date NOT NULL DEFAULT public.app_today(),
  show_names boolean NOT NULL DEFAULT false,
  shared_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_bid_tabs IS
  'GC mode (B5, v2.4923): a trade''s bid tab shared with the companies that quoted (bidTab): the day, and whether company names show. The Portal reads it (P5e).';

CREATE TABLE IF NOT EXISTS public.gc_bid_tab_views (
  package_id uuid NOT NULL REFERENCES public.gc_bid_tabs(package_id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  seen_on date NOT NULL DEFAULT public.app_today(),
  PRIMARY KEY (package_id, company_id)
);

COMMENT ON TABLE public.gc_bid_tab_views IS
  'GC mode (B5, v2.4923): who opened a shared bid tab, and when (bidTab.seenBy). Written by the Portal''s gc_trade_see_bid_tab (P5e).';

-- Dev only while the Board is built, as the company record is (B1); the Board's door opens them.
ALTER TABLE public.gc_bid_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_bid_tab_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_bid_tabs_dev ON public.gc_bid_tabs;
CREATE POLICY gc_bid_tabs_dev ON public.gc_bid_tabs FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_bid_tab_views_dev ON public.gc_bid_tab_views;
CREATE POLICY gc_bid_tab_views_dev ON public.gc_bid_tab_views FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
REVOKE ALL ON public.gc_bid_tabs, public.gc_bid_tab_views FROM anon;

-- 5) The project's outcome, each stamping the company's day. SECURITY INVOKER: gc_projects' team
-- policy is their gate.
CREATE OR REPLACE FUNCTION public.gc_mark_bid_sent(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gc_projects SET our_bid_sent_on = coalesce(our_bid_sent_on, public.app_today())
  WHERE project_id = p_project_id AND stage = 'bidding' AND lost_on IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a project still bidding can send its bid.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gc_mark_won(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gc_projects SET stage = 'buyout', our_bid_sent_on = coalesce(our_bid_sent_on, public.app_today())
  WHERE project_id = p_project_id AND stage = 'bidding' AND lost_on IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a project still bidding can be won.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gc_mark_lost(p_project_id uuid, p_why text, p_won_by text DEFAULT '', p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_why IS NULL OR p_why NOT IN ('price', 'other_builder', 'project_died', 'no_bid', 'no_answer') THEN
    RAISE EXCEPTION 'Pick why we lost it.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_projects
  SET lost_on = public.app_today(), lost_why = p_why,
      won_by = nullif(btrim(coalesce(p_won_by, '')), ''), lost_note = nullif(btrim(coalesce(p_note, '')), '')
  WHERE project_id = p_project_id AND stage = 'bidding' AND lost_on IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a project still bidding can be lost.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gc_bring_back(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gc_projects SET lost_on = NULL, lost_why = NULL, won_by = NULL, lost_note = NULL
  WHERE project_id = p_project_id AND lost_on IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a lost project can be brought back.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.gc_mark_bid_sent(uuid) IS 'GC mode (B5, v2.4923): We sent our bid (markBidSent): our_bid_sent_on is the company''s day, kept if already set. A project still bidding only. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_mark_won(uuid) IS 'GC mode (B5, v2.4923): We won this (markWon): the project goes to buyout, and our bid counts as sent. A project still bidding only. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_mark_lost(uuid, text, text, text) IS 'GC mode (B5, v2.4923): We lost this (markLost): the company''s day, why (the Trades mode loss reasons), who won and a note. A project still bidding only. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_bring_back(uuid) IS 'GC mode (B5, v2.4923): Bring it back (reopenLost): the customer came back, so the loss is cleared and the project bids again as it stood. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_mark_bid_sent(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_mark_won(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_mark_lost(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_bring_back(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_mark_bid_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_mark_won(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_mark_lost(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_bring_back(uuid) TO authenticated;

-- 6) Training mode and digital twins: the new tables get their blocks; the three create only what is missing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
