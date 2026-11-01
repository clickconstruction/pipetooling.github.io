# 20261101161800_legal_digest_every_office_act.sql (2026-11-01, v2.6283)

Punch list #233, PR 4: the firm's weekly digest carries every office act (the owner's call 3).

- `legal_notification_queue`'s trigger CHECK becomes `legal_notification_queue_trigger_check_v3`: the seven of v2 plus `step`, `plan`, `event`, `offer`, `statement`, `paper`, `released` (the v2 constraint is found by definition and dropped; the new one is added `NOT VALID`, then validated).
- `legal_entries_notify_answer()` (same name, so the existing `AFTER INSERT` trigger runs it) now also queues the office's `step` (payload `body`, `stage`; a step whose body only echoes a release or a pull-back is left to the `referred` / `pulled` rows), `plan` (the body with *· planned for Mon D*), `event`, `offer` (the body prefixed *made by the office* / *received by the office*, with `amount`) and `statement` (its title). A plan, event, offer or statement held back under the matter's `held_overrides` (`<kind>:<id>` = true) at insert is not queued.
- New `legal_matter_documents_notify()` with two triggers on `legal_matter_documents`: `AFTER INSERT` queues `paper` (the title) unless the row is held or voided; `AFTER UPDATE OF held_reason` queues `released` when a held paper's reason is cleared.

The dispatcher holds every new trigger to the digest (`legalTriggerSendsNow`), and from v2.6283 each digest reads back to that person's own last digest (or their confirmation, at most eight days), so two people on different weekdays no longer split the week. No columns change.

**Apply order: deploy `legal-notify-dispatch` first** (v2.6283 knows every trigger; the old dispatcher stamps an unknown trigger with nobody to send to and leaves it out of the digest). Then push this. `submit-legal-portal` and `legal-portal` bundle the shared email file and can redeploy at leisure.
