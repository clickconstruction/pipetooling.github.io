SET lock_timeout = '3s';

-- Contract Desk PR 2: the durable link. The customer's link must survive
-- resends and revisions ("nothing ever 404s"), so the token is stored in
-- plaintext like bid_proposal_rooms.public_token / customer_portal_links —
-- the first send mints it, every later send reuses it and refreshes the
-- expiry, Void & redo moves it to the replacement draft. public_token_hash
-- (PR 1) stays for a future hashed mode; unused for now. Idempotent; additive.

ALTER TABLE public.job_contracts
  ADD COLUMN IF NOT EXISTS public_token text;

CREATE UNIQUE INDEX IF NOT EXISTS job_contracts_public_token_idx
  ON public.job_contracts (public_token) WHERE public_token IS NOT NULL;

COMMENT ON COLUMN public.job_contracts.public_token IS
  'Plaintext capability token for /contract/sign?t=… (bid-room precedent). Minted by send-job-contract on first send; reused by every resend; moved to the replacement draft on Void & redo.';
