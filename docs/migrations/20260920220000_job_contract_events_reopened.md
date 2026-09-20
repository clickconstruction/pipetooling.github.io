# 20260920220000_job_contract_events_reopened.sql (2026-09-20, v2.3647)

Signing it on paper, PR 6. Adds `reopened` to `job_contract_events_event_type_check` (drop + re-add, as 20260903191531 did for `shared`) — the event *Edit & re-send* writes when an unopened agreement goes back to a draft in place, with `metadata { from_revision, to_revision, channel }` and the actor.

**Apply order:** either. The client's event insert is fail-soft: before the push the unlock still works (the guarded update on `job_contracts` needs no schema change) and only the `reopened` event is refused; the revision bump is the record until then.
