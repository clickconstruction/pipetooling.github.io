---
name: "Legal desk: show it, don't say it — the lien calendar, the money bars, Evidence by whose paper, the Timeline strip"
number: 214
group: ready
status: picked 2026-10-29 · the owner asked for all four, in order · PRs 4, 3a, 3b and 2 merged 2026-10-30 (v2.6107 #6486, v2.6106 #6485, v2.6108 #6487, v2.6105 #6484) · PR 1 claude/214-legal-desk-show (v2.6104, #6483) lands last, carrying this card
mockup: to-dos/legal-desk-show-not-tell/mockup.html
summary: >
  The Legal desk's four questions, its account cards and its Timeline line show; four sections still
  tell. The lien clock is said three times in prose, the money is a figure with a caveat that can
  double-count retainage, Evidence is a flat wall of rows in the order they were added, and the
  Timeline prints each paper's sent-to sentence under its title. Four PRs draw each as a shape:
  the desk opens on the strip's Windows calendar with the next step's button and the deadline as a
  chip; the money as two bars on two scales with every offer marked; Evidence grouped by whose paper
  it is with the state as a chip; the Timeline led by a strip of days with hot overdue rows.
next: PR 2, the money bars, once #213's PR 2 (the claim reads the retainage on the bills once) is on main, since the bar draws that split.
size: M as a train of four (S · M · M · S)
blocker: PR 3 needs one new column, legal_matter_documents.whose, and PR 2 builds on #213's kernel change.
opinion: build — the owner picked all four on 2026-10-29 after a second pass on the mock-up
---

# Legal desk: show it, don't say it (#214)

## The ask

The owner, 2026-10-29, reading a live subcontract account on the desk: *"looking at the legal desk, do you think
we're doing a good job of showing instead of telling as a GUI? I think we could improve some sections?"* Then:
*"Mock all of them, and then ask yourself is this is the best we can do and give it another pass."* Then: *"All
four, in order."*

## The read

Half the desk shows: the account cards (`1 job · GC pays · signed · keeps ~$… · 7d in Collections`), the four
questions with a verdict first and the why under it, the Timeline's one line split around today, the invoices table
with its running balance. Half tells:

1. **The lien clock, three times.** *Next on the path · Draft the Aug notice — 18 days* and *Waiting on · us — the
   notice to be drafted and mailed* as a label pair over the step row, and the same deadline as a sentence under
   *Before this goes to an attorney* (*Lien window open on <job> — § 53.056 notice due <day> (18 days) — File the
   notice before you refer; a lien outranks a referral and the firm will ask why it lapsed.*). The calendar that
   shows it, the strip's Windows view (v2.3815, v2.4652), sat behind a switch that defaults to Steps app-wide.
2. **The money.** *How much? $X — open bills $Y inside it, plus retainage held $Z.* A number with a caveat, and on a
   job where the retainage is the unpaid part of a bill, a wrong one (#213 fixes the kernel).
3. **Evidence** is dozens of rows in the order they were added, each a kind · size · date line and a sentence, the
   sent ones repeating *Sent <day> by email to …* in full.
4. **The Timeline** says *7 planned · 2 overdue · 10 done · 3 deadlines* as a sentence and prints each paper's
   *sent to…* record again under its title, so one send day reads the same three sentences on Evidence and here.

## The mock-up and its second pass

`mockup.html` draws each section's words of today beside the proposed shape, on an invented GC and job with a real
account's shapes. The first render was looked at and redrawn once; the blue *Second pass* box under each section
says what the screenshot showed and what changed:

- The rail at half width piled its labels on each other and put *Today* on the notice's label → the whole row,
  three lanes named in a gutter, month rules, one label per tick.
- One money bar on the claim's scale made the three open bills eleven-pixel slivers and the offer labels overprinted →
  two bars on two scales (the bills at full width; the claim thinner under it with the bills as one block), the offers
  on the claim bar in two rows, and *What's left for us?* as its own keep / firm / filing bar on the bills and on the claim.
- Evidence rows ran off the frame and took the ⋯ door with them → the middle column shrinks, the line ends in an
  ellipsis inside the frame. Grouping by state was tried in the sketch and dropped: *final* is thirty papers from five
  parties; whose paper it is matches how a lawyer reads a file.
- An overdue Timeline row looked like any other until its chip → a red rule down its left edge, the Pipeline's mark.

## Where it plugs in

- The strip: `src/components/jobs/LienTimelineStrip.tsx` (row · list · mini layouts; Steps · Windows views; the
  verdict band with `nextDoor`), `src/hooks/useLienTimelineView.ts` (the remembered view), `src/lib/jobs/lienTimeline.ts`
  (the steps), `lienWindowsAxis.ts` (the calendar axis). The desk's Paper tab: `LegalDeskPacketTab.tsx`.
- The questions: `src/lib/legal/deskQuestions.ts` over `LegalPacket.worth` (`legalPacket.ts`: `balance`, `claim`,
  `retainageHeld`, `fee`, `filingCost`); the cards in `LegalDesk.tsx`. #213's PR 2 makes `claim` read the retainage
  on the bills once.
- Evidence: `LegalMatterDocumentsPanel.tsx` over `legalMatterDocumentsIo.ts` and `_shared/legalMatterDocuments.ts`
  (title, shows, dated_on, state, sent_*); the firm's portal and both prints read the same rows.
- The Timeline: `src/lib/legal/legalTimeline.ts` (items with a lane and a state), `LegalTimelinePanel.tsx`.

## The plan

| PR | What | Size |
| --- | --- | --- |
| 1 · v2.6104 | The desk's Paper tab opens on the Windows calendar under its own remembered scope (`viewScope`); the next step's door at the verdict band's right (`legalPaperNextDoor.ts`: a notice to the Lien desk, the affidavit and the release to the Lien window's tab); the two lien gaps as chips (`LegalGap.chip` / `brief`), the prints keeping the sentence. | S |
| 2 | *How much?* draws two bars — the open bills by part at full width, the retainage inside the bill it sits on; the claim thinner under it with the bills as one block and lost profit hatched — and every offer (theirs, the floor, ours) as a mark on the claim bar; *What's left for us?* draws keep / firm / filing on the bills and on the claim. Kernel `moneyBars.ts` over `worth` and the Offers log; reads #213's retainage split. | M |
| 3 | Evidence grouped by whose paper it is — theirs · ours, sent · the City's · the supplier's · the record — with the state as a chip, the paper's day as a column, the *shows* line on one line and the sent record behind ⋯; filters where the count was and *Added this week*. Migration adds `legal_matter_documents.whose` (text, null = the record), picked when a paper is added, guessed from the title for the rows already there (`whoseFromTitle`, tested); the portal and the prints group the same way. | M |
| 4 | The Timeline's counts as chips with numbers and a strip of days from the first entry to the last deadline (filled dots done, rings planned, red rings overdue, diamonds the clock; a day capped at four dots; press a day to jump); a paper on the line is one row and two chips with *Who got it ⋯*; papers sent on one day share the day cell; an overdue row gets a red rule. Kernel `timelineStrip.ts` over `buildLegalTimeline`'s items. | S |

## How to verify

A subcontract account on the dev server (`/legal-desk`, the dev signed in): the Paper tab opens on the calendar with
the open notice month's bar and *Draft the notice…* at the band's right; the gap list reads the chip; Steps switches,
and the job's Lien window still opens on its own remembered view. For PR 2, *How much?* must read the open bills once
and the GC's counter at the bills' edge. For PR 3, the matter's documents under five headings with the reply, the
notice and the waiver first. For PR 4, the overdue steps as red rings on the strip and red rules below it.
`npx vitest run src/lib/legal src/components/jobs/legal src/components/jobs/LienTimelineStrip.render.test.tsx` after each.

## Where it stands

PR 1 is #6483 (v2.6104), the last of the five to land: PR 4 (v2.6107, #6486) merged first, then 3a (v2.6106, #6485, the `whose` column, pushed to prod the same morning), 3b (v2.6108, #6487) and PR 2 (v2.6105, #6484), all on 2026-10-30. PR 2 was cut on PR 1 with #213's PR 2 (#6478) merged in, since the bars read its per-job retainage split. The claim bar draws nothing on an account with no offer logged and no floor, by design: the bills bar already says it all there. The mock-up found, while being checked against the app, that the
calendar already existed behind the strip's switch; PR 1 reuses it rather than drawing the rail again, and its fragment
says what the mock-up asked for that it does not do (the lane gutter).
