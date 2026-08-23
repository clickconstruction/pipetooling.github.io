SET lock_timeout = '3s';

-- Roadmap ★ pin (Next-up phase 3): the owner's "this one, now" override for
-- the Plan's ⚡ Next up shortlist — a pinned task leads its lane without
-- touching stage numbers or prerequisite arrows (the whole point of
-- pick-don't-sort: the numbers stay put, the shortlist just points).
--
-- Nullable timestamp: NULL = not pinned; the value orders multiple pins
-- (oldest pin first). Editors toggle it from the task card; the existing
-- UPDATE policy on checklist_tech_tree_group_tasks (structure editors via
-- user_is_assignee_of_tech_tree_task / can_edit_checklist_tech_tree_structure_for_roadmap)
-- already covers the write — no policy change. Additive and idempotent; the
-- client reads it tolerantly (select *) so either deploy order is safe.

ALTER TABLE public.checklist_tech_tree_group_tasks
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.pinned_at IS
  'Roadmap ★ pin: when set, the task leads its lane on the Plan''s Next up shortlist (oldest pin first). NULL = not pinned.';
