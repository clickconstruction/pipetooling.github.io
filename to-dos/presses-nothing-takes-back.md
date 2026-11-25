---
name: "Presses nothing takes back: the standing list"
number: 443
group: gated
status: standing list opened 2026-11-24 on the owner's word of that day · two rows, both on the Lien desk and the job's Lien window · nothing is built and no build is approved
summary: >
  Every press a walk or a thread meets that nothing takes back, one row each: what was pressed, on which
  screen, what it left, and what would take it back. The owner asked for the note on 2026-11-24, when he
  approved ZZ Test rows for anything in the app even where a press cannot be revoked. Building the
  take-backs is a later decision, and each would be a card of its own.
next: Add a row each time a walk or a thread reports such a press. When the owner says to build, each take-back becomes a card of its own and its row here names it.
ask: owner · decide · Say when the take-backs on this list may be built, and which comes first.
size: a standing list · each take-back is sized on its own row
blocker: The owner's go to build. Adding a row waits on nothing.
mockup: not required — a standing list of presses, no screen
pointer: true
---

# Presses nothing takes back (#443)

## The ask

The owner, on 2026-11-24, giving a standing yes for test rows:

> I approve making zz tests for anything in the app even if it is currently un revocable (But whenever we
> encounter something unrevocable, I would like to make a note to later add it revocable, even if it's a
> setting in settings for the dev user)

This card is that note. It is one list, kept in one place, so the same press is not written down on six cards.

## What counts

A press belongs here when all three are true.

1. A person, or the dev seat, can do it on a ZZ Test row.
2. It leaves a record behind.
3. No screen and no seat verb puts things back as they were.

A press with an **Undo**, a **Take back** or a delete does not belong here. A record that a trigger or a
ledger writes by design, such as a line on a job's Activity, is listed only when it gets in a walk's way.

## How to add a row

Read the code before writing a row. A report is that session's account, and a take-back may exist that
the walk did not find. Each row says who reported it, the day, and what was read to check it. Use ZZ Test
rows, ids and counts only. Name no real customer, job, address or amount.

## The list

| # | What was pressed | Where | What it left | What would take it back | Size | Reported |
|---|---|---|---|---|---|---|
| 1 | A § 53.056 notice recorded by hand: **Record it…**, the by-hand form, then save. The dev seat's `apply_notice_by_hand` writes the same row. | Lien desk, Notices, the job, *Months on this job*. The job's Lien window has the same door (`LienNoticeByHandPane`). | One `job_lien_filings` row, which counts as a live notice for its months until it is voided. One line on the job's Activity as well, written by the trigger `job_lien_filings_to_activity_ins` on the insert. | A delete for the dev on a by-hand record of a ZZ Test job, as a press on the record or as a seat verb, that takes its Activity line with it. The table already lets a dev delete (`job_lien_filings_delete_dev`). No screen and no verb calls it. | S for the delete alone, no migration. The Activity line makes it M if the line is to go too. | The #415 thread, 2026-11-24. Checked the same day: no `.delete()` on the table anywhere in `src/`, no seat verb for it, and the trigger fires on insert only. |
| 2 | **Void** on a filing, then **Confirm void**. The toast reads *Record voided.* **Take it back** on *Back from the clerk* does the same write. | A job's Lien window, the record's own line on its tab (`LienFilingTabs`). | `voided_at` set on the filing, and the record leaves the tab's list. Where a desk paper was tied to it, the database puts that paper back on the Lien desk in the same step. The Activity line of row 1 stays, and nothing on the Activity says the record was voided. | A press for the dev that puts the record back: clear `voided_at`, and where a paper was tied, undo what the void did to that paper. The second half is why this is more than one write. A line on the Activity that says the record was voided would close the other gap. | M, likely a migration beside `job_lien_filing_void_restores_paper` | The #415 thread, 2026-11-24. Checked the same day: `voidLienFiling` writes `voided_at` only, and nothing in `src/` clears it on a filing. |

Row 2 has one exception, and it is not a gap. A line that applied a paper already on record reads **Undo**
in place of **Void**, and its notice goes back on the desk (v2.7508).

## What sits on prod because of these

- Two § 53.056 notices recorded by hand on the ZZ Test job of #415's walks, for one closed month, with notes
  that start *ZZ TEST*. Both were voided on 2026-11-24 by the #415 thread, once its walks no longer needed
  them. No desk paper was tied to either, so the void moved no paper. They stay in the table as voided
  records, because of row 1.
- Two lines on that job's Activity, one for each record, each saying a lien notice went out by hand. Both
  records are voided and both lines still stand, because of row 2.

## When a take-back is built

Its row gets the card's number or the version that shipped it, and stays on the list struck through until
the rows it left on prod are cleaned up. A take-back may be a press on the record for the dev, or a
switch in Settings that only the dev sees, as the owner's words allow.
