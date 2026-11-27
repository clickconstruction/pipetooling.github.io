---
name: "Lien desk: confirm the stand-in month"
number: 358
group: close
status: written 2026-11-14 from a Lien desk session · the owner approved the mock-up and said build it in a new session · built 2026-11-14 as v2.7280, one PR (#8143), on main · the migration is in prod's ledger and dev-mcp is redeployed (server 0.89.0 names the five columns, read 2026-11-15)
summary: >
  A job with no clock hours and no last day of work set by hand takes its lien month from its bill,
  and every surface flags that month as a stand-in. The only way to clear the flag was to type a
  last day of work, which moves every clock. This adds a second door: a person confirms the month
  is right, with who said so and when. The flag turns quiet on the affidavit pane, the Lien window,
  the printed help sheet and the notice record. No clock moves and no paper changes.
next: Retire the card once the office has confirmed one real job's month.
size: S
ver: v2.7280
blocker: none
---

# Lien desk: confirm the stand-in month (#358)

## Where this comes from

On 2026-11-14 the owner read the affidavit pane for a job brought in from the earlier system. Its
month came from the bill, and the amber line said *The month comes from the bill, not from recorded
work. Set the last day of work on the job if the work ran in another month.* The month was right.
The only press that would quiet the flag set a last day of work, which moves every clock and may
drop an approved paper off the desk. He asked for a way to say the month is right and have the flag
go quiet. He approved the mock-up ([mockup.html](./mockup.html), frames B, C and D) and said
"build it in a new session".

## What was built (v2.7280)

- Five nullable columns on `jobs_ledger` (`lien_month_checked_month`, `_at`, `_by`, `_by_name`,
  `lien_month_check_note`; migration `20261114120000_lien_month_check.sql`).
- The kernel `src/lib/jobs/lienMonthCheck.ts`: the check read off the job row, its state (*none* for
  a month from hours or a hand day, *flag* for a stand-in nobody confirmed, *checked* while the
  confirmed month is still the stand-in month), and every surface's words.
- The affidavit pane: the question *Is August the month the work was done?* with **Yes, August is
  right ›** (one ask: who said so and when, then **Confirm August**) and **Set the last day of work ›**
  (today's door). Confirmed, a quiet line with **Change ›**, and the grid reads *from the bill ·
  checked Nov 14*.
- The Lien window's affidavit tab reads ✓ in place of ⚠; the help sheet's **Work month.** row reads ✓
  with the note; the notice record names the check where the flag was; the dev seat's
  `plan_affidavit_draft` replies `month_checked`.

## Not done

- No clock moves and no paper changes. A last day of work set later, or a bill that moves the month,
  puts the question back; the check stays on the row and is ignored until the month matches again.
- The four lien readers are untouched: the month is still dated from the bill.
