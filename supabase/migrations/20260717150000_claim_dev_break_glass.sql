-- claim-dev: break-glass only, audited.
--
-- WHY. The claim-dev edge function is a form labelled "Enter code" under Settings → Advanced, visible to
-- every role except subcontractor/helpers. The right code promoted you to dev INSTANTLY, with no audit
-- trail, no notification and no lockout. It promoted via a service-role client, so auth.uid() is NULL
-- inside users_guard_privileged_columns (20260716090000) and that guard early-returns — meaning the rule
-- we shipped ("only a dev can change a role; nobody self-promotes") had a deployed, UI-exposed bypass
-- gated only by a static shared secret. Anyone who ever saw the code — a contractor, a former employee, a
-- screenshot — could become dev at any time, from any account, silently.
--
-- claim-dev's ONLY legitimate purpose is bootstrap/recovery: minting the first dev, or getting back in
-- when locked out. A dev can already promote anyone from Active Accounts, so it is not needed day-to-day.
-- This restricts it to exactly that purpose and records every attempt.
--
-- THE GATE: refuse whenever a USABLE dev exists (role='dev' AND archived_at IS NULL AND read_only=false).
-- The two real lockout cases still work: the only dev is archived, or the only dev is read_only.
--
-- A READ-ONLY CALLER IS ALWAYS REFUSED, even with no dev at all. A frozen account must never gain
-- privileges — and it would not help them anyway: read_only survives the promotion (v2.704 blocks their
-- writes regardless, and they still cannot clear their own flag).
--
-- NOT A NEW DOOR: claim_dev_attempt() is REVOKEd from PUBLIC/anon/authenticated and granted ONLY to
-- service_role, so the edge function is the sole caller. The code check stays in the edge function (it
-- holds the secret) and is passed in as p_code_ok; the RPC trusts it precisely because only the edge
-- function can call it.
--
-- The caller must NOT be told which refusal happened: a correct code refused because a dev exists would
-- otherwise be a CODE ORACLE, confirming the secret is valid. The edge function returns the same opaque
-- {success:false} for every refusal; the truth lives here, in claim_dev_attempts.

CREATE TABLE IF NOT EXISTS public.claim_dev_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_by uuid,                                   -- no FK on purpose: an audit row must never fail
  attempted_at timestamptz NOT NULL DEFAULT now(),     -- on a missing referent (same as deleted_by)
  outcome      text NOT NULL,                          -- granted | refused_bad_code | refused_dev_exists | refused_read_only
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.claim_dev_attempts IS 'Append-only audit of every claim-dev (break-glass dev promotion) attempt, successful or not. Dev-only SELECT; written only by claim_dev_attempt(). Repeated refused_* rows mean someone is trying to become a dev — surfaced as a dashboard alert.';

CREATE INDEX IF NOT EXISTS idx_claim_dev_attempts_at ON public.claim_dev_attempts (attempted_at DESC);

ALTER TABLE public.claim_dev_attempts ENABLE ROW LEVEL SECURITY;

-- Dev-only read; NO client write policy (written only by the SECURITY DEFINER RPC, which is owned by
-- postgres and bypasses RLS) — same shape as deleted_records_archive.
DROP POLICY IF EXISTS claim_dev_attempts_select ON public.claim_dev_attempts;
CREATE POLICY claim_dev_attempts_select ON public.claim_dev_attempts
  FOR SELECT USING (public.is_dev());

GRANT SELECT ON TABLE public.claim_dev_attempts TO authenticated;


CREATE OR REPLACE FUNCTION public.claim_dev_attempt(p_user_id uuid, p_code_ok boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_role        text;
  v_read_only   boolean;
  v_archived_at timestamptz;
  v_outcome     text;
BEGIN
  -- Serialise the "is there a usable dev" check against concurrent claims. Fixed key; transaction-scoped.
  PERFORM pg_advisory_xact_lock(hashtext('claim_dev_attempt'));

  SELECT role::text, read_only, archived_at
    INTO v_role, v_read_only, v_archived_at
  FROM public.users WHERE id = p_user_id;

  IF v_role IS NULL THEN
    v_outcome := 'refused_unknown_user';
  ELSIF COALESCE(v_read_only, false) OR v_archived_at IS NOT NULL THEN
    -- Never escalate a frozen or archived account, even in a genuine lockout.
    v_outcome := 'refused_read_only';
  ELSIF NOT COALESCE(p_code_ok, false) THEN
    v_outcome := 'refused_bad_code';
  ELSIF EXISTS (
    SELECT 1 FROM public.users
    WHERE role = 'dev' AND archived_at IS NULL AND COALESCE(read_only, false) = false
  ) THEN
    -- The break-glass gate: a usable dev is available, so use Active Accounts instead.
    v_outcome := 'refused_dev_exists';
  ELSE
    -- No usable dev anywhere: this is the recovery case claim-dev exists for.
    -- Works because we run with auth.uid() NULL (service_role), so users_guard_privileged_columns
    -- early-returns — the same path claim-dev already used, now behind a real gate.
    UPDATE public.users SET role = 'dev' WHERE id = p_user_id;
    v_outcome := 'granted';
  END IF;

  INSERT INTO public.claim_dev_attempts (attempted_by, outcome, detail)
  VALUES (
    p_user_id,
    v_outcome,
    jsonb_build_object('prior_role', v_role, 'code_ok', COALESCE(p_code_ok, false))
  );

  RETURN jsonb_build_object('ok', v_outcome = 'granted', 'outcome', v_outcome);
EXCEPTION
  WHEN OTHERS THEN
    -- Never leak internals to the caller; the edge function renders every failure identically anyway.
    RETURN jsonb_build_object('ok', false, 'outcome', 'error', 'code', SQLSTATE);
END $fn$;

ALTER FUNCTION public.claim_dev_attempt(uuid, boolean) OWNER TO postgres;

COMMENT ON FUNCTION public.claim_dev_attempt(uuid, boolean) IS
  'Break-glass dev promotion for the claim-dev edge function ONLY (service_role-granted; revoked from authenticated). Grants dev only when NO usable dev exists (none unarchived and not read_only) and the caller is neither read_only nor archived. Logs every branch to claim_dev_attempts. Callers must not learn which refusal occurred — a correct-code-but-refused response would be a code oracle.';

-- THE point: not callable by users. Only the edge function (service_role) may invoke it.
REVOKE ALL ON FUNCTION public.claim_dev_attempt(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_dev_attempt(uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.claim_dev_attempt(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_dev_attempt(uuid, boolean) TO service_role;


-- CREATE TABLE ⇒ rerun BOTH read-only sweeps (see CLAUDE.md): the restrictive RLS policies AND the
-- statement triggers added in 20260717000000. The SECURITY DEFINER writer is unaffected (auth.uid() is
-- NULL under service_role ⇒ is_read_only() false).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
