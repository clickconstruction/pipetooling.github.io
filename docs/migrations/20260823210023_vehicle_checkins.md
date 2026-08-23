# 20260823210023_vehicle_checkins.sql (2026-08-23, v2.2199)

**Purpose:** vehicle check-in history — Quickfill's Vehicle check-ins station saves one row per
capture (odometer + the configured questions' answers), so the vehicle ledger can show when each
truck was last looked at, by whom, and what was flagged.

**Mechanism:** `vehicle_checkins` (`vehicle_id` FK → vehicles CASCADE, `odometer_entry_id` FK →
vehicle_odometer_entries SET NULL, `checkin_date`, `answers` jsonb `[{q, flagged, comment}]`
storing question text **as asked**, `created_by` FK → users) + index `(vehicle_id, checkin_date
DESC)`. RLS: office pool (`is_dev() OR is_pay_approved_master() OR is_assistant()`), plus both
read-only blocks (`apply_read_only_write_blocks` + `apply_read_only_stmt_blocks`).

**Safety:** additive CREATE TABLE IF NOT EXISTS; idempotent; `SET lock_timeout = '3s'`; rollback =
drop table. Client is fail-soft pre-push (reading still saves; check-in log skipped), so deploy
order is flexible — but push promptly so questions start recording.
