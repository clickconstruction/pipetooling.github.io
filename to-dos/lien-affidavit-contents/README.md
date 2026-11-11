---
name: "The lien affidavit, cut to what § 53.054 lists: a short form for counsel"
number: 305
group: waiting
status: asked 2026-11-10 on the line *Work month 2026-08* at the top of the affidavit · the sworn text and its recipe read on main the same day against § 53.054 · the owner's lens the same day, the minimum the law requires, short and sweet · a short form drawn for counsel with five questions · the owner chose the same day to build before counsel answers · the short form is live (v2.6855) for every new draft, a paper already drafted keeps the earlier form until someone redraws it, one press redraws every ready one (v2.6867), a homestead paper opens with the § 53.254(f) notice (v2.6884), the short form prints on one sheet (v2.6895), the Lien window says when a paper takes a second sheet (v2.6896), one press sends every drafted affidavit for approval and one prints every ready one (v2.6918), an affidavit holds while the GC has no address on file (v2.6932), a house holds until the homestead question is answered (v2.6937)
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
  a homestead. The owner chose to build before counsel answers, so the wording may change on
  counsel's word.
next: Item 6 of *The build*, one affidavit per property, on counsel's yes to question 5. Items 1 to 5 are built. Counsel's answers to the five questions may still change the wording, which sits in `buildShortLienAffidavitBlocks`.
size: M as a train of four (S · M · S · M); the one-affidavit-per-property PR waits on question 5
blocker: Item 6 waits on counsel's answer to question 5. Counsel's answers may still change the wording.
opinion: later — items 1 to 5 are built; item 6 is built only on counsel's yes to question 5
---

# The lien affidavit, cut to what § 53.054 lists (#305)

## The ask

The owner, 2026-11-10, looking at a Mechanic's and Materialman's Lien Affidavit from the Lien
desk: *I am seeing "Work Month 2026-08", what are the pros and cons of keeping this on the
liens?* Then: *before we move it can you look at it holistically and let me know if you have any
other suggestions?* Then, on the suggestions, his go to draft the revised affidavit as a before
and after page for his attorney. Then the lens: *I want to do the minimum required by law, short
and sweet.*

The short form is built (v2.6855, see *The build*). Every statute reference here is the app's reading, not a lawyer's.

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
  `homestead` is true. The column is `boolean NOT NULL DEFAULT false` (read 2026-11-10), so it
  holds no null: a property nobody asked about reads *Not a homestead*, the same as one answered
  no, and passes.
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

## The build

The owner chose on 2026-11-10 to build before counsel answers. Each PR is small, and the sworn
wording sits in one function (`buildShortLienAffidavitBlocks`), so counsel's changes are one edit.

1. **The short form** (M). Shipped as v2.6855 (`docs/recent-features/v2.6855.md`): the seven and
   four paragraphs, the months (the noticed ones inside the job's own work span) and the notices from the job's
   recorded § 53.056 filings, the strip
   and the letterhead gone, the county left for the notary. The desk stored no affidavit words and
   redrew every paper from the job, so a paper now keeps the form it was drafted on: the 13
   affidavits approved on 2026-11-09 and 2026-11-10 stay on the earlier form, and **Redraw on the
   short form…** on the Affidavits pane moves one, which then needs approval again. Since v2.6867
   one press at the top of the Affidavits list redraws every ready one at once. Since v2.6895 the
   short form prints on one sheet: at the paper's own leading the seven paragraphs ran a few lines over.
   Since v2.6896 a line under the print press says when a paper takes a second sheet and that its
   closing moved there whole. Since v2.6918 two presses under the redraw bar finish a re-issue:
   **Send N for approval…** for every drafted paper, **Print N for notarization** for every ready one
   on the short form.
2. **The § 53.254(f) notice on a homestead** (S). Shipped as v2.6884
   (`docs/recent-features/v2.6884.md`): on a property marked homestead the short form opens with the
   notice above the title, bold at 12 point. The paper side only; the desk still holds every
   homestead, and no property on the desk was marked on 2026-11-10.
3. **The homestead hold** (S, with a migration). Shipped as v2.6937
   (`docs/recent-features/v2.6937.md`): `customer_addresses.homestead_answered_at` (migration
   `20261111160000`) records that a person answered, the property record asks *Is this the owner's
   homestead?* with **Yes** and **No**, and `homesteadGate` in `affidavitGates`
   (`src/lib/jobs/lienDeskAffidavits.ts`) holds a residential property with no answer, with
   **Answer it ›** opening the property record on the question. Read again on 2026-11-11 the
   day-one count was the same: 11 of the 12 papers ready for 2026-11-16, on 6 property records, and
   the one to draft on a 7th. The migration is pushed right after the merge.
4. **A hold while an address is missing** (S), the hiring party's or the original contractor's.
   Shipped as v2.6932 (`docs/recent-features/v2.6932.md`): a fifth gate on a job under a GC, the
   GC's address on its customer record, with **Add the address ›** on the Affidavits pane and the
   same line on the Lien window's tab. Read again on 2026-11-11 it holds nothing: both GCs on the
   desk have an address. On a job contracted with the owner the hiring party is the owner, and the
   owner gate already needs a mailing address.
5. **A second company address** (S). Settings hold one (`app_settings` key
   `physical_invoice_issuer_v1`, field `addressText`), printed as the mailing address. One optional
   field `physicalAddressText` in the same JSON (no migration), one input *Physical address, if
   different* under the address in the issuer block in Settings, and one line in
   `buildLienAffidavitFieldsForJob` (`src/lib/jobs/lienNoticeDraft.ts`) passing it as
   `claimantPhysicalAddress`. The short form already prints *Its physical address is …* when given
   one that differs (tested).
6. **One affidavit per property** (M). Question 5, only on a yes.

## The brief for the next session

Items 3 to 5 of *The build* were built on 2026-11-11 (v2.6937, v2.6932 and v2.6936), one PR each.
What is left is item 6, one affidavit per property, and only on counsel's yes to question 5. A
session that builds it works in the repo's usual way: `npm run claim` for the version, a kernel
with unit tests and a render smoke, one release note and one `docs/recent-features` fragment, the
lien help guides in plain words, `docs/LIEN_DESK_ARCHITECTURE.md` amended in place, this card's
status amended, `gh pr merge --auto`. Done when it is merged and live, checked read only on
clicktooling.com.

- **Every statute reading is the app's, not counsel's.** Counsel has not answered the five
  questions. Keep each change small and easy to revise.
- **What a paper keeps.** A paper keeps the form it was drafted on (`lienAffidavitForm.ts`). A
  filed paper stores its own fields. A hold changes which pile a paper sits in, never its words.
- **What is live to build on:** the short form (v2.6855), the one-press redraw (v2.6867), the
  homestead notice on the paper (v2.6884), one-sheet printing (v2.6895), the page-count line under
  the Lien window's print press (v2.6896), and the Affidavits list's **Send N for approval…** and
  **Print N for notarization** (v2.6918), and the two holds of 2026-11-11: the GC's address
  (v2.6932) and the homestead question (v2.6937). Each `docs/recent-features/v2.NNNN.md` says how.
- **The hold's words** go where the gates already speak: the gate list on the Affidavits pane
  and the Lien window's affidavit tab, which draws no paper while a gate is closed.

## Decisions that are the owner's

- **Send the page to counsel?** The pick: yes, as it stands.
- **Build the homestead hold before counsel answers?** The pick: yes, after 2026-11-16. It only
  makes the desk stricter, and before the 16th it would take ready papers out of Ready.
- **The 13 affidavits approved on the earlier form: leave them, or redraw them?** Decided
  2026-11-10: redraw them, they go out on the short form.
