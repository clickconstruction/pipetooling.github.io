# 20260922123000_job_contract_events_reopened.sql (2026-09-22, v2.3723)

Widens `job_contract_events.event_type`'s CHECK to admit `reopened`. Edit & re-send (v2.3647) has inserted that event on every unlock since it shipped, fail-soft, and the CHECK from `20260903141146_job_contracts.sql` refused every one — found on the first live pass of the Signing it on paper train (the to-do's owed pass, `to-dos/contract-paper-lane/`). Additive; apply in either order with the client.
