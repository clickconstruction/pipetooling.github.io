---
name: "Bids → Robots: the Audits lens as a queue for the estimator's minutes"
number: 63
group: gated
status: building — the owner took the draft's picks 2026-09-30 · PR 1 shipped v2.4230 (the open card, one question count, the strip off Audits) · PR 2 v2.4256 (the strip and caption on every lens) · PR 3 v2.4232 (the run-through) · PR 4 v2.4234 (the queue and two panes) · PR 5 v2.4261 (the card in the envelope's shape) · PR 6 follows
summary: >
  Bids → 🤖 Robots → Audits stacks the robots' 19 open questions (16 cards, about 96 buttons), a
  coaching strip and all 40 audits, with the 8 sealed shadows mixed in and the auto-opened card at
  row 32 — the oldest audit, not the first, because the pick runs before the triage signals load.
  The redesign turns the lens into a queue: one sentence that sizes today, the questions behind one
  button as a one-at-a-time run-through with number keys, the queue on the left and the open card on
  the right (the card always at the top), the sealed rows folded as "opens when you send", the card
  leading with its six biggest differences and pairing a missed row with the added row that is the
  same item under another name. The Robot Board's six-number strip becomes the group's header on
  every lens, one kernel counts the questions everywhere (today 19 on Audits, 15 on the Scoreboard),
  and the Dashboard card leads with the fifteen-minute item.
next: >
  The owner's five calls in the mock-up (park a slate? hold or scrub a sealed shadow's question?
  the heading word? two panes or pinned card? the run-through's order?), then PR 1 (the open-card
  fix, one question count, the coaching strip off Audits) and PR 2 (the strip and caption on every
  lens) — both safe without any call; PRs 3–5 after the calls; the guide rewrite rides with them.
size: S + S + M + M + M (+ S for the guide, glossary and the Bids tabs map)
blocker: Your call on the five questions at the foot of the mock-up. PR 1 and PR 2 need none.
opinion: build — PR 1 is a bug fix and PR 2 a caption; the queue (PRs 3–5) is where the estimator's minutes go, and her minutes are the program's bottleneck (docs/twins/LEARNING_PLAN.md)
mockup: mockup.html (as it is, with today's numbers · plan draft 1 · asked of it · draft 2 on desktop, the run-through, a phone · asked of it · the whole group · the train)
---

# Bids → Robots: the Audits lens as a queue for the estimator's minutes

*Robots tab redesign* (the mock-up, published) — https://claude.ai/artifact/CrwUBMiQwwoYuLDqZiru1L

## The ask

> "catch up on the docs and take a look at bids robots. I don't think this page is super easy for a user to use and we could do a better job. help me come up with a plan followed by asking ourselves 'is this the best we can do?' followed by a mockup asking ourselves 'is this the best we can do?' followed by looking at it wholistically and asking 'is this the best we can do?' and then present this to me" — owner, 2026-09-29

## What the page is today (read off the live page as dev, 2026-09-29)

- The group lands on **Audits** whenever work is pending (`Bids.tsx`, the Followup precedent). The bar: Robot Board · 46 | Audits · 31 | Scoreboard | Console (dev). No caption line under it — the Followup bar has one (`followupLensCaption`).
- **Standing rulings · 19**: 16 cards (three topics asked twice), each with 3–4 choice buttons carrying "· all 2", Something else…, Not mine, Dismiss — about 96 buttons before the first audit row. 12 of the 19 were asked today on the shadows sealed this afternoon (b492 · b495 · b496 · b498 · b499); 4 are bid-less doctrine asks three weeks old; 1 is a price-matrix question on the ZZ Test bid.
- A one-sentence intro, then the **coaching strip** ("51 notes · recent runs: −17.0% −29.2% −30.4% +59.9% −2.6%") — the five are the *oldest* audits, not the newest (`audits` is sorted oldest-first and sliced).
- The filter row (All 40 · Backtests 29 · Shadows 11 · Asking you 12) and **40 rows**: 8 are 🔒 sealed shadows mixed in; 29 workable audits come from the two re-bid slates of Aug 31 and Sep 5 (23–29 days old); every row is named for the robot's copy ("b468 · ZZ Twin BONILLA LAW FIRM (backtest R2)").
- **The auto-opened card is b410 (the oldest), at row 32.** `BidsAuditsTab`'s expand effect runs on the first render, before the notes and draft totals that `orderPendingByStake` needs have loaded — `isUnpricedAudit(undefined)` is `false`, so the pick is the oldest pending audit — and the effect then keeps the current card. Every session opens on the bottom of the queue.
- **Two counts of the same questions**: the panel's `groupStandingRulings` counts 19; the Scoreboard's Your part reads `robotQuestionsWaitingCount` over `useBidRobotLayer`'s rows, which are loaded with `.not('about_bid_id', 'is', null)` — the four bid-less asks fall out, so it says 15.
- **One open card (b476 MPH Casa Linda)**: a 150-word "Where I'm least sure" paragraph, the three totals, the waterfall, the system table, then 17 missed · 30 added · 17 quantity gaps with 8 rows shown per bucket and three verdict buttons each (~75 buttons). Four of the eight "missed" rows are the same item as an "added" row under another name — RENTALS/TRAVEL −$20,000 ↔ Travel & Rentals +$19,920, EEW ↔ Emergency Eyewash, OM-1 ↔ Oxygen Manifold, S-3 ↔ Service/Mop Basin — so the estimator judges one difference twice and the waterfall counts it in both directions.
- The Robot Board repeats the same two-line "No plans link" explanation on six rows and shows "4 robot shells with no bid of ours to mirror — pair or archive" to everyone. The Scoreboard's Your part rephrases three of the Robot Board's six strip numbers as sentences.
- A sealed shadow's question reaches the estimator with the robot's size guess in it: b499's Travel bands question says "an $800k restroom fit-out" about unsent b494.

## The decision (draft 2, after the three passes)

- **A queue, in the order her minute is worth.** One sentence sizes today (*19 questions, about fifteen minutes. Then 31 audits — 2 from this month's shadows, 29 from the re-bid slates. 8 more open when you send.*) with one button. The questions run one at a time in a sheet (the ★ first, 1–4 keys, Enter, → skips; Not mine and Dismiss in the corner), the list beneath is one line per question. The audits are Now / Up next / Opens when you send / Digested — queue left, card right at ≥1151 px, stacked on a phone. Rows are named for the job, with the delta and a why line (questions · job type and its gate state · the slate).
- **The card takes the envelope's shape**: the six biggest differences first, the rest and the system table under a fold; "least sure" folds to two sentences; a missed ↔ added pair of the same count and dollars offers **Same item — teach the name** (the twins R2-BT-1 "tag aliasing" residual from the other side).
- **One strip, one count, three words.** The Robot Board's six numbers become the group's header on every lens, each tile a door; one kernel counts open estimator questions for the panel, the Scoreboard, the Dashboard card and the tab badge; estimator-facing copy uses *questions*, *audits*, *sealed* — "ZZ Twin", "backtest R2" and the robot's copy number leave the rows for the card header.
- **Kept as it is**: the lens names (a caption does the job without churning ten docs), the Bid Board's robot icon and sheets, the envelope at send, the Console, the Robot Board's sections, the Scoreboard's job types and runs.
- **Rejected**: renaming the lenses; a tidier list instead of the run-through (a question is long because it carries the plan context; a list is just 19 expand-taps); bulk "all fine" per bucket (lazy verdicts teach nothing).
- **Open** (the owner's five calls at the foot of the mock-up): park a slate; hold or scrub a sealed shadow's question; the heading word; two panes or a pinned card; the run-through's order.

## Where it plugs in

- `src/components/bids/BidsAuditsTab.tsx` (1,458 lines: the panel, the strip, the list, the card) — the expand effect (~line 447), the rulings panel (~line 650), the list rows (~line 966), the card (~line 1015).
- Kernels that exist: `src/lib/bids/standingRulings.ts` (grouping, `legacyMultiDecisionNote`), `auditTriage.ts` (`orderPendingByStake`), `auditListFilter.ts`, `bidAudits.ts` (`isUnpricedAudit`, `countWorkablePendingAudits`, `pairTwinReferences`), `takeoffDiff.ts` (`diffTakeoffs`, `diffWaterfall`, `rollupSystems`), `robotEnvelope.ts` (the six biggest with verdicts), `robotLayer.ts` (`robotQuestionsWaitingCount`, `estimatorLaneQuestions`), `robotMirror.ts` (the six-number strip's inputs), `robotScoreboard.ts` (`buildJobTypeRows` — the job type and its gate state for the why line), `bidsLenses.ts` (`robotLenses`, `followupLensCaption` as the pattern), `twinQuestionChoices.ts` + `TwinQuestionChoiceButtons.tsx` (the taps).
- Hooks: `useBidRobotLayer.ts` (the questions query with `about_bid_id not null`), `useBidAuditsPendingCount.ts` (the badge), `dashboardNeedsYou.ts` (the Robot training item, ~line 1004).
- Docs that follow: `src/content/help/audit-a-robot-bid.md`, `docs/GLOSSARY.md` (Audit, Robot Board, Console entries), `docs/BIDS_TABS_ARCHITECTURE.md` (the lens bar and bodies), `docs/twins/LEARNING_PLAN.md` (items 4 and 5 are what this reshapes).
- Not this to-do: the harness rule for dollar figures in a sealed shadow's question (`supabase/functions/twin-mcp`, `_shared/twinQuestionShape.ts`) — an owner call first.

## The plan

| PR | What ships | Size |
|---|---|---|
| 1 | The open card is the top of the queue (`pickOpenAudit`: pick once the notes, drafts and refs are in; re-pick until the estimator picks); one question count (`openEstimatorQuestions` over the full open list) for the panel, the Scoreboard, the Dashboard card and the badge; the coaching strip leaves Audits (its "recent runs" are the oldest). | S |
| 2 | The strip on every lens (`RobotGroupStrip` lifted from `BidsRobotMirrorTab`) and `robotLensCaption` under the bar; the Robot Board's repeated explanation said once per section; the shells line dev-only. | S |
| 3 | The run-through sheet (`rulingRunThrough.ts`: order — shared first, then today's, then older; progress; the minute estimate) and the one-line index; the sentence that sizes today with its button. | M |
| 4 | Now / Up next / Opens when you send / Digested (`auditQueue.ts`: sections, the why line from open questions + the reference's `backtest_axis` and its gate state + the slate label); rows named for the job; two panes at ≥1151 px. | M |
| 5 | The card in the envelope's shape: six biggest first, the rest and the system table folded, "least sure" to two sentences; `pairAliases` in `takeoffDiff.ts` and the **Same item** tap that posts an alias note the digest reads. | M |
| 6 | Guide *audit a robot bid* rewritten around the queue; glossary; the Bids tabs map. Rides with 3–5. | S |

Each PR is cut from fresh `main`, one claim each, auto-merge; no migration in any of them (an alias note is a `bid_audit_notes` row with a tag, like the verdict tags).

## How to verify

- PR 1: open `/bids?tab=audits` as dev — the open card is the first row under Up next (b468 today), not b410; the Scoreboard's Your part and the panel header agree (19 today); the Dashboard card says the questions first.
- PR 3: **Answer the 19 questions** → the sheet at 1 of 19; `1` answers with the ★ and advances; `→` skips; the toast says how many copies the answer landed on; the end screen lists what was saved; the panel count drops.
- PR 4/5: the two panes at 1440 px; a row tap opens its card on the right without scrolling; the 🔒 rows are under the fold with the due date of the bid they wait on; b476's card leads with the 2IN WASTE gap and offers the RENTALS/TRAVEL ↔ Travel & Rentals pair.
- Phone (375 px): the sentence, the button, the queue; a row opens the card full-screen.
- Test data: the live page has everything (19 questions, 31 audits, 8 sealed). Answer nothing real on a dev pass — use the ZZ Test bid's price-matrix question (b398) if a real tap is needed.

## Where it stands

Read, planned and mocked up 2026-09-29. The owner took the five calls as the draft's picks on 2026-09-30 (Questions as the heading word, two panes on desktop, shared questions first; a parked slate stays unbuilt, and the sealed-shadow dollar rule stays a harness call). PR 1 shipped as v2.4230, PR 2 as v2.4256 and PR 3 as v2.4232, PR 4 as v2.4234 and PR 5 as v2.4261; PR 6 (the guide, the glossary, the map — and this folder's retirement) follows.
