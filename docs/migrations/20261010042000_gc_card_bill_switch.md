# 20261010042000_gc_card_bill_switch.sql

GC mode, Owner Billing's O8c: Pay by card's switch becomes an `app_settings` row the owner turns on (v2.5125). The plan is `to-dos/gc-mode/mockups/owner-billing-o8.md` on branch `spike/gc-mode` (29b9142bf), whose second SQL block is this file byte for byte but for the version; the card bills are O8a's (`20261010026000`) and O8b's (`gc-card-bill`, v2.5123).

**Why:** O8b read the switch from an env value, `GC_CARD_BILL_ON`, which only its two functions could see. The office's Bill the customer and `gc-customer-email`'s card lines need it too. The lead's call (2026-10-09): one row the whole app reads, so "the owner says live" is the owner's own press in Settings. **This row replaces the env value `GC_CARD_BILL_ON`, which goes away.** Stripe's test or live stays an env value (`GC_CARD_BILL_STRIPE_MODE`): infrastructure, not an office press.

## What it does

1. **The row**: `app_settings.gc_card_bill_on_v1` = `'false'`, inserted once (`ON CONFLICT DO NOTHING`). Only `'true'` is on (`gcCardBillOn` in `_shared/gcCardBill.ts`), and a missing row reads off.
2. **Who flips it**: the policy `master_or_dev_update_gc_card_bill_on`, `FOR UPDATE TO authenticated`, on this key only, for `is_master_or_dev()` (the owner, `master_technician`, and dev). Dev already manages every row ("Devs can manage app settings"). It is the `owner_auto_confirm_from_roll_v1` pattern (`20260914270000`). The read-only and digital-twin fences already on `app_settings` stop a training account and a twin.
3. **Who reads it**: everyone signed in, through the table's existing read policy: Bill the customer's hint (`fetchGcCardBillOn`, `src/lib/gc/cardBillSetting.ts`) and Settings → Jobs & billing's toggle (`GcCardBillSettingsBlock`). `gc-card-bill`, `customer-portal` and `gc-customer-email` read it as the service role.

No table is created, so no `apply_*` calls.

## The lock note

`CREATE POLICY` takes a brief lock on `app_settings`, which many reads touch. `SET lock_timeout = '3s';` heads it, so a busy moment fails the push fast rather than queueing reads behind it.

## Verify after the push

Read only:
1. **The row, off.** `SELECT value_text FROM public.app_settings WHERE key = 'gc_card_bill_on_v1'` gives `false`.
2. **The policy.** `pg_policies` has `master_or_dev_update_gc_card_bill_on` on `app_settings`, `UPDATE`, for `authenticated`, its `qual` and `with_check` naming `gc_card_bill_on_v1` and `is_master_or_dev()`.
3. **Who flips it**, in `BEGIN … ROLLBACK`: as the controller, `UPDATE public.app_settings SET value_text = 'true' WHERE key = 'gc_card_bill_on_v1'` reaches 0 rows; as the owner it reaches 1.

Turning it on is the owner's press in Settings, after the live walk on Grace's yes. It stays off until then.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies this migration right after it runs and plays `91_card_switch.sql`, 11 checks:
- the row starts off, with its one key-scoped UPDATE policy;
- the owner turns it on and off, writes no other key with it, and cannot delete it;
- a dev turns it on and off;
- the controller, an estimator (who still reads it) and the owner in training mode do not flip it;
- nobody signed out reads it.

It ran on a local Docker copy of the whole schema with every migration applied; all ten Owner Billing files passed. Five mutants of the migration were each caught: the policy on any key, dev only, the row inserted on, every verb instead of UPDATE, and anyone signed in.

## Status

Cut 2026-10-09 by Helper 5 (the Owner Billing lane). Merged 2026-10-10 at about 02:55 UTC (#5247). Pushed to prod at 03:02 UTC by the GC MODE lead with `bash scripts/db-push.sh`, plain, the only pending file (drift 843 local / 843 remote, fully applied). Verified the same minute with the spike's `to-dos/gc-mode/scripts/verify/verify-042000.mjs`, writes rolled back: 1 `gc_card_bill_on_v1` reads `false`; 2 the policy `master_or_dev_update_gc_card_bill_on` is UPDATE for `authenticated` with the key and `is_master_or_dev()` in both `qual` and `with_check`; 3 the controller's UPDATE reaches 0 rows and the owner's reaches 1, and the row still reads `false` after. `gc-card-bill`, `customer-portal` and `gc-customer-email` deployed at 03:03 UTC with `--use-api`; no `GC_CARD_BILL_ON` secret exists on the project, so the row is the only switch, and it is off. A dry types gen is byte-equal to main, so no types PR follows.
