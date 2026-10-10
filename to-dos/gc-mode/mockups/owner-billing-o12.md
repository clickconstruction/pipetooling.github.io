---
name: "GC mode, Owner Billing O12: the customer's notice 3 days before a bill is due"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 15, O12, after O10 and O11)
status: planned 2026-10-10 by Helper 5 (gc 5) at the lead's ask, on the owner's word the same day ("Yes, build it", behind a switch he turns on after a test copy) · O12a's SQL below ran in a local bed against main ce97107b4 with its bed (24 checks; O10's bed 93 unchanged at 32; 10 of 11 mutants caught, the eleventh equivalent) · approved by the lead 2026-10-10, the seven calls at their defaults · amended at the cut: both checks NOT VALID, then validated (the lead's call), and the bed is 96 · O12a is #5342 (v2.5184, migration 20261010130000)
---

# O12: the customer's notice 3 days before a bill is due

## What it is

One email nobody presses, from O10's call 5 and the plan's *Bills that chase themselves*: three days before a
certified bill is due, the customer hears when it is due and what is still open. It goes once per pay application,
behind its own switch, which the owner turns on after a test copy reaches him.

| Notice | Who hears | When | What it says |
|---|---|---|---|
| **A bill is due soon** (`pay_soon`) | The project's customer | From the third day before the bill's due day through the day before, never on its certificate's own day | The pay application, its due day (and that the day is theirs, when they promised it), what was certified and what is still open, the portal line and the card line as the certified email has them |

The due day is the one rule Bill the customer, Money and the Monday email already read
(`get_gc_money_monday_payload`'s `dueOn`, O7b, the lead's call 4): the customer's newest promise made since the
certificate, else the certificate's day plus their usual days to pay, else plus the contract's days to pay. The new
SQL reads that payload rather than restating it, so the notice can never name a day the screens do not. A bill with
no due day (no promise, no pay history, no days to pay) hears nothing.

## Who hears it

The project's customer at its billing address, else its contact (`customerBillingEmail`, the address every GC bill
email uses). A customer with neither gets nothing, and the cron's answer says so. Replies go to the project manager
when a real account (not a sample account, a twin or archived), else the company's owner; the email is signed by the
same person, framed by `buildGcCustomerEmail` (From Click Construction).

## When

- **The window.** Due day minus 3 through due day minus 1, so a missed tick still goes the next day, once. A bill
  whose certificate came 2 days before its due day hears only on the day before; one certified the day before its due
  day hears nothing (the certified email just told them).
- **Which bills.** A certified pay application still open (`open > 0` in the payload, so part paid is fine and the
  email says what is left). Not one waiting on the architect, paid in full, or on the card page or on card
  (`gc_owner_card_bills` pending or `on_card`: Stripe's page is theirs). One put back to a check bill hears it.
  Interest bills do not (call 2).
- **Only bills certified since the switch went on**, O10's rule: the switch holds the day it went on, so turning it
  on never fires a backlog.
- **8 AM Central**, on the hourly :13 tick `gc-office-notices` already has. No new cron.

## Once, and kept

The function writes the notice's row in `gc_office_notices` (kind `pay_soon`, the pay application, the due day it
named in a new `due_on` column, the customer and the address) **before** it sends. The table's index on a pay
application and kind (`gc_office_notices_pay_app_once`) makes a second tick's insert a no-op, so the notice goes at
most once per pay application: a later promise does not bring a second one (call 1). A send that fails leaves its
row and is not retried. The money team reads the rows (`gc_office_notices_money_read`, O10a).

The email keeps its sent copy on the billing job's Documents tab under Bills, filed as `bill_gc_due_soon`
(`docs/SENT_COPIES.md`; its source is the notice's row).

## The switch, and the live walk

`gc_customer_due_notices_on_v1` starts `'false'`. On, it holds the day it went on (`todayYmdInAppTz`), as O10's does.
The owner and a dev flip it in Settings → Jobs & billing (`master_or_dev_update_gc_customer_due_notices_on`). Off, the
cron reads nothing for the customer.

**Preview** and **Email me a test** come with it, with O10c's day field (*Count bills certified since*, the switch's day
while on, else today, never later). The walk, on Grace's yes typed in Helper 5's chat, after O12b deploys:
- a certified test bill due in 3 days or fewer on the test project;
- Preview reads it to GC Test Owner LLC at bids@clickplumbing.com;
- **Email me a test** brings the [TEST] copy to the presser;
- then the owner reads his copy and turns it on.

The test project's bills would hear it once the switch is on, so the walk reads Preview first. `LIVE_CHECKS.md` →
*When O12 is in* has the steps.

## O12a's SQL (byte for byte at the cut, but for the version and the stamp)

No table is created, so no fence calls: the column, the two checks, the function, the switch's row and its policy. The
`ALTER TABLE` takes `gc_office_notices`' lock for an instant (the cron touches it at :13). The policy on `app_settings`
is O10a's shape.

```sql
SET lock_timeout = '3s';

-- GC mode, Owner Billing's O12a (v2.NNNN): the customer's notice 3 days before a bill is due (the owner's word,
-- 2026-10-10: "Yes, build it", behind a switch he turns on after a test copy). One email nobody presses, to the
-- project's customer, from the third day before a certified pay application's bill is due through the day before,
-- once per pay application. Its due day is the one rule Bill the customer, Money and the Monday email read
-- (get_gc_money_monday_payload's dueOn: the customer's newest promise, else the certificate's day plus their usual
-- days to pay, else plus the contract's days to pay), so the notice never names a day the screens do not.
-- gc-office-notices (O12b) reads what is due from get_gc_customer_due_notices() and writes the notice's row in
-- gc_office_notices (kind pay_soon, with the due day it named) before it sends; the table's index on a pay
-- application and kind makes each go once. The switch, app_settings gc_customer_due_notices_on_v1, starts 'false';
-- on, it holds the day it went on, and only a bill certified since that day hears, so turning it on fires no backlog.
-- Additive and idempotent.

ALTER TABLE public.gc_office_notices ADD COLUMN IF NOT EXISTS due_on date;

-- Each check goes on NOT VALID, so the swap holds the table's lock for no scan, then is validated under the lighter
-- lock (the lead's call).
ALTER TABLE public.gc_office_notices
  DROP CONSTRAINT IF EXISTS gc_office_notices_kind_known,
  ADD CONSTRAINT gc_office_notices_kind_known CHECK (kind IN ('bill_day', 'certify_reminder', 'certify_late', 'pay_soon')) NOT VALID,
  DROP CONSTRAINT IF EXISTS gc_office_notices_due_said,
  ADD CONSTRAINT gc_office_notices_due_said CHECK ((kind = 'pay_soon') = (due_on IS NOT NULL)) NOT VALID;
ALTER TABLE public.gc_office_notices VALIDATE CONSTRAINT gc_office_notices_kind_known;
ALTER TABLE public.gc_office_notices VALIDATE CONSTRAINT gc_office_notices_due_said;

COMMENT ON TABLE public.gc_office_notices IS
  'GC mode (v2.5137, Owner Billing O10a; pay_soon v2.NNNN, O12a): one row per notice sent by gc-office-notices (the office''s bill_day, certify_reminder and certify_late; the customer''s pay_soon), written before its send so the unique indexes make each go once. The service role writes; the money team reads.';
COMMENT ON COLUMN public.gc_office_notices.due_on IS
  'GC mode (v2.NNNN, Owner Billing O12a): on a pay_soon notice, the due day it told the customer. Null on the office''s kinds.';

-- What the customers hear on a day (today unless the bed names one), for the service role: each certified pay
-- application still open whose due day is 1 to 3 days off, certified before that day and since the switch's day
-- (p_since, else the switch's own value when it is a date; none while off), not on card, and not told yet. To the
-- project's customer, Reply-To the project manager when a real account, else the company's owner.
CREATE OR REPLACE FUNCTION public.get_gc_customer_due_notices(p_today date DEFAULT NULL, p_since date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH t AS (
  SELECT coalesce(p_today, public.app_today()) AS d,
         coalesce(p_since, (
           SELECT CASE WHEN s.value_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(s.value_text, 'date')
                       THEN s.value_text::date END
           FROM public.app_settings s WHERE s.key = 'gc_customer_due_notices_on_v1')) AS since
),
bills AS (
  SELECT (b->>'projectId')::uuid AS project_id, (b->>'number')::int AS number, (b->>'final')::boolean AS final,
         (b->>'certified')::numeric AS certified, (b->>'certifiedOn')::date AS certified_on,
         (b->>'open')::numeric AS open, (b->>'dueOn')::date AS due_on, (b->>'promised')::boolean AS promised
  FROM jsonb_array_elements(public.get_gc_money_monday_payload()->'bills') b
  WHERE NOT (b->>'waitingOnArchitect')::boolean AND b->>'dueOn' IS NOT NULL
),
soon AS (
  SELECT bl.*, a.id AS pay_app_id, g.billing_job_id, g.project_manager_user_id, p.name AS project,
         p.customer_id, c.name AS customer
  FROM bills bl
  CROSS JOIN t
  JOIN public.gc_owner_pay_apps a ON a.project_id = bl.project_id AND a.number = bl.number
  JOIN public.gc_projects g ON g.project_id = bl.project_id
  JOIN public.projects p ON p.id = bl.project_id
  JOIN public.customers c ON c.id = p.customer_id
  WHERE t.since IS NOT NULL AND bl.certified_on >= t.since
    AND bl.certified_on < t.d
    AND bl.due_on - t.d BETWEEN 1 AND 3
    AND NOT EXISTS (SELECT 1 FROM public.gc_owner_card_bills k
                    WHERE k.invoice_id = a.invoice_id AND k.status IN ('pending', 'on_card'))
    AND NOT EXISTS (SELECT 1 FROM public.gc_office_notices n WHERE n.kind = 'pay_soon' AND n.pay_app_id = a.id)
)
SELECT jsonb_build_object(
  'today', (SELECT d FROM t),
  'since', (SELECT since FROM t),
  'notices', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'kind', 'pay_soon', 'projectId', s.project_id, 'project', s.project, 'billingJobId', s.billing_job_id,
      'payAppId', s.pay_app_id, 'number', s.number, 'final', s.final, 'certified', s.certified,
      'certifiedOn', s.certified_on, 'open', s.open, 'dueOn', s.due_on, 'promised', s.promised,
      'to', jsonb_build_object('customerId', s.customer_id, 'name', s.customer),
      'replyTo', jsonb_build_object('name', r.name, 'email', r.email)
    ) ORDER BY s.due_on, s.project, s.number)
    FROM soon s
    LEFT JOIN LATERAL (
      SELECT u.name, u.email FROM public.users u
      WHERE u.id = coalesce(
        (SELECT pm.id FROM public.users pm WHERE pm.id = s.project_manager_user_id
           AND NOT pm.is_sample AND NOT pm.is_digital_twin AND pm.archived_at IS NULL),
        public.company_owner_user_id())
    ) r ON true
  ), '[]'::jsonb)
);
$$;

COMMENT ON FUNCTION public.get_gc_customer_due_notices(date, date) IS
  'GC mode (v2.NNNN, Owner Billing O12a): the customers'' notices due today and not sent yet, for gc-office-notices. pay_soon: a certified pay application still open whose due day (get_gc_money_monday_payload''s dueOn) is 1 to 3 days off, certified before today and since p_since, else the switch''s day (gc_customer_due_notices_on_v1 holding a date; none while off), not on card (gc_owner_card_bills pending or on_card), and not told yet. To the project''s customer, Reply-To the project manager when a real account, else the company owner. p_today: the day to read for (the bed); the cron passes neither. Service role only.';

REVOKE ALL ON FUNCTION public.get_gc_customer_due_notices(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_gc_customer_due_notices(date, date) TO service_role;

-- The switch: 'false' until the owner turns it on, after the test copy; on, the day it went on.
INSERT INTO public.app_settings (key, value_text)
VALUES ('gc_customer_due_notices_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "master_or_dev_update_gc_customer_due_notices_on" ON public.app_settings;
CREATE POLICY "master_or_dev_update_gc_customer_due_notices_on"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'gc_customer_due_notices_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'gc_customer_due_notices_on_v1' AND public.is_master_or_dev());
```

## O12a's bed: `supabase/tests/gc_owner_billing/96_customer_due_notices.sql`

Eight GC jobs of one customer, each with one pay application, days fixed in October 2026, the list read for a named
day (the payload's due day does not depend on the day it runs). The billing jobs carry no customer, so no payment
becomes pay history and the contract's days count. On since Oct 10:

- **Off**, nobody hears.
- **Who hears, day by day:**
  - Oct 12, the certificates' own day: nobody.
  - Oct 13: Elm Street, due Oct 14 with 2 days to pay, so only the day before.
  - Oct 14: nobody. Elm Street is due that day, and Cedar Point was certified Oct 5, before the switch.
  - Oct 18: nobody. Oak Ridge is 4 days off, and Aspen Grove has no due day yet.
  - Oct 17, after Aspen Grove's promise made Oct 13 to pay by Oct 20: Aspen Grove.
  - Oct 19: Aspen Grove; Oak Ridge with $8,000 of $9,000 still open; and Maple Court, put back to a check bill. Not
    Birch Lane on the card page, Walnut Ridge paid in full, or Pine Hollow with the architect.
  - Oct 22, the due day: nobody.
  - Since Oct 1, Cedar Point hears on Oct 12, three days off.
- **What a notice carries:** the customer, the billing job, and Reply-To the project manager. With a sample account
  as project manager, Reply-To the owner. A promised day says so.
- **Once:** the row written before the send takes Oak Ridge off the next day's list. A second `pay_soon` row on the
  same pay application is refused. A `pay_soon` row must name its due day, and an office kind may not.
- **Who:** a dev may not read the list (the service role's). A dev and the owner flip the switch; the controller and
  an estimator may not.

Mutants, each caught: the window from the due day itself, or 4 days out; the certificate's own day; the since gate;
pending card bills let through; undone ones kept out; the once check; a sample project manager as Reply-To; O10's
switch read for this one; and the grant left to `authenticated`. One survives by being the same rule: dropping
`NOT waitingOnArchitect` changes nothing, since a bill with the architect has no certificate day and fails the
since and certificate-day tests. It stays, for the reader.

`scripts/pgtest-gc-owner-billing.sh` adds the migration to its run-twice list and bed 96 to its list (95 is the schedule's office view).

## O12b, the sender

- **`gc-office-notices`** (`index.ts`, `verify_jwt = false` kept):
  - cron: after the office's notices, the customer's. With `gc_customer_due_notices_on_v1` a day, it reads
    `get_gc_customer_due_notices()`. For each notice it:
    1. resolves the customer's address with `customerBillingEmail` (none: skipped, said in the answer);
    2. reads their portal link, never minting one (`loadPortalReturnUrl`, the certified email's way);
    3. works out the card fee by the certified email's offer rule (the card switch on, the bill certified, not on
       Stripe, nothing paid);
    4. inserts the row (`ON CONFLICT DO NOTHING`; no row back means another tick has it, so it skips);
    5. sends through Resend as `gc_customer_due_notice`;
    6. writes `email_send_log_id`, and files the sent copy `bill_gc_due_soon` on the billing job.
  - `mode: 'preview'` and `mode: 'test_send'` take `notices: 'customer'` (default `'office'`, so O10b's and O10c's
    callers are unchanged) and `since?`. The gate is the same: the money team, a real account, not training mode. The
    test is `[TEST]` to the caller alone, logged as `gc_customer_due_notice_test`. Neither writes a row, files a copy,
    or reads the switch.
- **`_shared/gcOfficeNotices.ts`** (pure, tested from vitest): `customerDueWords` and `buildCustomerDueEmail`, framed
  by `buildGcCustomerEmail` with the bill's portal words and card line. `GC_CUSTOMER_DUE_NOTICES_SETTING_KEY`. The
  since parse is `gcOfficeNoticesSince`, shared by both switches. Words, as drafted:
  - Subject: *Pay application 3 for Oak Ridge Clinic is due Oct 28*. On the final one: *Our final pay application
    for Oak Ridge Clinic is due Oct 28*.
  - *Hello,*
  - *Pay application 3 for Oak Ridge Clinic is due on Oct 28.* When it is their promise: *…is due on Oct 28, the day
    you gave us.*
  - *Hart Architects certified it for $288,879 on Oct 6. $288,879 is still open.*
  - *If it is already on its way, thank you. Reply here if anything on it needs a change.*
  - Then the frame's *You can see this bill in your portal:* (when a link is on) and, while Pay by card is on, its card
    line.
- **Settings → Jobs & billing**: `GcCustomerDueNoticesSettingsBlock`, *GC jobs · the customer's notice before a bill
  is due*, for dev and the owner, the office block's shape.
  - The box: **Email GC customers 3 days before a bill is due**. Under it: *Each customer hears once for each bill,
    from 3 days before its due day. Not a bill on card.*
  - On: *On since Oct 15. Only bills certified from that day get the notice.* Off: *Turning it on keeps today as its
    day. Only bills certified from then get the notice, so nothing old goes out.*
  - *Count bills certified since*, **Preview today's notices** (each: subject · to the customer at the address, or no
    email on file), **Email me a test**, and *As if the notice went on Oct 5.*
  - The switch's io: `src/lib/gc/officeNoticesSetting.ts` takes the key, so both blocks share it.
- **Bill the customer**: a certified bill the customer was told about says *We told them on Oct 25 it is due Oct
  28.*, from the money team's read of `gc_office_notices` (O10b's *We reminded the architect* line, beside it).
- **Registries**, as O10b's: `config.toml` (unchanged, said), the email catalog (a customer email), What customers
  see (the GC journey's *your bill is due in 3 days*, its sample), its `personJourney.ts` line, `docs/EDGE_FUNCTIONS.md`
  (the section and its TOC line), `docs/SENT_COPIES.md` (`bill_gc_due_soon`), `docs/REPORT_SUBSCRIPTIONS.md`'s stream
  table, `ACCESS_CONTROL.md` (the switch's policy, in the Owner Billing bullet), `PROJECT_DOCUMENTATION.md`, the dev-mcp
  catalog, and the guides `bill-the-customer-on-a-gc-job` (*The reminders the app sends* gains it) and
  `remind-a-customer-to-pay-a-gc-bill` (a link to it, one sentence).
- **Deploy**: `gc-office-notices` (the lead's). The types regen for the new function is gc 7's.

## Tests

- O12a: bed 96 above, and the bed script's lists.
- O12b:
  - `gcOfficeNotices.test.ts`: the words, promised or not, final or not, part paid; the frame's portal and card
    lines; `[TEST]`.
  - The function's mode parse: `notices` defaults to office.
  - The new block's render test, in O10c's shape: the start day on and off, both presses passing it, a later day
    refused, the *As if* line.
  - Bill the customer's *We told them* line.
  - `access.test.ts`: the block's roles.

## The calls this adds

1. **Once per bill, not once per due day.** A later promise does not bring a second notice. Default once: it is a
   courtesy, and the reminder to pay (O5b) is the office's press for a bill that slips. The other way needs the index
   to key on the due day.
2. **Pay applications only.** An interest bill is billed and due at once (O6b-2), so it has no "3 days before".
3. **Not on card.** A bill on the card page or on card hears nothing: Stripe's page and receipt are theirs. One put
   back to a check bill hears it as any other.
4. **Never on the certificate's own day.** The certified email has just told them; a bill certified within 3 days of
   its due day hears on the days left after it, or not at all.
5. **No Payment Chase touch.** O5b's reminder writes one because a person pressed it; this one is a courtesy nobody
   pressed. Bill the customer and the sent copy keep it.
6. **Its own switch**, not O10's, as the owner asked: he turns it on after his test copy.
7. **In `gc-office-notices`**, not a function of its own: one cron, one record, one 8 AM gate, and the same Preview
   and test. The table keeps its name; its comment says it holds the customer's notice too.

## Is this the best we can do?

It reuses the due day the screens already read, O10's record and cron, and the customer email's frame, with one column
and one function. It could be better two ways:

1. **The Pipeline's own bills.** The same notice would serve every billed job, not only GC ones, once its due day reads
   from one SQL rule too (`billMoney` today is the client's). Worth its own plan once this one has run a month.
2. **The morning after it is late.** The plan's pair, *3 days before* and *the morning after*, keeps the second as the
   office's press (O5b) for now. A scheduled one could follow behind its own switch if the office asks.
