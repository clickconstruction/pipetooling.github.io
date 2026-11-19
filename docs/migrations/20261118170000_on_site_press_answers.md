# 20261118170000_on_site_press_answers.sql (2026-11-18, v2.7827)

Materials on site: an answer to a press. The third PR of the train that reads a site's presses by person. Database only; the window that gives an answer comes in a later PR.

- **`job_movement_answers`**: one row an answer to a ledger row: `taken_back` or `marked`, why, who and when, and its withdrawal (when, who, why). One live answer a press (a unique index over the rows not withdrawn). An answer is withdrawn with a reason and never deleted. `job_movement_answers_stamp` makes the giver and the withdrawer the caller, keeps the press, the answer and its reason from changing, and closes a withdrawn answer.
- **`job_material_movements.taken_back_at`**: the live switch, set while a taken-back answer stands on the row. `job_movement_answers_switch` (AFTER INSERT OR UPDATE on the answers) sets and clears it, so the two never disagree. `job_material_movements_arrive_standing` (BEFORE INSERT) clears it on every new press, so a client cannot send a press already taken back.
- **`job_material_movements_not_taken_back`**: a RESTRICTIVE SELECT policy on the ledger, `taken_back_at IS NULL`. The screens' kernel, `on_site_job_summary`, `on_site_line_on_hand` and the dev seat all sum under the caller's RLS, so one policy closes a row to every sum at once. The owner-run functions that carry rows between jobs or rename them (`on_site_carry_job`, the combine, `merge_material_parts`, `job_part_renames_judge`) do not see the policy and still carry a taken-back row, which is wanted.
- **`on_site_taken_back_rows(uuid[])`**: the rows the policy closes, on the jobs asked for, for History. `SECURITY DEFINER`; answers the office only (`on_site_reads_answers()`: dev, master_technician, assistant, controller) and no row to anyone else.
- **Who.** The office reads answers. A dev gives one and withdraws one. Nobody deletes one. A marked press changes no number.
- One column added to the ledger (metadata only), one policy added to it. Idempotent. Ends with the four fences.

Apply: `supabase db push` after the merge. No client gives an answer yet, and with no answer on record the policy closes no row.

Undo, if the policy ever misbehaves: `DROP POLICY job_material_movements_not_taken_back ON public.job_material_movements;` brings every row back into every read at once and loses nothing.

**Applied** to prod on 2026-11-19 by `scripts/db-push.sh`, after #8773 merged. Read back: the `taken_back_at` column, the RESTRICTIVE policy `job_material_movements_not_taken_back`, `job_movement_answers` with its select, insert and update policies and its two triggers, and both functions. No ledger row was taken back and no answer was on record, so the policy closed nothing.
