# 20260929001119_category_tags_office_read.sql (2026-09-29, v2.4106)

The office roles read the bank-category tags (punch list #52, the owner's call 2026-09-28). Two policies swapped; no table, column or function changes.

## Why

The tags decide what is fuel: the Job window's ⛽ Fuel & gas line, the cost timeline's ⛽ stream, and People → Spending. `mercury_category_tags` and `mercury_category_tag_members` were readable only by Banking staff (`can_manage_mercury_category_tags()` = `is_banking_staff()`: dev · master · controller), so an assistant — who reads the job's card charges, labels and allocations — saw every job's fuel folded into card charges.

## Who may do what (RLS), after

| | Who |
|---|---|
| **SELECT** | office staff — dev · master · assistant · controller (`is_office_staff()`), the set that already reads the accounting labels, attributions and job allocations the tags classify |
| **INSERT**, **UPDATE**, **DELETE** | Banking staff, unchanged (`can_manage_mercury_category_tags()`) |

The new `… office staff select` policies are created if missing; the old `… banking staff select` ones are dropped (they were a subset, and permissive policies OR together).

## House rules

Opens with `SET lock_timeout = '3s'`. Idempotent. Creates no table, so no read-only block calls.

## Apply

`supabase db push` once this is on `main`. The client needs nothing: it already reads the tags and degrades to "no fuel line" when it cannot.
