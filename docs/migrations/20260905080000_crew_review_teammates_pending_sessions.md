# 20260905080000_crew_review_teammates_pending_sessions

**Crew deck finds teammates from pending sessions too (v2.2827)** — `CREATE OR REPLACE` of `crew_review_teammates(integer, uuid[])`.

## What it does

The v2.2824 function counted only `approved_at IS NOT NULL` sessions. Approvals lag the week (108 pending vs 27 approved sessions in the trailing 14 days on 2026-09-05), so the deck was almost always empty. Now a session counts when `rejected_at IS NULL AND revoked_at IS NULL`. Same signature, same output shape; the office's `list_team_member_recent_jobs` (approved-only) is untouched.

## Order

Any time after `20260905070000`. Nothing in the client changes shape.

## Rollback

Re-run the function body from `20260905070000_crew_reviews_three_bars.sql` section 3.
