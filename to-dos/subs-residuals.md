---
name: Subs residuals
group: residual
status: not started
summary: >
  Derived sheet stage (now unblocked), Spanish signature form, compliance chips, offer templates,
  roster hygiene. Benched subs left the sheet form's crew lists in v2.3618.
next: Persist the derived stage (trigger / RPC → an Activity line) with portal parity; item 3 only if daily use asks. The Spanish signature form shipped v2.3636.
size: S each
blocker: None.
ver: board polish done v2.3395 · bench flag v2.3618 · Spanish form v2.3636
opinion: later — what is left is a persisted stage nobody has missed and polish the plan already called optional.
---

# Subs: portal, work-order and notification residuals

## Closed since the 2026-09-05 sweep

- `create_sheet_for_work_order(uuid)` no longer admits `superintendent` by role literal — the role sweep (v2.2920, migration `20260906010000_role_sweep_predicates.sql` item 6) scoped the branch.

## The items (validated 2026-09-06)

1. **Sheet stage derived from anchored steps** (v2.2667 deferred). `src/lib/subSheetStage.ts` still stores three stages (`working → walkthrough → customer_pay`, paid derived) that the office or the portal steps by hand. The spine it waited on has landed, so this is unblocked: the rail wants a stage the stage windows (v2.2927) and the sub's percent (v2.2931) can drive.
2. ~~**Spanish strings inside the shared signature form internals**~~ — shipped v2.3636 (`signatureFormStrings.ts`; the portal's form is `ContractAcceptSignatureForm` over `SignatureTypeOrDrawInput`, not the two files first named here).
3. **Run-subs polish never built** (plan deviations, 2026-08-01): assign-modal compliance chips (`src/components/workflow/StepFormModal.tsx` has no compliance code; `StepCommitmentPanel` does), the `AssignedStageCard` commitment chip, and dedicated offer/accept notification templates (no `notify-*` function covers sub offers; offers ride the sub portal and `submit-sub-portal`'s `accept_offer`).
4. ~~**Benched subs still mix into the Sub Labor sheet form's crew lists**~~ — shipped v2.3618 (`isOnBench` on `people.end_date`; the roster `Person` carries `end_date` + `account_user_id`; `byKind('sub')` leaves benched rows and their folded accounts out).
5. **Roster hygiene the owner still owns**: the archived "Edgar" name orphan (People → Subs; Combine people is the tool). The MIke / Miguel Rodriguez pair was settled 2026-09-06 — nothing to fold, keeper renamed `Miguel "Mike" Rodriguez`. Five older sub sheets still carry the plain "Miguel Rodriguez" label text (display resolves by id; only sheet search reads the text) — the combine tool's step-3 rewrite, if wanted.

## The plan

- ~~(1)~~ shipped v2.3064 as a display derivation (`subSheetStageDerived.ts`: 100% or an ended signed window → Waiting on inspection, hand moves after the evidence stand). Left: persist `auto` (trigger/RPC → Activity line) and portal parity.
- ~~(4)~~ shipped v2.3618; (3) only if daily use asks for it; ~~(2)~~ shipped v2.3636.

## How to verify

- A sheet whose stage window has ended and whose percent reads 100 shows Walk-through without anyone clicking.
- Portal in Español: the signature form's labels are Spanish.
- Bench a sub on People → Subs: the Sub Labor sheet form's crew list no longer offers them.

## Subs board follow-ups (seen in the 2026-09-08 live test of v2.2963)

Cosmetic, none blocking; the board, the tile queues, the calendar and the row forms all worked live (PR #2832). The GC-asked state (struck-through window · Accept · Answer… · the reason line) was verified only by render tests — nobody has driven a GC ask from the GC portal against it yet.

All five fixed in **v2.3395** (2026-09-14; `docs/recent-features/v2.3395.md`) — kept struck for the record:

1. ~~**Calendar sibling list doubles the sub's name** for sheet rows: "Claude Test Sub · Claude Test Sub" (`JobsSubsWorkView.tsx` `calendarRow.siblings` uses `subName` for both the stage name and the sub). Show "Sheet · Claude Test Sub" or the stage name when the order carries one.~~ Done v2.3395 — `calendarRowName` in `stageCalendar.ts`.
2. ~~**Raw ISO dates** in the rail's sublabel and the move's hint — "Sent · 2026-09-08 · good through 2026-09-14" / "good through 2026-09-14". `sheetRail.ts` passes `coverage.sentAt` / `expiresOn` through unformatted; `standingMove.ts` copies them. Format with `stageWindowLabel`-style short days.~~ Done v2.3395 — both read `formatWorkDateYmdMonthDayShort`.
3. ~~**A queue opens its first row's form on arrival even when that row needs no form** — a live (unexpired) offer opens on Re-send. Open expired rows on the form; leave live rows collapsed until clicked.~~ Done v2.3395 — `initialOpenKey` + `offerWantsForm`.
4. ~~**After Undo in the handshake queue** the row reads "No longer on a handshake" because the withdraw leaves a draft behind (the row moves to Drafted). Say so — "Withdrawn · draft kept" — and offer Discard from the mark.~~ Done v2.3395 — the mark carries a Discard action; `withdraw` reports back.
5. ~~**Agreed reads "unpriced" on a sheet with no items even when its order carries a price** ($1,200 on WO-TEST-2963-01). Pre-existing: Agreed is the sheet total. Consider falling back to the order's amount when the sheet has no items.~~ Done v2.3395 — `workOrderBoardRows.ts` borrows the sent / signed order's amount when the sheet's items total zero.
