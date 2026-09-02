# 20260901232549_crew_day_email_office_only

**v2.2615** — tightens the `crew_day` email stream to office roles on both sides.

- Recreates the `crew_day_email_requests` INSERT policy: requester AND recipient role checks drop `superintendent` (now dev/master_technician/assistant/controller only). Policy-only migration — no table changes, no read-only sweeps needed.
- Pairs with the same-version client gate (`isCrewDayEmailRole`) and the redeployed `crew-day-email-dispatch` role sets; the dispatcher stamps any pre-existing superintendent-addressed row "ineligible role" instead of sending.
- Why: owner decision (2026-09-01) — superintendents use the Dashboard Crew Day section, not email.
