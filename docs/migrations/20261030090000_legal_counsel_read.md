# 20261030090000_legal_counsel_read.sql (2026-10-30, v2.6173)

Punch list #218, direction C, PR 2: the attorney's read of how a case tries, in place of the settlement floor v2.6170 retired.

- `legal_set_counsel_read(p_matter_id, p_tries, p_why, p_cost_to_try, p_months)` — office roles (`legal_office_can_read`). `p_tries` is `easy` or `hard`; the costs to try it are a dollar amount under a million or null; the months to a judgment 0–120 or null; the why under 2,000 characters. Refused once the matter is closed. Writes one `legal_matter_entries` row of kind `note` with `meta.read = { tries, why, cost_to_try, months }` and the body *How this case tries: hard. Costs to try it $2,800.00. 9 months to a judgment. <why>* — the same entry `submit-legal-portal` writes for the firm's own read (kind `read`), so the firm sees the office's read on its portal and the note trigger emails it. The current read is the latest one not undone (`_shared/legalCounselRead.ts`); `legal_void_entry` is the way back.
- No table, no column, no new entry kind: the read is an entry, so it travels, prints and undoes like any note.

**Apply order:** additive. Push it right after the PR merges, then deploy `submit-legal-portal` (the firm's `read` act). Before the push the desk's *Save the read* answers with the RPC's missing-function refusal and nothing else changes. `SET lock_timeout = '3s'`.
