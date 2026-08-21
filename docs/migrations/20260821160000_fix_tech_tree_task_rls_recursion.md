# 20260821160000 — fix tech-tree task RLS recursion (v2.1950)

- **Purpose**: HOTFIX. Every UPDATE on `checklist_tech_tree_group_tasks`
  failed with 42P17 (infinite policy recursion): the UPDATE policy's
  assignee OR-branch queried `checklist_tech_tree_task_assignees`, whose
  own SELECT policy joins `checklist_tech_tree_group_tasks` back. Broke the
  roadmap task card's title save for everyone (assignee-only writes were
  unaffected). Same class as the v2.1225 `people_labor_jobs` recursion.
- **Change**: new SECURITY DEFINER helper
  `user_is_assignee_of_tech_tree_task(uuid)` (evaluates the assignee link
  without invoking RLS); the tasks UPDATE policy is recreated on it with the
  same intended grants (roadmap structure editors, or task assignees who can
  see the roadmap).
- **Risk**: low — idempotent (`CREATE OR REPLACE` + `DROP POLICY IF
  EXISTS`), one policy swap, no data change.
