SET lock_timeout = '3s';

-- Tier 5 X7 (cluster C34), T5-07: one join key for free-text identities, plus the merges the
-- key cannot make on its own. Keys are normalizeIdentityKey() output
-- (supabase/functions/_shared/identityKey.ts). `merge` folds alias_key into canonical_key at
-- every join that reads the table; `keep` records "these are different, stop asking".

-- The office cohort (dev, master, assistant-like) — the same set is_banking_staff() names,
-- under the name the rest of the app can use.
CREATE OR REPLACE FUNCTION public.is_office_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_master_or_dev() OR public.is_assistant();
$$;
COMMENT ON FUNCTION public.is_office_staff() IS
  'Office cohort (v2.2950): dev, master_technician, or assistant-LIKE (assistant, controller). Same set as is_banking_staff(); named for surfaces that are not Banking.';
GRANT ALL ON FUNCTION public.is_office_staff() TO anon;

CREATE TABLE IF NOT EXISTS public.identity_aliases (
  kind text NOT NULL CHECK (kind IN ('builder', 'manufacturer', 'crew_name')),
  alias_key text NOT NULL,
  canonical_key text NOT NULL,
  canonical_name text NOT NULL DEFAULT '',
  decision text NOT NULL DEFAULT 'merge' CHECK (decision IN ('merge', 'keep')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, alias_key)
);

ALTER TABLE public.identity_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS identity_aliases_office_all ON public.identity_aliases;
CREATE POLICY identity_aliases_office_all ON public.identity_aliases
  FOR ALL USING (public.is_office_staff()) WITH CHECK (public.is_office_staff());

COMMENT ON TABLE public.identity_aliases IS
  'Tier 5 X7 (v2.2950): merges the identity key cannot make alone. (kind, alias_key) → canonical_key; decision merge = fold, keep = never ask again. Keys are normalizeIdentityKey() output.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
