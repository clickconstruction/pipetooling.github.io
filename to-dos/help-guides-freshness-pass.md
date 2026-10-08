---
name: "Help guides: the freshness pass, surface by surface"
number: 91
group: ready
status: open · the list was made by the plain-words sweep (#75, closed 2026-10-06) · the lien guides are done (v2.4614 to v2.4623) · the start-here guides are done (v2.4860) · the rest not started
summary: >
  The plain-words sweep rewrote every guide sentence by sentence and kept every fact. Reading
  them, it found about twenty guides that describe screens that have since moved: a tab renamed,
  a button gone, a count changed, a path that no longer exists. The lien guides were read against
  the code and fixed. The rest are listed here by surface, with the reader's leftovers from the
  sweep (guessed plain words, phrases kept word for word, two counts that disagree with their
  lists) so one pass per surface can take them all.
next: >
  One PR per surface below, read against main's code: Track a GC, then Bills, Emails and
  settings, Submittals, the others. The start-here guides went first (v2.4860). Each PR fixes the
  stale facts, settles that surface's guessed words and kept phrases, and strikes its line here.
  Delete this card when the list is empty.
size: M (about twenty guides over seven surfaces; S per surface)
blocker: None. A reader who knows each screen; no decision is owed.
opinion: build, surface by surface — a guide that names a tab that is gone sends a first-timer looking for it
mockup: not required — words only; each guide renders as it does today
---

# Help guides: the freshness pass, surface by surface

## Where this came from

The plain-words sweep (#75) ran 2026-09-30 to 2026-10-05 over every help guide. Its rules hold each
sentence, not each fact, so a sentence about a button that no longer exists was rewritten plainly
and left as wrong as before. The rewriters listed every such sentence they noticed. The lien
guides were then read against the code by six readers and fixed (v2.4614, v2.4617, v2.4620,
v2.4623); the app-side findings from that read are #87. This card holds the rest of the list.

## The surfaces, from the sweep's own reading (2026-10-05)

A rewrite keeps every fact, so the sweep listed these and fixed none. One PR per surface, each read
against main's code the way the lien guides were (v2.4614 to v2.4623, which closed the Lien desk
rows below).

- **Lien desk**: *understand how liens work and which lien tool to use* says the retainage notice
  is "not modeled in the app yet"; names "Lien instruments, the orange lien icon" (now the Lien
  window and the gavel); "Bill Customer → Lien releases"; the desk's three views (v2.4588).
- **Track a GC**: the Share menu lacks *Find a check…* (v2.4046); the billing section predates
  *Bills go to* (v2.3345); rows now group by account man; it overlaps *run your GC statement round*.
- **Submittals**: *turn a won bid into a job*'s submittals section predates this week's parts
  and GC-sees changes.
- **Bills**: *turn a bill into a Stripe bill* and *sub labor outstanding* describe the old Bill
  tab and old settings paths; *sort the bank feed* puts the cost timeline on the Bill tab (Costs
  tab since v2.3361); *sort the Pipeline by time added* says three orders (four since v2.3788).
- **Emails and settings**: *see what the team sees* says 25 emails (26) and a count breakdown
  that is gone; *see your email schedule*'s Digests / Every report tabs are gone (v2.3595);
  *settings basics* names a Notifications tab (Activity logs) and says View as… is for leaders
  (dev only); *share a customer their portal* says "Settings → Email streams" (Emails & reports).
- **Others**: *see when a customer will pay* (the hygiene link v2.2288, receipt chips now rows,
  "average" is the median); *see where you win and lose with a builder* (Builder Review is
  Followup → By builder); *send a supply house a quote link* (the Kind chips, v2.3172); *send a
  bid for signature* ("Jobs → Stages" is the Pipeline; the third decline reason); *see what to do
  next on a roadmap* (the Needs You row reads *Open Plan*); the attorney guide has two "## 6."
  headings; *try the new cover letter layout*'s slug and title disagree.


## Also for the reader of each surface (from #75)

None of these fail a test; each wants someone who knows the screens or the trade.

- **Two counts that do not match their lists**, kept as written because the rules forbid changing
  a number: *see every contract side by side* says "four lines" above six bullets; *reconcile Cash
  App payments* says "four buttons" above five.
- **Three phrases kept word for word** because the rewriter could not tell what they mean:
  - *file a lien and never miss its deadlines*: "The first bill on a GC job is the last net."
  - *fill and sign a form on my phone*: "the lens skips it."
  - *estimate labor hours on a bid*: "the same lens A the Overhead tab shows."
- **"pretest"** is left without a plain word, twice, in *choose who gets the bill*.
- **Plain words the rewriters said they guessed at.** Each sits beside the trade word the first
  time it appears; a wrong one is a one-line fix.

| Guide | Guessed |
|---|---|
| choose who gets the bill | the portals, "the pages a customer or GC signs in to" |
| crew P&L | a sub sheet, "a subcontractor's labor sheet" |
| drill into the Dashboard money cards | burn, "the money the office spends" |
| find a job address from the field | the ledger, "the app's list of jobs" |
| find a supply house and its rep | a rep, a job account, aging |
| give a customer a lien release | the legal description, "the lot as the county records name it" |
| import a takeoff from CountTooling | a takeoff, "the count of fixtures and pipe runs from the drawings" |
| job address city line breaks | the AIA G702/G703, "the standard progress-billing form" |
| job charges timeline | overhead, "the office's running cost" |
| let the robots shadow a bid | first drafts, "the first pass at our bids"; a lens, "one of the group's views" |
| quickfill | Moneyfill, "the weekly money close page" |
| read a partner's balance from the office | rate-tier days, "the days already stamped with their pay rate" |
| read field reports on the Dashboard | a field report, "what a tech files from the job" |
| record sub labor on a job | the assembler, "the work order builder" |
| reports | a turnaway, "a visit where the work could not be done" |
| review a collections account before it goes to your attorney | writing it down, the contingency %, exhibits |
| run the robots from Claude Desktop | a shadow, a shell, a price matrix, a harness |
| run your GC statement round | retainage, certification |
| see a customer's full history and lifetime value | lien-ready, "the record a lien filing needs is complete" |
| see how close the robots are | a shadow run, "the robot pricing a live bid before our number exists" |

### From batches 6–8 of the sweep (2026-10-05)

Each batch's PR body (#4586, #4589, #4575) carries the full lists: every phrase kept word for
word, every plain word added with where it was checked, and the near-misses a second reader
caught. The owner-facing residue:

- **Phrases kept word for word** because no rewriter could tell what they mean: "the same quiet
  electronic-signature line" (share a sub their portal); "the pile counsel named", "by the run or
  by hand" (the attorney guide); "whose exposure an unpaid balance is" (the supply-house quote
  link); "raises lowering C" (overhead numbers); "statemented" (track a GC); "the fold candidates" (usage
  dashboard); "Since v2.2967" in user prose (write a change order).
- **Left without a plain word**: robot delta, gross (Balances computes net minus paid), exhibits,
  Sworn account, § 53.056 notice, day ledger, true margin, bond, warranty-shaped, alternate.
- **Guessed words to eye**: retainage, "the part of each payment held back until the job is done";
  draw, "what you bill for that stage"; mobilization, "the cost of moving crews and gear onto the
  job"; accrual, "work counts when it is earned, not when cash moves"; a joint check, "one check
  made out to both the GC and us"; a development, "a group of properties built as one project".
  Correction to an earlier row: "the portals" in *choose who gets the bill* is better glossed
  "the GC's own web page of open bills and payments" (the card's own words), not "pages a customer
  or GC signs in to".
- **Two counts that disagree with their lists**, kept as written: *track a general contractor on a
  job* says "Reply to is the third line" of a four-line list; the earlier two are above.

