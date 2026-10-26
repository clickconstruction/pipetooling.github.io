# Skeptic-engineer findings — the four stage desks (2026-10-26)

Method: drove all four prototypes with Playwright (`drive.mjs`, `sk-*.png`, `drive-log.json` in this folder; zero console errors on all four), then checked every number and press against the real kernels (`buildPace.ts`, `fieldPace.ts`, `billPile.ts`, `billedDay.ts`, `demandPace.ts`, `loadDemandPace.ts`, `stageFlow.ts`, the `collect/` kernels) and the generated schema (`src/types/database.ts`).

## Cross-desk — the one finding that gates all four

- **MUST · "Record this as the week's plan" · the call model holds one link.** `bridge_calls` + `calls.ts`/`stageFlow.ts` treat any recorded call's stage as the **held link**: record a Market plan while Build is the link and Market is lit next load (`heldLinkId`), and the Friday verdict machinery reads it as the week's call. Collect's desk gets away with it because its door only existed when Collect *was* the link. Fix, pick one: (a) v1 ships every desk's reading sections but enables **Record** only when that stage is the lit link (Collect's rule today — no schema change); (b) a migration adds a `kind`/`desk` marker to `bridge_calls` so a desk plan never holds the link and Friday reads it separately. Nothing else in any desk needs DDL.

## Build

1. **MUST · Record button · records an empty plan.** `record()` has no guard (verified: recorded with zero moves). Bill disables the button until something is planned; Market refuses with a toast. Match one of them.
2. **SHOULD · "quiet · no field hours in 14 days" · the read does not exist yet.** `loadVectorSessions` reads a period for the People strip, not sessions-by-job. Honest and cheap, but `loadBuildDesk.ts` must add a closed-sessions-by-job read over the last 14+ days; say so in the brief (it currently waves at "session recency").
3. **SHOULD · row do-lines name crews ("Keep Malachi's crew on it") · no Bridge loader reads crews.** `people_crew_jobs` holds it, but that is a new read; v1 should say "keep the crew on it" or add the read explicitly.
4. **SHOULD · the % slider hides the real side-effect.** Live, Set-the-% goes through `FieldPctUpdateModal`, which files a status report (the pct-prompt precedent, v2.5245). The sheet should say "saves the % and files a status report," or reuse the modal.
5. **COULD · tile 3 "left alone the pile shrinks only $2.5k/wk"** mixes the by-hours out-pace with sold-in; correct arithmetic ($52.9k − $50.4k), but caption it "at the by-hours pace."
6. Arithmetic verified coherent: 18 + 9 + 5 = 32 jobs; $122k = half of $244k; slider save moved headline/tiles/bar together (designer's render + source read).

**Smallest real v1:** expose `buildPace`'s per-job rows (it already computes them in its loop), `job_pct_events` recency, one sessions-by-job read; doors only until the cross-desk record question is decided.

## Bill

1. **MUST (good news) · "days since ready" is real — stop calling it an owner call.** `job_status_events` (job_id, from_status, to_status, changed_at) exists; the newest `to_status = 'ready_to_bill'` row IS the ready day. v1 reads it; keep "last % move" only as the fallback for rows predating the table, as the footnote already words it.
2. **SHOULD · "bills cover $X of $Y" can lie when payments win.** `coveredUsd` = max(billedUsd, paymentsUsd); when payments exceed bills the row should say "payments cover $X," not "bills cover $X." One word, but it is the desk's own honesty rule.
3. **SHOULD · scorecard "billed the day it finished" needs the ready day per bill** — same `job_status_events` read joined to `billedDay`; name it in the loader plan.
4. **COULD · "Record a bill sent outside the app" sheet** should carry the real door's name in the sheet body (Bill the customer → record-only), not only in the toast.
5. Arithmetic verified live: setting 1007 from 80%→40% dropped the headline by exactly the row's $4.8k ($41.9k → $37.1k) with the grey untouched; record stays disabled until something is planned. ✓

**Smallest real v1:** `billPile.items` (exists) + job labels + `job_status_events` ready-days; the Bill-it door and the record-only path exist today.

## Market

1. **SHOULD · per-GC grouping and names · loader widening only.** `bids.gc_builder_id` exists and `loadDemandPace` simply doesn't select it; join `gc_builders` for names. No migration — the brief is right, and nothing in this desk needs new schema.
2. **SHOULD · "won here" and "quiet" spans must stay tied to the read.** The loader reads since window−90d, which exactly covers the footnote's "window + the 90 days before it" — if anyone widens the words ("this year"), the read must widen with them.
3. **COULD · the recorded stamp counts moves but not plan-words.** "Recorded · 2 moves" while a courted GC rides the plan as words; say "2 moves · 1 in words" so Friday's reader isn't surprised.
4. Honesty verified: the $0-bid aside off the value bar, the win-share basis and its sent-nothing fallback, and the empty-plan refusal all hold under driving. The cleanest of the four.

**Smallest real v1:** widen the demand select (`gc_builder_id`, created/sent per bid), a week-fold + per-source kernel; `marketWinShare` and every figure already exist.

## Sales

1. **MUST · "goes on the bid's decision day" names a column that does not exist.** Bids carry no decision-day field; the real columns are `next_followup_on` + `next_followup_reason` (and `last_contact`). Point the After-the-call "They named a day" write at those and say so in the sheet and footnote.
2. **SHOULD · lifetime claims exceed the read.** "Has never answered one," "1 of 7 · 9%" read as all-time; the loader spans window+90d. Either add one chunked read of all bids for the pile's GCs, or re-span the words ("in the last six months").
3. **SHOULD · "answers in ~24d" is the office's recording day.** Pace = sent → `outcome_at`, which is when we marked it, not when the GC spoke. Word it "answered in ~24d, as recorded."
4. **SHOULD · mark-lost should ride the existing loss flow.** `loss_reason`/`loss_category` exist; route the desk's Lost through the bid's own lost flow (the `fillInLostBids` precedent) rather than a raw update, so reason quality holds.
5. **COULD · "$480k past the window" is one new read** (open bids with `bid_date_sent` < 90d back); name it in the loader plan.
6. Verified: the After-the-call sheet writes the row state and the footer recounts ("4 calls · 1 answered"); clipboard fallback handled on file://.

**Smallest real v1:** widen the demand loader (gc id/name), the awaiting rows already carry sent dates for aging; After-the-call = `next_followup_on`/`last_contact`/the loss flow — all existing writes.
