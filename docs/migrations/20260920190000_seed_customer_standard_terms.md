# 20260920190000_seed_customer_standard_terms.sql (2026-09-20, v2.3642)

Signing it on paper, PR 4 (`to-dos/contract-paper-lane`). Seeds the customer's standard terms into the Contract Book: a `contract_templates` row **Customer agreements** (created only if missing) and one `contract_template_documents` row **Service agreement** — `audience = 'customer'`, `book_body_format = 'plain'`, `book_version_date = 2026-09-20`, body = `DEFAULT_JOB_CONTRACT_TERMS_PLAIN` word for word (dollar-quoted; `src/lib/jobs/jobContractTermsSeed.test.ts` fails CI if the two drift).

**Idempotent and non-destructive:** the whole block returns early when the Book already holds any customer-audience document, so an office that wrote its own is never overwritten and a re-run inserts nothing. No DDL, no RLS change — who may edit is the Book's existing rule (dev, pay-approved master, assistant / controller through `update_contract_book_entry`), which the owner confirmed on 2026-09-20.

**Apply order:** either. Before the push the client shows *Built-in service agreement terms* with no Edit door, exactly as before; after it, the sweep and the Contract window pick the seeded document up on their next open.
