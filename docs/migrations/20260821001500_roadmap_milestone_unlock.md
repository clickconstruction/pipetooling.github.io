# 20260821001500_roadmap_milestone_unlock.sql (2026-08-20, v2.1913)

CREATE OR REPLACE of `sync_roadmap_to_checklist(p_roadmap_id)` making group completion milestone-aware: stages with tasks still complete when every task is done; stages with NO tasks now count complete once every predecessor is complete (plpgsql fixpoint loop so chains of empty stages cascade; empty roots are vacuously complete). Fixes task-less goal stages permanently locking their descendants — "Build and test Products" was unreachable behind two empty goal stages.

Mirrors `computeCompleteGroupIdsWithMilestones` in `src/lib/checklistTechTreeGraph.ts` — change them together. No schema changes, no new grants (REVOKE/GRANT re-stated). Idempotent; safe to apply before or after the v2.1913 client deploy (old client + new RPC just materializes more unlocked stages; new client + old RPC shows a stage unlocked slightly before its tasks materialize — self-heals on the next sync after push).
