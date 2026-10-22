---
name: "The Costs tab on paper: a printed packet for a job"
number: 143
group: gated
status: proposed 2026-10-22 · the packet was drawn from job 891's live numbers and shown to the owner (the committed page shows a made-up job) · waiting on the owner's look and his yes
summary: >
  The job window's Costs tab tells the money story of a job in one screen: the true margin at
  completion, what was spent and earned, the time left, the chart of cost against value earned,
  the baseline and where the money went. The owner wants those details as a neat packet that
  prints on command, on 8.5 × 11 paper. This to-do draws the packet from the tab's own numbers,
  four Letter pages, and plans one PR: a Print button on the tab and a pure HTML builder beside
  the Job Summary cost-breakdown print.
next: The owner looks at the four pages and says build it, or asks for changes. Then PR 1.
size: S
blocker: The owner's look at the mock-up, and the three calls under Decisions.
opinion: build — the tab already loads everything the packet prints, so this is one pure builder with tests and a button; no new data, no migration, no edge function
mockup: to-dos/costs-packet/mockup.html
---

# The Costs tab on paper (#143)

## Where it stands

Proposed 2026-10-22. The packet was drawn in two passes from job 891's Costs tab as it read that
afternoon (dev-login as Robert, read only, nothing changed), and every figure on the pages was
checked against the tab's own numbers: the same arithmetic over the same aggregates lands on the
same true margin, cost at completion, overhead share, earned value, time left, hours per $1k and
average wage to the dollar. The live render was shown to the owner as a PDF; the committed
`mockup.html` is the same page for a made-up job, since this folder is public. Nothing is built.

## The ask, in the owner's words

2026-10-22, with a screenshot of the Costs tab on *Take 5- Liberty Hill* (891):

> I would like to be able to export these details into a neat document … a very neat packet that
> can be printed on command … come up with a mockup using live data from this job and after making
> a pass ask yourself is this the best we can do? are we presenting as much as we can in an easy to
> follow way? and then show me what it could look like before we build it. It will be printed on
> 8.5 x 11 paper.

## What the tab holds today

The Costs tab is `JobCostsTabCharts` (the verdict, the chart, the fold) above
`JobFormPartsCostSection` (the money table and the accordions), both inside the job window's
Costs region of `JobFormModal`. One load feeds all of it:

- `useJobChargesTimelineInputs` → every dated cost event (team labor by person and day, sub labor
  sheets, supply house invoice allocations, card charges with the fuel tag, tally parts, other
  charges), the % events (field reports and the office's hand-set), the payments and the price.
- `useJobBurnOverhead` → the job's overhead day-share so far and per field day.
- `buildBurnForVerdict` + `buildCostsVerdict` (`src/lib/jobs/jobBurn.ts`,
  `src/lib/jobs/jobCostsVerdict.ts`) → the four tiles, the by-section table, the baseline strip,
  the cumulative rows the chart draws and the pace rows.
- `useJobBudget` and `useJobBaseline` → the linked bid's figures and the kept baseline.
- `buildMoneyRows` (`src/lib/jobs/jobMoneyTable.ts`) → Where the money went, with the fuel slice.
- `fetchJobMaterialsCostSnapshot` → the supply, card and tally lines the accordions show;
  `fetchTeamLaborBreakdownForJob` → hours and cost per person; the sub sheets from `people_labor_jobs`.

The house precedent for a print is Jobs → Job Summary → **Print cost breakdown**:
`buildJobSummaryCostBreakdownHtml` in `src/lib/jobsDocuments/jobSummaryCostBreakdown.ts`, a pure
builder with unit tests, opened by `openHtmlPrintWindow` (`printWindow.ts`), which writes the
HTML into a popup and calls print.

## The packet

Four Letter pages, portrait, half-inch margins, light theme, system sans. The page footer on
every sheet reads the company, the job and who printed it when, with *Page N of M*. The mock-up
beside this file is the page; print it to see the breaks.

**Page 1, at a glance.** The job's identity block the screen keeps in the window frame: the
company, the job name, the number chip, the address, the customer, the status, the day it opened
and the last field day. On the right, *Printed Oct 22, 2026 4:05 PM by Robert*. Then the tab, in
its order: the price and the % done with its source (*set on the job Oct 7 by Taunya*), the green
or red **True margin at completion** band with its sentence, the three tiles (**Spent so far**,
**Earned so far**, **Time left**), the **Cost against value earned** chart as inline SVG with the
price line, the cost line, the value-earned steps, the forecast dash and the two end labels, and
**How the margin builds, by section**, the table the margin tile folds open on screen, with
Direct cost, Overhead share, True cost, Price and True margin as its last rows.

**Page 2, where the money went.** The baseline strip (the bid's figures when a bid carried
hours, else *What it has taken so far is the baseline* with the hours, hours per $1k, average
wage, people and materials, and the kept line). Then **Where the money went** with the share
bars, and the lines behind its biggest rows: team labor by person (field days, hours, cost), the
sub labor sheets, and the supply house invoices.

**Page 3, card charges and pace.** Fuel & gas and the other card charges as two columns, with
the one-card rule stated under the heading; parts from tally and other job charges; the **Pace**
rows (burn rate, work left, field days, overhead landed so far, cash position); and a **Notes**
box with four ruled lines for the office's pen.

**Page 4, by day.** One row for each day with a cost, a payment or a % done: team labor with its
hours, sub labor, supply house, fuel, cards, parts and other, the day's total, the cost to date at
the end of that day, and the payment or % event. This is the Cost Timeline on paper. When the last
14 working days had spend, the daily bars draw above the table; when they had none, one line
says so.

## The second pass: is this the best we can do?

The first draft printed five pages and read well. The second pass asked the owner's two
questions and changed four things:

- **Is every number the tab's own?** Yes, and now proven: the stand-in builder derives the
  verdict from the aggregates with the kernels' arithmetic, and on job 891 every derived figure
  matched what the tab printed. The real builder reads the verdict the tab already built, so the
  question does not come up again.
- **Is page 1 the whole story at a glance?** It was, but its chart's two end labels (*cost to
  date*, *value earned*) collided and the section table's caption was a glued list. The labels
  now sit above and below the line ends, and the caption is two sentences: what true margin is,
  and where the bid figures come from.
- **Are we presenting as much as we can in an easy-to-follow way?** The first draft listed every
  dated line a second time on the by-day pages (every fuel stop twice) and spilled to a fifth
  page with no header. The by-day table is now one row per day with a column per source, so page
  4 is one page, and the lines live once each on pages 2 and 3. Page 2, which was half empty,
  took the supply house invoices from page 3.
- **What would the office want on paper that the screen does not show?** The identity block,
  the printed stamp (when, by whom), the % done with its date and who set it, the field-day
  count per person, the cash position (paid less direct cost, the Cost Timeline's green line)
  and the notes box. All four are on the pages now.

**Left off, on purpose:** every door and button (Link the bid, Keep as baseline, show below,
Open on Jobs, + Add other charge), the by-fixture fold, the tooltips, the *money story* link,
the card nicknames' long form, and the emoji timeline chart, which the by-day table replaces.
Per-person wage rates are not printed as a column; the hours and cost per person are, as the
tab's team labor row already opens them for the same roles.

## The button

**Print** sits on the Costs tab's first line, after the % done words, for the roles that see
the verdict (`showJobCostBreakdownTeamLabor`: dev, master, controller). Other roles do not see
the verdict, so their packet would lie about labor; they get no button. It opens the packet in a
popup and calls print, the way **Print cost breakdown** does. The popup-blocked case toasts
*Allow pop-ups to print it.* The packet is printed on command, never stored, and nothing on the
job changes.

## Decisions for the owner

- **D1 · Four pages, or two?** Recommended: four, as drawn. A two-page cut would be page 1 plus
  the money table and the pace rows; the lines and the by-day page would be gone. The owner
  asked for as much as we can present, so four.
- **D2 · The by-day page.** Recommended: keep it. It is the Cost Timeline's content in a form
  that reads on paper, and it is the page an office hands to someone asking *when did this cost
  land*.
- **D3 · Where the button lives.** Recommended: on the tab's first line as drawn. The other
  place is the window's icon strip beside the share icon, which would print the packet from any
  tab; the tab's own line is the plainer door.

## The plan

One PR, client only, no migration and no edge function. Size S.

**PR 1 · the builder and the button.**

- `src/lib/jobsDocuments/jobCostsPacket.ts`: `buildJobCostsPacketHtml(input)`, pure, beside
  `jobSummaryCostBreakdown.ts`. Its input is what the tab already holds: the job (name, number,
  prefix, address, customer, GC, status, opened and last field day), the printer's name and the
  time, the `CostsVerdict`, the `JobBurnModel` (the cumulative rows and the daily rows for the
  chart and the bars, the pace figures), the resolved budget's words, the baseline state, the
  `MoneyRow[]`, the team labor breakdown (per person: hours, cost, work dates), the sub sheets,
  the snapshot's supply, card and tally lines with the fuel tag, the other charges, the
  payments, the % events and the overhead to date. Formatting helpers stay in the file; the chart
  is `jobCostsPacketChartSvg(rows, price, todayYmd)`, exported so the test can hold it.
- `JobCostsTabCharts` gains `onPrint` wiring: a **Print** button on the first line when the
  verdict shows; the click gathers the inputs above from the hooks the tab already runs plus the
  snapshot lines and team breakdown `JobFormPartsCostSection` holds (lifted through props, the
  way `teamLabor` and `subLabor` reach it today), builds the HTML and calls
  `openHtmlPrintWindow`.
- Tests: `jobCostsPacket.test.ts` holds the empty job (every section says *none on this job*),
  a full job (the header, the stamp, the hero sentence green and red, the three tiles, the
  by-section rows, the money rows and shares, the per-person rows, the by-day rows with the
  running cost, escaping of a name with `<`), the chart (a path per line, the price line, both
  end labels, no forecast when burn is idle), and the page count (four `section.sheet`). A
  plain-words test over the packet's fixed sentences. `JobCostsTabCharts.render.test.tsx` gains
  the button for a dev and its absence for an assistant, with `window.open` stubbed to capture
  the HTML.
- Docs: the help guides `job-window-tabs.md` and `job-charges-timeline.md` get the button in one
  sentence each; a release note and a `docs/recent-features/` fragment; `PROJECT_DOCUMENTATION.md`'s
  job window section names the print.

## How to verify

1. `npm run dev -- --port 5192 --strictPort`, then
   `http://localhost:5192/dev-login?as=1&to=/jobs?tab=stages`. Type `891` in the Pipeline's
   search box and open the job, then the **Costs** tab.
2. Read the tab's numbers, then press **Print**. In the browser pane popups show no tab, so stub
   `window.open` first to capture the HTML and draw it in an iframe, or print from Chrome.
3. The packet's page 1 must read the tab's verdict to the dollar: on 2026-10-22 that was
   *$3,608 · 8%*, *$36,273 direct + $3,368 overhead*, spent *$10,882*, earned *$12,975*, time left
   *≈ 16.3 working days*. Page 2's money table must match **Where the money went** row for row.
4. Print to PDF with Letter and default margins: four pages, no spill, the footer on each.
5. Sign in as an assistant and confirm the Costs tab shows no **Print**, since that role sees no
   verdict.

## Gotchas met while drawing it

- The owner's screenshot read a $44,927 price and a $5,286 · 12% margin; by the afternoon the
  tab read $43,249 and $3,608 · 8%, because the Bill tab's job total had moved. The packet prints
  the tab at the moment it is pressed, and the stamp says when.
- The tab's **Other card charges** row says *22 charges* (every card line); the packet's row says
  *4 charges*, the lines left once fuel is sliced out, and the fuel table lists the other 18.
- The job's % went to 100% on Oct 5 and back to 30% on Oct 7, both set by the office; the chart's
  blue line spikes to the price for two days. That is the data, and the packet draws it.
- Headless Chrome 156 honors `@page` margin boxes, so the running footer and *Page N of M* come
  from CSS; the in-flow footer is for the screen view only.
