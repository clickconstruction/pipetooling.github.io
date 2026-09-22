# 20260922143000_strip_null_address_token.sql (2026-09-22, v2.3719)

**Purpose**: the one-time cleanup v2.2609 wrote out and did not run. Old imports left a literal `Null` where the zip belongs (`9703 Lenox Hl San Antonio, TX Null`); the display layer has stripped it since 2026-09-01, but the lien paper reads the raw column and printed it — the GC-on-notice preview caught it live on 2026-09-21 (`to-dos/gc-on-notice/`, punch list #16).

**Changes** (data only, no DDL)
- `jobs_ledger.job_address`, `customer_addresses.address`, `customer_addresses.owner_mailing_address`: a trailing `[\s,]+null\s*$` token (case-insensitive, the whole last word) is removed. A real zip stays; `12 Nullarbor Way` is untouched; a value that is only the token is left alone (never strips to empty).
- One `DO` block; `RAISE NOTICE` prints the three row counts at push time.

**Writers**: none in the repo write the token (checked 2026-09-22 — no address formatter in `src/`, `scripts/` or `supabase/functions/` joins a null into the string); it came from the original spreadsheet imports. The client guards against a future one with `cleanStoredAddress` (`src/lib/displayAddress.ts`) inside every paper kernel.

**Idempotent**: yes — a second run matches no rows. Not destructive: the only characters removed are the junk token. No new table, so no read-only-block calls.

**Deploy order**: any — the client's paper fix (same PR) reads clean either way.
