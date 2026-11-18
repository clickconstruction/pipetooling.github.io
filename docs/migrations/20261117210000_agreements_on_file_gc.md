# 20261117210000_agreements_on_file_gc.sql (2026-11-17, Documents → Agreements reads GC mode's papers, punch list #376)

The last step of the card: the `agreements_on_file` view (`20261117200000`) gains the three kinds it left for later. Shipped as v2.7625; the rules are `src/lib/documents/agreementsLedger.ts`.

- **`company_agreement`**: a trade company's agreement, a `person_contract_documents` row with a `company_id`, which the person branch left out. The branch now joins `gc_companies` and names the company as the party. The name the row is filed under (`gc-company:<id>`) is never shown and never in `find_text`.
- **`owner_contract`**: our contract with the owner on a GC project, from `gc_owner_contract_sends`. Every send is a row (the first, each reminder, each new price) and the newest is the one to sign, so the line is `DISTINCT ON (project_id)` newest first. `signed` once `signed_on` is set, else `waiting`. `facts` is `sent_on`, `sign_by`, `signed_on`, so the page can say *late, asked to sign by …*.
- **`sow`**: a trade's statement of work, from `gc_sows` where `status <> 'draft'`: `sent` waits, `signed` is signed, `cancelled` is ended. Named *Statement of work · <trade>*, with the company as the party.
- **A GC project is not a `jobs_ledger` job**, so `job_id` and the job's numbers are null on these rows and the project's name rides `job_name`.
- **No price**: `worth`, `total` and `price` stay out of `facts`. The bed asserts the keys.
- **The gate** is each table's own (`security_invoker`): `gc_owner_contract_sends` answers a dev, `gc_sows` a dev, the owner and the controller, a company's paper whoever reads `person_contract_documents`, the office. The joins on `projects`, `customers`, `gc_trade_packages` and `gc_companies` are left joins under their own policies. No policy changes.
- **No table is made**, so the fence calls are not needed. `CREATE OR REPLACE` with the same columns, written from the newest definition.

**The bed**: `agreements-on-file` gains a GC project with two sends of our contract, a sent and a draft statement of work and a company's agreement. It proves the three lines as a dev, the newest send as the owner contract's line, the draft absent, the find box reaching a project and a company, and each role's reach: the owner and the controller read the statement of work and not the owner contract, an assistant only the company's agreement. Its runner now re-applies this file, the view's newest definition.

Apply order: the client reads only columns the view already has, so a client ahead of the push lists no GC paper and breaks nothing. Push after the merge. No types regen for it (the view's columns are unchanged).

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
