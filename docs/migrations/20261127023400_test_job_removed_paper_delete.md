# 20261127023400_test_job_removed_paper_delete.sql (2026-11-26, v2.8679)

The developer deletes a taken-off paper of a test job. Punch list #443, row 10, one of the take-backs that need a migration, on the owner's answer of 2026-11-25 (*All eight*), each push on its own yes.

## Why

**Take off** on a paper's row in *Papers before this job opens* runs `job_paper_remove` ([`20261117220000_job_required_papers`](./20261117220000_job_required_papers.md)), which sets `removed_at` on the `job_required_papers` row and keeps the row, by design: signatures hang on it. The table lets a signed-in person only read. It has one read policy for the office, and `INSERT`, `UPDATE` and `DELETE` are revoked from `authenticated`, so every write is a function, and no function deleted. The pane and every read of a job's papers leave a taken-off row out. So on a ZZ test job the rows walks took off piled up where no screen listed them.

## What it makes

Two functions, both `CREATE OR REPLACE`, `plpgsql`, `SECURITY DEFINER`, `search_path = public`, `row_security = off`, revoked from `PUBLIC` and `anon`, granted to `authenticated`, each with a comment. The first is `STABLE`.

## What it leaves on prod

Two functions, which is two `pg_proc` rows with their grants and comments. No table, column, index, policy, grant on a table, trigger or row is made or changed. No table is created, so the four closing calls do not apply. `job_required_papers` keeps its one read policy and its revoked writes: a direct `DELETE` is still refused for everyone.

`row_security = off` changes nothing today: each function is owned by the owner of the tables, which row security does not bind. It is set as `job_is_zz_test` sets it, so that a function that ever ran as a role row security does bind would raise where it would otherwise read or delete no row without a word.

### `list_test_job_removed_papers(p_job_id uuid) → jsonb`

It refuses in this order, each with `ERRCODE = 'P0001'`:

| The case | The words |
|---|---|
| Nobody is signed in | *Sign in first.* |
| The caller is not a developer (`is_dev()`) | *Only a developer can read a job’s taken-off papers.* |
| The job is not there | *The job is not there any more.* |
| The job is not a ZZ test job (`job_is_zz_test`, [`20261120163000`](./20261120163000_settings_on_the_job.md)) | *Only a test job’s taken-off papers are listed. This job is a real one.* |

Then it answers `{ ok, job_id, papers }`. `papers` is the job's rows with `removed_at` set, newest taken off first and then by id, each as `{ id, paper_name, required_at, removed_at, copies, proposals, taken_as, revisions }`. The last four are counts of what points at the row, in the order the delete checks them. A job with no taken-off paper answers an empty list.

### `delete_test_job_required_paper(p_paper_id uuid) → jsonb`

It refuses in this order, each with `ERRCODE = 'P0001'`:

| The case | The words |
|---|---|
| Nobody is signed in | *Sign in first.* |
| The caller is not a developer | *Only a developer can delete a taken-off paper.* |
| The paper is not there | *The paper is not there any more. Read the list again.* |
| It is still on its job (`removed_at` is null) | *This paper is still on its job. Take it off first.* |
| Its job is not a ZZ test job | *Only a paper of a test job can be deleted. This job is a real one.* |
| A person's copy names it (`person_contract_documents.job_required_paper_id`) | *A copy on a person’s file names this paper. It stays.* or *N copies on people’s files name this paper. It stays.* |
| A GC proposal was made on it (`job_paper_proposals.required_paper_id`) | *A GC proposal was made on this paper. It stays.* or *N GC proposals were made on this paper. It stays.* |
| A GC proposal was taken as it (`job_paper_proposals.taken_as`) | *A GC proposal was taken as this paper. It stays.* or *N GC proposals were taken as this paper. It stays.* |
| A later paper is a revision of it (`job_required_papers.revision_of`) | *Another paper is a revision of this one. Delete the later one first.* or *N other papers are a revision of this one. Delete the later one first.* |

The paper's row is read `FOR UPDATE`, so a copy or a proposal made on it at the same moment waits on its own key, then finds the paper gone and is refused. Then it deletes the one row, named again by `removed_at` in the delete itself. A delete that reaches no row raises *The paper is not there any more. Read the list again.* It answers `{ ok, job_id, paper_name }`.

## Why each tie refuses

Each of the four is a foreign key into `job_required_papers(id)`, and each would let the row go:

- **A person's copy** is `ON DELETE SET NULL` (`20261117220000`). The copy would lose its paper without a word and stand on the person's file as a copy of nothing, signed or not. A signed copy is what opened the job to that person.
- **A GC proposal made on the paper** is `ON DELETE CASCADE` ([`20261125023655_job_paper_gc_proposals`](./20261125023655_job_paper_gc_proposals.md)). The proposal would be deleted with the paper, and with it what the GC asked for and what the office answered.
- **A GC proposal taken as the paper** is `ON DELETE SET NULL`. The proposal would stand as taken and name nothing it was taken as.
- **A later revision** is `ON DELETE SET NULL` (`20261120163000`). The later row would lose its place in its chain. The sentence says what to do: delete the later one first.

Nothing else holds a required paper's id. Read in the migrations and in `src/` and `supabase/functions/` on 2026-11-26: those four columns are the only keys into the table. No `sent_documents` row names the table as its source, no signing consent names a required paper, and the GC's page, the sub's page, the papers lock and `agreements_on_file` reach a required paper through a person's copy or read live rows alone.

A revision is made only when somebody has signed the paper before it (`job_paper_set_settings`). So the row a revision names is held by that signed copy first, and its line reads the copy's sentence. The revision's sentence is read only where the copy is gone.

## What a delete means for **Take off** and **Add a paper**

`job_papers_require` brings a taken-off row back, with its signatures, when the Contract Book's words have not changed since. A deleted row cannot come back. Nothing is lost by that: a row any copy names is never deleted, so the row that goes had no signature to bring back, and requiring the paper again makes a new row.

A required paper's row holds its Form Studio form in place (`form_template_id`, `ON DELETE RESTRICT`), taken off or not, which is why a form a job once required cannot be deleted (`formDeleteHold.ts`). A deleted row lets go of its form. That is the other direction of the key and nothing here checks it: a test form whose last taken-off paper is deleted can then be deleted in Form Studio.

## Triggers that fire on the delete

Read in the migrations, not on a database:

- `job_required_papers` has `job_required_paper_keeps_gc_view` (before insert), `job_paper_settings_locked` (before update of the settings columns), `job_paper_proposals_overtaken` (after update of `settings` or `removed_at`) and the statement trigger `read_only_block_stmt` (before insert, update or delete). Only the last fires on a delete. It raises for a caller flagged `users.read_only` and is silent otherwise, also inside a `SECURITY DEFINER` function, so a developer in training mode is refused with the trigger's own words.
- The table is not among the tables the deleted-records archive names, so a deleted paper is not copied anywhere, and Settings → Recently deleted does not show it.

## Locks

`CREATE OR REPLACE FUNCTION`, `REVOKE`, `GRANT` and `COMMENT` on two functions: two `pg_proc` rows. No table is locked. `SET lock_timeout = '3s'` opens the file.

## Order

The client calls `list_test_job_removed_papers` and `delete_test_job_required_paper` by name, and only this migration creates them. So `npm run check:calls-ahead` labels the PR *push right after the merge*, and `deploy.yml` holds the client until the push. Push with `bash scripts/db-push.sh` from a checkout of main right after the merge. The push is asked for by name and waits on its own yes.

Until the push the list's read is answered with a missing name. The fold reads that as no list and draws nothing, so a developer sees the pane as it was and nobody else reads anything new. There is no press to refuse.

No types PR is owed for the client: it calls both functions as untyped RPCs, as the other take-backs call theirs. The generated types gain the two functions on the next `chore(types)` PR.

## How to verify after the push

1. `npm run check:migration-drift` reads the ledger and the repo as aligned, this version among them.
2. Through the dev seat, `find_rpc` finds both names.
3. As the dev, on a ZZ test job that holds taken-off papers, open the job's window, Documents. The line *Taken-off papers · N* is drawn under the papers.
4. As the sample assistant through View as, on the same job: the line is not drawn.
5. As the dev, on a real job: the line is not drawn.

## How to roll back

```sql
SET lock_timeout = '3s';
DROP FUNCTION IF EXISTS public.delete_test_job_required_paper(uuid);
DROP FUNCTION IF EXISTS public.list_test_job_removed_papers(uuid);
```

The developer's fold then reads a missing name and draws nothing, as before the push. Nothing else calls either function. A paper already deleted stays deleted: it was a taken-off row of a test job that nothing named.

## Test

`npm run test:pg:job-required-papers` applies this migration a second time after every migration, which must change nothing, and plays `supabase/tests/job_required_papers/30_removed_paper_delete.sql` after the bed's first scenario, in one transaction that rolls back, with fixtures made as postgres and every press made as its user:

- On a job named ZZ a dev requires three papers and takes them off. The list answers the three, newest taken off first, with every count zero. A delete answers ok with the job and the paper's name, the row is gone, and the list answers two. A second delete of the same paper is refused as not there.
- A paper one unsigned copy names is refused. A paper two copies name, one signed, is refused with the count. Both rows stand and every copy still names its paper.
- A paper built from settings is signed, the GC proposes and the office takes it. The first version reads one copy, one proposal and one revision in the list, and is refused by its signed copy. The second version is refused while on its job. Taken off, it reads one proposal taken as it, and is refused in that sentence.
- On a second test job, a paper the GC proposed on comes off before the office answers. It reads one proposal and is refused in that sentence. The proposal stands, overtaken, and still names its paper.
- Two taken-off rows of one chain, written as fixtures: the earlier is refused while the later names it, the later goes first, and then the earlier.
- A real job's taken-off paper is neither listed nor deleted, and stands. A job that is not there has no list. The office and a helper are refused at both functions. A direct `DELETE` as the office and as the dev reaches no row.
- With nobody signed in each function says *Sign in first.*, and as `anon` each call is refused at the door.

**The whole-schema bed is unrun.** Docker does not answer on the Mac that built this, so the SQL beds job on the PR is the first run of the bed against the real schema. What did run there: this migration, twice, and the scenario file as written, on a local Postgres 15 over stand-in tables. Those hold the columns, the keys, the settings check, the read policies and the revoked writes the two functions touch, and simplified copies of the paper functions the scenario presses. All 63 assertions passed. That shows the SQL parses, the two functions hold their rules and the scenario's own arithmetic is right. It does not show that the real `job_papers_require`, `job_paper_start`, `job_paper_propose`, `job_paper_proposal_decide`, their triggers and the real policies agree with the scenario, which is the bed's job.

## Known and not covered

- **The file as first written named a table that is not there.** Its counts read `job_paper_gc_proposals`, which is the name of the migration file that made the table, and the table is `job_paper_proposals`. A `plpgsql` body is not checked against the schema when it is created, so the file would have pushed clean and then failed on every call. It was found by reading `20261125023655` and corrected before the first commit. The stand-in run of the file as first written failed on its first call with *relation "public.job_paper_gc_proposals" does not exist*.
- **A paper replaced by a newer version is listed as taken off.** `job_paper_set_settings` sets `removed_at` on the row it replaces. That row is held by its signed copy, so its press is dead, and it stays while the version after it is on the job.
- **Nothing puts a deleted paper back.** The delete is for good, and the confirm says so.
- **The list is the function's alone.** The office reads `job_required_papers` directly under its read policy, but the counts need `job_paper_proposals` and every person's copies, so the fold asks the function and draws nothing when it cannot.
- **A developer in training mode** is refused by the statement trigger, in the trigger's words and not this function's. Read in the migrations, not run.
- **Not pressed.** No paper has been deleted on prod. Fourteen taken-off papers stand on one ZZ test job (card #443, *What sits on prod*). Which of them a copy or a proposal names is not known until the list is read after the push.

## The walk, for the walker

Each write below is a write on prod and waits on its own yes.

1. As the sample assistant through View as: open the ZZ test job's window, Documents. *Taken-off papers* is not drawn.
2. As the dev, on a real job's Documents: *Taken-off papers* is not drawn. Press nothing.
3. As the dev, on the ZZ test job's Documents: the line reads *Taken-off papers · N* under *Papers before this job opens*. Press **Show**. Each paper reads its name and *Taken off* with its day. Note which draw **Delete…** grey, and the reason beside each.
4. Press a grey **Delete…**. Nothing opens.
5. **On its own yes**, press a live **Delete…**. The confirm names the paper and its button reads **Delete the paper**. Confirm. The toast reads the paper's name and *was deleted.* The line's count drops by one.
6. Read `job_required_papers` for the job through the dev seat: the row is not there, and every row that drew grey stands. Tell `fixing` the count deleted, the count that stay, and each reason.
