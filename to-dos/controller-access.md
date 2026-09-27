---
name: "Controller access: name the controller wherever the assistant is named"
number: 48
group: ready
status: audited 2026-09-27 against the live database · all five batches written · batches 1–4 pushed and verified
summary: >
  The controller role (v2.662) was made assistant-like by widening one function, `is_assistant()`.
  Every access rule and function that spells its roles out by hand was left behind: 253 rules on
  80 tables and 59 functions name the assistant and not the controller. Read as the sample
  logins, a controller sees no rows at all in 43 tables where the assistant sees data — supply
  houses, invoices, parts, every bid, every estimate, reports. Nobody real is a controller yet.
next: >
  Merge batch 5 and push its migration, read the audit queries again — they should return nothing — then delete this to-do.
size: M per batch · five batches
blocker: None — the three calls were taken 2026-09-27.
mockup: not required — access rules, no screen changes
opinion: build — the first person made a controller meets an empty Materials page and cannot mark an invoice paid.
---

# Controller access: name the controller wherever the assistant is named

## The ask

The owner, 2026-09-27, after the phone look found the sample controller's Supply houses page empty: *figure out why the controller sees no supply houses*, then *audit all 253, then fix in batches*.

## Why

The controller role shipped 2026-07-14 (v2.662) as *acts like an assistant, sees like a dev on money*. Its migration widened `is_assistant()` to mean assistant **or** controller, so every rule written through that function extended by itself. Rules that list their roles by hand did not. The supply-house write rules were corrected on 2026-09-08 (`can_manage_supply_house_directory`); its note says the select rules were left alone because every Materials reader could already read. For the controller that was not so.

## How it was audited

Read-only, against production, 2026-09-27:

1. Every permissive policy whose expression names `'assistant'::user_role` and neither `'controller'::user_role` nor `is_assistant()`, `is_controller()`, `has_payroll_access()`: **253 on 80 tables**.
2. Every function whose body names `'assistant'` and never `controller`: **59** (one name has two signatures).
3. A row count of each of the 80 tables as the sample assistant and as the sample controller, inside one read-only transaction: **43 tables** return rows to the assistant and none to the controller; 25 return the same; 12 are empty for both.

A rule that names the assistant is not always the only door — 25 tables read the same for both logins because a second rule admits the controller. Naming the controller in the first rule as well changes nothing there and keeps the two roles in step, so the fix is uniform: **wherever a rule lists the assistant, it lists the controller**.

## The rule for every batch

One migration per batch, `ALTER POLICY` only: same name, same command, the same expression read back from the database with one more role in its list. `SET lock_timeout = '3s'`. Pushed with `supabase db push` after the merge. Verified by reading the batch's tables again as the sample controller.

## The rules, by batch

### Batch 1 · Materials and supply houses

56 rules on 17 tables; 13 of them confirmed unreadable to a controller on 2026-09-27.

| Table | Rules | Actions | Read, as the sample logins |
|---|---|---|---|
| `assembly_types` | 3 | delete · insert · update | same for both |
| `fixture_labor_defaults` | 1 | select | assistant 5 rows · controller 0 |
| `fixture_types` | 3 | delete · insert · update | same for both |
| `material_part_price_history` | 2 | insert · select | assistant 2,439 rows · controller 0 |
| `material_part_prices` | 4 | delete · insert · select · update | assistant 2,309 rows · controller 0 |
| `material_parts` | 4 | delete · insert · select · update | assistant 1,998 rows · controller 0 |
| `material_po_generator_entries` | 1 | select | same for both |
| `material_template_items` | 4 | delete · insert · select · update | assistant 1,175 rows · controller 0 |
| `material_template_prices` | 4 | delete · insert · select · update | assistant 206 rows · controller 0 |
| `material_templates` | 4 | delete · insert · select · update | assistant 241 rows · controller 0 |
| `part_types` | 4 | delete · insert · select · update | assistant 29 rows · controller 0 |
| `purchase_order_items` | 5 | delete · insert · select · update | assistant 9 rows · controller 0 |
| `purchase_orders` | 4 | delete · insert · select · update | assistant 5 rows · controller 0 |
| `supply_house_invoice_bid_allocations` | 4 | delete · insert · select · update | no rows to tell |
| `supply_house_invoice_job_allocations` | 4 | delete · insert · select · update | assistant 432 rows · controller 0 |
| `supply_house_invoices` | 4 | delete · insert · select · update | assistant 472 rows · controller 0 |
| `supply_houses` | 1 | select | assistant 22 rows · controller 0 |

### Batch 2 · Bids, books and estimates

89 rules on 27 tables; 20 of them confirmed unreadable to a controller on 2026-09-27.

| Table | Rules | Actions | Read, as the sample logins |
|---|---|---|---|
| `bid_count_row_custom_prices` | 4 | delete · insert · select · update | assistant 7,720 rows · controller 0 |
| `bid_count_row_submission_hides` | 4 | delete · insert · select · update | assistant 20 rows · controller 0 |
| `bid_estimators_extra_users` | 2 | delete · insert | no rows to tell |
| `bid_payment_schedule_rows` | 4 | delete · insert · select · update | assistant 15 rows · controller 0 |
| `bid_pricing_package_sends` | 2 | insert · select | assistant 11 rows · controller 0 |
| `bids` | 4 | delete · insert · select · update | assistant 399 rows · controller 0 |
| `bids_count_rows` | 4 | delete · insert · select · update | assistant 9,771 rows · controller 0 |
| `bids_gc_builders` | 4 | delete · insert · select · update | assistant 42 rows · controller 0 |
| `bids_materials` | 4 | delete · insert · select · update | no rows to tell |
| `bids_submission_entries` | 4 | delete · insert · select · update | same for both |
| `bids_takeoff_rough_part_lines` | 4 | delete · insert · select · update | assistant 1,911 rows · controller 0 |
| `bids_takeoff_template_mappings` | 5 | delete · insert · select · update | assistant 25 rows · controller 0 |
| `bids_tally_parts` | 4 | delete · insert · select · update | no rows to tell |
| `cost_estimate_labor_rows` | 1 | delete | assistant 6,999 rows · controller 0 |
| `cost_estimates` | 1 | delete | assistant 262 rows · controller 0 |
| `estimate_customer_events` | 1 | select | assistant 114 rows · controller 0 |
| `estimate_field_photos` | 1 | select | no rows to tell |
| `estimate_photo_handover` | 1 | select | no rows to tell |
| `estimates` | 5 | delete · insert · select · update | assistant 33 rows · controller 0 |
| `estimates_thread_notes` | 2 | insert · select | no rows to tell |
| `labor_book_entries` | 4 | delete · insert · select · update | assistant 47 rows · controller 0 |
| `labor_book_versions` | 4 | delete · insert · select · update | assistant 5 rows · controller 0 |
| `price_book_entries` | 4 | delete · insert · select · update | assistant 29,884 rows · controller 0 |
| `price_book_versions` | 4 | delete · insert · select · update | assistant 298 rows · controller 0 |
| `takeoff_book_entries` | 4 | delete · insert · select · update | assistant 3 rows · controller 0 |
| `takeoff_book_entry_items` | 4 | delete · insert · select · update | assistant 5 rows · controller 0 |
| `takeoff_book_versions` | 4 | delete · insert · select · update | assistant 5 rows · controller 0 |

### Batch 3 · Jobs, customers, projects, reports and the rest

108 rules on 36 tables; 10 of them confirmed unreadable to a controller on 2026-09-27.

| Table | Rules | Actions | Read, as the sample logins |
|---|---|---|---|
| `address_geocodes` | 1 | delete | same for both |
| `customer_addresses` | 4 | delete · insert · select · update | assistant 446 rows · controller 0 |
| `customer_contact_persons` | 4 | delete · insert · select · update | same for both |
| `customer_contacts` | 4 | delete · insert · select · update | same for both |
| `customers` | 2 | insert · update | same for both |
| `external_team_job_payments` | 4 | delete · insert · select · update | assistant 4 rows · controller 0 |
| `external_team_sub_managers` | 4 | delete · insert · select · update | no rows to tell |
| `inspections` | 3 | insert · select · update | assistant 5 rows · controller 0 |
| `job_book_entries` | 3 | delete · insert · update | same for both |
| `job_collect_payment_flows` | 2 | select | no rows to tell |
| `jobs_ledger` | 4 | delete · insert · select · update | same for both |
| `jobs_ledger_fixtures` | 4 | delete · insert · select · update | same for both |
| `jobs_ledger_invoice_stripe_email_sends` | 1 | select | same for both |
| `jobs_ledger_invoices` | 4 | delete · insert · select · update | same for both |
| `jobs_ledger_materials` | 4 | delete · insert · select · update | same for both |
| `jobs_ledger_payments` | 4 | delete · insert · select · update | same for both |
| `jobs_ledger_team_members` | 3 | delete · insert · select | same for both |
| `jobs_receivables` | 4 | delete · insert · select · update | same for both |
| `jobs_tally_parts` | 4 | delete · insert · select · update | same for both |
| `mercury_transaction_bid_allocations` | 4 | delete · insert · select · update | assistant 3 rows · controller 0 |
| `people` | 2 | insert · select | same for both |
| `people_labor_job_assignees` | 3 | delete · insert · update | same for both |
| `people_labor_job_items` | 4 | delete · insert · select · update | same for both |
| `people_labor_job_payments` | 4 | delete · insert · select · update | same for both |
| `people_labor_jobs` | 4 | delete · insert · select · update | same for both |
| `project_superintendents` | 3 | delete · insert · select | assistant 1 rows · controller 0 |
| `project_workflow_steps` | 4 | delete · insert · select · update | assistant 27 rows · controller 0 |
| `project_workflows` | 1 | insert | same for both |
| `projects` | 2 | insert · update | same for both |
| `push_subscriptions` | 1 | select | assistant 15 rows · controller 0 |
| `reports` | 3 | insert · select · update | assistant 550 rows · controller 0 |
| `schedule_day_email_requests` | 1 | insert | no rows to tell |
| `user_dashboard_goals` | 1 | all | assistant 26 rows · controller 0 |
| `user_report_notification_preferences` | 1 | all | no rows to tell |
| `workflow_step_dependencies` | 3 | delete · insert · update | no rows to tell |
| `workflow_step_line_items` | 4 | delete · insert · select · update | assistant 86 rows · controller 0 |

## The functions

| Batch | Functions | What they gate |
|---|---|---|
| 4 · Money actions (24) | `apply_agreed_write_down_to_billed_invoice`, `apply_mercury_bank_payment_allocations`, `approve_collect_payment_for_terminal`, `clear_mercury_transaction_duplicate`, `count_mercury_transactions_for_bank_payments`, `create_hazmat_fee_incident`, `create_turnaway_trip_charge`, `delete_billed_invoice_on_send_back`, `delete_ready_to_bill_invoice`, `dismiss_mercury_duplicate_pair`, `ensure_single_ready_to_bill_invoice_for_job`, `get_invoice_allocation_lines_for_jobs`, `get_invoice_amounts_for_jobs`, `list_ar_allocations_for_mercury_transaction`, `list_mercury_transactions_for_bank_payments`, `list_stale_unlinked_mercury_transactions_for_tally_staff`, `list_unlinked_payments_for_bank_payments`, `mark_invoice_paid`, `mark_job_paid`, `remove_jobs_ledger_payment_and_reconcile`, `revert_stripe_oob_invoice_payment`, `set_job_collections_flag`, `set_mercury_transaction_ar_returned`, `set_mercury_transaction_duplicate` | Marking invoices and jobs paid, bank-payment matching, write-downs, trip and hazmat charges |
| 5 · Everything else (31) | `assert_caller_can_merge_customer_pair`, `can_access_bid_for_pricing`, `can_access_step_for_action`, `can_manage_inspection_types`, `can_manage_schedule_share`, `can_manage_team_leader_assignments`, `can_read_job_activity`, `get_man_hours_by_job`, `insert_material_po_generator_entry`, `is_bid_pricing_user`, `is_dev_or_master_or_assistant`, `jobs_ledger_row_visible_for_tally_assign`, `list_job_schedule_blocks_for_schedule_email`, `list_reports_for_bid`, `list_reports_for_job_ledger`, `list_reports_with_job_info`, `list_schedule_blocks_for_share`, `list_tally_parts_with_po`, `migrate_job_ledger_costs_and_delete`, `migrate_job_ledger_costs_to_bid_and_delete`, `record_estimate_decline`, `set_material_po_generator_stated_need`, `split_job_ledger_fixtures_to_new_job`, `staff_can_view_user_for_tally_followup`, `update_job_status`, `update_step_assigned_to`, `update_step_assignment`, `update_step_notes`, `update_step_private_notes`, `user_can_manage_estimate_catalog`, `user_can_manage_recurring_job_report_scope` | Reports, schedule shares, steps, job status, estimates, tally |
| 5 · Membership triggers (4) | `dispatch_group_members_enforce_assistant`, `enforce_user_app_activity_viewer_role`, `enforce_user_labels_scope_master`, `estimator_group_members_enforce_roles` | Who may be put in a group — see the calls |

Functions are rewritten whole (`CREATE OR REPLACE`), so each is read before it is changed; a rule is one line, a function is a body.

## Three calls for the owner, before batch 5 — taken 2026-09-27: yes to all three, *keep controller the same as assistant*

1. **May a controller be a member of the Dispatch inbox group and the Estimator inbox group?** The triggers allow assistants and estimators only.
2. **May a controller be an activity viewer?** The trigger allows assistant, master technician and primary.
3. **May a controller read other people's push subscriptions** (`push_subscriptions`, today masters and assistants) **and merge customers** (`assert_caller_can_merge_customer_pair`, today assistants)? Both are what an assistant can do; saying yes keeps the two roles the same.

## How to verify a batch

As the sample controller on a phone or a desk: Materials → Supply houses lists the houses and Accounts payable shows balances (batch 1); Bids and Estimates list (batch 2). The row-count read of step 3 above, rerun, is the measure: the batch's tables read the same for both logins.
