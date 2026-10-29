SET lock_timeout = '3s';

-- v2.6095 — Supply-house bill capture, the form and the two doors (punch list #179 PR 3;
-- docs/migrations/20261030020000_supply_bill_read_on.md).
--
-- The switch 20261030010000 shipped off goes on: the office roles can start a bill from its PDF on the Add invoice
-- window, and the thread and the house's row show their doors. The client gates by role (dev, master_technician,
-- assistant, controller), so the switch alone shows nothing to anyone else. The owner or a dev turns it off again from
-- the Supply houses tab's own line (the row's UPDATE policy, is_master_or_dev()). With no model key on the Model keys
-- card the fill answers in words and the form stays typeable, so turning it on before the key is in costs nothing.
-- Idempotent: a row already on stays on.

UPDATE public.app_settings SET value_text = 'true' WHERE key = 'bill_read_on_v1' AND value_text IS DISTINCT FROM 'true';
