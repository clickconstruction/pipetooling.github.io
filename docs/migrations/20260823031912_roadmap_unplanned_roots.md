# 20260823031912_roadmap_unplanned_roots.sql (2026-08-22, v2.2127)

CREATE OR REPLACE of `sync_roadmap_to_checklist(p_roadmap_id)`: the milestone fixpoint (v2.1913, `20260821001500_roadmap_milestone_unlock.sql`) now requires a task-less stage to have **at least one incoming edge** before it can count complete. Task-less stages with no prerequisites are "not planned yet" — never complete — so their dependents stay locked until the stage gets tasks or a predecessor. Stages with tasks and milestones with predecessors are unchanged.

Mirrors `computeCompleteGroupIdsWithMilestones` / `unplannedGroupIds` in `src/lib/checklistTechTreeGraph.ts` — change them together. No schema changes, no new grants (REVOKE/GRANT re-stated); `SET lock_timeout = '3s'` up top. Idempotent; safe to apply before or after the v2.2127 client deploy — the only divergence is whether tasks in stages *behind* an empty root materialize onto Today lists, and the next sync after push reconciles.
