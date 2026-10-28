---
name: "Retainage on our trade jobs is money owed to us"
number: 165
group: ready
status: proposed 2026-10-24 from the trade ERP comparison (gap 5 of 9) · the owner picked 2026-10-26 (source C, show A, release C) · PR 1 shipped v2.6010 (the kernel) · PR 2 shipped v2.6015 (AR's Retainage held band) · PRs 3–4 next
summary: >
  On our own trade jobs the AIA pay application is saved and downloaded, and retainage is a number
  the Lien desk uses for its § 53.057 notice, but the money a GC holds back shows nowhere as owed to
  us. The owner's picks: the held amount is the latest pay application's figure, else the number
  typed in the job's lien details; AR shows it as its own line per trade job, aged from when the job
  finished, and nothing is billed early; the final pay application releases it, or a release bill
  drafted at job close on a job with no pay applications, beside the § 53.057 notice on the Lien desk.
next: "PR 3, the release: the final pay application's step in the AIA window on a job with applications, and the release bill drafted from the AR line and from job close on a job with none, marked so the kernel and the Lien desk find it."
size: S to M as a train of four (S · S · S · S); no migration unless the release needs a mark
blocker: None. The owner's picks are in (2026-10-26).
opinion: build; the picks keep one number for the AIA window, AR and the Lien desk, and bill nothing before the GC is asked
---

# Retainage on our trade jobs is money owed to us (#165)

## The ask

The owner, 2026-10-24: *"Draft to-dos in the repo for the top five gaps, each with its smallest
useful version, as one docs PR."* This is gap 5 of the trade ERP comparison the owner ran the same day.
The owner kept its weight at 3 of 3. Its gap is 1, so it scores 3, tied with #164.

The owner picked on 2026-10-26 (below). PR 1, the kernel, shipped as v2.6010 and PR 2, AR's Retainage held band, as v2.6015 (both 2026-10-28).

## What the comparison found

- Knowify builds pay applications from a schedule of values, prints G702 and G703, holds
  retainage on work and on stored materials, and bills the release as its own invoice, on its
  lowest paid tier.
- ServiceTitan keeps retainage in its own receivable account and releases it in full or in part.
- Contractor Foreman holds retainage, steps it down at milestones and releases it, and tracks
  retainage on subcontracts too.

## Today

- **The pay application** on a trade job is the AIA window
  ([`AiaG702G703Modal.tsx`](../../src/components/jobs/AiaG702G703Modal.tsx)), which fills the
  G702/G703 workbook for download and saves each application by number in `job_pay_applications`
  with `retainage_pct` and `retainage_held` (`lib/aiaPayApplicationsIo.ts`). The bill tied to an
  application is its current payment due, the amount after retainage, so the held money is never
  billed.
- **The Lien desk** reads `jobs_ledger.lien_retainage_held` for the § 53.057 retainage notice
  (`lib/jobs/lienDeskRetainage.ts`). Someone types that number by hand in the job's lien details
  ([`JobFormLienContractRow.tsx`](../../src/components/jobs/JobFormLienContractRow.tsx)), so the
  same money is recorded twice and the two can drift.
- **AR** (`/accounts-receivable`) reads billed bills (`jobs_ledger_invoices`). Retainage the GC
  holds is not a bill, so AR never shows it.
- **GC mode** already runs pay applications with retainage for the jobs where we are the GC
  (`gc_owner_pay_apps`, `gc_draws`). This to-do is about our own trade jobs.
- **The bid's payment schedule** calls its last 10% "retainage after Trim Set" (30/30/30/10). That
  is the final stage of our own billing, already unbilled on the Pipeline, and this to-do leaves it
  alone.

## The decision

**Decided 2026-10-26.** The owner: *"Use your recommended picks for #165 (source C, show A,
release C) and write them into the to-do."*

- **Source, C: the pay application when there is one.** On a job with saved pay applications, the
  held amount is the latest application's `retainage_held`, the number the GC signed. On a job
  with none, it is the number typed in the job's lien details, `jobs_ledger.lien_retainage_held`.
  Where an application exists, the lien details show its figure instead of asking for it again, so
  the AIA window, AR and the Lien desk read one number. The other choices were the pay application
  alone, which leaves a job billed without pay applications blank, and the typed number alone,
  which drifts.
- **Show, A: a line on AR, not a bill.** AR gets a **Retainage held** line for each trade job,
  apart from the overdue bills and aged from when the job finished, since the money is not due
  until then. Nothing is billed early. The other choice was a bill marked not due until the job
  completes, which the GC would receive before being asked to pay it, and which statements and
  reminders would have to skip.
- **Release, C: the final pay application, else a release bill.** On a job with pay
  applications, the final application releases it: retainage goes to zero on the last
  application, and the bill tied to it carries the release, as AIA practice and many GCs expect
  with the final waivers. On a job with none, a release bill for the full held amount is drafted
  when the job closes. Either way the Lien desk's § 53.057 row links to it.

Not decided, and left out of the first train: partial releases (some GCs step retainage down from
10% to 5% partway; GC mode already does this, and trade jobs can add it later), and the retainage
we hold back from our own subs (sub work orders track it; it is money we owe, and likely its own
line rather than this one).

Mock-up: [`mockup.html`](./mockup.html) (2026-10-26, made-up data) — the three screens that each know a
piece today, AR's Retainage held section with the two sources as switchable variants A and B, the release
as its own bill beside a line on the last bill, and the Lien desk's § 53.057 row carrying the door. Read
against the picks: AR shows variant A's figure on a job with pay applications and variant B's on a job
without, and the release is the final application's bill on a job with pay applications and the bill of
its own on a job without.

## The smallest useful version

1. **AR shows retainage held** per trade job as its own line, read by the one rule (the latest pay
   application's held amount, else the lien details' number), aged from when the job finished,
   with a door to the job.
2. **The lien details show the pay application's figure** where one exists, instead of a box to
   type it.
3. **When the job closes**, the release goes out through the final pay application on a job that
   has them, or as a release bill drafted with the amount filled on a job that has none, and the
   Lien desk's § 53.057 row links to it.
4. **Paid releases** come off the line the way any bill does.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The held amount | `job_pay_applications.retainage_held`, `jobs_ledger.lien_retainage_held` | one read: `lib/ar/retainageHeld.ts`, the one rule, the held amount less what was released, and its age; pure and tested |
| AR | `/accounts-receivable` over `jobs_ledger_invoices` | a Retainage held section |
| The lien details | the job form's lien row (`JobFormLienContractRow.tsx`) typing `lien_retainage_held` | the pay application's figure shown where one exists |
| The release | the AIA window's applications and the job window's Bill flow | the final application at zero retainage, or the release bill drafted with the amount filled |
| The notice | the Lien desk's § 53.057 row | a link to the release |

## The plan

1. **The kernel** — shipped v2.6010: `lib/ar/retainageHeld.ts`, the one rule and the age, with tests
   for a job with pay applications, a job without, and a job whose retainage was released.
2. **AR's Retainage held section**, read only — shipped v2.6015.
3. **The release**: the final pay application's step in the AIA window on a job with
   applications, and the release bill drafted from the line and from job close on a job without.
4. **The lien details and the Lien desk**: the pay application's figure shown in the lien details,
   and the § 53.057 row's link to the release.

## How to verify

On a ZZ test job with two saved pay applications holding 10%: AR's Retainage held line shows the
latest application's held amount, and the job's lien details show the same figure with no box to
type it. Save the final application at zero retainage, record its bill paid, and see the line
clear. On a second ZZ test job with no pay applications and a number typed in its lien details:
AR shows that number; close the job, draft the release bill, record it paid, and see the line
clear. On both, the Lien desk's § 53.057 row opens the release.

## Open questions

- Whether a partial release is common enough to support now.
- Whether retainage we hold back from our own subs belongs on a screen of its own.
