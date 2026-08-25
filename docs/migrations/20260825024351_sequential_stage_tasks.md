# 20260825024351 — sequential stage tasks

`checklist_tech_tree_groups.sequential` (default true) + rebuilt
`sync_roadmap_to_checklist` (sequential materialization gate + de-materialize
sweep that never deletes completed/reviewed/commented items; returns
`{created, removed}`) + trigger `trg_materialize_next_sequential_task`
(completing a task materializes the next sibling instantly; created_by carried
from the completed task's item). Idempotent. See
`docs/recent-features/v2.2264.md`.
