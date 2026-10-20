# 20261014130000_mail_piece_resolved.sql (2026-10-13, v2.5487 — the Docsmit train 6b-3)

The doors on an envelope that came back (`docs/DOCSMIT_LIEN_RUN_PLAN.md`, *Delivery drives the desk*): three nullable columns on `mail_pieces`.

## What it does

1. **`resend_of uuid`** → `mail_pieces(id)`: the piece this one answers — a plain First Class copy or a re-mail to another address made by `mail-send-docsmit` `resend`.
2. **`resolved_at timestamptz`**, **`resolved_note text`**: when and how the office answered the envelope (`resend` sets them on the old piece; `resolve` records a courier or a hand delivery). The desk's *needing you* rule (`mailPiecesNeedingYou`) leaves a resolved piece out, so the Do now row clears.
3. A partial index on `resend_of`.

Additive, idempotent (`ADD COLUMN IF NOT EXISTS`); no new table, so no fences. Apply with `supabase db push` after the PR merges (`--include-all` if the stamp sorts before an applied one); redeploy `mail-send-docsmit` and `mail-poll` after it (`PIECE_COLUMNS` reads the three).
