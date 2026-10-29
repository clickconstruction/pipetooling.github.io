---
name: "Legal desk: two readings that disagree with the account's own paper"
number: 213
group: ready
status: found 2026-10-29 by a read of a live account on the desk · two kernel-level reading errors, no data fix · not started
summary: >
  On an account where our contract is with the owner, the Legal desk reads two things wrong. *How
  much?* adds the job's retainage held on top of the open bills when the retainage is already the
  open remainder of a bill the GC short-paid, so the claim is too high by the retainage. On the
  Paper tab, *Where each job stands* draws the § 53.056 row as *not required · contracted with the
  owner*, yet *Next on the path* above it says to draft that month's notice and *Waiting on us*
  says the notice is to be drafted and mailed. Both come from one kernel each, with unit tests to
  write; nothing in the data is wrong.
next: PR 1 the path (one line in the timeline kernel and its test); PR 2 the claim (the retainage the bills already carry, a packet read of the pay applications, the card's words); then delete this file.
size: S (two PRs; PR 1 is a line, PR 2 a small kernel and one more read)
blocker: none
opinion: build — both are the desk contradicting itself on one screen, and the fix is where the words are made
mockup: not required — two kernel fixes; the only screen change is the sentence under *How much?*
---

# Legal desk: two readings that disagree with the account's own paper

## Where this came from

A session read a live Collections account on the Legal desk on 2026-10-29. The account is one
subcontract job whose GC had been moved back into the customer slot two days before, so the desk
reads Click as the original contractor on it. Two readings on the desk disagreed with the
account's own rows. Both are the kernel reading right facts wrongly; no row needs a fix.

## Finding 1 — *How much?* counts a retainage twice

### What the desk does

Since v2.5849 (punch list #171, step 2) the claim leads *How much?* when the job holds retainage:
`src/lib/legal/legalPacket.ts` sums every job's `jobs_ledger.lien_retainage_held` on top of the
account's open bills, and `src/lib/legal/deskQuestions.ts` reads *Open bills $X inside it, plus
retainage held $Y*. That is right when the bills were sent net of retainage, which is what the
AIA window's bill is (`current_payment_due`): the retainage then sits on no bill, and the claim
is the bills plus the retainage.

### What went wrong

On this account the job's bill was sent for the whole amount, and the GC paid it short by the
retainage. The open bills already hold the retainage, as the unpaid remainder of that bill. The
lien details hold the same figure as retainage held. The claim adds both, so it reads too high by
the retainage, and *What's left for us?* works the firm's cut from the inflated figure.

### Where it plugs in

- `src/lib/ar/retainageHeld.ts` (v2.6010, v2.6027): the one read AR and the Lien desk share. It
  already tells a retainage that lives on a bill from one no bill asks for: the latest live pay
  application's figure, else the typed figure, less a release once the release bill is out.
  `owed = held − released` is *the money no bill asks for yet*.
- The packet (`legalPacket.ts`) has the job's bills and payments, and `legalJobMoney` gives the
  open remainder per bill. It does not read `job_pay_applications` yet.
- The AIA window ties an application to its bill (`job_pay_applications.invoice_id`, v2.5032) and
  the release bill carries `jobs_ledger_invoices.retainage_release` (v2.6017).

### The fix (PR 2)

A pure kernel beside `deskQuestions.ts` that says, per job, what part of the held retainage no
sent bill carries, and the claim adds only that:

- A bill tied to a pay application carries that application's period retainage when its amount
  is above the application's payment due by that much (a bill sent for the whole amount). A bill
  that equals the payment due carries none. A final application at zero retainage carries the
  release through its bill once that bill is sent.
- The release bill, once sent, carries the typed figure up to its amount.
- A draft bill carries nothing, so nothing is dropped from the claim early. An application with
  no bill carries nothing.
- What the bills carry stays on the open bills; the rest is added, and `claim = balance + added`.

The packet reads the account's live pay applications (`job_pay_applications`: the number, the
retainage held, the payment due, the bill) as one more source in `useLegalPacketData.ts`. The
card's words say what was added and why: *plus retainage $Y that no bill asks for yet*, or, when
every dollar of it is on a bill, the balance alone with *The retainage held $Y is already inside
the open bills.* The print and the firm's portal read the same `worth`.

What the kernel cannot tell: a bill made by hand for the whole amount on a job with no pay
application. There the typed figure is still added. The card's sentence names the retainage it
added so the office can see it.

## Finding 2 — the path names a notice the step row says is not required

### What the desk does

The Paper tab's *Where each job stands* is the Lien desk's own timeline
(`src/lib/jobs/lienTimeline.ts`, read through `buildLienTimelineFromWindow` in
`lienTimelineDesk.ts` and `src/lib/legal/legalLienPaper.ts`;
[`docs/LIEN_DESK_ARCHITECTURE.md`](../docs/LIEN_DESK_ARCHITECTURE.md)). On a job with no GC the
kernel draws one § 53.056 row, *none · not required · contracted with the owner*, which is right:
an original contractor sends no monthly notice.

### What went wrong

The same kernel still reads the job's work months for *Next on the path*. The months come from
the approved clock sessions whether or not the job has a GC, so an open month makes the next step
*Draft the <month> notice — N days* and the Waiting on line *the notice to be drafted and
mailed*. The row and the sentence above it disagree. An original contractor's next step is the
§ 53.057 retainage notice when the contract-end day is set, else the § 53.052 affidavit.

### The fix (PR 1)

In `buildLienTimeline`, an original contractor has no notice months: the open, missed and sent
month reads are empty when `isSub` is false, so *Next on the path* and *Waiting on* fall through
to the retainage and affidavit steps the row already names. The step row is unchanged. One unit
test in `lienTimeline.test.ts` gives an original contractor an open work month and expects the
affidavit (or the retainage notice) as the next step, with the § 53.056 row still *not required*.
Every reader of the kernel gets the fix: the Lien window's strip, the Lien desk's Timeline tab,
the Legal desk's Paper tab, the firm's portal and both prints.

## How to verify

- `npm test -- lienTimeline deskQuestions legalPacket` for the kernels.
- Live, read-only, on the dev server as the dev: open the Legal desk on an account whose job has
  no GC and approved clock hours this quarter. *Where each job stands* should show the § 53.056
  row as *not required* and *Next on the path* naming the affidavit or the § 53.057 notice.
- For the claim: an account whose job has a pay application tied to a bill sent for the whole
  amount and paid short by the retainage. *How much?* should equal the open bills, with the
  sentence saying the retainage is already inside them. An account whose bills were sent net of
  retainage should still read the bills plus the retainage.

## Where it stands

Found 2026-10-29. Neither PR is started.
