# Subs: portal, work-order and notification residuals

Status: not started · sources: fragments v2.2667, v2.2844; [`docs/RUN_SUBS_PLAN.md`](../docs/RUN_SUBS_PLAN.md) status log deviations; sibling of [`work-orders-one-row-spine.md`](./work-orders-one-row-spine.md)

## The items (validated 2026-09-05)

1. **Sheet status derived from anchored steps** (v2.2667 deferred; the override shipped first). Still an override only.
2. **Spanish strings inside the shared signature form internals** (v2.2667). Portal chrome is bilingual; the shared signature component is not.
3. **`create_sheet_for_work_order(uuid)` still admits `superintendent` by role literal** and reads the commitment as definer without a row gate (v2.2844 "Noted, not changed"; drift row #28). Not a read/edit leak; belongs to the literal-role-array sweep.
4. **Run-subs polish never built** (plan deviations, 2026-08-01): assign-modal compliance chips (`StepFormModal.tsx` has no compliance code; `StepCommitmentPanel` does), the `AssignedStageCard` commitment chip, and dedicated offer/accept notification templates (no `notify-*` function covers sub offers; `respond_to_work_order` resolves by template type).
5. **Roster hygiene the owner still owns**: archived "Edgar" name orphan and the "MIke Rodriguez (Rough In)" vs "Miguel Rodriguez" question (People → Subs; Combine people is the tool).

## The plan

- (3) rides the role-literal sweep (one migration, many helpers) — do it with the next RLS PR on `step_commitments`.
- (1) after the one-row-spine to-do lands (the rail wants a derived stage).
- (4) only if daily use asks for it; (2) with the next portal Spanish pass.

## How to verify

- Sign-in as a superintendent (dev-login alias): Mark accepted on a work order not on their job is refused.
- Portal in Español: the signature form's labels are Spanish.
