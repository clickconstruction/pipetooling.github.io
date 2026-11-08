# 20261108220804 — gc_trade_files_note (v2.6746)

Punch list #205, row 3 (PR 4): a trade partner company's **Send Click a file** from its portal, a photo or a ticket that belongs to no record, with a one-line note as its name. The file lands in the job's Drive folder under Team only → From trades → the company, and its `gc_trade_files` row carries `purpose = 'note'`.

- Widens `gc_trade_files_purpose_known` to `('submittal', 'change', 'quote', 'waiver', 'coi', 'note')`, the P5b migration's way (drop, add `NOT VALID`, validate), so the check never scans the table under a lock.
- Nothing else: no table, so no fence calls; `gc_trade_files_job_or_company` already holds a `note` file to a project.

Deploy order: push this **before** `submit-gc-trade-portal` is deployed, since the function writes the new purpose; the client ships first (it reads a slice with no `files` as no block, and a refused write says so). Then deploy `submit-gc-trade-portal` and `gc-trade-portal`.
