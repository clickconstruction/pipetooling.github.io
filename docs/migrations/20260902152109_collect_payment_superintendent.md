# 20260902152109_collect_payment_superintendent

**v2.2637** — the field collect flow's three client-callable RPCs admit superintendents.

- `get_collect_payment_certify_payload`, `add_collect_payment_fixture_from_job_book`, `submit_collect_payment_certification`: role gate `NOT IN ('subcontractor','helpers')` → `+ 'superintendent'`. Bodies verbatim from baseline otherwise; function-only, idempotent.
- Unchanged by design: the `jobs_ledger_team_members` requirement on the ready_to_bill job (no project-based access added — the Collect button only appears on assigned rows) and the office-only `approve_collect_payment_for_terminal` step. Companion edge-fn role widenings (`send-stripe-invoice`, `update-collect-payment-stripe-customer-email`) ship in the same PR.
