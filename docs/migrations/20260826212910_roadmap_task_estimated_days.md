# 20260826212910_roadmap_task_estimated_days.sql — roadmap task effort estimates (v2.2355)

`checklist_tech_tree_group_tasks.estimated_days numeric NULL` + range check
(0 < days ≤ 90, idempotent add). A task's WEIGHT for the Timeline — slot
widths and the observed-pace forecast — never a schedule; the Timeline's
no-stored-dates contract is unchanged. NULL = roadmap-average weight, so
unestimated roadmaps compute exactly as before. Additive; existing task RLS
covers it. Client (weighted widths, ⏱ stepper, effort-weighted 🎯, edge
drag) lands separately.
