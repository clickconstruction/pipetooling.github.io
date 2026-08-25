# 20260825190000 — Quick Estimate groundwork (v2.2292)

Groundwork for the Quick Estimate wizard (field-authored change orders/estimates, sent to Dispatch to finish):

- **`estimates.sent_to_dispatch_at timestamptz`** — stamped when the field author hands the draft to Dispatch; drives the Estimates list "With Dispatch" chip and the wizard's already-sent state. Null for office-authored drafts.
- **`estimate_field_photos`** (new table) — metadata for wizard-captured photos (`estimate_id` FK cascade, `storage_path` unique, filename/mime/size, `created_by`). RLS: select mirrors `estimates_select` visibility (access helpers + broad office roles); insert only by the author onto draft estimates they can access; delete by author or dev. Ends with both `apply_read_only_write_blocks()` and `apply_read_only_stmt_blocks()`.
- **Subcontractor joins the estimates role gates** — `estimates_insert` / `estimates_select` / `estimates_update_draft` recreated with `subcontractor` added to the OUTER role arrays only. The inner broad-visibility arrays are unchanged, so a sub passes only through `user_can_access_estimate` (rows they created / own as `master_user_id`) — never the whole ledger. `resolveEstimateMasterUserId` maps subs to themselves, so their wizard drafts satisfy the `master_user_id = auth.uid()` insert branch.

**Out-of-band storage step** (matches how `estimate-acceptor-signatures` and `hr-files` were set up — storage schema is not in the migration ledger): create the private `estimate-field-photos` bucket + policies. SQL is in `docs/recent-features/v2.2292.md`.
