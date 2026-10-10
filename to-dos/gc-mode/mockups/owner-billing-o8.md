---
name: "GC mode, Owner Billing O8: the customer pays a certified bill by card, with a 3% card fee"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 11, O8, after O7c)
status: planned 2026-10-09 by Helper 5 at the lead's ask, from the owner's answer to the Stripe Pay question · amended the same evening: the fee is a rider on its bill, out of every GC figure (the lead's call) · counsel's okay on the 3% surcharge 2026-10-09, the owner kept (a), card only · O8a's SQL below, byte for byte, passed in the Owner Billing bed (90_card_bills.sql, 42 checks; five mutants each caught) · O8b and O8c not built · O8c amended 2026-10-09: the switch is an app_settings row the owner turns on in Settings (the lead's call), its SQL below; the office's side and the emails as built, held for #5245
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
- The surcharge rules went to the owner at the same time: the networks' cap, no surcharge on debit cards, and Texas
  Finance Code §339.001. **Counsel said the 3% surcharge is okay (2026-10-09)**, and the owner kept (a), card only.
  The check is closed (call 1).

## The pieces

| PR | What | Waits on |
|---|---|---|
| **O8a** | The migration: `gc_owner_card_bills` (one row per bill turned to card), the three presses in SQL, the fee as a rider on its bill (`fee_lines`) that `job_rider_fees` counts, and `gc_owner_billing_revenue` adding the billing job's riders | Nothing: counsel's okay is in, and (a) stands |
| **O8b** | **Pay by card** in the customer's portal. The function `gc-card-bill` (the portal's door and the office's undo door), the portal payload's offer, the press and its panel. Also the staff convert guard in `create-stripe-invoice`. Two deploys | O8a pushed, its types |
| **O8c** | The office's side. Bill the customer reads the fee and offers **Back to a check bill**. The mapper reads a card bill at its certified amount. The three emails gain their card lines. The switch moves to an `app_settings` row the owner turns on (migration `20261010042000`). Three deploys: `gc-card-bill`, `customer-portal`, `gc-customer-email` | O8b on main and deployed |

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
default `test`). The switch that shows the offer follows the sends-on rule: everything starts off. Since O8c it is
the owner's own press, the `app_settings` row `gc_card_bill_on_v1` (*The switch (O8c)*, after the SQL). O8b shipped it as the env
value `GC_CARD_BILL_ON`, which the row replaces.

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
- Taken back: "Back to a check bill on Oct 3."
- As built (`GcBillCard.tsx`, words in `ownerBillingCard.ts`): the card's amounts are to the cent (`cardMoney`), since
  GC's `money()` rounds to the dollar and what Stripe asks is exact.

**The mapper** (`ownerBillingRows.ts`): `loadGcBillingJobMoney` reads each bill's `hosted_invoice_url` and the card
rows. `billMoney` reads a card bill at its base and lays a card payment on the pay application only up to the
certified amount; the rest is the fee. `billCard` gives each sent pay application its `card` (`invoiceId`, on card or
undone, base, fee, total, the day chosen, its card page, the day taken back). So Money, Bill the customer, Closeout,
interest and the reminder's open amount all read what was certified.

**Back to a check bill** is for when the customer calls to pay by check after all, and only while Stripe shows no
payment. The press:
1. confirms in words: "This takes the card page down and the $8,666.37 fee off. The bill goes back to
   $288,879.00.", with **Keep it on card** beside it;
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
Reply with the day you will pay.
Or pay it by card in your portal: clicktooling.com/p/…
Paying by card adds a 3% card fee of $8,666.37.
```

As built, the first line is the window's own, unchanged and true for a check. `gc-customer-email` writes the other two:
with a portal link, the switch on and a bill that can still turn (billed, not on Stripe, nothing paid, never on card:
`gcEmailCardFee`), its portal line reads `GC_CUSTOMER_EMAIL_CARD_PORTAL_WORDS` and the fee line follows
(`buildGcCustomerEmail`'s `cardFee`).

With no portal link it is as today, since the portal is the only way to card.

**The reminder (O5b)** on a bill on card:

```
Pay application 3 for Oak Ridge Clinic has $288,879.00 still open. It was due Friday, Oct 16, the day we expected it.
You chose to pay it by card. With the 3% card fee, the card page asks $297,545.37.
Please pay it by Wednesday, Oct 21.
Pay it here: clicktooling.com/pay/<id>
Our unconditional lien waiver for it follows once it is paid.
```

"Reply with the day you will pay." goes. On a bill not on card it is as today, with the certified bill's two
card lines when the switch is on and there is a portal link.

**The interest bill (O6b-2)** is as today. Interest bills do not convert (call 2), so it keeps "Reply with the day
you will pay." and the portal's *see* line.

`GC_CUSTOMER_EMAIL_PORTAL_WORDS` keeps its *see* words. A reminder on a bill on card is the window's words
(`payReminderMail` with its `card`, the bill's `payLinkUrl`), since the window knows the card row; a bill not on card
gets its card lines from `gc-customer-email`, which reads the switch and the bill.

## The tables and the SQL (O8a)

- **`gc_owner_card_bills`**:
  - `invoice_id` uuid primary key, referencing `jobs_ledger_invoices`;
  - `project_id`, `base` and `fee_pct` (3.00);
  - `fee`, which is `round(base × fee_pct / 100, 2)`, checked;
  - `status`: `pending`, `on_card` or `undone`;
  - `stripe_invoice_id`, `chosen_on` and `chosen_how` (`portal`);
  - `started_at` and `on_card_at`;
  - `undone_on` and `undone_by`.

  RLS: the money team reads, and may update the three undo columns. Nobody signed in inserts or deletes. The table
  ends with the three blocks (`apply_read_only_write_blocks`, `apply_read_only_stmt_blocks`,
  `apply_digital_twin_write_blocks`).
- **`gc_card_bill_begin` and `gc_card_bill_finish`**: the service role only. The grant stops anyone signed in
  before the function's own words do.
- **`gc_card_bill_undo`**: the money team, signed in. It refuses in words a training account, a digital twin and
  anyone off the money team before it reads the bill, as O3b's functions do. As the service role it clears a
  pending row whose Stripe invoice was never made, and nothing else.
- **The service role lays the revenue** in finish, so `gc_owner_billing_revenue` and `gc_owner_contract_now` gain
  its EXECUTE grant.
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
- **The bed**, `supabase/tests/gc_owner_billing/90_card_bills.sql`, 42 checks. A $100,000 contract is billed in five
  certified bills, with one interest bill of $100:
  - the migration's shape: row security, the two policies, the fences, who may run what;
  - begin refused as a signed-in dev, on an interest bill, on a bill that is not there, on a bill on Stripe already,
    on a second press while the page is made, and on a bill with a payment;
  - a pending row that never came back, cleared by the service role and begun again;
  - finish refused for a broken page and a page in no mode, and refused a second time;
  - the fee to the cent: $42,750.00 → $1,282.50, and a half cent rounding up, $12,345.50 → $370.37;
  - finish writes the total, the Stripe columns and one `card_bill` rider. `job_rider_fees` reads $1,282.50, and the
    revenue reads the contract, the interest and the fee;
  - a second press opens the card page it has;
  - the controller's certificate keeps the riders in the revenue, read through the controller's own rights;
  - back to a check bill: refused for the service role, and in words for an estimator, a dev in training mode and a
    digital twin, then done by the controller. The base, no Stripe, the rider off, the fee out of the revenue, the row kept undone;
  - their portal cannot turn that bill again (call 4);
  - **the early-paid case**: every bill paid but bill 2's fee. Without the riders the revenue would be $100,100.00,
    under the $101,382.50 paid, and the job would read paid. With them it keeps its status, `working`, and $370.37 is
    left owed, bill 2's fee;
  - a paid card bill stays on card;
  - a returned-check fee on a GC bill rides with the card fees: $1,682.87 of riders.
- **The GC figures' check** sits in O8c's mapper tests: a card bill read at `amount − fee` in Bill the customer,
  Money's revenue and margin, Closeout, interest and the waivers.

### O8a's SQL, byte for byte

The migration `20261010026000_gc_owner_card_bills.sql`, with only `v2.NNNN` for the claimed version:

```sql
SET lock_timeout = '3s';

-- GC mode, Owner Billing's O8a (v2.NNNN; to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md → PR 11, O8; the SQL is
-- mockups/owner-billing-o8.md's block, byte for byte, on branch spike/gc-mode): the customer turns a certified bill
-- into a card payment from their portal, and the turn adds a 3% credit card fee (the owner's word, 2026-10-09; counsel
-- said the surcharge is okay the same day). Staff never turn a bill to card.
--
-- 1. gc_owner_card_bills: one row per bill turned to card, with its base (what the bill asked), its rate and its fee.
--    It is pending while gc-card-bill makes the Stripe invoice, on_card once it is made, and undone once the office
--    takes the bill back to a check bill. The money team reads the rows; only the three functions write them.
-- 2. gc_card_bill_begin and gc_card_bill_finish, the service role only (gc-card-bill's portal door, which checks the
--    portal link's customer first). begin checks the bill may turn and writes the pending row. finish writes what
--    Stripe made onto the bill: its total, the Stripe columns, and the fee as a rider in fee_lines.
-- 3. gc_card_bill_undo: the money team takes a bill on card back to a check bill, once gc-card-bill has voided its
--    Stripe invoice. The service role clears a pending row whose Stripe invoice was never made.
-- 4. The fee is a recovery of Stripe's processing cost, not the project's revenue (the lead's call): every GC figure
--    reads a card bill at its amount less its fee. It rides on the bill the way v2.5033's returned check fee does, so
--    job_rider_fees counts it, and gc_owner_billing_revenue becomes the contract, the interest billed and the billing
--    job's riders. Without the rider the billing job would read paid before its last bill is paid, since a card
--    payment carries its fee. gc_owner_billing_revenue's only readers are the three functions that set the billing
--    job's revenue, so none of them changes. It now also counts a returned check fee on a GC bill, which v2.5091 left
--    to the GC crew.
-- Every function is SECURITY INVOKER. The table ends with the three fences.

-- 1 ---------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gc_owner_card_bills (
  invoice_id uuid PRIMARY KEY REFERENCES public.jobs_ledger_invoices(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  -- What the bill asked before the fee: the certified amount, since a bill with a payment never turns.
  base numeric NOT NULL
    CONSTRAINT gc_owner_card_bills_base_counted CHECK (base > 0),
  -- The rate the fee took, kept on the row so a later rate never rewrites a bill. At most 3 (counsel's okay).
  fee_pct numeric NOT NULL DEFAULT 3
    CONSTRAINT gc_owner_card_bills_fee_pct_known CHECK (fee_pct > 0 AND fee_pct <= 3),
  fee numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT gc_owner_card_bills_status_known CHECK (status IN ('pending', 'on_card', 'undone')),
  stripe_invoice_id text,
  chosen_on date NOT NULL,
  -- Only the customer turns a bill to card, in their portal (the owner's word).
  chosen_how text NOT NULL DEFAULT 'portal'
    CONSTRAINT gc_owner_card_bills_chosen_in_portal CHECK (chosen_how = 'portal'),
  started_at timestamptz NOT NULL DEFAULT now(),
  on_card_at timestamptz,
  undone_on date,
  undone_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_owner_card_bills_fee_is_its_rate CHECK (fee = round(base * fee_pct / 100, 2)),
  CONSTRAINT gc_owner_card_bills_made_on_stripe CHECK (status = 'pending' OR (stripe_invoice_id IS NOT NULL AND on_card_at IS NOT NULL)),
  CONSTRAINT gc_owner_card_bills_undone_dated CHECK ((status = 'undone') = (undone_on IS NOT NULL))
);

COMMENT ON TABLE public.gc_owner_card_bills IS
  'GC mode (O8a, v2.NNNN): a certified bill the customer turned to card in their portal, with the 3% credit card fee the turn added. pending while gc-card-bill makes the Stripe invoice, on_card once it is made, undone once the office took it back to a check bill. The fee rides on the bill in jobs_ledger_invoices.fee_lines; every GC figure reads the bill at its amount less this fee.';

-- The money team reads the rows, and takes a bill back to a check bill through gc_card_bill_undo. Nobody signed in
-- writes one any other way: the service role writes them for the portal.
ALTER TABLE public.gc_owner_card_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_owner_card_bills_money_read ON public.gc_owner_card_bills;
CREATE POLICY gc_owner_card_bills_money_read ON public.gc_owner_card_bills FOR SELECT TO authenticated
  USING ((SELECT public.gc_money_team()));
DROP POLICY IF EXISTS gc_owner_card_bills_money_undo ON public.gc_owner_card_bills;
CREATE POLICY gc_owner_card_bills_money_undo ON public.gc_owner_card_bills FOR UPDATE TO authenticated
  USING ((SELECT public.gc_money_team())) WITH CHECK ((SELECT public.gc_money_team()));

REVOKE ALL ON TABLE public.gc_owner_card_bills FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.gc_owner_card_bills FROM authenticated;
GRANT SELECT ON TABLE public.gc_owner_card_bills TO authenticated;
GRANT UPDATE (status, undone_on, undone_by) ON TABLE public.gc_owner_card_bills TO authenticated;

-- 2 ---------------------------------------------------------------------------------------------------------

-- The customer turns a certified bill to card (gc-card-bill's portal door, as the service role, once it has checked
-- the portal link's customer). It locks the bill, checks it may turn, and writes the pending row with the base, the
-- rate and the fee. A bill on card already answers with its card page, so a second press opens it. Returns what the
-- Stripe invoice needs.
CREATE OR REPLACE FUNCTION public.gc_card_bill_begin(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_inv public.jobs_ledger_invoices%ROWTYPE;
  v_app public.gc_owner_pay_apps%ROWTYPE;
  v_card public.gc_owner_card_bills%ROWTYPE;
  v_pay_days integer;
  v_base numeric;
  v_fee numeric;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Only the customer''s portal turns a bill to card.';
  END IF;
  SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bill is not there.';
  END IF;
  SELECT * INTO v_app FROM public.gc_owner_pay_apps WHERE invoice_id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a certified bill goes on card.';
  END IF;
  SELECT * INTO v_card FROM public.gc_owner_card_bills WHERE invoice_id = p_invoice_id FOR UPDATE;
  IF v_card.invoice_id IS NOT NULL AND v_card.status = 'on_card' THEN
    RETURN jsonb_build_object('state', 'on_card', 'hosted_invoice_url', v_inv.hosted_invoice_url,
      'base', v_card.base, 'fee', v_card.fee, 'total', v_card.base + v_card.fee);
  END IF;
  IF v_card.invoice_id IS NOT NULL AND v_card.status = 'undone' THEN
    RAISE EXCEPTION 'This bill went back to a check bill. Call our office to pay it by card.';
  END IF;
  IF v_inv.status <> 'billed' THEN
    RAISE EXCEPTION 'This bill is paid already.';
  END IF;
  IF v_inv.stripe_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'This bill is on Stripe already.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.jobs_ledger_payments WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'A payment is on this bill already, so it cannot move to card.';
  END IF;
  -- A pending row is a card page being made. One older than ten minutes never came back, and may be begun again.
  IF v_card.invoice_id IS NOT NULL AND v_card.started_at > now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'This bill is being set up for card. Try again in a minute.';
  END IF;
  v_base := round(v_inv.amount, 2);
  IF v_base IS NULL OR v_base <= 0 THEN
    RAISE EXCEPTION 'There is nothing to pay on this bill.';
  END IF;
  v_fee := round(v_base * 3 / 100, 2);
  INSERT INTO public.gc_owner_card_bills (invoice_id, project_id, base, fee_pct, fee, status, chosen_on, chosen_how, started_at)
  VALUES (p_invoice_id, v_app.project_id, v_base, 3, v_fee, 'pending', public.app_today(), 'portal', now())
  ON CONFLICT (invoice_id) DO UPDATE
    SET base = EXCLUDED.base, fee_pct = EXCLUDED.fee_pct, fee = EXCLUDED.fee, chosen_on = EXCLUDED.chosen_on,
        started_at = EXCLUDED.started_at;
  SELECT owner_pay_days INTO v_pay_days FROM public.gc_projects WHERE project_id = v_app.project_id;
  RETURN jsonb_build_object('state', 'pending', 'base', v_base, 'fee_pct', 3, 'fee', v_fee, 'total', v_base + v_fee,
    'project_id', v_app.project_id, 'job_id', v_inv.job_id, 'number', v_app.number, 'final', v_app.final,
    'certified_on', v_app.certified_on, 'owner_pay_days', v_pay_days);
END;
$$;

COMMENT ON FUNCTION public.gc_card_bill_begin(uuid) IS
  'GC mode (O8a, v2.NNNN): the customer turns a certified bill to card, as the service role for gc-card-bill''s portal door. Refused for an interest bill, a paid bill, a bill on Stripe, a bill with a payment, and a bill taken back to a check bill. Writes the pending card row at 3% of what the bill asks, rounded to the cent; a bill on card answers with its card page. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_card_bill_begin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_card_bill_begin(uuid) TO service_role;

-- What Stripe made, written onto the bill: its total (the base and the fee), the Stripe columns, and the fee as a
-- rider in fee_lines, so the printed bill shows it as its own row and job_rider_fees counts it. Then the billing
-- job's revenue is laid again.
CREATE OR REPLACE FUNCTION public.gc_card_bill_finish(p_invoice_id uuid, p_stripe_invoice_id text, p_hosted_url text, p_stripe_status text, p_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_card public.gc_owner_card_bills%ROWTYPE;
  v_inv public.jobs_ledger_invoices%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Only the customer''s portal turns a bill to card.';
  END IF;
  IF COALESCE(p_stripe_invoice_id, '') !~ '^in_[A-Za-z0-9]+$' OR COALESCE(p_hosted_url, '') !~ '^https://\S+$'
     OR p_mode IS NULL OR p_mode NOT IN ('live', 'test') THEN
    RAISE EXCEPTION 'The card page did not come back whole.';
  END IF;
  SELECT * INTO v_card FROM public.gc_owner_card_bills WHERE invoice_id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_card.status <> 'pending' THEN
    RAISE EXCEPTION 'That bill is not being set up for card.';
  END IF;
  SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_inv.status <> 'billed' OR v_inv.stripe_invoice_id IS NOT NULL OR round(v_inv.amount, 2) <> v_card.base
     OR EXISTS (SELECT 1 FROM public.jobs_ledger_payments WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'The bill changed while its card page was made. Call our office.';
  END IF;
  UPDATE public.jobs_ledger_invoices
  SET amount = v_card.base + v_card.fee,
      stripe_invoice_id = p_stripe_invoice_id,
      hosted_invoice_url = p_hosted_url,
      stripe_invoice_status = NULLIF(btrim(COALESCE(p_stripe_status, '')), ''),
      stripe_mode = p_mode,
      external_send_channel = 'stripe',
      fee_lines = CASE WHEN jsonb_typeof(fee_lines) = 'array' THEN fee_lines ELSE '[]'::jsonb END
        || jsonb_build_array(jsonb_build_object(
             'description', format('Credit card fee (%s%%)', trim_scale(v_card.fee_pct)),
             'amount', v_card.fee,
             'card_bill', p_invoice_id,
             'added_at', now()))
  WHERE id = p_invoice_id;
  UPDATE public.gc_owner_card_bills
  SET status = 'on_card', stripe_invoice_id = p_stripe_invoice_id, on_card_at = now()
  WHERE invoice_id = p_invoice_id;
  UPDATE public.jobs_ledger SET revenue = public.gc_owner_billing_revenue(v_card.project_id), updated_at = now()
  WHERE id = v_inv.job_id AND revenue IS DISTINCT FROM public.gc_owner_billing_revenue(v_card.project_id);
END;
$$;

COMMENT ON FUNCTION public.gc_card_bill_finish(uuid, text, text, text, text) IS
  'GC mode (O8a, v2.NNNN): the Stripe invoice gc-card-bill made for a pending card bill, written onto the bill (its total, the Stripe columns, the fee as a fee_lines rider) as the service role; the billing job''s revenue laid again. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_card_bill_finish(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_card_bill_finish(uuid, text, text, text, text) TO service_role;

-- 3 ---------------------------------------------------------------------------------------------------------

-- Back to a check bill: the money team (never a training account or a digital twin, each told in words), once
-- gc-card-bill has voided the Stripe invoice, while no payment is on the bill. The bill goes back to its base, the Stripe columns are cleared, the rider comes off, and the revenue is laid
-- again. The row stays, undone, so the offer does not come back on that bill. As the service role it clears a
-- pending row whose Stripe invoice was never made, and nothing else.
CREATE OR REPLACE FUNCTION public.gc_card_bill_undo(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_card public.gc_owner_card_bills%ROWTYPE;
  v_inv public.jobs_ledger_invoices%ROWTYPE;
BEGIN
  IF current_user = 'service_role' THEN
    SELECT * INTO v_card FROM public.gc_owner_card_bills WHERE invoice_id = p_invoice_id FOR UPDATE;
    IF NOT FOUND OR v_card.status <> 'pending' THEN
      RAISE EXCEPTION 'Only the office takes a bill off card.';
    END IF;
    DELETE FROM public.gc_owner_card_bills WHERE invoice_id = p_invoice_id;
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to take a bill off card.';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot take a bill off card.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot take a bill off card.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team takes a bill off card.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_card FROM public.gc_owner_card_bills WHERE invoice_id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_card.status <> 'on_card' THEN
    RAISE EXCEPTION 'That bill is not on card.';
  END IF;
  SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bill is not there.';
  END IF;
  IF v_inv.status <> 'billed' OR EXISTS (SELECT 1 FROM public.jobs_ledger_payments WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'A payment is on this bill, so it stays on card.';
  END IF;
  UPDATE public.jobs_ledger_invoices
  SET amount = v_card.base,
      stripe_invoice_id = NULL,
      hosted_invoice_url = NULL,
      stripe_invoice_status = NULL,
      stripe_mode = NULL,
      external_send_channel = NULL,
      fee_lines = (
        SELECT CASE WHEN count(*) = 0 THEN NULL ELSE jsonb_agg(e.l ORDER BY e.o) END
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(fee_lines) = 'array' THEN fee_lines ELSE '[]'::jsonb END)
          WITH ORDINALITY AS e(l, o)
        WHERE (e.l ->> 'card_bill') IS DISTINCT FROM p_invoice_id::text)
  WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the money team takes a bill off card.';
  END IF;
  UPDATE public.gc_owner_card_bills
  SET status = 'undone', undone_on = public.app_today(), undone_by = auth.uid()
  WHERE invoice_id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the money team takes a bill off card.';
  END IF;
  UPDATE public.jobs_ledger SET revenue = public.gc_owner_billing_revenue(v_card.project_id), updated_at = now()
  WHERE id = v_inv.job_id AND revenue IS DISTINCT FROM public.gc_owner_billing_revenue(v_card.project_id);
END;
$$;

COMMENT ON FUNCTION public.gc_card_bill_undo(uuid) IS
  'GC mode (O8a, v2.NNNN): back to a check bill, by the money team once gc-card-bill voided the Stripe invoice and while no payment is on the bill: the base, no Stripe columns, the rider off, the revenue laid again, the row kept undone. As the service role, clears a pending row only. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_card_bill_undo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_card_bill_undo(uuid) TO authenticated, service_role;

-- 4 ---------------------------------------------------------------------------------------------------------

-- job_rider_fees, restated byte for byte from 20261010023000 but for one more kind of fee_lines entry it sums: one
-- that names its card bill (O8a's card fee), beside one that names its case (v2.5033's returned check fee).
CREATE OR REPLACE FUNCTION public.job_rider_fees(p_job_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    coalesce((SELECT sum(h.fee_amount)
              FROM public.job_hazmat_incidents h
              WHERE h.job_id = p_job_id AND h.voided_at IS NULL), 0)
    + coalesce((SELECT sum(CASE
                             WHEN ((jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') <> '')
                                   OR (jsonb_typeof(l->'card_bill') = 'string' AND btrim(l->>'card_bill') <> ''))
                              AND (jsonb_typeof(l->'amount') = 'number'
                                   OR (jsonb_typeof(l->'amount') = 'string' AND btrim(l->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'))
                             THEN greatest(round(btrim(l->>'amount')::numeric, 2), 0)
                           END)
                FROM public.jobs_ledger_invoices i
                CROSS JOIN LATERAL jsonb_array_elements(
                  CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END
                ) AS l
                WHERE i.job_id = p_job_id), 0)
$function$;

COMMENT ON FUNCTION public.job_rider_fees(uuid) IS
  'v2.5091, widened by v2.NNNN: the riders, the fees that ride on a job beyond its line items: its un-voided hazmat fees, every returned check fee on its bills (a jobs_ledger_invoices.fee_lines entry that names its case), and every GC card fee (an entry that names its card bill). Every rewrite of jobs_ledger.revenue from the line items adds it. The client twin is jobFormRiderFeesDollars.';

-- The billing job's revenue: our price to the customer today, every interest bill, and the billing job's riders (the
-- card fees, and a returned check fee on a GC bill). It is the billing job's Pipeline total, which decides when the
-- job reads paid; no GC figure reads it. The three functions that set the revenue call it, so none of them changes.
CREATE OR REPLACE FUNCTION public.gc_owner_billing_revenue(p_project_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.gc_owner_contract_now(p_project_id)
    + COALESCE((SELECT sum(amount) FROM public.gc_owner_interest_bills WHERE project_id = p_project_id), 0)
    + COALESCE((SELECT public.job_rider_fees(g.billing_job_id) FROM public.gc_projects g
                WHERE g.project_id = p_project_id AND g.billing_job_id IS NOT NULL), 0)
$$;

COMMENT ON FUNCTION public.gc_owner_billing_revenue(uuid) IS
  'GC mode (O6b-2, widened by O8a): the billing job''s revenue, our price to the customer today (gc_owner_contract_now), every interest bill, and the billing job''s riders (job_rider_fees: the card fees and any returned check fee), so a payment marks the job paid only when all of them are in. The billing job''s Pipeline total; no GC figure reads it.';

-- finish and undo lay the revenue as the service role and the money team; the money team could already.
GRANT EXECUTE ON FUNCTION public.gc_owner_billing_revenue(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gc_owner_contract_now(uuid) TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
```

## The switch (O8c)

**The lead's call (2026-10-09), option (ii).** O8b's switch was an env value only its two functions could see, and the
office's hint and `gc-customer-email`'s card lines need it too. So it is one `app_settings` row the whole app reads:
`gc_card_bill_on_v1`, `'false'` from the migration, `'true'` once the owner turns it on. Only `'true'` is on, and a
missing row is off (`gcCardBillOn`, `GC_CARD_BILL_SETTING_KEY` in `_shared/gcCardBill.ts`).

- **Who flips it**: the owner (`master_technician`) and dev, through the key-scoped UPDATE policy
  `master_or_dev_update_gc_card_bill_on` (the `owner_auto_confirm_from_roll_v1` pattern, v2.3450). The read-only and
  twin fences already on `app_settings` stop a training account and a twin.
- **Who reads it**: everyone signed in, through the table's own read policy, so Bill the customer's hint reads it
  (`fetchGcCardBillOn`). `gc-card-bill`, `customer-portal` and `gc-customer-email` read it as the service role.
- **Where**: Settings → Jobs & billing, beside the other org toggles, for dev and the owner (`GcCardBillSettingsBlock`):

```
GC jobs · pay by card
[ ] Let GC customers pay a certified bill by card
    A certified bill on a GC job shows Pay by card in the customer’s portal. The card adds a 3% fee, and the bill
    then takes cards only. Our emails offer it too. Only the customer turns a bill to card.
```

- **Stripe's test or live stays an env value** (`GC_CARD_BILL_STRIPE_MODE`): infrastructure, not an office press.
- **The bed**, `supabase/tests/gc_owner_billing/91_card_switch.sql`, 11 checks: off to start; the owner flips it on
  and off, writes no other key with it and cannot delete it; a dev flips it; the controller, an estimator (who reads
  it) and the owner in training mode do not; signed out reads nothing. Since `20261010027000` an anon read is
  refused outright rather than empty, and `app_settings`' read policy asks `auth.role()`, so the bed sets
  `request.jwt.claim.role`. Five mutants were each caught: the policy on any key, dev only, the row inserted on,
  every verb instead of UPDATE, and anyone signed in.

### O8c's SQL, byte for byte

The migration `20261010042000_gc_card_bill_switch.sql`, with only `v2.NNNN` for the version to be claimed at the cut.
It is the page's second SQL block. O8a's, above, is the first.

```sql
SET lock_timeout = '3s';

-- GC mode, Owner Billing's O8c (v2.NNNN): Pay by card's switch becomes the owner's own press (the lead's call,
-- 2026-10-09). O8b (v2.5123) read an env value, GC_CARD_BILL_ON, which only its two functions could see; the office's
-- Bill the customer and gc-customer-email's card lines need it too. So it is one app_settings row the whole app reads:
-- `gc_card_bill_on_v1` = 'false', turned on in Settings → Jobs & billing. Dev already manages every app_settings row;
-- the owner (master_technician) may flip this one through a key-scoped UPDATE policy, the
-- owner_auto_confirm_from_roll_v1 pattern (20260914270000). Everyone signed in reads app_settings, so the window sees
-- it; gc-card-bill, customer-portal and gc-customer-email read it as the service role. It replaces the env value, which
-- goes away. Stripe's test or live stays an env value (GC_CARD_BILL_STRIPE_MODE): infrastructure, not an office press.
--
-- Additive and idempotent. No table is created, so the read-only and twin fences already on app_settings stand.

INSERT INTO public.app_settings (key, value_text)
VALUES ('gc_card_bill_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "master_or_dev_update_gc_card_bill_on" ON public.app_settings;
CREATE POLICY "master_or_dev_update_gc_card_bill_on"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'gc_card_bill_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'gc_card_bill_on_v1' AND public.is_master_or_dev());
```

## Docs each PR touches

- O8a: `docs/migrations/<stamp>_gc_owner_card_bills.md` with its verify steps, and `docs/ACCESS_CONTROL.md` (the
  service-role door).
  - `docs/BILLING_FLOWS.md` → *GC mode: a project's billing job*: "Its bills are not on Stripe" becomes "until the
    customer turns one to card".
  - The same doc's *Revenue is kept at the contract plus the interest billed* line gains the riders, and its
    `job_rider_fees` sentence under the *Source tables* paragraph gains the card fee.
- O8b: `docs/EDGE_FUNCTIONS.md` (the `gc-card-bill` section and its TOC line, and `create-stripe-invoice`'s
  convert guard), the customer surfaces and the journey.
- O8c: `docs/migrations/20261010042000_gc_card_bill_switch.md` (the row replaces the env value), the guide
  `record-what-a-gc-customer-paid` (a bill on card, Back to a check bill), the portal guide (where the owner turns it
  on), `EDGE_FUNCTIONS.md` (the three functions read the row; `gc-customer-email`'s card lines), `BILLING_FLOWS.md`,
  `ACCESS_CONTROL.md` (the switch's policy), `PROJECT_DOCUMENTATION.md` (Bill the customer, the Settings toggle), and
  `docs/GLOSSARY.md` (*Card bill · card fee*).

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

1. **Card only, or card or bank** (owner; asked 2026-10-09). Answered: (a), card only. **Counsel's okay on the 3%
   surcharge came the same day**, so the surcharge rules check is closed.
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
