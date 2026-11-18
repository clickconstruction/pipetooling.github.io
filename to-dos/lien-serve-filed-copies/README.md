---
name: "Lien desk: serve a filed lien — the letter and the copies printed for certified mail, in a batch, the mail numbers in one place"
number: 366
group: close
status: asked and drawn 2026-11-16, the owner picked the same day (the app's own COPY page, the letter live and marked unread, a filing with no recording number held, all four steps) · all four steps are built (v2.7472, v2.7476, v2.7497) and the scanned PDF upload beside them (v2.7480) · several scans at once is built, one file a lien (v2.7524) and one scan of a whole stack (v2.7528), branch claude/lien-scans-2-stack · left: counsel's read of the letter and of the COPY page, and the office's first real run
summary: >
  After an affidavit is filed, § 53.055 has the claimant send a copy of it to the owner, and to the
  original contractor when there is one, by the fifth day. The desk recorded that service one job at
  a time and drew nothing to mail: the office photocopied the stamped paper, wrote a letter in Word
  or sent none, looked up each address, and then opened each job's Lien window to type the day and
  the numbers. Liens are filed in batches, twelve at once on the day this was asked. The answer is
  four steps: a cover letter and a COPY page printed from the job's Lien window, the To do row's
  clock and the Board's last bin split in two, one press that prints every filed lien's envelopes
  with a mail sheet, and one window for every mail number.
next: Counsel reads the letter and says whether the COPY page counts as the copy; the two flags in lienServedCopy.ts turn with the answer. Then the office's first real run is watched: a batch filed, its scans added, its copies printed and mailed, its numbers entered.
size: L as a train of four (M · S · M · M) and M for the scans (S · M), all built; left: S (the flags and the guides once counsel answers)
blocker: Counsel's read of the letter's words, and whether a copy drawn from the record counts as the copy. The presses do not wait on it.
ver: v2.7472 · v2.7476 · v2.7480 · v2.7497 · v2.7524 · v2.7528
---

# Serve a filed lien from the Lien desk (#366)

Mock-up: [`mockup.html`](./mockup.html), served at `/to-dos/lien-serve-filed-copies/mockup.html` on the dev
server. Made-up jobs, names and figures only.

## The ask

The owner, 2026-11-16: "on the lien desk to do page, after we have submitted the liens and put in the tracking
number did we do a good enough job making it easy for office staff to also draft the letter to send to the
customer via certified mail letting them know a lien was filed?"

No. Read at `origin/main` that day:

- **Recording was covered, one job at a time.** *Record filing…* stamps `serve_due` (the fifth calendar day,
  weekend-rolled). To do draws *Lien filed · not yet served* with *Record service*. *Record service…* takes the
  day and, per copy, a certified mail number and a receipt photo (`lienServiceProof.ts`, #314).
- **Nothing drew what goes in the envelope.** No cover letter, no page with the recording number, no envelope
  face. Envelope faces and the label file exist for the notice run only.
- **No batch.** Twelve filed liens under a GC meant twelve windows and twenty-four numbers.
- **The Board's last affidavit bin, *Filed · Served*, is one name for two states.**
- **Docsmit could not carry it.** `mail-send-docsmit` accepts the kind `lien_affidavit_copy`; no screen builds
  or sends one.
- **A filing recorded without its recording number had no place to take it later.**

## The statute, as read

§ 53.055 (as amended effective 2022, read on a mirror dated May 2025; the official page did not load): the person
who files an affidavit must *send a copy of the affidavit* to the owner or reputed owner at the last known
business or residence address, not later than the fifth day after the filing. A claimant who is not an original
contractor also sends a copy to the original contractor, in the same period. The section names no mailing
method and no consequence. § 53.003 allows delivery in person, by certified mail, or by another traceable
service that can confirm receipt, and rolls a last day on a weekend or legal holiday to the next business day.

## The owner's picks (2026-11-16)

| Question | Pick |
|---|---|
| What goes behind the letter | **The app redraws the affidavit, marked COPY**, with the county, the day filed and the document number in a box. It shows no signature, seal or stamp, and the box says so. |
| May the letter print before counsel reads it | **Yes, live now, marked unread**, as the notice's unread paragraphs are. The letter can be unticked and the copy mailed alone. |
| A filing with no recording number | **Held out**, with a door to type the number. |
| How far | **All four steps.** Docsmit for these copies is later. |

## The letter's words

In `src/lib/jobsDocuments/lienServedCopy.ts`, one sentence per fact (`lienServeLetterParagraphs`). The rules it
keeps: it says only what is true of the filing (the county, the day, the document number, the amount, how to
pay and get a release); it makes no threat and gives no advice; it says *affidavit claiming a lien* and never
*a lien*, so the same words are true on a homestead; it never stands in for the copy, which always prints.

To the owner, on a job under a GC:

> [Company] has filed an affidavit claiming a lien on the property named above. A copy of the affidavit is
> enclosed. It is sent to you as the owner or reputed owner of the property, as Texas Property Code § 53.055
> requires.
>
> The affidavit states a claim of $18,450.00 for plumbing labor and materials furnished to improve the property
> under a contract with Brightline Builders, the original contractor.
>
> When the claim is paid, [Company] will sign a release of the claim and of the lien in a form that can be filed
> with the county clerk. To pay, or to ask about the amount, call (512) 555-0142.

- **To the original contractor:** *sent to you as the original contractor*, and *under [Company]'s contract
  with you*.
- **A job contracted with the owner:** one envelope, *under [Company]'s contract with you*.
- **A homestead:** the same words. The copy carries the § 53.254(f) notice first on its page, above the COPY box.

## For counsel

1. Does a page drawn from the claimant's record, with no signature, seal or clerk's stamp, count as *a copy of
   the affidavit* under § 53.055? Until the answer, the screen says the question is open and the guide tells an
   office that wants to be sure to add a photocopy of the stamped paper.
2. The release sentence. § 53.152 has the release furnished within ten days of a written request once the debt
   is paid by collected funds. Is *will sign a release … in a form that can be filed* right as written?
3. On a homestead, should the letter repeat the § 53.254(f) notice, or is the copy's own enough?
4. The address. The letter goes to the mailing address the property record holds today, and the paper's own
   when it holds none. Is that *the last known business or residence address*? Should a copy also go to the
   property when the two differ?
5. The method line reads *By certified mail*. § 53.055 names no method. Keep it, or add *return receipt
   requested*?

When counsel answers, turn `LIEN_SERVE_LETTER_READ_BY_COUNSEL` and `LIEN_SERVED_COPY_READ_BY_COUNSEL` in
`lienServedCopy.ts`; the amber lines leave the screen with them.

## The plan

1. **The letter, the COPY page and the print from one job** (M). **Built, v2.7472.** Kernels
   `lienServedCopy.ts` and `lienServeFacts.ts`; the press `LienServeCopiesPress.tsx` beside *Record service…*
   in the Lien window; the print filed on the job as `lien_affidavit_copy`; a recording number typed on the
   held press.
2. **The clock and the two bins** (S to M). **Built, v2.7497.** The To do row reads *Lien filed · mail its copies
   by <day>*, turns red the day before its day, and says the day a late copy was due (`lienServeClock.ts`). Its
   press is *Mail the copies*. `LIEN_BOARD_WORDS.filed` is *Filed · copies to mail*, and *Served* is a bin of its
   own after it. The bin carries its own press, *Mail N liens' copies ›*, an outline under its chips, because each
   column keeps the one filled print press the owner approved (#8368, under the tiles since v2.7483). Two or more serve rows fold into one row
   with the same press (`lienBinFolds`). Both open `LienServeWindow`. A filed lien with no affidavit on the desk
   still gets a chip, so the bin, the list and the window count the same liens.
   Still to come from the #362 train, not this one: the run window's fourth step for the liens (*Send the
   copies*), which calls `lienServePlan`, `lienServeHolds`, `lienServePapers` and the numbers kernel. Nothing of
   this train is in `LienDeskRunModal.tsx`.
3. **The batch print** (M). **Built, v2.7476, with step 4 as one window.** `src/lib/jobs/lienServePackets.ts`: every
   filed lien that owes its copies (`lienServeJobsFromDesk`), what is held and why (`lienServePlan`), the press
   worded through `batchWords`, the five-day clock in words (`lienServeClock`), and one stack in envelope order
   behind a mail sheet. The window is `LienServeWindow.tsx`, *Filed liens: copies to mail*.
4. **One window for every mail number** (M). **Built, v2.7476.** The same window's bottom half
   (`lienServeNumbers.ts`, `lienServeNumbersIo.ts`): a row per envelope, the day at the top, a scanner's Enter
   moving to the next row, each ticked lien written through `serviceSends` exactly as *Record service…* writes
   it. A lien is recorded only when *Mailed* is ticked; typing a number ticks it.

Steps 3 and 4 shipped as one PR because they are one window: the stack prints at the top and its numbers go in
below. Until step 2 the door is today's row: *Record service* on a serve row opens the window when two or more
filed liens owe their copies, and one alone keeps its own Lien window.

Later, each its own card when asked:

- **Docsmit for these copies.** The server takes the kind today. Two fixes first: `writeTrackingToFilings` marks
  an affidavit served when the first of two pieces mails, and `sendsWithPiece` rebuilds a send without its
  `receipt_url`, which would erase a receipt photo. It also never adds a send row to an affidavit whose `sends`
  is empty.
- **The scan from Drive.** Its own card since 2026-11-17: [#378](../lien-served-copy-is-the-scan.md), where the signed scan becomes the copy and a lien with none cannot print.
- **The letter and the COPY on Settings → What customers see → Lien letters** (#326), beside the affidavit.
- **The Dashboard's card** reads *Record service* and shows from three days out. It could open the desk on the
  batch.
- **A code on the mail sheet** that opens the window on a phone, as the help sheet's *Scan to record* does. It
  needs an address for the window (`/lien-desk?serve=1`).
- **Served, number still owed.** The window lists unserved liens only. A lien recorded with the day alone takes
  its numbers from its own Filings list, as before.

## Verify

- `npx vitest run src/lib/jobsDocuments/lienServedCopy.test.ts src/lib/jobs/lienServeFacts.test.ts src/components/jobs/LienServeCopiesPress.render.test.tsx`
- Live, read only on real jobs: open a job with a filed, unserved affidavit, Lien window, affidavit tab. The
  press sits under *Record service…*. Do not press *Record service* or save a number on a real lien. To see the
  print without a real job, use a `ZZ Test` job as `AGENTS.md` allows and delete it after.

## The scanned PDF of the stamped affidavit (v2.7480)

The owner, 2026-11-16, over a screenshot of *Record the filing* with *Take a photo of the stamped page* circled:
"The option to upload a pdf from the scanned filings would be helpful".

Built for one file and one lien: **Upload the scanned PDF** beside the photo press (`LienFiledScanPress.tsx`, the
rule and the words in `src/lib/jobs/lienScanFile.ts`). The scan goes up as it is into the job's Drive folder under
Sent by us and becomes the filing's saved copy; a filing already recorded takes it from *link the saved copy*.

The owner's answer on a batch (2026-11-16): "we should aim towards one PDF per lien, but if they are all for one
person a user may scan a whole stack". So one window, **Add the stamped scans**, takes either and always ends
with one PDF a lien on that lien's own job: no job's folder holds another job's affidavit.

1. **Several files, one a lien** (S). **Built, v2.7524.** `LienScanBatchWindow.tsx` over `lienScanBatch.ts` and
   `lienScanBatchIo.ts`. Each picked file is matched by the recording number or the job number in its name, else
   by its place, and the line under it says which. The office checks each against the clerk's stamp. Doors: the
   window that mails the copies, and `?scans=1` from the line under the single upload on Record filing.
2. **One stack** (M). **Built, v2.7528.** A picked PDF of several pages is one file for one lien until the office
   presses *It holds several liens: split it*; the app never decides that, since one lien's affidavit can run to
   two sheets. Then every page is shown (`PdfPageCanvas`) with the lien it goes to and that lien's recording
   number, to read against the stamp. A page starts in order and is changed three ways: a lien by hand, *Same
   lien as the page before*, *Not an affidavit*; the pages after it follow (`lienScanStack.ts`). `pdf-lib` cuts
   each lien's pages in the browser when the press saves (`lienScanStackIo.ts`), so the stack is never uploaded
   and the 10 MB limit is each lien's piece. The pieces go through the plan step 1 built. After a save where one
   lien fails, the stack is frozen as it stood: saved pages read *Saved* and the rest keep their liens by hand.

A lien is listed once its filing is recorded. Recording twelve filings is still twelve windows; one table for
that belongs with the run window's *Notarize and file* step on card #362.

The same rule holds a notice's mailed copy: `lienMailedCopyProblem` in `lienMailedCopies.ts` is
`lienScanProblem(file, 'notice')` since v2.7461.
