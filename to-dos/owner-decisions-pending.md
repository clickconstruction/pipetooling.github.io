# Owner decisions the docs are waiting on

Status: standing list · each line is a yes/no or a number; answer it here or in the source and delete the line · every line re-verified 2026-09-06 against code and the live database (read-only) — none had been answered elsewhere

| Decision | Asked by | Source |
|---|---|---|
| Publish the Direct Deposit form and the four lien waivers as drafted? (`contract_form_templates` has no deposit or waiver row) | contract forms PR 10 | [`contract-forms-publish-authored.md`](./contract-forms-publish-authored.md) |
| Seed the RH / EDF spec sections and rule on med gas? Does Wendi want the full rules manager? | Division 22 | [`division-22-rules-manager.md`](./division-22-rules-manager.md) |
| Aging heat map: exclude job-account invoices or shade them? (Taunya — no answer in any fragment since; the heat map still counts them) | v2.2669 | [`supply-house-job-account-aging.md`](./supply-house-job-account-aging.md) |
| Wendi's travel bands (small proto vs $300k job at ~50/100/200/300 mi) to replace the interim 10% cap — still unanswered; `docs/twins/LEARNING_PLAN.md` lists it as an open doctrine question | v2.2795 | `docs/recent-features/v2.2795.md` |
| Should a job linked via `bid_id` auto-derive the bid's `started_or_complete` outcome? (no trigger does; v2.2859 made the link routine, so the question is now live daily) | per-GC bids Q1 | [`per-gc-bid-retirement.md`](./per-gc-bid-retirement.md) |
| Controller stays excluded from the Dispatch-Mode PO tab? (`dispatchModePoRoleAllowed` still admits dev / master / assistant only; the v2.2920 role sweep left it alone) | v2.2325 | `src/lib/dispatchModePoToggle.ts` |
| Roster: "Edgar" (sub, archived 2026-03-31, no login) — delete or combine? "MIke Rodriguez (Rough In)" was archived 2026-08-17 while "Miguel Rodriguez" stays active — same person? If yes, Combine people folds the archived history in | run-subs cleanup | [`subs-residuals.md`](./subs-residuals.md) |
| Partnerships: keep the estimating cap / runway floor / W2 watch in the Bryan deal? Notice delivery provider + attorney sign-off (plan decision 6 deferred it)? Will's decision 4 (the partner-visible notes preview)? | partnerships plan, v2.2891 | [`partnerships-off-toggles.md`](./partnerships-off-toggles.md) |
| Twins Phase 2 (other roles) — only by explicit decision | digital twins plan | `docs/DIGITAL_TWINS_PLAN.md` |
| Wheels PR 3: should Bids and Crew P&L price the vehicle deal too? Wear in the truck rate? | v2.2735 | [`crew-pnl-and-wheels.md`](./crew-pnl-and-wheels.md) |
| Parts Book cleanup: five "K-25077-0 KINGSTON 1.28 GPF…" rows (one spelled "kingstin", created 09-03/09-04) and two "OS-25" rows are still in `material_parts` — which one survives each group? | v2.2755 | `/duplicates` |
| Job Summary placeholder jobs: seven rows at Gun Dog Trail, Neeses SC created 2026-08-08 — three marked paid ("Materials" $894,971 · "Gas Line" $496,748 · "ROUGH IN" $241,431) and four $0 waiting (J953–J956) — archive them, or name a placeholder convention to key on? | v2.2893 | `docs/recent-features/v2.2893.md` |

Answered since the 2026-09-05 sweep: takeoff unit price is **blended** (v2.2655 — the quote override replaces the materials component only); **gas** files under 23 11 23 (v2.2626); the estimator People icon question is moot (v2.2920 removed the estimator People route).
