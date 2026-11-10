---
name: "The lien affidavit says what § 53.054 asks: months, notices, addresses, one claim figure"
number: 305
group: gated
status: asked 2026-11-10 on the line *Work month 2026-08* at the top of the affidavit · the sworn text and its recipe read on main the same day against § 53.054 · eight questions for counsel and the affidavit in redline drawn, nothing built
mockup: to-dos/lien-affidavit-contents/redline.html
summary: >
  The owner asked what *Work month 2026-08* is doing at the top of the Mechanic's and
  Materialman's Lien Affidavit. It is a reference line above the title, outside the sworn text,
  and it names one month as a code. Reading the whole paper against Texas Property Code § 53.054
  found more: paragraph 5 swears a date range and names no month, paragraph 9 swears that notices
  went without saying when or how, paragraph 8 swears three figures that can disagree, paragraph 3
  gives the hiring party no address, paragraph 1 gives the claimant one address, and a property
  where nobody answered the homestead question passes as not a homestead. Each job at a property
  also gets its own affidavit. The page is a redline for the lien attorney with eight numbered
  questions. Sworn text changes only on counsel's word.
next: The owner sends the redline to the lien attorney. Each answer is one small PR. The homestead hold (question 7's first half) changes no sworn text and can ship on the owner's word alone.
size: M as a train of six (S · S · S · S · S · M); the one-affidavit-per-property PR is the M and waits on question 6
blocker: Counsel's answers to the eight questions. The homestead hold needs only the owner's go.
opinion: your call — send the redline to counsel; build the homestead hold now, since a house can reach Ready to file today with the question never asked
---

# The lien affidavit says what § 53.054 asks (#305)

## The ask

The owner, 2026-11-10, looking at a Mechanic's and Materialman's Lien Affidavit from the Lien
desk: *I am seeing "Work Month 2026-08", what are the pros and cons of keeping this on the
liens?* Then: *before we move it can you look at it holistically and let me know if you have any
other suggestions?* Then, on the suggestions, his go to draft the revised affidavit as a before
and after page for his attorney.

Nothing is built. Every statute reference here is the app's reading, not a lawyer's.

## What is there today (read on main, 2026-11-10)

The paper is `buildLienAffidavitBlocks` in `src/lib/jobsDocuments/lienFilingDocuments.ts`. Its
fields come from `buildLienAffidavitFieldsForJob` in `src/lib/jobs/lienNoticeDraft.ts`, which the
desk reaches through `buildLienDeskAffidavitFields` (`src/lib/jobs/lienDeskAffidavitFields.ts`).

- **The top strip.** `refItems` in `LienFilingTabs.tsx` and `lienStopPaperPages.ts` print *Job #*,
  *Work month* and a date above the title. On the affidavit the month is `clock.workMonth`, the
  last month worked, as `YYYY-MM`. The notice prints its months in words (`describeNoticeMonths`).
  The date is the day the paper was drawn.
- **Paragraph 5** swears *from [first day] through [last day]* (`lienWorkSpan`). No month is named.
- **Paragraph 9** is one fixed sentence, printed when `includeNoticesSworn` is true. That is
  `!isSub || noticesRecorded`, so it also prints on a job contracted with the owner.
- **Paragraph 8** swears `revenue`, `paymentsMade` and the unpaid amount. The unpaid amount is the
  desk's `openBalance` (what the sent bills still owe) less the correction. On a job with work not
  yet billed, the first less the second is not the third.
- **Paragraph 3** is the hiring party's name alone. **Paragraph 7** appends the original
  contractor's address only when it is not blank.
- **Paragraph 1** says *located at* one address, the issuer's.
- **Homestead.** `affidavitGates` in `src/lib/jobs/lienDeskAffidavits.ts` holds a property whose
  `homestead` is true. A null reads as *Not a homestead* and passes.
- **One paper per job.** Notices combine jobs at a property (`lienNoticeCombine.ts`). Affidavits do
  not.

## The eight questions

The redline (`redline.html`) puts these to counsel, each tied to its paragraph.

1. **Months of work**, paragraph 5, § 53.054(a)(3). Add a sentence naming each month on a job
   under a GC. Drop the code from the top strip.
2. **When and how each notice went**, paragraph 9, § 53.054(a)(8). List each notice with its
   month, its day and its method. Leave the paragraph out on a job contracted with the owner.
3. **Three figures that can disagree**, paragraph 8. Swear the claim amount alone.
4. **Addresses**, paragraphs 3 and 7. Add the hiring party's last known address. Hold the paper
   while either address is missing.
5. **The claimant's mailing and physical address**, paragraph 1.
6. **One affidavit for several jobs at one property.** Asked, not proposed.
7. **Homesteads.** Hold a property with no answer. Ask what a homestead affidavit needs.
8. **The top and the foot.** Drop the strip, add a return address, move the job number to the
   foot, attach the notices.

## The build, once counsel answers

Each is one PR. None starts before its answer, except PR 1.

1. **The homestead hold** (S). `affidavitGates` treats a null `homestead` as not answered and
   holds the paper, with a press that opens the property record. No sworn text changes. Needs the
   owner's go only.
2. **Months in paragraph 5, the strip gone** (S). Questions 1 and 8.
3. **Paragraph 9 lists the notices** (S). Question 2. The dates and methods are on
   `job_lien_filings.sends`.
4. **Paragraph 8 swears the claim alone** (S). Question 3.
5. **Addresses in paragraphs 1, 3 and 7, and the gate for a missing one** (S). Questions 4 and 5.
6. **One affidavit per property** (M). Question 6, only on a yes.

## Decisions that are the owner's

- **Send the redline to counsel?** The pick: yes, as it stands.
- **Build the homestead hold before counsel answers?** The pick: yes. It only makes the desk
  stricter.
- **Keep the letterhead on a recorded paper?** Counsel's answer to question 8 decides.
