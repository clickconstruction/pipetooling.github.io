# 20261006140000_legal_settlement_floor.sql (2026-10-05, v2.4643)

Punch list #85, item 20: settlement authority as a threshold (the owner's decision of 2026-10-05).

- `legal_matters.settlement_floor_amount numeric` and `settlement_floor_pct numeric`, nullable, with `legal_matters_settlement_floor_check`: amount > 0, pct in (0, 100], never both. Both null = no floor: the firm settles freely.
- `legal_set_settlement_floor(p_matter_id, p_amount, p_pct)` — office roles (`legal_office_can_read`). Sets one floor or clears both, and writes a `note` entry (*Settlement floor set: …*) so the firm sees the change.
- `legal_answer_settlement(p_entry_id, p_signed_off, p_note)` — office roles. Takes a firm `question` entry with `meta.flavor = 'settlement'` that is still open; writes the office's `answer` (`meta.askId`, `meta.signedOff`; the existing answer trigger emails the firm), acknowledges the ask, and on a sign-off moves the stage to `settled` (only while `closed_at` is null, and without closing it, per item 16) with a step entry carrying the amount.

**Apply order:** additive. Push it right after the PR merges, then deploy `submit-legal-portal` and `legal-portal`. The old client and functions read `legal_matters` with `select('*')` and ignore the columns; the new functions read a missing column as no floor, so either order is safe. `SET lock_timeout = '3s'`; the CHECK is added in a `DO` block that skips when it exists.
