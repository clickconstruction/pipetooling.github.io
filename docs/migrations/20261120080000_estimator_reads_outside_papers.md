# 20261120080000_estimator_reads_outside_papers.sql (2026-11-20, v2.8108)

Where an outside signer lives, step 4, the first PR (punch list #403, `to-dos/outside-signer-record/README.md`). The estimator's read of an outside company's paper is widened from agreements to every kind, and the rule it follows gets a name that the signed form's gate asks. No screen and no client change ride with it.

## The calls it builds

The owner settled three calls on 2026-11-20, each against what the ground built ([`20261120010000_paper_party`](./20261120010000_paper_party.md)).

- **Call 9.** The estimator reads every kind of an outside company's paper, a W-9 and an insurance certificate among them. He answered "No, every kind". The ground let them read an agreement alone.
- **Call 10.** An estimator opens an outside company's signed form. He answered "Yes, outside companies'".
- **Call 11.** That reaches a signed W-9. He was told the signed PDF is the one place the whole tax number is, and answered "Yes, W-9s too".

## What it makes

No table, so no fence call. Every statement is safe to run twice.

- **`paper_is_outside_company(p_person_id, p_partnership_id, p_company_id, p_party_contact_id)`**, a new function. It says whether a paper is with an outside company, from the four columns that say who a paper is with. True for a trade company's own paper (`company_id`), and for a party's paper whose contact points at a customer, a person at one, a supply house or vendor, a rep, a trade company or a person at one. False for every paper filed under a person or a partnership, and for a party on no list. It is the ground's rule word for word, moved out of the policy. `STABLE`, an invoker, `search_path` pinned: the contact is read under the caller's own `contacts` policy, as the ground read it.
- **The read policy `person_contract_documents_estimator_outside`**, restated. An estimator who is not a digital twin reads a paper when `paper_is_outside_company` says yes. The `doc_type = 'agreement'` line is gone.
- **`estimator_reads_paper(p_paper_id)`**, a new function. It answers one paper for the caller: an estimator, not a digital twin, and a paper that is with an outside company. `STABLE`, an invoker, `search_path` pinned, so the paper is read through the caller's own policies, the archived fence among them. The edge function `open-contract-form-pdf` asks it as the caller before it opens an estimator a signed form.
- `EXECUTE` on both functions is revoked from `PUBLIC` and `anon`, and granted to `authenticated` and `service_role`.

## Rules it settles

- **One rule, asked twice.** The policy and the signed form's gate both ask `paper_is_outside_company`, so what an estimator may open cannot drift from what they may read.
- **The gate's question says the rule again.** `estimator_reads_paper` reads the row through the estimator's policy and then asks the rule in its own words. A later read policy for an estimator, written for another reason, opens no file by itself.
- **What stays closed to an estimator.** Every paper filed under a person: a staff paper, a sub's own, a partner's, a person's copy of a job's paper and a signed hours statement. A party on no list, until **Add to a list** says what they are. Every paper, for a digital twin.
- **Nobody else reads more.** No other policy changes, and no write policy changes. The four roles still write a paper.
- **The Agreements list is unchanged.** `agreements_on_file` lists agreements alone, to every role. A W-9 or a certificate is a row an estimator reads and no line of that list.
- **The Board's call of 2026-10-10 is changed by the owner's call 9.** That call kept a trade company's W-9 and certificate to their states for the office ([`20261010120000_gc_company_paper_states`](./20261010120000_gc_company_paper_states.md)), because the row carries the last four of a tax number, the path of the answers' PDF and the signer's details. An estimator now reads that row. `gc_company_paper_states` is unchanged and still answers the Board.

## What an estimator reads on the row, and what they do not

A W-9's row keeps `form_hints`, the last four of the tax number, and `form_values`, the answers that are not sensitive. The whole number is in the signed PDF alone, and in the scan of a form keyed from paper. Neither file is readable from the app: the `contract-form-pdfs` bucket has no storage policy, and a link to one is minted by `open-contract-form-pdf` and lasts five minutes. A signature's image stays closed too: its storage policy names the four roles itself.

## The functions that act on "the caller reads the paper"

A wider read policy also widens every function that reads a paper as its caller and then writes with the service role. Each was read before this was written.

- `send-contract-for-signature`, the person path: closed by its own role check since v2.8101, the four roles that write a paper. This migration is pushed only after that function is deployed.
- `complete-contract-form-office` and `contract-form-paper-entry`: the four roles, by their own lists.
- `open-contract-form-pdf`: its own gate, which this PR widens for an estimator by the rule above.
- `get-contract-signing-link-for-self`, `hours-statement-signing`, the signing page's two functions and the three portals read with the service role and gate on something else: the caller's own name, the statement's own policy, or a link.
- The functions that run as their owner (`job_paper_start`, `set_paper_settings`, `gc_company_paper_states` and the rest) do not read through a policy, so a policy changes nothing for them. The three that run as the caller (`gc_company_paper`, `gc_record_company_coi`, `gc_mark_company_coi_good`) refuse anyone but a dev in words first.

`src/lib/paperCallerReadGates.test.ts` holds the list: a function that reads a paper as its caller fails CI until it is listed with the role check it makes before that read.

## Order and proof

Nothing reads the two functions until `open-contract-form-pdf` is redeployed, and that function refuses an estimator when the question has no answer. So either order of the push and the deploy is safe.

The one order that matters is against `send-contract-for-signature`: its role check (v2.8101) is deployed before this is pushed.

Proved by CI's beds against the whole schema, and run on a local Postgres 15 with the walk kit's stand-ins before the PR:

- `paper-party` (`supabase/tests/paper_party/20_scenario.sql`). It re-applies the ground and then this file. Its fixture gains a teammate's own W-9, a sub's own certificate, a trade company's certificate, a customer's certificate and the W-9 of someone on no list. The four roles read every paper as before. The estimator reads the trade company's agreement, W-9 and certificate, a supply house's W-9 and a customer's certificate, and no person's paper and nobody on no list. `estimator_reads_paper` says yes for exactly the papers the estimator reads, and no to the controller, a digital twin, an archived estimator and a primary for every paper. A caller who is not signed in cannot ask it. The W-9 of someone on no list opens once **Who is this?** names them at a customer, and a supply house's W-9 closes when the supply house is deleted.
- `agreements-on-file`, which re-applies the ground and then this file. Its estimator reads the trade company's W-9 of the table itself, and their list is unchanged.
- `gc-papers`. Its estimator reads every company paper of the table itself, a W-9 and a certificate among them, and no person's.

**Applied** to prod on 2026-11-21 at 03:01 UTC with `supabase db push` from main, after #9122 merged at 02:59 UTC. The migration drift check then read 1,416 versions applied against 1,416 files. `open-contract-form-pdf` was redeployed from main at 03:02 UTC as version 31, with `verify_jwt` off, and its deployed source was read back. Then, read only, as the estimator's sample account: the live policy asks `paper_is_outside_company` and no longer names a kind of paper. The estimator reads the three outside papers on prod, all ZZ test agreements. `estimator_reads_paper` says yes for each, and no for a person's W-9, a paper with no party and an id that is no paper. A caller who is not signed in is refused both functions. At 04:23 UTC the dev added one unsent ZZ test W-9 for the made-up supply house ZZ Test Supply (`b920fa57`), kept for the rest of step 4. Asked for every W-9, the estimator gets that one and no person's, and `estimator_reads_paper` says yes for it. The dev seat lists neither function until the next types PR rebuilds its catalog, so their answers were read over the pooler in a read-only transaction.
