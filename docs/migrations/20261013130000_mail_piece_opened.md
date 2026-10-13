# 20261013130000_mail_piece_opened.sql (2026-10-13, v2.5382 — the Docsmit train PR 4)

The owner read it (`docs/DOCSMIT_LIEN_RUN_PLAN.md`, *The owner read it*). The owner's mailed copy carries a QR whose link is the bill's pay page with the piece's short code (`?m=CODE`, `src/lib/mail/windowEnvelope.ts`). The pay page is public, so the open is recorded through one function callable without a sign-in.

## What it does

1. **`mail_piece_opened(p_code text) → boolean`**, `SECURITY DEFINER`: the first call with a piece's `short_code` stamps `mail_pieces.opened_at` and appends an `opened` event; later calls, a code that matches nothing, or a string that is not a code (6–16 letters and digits) change nothing and answer `false`. Nothing about the piece comes back.
2. Executable by `anon`, `authenticated` and `service_role`; revoked from `PUBLIC`.

No table, so no fences. Idempotent (`CREATE OR REPLACE`). Needs `mail_pieces` (`20261013120000`), so it sorts after it. Apply with `supabase db push` after the PR merges.
