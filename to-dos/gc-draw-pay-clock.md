---
name: "GC mode: a trade's draw is due 10 days after the customer pays"
number: 420
group: close
status: built 2026-11-21 on Taunya's call that day (v2.8249) · left: the walk, one loose end on the trade's page, and a question for the attorney
summary: >
  In GC mode an approved draw used to be due 10 days after we approved it, whether or not the customer
  had paid. Taunya's master agreement for GC-mode trades says a trade is paid only after the customer
  pays, within 10 days. GC mode now counts the same way: a draw is due 10 days after the customer pays
  the bill it rode on. Until then it has no pay-by day and is never late, and Money ahead counts it
  after the customer should pay. A retainage release is unchanged.
next: Walk it on prod with the standing GC test project, which first needs a trade with a signed statement of work. See Left to do and to walk.
size: XS; left: the walk (XS)
blocker: The standing GC test project has no awarded trade and no signed statement of work, and the app cannot sign one for the test company until a master agreement is in the Contract Book (#389).
mockup: not required — a rule change on screens that exist
ver: v2.8249
---

# GC mode: a trade's draw is due 10 days after the customer pays

## What was built

v2.8249, Taunya's call on 2026-11-21: "change the app" so GC mode counts a trade's 10 days the way her
master agreement does.

- **The rule** is one pure kernel, `src/lib/gc/drawPayClock.ts`. A draw rides on the first bill we sent
  the customer on or after the day we approved it, never the final one. It is due 10 days after the
  customer pays that bill.
- **Until the customer pays** a draw has no pay-by day and is never late. Its line says what it waits
  on: *due 10 days after the customer pays us*, or *due 10 days after the customer pays our next bill*
  when no bill has gone since.
- **A job that keeps no bills one by one** keeps the old day, 10 days from approval, since there is no
  payment to count from.
- **Where it shows:** Draws → **To pay** and each draw's row, the project card's sentence, Bill day →
  From the trades and its dates, and Money ahead.
- **A retainage release is unchanged.** It already waited on the customer's final payment.

The rule, where each screen reads it and what each test pins are in
[`docs/recent-features/v2.8249.md`](../docs/recent-features/v2.8249.md).

## Left to do and to walk (2026-11-22)

### The walk

- **Where:** [GC projects](/gc) → a job's **Draws** (**To pay** and each draw's row), **Bill day** →
  *From the trades* and the dates at its top, and **Money ahead**.
- **As whom:** a dev on the money team, signed in on the pane by `node scripts/dev-pane-login.mjs`.
- **Widths and themes:** 1200 px and 375 px, light and dark.
- **The rows:** the standing GC test project, *GC test project, delete me*. It is at the building stage
  and keeps its bills one by one: two went on 2026-10-10 and neither is marked paid. That is the case
  the new rule reads. It has no awarded trade and no statement of work yet, so the walk first needs one:
  - award one trade, such as Concrete to *GC test trade company, delete me*, which quoted on it
  - send its statement of work and have it signed
  - approve a draw.

  The test company has no signed master agreement, and the app refuses to sign a statement of work
  without one. A master agreement can only be sent once the Contract Book holds an entry named exactly
  *Master Services Agreement*, which is #389's to load. Until then the walk cannot be made through the
  app.
- **What should be seen:**
  - A draw approved before 2026-10-10 rode on the two bills sent that day. While they are unpaid it
    reads *due 10 days after the customer pays us*, has no pay-by day, and is never shown late.
  - A draw approved after 2026-10-10 has had no bill since. It reads *due 10 days after the customer
    pays our next bill*.
  - Mark the bill it rode on as paid. The draw then reads *pay by* that day plus 10.
  - Bill day's dates read *Trades paid: Within 10 days. After the customer pays us for the draw.*
  - Money ahead counts each waiting draw on the day the customer should pay, plus 10. It never counts
    one in a week before the customer is expected to pay.
- **After:** take back what the walk made. The award, the statement of work, the draw and the paid
  mark on the bill all go back as they were. Delete any `ZZ Test` row it made, and name any row a dev
  cannot delete.

### The loose end

The trade's own page does not state the rule. An approved draw there reads *approved, payment coming*,
with no day, so nothing a trade sees is wrong today. Still, `src/lib/gc/portal.ts` (`payByOf`,
`portalPay`) and `src/lib/gc/portalI18n.ts` (`payIntro`, `payBy`, `payWasDue`) read the old rule, a day
counted from approval. Nothing draws them. They are copied to the edge functions, so changing them means
redeploying `gc-trade-portal` and `customer-portal`. Change them with the pay table on the trade's page,
which is the trade partner's portal, [#205](trade-portal-vs-jobtread.md).

### For the attorney

Does 10 days after the owner pays fit the Texas rule on how fast a contractor pays a trade? The same
question is on the master agreement's list for the attorney, kept with
[#389](sub-nda-builder/README.md). The day is one constant, `PAY_WITHIN_DAYS` in `src/lib/gc/portal.ts`.
