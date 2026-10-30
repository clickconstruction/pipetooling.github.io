# 20261030020000_supply_bill_read_on.sql (2026-10-29, v2.6095)

Supply-house bill capture, the form and the two doors (punch list #179 PR 3). One `UPDATE`: the switch `app_settings.bill_read_on_v1` that `20261030010000` shipped as `'false'` goes to `'true'`, so the office can start a bill from its PDF on the Add invoice window and the thread and the house's row show their doors. The client gates by role (dev, master_technician, assistant, controller); the owner or a dev turns it off again from the line beside the Accounts payable heading (the row's own UPDATE policy, `is_master_or_dev()`). With no model key on the Model keys card the fill answers in words and the form stays typeable, so the switch costs nothing before the key is in. Idempotent.

**Order**: after `20261030010000_supply_bill_read.sql`. The client of v2.6095 reads the switch fail-soft (off until the row reads on), so it may deploy before or after.
