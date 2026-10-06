# 20261006170000_legal_firm_notify_events.sql (2026-10-05, v2.4649)

Punch list #85, item 17, PR 2: every office event emails the firm.

- `legal_notification_queue`'s trigger CHECK becomes `legal_notification_queue_trigger_check_v2`: `referred`, `answer`, `pulled`, `ask`, `note`, `applied`, `fee_seen` (the old inline CHECK is found by definition and dropped; the new one is added `NOT VALID`, then validated).
- `legal_entries_notify_answer()` (same name, so the existing `AFTER INSERT` trigger runs it) now queues every office entry the firm should hear about: an `answer` (payload adds `question`, the firm's question it answers by `meta.askId`), a `question` → `ask` (`flavor`, `jobLabel`), a `note`, a `recovery_applied` → `applied` (`amount`).
- New `legal_entries_notify_fee_seen()` + trigger `AFTER UPDATE OF acknowledged_at`: the office acknowledging a firm fee or cost queues `fee_seen` (digest only).

**Apply order: deploy `legal-notify-dispatch` first** (v2.4649 knows every trigger and skips unknown ones; the old dispatcher words any trigger it does not know as *Pulled back*). Then push this. `submit-legal-portal` redeploys for the shared email bundle only.
