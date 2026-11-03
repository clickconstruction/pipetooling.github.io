---
name: "Hours charged statement: a worker's hours on a job at the rate the customer is charged, for everyone"
number: 251
group: ready
status: drawn 2026-11-02 from the owner's ask · PR 1 built 2026-11-03, v2.6431, the rate's two homes, the Settings card and the kernel's charged basis · PR 2, the window, the print's Charged band, the row's basis and the gate, waits for #212's print restyle (#6892) and its signing (#6893) to land
mockup: not required — the paper is #212's print with Charged in place of Paid; the restyle's mock-up (to-dos/signed-hours-statement/mockup-print-v2.html once it lands) stands for it
summary: >
  A second basis for the Signed hours statement (#212): the same paper, one worker's recorded hours on one job
  for a period, but priced at the rate the company charges the customer for an hour instead of the rate it
  paid the worker, with a Charged section in place of Paid. Because it holds no payroll figure it can be shown
  to every office role, where the paid paper is for a dev and the controller alone; the customer's portal never
  shows it. The app holds no charge
  rate today, so the first PR adds one as a company setting with a per-job override.
next: PR 2 — the row's `basis` and `charge_rate`, the gate by basis, the window's basis choice and rate control (field, presets, slider), Save and Print writing the rate onto the job, Edit Job's field, the print's title and Charged band on the restyled layout, the section's chip, the guide and the docs. Cut it after #6892 and #6893 merge.
size: S + M
blocker: #212's restyle (the paper this one copies) and its access narrowing (the gate this one widens by basis) should merge first, so this train changes one shape, not two.
ver: v2.6431
opinion: build — the paper, the window, the table and the section all exist; this is one more basis through them, and the only new fact is the rate
---

# Hours charged statement (#251)

## The ask

The owner, 2026-11-02, after seeing the Signed hours statement (#212) print on a real job: *"long term, I think we
should make another version of this, which is how much we're charging the customer per hour. And our rate tends
to be two hundred and eighty-five dollars per hour. It would be a sheet just like this, for jobs, but instead of
saying how much we paid, it's how much we charged, and that can be exposed to everyone."* In the same breath the
paid paper was narrowed to a dev and the controller, because it gives out payroll data. Confirmed the same evening:
the charged paper is the one anyone in the office can see, the paid paper (what the company pays its techs) is for a
dev and the controller alone, and the customer's portal shows neither.

## What the app has today (verified 2026-11-02 by reading the code)

- **The paid statement** is whole: the kernel `supabase/functions/_shared/hoursStatement.ts` (re-exported by
  `src/lib/people/hoursStatement.ts`) takes a worker's rows on a job for a period, the pay reports that touch
  those weeks, the rate on each report day (`dayRates`) with the current wage as the fallback, and two switches
  (`withPay`, the stated block), and answers the groups by week or sheet, each day's rate and amount, the totals,
  one pay line per report, the gap and the attestation. The print `src/lib/peopleDocuments/buildHoursStatementHtml.ts`
  draws it; the window `src/components/jobs/HoursStatementModal.tsx` previews and saves it; the table
  `hours_statements` (migration `20261030030000`) keeps `kind` clock · sheet · schedule, `with_pay`, the
  `snapshot`, the record id `HS-<job>-<n>` and `state`; the section `HoursStatementsSection.tsx` lists the rows on
  the job's Documents tab and the person's desk; the guide is *make a signed hours statement*.
- **No charge rate exists in the app.** `ratePerHourByJob` and `wageUsdPerHour` are pay-side figures; `revPerHour`
  and `revenuePerHourUsd` are measured (revenue over hours) on the Bridge and the P&L, never a rate the office set;
  `cost_estimates.labor_rate` is a bid's crew *cost* rate (`src/lib/bids/crewRate.ts`). The $285 is the owner's
  number from memory, held nowhere.
- **Who sees hours today**: a helper reads their own clock; the office roles read People → Hours; a customer reads
  bills, never hours.

## The decision (defaults the builder takes unless the owner says otherwise)

1. **One paper, two bases.** `basis: 'paid' | 'charged'` on the kernel's input and on the row. The charged paper is
   titled *Statement of hours worked and charged*, prices every day at the charge rate, totals the week and the
   period, and replaces the Paid section with **Charged**: one line per week, hours at the rate, and the period's
   total. It never names a wage, a pay report or a payment.
2. **The rate is set per job, in the window where the paper is made.** The owner, 2026-11-02: *on a job-to-job basis
   we need to be able to set that per hour … in the Documents tab we need to add a slider or buttons to click or an
   entry field or a form of all three, so that when we're creating these as needed we can do so swiftly.* So the
   statement window on a charged basis carries one rate control in three forms bound to one value: a number field
   (dollars an hour, the job's rate when it has one, else the company's), a row of preset presses (the company's
   rate, this job's last rate, and the rates the last few charged papers used, each a press that fills the field),
   and a slider ($100 to $500 in $5 steps, the company's rate marked). The paper redraws on every change. **Save a
   draft** and **Print** keep the rate on the job (`jobs.hourly_charge_rate`), so the next paper on that job starts
   there; Edit Job shows the same field beside the money fields for the record. The company's rate is the
   `app_settings` key `hourly_charge_rate_v1` (Settings → Jobs & dispatch; $285.00 as the seed). The paper prints the
   rate once in the header, *at $285.00 an hour*, and says where it came from (*the company's rate* / *this job's
   rate*). The kernel is given the rate; it never reads the setting or the job.
3. **Who signs what.** The worker signs the hours as on the paid paper. The attestation drops *and that I was paid
   for this work as shown*; the company's line reads *Prepared from the company's records; charged at $285.00 an
   hour.* The charged amount is the company's statement, not the worker's.
4. **Every office role may make and see a charged paper** (the owner's word: *anyone in the office*): the app's
   office set — dev, master, assistant, controller, estimator; reuse the existing office predicate, never a new
   list — through `canMakeHoursStatement` when the basis is charged, and `can_touch_hours_statement` gains a
   basis argument that admits those roles for a charged row. A helper and a sub see no statement of either kind;
   the customer's portal shows neither (the owner, 2026-11-02). The paid basis keeps the narrowed gate (a dev and
   the controller).
5. **A sub's flat-rate sheet has no hours**, so a charged paper over a sub lists only sheet lines with hours and
   says which sheets it left out and why.
6. **The record id shares the job's counter** (`HS-972-0003` may be charged while `-0002` was paid); the row's
   basis is a chip in the list, *Paid* · *Charged*, and the press on the section offers the basis as a choice in
   the window (defaulting to charged for a role that may not make a paid one).
7. **Open for the owner**: whether the charged paper is ever sent for signature or only printed. (The portal
   question is closed: the customer never sees it.)

## Where it plugs in

- Kernel: `hoursStatement.ts` (the `basis`, the Charged section, the words), `hoursStatementAttestation`.
- Print: `buildHoursStatementHtml.ts` (title, the rate line, the Charged band); the restyle's layout.
- Reads: `hoursStatementRead.ts` (the rate from the job, else the setting; no pay reads on a charged basis).
- Table: `hours_statements` + `basis text not null default 'paid'`, `charge_rate numeric`; the gate
  `can_touch_hours_statement(with_pay, basis)`; `jobs.hourly_charge_rate`; the setting key in
  `src/lib/appSettingsKeys.ts` (regenerate the edge copy).
- Window and section: `HoursStatementModal.tsx` (the basis choice, the rate control — field, presets, slider — and
  the rate shown, no pay switch on charged; the control's words and bounds in `hoursStatementWindow.ts`),
  `HoursStatementsSection.tsx` (the chip, the access by basis), `hoursStatementAccess.ts`.
- Settings → Jobs & dispatch: the rate's card; Edit Job: the override.
- Docs: a new guide *make an hours charged statement* (or a section of the existing guide), `GLOSSARY.md`,
  `ACCESS_CONTROL.md`, `PROJECT_DOCUMENTATION.md` §6, `docs/twins/APP_DIRECTORY.md` (the office roles see it).

## The plan

1. **PR 1 · the rate and the kernel (S).** The setting and its Settings card, `jobs.hourly_charge_rate` and its
   Edit Job field (one migration), the kernel's `basis` with the Charged section and the attestation's words, the
   print's title and rate line, tests for a charged week, a sub's flat sheet left out, and the rate's source line.
2. **PR 2 · the row, the gate and the doors (M).** The table's two columns and the gate's basis argument (one
   migration), the window's basis choice and its rate control (the field, the presets, the slider, one value;
   Save and Print writing it onto the job), the section's chip and its access by basis, the reads, the guide, the
   docs, the app directory.

## How to verify

Dev server, `/dev-login?as=1`: Settings → Jobs & dispatch → the rate reads $285.00; job 972 → Documents → Hours
statement… → basis Charged: the paper prices each day at $285.00, the Charged band totals the weeks, no wage or
payment appears anywhere on it; in the window type a rate, press a preset, drag the slider: the three agree and
the paper and its header follow at once; Save a draft, reopen the job's window, press Hours statement… again: the
rate starts where it was saved, and Edit Job shows the same number. As the estimator
sample (`/dev-login?as=twin:estimator`): the section shows with the charged papers only, the press makes a charged
one and the window offers no paid basis; a paid row is not in their list. As the helper sample: no section at all.
As the controller: both bases. In a customer's portal: nothing. The SQL bed for `hours_statements` holds the gate by basis.

## Not verified

Whether any job today is billed by the hour at all (the bills are per bid or per stage), so whether the charged
paper should also show what the job billed for those weeks; read `jobs_ledger_invoices` before PR 2 and decide.

## Where it stands

Drawn 2026-11-02 in the docs session that catalogued #212's state, from the owner's words the same evening, and
confirmed by the owner in the same sitting: office roles see the charged paper, a dev and the controller the paid
one, the customer neither. Nothing built. Waits for #212's print restyle and its access narrowing (both in flight the same evening) so the
charged paper copies the restyled layout and widens the narrowed gate, not the old ones.
