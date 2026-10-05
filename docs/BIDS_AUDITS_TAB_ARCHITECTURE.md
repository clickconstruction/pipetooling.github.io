# BidsAuditsTab Architecture Map

---
file: docs/BIDS_AUDITS_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the sub-decomposition of src/components/bids/BidsAuditsTab.tsx (1,500 lines) per PAGE_DECOMPOSITION_PLAYBOOK.md — the Bids page's 🤖 Audits lens (the robots' open questions, the queue of robot bids waiting on a human audit, and the open card where each difference takes a one-tap verdict). Inventories every region (state, memos, effects, loaders, writes, kernels, test coverage) so extraction can proceed without re-reading the file. One level deeper than BIDS_TABS_ARCHITECTURE.md §Robots group.
covers:
  - src/components/bids/BidsAuditsTab.tsx
mapped_at: 7379b248f
audience: Developers, AI Agents
last_updated: 2026-10-05
---

> **Line numbers are as of `7379b248f`** (the `mapped_at` commit) and drift with every edit — search the symbol named beside each range. Regenerate the fact sheet with `npm run map -- src/components/bids/BidsAuditsTab.tsx`. 28 commits in 90 days.

## What this surface is

[`BidsAuditsTab.tsx`](../src/components/bids/BidsAuditsTab.tsx) is the Bids page's **🤖 Audits** lens (`?tab=audits`; see [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) §Robots group). A robot (a digital twin) drafts a bid on a copy of ours; a `bid_audits` row asks a person to judge it. The tab shows, top to bottom: one sentence sizing today with a button to **answer the questions** (the run-through sheet); the **Questions** panel (the robots' open `twin_questions`, one line per topic); then two panes — the **queue** (Now · Up next · Opens when you send · Digesting · Digested) and the **open card** (the robot's confession, robot draft against ours, where the delta lives, the differences to judge, its questions, the notes with the robot's receipts, *Finish audit*). Below 1,151 px the card is a full-screen panel over the queue. Help guide: [`audit-a-robot-bid`](../src/content/help/audit-a-robot-bid.md).

- **Mounted by** `src/pages/Bids.tsx` 1738 only: `activeTab === 'audits' && <BidsAuditsTab authUser myRole focusAuditId />` — it unmounts on a tab change, so every state below starts over.
- **Props (149):** `authUser: User | null`, `myRole: string | null`, `focusAuditId?: string | null` (a door: the Robot Board row's and the envelope's *Full audit* set it through `setFocusAuditId` in `useBidRobotLayer`, then select the tab).
- **Who may write:** `canWrite` 154 = `canWriteBidAudit(myRole, isTwin)` — `ROBOT_AUDIT_ROLES` (dev, master_technician, assistant, controller, estimator) and never a twin session. Everyone else sees the queue and the card with no composer, no verdict buttons, no *Finish*, and no Questions panel.

**Hook census (fact sheet @ 7379b248f):** 26 `useState` · 0 `useReducer` · 5 `useEffect` · 10 `useMemo` · 5 `useCallback` · 1 `useRef` (`focusAppliedRef` 483) · 4 custom hooks (`useToastContext` 150, `useIsDigitalTwin` 151, `useMatchMedia` 172, `useTwinQuestionBidRefs` 383) · 21 local imports, two of them from `supabase/functions/_shared/`. One named export `BidsAuditsTab` (149–1500, 1,352 lines; render 1250–1499) plus module scope 66–147. Data: tables `bid_audits`, `bids`, `bid_audit_notes`, `bids_count_rows`, `bid_pricing_assignments`, `price_book_entries`, `twin_questions`, `twin_run_scores`, `bids_submission_entries`; RPC `list_shadow_runs`; edge function `audit-finish`.

| Largest blocks | Symbol | Lines |
|---|---|---|
| The open card (a render function, not a component) | `renderCard` | 713–1248 (536) |
| ↳ the differences | `diff && top ?` | 959–1043 (85) |
| ↳ its questions | `threaded.questions` | 1085–1154 (70) |
| ↳ one difference row | `renderDiffRow` | 744–805 (62) |
| The loader | `load` | 203–328 (126) |
| The Questions panel | render | 1284–1393 (110) |
| The queue | render | 1411–1485 (75) |
| Finish / reopen | `setAuditStatus` | 598–638 (41) |

---

## Master summary table

| Region | Anchor (symbol · lines) | ~Lines | Coupling | Risk | Status | Tests |
|---|---|---|---|---|---|---|
| A. Module scope | `auditDb` 66 · types 68–74 · `STATUS_CHIP` 76 · `UNPRICED_CHIP` 81 · styles 83–107 · `fmtQty` 109 · `fmtUsd` 110 · `DIFF_IMPACT_FLOOR` 113 · `DIFF_BUCKET_CAP` 114 · `VERDICT_BUTTONS` 116 · `DIFF_BUCKETS` 122 · `fmtRate` 139 · `WATERFALL_SEGMENTS` 141 | ~80 | low | low | inline | through the smoke |
| B. Loader | `load` 203–328 + effect 330–332 · scores effect 357–370 · states `audits` 155, `notesByAudit` 156, `draftByAudit` 157, `loading` 158, `refByBidId` 165, `refsLoaded` 167, `shadowRuns` 169, `scores` 170 | ~150 | **highest** — everything reads its eight states | **high** (the seal; a truncated read prices a bid at $0) | inline; pairing, sort and draft total out (`bidAudits`) | smoke 118 (the card it feeds); `bidAudits` 20; **the reference pairing and the seal's `refValue` rule have no test in the tab** |
| C. Questions (standing rulings) | `loadRulings` 337–353 + effect 354–356 · `rulingsView` 375 · `operatorOpen` 376 · `audienceWritable` 378 · `useTwinQuestionBidRefs` 383 · `answerRuling` 389–427 · `patchRulingQuestions` 431–452 · `bounceToOperator` 453 · `dismissRulingQuestions` 455 · `rulingsExpanded` 702 · `runItems` 704 · `todaySentence` 707 · `indexItems` 709 · render 1253–1393 | ~230 | low — own five states; shares `busy`; the queue reads `rulingQuestions` for `plansAskBidIds` | med (one answer lands on every open copy) | inline; grouping, order, sentences and the sheet out | smoke reads `audits-today`, `question-line`, `rulings-plans-asks`; `standingRulings` 17, `rulingRunThrough` 11, `RulingRunThroughSheet` render 3; **the three writers are called by no test** |
| D. Triage and the open-card pick | `isSealed` 195–201 · `deltaPctFor` 457–465 · `triaged` 471–478 · `focusAppliedRef` 483 · `workable` 484 · pick effect 485–498 · `openCard` 499 · `closeCard` 504 · states `expandedId` 163, `pickedByHand` 174 · `twoPanes` 172 | ~60 | high — `expandedId` drives the card, the queue's *Now* and the priced-rows read | med | inline; order and pick out (`auditTriage`) | `auditTriage` 13; smoke clicks `audit-row`; **`focusAuditId` is passed by no test** |
| E. The queue | `axisByShellNumber` 651–662 · `gateByAxis` 663 · `plansAskBidIds` 664 · `queueItems` 665–691 · `queue` 692 · states `sealedOpen` 693, `showDigested` 161 · render 1411–1485 (`sectionHead` 1413, `row` 1420) | ~125 | med — reads B, C, D | low | inline; sections and words out (`auditQueue`) | smoke reads `queue-now`, `queue-up-next`, `queue-digested` and clicks `audit-row`; `auditQueue` 7; **the sealed and digesting sections named by no test** |
| F. The open card | `renderCard` 713–1248 · priced-rows effect 511–539 · states `pricedRowsByBid` 176, `verdictDraft` 178, `verdictPosted` 179, `rowJudgments` 181, `composer` 159, `composerSection` 182, `cardFolds` 695, `aliasAnswer` 699 · `foldOpen` 696 · `toggleFold` 697 · host 1487–1495 | ~590 | high — reads B and D, calls G | med (verdicts teach the robot) | inline; diff, waterfall, pairs, top six, verdict words out (`takeoffDiff`, `auditCardShape`) | smoke 118 (links, question, note + receipt, *Finish audit*), 239 (read-only), 263 (the note's day); `takeoffDiff` 18, `auditCardShape` 10; **no test renders a diff row, a verdict tap, a pair row or the waterfall** |
| G. Writes | `busy` 160 · `insertNote` 541–562 · `tapVerdict` 566–581 · `postVerdictDraft` 582–592 · `setAuditStatus` 598–638 · `finishAudit` 639–646 · `reopenAudit` 647 | ~105 | high — each ends in `load()` | **high** (the edge function and its fallback) | inline | smoke 118 (*Add note*, *Answer* present); **`audit-finish`, the fallback writes and Reopen named by no test** |

Render smoke: [`BidsAuditsTab.render.test.tsx`](../src/components/bids/BidsAuditsTab.render.test.tsx) (277 lines, 3 `it`), mocks `supabase` and `useIsDigitalTwin`. It never mocks `useMatchMedia`. No e2e spec names the tab.

---

## Per-region dossiers

### A. Module scope

- **`auditDb` 66:** `supabase as unknown as SupabaseClient` — every table read in this file goes through the untyped view (the comment dates it to before `bid_audits` reached `database.ts`). Only `supabase.functions.invoke` (603) uses the typed client.
- **Chips and buckets:** `STATUS_CHIP` (pending / done / digested), `UNPRICED_CHIP`; `VERDICT_BUTTONS` (teach / record / ok); `DIFF_BUCKETS` (missed / added / gaps / rates) and `WATERFALL_SEGMENTS` (those four plus `other`).
- **Thresholds:** `DIFF_IMPACT_FLOOR` 1,500 and `DIFF_BUCKET_CAP` 8 decide which folded rows show (1019). Three more are literals in the JSX: ±8 % colours the delta green (920, 1435), a system ratio is green from 0.85 to 1.15 (999), and line 1040 says *within 15%*.
- **Extraction:** moves with the card (F); `STATUS_CHIP` is also the queue's (1423).

### B. Loader

- **`load` 203–328** (deps `[showToast]`), in order:
  1. `bid_audits` with the embedded `bids` row, newest 50, through `sortAuditsForTab` → `audits`.
  2. A fire-and-forget block 219–262 for the references: the twins' `twin_source_bid_id`, the RPC `list_shadow_runs` → `shadowRuns`, `pairTwinReferences`, the reference bids by id and by number, then `refByBidId`. **The seal rule is line 249:** `refValue` is the reference's `bid_value` only when it has a `bid_date_sent`. `refsLoaded` is set in its `finally`.
  3. `bid_audit_notes` with `author:users(name)` → `notesByAudit`.
  4. For audits not yet digested: `bids_count_rows` and `bid_pricing_assignments` paged through `fetchAllRowsChunkedIn`, `price_book_entries` for the prices, then `computeAuditDraftTotal` per audit → `draftByAudit`.
- **Errors:** a message matching `does not exist` is swallowed (the client may ship ahead of the migration); anything else toasts.
- **Scores effect 357–370:** every `twin_run_scores` row, newest first, once on mount → `scores` (the queue's kind-of-job line).
- **Extraction:** Stage A `buildAuditRefInfo(pairing, refsById, refsByNumber)` (241–255, the seal under a test) and `auditDraftSummaries(open, rows, assigns, priceById)` (312–317). Then `useBidAuditsData()` → the eight states + `reload`.

### C. Questions (standing rulings)

- **State:** `rulingQuestions` 185, `rulingsAvailable` 186, `rulingsOpen` 188 (null follows the default), `runThrough` 190, `showAllQuestions` 191.
- **Read:** `loadRulings` 337–353 — open `twin_questions`, newest 200; a no-op without `canWrite`; any error hides the panel (`rulingsAvailable` false).
- **Derived:** `rulingsView` 375 (`groupStandingRulings(…, { audience: 'estimator' })`), `operatorOpen` 376, `audienceWritable` 378, the bid links from `useTwinQuestionBidRefs` 383, `runItems` 704 (`buildRunThrough`), `todaySentence` 707 (`sizeTodaySentence`), `QUESTION_INDEX_FOLD` 708, `indexItems` 709.
- **Writes (all `twin_questions`, all `.in('id', ids).eq('status', 'open').select('id')`):** `answerRuling` 389–427 (answer + `answered`), `bounceToOperator` 453 (`audience: 'operator'`), `dismissRulingQuestions` 455 (`status: 'dismissed'`), the last two through `patchRulingQuestions` 431–452. Zero rows back toasts *Already handled elsewhere* and reloads. Each returns whether it wrote; the sheet advances only on true.
- **Render:** today strip 1253–1266 (`data-testid="audits-today"`); `RulingRunThroughSheet` 1267–1281; the panel 1284–1393 — header button, the index lines (`data-testid="question-line"`, each opens the sheet at its index), *Show all*, the plans-asks pointer 1333–1366 (one link per human bid to `/bids?tab=bid-board&bidId=…&robot=needs`), the legacy-asks line 1367–1381, the operator line 1382–1389 (dev only).
- **Extraction:** `useAuditRulings(canWrite, authUserId)` (the five states, the read, the three writers), then `AuditQuestionsPanel`. This is cross-surface seam 13 in the playbook: the open-200 read and the guarded answer write repeat in other files.

### D. Triage and the open-card pick

- **`isSealed` 195–201:** an audit whose reference exists and is unsent. `workable` 484: not sealed and priced.
- **`triaged` 471–478:** `orderPendingByStake(audits, …)` — pending cards by open questions, then |delta|, then age.
- **Pick effect 485–498:** a `focusAuditId` not yet applied opens that card once (unless sealed) and counts as a pick; otherwise `pickOpenAudit({ triaged, current, picked, ready: !loading && refsLoaded, workable, autoOpen: twoPanes })`.
- **`openCard` 499 / `closeCard` 504:** both set `pickedByHand`; a close is a pick of nothing, which holds.
- **Extraction:** stays in the tab with `expandedId` (the queue and the card both need it). `deltaPctFor` joins the card prelude kernel (see inventory).

### E. The queue

- **`queueItems` 665–691:** one `AuditQueueItem` per triaged audit — names, the reference's number and dates, `sealed`, `unpriced`, counts of open questions and notes, `deltaPct`, the `axis` (from `axisByShellNumber`: shadow runs first, scores over them), its `gate` (`gateByAxis` over `buildAxisCards`), and `needsFix` (an open plans ask on the twin or its reference).
- **`queue` 692:** `buildAuditQueue(queueItems, expandedId)` → `now`, `nowPosition`, `workableCount`, `upNext`, `sealed`, `digesting`, `digested`.
- **Render 1411–1485:** an IIFE with two local functions, `sectionHead` 1413 and `row` 1420 (`data-testid="audit-row"`; `whyLine`, or `🔒 sealedLine` for a sealed row). Sections carry `data-testid` `queue-now`, `queue-up-next`, `queue-sealed`, `queue-digesting`, `queue-digested`.
- **Extraction:** Stage B `AuditQueueList({ queue, expandedId, pickedByHand, onOpen })` owning `sealedOpen` and `showDigested`. The memos stay until B is a hook.

### F. The open card

- **Host 1487–1495:** nothing when no card is open or the open one is sealed (two panes: *Tap a row to open its card.*); two panes → a sticky column; else a `role="dialog"` fixed panel, z 1004, padded by `--app-top-chrome`.
- **Prelude 714–743:** `threaded` (`threadAuditNotes`), `openQ`, `draft`, `unpriced`, `chip`, `ref`, `deltaPct` 721, `robotRows` / `ourRows` (from `pricedRowsByBid`), `diff` (`diffTakeoffs`), `rollup` (`rollupSystems`), `pairs` (`pairAliases` less the ones answered *two*), `top` (`topDifferences`), `topKeys`, `pairedKeys`, `foldedPairs`, `postAlias` 734, `splitPair` 740.
- **Priced-rows effect 511–539:** for the open, unsealed card, `loadPricedTakeoffRows` for the twin and, once the reference is sent, for the reference; cached per bid in `pricedRowsByBid`.
- **Sections, in order:** header 842–862 (job name, both bid numbers, the phone ✕, chip, draft total, unanswered count, the requested stamp); the two links 863–874; the confession 877–894 (`selfAssessmentLead`, fold key `:least-sure`); the unpriced note 896–901; the comparison strip 903–926; the waterfall 932–956 (`diffWaterfall`); the differences 959–1043 (`data-testid="top-differences"`, folds `:rest`, `:pairs`, `:systems`); the fallback judge list 1044–1084 (no reference rows: the robot's first eight priced rows under *Biggest rows*, 🚩 drafts a note, 👍 is local); its questions 1085–1154 (one shown, fold `:questions`); the notes by section with receipts 1155–1184; the composer 1185–1223; *Finish audit* / *Reopen* 1225–1245 (the label is `finishLabel(queue)`).
- **Row renderers:** `renderDiffRow` 744–805 (the three verdict buttons, the draft input, *Post*) and `renderPairRow` 807–839 (`data-testid="alias-pair"`: *Same item — teach the name*, *No, two things*).
- **Extraction:** Stage B `AuditCard`, last (see Hazards for what its state needs first). `AuditDiffRow` and `AuditPairRow` can leave before it as presentational rows.

### G. Writes

- **`insertNote` 541–562:** one `bid_audit_notes` row (`section`, `kind` note or answer, `parent_id`, `author_id`), clears that composer key, then `load()`.
- **Verdicts:** `tapVerdict` 566–581 — *ok* posts at once; *teach* / *record* open a drafted line (`buildVerdictDraft`) that `postVerdictDraft` 582–592 posts. The section is `entrySection(entry.label, bucket)`.
- **`setAuditStatus` 598–638:** first the edge function `audit-finish` (`{ audit_id, action }`; it also flips the twin's CountTooling review over the bridge). When the call throws, errors or returns no `ok`, it falls back to a direct `bid_audits` update and, on finish, a `bids_submission_entries` note. Then `load()`.
- **`finishAudit` 639–646:** after the status write, opens the next workable pending card; `pickedByHand` becomes `!twoPanes && !!next`.
- **`busy` 160** is one string for the whole tab: a composer key, `verdict:<key>`, `alias:<key>`, `finish:<auditId>`, `ruling:<key>`.

---

## Shared substrate

1. **The loader's eight states (B)** — read by D, E, F and G.
2. **`expandedId` + `pickedByHand` (D)** — the queue, the card host, the priced-rows effect and `finishAudit`.
3. **`busy` + `load()`** — every write sets one and ends with the other.
4. **`canWrite`** — gates C entirely and every control in F.

## What must STAY in `BidsAuditsTab`

- `expandedId`, `pickedByHand`, `focusAppliedRef` and the pick effect 485–498 (the door prop lands through it).
- `isSealed` and its readers (`workable` 484, the door 489, the priced-rows effect 513, the queue 680 and 706, the host 1489) until the seal is one tested kernel.
- The two-pane grid and the card host 1409, 1487–1495.

---

## Stage-A inventory

**Kernels and children already out** (size · test cases counted by `it(`):

| Kernel | Lines | Tests | Used here for |
|---|---|---|---|
| [`bids/takeoffDiff.ts`](../src/lib/bids/takeoffDiff.ts) | 381 | 18 | the diff, the waterfall, the system rollup, verdict drafts, `entrySection` |
| [`bids/bidAudits.ts`](../src/lib/bids/bidAudits.ts) | 291 | 20 | threading, open-question count, the draft total, the sort, `canWriteBidAudit`, `isUnpricedAudit`, `pairTwinReferences`, the stamp |
| [`bids/confidenceBoard.ts`](../src/lib/bids/confidenceBoard.ts) | 289 | 15 | `buildAxisCards`, `normalizeBidNumber` |
| [`bids/standingRulings.ts`](../src/lib/bids/standingRulings.ts) | 207 | 17 | `groupStandingRulings`, `openCountByAudience` |
| [`bids/auditCardShape.ts`](../src/lib/bids/auditCardShape.ts) | 188 | 10 | alias pairs, the top differences, the confession's lead |
| [`bids/auditQueue.ts`](../src/lib/bids/auditQueue.ts) | 140 | 7 | the queue's sections and words, `finishLabel` |
| [`bids/rulingRunThrough.ts`](../src/lib/bids/rulingRunThrough.ts) | 124 | 11 | the run-through's order, the header and today sentences |
| [`bids/auditTriage.ts`](../src/lib/bids/auditTriage.ts) | 93 | 13 | `orderPendingByStake`, `pickOpenAudit` |
| `bids/loadPricedTakeoffRows.ts`, `hooks/useTwinQuestionBidRefs.ts` | 67, 67 | none, none | one bid's priced rows; the bid links in a question |
| [`RulingRunThroughSheet.tsx`](../src/components/bids/RulingRunThroughSheet.tsx) | 259 | render 3 | the one place that answers a question |

**Still inline (move to `src/lib/bids/*` + tests):**

| Candidate | Where | Target |
|---|---|---|
| The reference map and the seal's `refValue` rule | 241–255 | `buildAuditRefInfo` in `bidAudits.ts` — **the anchoring rule with no test** |
| The delta, written twice | 457–465, 721 | `auditDeltaPct(draft, ref)` in `bidAudits.ts` |
| Draft summaries per audit | 312–317 | `auditDraftSummaries` beside `computeAuditDraftTotal` |
| Kind of job per shell | 651–662 | `axisByShellNumber(shadowRuns, scores)` in `confidenceBoard.ts` |
| One queue item | 667–689 | `toAuditQueueItem(audit, ctx)` in `auditQueue.ts` |
| Which folded rows show | 1017–1020 | `foldedBucketRows(entries, topKeys, pairedKeys)` in `auditCardShape.ts` (owns the floor and the cap) |
| Plans-ask link targets | 1338–1345 | `plansAskTargets(asks, sourceByBidId, bidNumberById)` in `standingRulings.ts` |
| The fallback finish note | 624–628 | `auditFinishNote(email, noteCount)` |
| The colour thresholds | 920, 999, 1435 | named constants beside `DIFF_IMPACT_FLOOR` |

---

## Recommended extraction order (value ÷ risk)

1. **Stage A: `buildAuditRefInfo` + `auditDeltaPct`** — ~25 lines; puts the seal under a test.
2. **Stage A sweep:** `auditDraftSummaries`, `axisByShellNumber`, `toAuditQueueItem`, `foldedBucketRows`, `plansAskTargets`, the thresholds — ~70 lines.
3. **`useAuditRulings`** (C's state, read and three writers) — ~110 lines; the only region with no reads of B.
4. **`AuditQuestionsPanel`** (1253–1266 + 1284–1393) — ~125 lines of JSX.
5. **`AuditQueueList`** (1411–1485 + `sealedOpen`, `showDigested`) — ~80 lines.
6. **`useBidAuditsData`** (B) — ~150 lines; give it a reload that does not blank the page (see Hazards) before step 8.
7. **`AuditDiffRow` + `AuditPairRow`** (744–839) — ~95 lines, presentational.
8. **`AuditCard`** (the rest of `renderCard`) — ~440 lines, last.

Verification per step: `npm run typecheck && npm run lint && npm test`, behavior-preserving only, one PR per step (see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md)). The smoke covers the card's frame and the read-only gate; add a render test for a diff row and a verdict before step 7.

---

## Hazards

- **The seal (shadow anchoring):** before our own bid goes out, nothing of the robot's or of ours may show. Four places hold it: `refValue` is null for an unsent reference (249); the priced rows are never read for a sealed audit (513); the door cannot open one (489); the host draws no card for one (1489). A sealed row in the queue still calls `openCard` — it is the host that refuses.
- **Every write blanks the page:** `insertNote` and `setAuditStatus` end in `load()`, which sets `loading` true, and line 1404 draws *Loading audits…* in place of the grid. The card is unmounted and redrawn after each note, answer and verdict. Its state survives only because it lives in the tab, keyed by audit id — an `AuditCard` that owns `verdictDraft`, `composer` or `cardFolds` would lose them on every post.
- **Verdicts are remembered for the session only:** `verdictPosted`, `aliasAnswer` and `rowJudgments` are never rebuilt from `bid_audit_notes`. After a tab change or a reload a judged difference offers its buttons again. `verdictPosted` is set before the insert returns, so a failed post still shows ✓.
- **👍 writes nothing:** in the fallback list `rowJudgments` is local; only 🚩 leads to a note (by prefilling the composer).
- **Finish falls back to direct writes:** any failure of `audit-finish` — unreachable, an error, a response without `ok` — runs the PT-side writes without the CountTooling flip. Reopen shows no toast on either path.
- **`finishAudit` picks from a stale list:** `next` is read from the `triaged` closure captured before the reload.
- **The priced-rows cache never refills:** effect 511–539 (exhaustive-deps disabled; omits `pricedRowsByBid` and `isSealed`) skips a bid already cached, so a robot that re-pastes its counts is not re-read until the tab remounts. The draft total beside it (`draftByAudit`) is re-read on every `load()`.
- **Silent caps:** 50 audits (212), 200 open questions (345), every score row (361). Count rows and assignments are paged because a truncated page would price the newest audits at $0.
- **The references arrive late:** the block 219–262 is not awaited, so `loading` can fall before `refByBidId` lands; `refsLoaded` is what the pick waits on. It is never set back to false.
- **Untyped reads:** `auditDb` (66) turns off column checking for nine tables and one RPC.
- **Edge-shared imports:** `twinQuestionAudienceColumnPresent` and `effectiveTwinQuestionKind` come from `supabase/functions/_shared/`; a change there changes this tab without a function deploy, and the function without a client deploy.
- **Plain links, not router links:** `/bids?tab=counts&bidId=…` (871) and the plans-ask links open a new tab; the two `/bids?tab=robot-console` links (1374, 1385) reload the page in place.
- **`busy` is one slot:** a second write started while one is in flight overwrites the key and re-enables the first button.
- **Role gate mirrors RLS:** `canWrite` hides controls; the tables decide. A read-only role never calls `loadRulings`.
