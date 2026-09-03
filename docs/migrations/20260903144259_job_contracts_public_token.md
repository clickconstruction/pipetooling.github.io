# 20260903144259_job_contracts_public_token.sql (2026-09-03, v2.2681)

**Contract Desk PR 2** — adds `job_contracts.public_token text` (partial unique index where not null). The customer's signing link is durable: `send-job-contract` mints the plaintext token on the first send and reuses it on every resend (refreshing `public_token_expires_at` to 90 days out); Void & redo moves the token to the replacement draft so a bookmarked link keeps working. Plaintext storage follows `bid_proposal_rooms.public_token` and the portal-links precedent; PR 1's `public_token_hash` stays unused for now.

Additive `ADD COLUMN IF NOT EXISTS` — metadata-only. **Push before deploying the three edge functions** (`send-job-contract` / `get-job-contract` / `sign-job-contract` all read the column); the v2.2681 client only calls them through the Contract modal, which stays harmless until then.
