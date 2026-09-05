# Docs sweep, 2026-09-05: every deferred note, validated

Status: triage record — the owner decides which entries stay; delete this file once the index below has been pruned

Swept: every plan doc under `docs/` (status logs, Deferred / Open questions / later phases), every `docs/recent-features/` fragment since v2.2300 with a Follow-ups / Deferred / Not in this PR / Next section or an inline "deferred" note, `docs/CREW_PNL_DATA_FLOW.md` §5, the `RECENT_FEATURES.md` archive's "Out of scope" notes, and `docs/twins/HANDOFF.md`. Each item was checked against the code on `main` (commit 5fcd2ee4) and, where it mattered, the live app on this worktree's dev server.

## Shipped since the note was written — dropped

| Note | Where it said "later" | Shipped as |
|---|---|---|
| Crew-split trigger denominator includes bid sessions | v2.2678 / 2682 / 2686 / 2688 "Next" | v2.2691 (migration `20260903153903`) |
| Bank-category tags PR 2, PR 3 | v2.2714 / v2.2718 "Next" | v2.2718, v2.2725 |
| Person Desk PRs 2–5 + gate widenings | v2.2701 "Next in the train" | v2.2706, v2.2710, v2.2713, v2.2717 |
| Fuel as a vehicle cost per field hour (owner decision) | v2.2698, v2.2700, v2.2708, v2.2725 | decided and built: Wheels on Labor v2.2733 / v2.2735 |
| Row-cap tripwire | v2.2755 "Follow-ups" | v2.2756 |
| Audits with zero PipeTooling rows read "Robot still working" | v2.2795 "Follow-ups" | live in `BidsAuditsTab.tsx` (UNPRICED chip) |
| Estimate Options Phase 2 (edge functions) and Phase 3 (read-backs) | v2.2457 | v2.2460, v2.2462 (cap raised v2.2586) |
| Checklist due dates Tier 2b | v2.2349 | v2.2351 |
| Property picker inside the Job form | v2.2614 | v2.2638 |
| Confidence scoreboard UI | v2.2539 | v2.2544 |
| CT per-twin credential parity | v2.2439 | CT-4 in v2.2503 |
| Edge functions' `APP_ORIGIN` after the rename | v2.2526 | v2.2561 edge sweep |
| Supply-house RFQ deferred lane B (RFQ desk), per-house contacts, PDF/spreadsheet replies | `SUPPLY_HOUSE_RFQ_PLAN.md` Deferred | v2.2636, v2.2648, v2.2651 |
| Per-GC bids Phases 1–4 + cleanup; RFI R1–R3, R5; Contract Forms PRs 1–10; Takeoffs PRs 1–7; Partnerships (plan still says "building") | plan docs | all shipped — plan headers now point here |
| Help-media recordings | `HELP_MEDIA_PLAN.md` | all nine captured and wired |
| Jobs board query diet | `JOBS_BOARD_SCOPED_LOAD_PLAN.md` | complete (the "measure vs baseline after a few weekdays" line was never recorded; no action) |
| Workbench solver Option B toolbar | v2.2378 | owner picked Option A; not a to-do |
| Sub-sheet reader gaps (`derivePersonTeamSummary` bare equality, `subLaborOutstanding` name key) | `PERSON_IDENTITY_PLAN.md` v2.1732 entry | both id/share-based now |
| Crew P&L wage name-join | `CREW_PNL_DATA_FLOW.md` §5.1 | `crewPnlSummary.ts` is person-keyed |
| Contracts tables lack `person_id` (C2) | `FRAGILITY_REMEDIATION_PLAN.md` | column present in `person_contract_documents` |

## Still real — now a to-do file

| To-do | Verdict | Why it survived validation |
|---|---|---|
| work-orders-one-row-spine (shipped v2.2865–v2.2876, entry deleted) | done | both derivation bugs reproduced live 2026-09-05 (job 892 in "Needs a work order"; 977 / 1004 / 931 missing from it) |
| [`takeoffs-retire-old.md`](./takeoffs-retire-old.md) | do, after 2026-09-11 | default view is still `old`; PRs 8–9 unstarted |
| [`rfq-apply-picks-to-bid-costs.md`](./rfq-apply-picks-to-bid-costs.md) | do (owner approved) | no code past the lot-wording chip |
| [`job-summary-follow-ups.md`](./job-summary-follow-ups.md) | do, smallest first | no PTO / overtime / Needs-you card / badge in the kernels |
| [`error-message-follow-ups.md`](./error-message-follow-ups.md) | do | `ClockInOutButton.tsx:1811` text check still present; (b)/(c) unbuilt |
| [`contract-forms-publish-authored.md`](./contract-forms-publish-authored.md) | owner review, then 1 hour | five drafts unpublished |
| [`division-22-rules-manager.md`](./division-22-rules-manager.md) | owner-gated (Wendi) | nothing since v2.2598 |
| [`crew-pnl-and-wheels.md`](./crew-pnl-and-wheels.md) | part: item 1 resolved, 3–6 true | `$50` literal, `laborJobs` prop dependency, bare-wage crew cost |
| [`subs-residuals.md`](./subs-residuals.md) | part: small, mostly rides other PRs | no compliance code in `StepFormModal`; role literal still in the RPC |
| [`person-identity-phase-e.md`](./person-identity-phase-e.md) | gated (a quiet quarter) | Phase E scope unchanged |
| [`per-gc-bid-retirement.md`](./per-gc-bid-retirement.md) | low | 16 + 24 live references to the two legacy columns |
| [`partnerships-off-toggles.md`](./partnerships-off-toggles.md) | owner + attorney gated | four config keys modeled, nothing behind them |
| [`weekly-money-later.md`](./weekly-money-later.md) | optional | none of Phase 6 in the modal; Months view may cover the roll-up |
| [`robots-residuals.md`](./robots-residuals.md) | low; program runs from `docs/twins/HANDOFF.md` | R4, page-param deep link, scoping, R2-BT-1 stumbles, Phase 4 CI check all unbuilt |
| [`supply-house-job-account-aging.md`](./supply-house-job-account-aging.md) | waiting on Taunya | heat map still counts job-account invoices; May follow-ups never built |
| [`engineering-hygiene.md`](./engineering-hygiene.md) | low | inventory numbers off by up to 2.5k lines; two sweeps never run |
| [`journey-map-tier-1.md`](./journey-map-tier-1.md) | pointer | list lives in the private repo |
| [`owner-decisions-pending.md`](./owner-decisions-pending.md) | standing list | eleven yes/no questions, one line each |

## Could not verify here

- Owner cleanup of the surplus "K-25077-0 KINGSTON…" parts and the duplicate "OS-25" (v2.2755): **still pending** — `/duplicates` showed four KINGSTON variants and two OS-25 rows on 2026-09-05. Listed in `owner-decisions-pending.md`.
- Whether the v2.2817 "delta lines on Days and Timeline tiles" landed with the Months view (v2.2821 lists Compare deltas on the Months tiles only).
