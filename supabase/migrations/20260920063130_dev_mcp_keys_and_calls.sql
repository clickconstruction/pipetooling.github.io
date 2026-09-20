SET lock_timeout = '3s';

-- dev-mcp (to-dos/mcp-servers.md, PR 4b): the MCP server a dev's agent reads the app
-- through. A key maps to a PERSON — the function mints that person's own session and
-- calls the app's API GET-only, so RLS and every auth.uid() check apply as on the
-- screen. Two tables:
--   * dev_mcp_credentials — per-dev keys, sha256 only (the key is generated client-side,
--     shown once). A dev issues keys for THEMSELF only; revoking a row cuts off one
--     machine. The function re-checks role = 'dev' on every call, so a demoted or
--     archived dev's keys stop working without anyone revoking them.
--   * dev_mcp_calls — the call log: who, which verb, what it named, how it ended.
--     Written by the function (service role) only; devs read it.

CREATE TABLE IF NOT EXISTS public.dev_mcp_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- sha256 hex of the key; plaintext exists only at issue time.
  token_hash text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  revoked_at timestamptz NULL,
  last_used_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS dev_mcp_credentials_user_idx ON public.dev_mcp_credentials (user_id);

COMMENT ON TABLE public.dev_mcp_credentials IS
  'Per-dev keys (sha256 hashes) for the dev-mcp edge function — one per machine; a dev issues only their own; revoke a row to cut one machine off. See to-dos/mcp-servers.md.';

ALTER TABLE public.dev_mcp_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_mcp_credentials_select_dev" ON public.dev_mcp_credentials;
CREATE POLICY "dev_mcp_credentials_select_dev" ON public.dev_mcp_credentials
  FOR SELECT USING (public.is_dev());
DROP POLICY IF EXISTS "dev_mcp_credentials_insert_own" ON public.dev_mcp_credentials;
CREATE POLICY "dev_mcp_credentials_insert_own" ON public.dev_mcp_credentials
  FOR INSERT WITH CHECK (public.is_dev() AND user_id = auth.uid());
DROP POLICY IF EXISTS "dev_mcp_credentials_update_dev" ON public.dev_mcp_credentials;
CREATE POLICY "dev_mcp_credentials_update_dev" ON public.dev_mcp_credentials
  FOR UPDATE USING (public.is_dev()) WITH CHECK (public.is_dev());

GRANT SELECT, INSERT, UPDATE ON public.dev_mcp_credentials TO authenticated;
GRANT ALL ON public.dev_mcp_credentials TO service_role;

CREATE TABLE IF NOT EXISTS public.dev_mcp_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  credential_id uuid NULL REFERENCES public.dev_mcp_credentials(id) ON DELETE SET NULL,
  user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  -- Set when a read ran as someone else (view_as); null when it ran as the key's owner.
  as_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  verb text NOT NULL,
  -- The RPC or table the verb named, when it named one.
  target text NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('ok', 'error', 'refused')),
  row_count integer NULL,
  duration_ms integer NULL,
  error text NULL
);

CREATE INDEX IF NOT EXISTS dev_mcp_calls_created_idx ON public.dev_mcp_calls (created_at DESC);
CREATE INDEX IF NOT EXISTS dev_mcp_calls_user_idx ON public.dev_mcp_calls (user_id, created_at DESC);

COMMENT ON TABLE public.dev_mcp_calls IS
  'dev-mcp call log — one row per tools/call: who, which verb, the RPC or table it named, outcome. Written by the edge function only. See to-dos/mcp-servers.md.';

ALTER TABLE public.dev_mcp_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_mcp_calls_select_dev" ON public.dev_mcp_calls;
CREATE POLICY "dev_mcp_calls_select_dev" ON public.dev_mcp_calls
  FOR SELECT USING (public.is_dev());

GRANT SELECT ON public.dev_mcp_calls TO authenticated;
GRANT ALL ON public.dev_mcp_calls TO service_role;

-- House rules for CREATE TABLE: training-mode blocks + statement trigger, and the twin
-- write-fence re-applied so the new tables get their (deny-by-default) fence policies.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
