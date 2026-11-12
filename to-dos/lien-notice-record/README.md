---
name: Lien affidavit — the notice record and copies of what was sent
number: 322
group: close
status: built 2026-11-12 on claude/lien-affidavit-sent-fact-sheet-50e7f9 · left: the first real print by the office, then delete the folder
summary: >
  When a short-form lien affidavit prints, a notice record prints in front of it: each § 53.056 notice on the job, who
  each copy went to, the day, the method and the certified mail number, the paper's sentences 5 and 6 read against the
  record, and what the record is missing. Behind it prints a copy of each notice, with its delivery record at the top.
  None of it is filed with the clerk or kept in the job's saved copy.
next: The office prints one real affidavit with two notices behind it and reads the pages against the job. Then delete the folder.
size: M
blocker: The first real print.
opinion: build — it is built; the walk is the office's
---

# Lien affidavit: the notice record and copies of what was sent (#322)

## The ask, in the owner's words

2026-11-12, after printing a lien affidavit with its help sheet:

> If the two notice dates are not broken, I would like to add to the packet a fact sheet of what we've sent and the
> details like certified mail details as a part of that print out so if an attorney or team member is looking at it
> they can be 100% sure what they are sending is correct.

Sentence 6 of that paper read *Notice of the claim was sent to the owner by certified mail on* one day *and* a second
day. That is by design: the job has two § 53.056 notices on record. The help sheet said **Ask first**. Nothing on the
packet laid out what went, when, to whom, by what mail number and for which months.

Two more words from her the same day, each after seeing a draw of the page:

> I don't want to see this section of the notice, I want to see copies of what was sent

(about a table that listed each sworn month with its last day to mail), and then, of the copy page:

> I love this, put the delivery record at the top and a big checkmark on the left of the delivery record and the
> number of days ago so a user at first glance can see how long ago it was sent and what was sent

## What was found

- Everything the page needs is already on the job. Each notice is a `job_lien_filings` row of kind `notice_53_056`
  with its months (`months_covered`), its amount (`amount`, and `printed_claim` when one paper stood for several
  jobs), whether it was entered after the fact (`by_hand`), a saved file (`document_url`, `document_note`), the
  notice's own words as recorded (`fields`), and `sends`: one entry for each copy with `recipient`, `method`,
  `tracking`, `sent_on`, and sometimes `receipt_url`. **No schema change and no edge function.**
- The affidavit's sentences 5 and 6 are filled from those same rows (`lienAffidavitNotices.ts`,
  `lienAffidavitSwornMonths`). The help sheet's **Ask first** comes from `lienAffidavitNoticeCheck`.
- The record does **not** keep the address each envelope went to. The page says so and guesses nothing.
- The Lien window reads every filing on the job, voided ones too. The Lien desk reads only the ones that are not
  voided. So the page counts voided notices where it can see them and never draws one.
- The cover sheet ran onto a second page whenever an **Ask first** band was on it.

## The decision

Mock-up: [`mockup.html`](./mockup.html), drawn by the app's own print code with made-up data.

1. **Its own page, in front of the paper.** Order: help sheet, notice record, copies of the notices, the paper. The
   record and the copies are help pages: a striped top edge, *do not file this page*, and they are in no job's filed
   copy. Behind the paper was rejected: a page stapled behind the paper rides to the clerk.
2. **One row for each copy mailed**, grouped under its notice. The notice's line gives its months, its amount, the day
   it was entered and whether a copy of the paper was saved. A copy the record lacks is a row that says *No copy on
   record*. A certified copy with no number says *No number on record*.
3. **No table of the months.** The first draw had one, with each month's last day to mail and how late each copy
   went. The owner asked not to see it. The page keeps the help sheet's own lines under **Ask first**, which name the
   months that do not stand. The kernel still works the months out (`LienNoticeRecord.months`), because those lines
   come from them.
4. **Copies of what was sent.** Behind the record, a page for each notice: its delivery record at the top (a big
   check, *Sent 51 days ago*, what went, and a line for each envelope), then the notice's own form with the words its
   row keeps, COPY across it. A copy is drawn from the record and says so. It does not show the invoices that rode
   behind the notice.
5. **The paper against the record.** Sentence 5's months and sentence 6's days are read against the rows and marked
   ✓ or !. Two notes can sit beside them: a month the notices name that the paper leaves off, and a month of the
   job's work no notice names.
6. **Missing from the record** lists what the office can add: a copy with no number, no copy to the contractor, no
   saved file, one number typed on both copies. It says where to add it.
7. **Its own tick box**, *Print the notice record*, under *Print the help sheet first*. Both start ticked. The help
   sheet teaches a signer; the record is what a reviewer checks. Either prints without the other.
8. **The batch** (the Lien desk's **Print N for notarization**) prints a block for each paper, several to a page, in
   front of the whole stack and numbered as the batch sheet's rows. Never between two papers. Copies of the notices
   are a third box there, *Add a copy of each notice*, which starts **unticked** and says how many pages it adds: a
   batch has many notices behind it, and a run's packet once reached 154 pages.
9. **A job contracted with the owner** owes no monthly notice: no box, no record, and one line in a batch block.
   **A paper on the earlier form** has none either: the page is written for the short form's two sentences.

## Is this the best we can do?

Mostly, and here is where it is not.

- **A copy is a redraw, not a scan.** It is the form with the words the app kept when the notice was recorded. For a
  notice entered after the fact (`by_hand`) those words were typed in afterwards, so the page says the paper that went
  is the saved copy. The truest copies are the page kept in Documents (`sent_documents`, since 2026-10-05) and the
  file saved to Drive. A print cannot pull either in today: the first is stored HTML that would have to be read from a
  private bucket and laid into another document, the second needs a server function. **Not built. A later idea**, and
  the second would need an edge function, so it is a card of its own.
- **No envelope address.** The record never kept it. Keeping it from now on is a small change to what a send writes;
  it would say nothing about notices already mailed. **Not built.**
- **The cover sheet's overflow is fixed only when the record prints.** With the record behind it, the sheet's notices
  line shrinks to a pointer (*The notice record on the next page shows each one*), and a sheet with **Ask first** fits
  one page again. With the record box unticked the sheet is as it was, and a blank-county sheet with **Ask first**
  still runs onto a second page. **Named, not fixed.**
- **The big check means "a copy went on a day the record holds".** A notice with one copy missing still shows the
  check, with the missing copy on its own line in bold beside an exclamation mark. A check that waited for both copies
  would hide that the owner's did go.
- **The attorney gets the print only.** The same facts in the legal portal or an email to counsel is a later idea.

## Where it plugs in

| What | Where |
|---|---|
| The record: notices, months, the two sentences, gaps | `src/lib/jobs/lienNoticeRecord.ts` (new, pure) |
| The pages: one paper, the copies, a batch | `src/lib/jobs/lienNoticeRecordSheet.ts` (new, pure) |
| The cover sheet's pointer and feet | `lienHelpSheet.ts` (`LienHelpExtras.recordFollows`) |
| The batch's blocks and copies | `lienAffidavitBatch.ts` (`lienAffidavitBatchNoticeRecords`, `…NoticeCopies`, `lienAffidavitPrintRun`) |
| The tick boxes | `src/components/jobs/lienHelpSheetChoice.ts` |
| The Lien window's print | `printDoc` in `LienFilingTabs.tsx` |
| The batch print | `printReadyAffidavits` in `LienDesk.tsx` |

## The plan

One PR. The kernel, the pages and both prints are one change: the pages are of no use without a press that prints
them, and the tick boxes would be dead without the pages.

## How to verify

- Unit: `lienNoticeRecord.test.ts`, `lienNoticeRecordSheet.test.ts`. Render: `LienFilingTabs.helpSheet.render.test.tsx`,
  `LienDesk.render.test.tsx`.
- The print for real: a local dev server from the shell, the installed Chrome through Playwright, signed in at
  `/dev-login`, every non-GET refused. Keep the real print window; override only its `print` and take the page at that
  moment. Count pages from a PDF with each box on and off, for a job with one notice and a job with several.

## Where it stands

Built and merged with its mock-up. Left: the office's first real print. A page count on real jobs is in the fragment.
