# 20260823142722_gc_statement_cc_emails.sql (2026-08-23, v2.2159)

CC on GC statement emails (Draft Message CC). Adds nullable `cc_emails text[]` to **`gc_statement_email_requests`** (scheduled sends; the dispatcher passes it to Resend `cc` and carries it onto the next weekly row) and to **`gc_statement_emails`** (audit of what was cc'd). Additive + idempotent; no RLS change (existing tables/policies cover the new column). **Apply order:** push before merging the client/edge PR that writes `cc_emails`; then redeploy `send-gc-statement-email` and `gc-statement-email-dispatch`.
