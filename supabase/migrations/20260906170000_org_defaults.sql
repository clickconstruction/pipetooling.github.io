SET lock_timeout = '3s';

-- Tier 5 X16 (cluster C27, decision 19), T5-08: per-device defaults become org / role defaults,
-- and alert dismissals follow the person.

-- 1) org_defaults: (key, role) → value. role = '*' is the org-wide row; a role row overrides it.
--    Read by every signed-in user at sign-in; written from Settings → Company by dev / master.
CREATE TABLE IF NOT EXISTS public.org_defaults (
  key text NOT NULL,
  role text NOT NULL DEFAULT '*',
  value text NOT NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, role)
);
ALTER TABLE public.org_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_defaults_read ON public.org_defaults;
CREATE POLICY org_defaults_read ON public.org_defaults FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS org_defaults_write ON public.org_defaults;
CREATE POLICY org_defaults_write ON public.org_defaults
  FOR ALL USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());
COMMENT ON TABLE public.org_defaults IS
  'Tier 5 X16 (v2.2951): org / role defaults for per-device switches (mobile cards, payroll auto-apply, Stripe mode). Resolved device → role → ''*'' → fallback (src/lib/orgDefaults.ts).';

-- 2) user_dismissals: a person's own alert dismissals, mirrored from localStorage so a new
--    device does not re-raise what they already dismissed. Own rows only.
CREATE TABLE IF NOT EXISTS public.user_dismissals (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
ALTER TABLE public.user_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_dismissals_own ON public.user_dismissals;
CREATE POLICY user_dismissals_own ON public.user_dismissals
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
COMMENT ON TABLE public.user_dismissals IS
  'Tier 5 X16 (v2.2951): per-person alert dismissal state (bulk-delete notice, claim-dev alert, dev-rejected banner), keyed by the localStorage prefix; seeded into localStorage at sign-in.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
