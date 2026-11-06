# 20261106020000_evidence_counsel_only.sql (2026-11-06, v2.6554)

PR 2 of punch list #269: a piece of evidence the office keeps for counsel alone, inside the HR file and labelled so.

- `person_file_evidence.counsel_only boolean NOT NULL DEFAULT false`, set on insert (no update path, like everything on the file; to lift it, file the record again).
- `request_is_dev_seat()`: whether the request carries the `X-Dev-Seat` header the dev seat sends on every PostgREST, storage and function call. `evidence_is_counsel_only(uuid)` (definer): the flag past RLS, so a policy on the files can ask.
- Two restrictive policies, `person_file_evidence_counsel_only_seat` and `person_file_attachments_counsel_only_seat`: a counsel-only record and its files are refused to the seat. The agent's `hr_agent reads person file attachments` policy becomes `evidence_id IS NULL OR NOT evidence_is_counsel_only(evidence_id)`; the agent has no policy on the records themselves.
- `person_counsel_only_count(p_person_id)` (definer, devs): how many a person's file holds, never a row, so `get_person_file` names the hold.
- `dev_person_evidence_write` re-made as v2.6544 left it plus `p.counsel_only`, echoed in the dry run and written on the row.

**The limit**, said in `docs/HR_FILES.md` too: the seat identifies itself by a header. A dev signed in as themself, or any client that runs the seat's code without the header, reads the row. The flag binds the agent as deployed and Drive; it is not a second password.

No table is created, so no fence is owed. Deploy order: push, then deploy `hr-evidence-drive` and `dev-mcp` (server 0.27.0).
