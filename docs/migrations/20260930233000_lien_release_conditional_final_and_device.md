# 20260930233000_lien_release_conditional_final_and_device.sql (2026-09-30, v2.4274)

Our lien waiver to the GC, PR 1. Two additive changes to `job_lien_releases`:

- `form_type` CHECK widened to admit `conditional_final` — Texas Property Code § 53.284(d), the fourth statutory form. The sub-side dialog already picked it for a sub's last payment; the Release of Lien window could not issue it, so the office had no conditional form to send with the last bill to a GC.
- `signed_on_device_of uuid` (FK `users`, nullable): when the leader signs on the assistant's screen — *He signs now* — `signer_user_id` stays the leader and this column names whose device it was. Null when he signed from his own desk. The audit line under the signature reads *· on Taunya's device* when it is set.

Apply order: push after the client deploys — the client writes `conditional_final` and the new column only from doors the old client did not have, and reads both tolerantly (`signed_on_device_of` is optional on the row type until `gen-types`). No backfill; existing rows are unchanged.
