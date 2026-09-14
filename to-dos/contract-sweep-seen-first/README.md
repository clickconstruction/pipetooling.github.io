# Contract sweep, seen first — shrink the pile, file what is signed, then a sweep that shows the agreement

Status: **in progress** · PR 0 v2.3384 (the floor + Not needed, #3114) · PR 0c v2.3385 (the job-form door, #3115) · PR 1 v2.3386 (the readiness kernel + list, #3116) · PR 2 v2.3387 (the pane, #3117) · PR 3 v2.3388 (editing in place, #3118) · PR 4 v2.3389 (filing) — **the sweep is built** · next: the Drive pass (the owner connects Drive first) · mock-up: [`mockup.html`](./mockup.html) (the brief with mock-ups A–D, also published as a Claude artifact 2026-09-13)

## The ask, in the owner's words

> I do not love this page. I think it should be easy for the user to upload a contract or to view what is about to be sent.

Then, on the first redesign (a two-pane sweep): **"is this the best we can do?"** — and on the revised plan: "Let's first make a great system and then I will help you connect Google Drive so we can find as many signed contracts as possible. follow the entire build plan and then I'll help you connect to google drive."

## The reading — what the sweep did (v2.2685) and why a better sweep is not enough

- The sweep listed every non-paid job whose coverage was *none* or *draft*, one row each, an email input and a Send per row, **Send all N ready** in the footer. Nothing on the page showed what a send would say; the only preview was two doors away and opened a pop-up.
- A thin job shipped a thin contract: J683 "Job" with no fixtures and no amount would read *Work we'll do: Job · Billed at completion*, and counted as "ready" because ready only meant "the email parses". The sweep's prefill also skipped the accepted-estimate lines the Contract modal uses.
- Filing a signed copy was three doors deep; the loudest button emailed 87 customers with reminders on by default; the same customer with two jobs got two agreements.
- **The premise was wrong for most rows.** Builders (TF Harper, Summit GC, RMC, Michael Palmer) send *us* their subcontract — "send our service agreement" is the wrong door on a GC job. The owner said in September that signed contracts live in Google Docs, so the pile is mostly a *filing* gap. The nudge had no dollar floor. Jobs born from a won bid or an accepted estimate are already covered; the pile grows from hand-made jobs, and the job form has no contract question.

## The decision

Shrink first, file what is already signed, then send what remains from a sweep that knows which door each row wants.

1. **The floor and Not needed** (PR 0, v2.3384): `app_settings.job_contract_floor_cents_v1` (dev sets it on the Pipeline card; a job with no amount is never "under" it) and `jobs_ledger.contract_not_needed_at/_by/_reason` (the Contract modal's *Not needed…* with three reason chips; *Needed after all* withdraws). `isContractGap(cov, revenue, floorCents)` is the one rule the nudge, the card, the No-contract filter and the sweep share.
2. **The door on the job form** (PR 0c): a new hand-made job asks once — *Send the agreement · File the GC's subcontract · Not needed* — so the backlog stops refilling.
3. **The readiness kernel and the list** (PR 1): `contractSweepRowState.ts` names each row — Ready · Scope is just the name · No amount · No email · GC job (file theirs) · + J798 (same email) — the header counts, *To send · Needs a look · All*, Send all under ⋯ and restricted to Ready.
4. **The pane** (PR 2): the selected job's agreement rendered from `buildJobContractDocumentHtml` (the record modal already iframes it), To and Terms above it, Send · Send & next · Skip with the footer sentence; the quick-send kernel gains the accepted-estimate lookup so the sweep's document equals the modal's.
5. **Editing in place** (PR 3): click the scope or the amount in the document to edit; autosave to the shared draft; *Open the full editor* hands off to the modal.
6. **Filing** (PR 4): the v2.2744 filing sheet extracted into a shared `JobContractFileSheet` the modal also mounts, row drop targets with a 5-second undo, the green filed row, the header's *N filed*.
7. **The Drive pass** (last, owner-gated): `drive-intake` gains a list mode over the jobs Shared Drive; a matching kernel (folder name ↔ job address or number, filename ↔ contract words); the *Found in Drive* review list files confident rows through the paper-record write. Dev-run first.

Rejected: keeping Send all as the footer primary; treating "email parses" as ready; one email carrying two agreements (a send-function change, only if pairs are common after the first sweep).

## Where it plugs in

| Exists | New |
|---|---|
| `lib/jobs/jobContractCoverage.ts` (coverage + chip words + filter), `jobContractNudge.ts`, `useJobContractsNudge`, `PipelineContractCoverageCard`, `JobsContractSweepModal`, `JobContractModal` (send, void, filing sheet), `jobContractQuickSend.ts`, `jobContractDocument.ts` (`buildJobContractPrefill`, `buildJobContractDocumentHtml`), `send-job-contract`, `JobContractRecordModal` (iframes the document), `drive-intake` (service account on the jobs Shared Drive) | `lib/jobs/jobContractFloor.ts` (PR 0), `contractSweepRowState.ts` (PR 1), the two-pane sweep shell (PR 2), `JobContractFileSheet` (PR 4), `driveContractMatch.ts` + the list mode (Drive pass) |

## Open decisions (the mock-up page lists all seven)

- Is a no-amount agreement sendable in bulk? Proposed no (one at a time after a look).
- One email per job or per customer? Proposed per job with the *+ J798* chip for now.
- Row drop with no questions (signer = the job's customer, date = today, 5-second undo) or open the sheet prefilled?
- The floor amount (the mock-up uses $2,500) — dev sets it on the card.
- Is the builder's subcontract the agreement on a GC job, so Send all skips those rows?
- May a dev run the first Drive pass and file the confident matches?

## How to verify

Dev login → Jobs → Pipeline. The Get contracts signed card's third line reads the floor and the two exclusions; **change** (dev) sets the floor and the count moves. Open any Working job's *No contract* chip → **Not needed…** → a reason → the row reads *No contract · not needed* and the card's count falls by one; **Needed after all** puts it back. `?contract=missing` and the sweep's ⋯ count agree with the card. Prod-safe: Not needed writes three columns on the job and nothing to the customer.
