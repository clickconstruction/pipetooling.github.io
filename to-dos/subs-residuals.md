# Subs: portal, work-order and notification residuals

Status: not started · sources: fragments v2.2667, v2.2844, v2.2860; [`docs/RUN_SUBS_PLAN.md`](../docs/RUN_SUBS_PLAN.md) status log deviations. The one-row spine (v2.2865–v2.2876) and the three-party scheduling train (v2.2927–v2.2934) have shipped; these are what they left.

## Closed since the 2026-09-05 sweep

- `create_sheet_for_work_order(uuid)` no longer admits `superintendent` by role literal — the role sweep (v2.2920, migration `20260906010000_role_sweep_predicates.sql` item 6) scoped the branch.

## The items (validated 2026-09-06)

1. **Sheet stage derived from anchored steps** (v2.2667 deferred). `src/lib/subSheetStage.ts` still stores three stages (`working → walkthrough → customer_pay`, paid derived) that the office or the portal steps by hand. The spine it waited on has landed, so this is unblocked: the rail wants a stage the stage windows (v2.2927) and the sub's percent (v2.2931) can drive.
2. **Spanish strings inside the shared signature form internals** (v2.2667). Portal chrome and `subPortalI18n.ts` are bilingual; `SignedSignatureBlock.tsx` / `ReportTemplateSignatureField.tsx` carry no Spanish.
3. **Run-subs polish never built** (plan deviations, 2026-08-01): assign-modal compliance chips (`src/components/workflow/StepFormModal.tsx` has no compliance code; `StepCommitmentPanel` does), the `AssignedStageCard` commitment chip, and dedicated offer/accept notification templates (no `notify-*` function covers sub offers; offers ride the sub portal and `submit-sub-portal`'s `accept_offer`).
4. **Benched subs still mix into the Sub Labor sheet form's crew lists** (v2.2860 "not done") — `JobsSubLaborFormModal.tsx` `byKind('sub')` needs the roster `Person` type widened with the bench flag.
5. **Roster hygiene the owner still owns**: the archived "Edgar" name orphan (People → Subs; Combine people is the tool). The MIke / Miguel Rodriguez pair was settled 2026-09-06 — nothing to fold, keeper renamed `Miguel "Mike" Rodriguez`. Five older sub sheets still carry the plain "Miguel Rodriguez" label text (display resolves by id; only sheet search reads the text) — the combine tool's step-3 rewrite, if wanted.

## The plan

- ~~(1)~~ shipped v2.3064 as a display derivation (`subSheetStageDerived.ts`: 100% or an ended signed window → Waiting on inspection, hand moves after the evidence stand). Left: persist `auto` (trigger/RPC → Activity line) and portal parity — ride (2)'s Spanish pass.
- (4) rides the next roster-type change; (3) only if daily use asks for it; (2) with the next portal Spanish pass.

## How to verify

- A sheet whose stage window has ended and whose percent reads 100 shows Walk-through without anyone clicking.
- Portal in Español: the signature form's labels are Spanish.
- Bench a sub on People → Subs: the Sub Labor sheet form's crew list no longer offers them.
