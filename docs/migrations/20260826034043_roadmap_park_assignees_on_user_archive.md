# 20260826034043_roadmap_park_assignees_on_user_archive.sql — roadmap assignments follow user archiving (v2.2317)

New table `checklist_tech_tree_task_assignees_parked` (task_id, user_id,
parked_at; RLS: dev SELECT only, no client writes) + SECURITY DEFINER
trigger `roadmap_assignees_follow_user_archive` on `users` (AFTER UPDATE OF
archived_at). Archive: assignments on OPEN roadmap tasks move to the parked
table (completed tasks keep their names). Restore: parked assignments
re-insert only where the task is still open with zero current assignees,
then all the user's parked rows clear. Single choke point — fires for any
path that flips `users.archived_at` (archive-user / restore-user edge
functions, merge-users, manual SQL). Ends with both read-only blocks.
