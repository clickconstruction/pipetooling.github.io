---
name: "Charges by crew: a rate card by who was out, a markup on materials, the Statement of charges, and the Job Summary's Charges window"
number: 254
group: ready
status: all four PRs built 2026-11-03 (v2.6441, v2.6445, v2.6447, v2.6448) with #251's PR 2 (v2.6446) between them, queued behind one another · the rate card's missing rows are the owner's · the live pass follows the last merge
mockup: the canvas and its critique — https://claude.ai/artifact/8zmhz5CJPUg8UUrrRZ3ecy (eight artboards, A to H); no static copy in the repo, because the papers on it are drawn from one person's reconstructed hours, which stay out of git
summary: >
  Punch list #251 gave the company one rate for an hour. The owner's next asks, all on 2026-11-03: the rate is
  really per crew-hour and depends on who was out that day (a master with a helper is $285, two techs $285,
  a tech alone $185, a helper alone $75); materials want a markup over cost the same way; the office needs a
  job-level Statement of charges that prices labor and materials from the rows the Costs tab already holds,
  with an office copy that shows cost, margin and the premium or shortfall against the price, and a customer
  copy that shows charged amounts only; the Job Summary ledger wants Charges and Premium beside Revenue and
  True profit; and a click on a Charges cell should open a window that shows every line and lets the office
  adjust a day's crew, leave a line off, or pass a material through at cost, with a reason, without touching
  anyone's clock session. Four PRs, smallest first.
next: PR 1 — the person's standing, the rate card and the markup in Settings (the v2.6431 card grows into the rate card), the crew-day kernel over approved sessions, and tests. Cut it now; the owner's missing rows ship blank and the kernel refuses to price a shape with no rate.
size: S + L + L + S
blocker: #251's PR 2 (the hours statement's window, print and gate on the charged basis) lands first, so the Statement of charges copies one layout; the rate card's rows for a master alone, two helpers and three or more are the owner's
ver: —
opinion: build — every input exists (sessions, invoices, tally parts, typed charges, revenue, the people's roles); the new facts are a standing, seven rates, a markup, a job's rule and a table of adjustments, and the rest is kernels over rows the Job Summary already loads
---

# Charges by crew (#254)

## The ask

The owner, 2026-11-03, in one sitting, after the charged basis of #251 landed as a setting: *"I really like the idea of
this charge rate. It also allows us to add a margin to our materials."* Then where it lives and what it looks like,
drawn on the canvas above. Then the words for the gap between the statement's total and the price: *premium* above,
*shortfall* below, on the office copy only (*warranty* and *discount* were considered and dropped, because both mean
something else in the app and would be read literally by a customer or an attorney). Then: *"Let's also think about if
this should show up in the job summary tab of jobs."* Then the rate itself, in the owner's words paraphrased:
a crew that is not a master plumber with a helper should not be charged $285; two techs out together are $285, each
alone $185; a helper alone is $75. For the Gun Dog development the master-with-a-helper way was used throughout,
whoever clocked. And last: *"a dedicated modal where when a user clicks on charges they can see a breakdown of
everything and an easy way to adjust."*

## What the app has today (verified 2026-11-03 by reading the code)

- **One rate, two homes** (#251 PR 1, v2.6431): `app_settings.hourly_charge_rate_v1`, seeded $285, and
  `jobs_ledger.hourly_charge_rate`; the Settings card *Rate charged for an hour*; the hours statement kernel's
  `basis: 'charged'`, which prices every counted hour of one person at one rate. No crew, no shape, no markup.
- **Materials cost on a job** comes from three streams the Costs tab sums (`buildJobChargeEvents`): supply-house
  invoices shared to the job (`supply_house_invoice_job_allocations`, a percent of `supply_house_invoices.amount`),
  parts tallied to the job (`jobs_tally_parts`, `fixture_cost`), and material charges typed on the job form (the
  *billedMaterials* stream). Bank rows on the job are a fourth stream and are not materials by themselves.
- **Markup exists on the bid side only**: `computeUnitSellingPriceFromMarkup(unitCost, marginPct)` in
  `src/lib/unitPriceFromMarkupOnCost.ts` (cost × (1 + pct/100), to the cent) and the pricing tab's markup by tag.
- **Crew days exist for dispatch**: `src/lib/crewDay.ts` groups a day's crew for the crew emails. Nothing groups clock
  sessions by job and day.
- **Standing**: the roles carry `master_technician` and `helpers`; `hoursStatementStanding` words a person's standing
  for the paper from the role. No field says what a person counts as when a crew is priced.
- **Jobs → Job Summary** (the ledger view, `JobsJobSummaryTab.tsx`, `lib/jobs/jobSummaryLedgerView.ts`): one row per job
  with revenue, the cost streams, the overhead share and true profit, grouped by GC, trade, tech, account man, customer,
  development or bill month; money behind the profit gate (a dev, the controller, a master or leader with pay access);
  a drill-down window on every cost cell; *Print cost breakdown*.
- **The Documents tab** carries *Hours statements* (#212) with its window, its table of saved papers and its print.

## The model (the decision)

- **A person's standing**: master, tech, helper, or not charged. One field on the People record, set once.
- **The rate card**: Settings → Jobs & dispatch → *Rates charged by crew*, seven rows for the crew's hour — master with
  a helper $285, two techs $285, master alone, a tech alone $185, two helpers, a helper alone $75, and each person beyond
  two. The three without a number are the owner's. The v2.6431 card becomes this table; its setting key stays as the
  master-with-a-helper row so nothing already saved moves.
- **The markup on materials**: one percent over cost, company-wide, with a job override; the card shows both readings
  of the number (*25% over cost is a 20% margin on the sale*). Rentals and sub labor pass through at cost unless a line
  is set otherwise.
- **A crew-day**: the people who clocked on a job on the same day. Its shape is the standings present; its rate is the
  card's row; its hours are the longest day of anyone in it. Two techs out eight hours together is one line,
  8 crew-hours at $285, never sixteen person-hours. A crew of three or more is the two highest standings' row plus the
  per-person add-on.
- **A job's rule** (Edit Job → *Charging the customer*): the crew on each day from the rate card (the default), or one
  named shape throughout, or a flat rate. Gun Dog's jobs take *master with a helper throughout*.
- **Charges on a job** = every approved crew-day at its rate + every material line at cost × (1 + markup), with the
  job's **adjustments** on top: a day's shape changed, a day or a line left off, a material passed through at cost, each
  with a reason and who made it, kept on the job and never on a session or an invoice.
- **Price** is the job's revenue. **Premium** is price above charges; **shortfall** is price below. Both office-only.
- **The papers**: the Statement of charges is a job-level paper (a crew's hour belongs to the job, not a person). One
  snapshot, two prints: the office copy with cost, markup, margin, the adjustments and the premium or shortfall; the
  customer copy with charged amounts only and the line *This is a statement of charges for the period, not an invoice*.
  Every labor line names its crew and shape; one line under the table says how many days are imported from the pay
  records rather than clocked. A person's own hours statement on the charged basis lists the crew-days they were part
  of and says so, so two papers never sell the same hour twice.
- **Nothing on any of it is typed in**: every line is a row the Costs tab already shows, so the paper reconciles to
  the cent, and no estimate enters a job through it.
- **Money words** (the owner, 2026-11-03, on the canvas): the cents are always smaller text than the whole dollars, on
  every screen and paper this train draws — the papers, the window, the ledger's two columns, the Charges window's
  tiles and rows — one kernel that splits a figure into its dollars and its cents, so no surface formats money by hand.
  The hours statement's print (#212) takes the same rule when #251's PR 2 touches it.

## Where it plugs in (the artboards)

- **A · Settings → Jobs & dispatch**: the rate card and the markup card side by side.
- **B · Edit Job**: the *Charging the customer* fold — the job's rule, the flat rate when chosen, the job's markup.
- **C · Documents tab**: *Statements of charges* beside *Hours statements*, same shape (a press with its counts, a
  table with Print and Open, an empty state that names the press).
- **D · The Statement of charges window**: the period, Labor by crew-day with the job's rule shown and a door to change
  it, Materials with the markup, the office-copy switch, the imported-days switch, the counts of what the span holds and
  what stays off, the paper beside; **Print** and **Save the statement**.
- **E and F · The paper**, office copy and customer copy.
- **G · Jobs → Job Summary**: *Charges* and *Premium* beside *Revenue* and *True profit*, behind the profit gate, the
  toolbar chip naming the rate card and markup in force, the group rows summing (the development filter is the
  Gun Dog roll-up); a click on a Charges cell opens H.
- **H · The Charges window**: the job's rule and markup at the top (they write to the job, as B does); four tiles —
  labor, materials, charges, against the revenue — each with the figure as the record and with the adjustments in
  hand; the crew-days by week with a tick to keep the day and the shape as a chip the office can change, with the
  reason under it; the material lines with a tick and *Pass through*; the adjustments log; **Revert to the record**,
  **Make the statement from this…**, **Save N adjustments**.

## The plan

- **PR 1 · the facts and the kernel (S).** `people.charge_standing` (master · tech · helper · none) with the People
  record's field; `app_settings` rows for the seven rates and the markup, the v2.6431 card grown into *Rates charged by
  crew* plus *Markup on materials*; `jobs_ledger.charge_rule` (crew · shape · flat), `charge_shape`,
  `materials_markup_pct` beside the existing `hourly_charge_rate`; the pure kernel `src/lib/charges/crewDays.ts`
  (sessions → crew-days → shape → rate → charged, refusing a shape with no rate and naming it) and
  `materialsCharged.ts` (lines → cost, markup, charged; pass-through); tests on the owner's four examples and Gun Dog's
  rule. Migration with `SET lock_timeout = '3s'`, additive.
- **PR 2 · the Statement of charges (L).** After #251's PR 2: the window (D), the paper's two prints (E, F) on the
  restyled hours-statement layout, the Documents section (C), `job_charge_statements` with the snapshot and the record id
  `SC-<job number>-<n>`, the gate as the charged hours statement's, the guide *show a customer what a job's hours and
  materials are charged at*, the docs.
- **PR 3 · the ledger and the window (L).** The Job Summary's two columns and chip (G), the `job_charge_adjustments`
  table (job, kind day · line, the target, the new shape or pass-through, the reason, who, when), the Charges window
  (H) through the existing cost-cell drill-down door, the office copy printing the adjustments.
- **PR 4 · the loose ends (S).** The person's charged hours statement listing crew-days; the Edit Job fold (B) if PR 1
  shipped it as a dev field; `docs/twins/APP_DIRECTORY.md`, the Glossary's *Premium (charges)* and *Crew-day* entries.

## Open calls (the owner's)

- The rate card's rows for a master alone, two helpers together, and each person beyond two.
- Rentals: marked up as materials, or passed through at cost (the mock-up marks them up and names them).
- Sub labor: passed through, or marked up.
- Bank rows on a job that are materials (a card charge at a supply house): counted as materials, or left as bank cost.
- Whether the office copy carries labor cost at wages for the payroll roles, or keeps pointing at the hours statements.
- The customer copy's opening sentence.

## How to verify

Dev server, `/dev-login?as=1`. Settings → Jobs & dispatch: the rate card shows the four owner's numbers and three blank
rows; blank a row, open a job whose days need it, the window names the day it cannot price. Jobs → Job Summary grouped
by development, Gun Dog: Charges on the rough-in reads its crew-days at $285 with the job's rule, the premium column
reads a shortfall while change orders 957 and 958 are unbilled; a click opens the Charges window; set one Saturday to a
tech alone with a reason, save, and the row, the window's tiles and a new statement all read the adjustment, while the
clock session is unchanged. The customer copy shows no cost, markup, margin, premium or adjustment.

## Not verified

The ledger's dynamic headers (the artboard draws them approximately); the per-day overlap rule when one person leaves
early (the longest day stands in for it until the owner wants a finer cut).

## Where it stands

Drawn 2026-11-03. Built the same day: PR 1 (v2.6441, the standings, the rate card, the markup), PR 3 (v2.6445, the Job Summary's columns and chip, the Charges window, `job_charge_adjustments`), #251's PR 2 (v2.6446, the charged hours paper on crew-days) and PR 2 (v2.6447, the Statement of charges: the window, the two prints, `job_charge_statements`, the Documents section). PR 4 (v2.6448, the Edit Job row *Charging the customer*, the directory and the glossary) closes the train. Each lands after the one before it merges, with its migration pushed right after; the live pass at three widths follows the last.
