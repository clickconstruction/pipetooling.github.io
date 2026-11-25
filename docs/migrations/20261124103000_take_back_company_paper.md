# 20261124103000_take_back_company_paper.sql (2026-11-24, v2.8488)

Taking back a trade company's own paper: one function, `take_back_company_paper(p_document_id uuid)`, the write behind **Take back** on a trade company's line on Documents → Agreements and on a company's paper on People → Contracts.

- **Why**: punch list #403's walks of 2026-11-24 found that no press takes back a trade company's own paper (`person_contract_documents` with `company_id`). Take back (v2.8348) deletes an outside party's paper under the table's own delete policy, and left a trade company's own paper out on purpose, since GC mode sends those too. The office also sends a sub's company its papers from People → Contracts (step 6). One sent by mistake stayed, with its signing link live for 14 days.
- **What it does**: deletes the paper's row. The signing link lives on the row, so it ends with it. Nobody is emailed. It answers `taken`; `signed` when the paper was signed or received before the press, and is kept; `gone` when it is not there any more, which is what a second press reads.
- **What it refuses**, in words:
  - a paper that is not a trade company's own (*That paper is not a trade company's own, so it is not taken back here.*): a party's paper is taken back on its own line, under the table's policy;
  - a paper a job requires (`job_id` or `job_required_paper_id`): *‹paper› stays with ‹company›, since a job requires it. It comes off on the job.*;
  - a copy a newer one replaced (`supersedes_person_contract_document_id` names it): *… since a newer copy replaced it. The newer copy is the live paper.*;
  - a paper GC mode is waiting on: *… since GC mode asked for it by ‹Nov 30›. It is GC mode's paper to chase.*
- **GC mode's ask**: `gc_send_paper` (`20261010009000`) records each paper GC mode sends a company and opens a `gc_trade_promises` row for it, which only the signed paper keeps (`gc_company_paper_kept`). Deleting the paper under an open ask would leave GC mode chasing a paper that is gone. The function reads the open promise about the company itself (no job, no trade) whose kind is the paper's: an agreement is `msa`, a W-9 `w9`, a certificate `insurance`, the mapping the keeping trigger uses. A paper of any other kind has no ask. The rule is by kind, not by paper: an open ask for an agreement holds every waiting agreement of that company. It deletes less, never more.
- **What it leaves**: the email that went out (`gc_trade_messages`, and the sent copy), and the company on the bench. `gc_remove_bench_company` (`20261109004500`) keeps a company we emailed, by its own rule, unchanged.
- **Door** (changed by [`20261124214500`](20261124214500_take_back_dev_and_controller.md), v2.8530: a dev and the controller): `SECURITY DEFINER`, since `gc_trade_promises` reads under a dev's policy and the leader takes a paper back too. Who may is the app's own rule for deleting a paper anywhere: the leader and a dev, `is_master_or_dev()` in the body (*Only the leader or a dev takes a paper back.*). A training account, a digital twin and an archived caller are refused first in their own words, since a definer passes their fences. `REVOKE … FROM PUBLIC, anon`, `GRANT EXECUTE … TO authenticated, service_role`.
- **The table's policies are not touched**: the plain delete a party's Take back uses still answers the roles it did.

Idempotent: one `CREATE OR REPLACE`. No table is made, so no fence call closes the file, and no table is locked.

**The bed**: `supabase/tests/take_back_company_paper/20_scenario.sql` (`scripts/pgtest-take-back-company-paper.sh`, in `scripts/sql-beds.txt`): every role's gate, each refusal with its words, a signed paper and a received certificate kept, the papers taken back with the companies and GC mode's ask untouched, a second press reading *gone*, the same W-9 taken back once the ask is kept, and who may execute the function.

**Order**: push right after the merge. The client calls a function only this migration creates, so `check:calls-ahead` labels the PR *push right after the merge* and the deploy holds until the push. The types regen (`database.ts`, the dev-mcp catalog) follows the push as usual.

**Applied** to prod by 2026-11-24: the dev seat's `check_migration_ledger` read 1,485 versions applied against 1,485 local files, this version among the newest it listed (read in the docs pass after #9574).
