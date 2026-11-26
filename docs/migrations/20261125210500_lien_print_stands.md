# 20261125210500_lien_print_stands.sql (2026-11-25, v2.8595)

A place to keep *It stands as printed*, and one function that writes it. Punch list #362, step 7. Since v2.8589 every lien print keeps what its paper said, and since v2.8593 the run's checklist names a printed notice or affidavit that would say another thing today. A changed paper has three answers: print it again, take it out of the run, or say it stands. This table keeps the third.

The owner's answer of 2026-11-25 to where it is kept: on record, in a table of its own, with who, when and what had changed, so every office seat sees it, and a second change asks again.

## The table, `lien_print_stands`

| Column | Type | What it holds |
|---|---|---|
| `id` | `uuid`, primary key | |
| `job_id` | `uuid` → `jobs_ledger(id)`, `ON DELETE CASCADE` | The job. |
| `paper` | `text`, `'notice'` or `'affidavit'` | Which of the job's papers, named as `lien_run_left_out` names it: an affidavit has no desk item. |
| `change_key` | `text`, 1 to 200 characters trimmed | The difference the answer is for, as the client keys it (`lienPrintChangeKey`, `src/lib/jobs/lienPrintSworn.ts`): the fields that moved, with the value printed and the value now. |
| `changes` | `jsonb`, an array, default `[]` | That difference in words: `{ key, label, printed, now }` each. For the record. No rule reads it. |
| `sent_document_id` | `uuid`, nullable, no foreign key | The filed print the answer was given for (`sent_documents.id`). NULL when the print kept no row to name. A plain id: a sent copy is never deleted, and the reference is for a reader. |
| `stood_by`, `stood_at` | `uuid` → `users(id)`, `timestamptz` | Who and when, set by the function. |
| `taken_back_by`, `taken_back_at` | `uuid` → `users(id)`, `timestamptz`, both or neither (`lien_print_stands_taken_back_pair`) | Who took the answer back and when. NULL while it stands. |

`lien_print_stands_live_key` is a unique index on `(job_id, paper, change_key)` over the rows not taken back: one standing answer a paper and difference.

## The rule the rows serve

The client's kernel reads the rows (`src/lib/jobs/lienPrintStands.ts`, `lienRunPrinted.ts`):

- A changed paper whose difference has a standing row under the same key **stands**. The checklist lists it apart, with who said so, and an affidavit that stands is not printed again by the run.
- A row answers for its own difference alone. When a statement moves again the key is another, no standing row matches, and the paper asks again.

Saying a paper stands changes nothing on the paper: no notice, affidavit, filing, desk item or sent copy is touched, and no rule about when a paper may go reads this table.

## Who reads and who writes

- **Read:** `lien_print_stands_select_office`, for dev, assistant-like (a controller too) and a master. The same set that reads `lien_run_left_out` and `job_lien_desk_items`.
- **Write:** no insert, update or delete policy, and `authenticated` is granted `SELECT` alone. The function below is the only way in.
- The four fences are applied at the end: training mode writes nothing, a twin writes nothing here, an archived caller reads nothing.

## The function

`set_lien_print_stands(p_job_id uuid, p_paper text, p_stands boolean, p_change_key text DEFAULT NULL, p_changes jsonb DEFAULT NULL, p_sent_document_id uuid DEFAULT NULL) RETURNS jsonb`

- **Who.** The lien office: `dev`, `master_technician`, `assistant`, `controller`. Anyone else gets `{ "error": "Not authorized to say a lien paper stands as printed" }`.
- **It stands** (`p_stands` true) needs the key of the difference and a list of what had changed that is not empty. It writes one row with who and when. The same press twice for the same difference writes one row and answers `changed: false`, whoever presses.
- **Take back** (`p_stands` false) stamps every standing answer for that paper, whatever difference it was for. Taking back a paper nobody answered for answers ok and changes nothing.
- **Returns** `{ ok, stands, changed }`, or `{ error }` with nothing written.
- `SECURITY DEFINER`, `search_path = public`, EXECUTE for `authenticated` and `service_role`, revoked from `anon`.

## Bed

`npm run test:pg:lien-print-stands` (`scripts/pgtest-lien-print-stands.sh`, `supabase/tests/lien_print_stands/`): stand-in tables, the migration applied twice, then 45 checks. Who may press and who is refused, each refusal's words, what an answer writes, the same press twice, a second difference beside the first, the same key on the job's other paper, what taking back stamps, who reads the rows, that a signed-in person cannot write the table by hand, the three checks, and that a deleted job takes its rows. It could not be run on the office Mac on 2026-11-25: no local Postgres would start (`shmget`, the machine's shared memory was spent). GitHub's SQL beds job ran it on the PR the same day and it passed: 45 of 45.

## Push

The client that ships with this file reads the table and calls the function, so the push follows the merge at once (`npm run check:calls-ahead` labels the PR). Additive: a new table, one index, one policy and one function. Nothing that exists is altered, and the only locks are the new table's own and the brief ones its two foreign keys take on `jobs_ledger` and `users`, under a 3 second timeout.

A client live before the push is not broken by it: a read of the table that fails is read as no answers, so every changed paper asks, and a press on *It stands* says the server's reason and writes nothing.

**Not applied.** The push is asked for by name.
