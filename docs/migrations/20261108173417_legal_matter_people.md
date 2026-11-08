# 20261108173417_legal_matter_people.sql (2026-11-08, v2.6705)

Punch list #174, PR 1 (`docs/recent-features/v2.6705.md`): the people on a legal matter and the proceedings beside the claim. Both tables land in this one migration, so PR 2 (the proceedings' list and the firm's read) needs no second push.

- `legal_matter_people` — name, role (`customer · president · billing · field · owner · tenant · inspector · agency · supplier · counsel · witness · other`), organization, email, phone, mailing address, `use` (`letters · copies · never`), reason, `seeded_from` (`customer · contact_person · property`, null when typed), who and when, `removed_at`. Office `SELECT` (`legal_office_can_read()`), nothing for `anon`.
- `legal_matter_proceedings` — kind (`agency_complaint · records_request · bond_claim · permit · other`), title, agency, reference, `person_id` (one of the matter's people), status (`open · answered · closed`) and `status_on`, note, `document_ids` (live Evidence rows of the same matter), `keep_out` (default true), who and when, `removed_at`. Same policy.
- `legal_matter_ensure_open(payer_key, customer_id, payer_name, job_ids)` — the `legal_answer_gap` ensure as one helper (the matter made when the account has none, jobs only added, closed refused), granted to no API role; the writers below call it.
- `legal_matter_person_save` (add or edit; a *never* needs its reason), `legal_matter_person_remove` (kept with `removed_at`), `legal_matter_people_seed` (a jsonb array of rows the desk computed off the record; a name and email already on the matter is skipped), `legal_proceeding_save` (the contact must be one of the matter's people, each document one of its live Evidence rows), `legal_proceeding_remove` — each `SECURITY DEFINER` behind `legal_office_can_read()`, granted to `authenticated`.
- The four fences close both tables.

**Order:** push right after PR 1 merges (the client calls the tables and the RPCs by name; `check:calls-ahead` labels the PR). PR 2 redeploys `legal-portal` after this push. Regenerate types afterwards (`npm run gen-types:linked`, its own chore PR).

**Applied** to prod by 2026-11-08, read the same day through the dev seat's `check_migration_ledger`: 1166 versions applied against the 1166 files on `main`, this one among them (`npm run check:migration-drift` could not reach the database from this worktree — the IPv6-only path — so the ledger was the read).
