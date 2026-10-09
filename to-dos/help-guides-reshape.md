---
name: "Help guides: give the long reference guides a do-this-first opening"
number: 88
summary: >
  The plain-words sweep (#75) made every help guide readable sentence by sentence. Thirteen
  guides still do several jobs under one title, from 880 to 2,550 words each, so a first-timer
  meets five features before the one they opened the guide for. Each guide wants a do-this-first
  opening, a split where it holds two or three guides, and cuts. The three slices' reviewers
  proposed all three per guide. They are gathered here for the owner's call.
size: M (13 guides, about 20,000 prose words; one PR per guide)
ver: v2.4589 · 4597 · 4601 · 5052
mockup: not required — words only; each guide renders as it does today
group: ready
status: open · proposed 2026-10-05 by the three plain-words slices (#75) · the owner's rule 2026-10-09: openings and splits for all thirteen, no cuts · 1 of 13 shipped (v2.5052)
next: One PR per guide, thirteen in all (the owner, 2026-10-09): the do-this-first opening above everything else, and the split where the reviewers proposed one, each new guide with its own title and share card; no cuts — a sentence a reader may rely on stays, moved below a *Reference* line at most. Each PR gets an independent old-against-new read.
blocker: None.
opinion: build — openings and splits are safe; the cuts were the risk and are off the table.
---

# Help guides: give the long reference guides a do-this-first opening

## The ask

The owner, 2026-10-05, through PUNCHLIST, once the plain-words sweep (#75) closed: the reshaping
of the long reference guides goes on the board. The sweep's rules hold each sentence. They
cannot tell a guide that does one job from one that does five.

## What each guide wants

Word counts are prose words on `main` at 2026-10-06, without the frontmatter, the headings and
the `:::example` panels. An **opening** goes above everything else: what to do first, in two
sentences or three steps. A **split** turns one guide into two or three, each with its own
title. A **cut** removes text or moves it below a *Reference* line. The proposals are quoted from
the PR bodies of #4575 (rows 46–67), #4586 (rows 1–23) and #4589 (rows 24–45). The openings
for the #4589 guides are written here; that PR named only the split and the cuts.

### ~~see when a customer will pay~~ — shipped v2.5052

`see-when-a-customer-will-pay` · 2,545 words · #4586 · now the opening and four guides: the core (1,117 words), *read the payment forecast*, *see which customers pay slowly*, *record payments so they count*, and the months-worked section as the lien guide *see which months need a lien notice*. Nothing cut.

- **Opening:** "Each billed row on the Pipeline says when the customer will likely pay. You read the
  Expected line, and you record a date when the customer names one."
- **Split:** four guides in one. Split off the forecast and its email, the pay-speeds breakdown
  with Data health, and recording payments.
- **Move:** the months-worked lien section belongs with the lien guides.

### ~~share a customer their portal~~ — shipped v2.5057

`share-a-customer-their-portal` · 2,244 words · #4586 · now the opening and three guides: the office side (the core), *see what a customer sees on their portal* (statement, payments, requests) and *show an owner the bills their GC pays* (the owner switch and the lien notice card). Nothing cut.

- **Opening:** "A customer's portal is a private page with their statement and Pay online buttons.
  You make the link from the globe next to their name."
- **Split:** the office side (the link, the gear), what the customer sees (statement, payments,
  requests), and the owner-sharing switch.

### track a general contractor on a job

`track-a-general-contractor-on-a-job` · 2,487 words · #4575

- **Opening:**
  1. Set a GC on a job: **Edit** → **Customer** → *GC/Builder (customer)*.
  2. Each week, open **GC Review** from Billed Awaiting Payment and certify each GC's bills by
     Wednesday.
  3. Send the statement from the GC's row: **Share** → **Draft Message**, or **Copy** to paste it
     yourself.
- **Cut:** everything from GC Review on duplicates *run your GC statement round*: certification,
  the Draft Message dialog line by line, Cc, the portal card, scheduled sends, Share all and
  Standing copies. This guide would keep "set a GC" and "where the GC shows up", plus a link.
- **First:** a fact pass, flagged in #4575.

### share a sub their portal

`share-a-sub-their-portal` · 1,973 words · #4589

- **Opening:** "Every subcontractor can have a private Work & pay portal, a page they open without
  signing in. You create the link from the globe beside their name on People → Subs and text it
  to them."
- **Split:** (a) *share a sub their portal*: turn it on, the address, did they look. (b) *what a
  sub sees on their portal*: what feeds it, the How do I get paid card, the stages, days off,
  progress.
- **Move:** signing a work order and the date window go to the work-order guides.
- **Cut:** the CountTooling access-log sentence.

### read the Bridge

`the-bridge` · 1,698 words · #4575

- **Opening:**
  1. Type today's bank balance in **Cash on hand today** and press **Set**. The cash line starts
     from it.
  2. Read the cash readout: the lowest cash point in the next 8 weeks, and whether it clears your
     floor.
  3. Read the Truth check verdict: steer by the profit rate, bill it to see it, or not a number to
     steer by yet.
- **Cut, or move below a Reference line:** ‹ › stepping and the zoom row, the ↻ marker, the
  salaried-day and Field crew bullets, the "not on anyone's row" note, the red-day formula
  paragraph.

### keep the overhead numbers accurate

`understand-overhead-numbers` · 1,472 words · #4575

- **Opening:**
  1. If the amber maintenance strip shows, the rates read low. Fix what it names.
  2. Pending approvals: review them on **People → Hours**. Unpriced hours: set wages in
     **People → Pay config**. Unassigned salary time: assign it in **My Time**.
  3. When the strip is gone, the lens rates are safe to price with.
- **Split:** the title is this task, yet the task sits at the bottom. Move to a separate *read the
  Overhead tab* guide: the lens math window (How it moved, What moves it, Watch-outs), the
  bar-click panel, and the Behind any cell drill-down.

### see what the office got done on any day

`see-what-the-office-got-done` · 1,056 words · #4586

- **Opening:** "The Day book shows what each office person did each day. You pick a day and read its
  lines."
- **Move:** gather the four record-keeping passages into one *Why a figure can be missing*:
  today's live counts, past approvals rebuilt from timestamps, the Dashboard's daily snapshots,
  and amber needing a known waiting count.

### stage a takeoff for a schedule of values

`stage-a-takeoff-for-a-schedule-of-values` · 1,277 words · #4589

- **Opening:** "Every fixture on Bids → Takeoffs carries a stage, and the rail adds its material up
  by stage. You set each fixture's stage with its three boxes, then print the schedule or put it
  in the cover letter."
- **Split:** (a) *stage a takeoff*: the boxes, the rules and the book, the Stages panel, printing.
  (b) *put a schedule of values in the cover letter*: the pill, labor and material, My lines,
  scaling to the contract.
- **Move:** *Use stage shares* goes to the payment-schedule guide.

### see what I still owe each sub contractor

`sub-labor-outstanding` · 1,158 words · #4589

- **Opening:** "Jobs → Subs → Pay shows who is owed what, and what you can pay right now. You press
  **Pay** beside a sub to pay their biggest ready sheet."
- **Split:** (a) *see what I still owe each sub*: the tiles, Who's owed, the ledger, Pay when,
  paying. (b) *fix a payment on the wrong sheet*: move, remove, undo.
- **Move:** the phone section, to a phone guide of its own.

### turn a won bid into a job

`turn-a-won-bid-into-a-job` · 1,217 words · #4575

- **Opening:**
  1. Mark the bid **Won**, then press **Open the job**.
  2. Answer New Job's price question: carry the bid price over, or start at $0.
  3. Fill in the crew and press **Create Job**. The job is born linked to the bid.
- **Cut:** the four places a win is recorded become one line. The Dispatch hand-off edge cases
  (asked twice, opened elsewhere, primaries) and Tips go below a *Reference* line.
- **First:** a fact pass on the submittals question.

### write a change order and send it for signature

`write-a-change-order` · 1,194 words · #4575

- **Opening:**
  1. On **Estimates**, press **New change order** and pick the customer.
  2. Fill in what changed and why, then add cost lines with **+ Added work** or **− Credit /
     removed work**.
  3. Press **Send to customer**. When it comes back signed, press **Apply to job**.
- **Cut:** the numbered-guide walkthrough (the screen explains itself), the old estimate #1
  paragraph, the v2.2967 note.
- **Split:** *Starting from Bids* becomes its own short guide.

### ~~get started as a sub or helper~~ — shipped v2.5069

`start-here-as-a-sub` · 1,143 words · #4589 · the opening stays. *Say how far along you are*, *Pick your days* and *Your days* are now one line each under *On your portal*, each linking to its section, moved whole below a *Reference* heading. No sub-facing guide holds them, so they stay in this guide. Nothing cut.

- A map, so no split; its opening stays.
- **Cut:** *Say how far along you are*, *Pick your days* and *Your days* each become one line
  with a link to the guide that holds it.

### get started in the office

`start-here-in-the-office` · 883 words · #4589

- A map, so no split; its opening stays.
- **Cut:** the six phone-Dashboard bullets become one line and a link.

## Also named by the slices

Smaller asks, each one line in a PR body:

- *share your attorney their portal* (`share-your-attorney-their-portal`, 959 words, #4589):
  (a) create and send the link, (b) what the firm sees and does. The envelope detail on Paper
  belongs to the Lien desk guide.
- *understand how liens work and which lien tool to use*
  (`understand-how-liens-work-and-which-lien-tool-to-use`, 1,466 words, #4575): the opening
  would be three steps: open the Lien desk from the Dashboard's lien notices card; draft, approve
  and send each notice by the date the desk shows; if the money still does not come, the Lien
  window files the affidavit.
- *see what the team sees* (`see-what-the-team-sees`, 526 words, #4586): cut *The promise
  behind the count*, a promise to engineers.
- *send a customer account to your attorney* (`send-a-customer-account-to-your-attorney`,
  #4586): two headings are numbered *6.*, and *Ask the firm* belongs before *How it ends*. A
  numbering fix, not a reshape; it can go first, on its own.

## How each would ship

- One PR per guide, or per split, cut from fresh `main`. No fact changes: a moved passage moves
  whole, and a cut is only what the owner picked.
- A split adds guides. Each new one follows `CLAUDE.md` → *Help guides ship with features*: a title
  that completes "How do I…", a plain first paragraph, and plain words held by
  `helpGuidePlainWords.test.ts`. A link replaces each moved passage.
- A slug that changes or splits is checked against `docs/twins/APP_DIRECTORY.md`
  (`appDirectoryCheck.test.ts`) and every guide that links to it.
- Each PR gets an independent old-against-new read: does the new text say anything the old did
  not, or drop anything it said? Then one more read over the diff after any later pass. That is
  the #75 recipe, which caught 21 meaning slips in one slice that every mechanical check passed.
