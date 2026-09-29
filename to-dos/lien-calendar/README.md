---
name: "Lien calendar: every billed job on the statute's calendar, as the Lien desk's first tab"
number: 56
group: ready
status: designed 2026-09-28 (canvas boards 6–7) · PR A shipped v2.4103 (promises in the job's activity) · PR B shipped v2.4101 (the Calendar tab shell, grouped by GC) · PRs C–D not started
summary: >
  The lien runway (v2.4051 · v2.4064 · v2.4096) puts one job's two dates under its money bar. The
  owner wants the whole board at once: every billed job and how close it is to its notice date and
  its lien date, visually, searchable, clickable. Not a new modal — the Lien desk gains a first tab,
  the Calendar: one shared time axis with Texas's 15ths as the columns, rows grouped by GC (a
  notice goes to the owner AND the GC; one GC's jobs share a run), every unpaid month's notice as a
  hollow flag, the lien as a solid flag, the pay dot editable in place ("They said…"), a density
  strip counting what lands on each 15th, a to-do line the columns write, and a key that names
  every mark. The desk widens to direct jobs (affidavit only). Promises recorded anywhere now show
  in the job's activity feed (PR A).
next: PR C — the body: the shared axis with the 15ths as columns, every unpaid month's notice flag, the kind bracket, the density strip, the key, the today pill, the to-do sentences; then PR D the pen. The owner looks at the live shell first.
size: S (PR A, shipped) + M (PR B, shipped) + L (C) + M (D)
blocker: none — data already exists (useForecastWorkMonths knows each month's notice state; the runway kernel gives marks and sortKey per job; the promise RPCs exist).
ver: v2.4051 · v2.4064 · v2.4096 · v2.4103 · v2.4101
opinion: build B → C → D in that order; C is the value, B makes it land in the right place, D is what makes the chart a tool and not a picture.
---

# Lien calendar: every billed job on the statute's calendar, as the Lien desk's first tab

## The ask

The owner, 2026-09-28, after the runway shipped: *"I think it might be cool to be able to open something on the job stages page that shows all of the jobs and how close they are to their notice date and lien date visually, how could we make a modal view of this that is searchable and clickable?"* Then, on the first mock-up: *"I don't think the flags and markers are super clear, we should probably have something somewhere that explains what each one is."* · *"Perhaps today should be one solid line."* · *"Perhaps we should make it easy for a user to mark when a customer is expected to pay from this screen?"* · *"When a person adds a note like this, does it also add that note to their activity section and job stages?"* (it did not — PR A).

Mock-up: [`mockup.html`](./mockup.html) beside this file (board 7 of the design canvas, https://claude.ai/artifact/15rpqF2B1pjmXsMkjzGTTs, which also holds the earlier drafts: before · first try · best · compare · the notice on the runway · the first modal).

## The decision

Two drafts were rejected on the way:

1. **A list of jobs, each with its runway, sorted tightest first.** Rejected: every runway has its own scale, so the flags never line up and the reader still reads sixty sentences one by one. Texas deadlines all land on the 15th (weekend-rolled) — in today's data everything is Oct 15, Nov 16 or Dec 15 — and a list hides the clustering.
2. **A new modal from the Billed header, one row per job on a shared axis** (board 6). Better, but: a second door to the same work the Lien desk already does; rows at the job grain when a notice goes to the owner and the GC and one GC's jobs share a run; only the last work month's notice when § 53.056 is per month; "kind?" as a tag on 38 of 64 rows when it should be drawn; checkboxes for a batch the density strip already selects; a chart first when the office wants a to-do first.

**Picked (board 7):**

- **The Lien desk's first tab, "Calendar".** The desk widens from GC jobs to every billed / collections job; direct jobs sit under one heading with the affidavit only. The Billed header's Lien desk button lands on the Calendar.
- **One shared axis, the 15ths as columns.** A past gutter left of today keeps lien-gone rows at their closed date instead of a count. **One today line**, drawn once over the grid (not per row), carrying a dark **"today · Sep 28" pill** at the top, sticky as the rows scroll.
- **Rows are GCs**, open to their jobs; a flag on a GC row carries a count (a hollow "3" at Oct 15). Direct and Lien gone are their own groups.
- **Marks:** pay dot · hollow flag = a notice owed (one per unpaid month) · check = notice recorded · solid flag = the last day to file (§ 53.052), tone by closeness and verdict · green run = room · red hatching = file first or a closed window · **striped bracket + faint flag** = property kind not set (the flag is at the residential date but could be as late as the commercial one) · a number by a flag = jobs sharing that date on a GC row · **dashed dot** = no pay date yet, click to record.
- **A key** under the axis header draws every glyph beside its meaning; open the first three visits, then a click away; the same text is the hover on any flag.
- **The first fold is a to-do**, three sentences the columns write: *By Oct 15 · 17 d: 3 notices to RMC · $21.8k → Draft the three* · *Before that: 38 properties have no kind → Set kinds, biggest first* · *By Nov 16: 42 notices across 7 GCs, 3 liens to file*. The density strip (notices amber, liens dark, per 15th; click a bar to select its jobs) and the rows are the evidence under it.
- **The pay dot is an input.** Click a dot (or the dashed dot on a row with no date) and the **"They said…" popover** opens in place: pay-by date, whose word (owner or GC), a note; it reads the consequence back before Save (*4 d after the lien flag — file first*). Drag along the axis ends in the same popover, never saves on release. On a GC row one dot is the GC's word from the statement round, for all its jobs. Same promise record the Pipeline chip writes.
- **Rows are doors:** a GC row opens its pile on To draft; a job row opens its Lien window; a flag opens that month's notice; the density bar selects a column and the to-do line carries the one action (*Draft the three*).
- **Less text per row:** dollars and one verdict line; the full sentence is the hover.
- **Phone:** no axis; three column cards (Oct 15 · Nov 16 · Dec 15) carry the density, then the two-line sentences with a flag glyph, then the same one action.
- **Search** reads job #, name, customer, GC and address — the Pipeline search's fields.

Open question, left for PR C: a GC pays several jobs on one check, so a pay dot per job is a little false on a GC group; the group row could carry the GC's statement-round date instead (one dot for the group), the jobs beneath their own only when one differs.

## Where it plugs in

- **Kernel, exists:** `src/lib/jobs/lienPayRunway.ts` — `buildLienPayRunway` per job: states (`notice_due` · `file_first` · `room` · `no_pay` · `closed` · `filed`), marks, `sortKey`, `kindAssumed`, `datedFromCreation`. The calendar reuses it per job and reduces per GC.
- **Month-by-month notice state, exists:** `src/hooks/useForecastWorkMonths.ts` (`buildWorkMonthsByJob` in `lib/jobs/forecastWorkMonths.ts`) — each work month's notice deadline and whether a live § 53.056 notice covers it; the Payment forecast's month panel reads it. The calendar needs this per billed job (every unpaid month, not the runway's last-month approximation).
- **The desk, exists:** `src/components/jobs/LienDeskModal.tsx` (map: `docs/LIEN_DESK_ARCHITECTURE.md`), kinds `calendar · notice · affidavit · retainage · timeline`, data from `useLienDeskData` (GC jobs only — the notice piles), piles, the run (draft → approve → send), the GC picker. The Calendar is the fifth kind, first in the row and the desk's default (PR B, v2.4101); its rows come in from the Pipeline (`JobsStagesTab` → `lienCalendarRows`, through the same `lienRunwayFor` the row uses) rather than a widened `useLienDeskData`, so the calendar and the board never disagree.
- **Promises, exists:** `add_job_payment_promise` / `list_job_payment_promises` / `void_job_payment_promise` (`lib/jobs/paymentPromises.ts`, `SetPromisedPayDateModal.tsx`); the GC's word via `lib/jobs/gcWordPromise.ts` from GC Review. **PR A (v2.4103)** maps live promises into the job's activity feed (`lib/jobs/promiseActivityEvents.ts`, `useJobThreadNotes`).
- **Property kind, exists:** `customer_addresses.property_kind`; the Edit Job → Property record row sets it; `lienByForJob` assumes residential when unset.
- **Doors:** `JobsStagesTab` `setLienDesk(...)` (the Billed header's Lien desk button, the tools menu); `setLienInstrumentsModal` for a job's Lien window.
- **Built in PR B (v2.4101):** `lib/jobs/lienCalendar.ts` (`buildLienCalendar` — the search, tightest first, one group per GC + Direct + Lien gone, each group's total and next move) and `components/jobs/LienDeskCalendarTab.tsx` (the header line, the search box, collapsible groups, one row per job with its `LienPayRunway`; a row opens the Lien window). **New:** a shared-axis renderer, the reduce grows density per 15th + the to-do sentences + every unpaid month's flag, the popover (`SetPromisedPayDateModal`'s form as an anchored popover).

## The plan

| PR | What | Size | State |
|---|---|---|---|
| **A** | Promises in the job's activity feed — `payment_promise` event type, read-side merge in `useJobThreadNotes`. | S | **shipped v2.4103** |
| **B** | The **Calendar** kind, first in the tab row and the desk's landing (the ⋯ menu and the Collections header's door): every billed / collections job — direct jobs too, affidavit only — grouped by GC with a next move per group, search, rows opening the Lien window. Rows come from the Pipeline's `lienRunwayFor`, not `useLienDeskData`. | M | **shipped v2.4101** |
| **C** | The Calendar body: `lib/jobs/lienCalendar.ts` (per-job runway → GC groups, every unpaid month's notice flag from `buildWorkMonthsByJob`, the kind bracket, density per 15th, the three to-do sentences, search), the shared-axis renderer with the one today line + pill, the key, the past gutter, rows as doors, the phone list. | L | |
| **D** | The pen: the pay dot / dashed dot opens the "They said…" popover in place (consequence read back before Save; drag ends in the popover); the GC row's one dot writes the GC's word (`gcWordPromise`); density-bar selection → *Draft the N* hands the jobs to the desk's run; *Set kinds, biggest first* opens the property records. | M | |

Each PR: release note + fragment, the guide *send lien notices from the Lien desk* (+ *read the Pipeline's money view* for the door), `docs/LIEN_DESK_ARCHITECTURE.md` region for the new kind, GLOSSARY *Lien calendar*.

## How to verify

Live data on 2026-09-28 (local build against prod rows): 64 billed runways — 45 *send the notice*, 10 *notice window closed*, 2 lien window closed, 5 flag alone, 2 room; 38 rows with the property kind unset; RMC · Dudley Mason the largest GC group. So the calendar's first fold should read close to: *By Oct 15 · 17 d: 3 notices to RMC* · *Before that: 38 kinds to set* · *By Nov 16: 42 notices*. A direct homeowner job (e.g. Mike Holub) must appear under Direct with a solid flag and no hollow one. Never press Send or Save on prod; the TEST job + the training account are the write targets (see `to-dos/subs-residuals.md` for the TEST job recipe).

## Where it stands

Designed; PRs A and B shipped (v2.4103, v2.4101 — the 2026-09-28 census read 64 rows, 45 *send the notice*, 12 under Lien gone, as predicted). Neighbours shipped the same day: the strip's fold (v2.4111) and the run's mailing workflow (v2.4119, board 9). Next: PR C, after the owner's look at the live shell.
