# 20260821210000_partnership_ledger_notes.sql (2026-08-21, v2.2000)

Ledger notes: new `partnership_ledger_notes` table (partnership-scoped dated memos, `partner_visible` flag, dev-only RLS, index on partnership+date, both read-only sweeps) and `partner_ledger_payload` re-created with a `notes` array of partner-visible memos (date + memo only) — body otherwise verbatim from 20260821210000's predecessor 20260821200000. Partner never reads the table directly (RPC-first). Client (v2.2000) is fail-soft in either deploy order — the "+ note" button hides until this is applied.
