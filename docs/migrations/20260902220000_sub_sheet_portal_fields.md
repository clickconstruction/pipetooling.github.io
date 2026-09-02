# 20260902220000_sub_sheet_portal_fields

**Sub-portal train — sheet status + pay-timing, payment memo visibility.**

## What it does

- `people_labor_jobs` gains three nullable portal fields: `portal_status` (`in_progress`|`complete` override for the job-card chip; NULL = derive/show nothing), `payable_after` (date the open balance becomes payable), `pay_hold_reason` (plain words the sub reads verbatim). All optional — a blank sheet shows the open balance with no promise.
- `people_labor_job_payments.hidden_from_sub` (default false): hides the **memo** on the sub portal; the amount always shows so the recap sums to what actually moved.
- Office-writer RPCs (dev / assistant-like / master_technician): `set_sub_sheet_portal_fields(p_labor_job_id, p_portal_status, p_payable_after, p_pay_hold_reason)` and `set_sub_payment_visibility(p_payment_id, p_hidden)` — the pre-regen client calls these instead of direct column writes.

## Client surfaces

The "Shown on the sub's portal" box in the Sub Labor sheet editor (`SubSheetPortalFieldsBox`), the memo hints + hide toggle in the payment modals, and the portal's job cards / ledger read these.
