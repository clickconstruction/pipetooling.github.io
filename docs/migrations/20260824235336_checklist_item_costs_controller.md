# 20260824235336 — checklist_item_costs opens to the controller

Widens the `checklist_item_costs_dev_all` policy (v2.2250, dev-only) to
`is_dev() OR is_controller()`, both USING and WITH CHECK — the controller
already reads `people_pay_config` wages, which is all a cost estimate reveals.
Deliberately not `has_payroll_access()` (that also includes pay-approved
masters). Policy name kept; DROP + CREATE, idempotent. No table changes.
Client counterpart: `canSeeTaskCosts(role)` sweep (v2.2258).
