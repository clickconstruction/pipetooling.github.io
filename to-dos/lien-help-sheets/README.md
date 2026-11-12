---
name: "Help sheets printed with every lien paper"
number: 314
group: close
status: asked 2026-11-11 after the office's first signed batch of lien affidavits came back with mistakes · the batch read against the record the same day · three mock-ups drawn and checked as real prints, with made-up names · the owner the same day, *build it all I like it all* · built the same day as four PRs · then *is this the best we can do?*: a before and after page with eleven changes · the owner the same day, *do 1-3, and then show me mockups for 5-11* · 1 to 3 built on PR 7697 · 5 to 11 drawn one at a time · the owner, *I like them all, please make those changes*, and of who to call, *the leader or the dev* · all of it live by 2026-11-11 23:15 UTC: v2.6953, v2.6954, v2.6955, v2.6957 and v2.6961 · change 5 turned into a scan-to-record idea, thought through and not built
summary: >
  The office signed and notarized its first batch of short-form lien affidavits on 2026-11-11.
  Read against the record, none could be filed as it stood: the county blank at the top was
  filled with the property's county on every sheet, no notary seal showed, and several papers
  should have been stopped before they were printed. The owner asked for help sheets that print
  with every paper. Three shapes are drawn: a cover sheet for each paper, one sheet for the whole
  batch, and a marked guide copy of the paper itself.
next: Two things wait on the owner. Change 5 became a different idea: a code on the cover sheet that opens the job's **Record service…** step on a phone, with a tracking number and a photo of the certified mail receipt filed to the job's Drive folder; the step takes only the day served today, so the form is most of the build (see *Change 5, as the owner turned it*). Change 4, a place marked for the seal, was neither asked for nor drawn. The help sheets for the § 53.056 and retainage notices are not built.
size: M as a train of three (S the form's label · M the sheet on the batch print and the Lien window · S the same sheet for the two notices)
blocker: The owner's word on the scan-to-record form. Printing the signing county changes the paper's face, so counsel should see a signed one.
opinion: your call — 1 to 3 and 6 to 11 are live; build the scan-to-record form first, then put the code on the sheet
---

# Help sheets printed with every lien paper (#314)

## The ask

The owner, 2026-11-11, with the scan of the office's first signed affidavits: *this was their
first attempt to fill things out, I see a lot of mistakes … what I am thinking is we need to
design and start printing help sheets with all of the papers.*

## What the first batch got wrong

Eleven short-form affidavits (`buildShortLienAffidavitBlocks`), signed and notarized in one
sitting. Read against the Lien desk's record through the dev seat the same day. No name or
address from that batch is written here.

| What | How many | Who could have caught it |
|---|---|---|
| The county blank above *BEFORE ME* holds the property's county. The form means the county where the paper is signed; the notary's block below was right | all 11 | the person signing, told which county goes where |
| No notary seal shows on the scan | all 11 | the notary, with a checklist |
| A paper sworn on a property the county's page shows with a homestead exemption | 1 | the app, once someone answers the homestead question (punch list #305, item 3) |
| The owner line prints an attention line where the owner is a city | 1 | the app: the record names a city as owner |
| Months sworn on a house where the first notice was mailed after those months' dates, and the record shows that notice went to the owner alone | 5 papers on 2 properties | the app: it holds the months and the sends |
| Several separate affidavits on one property | 5 on one, 3 on another | counsel's question 5 on #305 |
| One property's address printed three ways across three papers | 3 | the job's own address field |

A signed and sealed paper cannot be corrected by hand, so each one that goes forward is printed,
signed and notarized again. That is why the sheet has to work before the notary, not after.

## What a sheet has to say

1. **The blanks, and nothing else.** Six of them on the affidavit: the county at the top, the
   signature, the county in the notary's block, the day, the notary's signature and printed name,
   the seal. The top county is where the paper is signed.
2. **When to stop.** A homestead, a public owner, an owner line that is an office or a title, a
   month with no notice mailed on time or no copy to the contractor, more than one paper on a
   property, anything printed wrong. One sentence each, and the rule that a signed paper is
   printed again, never fixed.
3. **What happens after.** Which county clerk, the recording number, the two presses in the app
   (**Record filing…**, **Record service ›**), the copies to the owner and the original contractor.

Every sentence follows the plain-words rules (`src/lib/plainWords.ts`) and names a press by its
exact words.

## The three mock-ups

Each was printed with headless Chrome and read back as a PDF: every help page fits one letter
sheet.

- **A, a cover sheet for each paper** (`a-cover-sheet-per-paper.html`). One page in front of every
  affidavit with that job's facts: the job, the property, the claim, the file-by day, the clerk,
  and the two addresses the copies go to. It has room for the recording number. It costs a sheet
  per paper.
- **B, one sheet for the whole batch** (`b-one-sheet-per-batch.html`). The blanks and the stop
  list once, then a row for each paper with the clerk, who gets a copy, and five boxes to tick:
  signed, sealed, filed, in the app, copies mailed. A paper the app would stop is listed with its
  reason and is not printed behind the sheet.
- **C, a guide copy of the paper itself** (`c-guide-copy-of-the-paper.html`). The paper prints
  twice: first with the blanks filled in as they should read and numbered marks beside them, then
  clean. It teaches best, since the answer sits where the pen goes. Its risk is that someone signs
  or files the guide copy, so it carries a band at the top and the foot.

### The same sheet for the other two papers

- **§ 53.056 notice.** No notary and no blanks. The steps are: sign, put the invoice behind it,
  mail one copy to the owner and one to the original contractor by certified mail, type both
  tracking numbers in the app. The date on the sheet is the mail-by day.
- **§ 53.057 retainage notice.** The same, with the day our contract ended in the facts and
  counsel's cover letter named as page 1 of the owner's copy.

## The pick

**B for a batch, A for one paper.** The first run was one person signing a stack, and B is the
only shape that follows a paper past the notary to the clerk, the app and the mail. A is the same
blocks for a single paper printed from the Lien window. C is the best teacher and could be the
training handout, but as a daily sheet it puts a second copy of a sworn paper in the stack.

## Is this the best we can do?

The owner, 2026-11-11, once the first build was on its PRs: *Please give it a polish, asking yourself is this the best we can do? And let me know the before and after changes you think we should make.*

Read again as a first-week employee would read them, the built sheets fall short in eleven places. `before-after.html` draws the three that change a page beside what was built; `after-a-cover-sheet.html`, `after-a-cover-sheet-flagged.html`, `after-b-batch-sheet.html` and `after-the-paper.html` are the polished pages by themselves, each one letter sheet.

| # | Before, as built | After | Size |
|---|---|---|---|
| 1 | A paper with a closed gate still prints in a batch. The mock-up promised it would not | The batch leaves it out and its row says why | S |
| 2 | The sheet lists six warnings the reader checks by eye, the same on every paper | The sheet says what the app checked on this paper, with its answers. One check is left to the reader: read the names, the addresses and the amount | M |
| 3 | The top county is a blank with *(where signed)*, written by hand | Both county lines are printed from one setting, the county where the company signs. A different county is typed before printing | S |
| 4 | Nothing on the paper shows where the seal goes | A dotted circle beside the notary's name | S |
| 5 | One list for everyone | Two halves by who does it: at the notary, and after the notary | S |
| 6 | Six blanks described in words | A small picture of the paper with numbered spots. With the counties printed, four are left | S |
| 7 | Batch rows in the desk's order | Rows grouped by county clerk, one trip for each | S |
| 8 | No word on the sheets about a late notice | *Ask first* on that paper's row and on its cover sheet, from the notice check | S |
| 9 | *Call the office* | A name to ask: the lien leader on the job | S |
| 10 | *The app shows the last day to mail* | Lines to write the filing day and the mail-by day; each clerk's address and fee, once the office has typed them in Settings | M |
| 11 | A plain band, and the guide copy has bands alone | A striped edge on every help sheet, a GUIDE COPY watermark across the guide copy's paper, and a code to scan for the full guide | S |

**The owner, 2026-11-11: *do 1-3, and then show me mockups for 5-11*.** Changes 1 to 3 are built on PR 7697: a ready paper with a hold is left out of the batch and named on the sheet, the sheets say what the app checked with *ask first* on a paper that has a question, and the county where the paper is signed prints on both county lines from Settings or the box beside the print press. Change 8 came with change 2, since the notice check is one of the checks. `changes-5-to-11.html` draws 5, 6, 7, 9, 10 and 11 one at a time, each piece as it prints today beside the same piece with that change, and shows 8 as built. Each can be built without the others. Change 10 is two parts: lines to write on (small), and each clerk's address, fee and hours, which the app does not hold and must not guess, so it needs a short list in Settings that the office types once. Change 4 was neither asked for nor drawn.

**Shipped, 2026-11-11.** Changes 1 to 3 as v2.6957 (PR 7697) and 6 to 11 as v2.6961 (PR 7703), on top of the help sheets themselves (v2.6953), the public-owner hold (v2.6954) and the notice check (v2.6955); each `docs/recent-features/v2.NNNN.md` says how. Two settings in the company block feed them: **County where lien papers are signed**, and **County clerks, for the lien help sheets**, one clerk per line. Change 9 names the job's lien leader or the dev, as the owner said. Two fixes rode with v2.6961: the sheets' black tags now print whatever the print window's box says, and the *Record service…* step no longer asks for tracking numbers the form has no place for.

### Change 5, as the owner turned it

The owner, 2026-11-11: *it might make sense to offer the user a QR code where if they scan it brings them to that part of the app to enter a number and upload their receipt of the certified mail.* What exists: `lienWindowHref(jobId, 'affidavit')` opens one job's Lien window on the affidavit tab, which has a phone layout; `putJobFolderFile(jobId, 'sent', file)` puts a file in the job's Drive folder under *Sent by us*, and `shrinkPhoto` and `PhotoPress` already take a camera shot. What is missing: **Record service…** writes `served_at` alone, with no tracking number and no photo (a notice's sends hold a tracking number, an affidavit's do not). The build, in two pieces: first the form gains a tracking number and a **Take a photo** press for each copy, the photo filed to Drive and its link kept on the filing, never blocking the day; then each cover sheet prints a code to its own job's step. The picks: one code for a batch that opens the Affidavits list, the number typed (a browser cannot read the USPS barcode reliably), and the same photo press on **Record filing…** for the clerk's stamped page.

**The pick before that answer: 1 to 4 first, in that order.** 1 is a promise the mock-up made and the build did not keep. 2 is the largest gain: a warning that prints on every paper is one people stop reading, and the app already knows four of the six answers. 3 removes the mistake all eleven sheets made, where the label only explains it. 4 answers the other mistake all eleven made. The rest is tidying and can ride with them.

**Two of these change the paper's face** (3 and 4). Neither changes a sworn word, and the Legal desk's own affidavits already print a typed venue (`affidavitPaper.ts`, `venueCounty`), but a recorded paper's form is counsel's to see first. v2.6249 took a seal caption off the jurat on the reasoning that a notary knows where it goes; the first batch says otherwise.

## What a sheet cannot fix

Three of the seven mistakes are the sheet's. The rest were on the paper before it printed, and a
sheet only helps if someone reads it. Each of these is its own piece of work:

1. **Label the top blank on the form.** *COUNTY OF ____ (where signed)*, or drop the top venue and
   keep the notary's. One line in `buildShortLienAffidavitBlocks`. Small, and worth doing whichever
   mock-up wins. The wording of a sworn paper is counsel's to confirm.
2. **A hold for a public owner on the affidavit.** The notice's gates already read *public
   property* (`lienDeskGates.ts`); the affidavit's do not.
3. **A hold when a sworn month has no timely notice, or no copy to the original contractor.** The
   desk holds the months and the sends (`lienAffidavitNotices.ts`). What counts as timely is the
   app's reading and wants counsel's word first.

The homestead case is already built as punch list #305, item 3.

## Decisions that are the owner's

- **Which mock-up?** The pick: B for a batch, A for one paper.
- **Does the help sheet print by itself, or only when asked?** The pick: by itself, first in the
  print, with a box on the batch bar to leave it off once the office knows the paper.
- **Label the top blank now, before counsel answers?** The pick: yes. It changes no sworn
  statement, only says which county the blank wants.
