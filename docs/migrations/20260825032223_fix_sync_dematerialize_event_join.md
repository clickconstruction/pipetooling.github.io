# 20260825032223 — fix sync de-materialize event join

`sync_roadmap_to_checklist` referenced `ev.checklist_instance_id`; the events
table's column is `instance_id`. Every sync errored between the 20260825024351
push and this one. Body otherwise identical to v2.2264's.
