# 20261125023655_job_paper_gc_proposals.sql (2026-11-24, v2.8553)

A GC proposes a stricter setting for a job's paper, and the office takes it or declines (punch list #389 step 6, `to-dos/sub-nda-builder/README.md`). No clause wording is written.

## What it makes

Every statement is safe to run twice.

- **`job_paper_proposals`**, new. One row a proposal: the paper's row, the job, the customer, the portal link, the job's picks that day (`from_settings`), the picks asked for (`settings`), the name the GC typed, whether the notice's box was ticked, and the day. `state` is `waiting`, `taken`, `declined` or `overtaken`. A decided row keeps who, when and the reason for a decline. `taken_as` names the row that holds the taken picks. A unique index holds one waiting proposal to a paper.
- **Its policy**: the office reads it. Nobody writes it by hand: insert, update and delete are revoked from signed-in roles, and it is closed to `anon`. The four fence calls close the migration.
- **`job_paper_proposals_overtaken()`** and its trigger on `job_required_papers`, after an update of `settings` or `removed_at`.
- **`job_paper_propose(p_required_paper_id, p_customer_id, p_link_id, p_settings, p_name, p_notice_read)`**, new, for the service role alone.
- **`job_paper_proposal_decide(p_proposal_id, p_take, p_why)`**, new, for the office.
- **`job_papers_gc_page(p_job_ids)` replaced**, with the same grants. It started from the function as `20261124170000` left it.

## What a proposal is held to

`job_paper_propose` raises in words, in this order:

| Refusal | When |
|---|---|
| *This job no longer requires that paper.* | The row is gone or taken off |
| *That job is not one you are the general contractor on.* | The job's `gc_customer_id` is not the link's customer |
| *That paper is not built from settings.* | A paper in prose |
| *Pick (a topic).* | A topic left out, or a choice the list does not have |
| *Nothing is stricter yet.* | The same picks as the job's |
| *A proposal can only make the paper stricter.* | Any topic looser, by `contract_paper_picks_change` |
| *Type your name first.* | No name |
| *Tick the box under the notice first.* | The list opens on a notice and the box was not ticked |
| *That is many proposals in one hour.* | Six from one customer in the hour before |

A proposal that stands overtakes the one already waiting on the paper. It changes no paper.

## What the office's answer does

- **Decline** marks the row with who, when and the reason. The paper is as it was.
- **Take** marks the row, then calls `job_paper_set_settings` with the proposed picks and the blanks the job already has. So the rules of a change are that function's own: saved in place while nobody has signed, and a new row that everyone signs again once somebody has. `taken_as` is that function's row. A refusal there undoes the mark with it.
- A proposal that is not waiting is not answered again.

## What overtakes a waiting proposal

A newer proposal on the same paper, the office's own change of the paper's settings, and the paper coming off the job. The trigger does the last two. A take marks its row before it changes the settings, so it does not overtake itself.

## What the GC's page reads

`job_papers_gc_page` adds four keys to a paper, for the portal function to shape:

| Key | What |
|---|---|
| `picks` | The row's settings |
| `basis` | The row's basis |
| `def` | The Book entry's whole settings list |
| `proposal` | The last proposal by the job's GC on the row, or taken as it: `{state, by_name, proposed_at, decided_at, why, settings}`, or null |

The portal function hands the page a list with names and plain words only (`gcProposeDef` in `_shared/portalJobPapers.ts`). The lines the office reads beside a choice, the blanks and the site note never leave it.

## Safe under what is deployed

- The deployed `customer-portal` reads `job_papers_gc_page` and ignores the four new keys.
- The deployed `submit-portal-request` knows no `job_paper_proposal` kind and answers it as a bad request. The new one may go before or after the push: before it, a proposal is refused because the function `job_paper_propose` is not there.
- The office's section reads `job_paper_proposals` only for a job that holds a paper built from settings, and a read that fails draws no card. Until the push the read fails and the section draws as before.

## The bed

`npm run test:pg:job-paper-gc-proposals` (`supabase/tests/job_paper_gc_proposals/20_scenario.sql`): only the service key proposes; each refusal above; a proposal that stands changes no paper; a newer one, the office's own change and the paper coming off each overtake the one waiting; a decline keeps who and why; a take in place and a take after a signature; the GC's page reads the picks, the list and the last proposal; a helper reads no row and answers nothing. `job-papers-gc-page` applies this migration a second time too.
