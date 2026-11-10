---
name: "The lien affidavit, cut to what § 53.054 lists: a short form for counsel"
number: 305
group: gated
status: asked 2026-11-10 on the line *Work month 2026-08* at the top of the affidavit · the sworn text and its recipe read on main the same day against § 53.054 · the owner's lens the same day, the minimum the law requires, short and sweet · a short form drawn for counsel with five questions, nothing built
mockup: to-dos/lien-affidavit-contents/redline.html
summary: >
  The owner asked what *Work month 2026-08* is doing at the top of the Mechanic's and
  Materialman's Lien Affidavit, then asked for the whole paper to be read, then set the lens: the
  minimum required by law, short and sweet. Read against Texas Property Code § 53.054(a), today's
  ten paragraphs may be short on four of the statute's eight items on a job under a GC (no months,
  no address for the hiring party, one address for the claimant, no date or method for the
  notices) and carry five things the statute does not list. The page for the lien attorney maps the
  eight items to a short form of seven paragraphs, four on a job contracted with the owner, and
  asks five questions. A property where nobody answered the homestead question passes today as not
  a homestead. Sworn text changes only on counsel's word.
next: The owner sends the page to the lien attorney. The short form is one PR on counsel's yes. The homestead hold changes no sworn text and can ship on the owner's word alone.
size: M as a train of four (S · M · S · M); the one-affidavit-per-property PR waits on question 5
blocker: Counsel's answers to the five questions. The homestead hold needs only the owner's go.
opinion: your call — send the page to counsel; build the homestead hold now, since a house can reach Ready to file today with the question never asked
---

# The lien affidavit, cut to what § 53.054 lists (#305)

## The ask

The owner, 2026-11-10, looking at a Mechanic's and Materialman's Lien Affidavit from the Lien
desk: *I am seeing "Work Month 2026-08", what are the pros and cons of keeping this on the
liens?* Then: *before we move it can you look at it holistically and let me know if you have any
other suggestions?* Then, on the suggestions, his go to draft the revised affidavit as a before
and after page for his attorney. Then the lens: *I want to do the minimum required by law, short
and sweet.*

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

## The lens: the minimum the law requires

§ 53.054(a) lists eight things, as the app reads it. The page maps each to a paragraph.

| § 53.054 | Must contain | Today | Short form |
|---|---|---|---|
| (a)(1) | the amount of the claim, sworn | ¶ 8 | ¶ 7 |
| (a)(2) | the owner's name and last known address | ¶ 6 | ¶ 4 |
| (a)(3) | the kind of work; for a sub, each month | ¶ 4, no months | ¶ 2 and ¶ 5 |
| (a)(4) | the hiring party's name and last known address | ¶ 3, no address | ¶ 3 |
| (a)(5) | the original contractor's name and last known address | ¶ 7 | ¶ 3 |
| (a)(6) | the property, legally sufficient to identify it | ¶ 2 | ¶ 2 |
| (a)(7) | the claimant's name, mailing address and, if different, physical address | ¶ 1, one address | ¶ 1 |
| (a)(8) | for a sub, the date and method of each notice to the owner | ¶ 9, neither | ¶ 6 |

Five things on today's paper are on no line of that list and go: the letterhead and the reference
line, the first and last day of work, the contract amount and the amount paid, the general
sentence about notices, and *together with all interest, costs, and attorney's fees allowed by
law*. The *BEFORE ME* opening and the jurat both stay.

The first draft of this page (eight questions, a redline that added to the paper) also proposed a
return address, the job number at the foot, the notices as an exhibit and the certified mail
numbers. None is required, so none is in the short form.

## Checked against the statute's own text (2026-11-10)

The owner asked whether too much came out. § 53.054 was read in full that day: subsection (a) is
the eight items above, to be contained *substantially*; (b) lets the claimant attach the contract
and each notice; (c) says items of work need not be listed. Nothing on the list was cut. Outside
that section the paper must be sworn with a jurat (kept), must meet the clerk's format rules in
Local Government Code § 191.007 (a heading at the top of the first page and a name printed under
each signature, or that page pays twice the fee; never a refusal), and on a homestead must carry
the § 53.254(f) notice (the desk holds every homestead today). Two details went onto the short
form from this pass: the county under STATE OF TEXAS is the county where the affidavit is signed,
where today's paper prints the property's county, and a line for the notary's printed name.

## The opening and the notary's block (2026-11-10)

The owner asked for the *BEFORE ME* opening back, to keep the notarial language. The Secretary of
State's sample forms (September 2019) were read that day. The sample **jurat** is *State of Texas ·
County of ___ · Sworn to and subscribed before me on the ___ day of ___, (year), by (name of
signer)*, the seal and the notary's signature, and nothing more; `src/lib/legal/juratWords.ts`
already prints it. The *Before me … personally appeared … being by me first duly sworn* wording is
the sample **verification**, so it is recognised notarial language, though the jurat stands
without it. The opening stays. The first short form on the page had also dropped the jurat's own
venue lines, which today's paper prints blank for the notary; they are back. The one change to the
notary's side is the county above the opening: today it prints the property's county, and the short
form leaves it blank for the notary as the jurat's already is.

## The homestead version

Drawn on the page: the § 53.254(f) notice, *NOTICE: THIS IS NOT A LIEN. THIS IS ONLY AN AFFIDAVIT
CLAIMING A LIEN.*, at the top of the page above the title, in bold at 12 point against the
statute's 10. Nothing else on the affidavit changes. § 53.254(a) to (e) are about the contract
(written, signed before work, both spouses, recorded) and (g) about the notice to the owner, which
the § 53.056 notice already prints on a residence.

## The short form

On a job under a GC, seven paragraphs: the signer's authority and the claimant's addresses; the
trade and the property; the GC as hiring party and original contractor, with its address; the
owner; the months; the day and method of each notice to the owner; the claim and the lien. On a
job contracted with the owner, four: the same first two, the owner as the hiring party with the
claimant as original contractor, and the claim.

## The five questions

1. Is the short form complete against § 53.054(a)?
2. Do you want any of the five cuts back?
3. Is the day and method of each notice to the owner enough, and what does the paragraph say
   when a notice went late?
4. Is the § 53.254(f) notice all a homestead affidavit needs, and what must the office confirm
   about the contract before one is filed?
5. May one affidavit cover several jobs at one property under the same original contractor?

## The build, once counsel answers

1. **The homestead hold** (S). `affidavitGates` treats a null `homestead` as not answered and
   holds the paper, with a press that opens the property record. No sworn text changes. Needs the
   owner's go only.
2. **The short form** (M). `buildLienAffidavitBlocks` and its fields: the months, the notices from
   `job_lien_filings.sends`, the addresses, the claim alone, the strip and the preamble gone. On
   counsel's yes to questions 1 to 3.
3. **A hold while an address is missing** (S), the hiring party's or the original contractor's.
4. **One affidavit per property** (M). Question 5, only on a yes.

## Decisions that are the owner's

- **Send the page to counsel?** The pick: yes, as it stands.
- **Build the homestead hold before counsel answers?** The pick: yes. It only makes the desk
  stricter.
