---
name: "GC mode, Owner Billing O8: the customer pays a certified bill by card, with a 3% card fee"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 11, O8, after O7c)
status: planned 2026-10-09 by Helper 5 at the lead's ask, from the owner's answer to the Stripe Pay question · amended the same evening: the fee is a rider on its bill, out of every GC figure (the lead's call) · nothing built · the shape is (a), card only, and the owner's answer on card only or card or bank (asked 2026-10-09) may change it · no SQL yet; the SQL block follows the owner's answer
---

# O8: the customer pays a certified bill by card

**The owner's answer (2026-10-09, through the lead).** The customer should be able to turn a certified GC bill
into a card payment themselves, from their portal. The conversion adds a credit card fee of three percent. Staff
do not convert for them.

**What the app has today.**
- A certified GC bill is a plain `billed` row on the project's billing job, with no Stripe invoice
  (`gc_record_certificate`, v2.4984).
- The customer's portal shows that row with the check chip (`check · ref …`), never **PAY ONLINE**.
- `/pay/<id>` answers not found for it.
- The certified bill, the reminder and the interest bill each end "Reply with the day you will pay."
- The app charges no card fee on any Stripe bill. The fee math in `SendRecordInvoiceModal` is the biohazard fee.
  `buildStripeBillLinePlan` is not built.
- The only house 3% is the website terms: "3% processing fee applies to credit card payments"
  (`src/lib/contracts/websiteTerms.ts`).
- Stripe bills take card and ACH today. `create-stripe-invoice` sets no `payment_method_types`, so the Stripe
  account's defaults decide.

**The shape, (a): card only.** A bill the customer turns to card takes cards only, so the 3% is always a card fee.
- If the owner picks (b), card or bank with the fee either way, the bill keeps the account's methods and the words
  say "card or bank". Nothing else moves.
- (c), the fee on card only, is not buildable on one Stripe invoice. It is left out.
- The lead put the surcharge rules to the owner at the same time: the networks' cap, no surcharge on debit cards,
  and Texas Finance Code §339.001. The press stays off until that answer is in.

## The pieces

| PR | What | Waits on |
|---|---|---|
| **O8a** | The migration: `gc_owner_card_bills` (one row per bill turned to card), the three presses in SQL, the fee as a rider on its bill (`fee_lines`) that `job_rider_fees` counts, and `gc_owner_billing_revenue` adding the billing job's riders | The owner's answer on card only |
| **O8b** | **Pay by card** in the customer's portal. The function `gc-card-bill` (the portal's door and the office's undo door), the portal payload's offer, the press and its panel. Also the staff convert guard in `create-stripe-invoice`. Two deploys | O8a pushed, its types |
| **O8c** | The office's side. Bill the customer reads the fee and offers **Back to a check bill**. The mapper reads a card bill at its certified amount. The three emails gain their card lines | O8b |

## Who may convert, and which bills

- **Only the customer, in their portal.** The press goes through the portal link's token, checked against the
  project's customer with `gcPortalOwns`, as O7c's presses are.
- **Staff never convert a GC bill.** `create-stripe-invoice` refuses `convert_billed` on a row that a pay
  application links (`gc_owner_pay_apps.invoice_id`). Its words: "A GC bill goes on card only from the customer's
  portal." That is one small edit to a live function, deployed with O8b. Edit Job's **Make Stripe bill** shows the
  refusal; it does not hide.
- **A bill can convert when all of these hold:**
  - a certificate made it: a progress bill or the final one;
  - it is `billed`, not paid;
  - it has no Stripe invoice;
  - **it has no payment recorded on it**, which is the owner's rule and the same refusal `convert_billed` already
    makes;
  - the customer has an email for Stripe's receipt;
  - the switch is on.
- **Interest bills do not convert** (call 2). The owner named certified bills.

## The fee

- **3% of what the bill asks**, rounded to the cent. A bill that converts has no payments on it, so what it asks
  is the certified amount. Each row keeps its rate (`fee_pct = 3.00`), so a later change never rewrites a bill.
  - On $288,879.00 the fee is $8,666.37, and the card pays $297,545.37.
- **Its own line on the Stripe invoice: "Credit card fee (3%)"**, through the extra-line-item path
  (`extra_line_items`), the way the biohazard roll-in rides today.
  - The Stripe invoice's total is the certified amount plus the fee.
  - The bill's other line is "Pay application 3 for <job>, certified Oct 9".
- **The bill's row takes the total, and the fee rides on it.** `jobs_ledger_invoices.amount` becomes certified plus
  fee, which is what Stripe asks, so the Pipeline's Billed list, AR and the statement read what the customer owes.
  - `fee_lines` gains one entry: `{ description: "Credit card fee (3%)", amount, card_bill: <invoice id>, added_at }`.
  - That is the house shape for a fee on a bill (v2.5033's returned-check fee): inside the amount, and its own row on
    the printed bill.
- **The fee is a recovery of Stripe's processing cost, not the project's revenue** (the lead's call, 2026-10-09; the
  owner can overrule). It stays out of every GC figure.
- **The billing job's Pipeline total still covers the fee, as a rider.** v2.5091's `job_rider_fees(job)` counts a
  `card_bill` entry, as it counts a returned-check fee. `gc_owner_billing_revenue` becomes
  `gc_owner_contract_now + the interest billed + job_rider_fees(billing job)`.
  - Without the rider the billing job reads paid early. The Pipeline marks a job paid when
    `revenue − payments_made ≤ 0` (`update_job_status`). A card payment carries its fee, so the payments would reach
    the contract before the last bill is paid. `billTruth` would then drop that open bill out of Owed, and the AR card
    and Payment Chase would lose it.
  - This puts the fee in no GC figure. `gc_owner_billing_revenue`'s only readers are the three functions that set
    `jobs_ledger.revenue` on the billing job, and no GC kernel reads `jobs_ledger.revenue`.
  - The same restatement picks up a returned-check fee on a GC bill, which v2.5091's header left to the GC crew.
- **Owner Billing's own reads take the fee off** (O8c). The mapper reads a card bill at `amount − fee`, so every GC
  figure stays at what the architect certified:
  - Bill the customer, Money's revenue and margin, and Closeout;
  - interest, the reminder's open amount and the waivers.

  A card payment is laid on the pay application up to the certified amount, and the rest is the fee. The fee shows
  only where the Stripe total is said: the portal row, the Sent list's card line and the reminder.
- **Our unconditional waiver names the work paid, not the fee** (call 7).
- **Stripe's own charge to us** comes out of the payout as on every Stripe bill. `jobMargin` leaves both the fee
  and Stripe's charge out, since they roughly net.

## The customer's portal (O8b)

The bill's row is on the GC customer's statement, in its job's group, where the check chip sits today.
`customer-portal` adds an offer to each bill that can convert: `{ base, fee, total }`.

**A bill that can convert** keeps its chip and gains a press beside it:

```
Billed     Pay application 3 · Oak Ridge Clinic          $288,879.00   [ PAY BY CARD ]  check · ref 1042-3
Oct 9      Card adds 3%
```

**PAY BY CARD** opens a panel under the row:

```
┌ Pay this bill by card ─────────────────────────────────────────────┐
│ This bill is $288,879.00.                                           │
│ Paying by card adds a 3% card fee of $8,666.37.                     │
│ Your card pays $297,545.37 in all.                                  │
│ After this, the bill takes cards only.                              │
│ To pay by check with no fee, close this and mail your check.       │
│                                                                     │
│ [ Go to the card page ]   [ Close ]                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Go to the card page** sends `gc-card-bill { token, invoiceId }`. Stripe's page opens in a new tab, as
**PAY ONLINE** does, and the portal reads again when they come back (the v2.2878 refresh). The row then reads:

```
Billed     Pay application 3 · Oak Ridge Clinic          $297,545.37   [ PAY ONLINE ]
Oct 9      Includes the $8,666.37 card fee.
```

**The refusals, in the panel's words:**
- A payment landed meanwhile: "A payment is on this bill already, so it cannot move to card. Call our office at
  <phone>."
- It is on card already: no refusal. The press opens the card page it has.
- Anything else: "We could not set up the card page. Call our office at <phone>."

**No offer shows** when the switch is off, when the customer has no email, or on a bill that cannot convert.

Each new set of words gets a `CUSTOMER_SURFACES` entry, a journey step with a sample, and an answer in
`personJourney.ts`, as O7c's did.

## The function: `gc-card-bill` (O8b)

**It is a new function, so `create-stripe-invoice` and `submit-portal-request` stay as they are** (but for the
convert guard). It has two doors.

**The portal's door, `{ token, invoiceId }`.** No sign-in: the token is checked against `customer_portal_links`,
as `submit-portal-request` checks it. Then, as the service role:
1. `gc_card_bill_begin(invoice)` locks the bill and checks every rule above. It writes the card row as `pending`
   with the base, the rate and the fee, and returns them with the customer's name and email and the due day.
   Two presses at once meet on the row's key: the second waits, then finds it.
2. **Stripe.** The function reuses the Stripe customer the app keeps for that customer, the same lookup
   `create-stripe-invoice` does, and makes one only when none exists. It then creates the invoice:
   - `collection_method: 'send_invoice'`, with the due day the bill already has, or today when that has passed;
   - `payment_settings.payment_method_types: ['card']`, the card-only shape. Wallets pay as cards;
   - the bill's line, then "Credit card fee (3%)";
   - the app's number, memo and footer, with `metadata.pipetooling_invoice_id`, so the webhook records the
     payment as on any Stripe bill.

   Then it finalizes the invoice.
3. `gc_card_bill_finish(invoice, stripe_invoice_id, hosted_url, mode)` writes the row:
   - `amount` = total;
   - `stripe_invoice_id`, `hosted_invoice_url` and `stripe_invoice_status`;
   - `stripe_mode` and `external_send_channel = 'stripe'`.

   It also adds the `fee_lines` rider, sets the card row `on_card`, and lays the billing job's revenue again
   through `gc_owner_billing_revenue`, which now counts the rider.
4. If Stripe fails, the pending row is cleared and the panel says it could not. A pending row older than ten
   minutes with no Stripe id may be begun again.

**The office's door, `{ undo: invoiceId }`.** A signed-in member of the money team (`GC_MONEY_TEAM`), never a
training account or a twin. See *Back to a check bill* below.

**Stripe mode.** The function runs in Stripe's test mode until the owner says live (`GC_CARD_BILL_STRIPE_MODE`,
default `test`). The switch that shows the offer (`GC_CARD_BILL_ON`, default off) follows the sends-on rule:
everything starts off.

## Who the Stripe invoice email goes to

- **The Stripe customer is the project's customer**, with the email the billing job's customer row holds. That is
  the address `create-stripe-invoice` uses when a row has no bill-to party, and GC certified bills have none.
  Never the architect. No copies (`copy_emails` null).
- **At conversion, no email goes.** The customer is on the card page already. The function finalizes through the
  API, which emails nothing. `send-stripe-invoice` stays the app's one path that emails a Stripe bill, and stays
  the office's press.
- **On payment**, Stripe's own receipt goes to that address if the Stripe account sends receipts. That is a
  dashboard setting, not code; the lead checks it before the live walk.
- An email at conversion is call 3.

## The office's side (O8c)

**Record the certificate is the same press.** It still makes a plain billed row, and the office never converts.
Its hint gains one line when the switch is on:

```
Recording it makes their bill. They pay it by check, or by card in their portal with a 3% fee.
```

**Each certified bill in Sent says where it stands:**
- Not on card: `certified $288,879.00 on Oct 9` as today, then "Not on card. They can choose card in their
  portal."
- On card: a chip `on card`, then "They chose card in their portal on Oct 10. Stripe asks $297,545.37 with the
  $8,666.37 card fee." Then the link **Their card page**, and the press **Back to a check bill**.
- Paid by card: "Paid by card on Oct 12, with the $8,666.37 card fee."
- O5c's part payment does not show on a card bill. Stripe records the payment through the webhook.

**Back to a check bill** is for when the customer calls to pay by check after all, and only while Stripe shows no
payment. The press:
1. confirms in words: "This takes the card page down and the $8,666.37 fee off. The bill goes back to
   $288,879.00.";
2. sends `gc-card-bill { undo }`, which voids the Stripe invoice. It refuses a paid one: "Stripe shows a payment.
   Refund it in Stripe first.";
3. then `gc_card_bill_undo(invoice)` writes the row back:
   - `amount` = base;
   - the Stripe columns cleared;
   - the `card_bill` entry taken off `fee_lines`;
   - the card row `undone` with the day and who;
   - and the revenue laid again.

The Pipeline's own **Send back** never runs on a GC bill: it deletes the row, and a pay application's link to its
bill is kept (the O4a trigger).

## The three customer emails

**The certified bill (O4b-2)** always goes before the customer can convert, at Record the certificate. With the
switch on and a portal link, its last lines become:

```
Reply with the day you will pay by check.
Or pay it by card in your portal: pipetooling.com/p/…
Paying by card adds a 3% card fee of $8,666.37.
```

With no portal link it is as today, since the portal is the only way to card.

**The reminder (O5b)** on a bill on card:

```
Pay application 3 for Oak Ridge Clinic has $288,879.00 still open. It was due Friday, Oct 16, the day we expected it.
You chose to pay it by card. With the 3% card fee, the card page asks $297,545.37.
Please pay it by Wednesday, Oct 21.
Pay it here: pipetooling.com/pay/<id>
Our unconditional lien waiver for it follows once it is paid.
```

"Reply with the day you will pay." goes. On a bill not on card it is as today, with the certified bill's two
card lines when the switch is on and there is a portal link.

**The interest bill (O6b-2)** is as today. Interest bills do not convert (call 2), so it keeps "Reply with the day
you will pay." and the portal's *see* line.

`GC_CUSTOMER_EMAIL_PORTAL_WORDS` keeps its *see* words. The card lines are their own, chosen per bill by
`gc-customer-email`, which reads the switch and the card row.

## The tables and the SQL (O8a, in words; the block follows the owner's answer)

- **`gc_owner_card_bills`**:
  - `invoice_id` uuid primary key, referencing `jobs_ledger_invoices`;
  - `project_id`, `base` and `fee_pct` (3.00);
  - `fee`, which is `round(base × fee_pct / 100, 2)`, checked;
  - `status`: `pending`, `on_card` or `undone`;
  - `stripe_invoice_id`, `chosen_on` and `chosen_how` (`portal`);
  - `undone_on` and `undone_by`.

  RLS: the money team reads. Writes come only through the three functions. The table ends with the three blocks
  (`apply_read_only_write_blocks`, `apply_read_only_stmt_blocks`, `apply_digital_twin_write_blocks`).
- **`gc_card_bill_begin` and `gc_card_bill_finish`**: the service role only, like O7c's portal gate.
- **`gc_card_bill_undo`**: the money team, signed in.
- **`job_rider_fees`** restated byte for byte from `20261010023000` but for one more kind of `fee_lines` entry it
  sums: one that names its `card_bill`, beside one that names its `case_id`.
  - Its client twin, `jobFormRiderFeesDollars` (through `arReturnCaseFee.ts`'s fee-lines reader), learns the same
    entry in the same PR, so Edit Job's billing save keeps it.
  - CREATE OR REPLACE keeps its grants and its comment's place. The comment gains the card fee.
- **`gc_owner_billing_revenue`** restated: `gc_owner_contract_now`, plus the interest billed, plus
  `job_rider_fees(billing job)`. The billing job is read from `gc_projects.billing_job_id`. A project with no billing job adds no riders.
  - The three functions that lay revenue call it, so none of them changes.
  - Its comment says what it is: the billing job's Pipeline total, which decides when the job reads paid. No GC
    figure reads it.
- **The bed**, `supabase/tests/gc_owner_billing/90_card_bills.sql`:
  - begin refused with a payment, on an interest bill, on a bill on Stripe already, and as a signed-in user;
  - the fee to the cent on $288,879.00, and on a bill whose 3% falls on a half cent;
  - finish: the total on the row, one `card_bill` entry in `fee_lines` equal to the fee, `job_rider_fees` up by the
    fee, and the billing job's revenue equal to the contract, the interest and the fee;
  - the early-paid case: a billing job whose earlier card bill is paid with its fee, and whose last bill is still
    open, stays `billed`, not `paid`;
  - a returned-check fee on a GC bill counted in the revenue;
  - undo refused for a training account; undo putting back the base, taking the rider off and the fee out of the
    revenue;
  - a second begin after undo refused (call 4).
- **The GC figures' check** sits in O8c's mapper tests: a card bill read at `amount − fee` in Bill the customer,
  Money's revenue and margin, Closeout, interest and the waivers.

## Docs each PR touches

- O8a: `docs/migrations/<stamp>_gc_owner_card_bills.md` with its verify steps, and `docs/ACCESS_CONTROL.md` (the
  service-role door).
  - `docs/BILLING_FLOWS.md` → *GC mode: a project's billing job*: "Its bills are not on Stripe" becomes "until the
    customer turns one to card".
  - The same doc's *Revenue is kept at the contract plus the interest billed* line gains the riders, and its
    `job_rider_fees` sentence under the *Source tables* paragraph gains the card fee.
- O8b: `docs/EDGE_FUNCTIONS.md` (the `gc-card-bill` section and its TOC line, and `create-stripe-invoice`'s
  convert guard), the customer surfaces and the journey.
- O8c: the guide `record-what-a-gc-customer-paid` (a bill on card, Back to a check bill), `PROJECT_DOCUMENTATION.md`
  (Bill the customer), and `docs/GLOSSARY.md` (*card bill (GC mode)*).

## Checks (on Grace's yes, typed in Helper 5's chat)

On the test project, with its test customer's portal link and the function in Stripe test mode:
1. A certified test bill shows **PAY BY CARD**.
2. The panel's figures match the bed's.
3. The card page shows two lines and takes cards only.
4. Card 4242 pays it.
5. The webhook records the payment.
6. Bill the customer reads "Paid by card" with the fee.
7. The billing job's Pipeline total includes the fee as a rider, and Money's figures do not.

A second test bill: convert it, then **Back to a check bill**. The Stripe invoice is void and the row is back at
its base. Nothing is pressed before her yes.

## The calls this adds

1. **Card only, or card or bank** (owner; asked 2026-10-09). The default is (a), card only. The surcharge rules
   check rides with it.
2. **Interest bills convert too?** Default no. The owner named certified bills; the final pay application's bill
   is certified, so it converts.
3. **An email at conversion?** Default none. They are on the card page, and Stripe's receipt follows payment if
   the account sends one.
4. **Once Back to a check bill**, the offer does not come back on that bill. Default yes, since the office undid
   it at the customer's word. The other way lets them press again for a new card page.
5. **The staff convert guard.** Default: refuse `convert_billed` on a GC bill, in the owner's words. Edit Job's
   button stays and says why.
6. **The rate is a constant 3%**, kept on each row. A change later is one line in a migration.
7. **Our unconditional waiver names the work paid**, never the fee.
8. **Test mode and the switch.** The function stays in Stripe's test mode and the offer stays off until the owner
   says live, after the live walk.
9. **The fee is a recovery of Stripe's processing cost, not the project's revenue** (the lead's call, 2026-10-09).
   It rides in the billing job's Pipeline total only, so the paid flip and AR stay true. The owner can overrule.

## Is this the best we can do?

It keeps both live billing functions as they are, but for one refusal. It puts the fee where Stripe and the
Pipeline both read it, and keeps every Owner Billing figure at what the architect certified. It could be better
three ways:

1. **One card door for the whole app.** The same press could serve any Pipeline bill the office lets a customer
   turn to card, with the house 3% from the website terms. Not taken now: the owner asked for GC bills, and the
   Pipeline's bills are Stripe bills from the start.
2. **The fee only when they pay by card.** Stripe's surcharging, where the account has it, prices the fee at the
   card form. It would make the shape (c) real and drop "cards only". Worth asking Stripe whether the account
   qualifies; it is not in the API this app uses today.
3. **The offer in the certified email itself.** A link straight to the panel (`/p/<token>?card=<bill>`) would save
   the customer a step. Not taken: the portal link is minted by the office, and a link that opens a money press
   from an email should wait for the doors.
