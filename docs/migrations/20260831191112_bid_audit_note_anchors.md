# 20260831191112 — bid_audit_notes question anchors (v2.2535)

Two nullable columns on `public.bid_audit_notes`:

- `sheet_ref text` — plan-sheet anchor for twin questions (e.g. `P2.1`).
- `context text` — the twin's why-I'm-asking: what it saw and what rides on
  the answer.

Additive + idempotent (`ADD COLUMN IF NOT EXISTS`); all existing rows and
human-authored notes stay NULL, and the Audits card renders the anchors only
when present, so old clients and old rows are unaffected. No RLS changes —
the columns ride the existing row policies (twins may INSERT them on their
`question` rows; nothing new is writable). Twin convention documented in
`docs/twins/FEEDBACK_LOOP.md` step 3.
