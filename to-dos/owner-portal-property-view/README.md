---
name: "Owner's portal: show what is happening on their property"
number: 45
group: close
status: built 2026-09-25 — v2.3827 the switch · v2.3825 the notice card (customer-portal deployed) · v2.3826 the GC run's tick · left: the first real owner, counsel on the card's words
summary: >
  An owner whose jobs are billed to the GC opened their portal and read "You're all paid up"
  while tens of thousands were unpaid on their house and a lien notice was on its way (Umar Khan,
  9703 Lenox Hl, $30,387). Built: one switch to show the owner their property's bills, the
  portal showing a recorded § 53.056 notice on its own, and a GC run's tick that does both.
next: Record the Lenox Hl and Terrell Rd notices once mailed and flip the owner switch; look at Umar Khan's portal; counsel reads the card's words; then delete the folder.
size: XS
blocker: A recorded notice on a real owner's job.
ver: v2.3825 · 3826 · 3827
opinion: close — built; the first real owner and counsel's read remain.
---

# Owner's portal: show what is happening on their property

## Where it stands

Built on 2026-09-25, following the owner's calls: the notice card shows on its own once a notice is recorded, and the switch covers the whole property. Counsel's read of the card's wording is still pending (`owner-decisions-pending.md`).

- **v2.3827** (PR 1, #3702): *owner sees $0 / the bills* beside the owner's 🌐 on the Pipeline row, and a line per property in the owner's portal window.
- **v2.3825** (PR 2, #3704): the notice card on the owner's portal, *Nothing is billed to you directly*, and the noticed wording on shared bills. `customer-portal` was deployed 2026-09-25; the live response carries `propertyNotices`.
- **v2.3826** (PR 3): the fourth tick in *Put a GC on notice*.

Left: record the Lenox Hl and Terrell Rd notices once they are mailed, and set Syed Rizvi as J258's customer. Then flip the switch and open Umar Khan's portal: that is the first live look. Edit Job's *show the bills* tick still sets the job's memory only.

## The ask

The owner, 2026-09-25, looking at Umar Khan's portal: *"we just sent out a lot of lien notices for terrel road, yet when I look at that customers portal who owns that proprety it looks like this. What is going on? What might we need to do to expose to him what is happeneing on his proprety and not just the GC? should I maybe offer a checkbox next to his portal link on jobs stages row such that when I click them it is clear that GCs can also have a customer see the bill?"*

## What is going on (read-only, 2026-09-25)

1. **He is the customer, and the GC pays.** Umar Khan (who owns 9703 Lenox Hl, not Terrell Rd) is `customer_id` on jobs 273, 858, 866, 881 and 1009, with $30,387 open. Every bill is billed to the GC (`bill_to_party = 'gc'`). The portal's `bills` are what the viewer pays (`statementRoleFor` → `owed`), so his balance is $0, and `CustomerPortal.tsx` then prints *"You're all paid up. No open bills on your account."*
2. **Sharing exists, but it is off.** Since v2.3375 (Share this bill), a bill stamped `shown_to_party` for the other party reaches `sharedBills` and `PortalSharedBillsCard`. On all 12 jobs at the two addresses `show_bills_to_other_party` is false, and no bill is stamped. Edit Job's tick (`JobFormEditFactRows`) sets only the job's memory, which covers the **next** bills (`shownToPartyFor`: a stamped invoice answers for itself), so turning it on today would show him nothing.
3. **No notice is recorded as sent on either property.** J273's `notice_53_056` item is `awaiting_approval` (Sep 22), and J258's is `drafted`. The closed months were noted `missed` on Sep 25. No desk item or `job_lien_filings` row anywhere is sent or created after Sep 23. Whatever was mailed, the app does not know it.
4. **The shared wording is wrong after a notice.** The owner's shared card says *"Not yours to pay, and not in your balance."* The notice letter asks him to hold the money back from the GC and call us.
5. **Terrell Rd** is the same picture: Syed Rizvi is the customer on 7 of 8 jobs. **J258** has no customer and a different property record, so no portal can show it.

## The mock-up

[`mockup.html`](mockup.html) shows the four findings and three placements:

- **A.** The owner's switch on the Pipeline row beside his 🌐, with the popover offering the other jobs at the property. This is the owner's idea; it is clickable in the mock-up.
- **B.** A section in the portal window: *On his jobs, billed to someone else*, the same switch, and the notice state.
- **C.** His portal before and after: balance still $0.00, *Nothing is billed to you directly*, the **notice card** in counsel's residential-letter words, and the shared bills as *billed to your builder · unpaid*.

## The plan

0. **Office, no code.** Record any notice already mailed (*Record the run*, or *Already mailed? Record it…* on the desk), and set Syed Rizvi as J258's customer.
1. **The switch** (M). A kernel `ownerBillShare(job, invoices)` (off / on / partly, plus the other jobs at the property) with tests. One write, `setJobBillsShownToOwner(jobIds, on)`, stamps every open bill `shown_to_party = 'customer'` and sets `show_bills_to_other_party`; both columns exist, so no migration. The chip appears on the Pipeline and Collections rows (`jobsStagesRowShared.tsx`, beside the customer's `CustomerPortalGlobeButton`), a section in `CustomerPortalGlobeButton`'s window, and Edit Job's tick reads the same state. Guide: *share a customer their portal*.
2. **The portal tells the truth** (M).
   - `customer-portal` returns the recorded § 53.056 notices on jobs where the viewer is the customer (sent only: date, claim, months, letter, pay-page link).
   - `CustomerPortal.tsx` shows the notice card, and says *Nothing is billed to you directly* instead of *all paid up* when bills or a notice exist on his jobs.
   - The owner wording on `PortalSharedBillsCard` changes.
   - Deploy the function after merge.
3. **Put a GC on notice, step 4** (S): a tick, *Show each owner their job's bills on their portal*, applied when the run is recorded.

## Owner calls before PR 1

1. Does the notice card show on its own once a notice is recorded (recommended — he holds the paper), or only when the switch is on?
2. Should the switch cover one job, or always the whole property? The mock-up offers the other jobs ticked.
3. Counsel should look at the card's words before PR 2, since it repeats the residential letter on the web.

## How to verify

Dev-login on localhost. Open Umar Khan's 🌐 from J273's Pipeline row, and use *Preview as customer* before and after the switch. Record a test notice only on the ZZ TEST GC (never on a real owner's job) to see the card.
