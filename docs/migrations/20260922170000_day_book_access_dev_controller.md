# 20260922170000_day_book_access_dev_controller.sql (2026-09-22, v2.3732)

**Purpose**: the Day book is devs and controllers only, for now (owner decision 2, 2026-09-22).

**Changes** — `CREATE OR REPLACE FUNCTION public.get_day_book_payload(date, date, uuid)`, the body of `20260922160000_day_book_estimators.sql` (PR 4) with the gate narrowed: `public.is_dev() OR v_role = 'controller'` → `v_money = v_pick = true`; every other role returns `{'error':'forbidden'}`. Nothing else in the body changed.

**Idempotent**: `CREATE OR REPLACE`; grants unchanged (`authenticated`, `service_role`). Additive. **Order**: after `20260922160000`.
