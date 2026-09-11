SET lock_timeout = '3s';

-- Price Matrix PR 6 (docs/PRICE_MATRIX_PLAN.md): one-time SETUP CODES for "Set up on this Mac".
-- A person presses the button in the app; the twin-setup edge function mints a short code
-- (≈50 bits, 10 minutes, single use) and hands back a Terminal command that carries the code
-- instead of a robot key. The command redeems the code at twin-setup, which mints the
-- twin_credentials token server-side and writes it straight into Claude Desktop's config on
-- that Mac — the key is never shown to a person, never pasted, never on a clipboard.
-- Service role writes (the edge function); devs read for audit. Twins never touch it.

CREATE TABLE IF NOT EXISTS public.twin_setup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- sha256 hex of the normalized code (upper-case, no dashes); plaintext exists only in the command.
  code_hash text NOT NULL UNIQUE,
  -- Becomes the credential's label on redeem ("Wendi's MacBook").
  label text NOT NULL DEFAULT '',
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz NULL,
  -- The hostname the redeeming command reported (informational, for the fleet card).
  redeemed_from text NULL,
  credential_id uuid NULL REFERENCES public.twin_credentials(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS twin_setup_codes_twin_idx ON public.twin_setup_codes (twin_user_id, created_at DESC);

COMMENT ON TABLE public.twin_setup_codes IS
  'One-time codes (sha256 hashes, ~10 min, single use) minted by the twin-setup edge function for "Set up on this Mac": redeeming one mints a twin_credentials token server-side and writes it into Claude Desktop''s config, so the key is never shown to a person. See docs/twins/TWIN_HARNESS.md.';
COMMENT ON COLUMN public.twin_setup_codes.code_hash IS 'sha256 hex of the code with dashes removed and upper-cased.';
COMMENT ON COLUMN public.twin_setup_codes.credential_id IS 'The twin_credentials row the redeem minted; null until redeemed.';
COMMENT ON COLUMN public.twin_setup_codes.redeemed_from IS 'Hostname reported by the redeeming command (informational).';

ALTER TABLE public.twin_setup_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "twin_setup_codes_select_dev" ON public.twin_setup_codes;
CREATE POLICY "twin_setup_codes_select_dev" ON public.twin_setup_codes
  FOR SELECT USING (public.is_dev());

GRANT SELECT ON public.twin_setup_codes TO authenticated;
GRANT ALL ON public.twin_setup_codes TO service_role;

-- House rules for CREATE TABLE: training-mode blocks + statement trigger, and the twin
-- write-fence re-applied so the new table gets its (deny-by-default) fence policies.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
