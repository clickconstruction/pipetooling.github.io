# 20260905163807_sub_stage_activity_summary

**Sub sheet stages polish (v2.2854)** — the stage → Activity line drops its "Sub labor · " prefix.

## What it does

- `CREATE OR REPLACE FUNCTION public.people_labor_jobs_stage_to_activity()` (trigger from `20260904195443`, lookup from `20260904210406`, both unchanged): the summary now reads `<contractor>: <from> → <to>[ (from the sub portal)][ · “note”]`. `detail` is identical to before.
- One idempotent `UPDATE` rewords the `sub_stage_change` rows already on feeds by stripping the prefix (only rows that still carry it).

## Order

Any time after `20260904210406`. No client or function deploy.
