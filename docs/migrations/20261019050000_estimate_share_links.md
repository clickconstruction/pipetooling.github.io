# 20261019050000_estimate_share_links.sql (2026-10-19, v2.5643)

Bills and estimates in a message, PR 3 (punch list #127, the owner's pick B): a second link to an estimate per share, so a link put in a text or an email from the reply box leaves the link in the customer's estimate email working. An estimate keeps only its emailed token's SHA-256 (`estimates.public_token_hash`), so that link cannot be read back, and Resend mints a new one that retires the old; a share gets a token of its own instead.

## What it does

1. **`estimate_share_links`**: the estimate (`ON DELETE CASCADE`), the token's SHA-256 in lowercase hex (`estimate_share_links_token_hash_shape`, unique), who made it (`made_by`, `ON DELETE SET NULL`), when, and the day it stops working (`expires_at`, fourteen days, as the email's). One SELECT policy for `authenticated`: whoever may read the estimate, through the `estimates` policies in a subquery. `anon` holds nothing and `authenticated` only SELECT; the three fence appliers run at the end.
2. **`share_estimate_link(p_estimate_id uuid) → text`**: makes a link for a sent or approved (`customer_accepted`) estimate and returns its token once: 24 random bytes as URL-safe base64, 32 characters, its hash stored as the edge functions compute it. The client builds the URL (`/estimate/accept?t=` on the live app). Refused in words: signed out, a training account, a twin, anyone off the office team (`gc_office_team()`), an estimate not there, and one not sent. SECURITY DEFINER; EXECUTE to `authenticated`, revoked from `PUBLIC` and `anon`.

The three functions that open an estimate from a link (`get-estimate-for-customer`, `accept-estimate`, `log-estimate-option-view`) ask `_shared/estimateTokenLookup.ts` which estimate a hash is: the row's own hash first, then a share's. A shared link stops on its own day, the emailed one on the row's.

## Release order

Merge the PR, deploy the three functions (`bash scripts/deploy-functions.sh get-estimate-for-customer accept-estimate log-estimate-option-view`), then push. The functions read the new table fail-soft (a table not there is no match), so they may go first; the client's share call fails with a toast and leaves `{estimate}` in the box until the push, so no link is made before a function can open it.

## Why the shape

- A table, not a second column: every share is its own link with its own day, and Resend's rotation of the emailed link leaves them all alone.
- Only the hash, as the row keeps the email's: a leaked table opens no estimate.
- The office team only, as the reply box is theirs; a primary's estimate emails are unchanged.

## Verify

Read-only on prod after the push: `select count(*) from estimate_share_links` reads 0 until the office puts an estimate in a message; `select has_function_privilege('anon', 'public.share_estimate_link(uuid)', 'execute')` reads false. The SQL bed `npm run test:pg:estimate-share-links` (CI) walks every step above.
