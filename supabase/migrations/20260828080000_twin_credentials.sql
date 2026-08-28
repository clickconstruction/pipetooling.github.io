SET lock_timeout = '3s';

-- Digital twins: per-twin credentials (docs/DIGITAL_TWINS_PLAN.md — the external-provider
-- prerequisite). Until now one master TWIN_LOGIN_SECRET minted any twin; before a
-- third-party agent provider (xAI/Grok, etc.) gets a seat, each twin gets its OWN token:
--   * twin-login accepts a per-twin token (sha256 stored, never plaintext) that can mint
--     ONLY that twin's sessions;
--   * revoking one row (revoked_at) cuts off one partner without touching the fleet;
--   * the master secret remains the owner/ops path and the fleet-wide kill switch.
-- Devs mint tokens (INSERT policy below — token is generated client-side, shown once,
-- only the hash is stored); the edge function reads/updates via service role.

CREATE TABLE IF NOT EXISTS public.twin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- sha256 hex of the token; plaintext exists only at mint time.
  token_hash text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  revoked_at timestamptz NULL,
  last_used_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS twin_credentials_twin_idx ON public.twin_credentials (twin_user_id);

COMMENT ON TABLE public.twin_credentials IS
  'Per-twin login tokens (sha256 hashes) for the twin-login edge function — one per harness/partner; revoke a row to cut off one partner. Master TWIN_LOGIN_SECRET stays as the ops path. See docs/twins/TWIN_HARNESS.md.';

ALTER TABLE public.twin_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "twin_credentials_select_dev" ON public.twin_credentials;
CREATE POLICY "twin_credentials_select_dev" ON public.twin_credentials
  FOR SELECT USING (public.is_dev());
DROP POLICY IF EXISTS "twin_credentials_insert_dev" ON public.twin_credentials;
CREATE POLICY "twin_credentials_insert_dev" ON public.twin_credentials
  FOR INSERT WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS "twin_credentials_update_dev" ON public.twin_credentials;
CREATE POLICY "twin_credentials_update_dev" ON public.twin_credentials
  FOR UPDATE USING (public.is_dev()) WITH CHECK (public.is_dev());

GRANT SELECT, INSERT, UPDATE ON public.twin_credentials TO authenticated;
GRANT ALL ON public.twin_credentials TO service_role;

-- House rules for CREATE TABLE: training-mode blocks + statement trigger, and the twin
-- write-fence re-applied so the new table gets its (deny-by-default) fence policies.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
