# 20261120133000_person_paper_reminders.sql (2026-11-19, v2.8013)

Reminders by email for a staff or sub paper that waits on a signature (punch list #376, *What is left*, row 1). A job's contract has had three reminders, three days apart, since v2.2690. This is the ground for the same three on a person's paper.

## What it makes

No table, so no fence call. Every statement is safe to run twice.

- **Four columns on `person_contract_documents`.** `reminders_enabled` (the paper's own switch, on by default), `reminder_count` (0 to 3, held by the check `person_contract_documents_reminder_count`), `next_reminder_at` and `last_reminded_at`. The address a reminder goes to is `signer_email`, which a send has kept since v2.7986.
- **A partial index**, `person_contract_documents_reminder_due`, on `next_reminder_at` for the papers that are out. The timed function reads it each hour.
- **One `app_settings` row**, `person_paper_reminders_v1`, seeded `'0'`: off. An update policy on that one key lets the owner and a dev change it (`is_master_or_dev()`), as the other owner-set keys have.
- **One pg_cron job**, `person-paper-reminders`, hourly at `:37`. It posts to `remind-person-papers` with the cron secret, the way `job-contract-reminders` posts at `:23`.

## Rules it settles

- **It ships off.** The function answers `{ skipped: 'off' }` while the switch is off, so the schedule sends nothing by itself.
- **Turning it on reaches no paper already out.** A send reads the switch and sets `next_reminder_at` only while it is on. A paper sent while it is off has none, and is never reminded unless it is sent again.
- **The paper's own switch is a plain write to its row**, under the table's existing policies: the four roles that send a paper. The read-only, twin and archived fences stand.
- **Existing rows** get `reminders_enabled = true`, `reminder_count = 0` and no next reminder. Nobody is emailed about an old paper.

## Order

Push this before `send-contract-for-signature` and `remind-person-papers` are deployed: the send now reads `doc_type` and `reminders_enabled` and writes the reminder columns. The old client and the old function do not read the new columns, so the push is safe ahead of both.

## Applied

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274); types regenerated in #9252.
