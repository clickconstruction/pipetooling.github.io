# 20261103090000_hours_statement_basis.sql (2026-11-03, v2.6446)

The hours statement's basis (punch list #251, PR 2): a saved statement says whether it prices the days at what the worker was paid or at what the customer is charged.

- **`hours_statements.basis text NOT NULL DEFAULT 'paid'`** — paid · charged, a NOT VALID check; **`charge_rate numeric`** — on the charged basis, the headline rate the paper was charged at (the job's shape or flat rate, else the master-with-a-helper row), dollars for the crew's hour; **`charge_words text`** — the words under the signature. A second NOT VALID check holds `with_pay = false` on a charged row: the charged paper never carries pay.
- **No gate change.** `can_touch_hours_statement(with_pay)` already admits every office role to a row with the pay left off, and a charged row is one; the paid paper's gate stands as it was.
- **No table, no policy, no fence calls** — three nullable-or-defaulted columns on an existing table.

**Apply order**: the client writes `basis`, `charge_rate` and `charge_words` through a cast and reads a missing `basis` as paid, so the client may deploy first: a charged paper saved before the push is refused with its reason (the column does not exist) and nothing is lost. Push right after the merge, then regenerate the types.
