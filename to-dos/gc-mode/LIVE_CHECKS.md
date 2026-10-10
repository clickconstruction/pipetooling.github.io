---
name: "GC mode, the live checks: one walk"
parent: to-dos/gc-mode/LEDGER_2026-10-09.md
status: run sheet, written by Helper 5 (gc 5) 13:30 UTC 2026-10-10 from main's code and a read-only look at prod · nothing on it has been pressed
---

# GC mode, the live checks: one walk

The ledger's live checks in one order, so Grace's yes becomes one walk. Each step names where, the press, what it
reads after, and the rows it writes.

**The rules.** Grace types her own yes in Helper 5's chat before the first press. A relayed yes is no yes. Each
step is pressed by Grace at her keyboard; Helper 5 reads prod read-only between steps and sends the lead the new
rows' ids for the sweep (ledger → *Call 4 sweep notes*). Every email goes to bids@clickplumbing.com or to the
presser's own address. Nothing goes to a real customer or trade. Stop at the first reading that differs, and tell
Helper 5 before pressing on.

## The test rows it uses

| Row | Id |
| --- | --- |
| Project "GC test project, delete me" (building, started 2026-10-05) | ef8905d1-039a-4cbc-9d69-9468cfea50e0 |
| Project "GC test bidding project, delete me" (bidding) | c4117b0d-0c64-4935-933f-01bd96bfef60 |
| Customer "GC Test Owner LLC", the projects' customer | 592fd5f0-2f6d-4835-86eb-2ebcc2ad9879 |
| Customer "GC Test Architects", the architect | ec9920c2-bcb1-429d-9f7a-2a5a53bc02a1 |
| Company "GC test trade company, delete me", and its portal link | ff11d0fb-269e-44de-b92a-e7256c180f67 · f06e52ab-9639-46af-8b13-8e379a50bd3f |
| Change order 1, signed at 40%, price $100 | 0cc356ac-ff25-4048-9606-0e4b83eff492 |
| The building project's Plumbing trade (ours) | 128bb762-e74f-461d-a2dc-71132d52ed9b |

## What prod holds today

Read 13:15 UTC 2026-10-10, read only:
- The building project has no contract with the customer marked signed and no pay application. It has no trade
  awarded, no statement of work, no schedule, no Pipeline job on Plumbing and none named for general conditions.
- Our number reads $0 general conditions, 0% contingency, 0% fee. Retainage is 10%. Days to pay and the interest
  rate are blank.
- **GC Test Owner LLC has no email at all** (no billing email, no contact email). Every customer email would go
  nowhere, and the card page needs one. Step S1 fixes it.
- Neither test customer has a portal link.
- Both switches are off: `gc_card_bill_on_v1` and `gc_office_notices_on_v1` read `false`.
- No Owner Billing row of any kind exists yet (pay applications, reminders, interest bills, acceptances, card bills,
  notices, trade asks, what-if copies, Monday email requests).

## Who presses

- **A dev account** for most of it. Get started, Draws, the Schedule window and a trade ask's office presses are a
  dev's while their lanes build. The two dev accounts are *test* (test@clickplumbing.com) and *Robert*.
- **View as → Master technician** (*Sample leader*) for the reader who does not see pay. It is on the money team, so
  it opens Money, and it is not pay approved. **View as → Controller** (*Sample controller*) sees pay, as a dev does.
- **The owner** for the two switches: Settings → **GC jobs · pay by card** (step 11) and nothing else.

## Day 1

### Set-up (writes, no email)

**S1. The test customer's email.** Customers → GC Test Owner LLC → its edit form: billing email
bids@clickplumbing.com. *Writes*: `customers.billing_email` on 592fd5f0.

**S2. Its portal link.** Customers → GC Test Owner LLC → the globe button → **Create their link**, then
**Copy link**. Open the link in a private window and keep it open. *Reads*: the portal, with no GC job yet.
*Writes*: one `customer_portal_links` row. Make it before step 6, so the certified email carries the portal line.

**S3. Our contract, signed on paper.** `/gc` → the building project's row → **Get started** → the contract's line →
**Mark it signed**. *Reads*: Bill the customer lists the five trade lines at Our number's prices, and the change
order. *Writes*: `gc_projects.owner_contract_signed_on` = today, and one `gc_owner_contract_lines` row per trade.

**S4. Days to pay and interest.** `/gc` → **Bill the customer** → **Change the days to pay** → 0 → **Save the
days to pay**; **Change the interest** → 1.5 → **Save the interest**. *Writes*: `gc_projects.owner_pay_days` = 0
and `owner_late_interest_pct_per_month` = 1.5. Interest then runs from the day after a certificate.

### The customer's change orders

**1. O4b-2, the change order email.** `/gc` → **Change orders** → **New change order**: "Test change 2, delete
me", price $10,000, 0 days → **Save the draft** → tick **Email it to the customer now** → **Send for signature**.
*Reads*: "waiting on them since" today, and "Emailed to GC Test Owner LLC on" today. *Writes*: change order 2
(`gc_change_orders`, draft then sent), one `email_send_log` row, the email to bids@clickplumbing.com with the
subject "Change order 2 for GC test project, delete me, +$10,000". No billing job exists yet, so its sent copy is
not on one.

**2. O7c, Sign in the portal.** In the private window, change order 2 → **Sign it** → **Yes, sign it**. *Reads*:
"You signed change order 2. Thank you." The office's Change orders shows "signed" today "in their portal".
*Writes*: change order 2's status, `answered_on` and `answered_how` = portal. No email, and no undo.

**3. O7c, Decline in the portal.** Change orders → **New change order**: "Test change 3, delete me", price $100 →
**Save the draft** → **Send for signature**, the email tick off. *Reads*: "It went without an email." In the
portal: **Decline** → Why? "Test decline, delete me" → **Decline it**. *Reads*: "You declined change order 3. We
will be in touch." *Writes*: change order 3, sent then declined with the note. No email.

**4. Change order 2 at 50%.** Change orders → change order 2's percent done → 50. *Writes*: its `pct_done`.

### The first bill

**5. O4b-1, the pay application and the architect's ask.** Bill the customer → tick **Email it to the customer
and the architect now** → **Send pay application 1**. *Reads*: work to date $5,040 (change order 1's $40 and
change order 2's $5,000; every trade at $0, none awarded), retainage $504, **$4,536** asked. Under Sent: "Pay
application 1", the chip "waiting on the architect", and "Emailed to GC Test Owner LLC and GC Test Architects on"
today.
*Writes*:
- `gc_owner_pay_apps` number 1 and its `gc_owner_pay_app_lines`.
- The billing job: a billing-only `jobs_ledger` row "GC test project, delete me (GC)", set as
  `gc_projects.billing_job_id`.
- Two emails with the PDF. `pay_app` goes to the customer, "Pay application 1 for GC test project, delete me,
  $4,536". `certify_ask` goes to the architect, "Please certify pay application 1 for GC test project, delete me".
- Two sent copies on the billing job.
- No undo.

**6. O4b-2, the certified email.** On pay application 1: **What the architect certified** $4,536, **The day they
signed it** today, tick **Email the customer the bill now** → **Record the certificate**. *Reads*: "certified
$4,536" today, "The certified bill was emailed to GC Test Owner LLC on" today, and the money-in row. *Writes*:
- A `jobs_ledger_invoices` row billed at $4,536 on the billing job, and the pay application's certificate and
  `invoice_id`. It can be recorded only once.
- The email "GC Test Architects certified pay application 1, $4,536", with the portal line from S2 and no card line
  (the switch is off).
- Its sent copy.

**7. O5c, a promise.** **They said when…** → **They will pay by** yesterday, **How they told us** a call, **What
they said** "Test promise, delete me" → **Record it**. *Reads*: the chip "promised" yesterday. The bill is now past
due, so **Remind them to pay** shows. *Writes*: `job_payment_promises` and `job_promised_pay_dates` on the billing
job. Undo: void the promise.

**8. O5b, the reminder.** **Remind them to pay** → **Pay by** (5 days out) → **Your line in it** "Test reminder,
delete me" → **Send the reminder**. *Reads*: "Reminded today · pay by" five days out. *Writes*: a
`gc_owner_pay_reminders` row. It also writes a `job_payment_chase_touches` row, and the office sees it on the
Payment Chase list until the sweep. The email "Reminder: pay application 1 for GC test project, delete me, $4,536"
and its sent copy also go. There is no email tick, and no undo.

**9. O5c, a part payment.** Pipeline → Billed → "GC test project, delete me (GC)" → **Mark Paid** → **Payment
amount ($)** 100 → **Confirm** (answer "No" if it asks about a promised date). *Reads*: Bill the customer's chip
"paid $100 of $4,536". *Writes*: a `jobs_ledger_payments` row. Undo: the Pipeline's remove payment.

**10. O5c, our unconditional waiver.** Bill the customer → **Make our unconditional waiver** → sign it on screen.
**Do not press "Send to GC Test Owner LLC"**: it is a separate email. *Reads*: the portal's **Your papers** shows
it. *Writes*: one lien release row (`unconditional_progress`) on the billing job.

### The card (O8, Stripe test mode)

**11. A bill paid by card.**
- The owner turns on **Let GC customers pay a certified bill by card** (Settings → GC jobs · pay by card). It is
  global, but this is the only certified GC bill on prod.
- Change order 2 → 75%. **Send pay application 2**, the email tick off: $2,250 asked.
- **Record the certificate** at $2,250. Ticking the email here checks the certified email's card line.
- In the portal: **PAY BY CARD** ("Card adds 3%") → **Pay this bill by card**. It reads $2,250, a $67.50 fee and
  $2,317.50.
- → **Go to the card page**. *Reads*: two lines, cards only. Pay with 4242 4242 4242 4242, any future date, any CVC.
- *Reads*: Bill the customer says paid by card, with the fee. The billing job's Pipeline total includes the $67.50
  as a rider, and Money's figures do not.
- *Writes*:
  - a `gc_owner_card_bills` row, pending then `on_card`;
  - in Stripe test mode, a test customer and a card-only invoice (no email at conversion);
  - the bill's `jobs_ledger_invoices` row at base plus fee;
  - the webhook's payment.
- A paid card bill cannot be undone.

**12. Back to a check bill.**
- Change order 1 → 100%. **Send pay application 3**, ticks off: $54 asked. Then **Record the certificate** at $54.
- Portal: **PAY BY CARD** → **Go to the card page**. Do not pay.
- Office: **Back to a check bill** → confirm. *Reads*: the bill back at $54, the Stripe invoice void, and no offer in
  the portal again for that bill.
- *Writes*: the card row `undone_on`, and the bill back at its base.
- **Then the owner turns the card switch off.**

**13. A bill left waiting on the architect** (for O10's reminder on day 4). Change order 2 → 100%. **Send pay
application 4**, ticks off: $2,250 asked. Do not record its certificate.

### The rest of day 1

**14. O7b, the Monday email's test.** `/gc?view=money` → **The Monday money email** → **Email me a test**.
*Reads*: "A test went to your email." *Writes*: one `email_send_log` row. The "[TEST]" email goes to the presser's
own address. No request row and no sent copy.

**15. O10, Preview and its test.** Settings → **GC jobs · the office's notices** → **Preview today's notices**,
then **Email me a test**. *Reads*: "Nothing is due today." and "Nothing is due today, so no test went." Writes
nothing. See *Not walkable yet* for days 4 and 6.

**16. O11, Our own work, as a pay reader and as one without pay.** Do it after the bills: while Plumbing is linked,
Bill the customer shows its crew's percent as new work. Send nothing then.
- `/gc` → **Draws** → Plumbing's **Our own crew** card → **Pick its Pipeline job**. Pick a real job in progress, at
  least 10% done, with 3 or more days in the field, not billing only → **Use this job**.
- **Our number** → **Name the Pipeline job** → **Find** a different job (each picker holds the other's) → **Use
  this job**.
- As the dev, `/gc?view=money`, the project's margin, **Our own work**. Plumbing reads "our own crew · signed for
  $… , about $X at today's pace on Pipeline job … · $S spent, P% done". $S equals that job's Costs tab spent to
  date, and $X is $S ÷ P%. General conditions reads "General conditions $0: $S spent so far on Pipeline job …, $S
  over their budget." (Our number holds $0 for them.)
- View as → Master technician (Sample leader), the same margin. Plumbing reads "…, at its price: its labor cost is
  for those who see pay". General conditions reads "General conditions $0, at their budget: their labor cost is for
  those who see pay." No dollar of labor shows. **Exit**.
- Let both go: **Unlink it** on the crew card, **Let it go** on Our number.
- *Writes*: `gc_trade_packages.job_ledger_id` and `gc_project_money.general_conditions_job_id`, set then cleared. No
  new rows, and nothing on either Pipeline job.

## Day 2

**17. O6b-2, Bill the interest.** Bill the customer → tick **Email the customer the bill now** → **Bill the
interest $X**. Interest runs on pay application 1's $4,436 left open and pay application 3's $54, from the day after
their certificates. That is about $2.20 a day. If it reads under $1, press on day 3. *Reads*: "Interest bill 1",
its amount, the chip "open" and "Emailed to". *Writes*: a `jobs_ledger_invoices` row and a
`gc_owner_interest_bills` row. The email "Interest on late bills for GC test project, delete me, $X" and its sent
copy also go. No undo.

## When the other lanes' walks are done

**18. Schedule PR 11, a what-if copy.** After the schedule lane draws the test project's schedule on its own yes.
Schedule → **What if…** → drag one bar → **Throw it away** → confirm. *Reads*: "A copy of the schedule to try moves
on. Nothing here reaches the trades or the customer." The real schedule is unchanged. *Writes*: one
`gc_schedule_what_ifs` row (the presser's), deleted by Throw it away. **Keep** is not walked: it moves the real
schedule.

**19. O3b, a trade's ask into a change order.** After the Board's award and Send on the building project and the
trade's signing in its portal (the Board's and the Portal's walks).
- The trade's link `/t/<token>`, in a private window, not "Open it as the office". **Ask for a change** → **What
  changed** "Test ask, delete me", a reason, **What you ask for it** $500, **Working days it adds** 1 → **Send to**.
- Office: Change orders → the chip "1 asked by the trades" → **Make a change order** → **Save the draft** → **Send
  for signature**, the email tick off.
- *Reads*: the ask linked to change order 4.
- *Writes*:
  - a `gc_trade_change_requests` row;
  - the change order, draft then sent;
  - the trade's `changeAsk` email to the test company's contacts (bids@clickplumbing.com), with a `gc_trade_messages`
    row and a sent copy.

## Not walkable yet

- **O7c's Accept the work.** It shows in the portal only once the bills reach the whole contract. On the test
  project every trade bills $0 until it is awarded and drawn to 100%. Its bed holds it until a job gets there.
- **O10's architect reminder (day 4) and the project manager's notice (day 6).** While the switch is off, Preview
  counts pay applications sent from today only. Pay application 4, sent on day 1, never shows. Turning the switch
  on also starts its day then. A small client-only cut would fix this: Preview and its test take a "sent since"
  day. The function already reads one. Its call is the lead's.
- **O10's bill-day notice.** It is due on the 23rd and 24th, to the project manager or, with none, the company's
  owner (Malachi). With the switch off it goes nowhere, and Preview on those days shows it only while no pay application’s period
  reaches the 25th.

## After the walk

- Until the sweep, the office sees the test billing job under Pipeline → Billed and one touch on the Payment Chase
  list. AR counts a little over $4,490 open: pay application 1’s $4,436, pay application 3’s $54 and the interest bill.
- Helper 5 reads the day's new rows read-only and sends their ids to the lead for *Call 4 sweep notes*.
