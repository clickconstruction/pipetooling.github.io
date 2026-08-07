SET lock_timeout = '3s';

-- Share-a-job Phase 2 (v2.1453): tokenized public share links so a texted job
-- link unfurls as a rich iMessage/OG preview card. The client mints a random
-- 128-bit token per share, stores ONLY its sha256 hex here (same
-- raw-token-in-URL / hash-in-DB pattern as estimates.public_token_hash), and
-- shares the job-share edge function URL carrying the raw token. The function
-- (service role) hashes the incoming token, joins jobs_ledger, and serves OG
-- meta tags (job #, name, address, status + Street View image) plus a
-- redirect into /jobs?jobDetail=<id> for human taps.
--
-- The OG card intentionally exposes ONLY job #, name, address, and status to
-- whoever holds the link (link previews are fetched unauthenticated). The
-- app itself stays behind login/RLS — the link grants no access.

CREATE TABLE IF NOT EXISTS public.job_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

COMMENT ON TABLE public.job_share_links IS
  'Share-a-job public link tokens (v2.1453). One row per share action; token_hash is sha256(raw token) — the raw token lives only in the shared URL. The job-share edge function resolves tokens (service role) to serve OG preview tags limited to job #/name/address/status and redirect into the app. revoked_at is the per-link kill switch.';

CREATE INDEX IF NOT EXISTS idx_job_share_links_job ON public.job_share_links (job_id);

ALTER TABLE public.job_share_links ENABLE ROW LEVEL SECURITY;

-- Insert: any signed-in user, for themselves, for a job their own RLS lets
-- them see (the jobs_ledger subquery runs as the caller, so its policies do
-- the "can they see this job" gating).
DROP POLICY IF EXISTS "Users mint share links for jobs they can see" ON public.job_share_links;
CREATE POLICY "Users mint share links for jobs they can see" ON public.job_share_links
  FOR INSERT WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_id
    )
  );

DROP POLICY IF EXISTS "Creators and devs read job share links" ON public.job_share_links;
CREATE POLICY "Creators and devs read job share links" ON public.job_share_links
  FOR SELECT USING (
    created_by = (SELECT auth.uid())
    OR public.is_dev()
  );

-- Update is revocation only in spirit; creators and devs may touch their rows.
DROP POLICY IF EXISTS "Creators and devs revoke job share links" ON public.job_share_links;
CREATE POLICY "Creators and devs revoke job share links" ON public.job_share_links
  FOR UPDATE USING (
    created_by = (SELECT auth.uid())
    OR public.is_dev()
  );

DROP POLICY IF EXISTS "Creators and devs delete job share links" ON public.job_share_links;
CREATE POLICY "Creators and devs delete job share links" ON public.job_share_links
  FOR DELETE USING (
    created_by = (SELECT auth.uid())
    OR public.is_dev()
  );

-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
