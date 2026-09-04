# 20260904020000_signed_agreements_stream (v2.2743, 2026-09-04)

Two service-role functions behind the **Signed agreements** email stream, plus a one-time fold.

- **`signed_agreement_notify_recipients(p_master_user_id)`** → `uuid[]`. Reads `app_settings.signed_agreements_notify_recipients_v1` (JSON array of user ids). Empty or missing → every active, non-twin user whose role is `dev`, `master_technician`, `assistant`, or `controller`. Either way the set goes through the existing `estimate_accept_notify_filter_eligible_user_ids` (org scope + has an email).
- **`auto_create_job_from_signed_estimate(p_estimate_id)`** → `uuid`. Returns the estimate's job if already linked; if the estimate carries a bid that already has a job, links that job and returns it; otherwise builds the Specific Work rows from `line_items_snapshot` (same mapping as the Create-job modal), sets the transaction-local JWT claims to the estimate's `master_user_id`, and calls the real `create_job_from_estimate` with `next_job_number_suggestion()`. The v2.2741 trigger then stamps the job's `bid_id`. Only the signature edge functions call it, and only when the matching auto-create toggle is on.
- **Fold**: if `estimate_accepted_notify_recipients_v1` has a value and the new key has none, the old list is copied in. The old key is no longer read by `accept-estimate`.

No table or column changes; no types regen needed (the app never calls these).
