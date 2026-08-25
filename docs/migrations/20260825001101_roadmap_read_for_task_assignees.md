# 20260825001101_roadmap_read_for_task_assignees.sql — assignees read roadmap structure (v2.2261)

`can_select_checklist_tech_tree_roadmap(p_roadmap_id)` v2 (CREATE OR REPLACE;
v1 in the baseline): adds a third OR clause — the caller has an assignee row
(`checklist_tech_tree_task_assignees` → `group_tasks` → `groups`) on any task
in the roadmap.

This SECURITY DEFINER capability fn backs the SELECT policies on
`checklist_tech_tree_roadmaps`, `_roadmap_members`, `_groups`, `_group_tasks`,
and `_edges`, so the single replace broadens all five reads consistently.

Why: the v2.2261 stage-context chip shows every role the stage a bridged task
belongs to; field roles (helpers/subs) previously failed all tech-tree SELECTs
and rendered a bare "⛰ goal". Assignment-grants-read mirrors the
`project_superintendents` shape. Deliberate breadth (owner-approved): an
assignee of one task can read ALL stage/task titles in that roadmap. Writes
are untouched — edit/update policies use the separate structure-edit and
task-assignee capability fns.
