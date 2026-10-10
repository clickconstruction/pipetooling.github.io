---
name: "GC mode, Owner Billing O10: the office's notices (bill day, and a pay application waiting on the architect)"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 13, O10, after O9)
status: planned 2026-10-09 by Helper 5 at the lead's ask · approved by the lead with the five defaults, and the on-date rule added (no notice on a pay application sent before the switch went on) · O10a building · O10a's SQL below is its migration byte for byte but for the version and the stamp; O10b's cron block likewise
---

# O10: the office's notices

## What it is

Three emails nobody presses, from `README.md` → *Workflow steps not built yet* → *Billing the owner's events*, with
HANDOFF call 6's days (the owner's call 6 in `OWNER_BILLING_REAL_BUILD.md`, still defaults):

| Notice | Who hears | When | What it says |
|---|---|---|---|
| **Bill day is near** (`bill_day`) | The project manager | 2 days before bill day (the 25th), on a job being built with a signed contract and this month's pay application not sent | Bill day and the pay application's number, a press to open **Bill the customer**, and each trade we paid that still owes its unconditional waiver |
| **The architect, reminded** (`certify_reminder`) | The architect | 3 days after a pay application went with no certificate | The pay application, its amount and the day it went, from Click Construction, with Reply-To the project manager |
| **The project manager, at 5** (`certify_late`) | The project manager | 5 days after it went with no certificate | The same, and the day the architect was reminded, or that they have no email on file |

The customer's notice 3 days before a bill is due is **not in O10**: it is a customer email nobody presses, and the
Pipeline's payment chase and O5b's reminder already cover a bill near its day. It waits for the owner's word (call 6).

- **O10a, the record and what is due** (migration, no screen): `gc_office_notices`, one row per notice sent, written
  before its send so each goes once; `get_gc_office_notices_due()`, the service role's list of what is due today;
  the switch `gc_office_notices_on_v1` = `'false'`, the owner's and dev's to flip (O8c's pattern), holding the day it
  went on.
- **O10b, the sender** (one new function, one small migration for its cron, one screen line): `gc-office-notices`,
  hourly from pg_cron, which waits for 8 AM Central and does nothing while the switch is off; its words in
  `_shared/gcOfficeNotices.ts`; **Preview** and **Email me a test** for the money team; the switch in Settings → Jobs &
  billing beside Pay by card; and Bill the customer's sent bill saying *We reminded the architect on Oct 5.*

## Who hears an office notice

The project manager (`gc_projects.project_manager_user_id`), **when they are a real account on the money team**
(dev, the leaders, the controller; not a sample account, a twin or archived). Otherwise the company's owner
(`company_owner_user_id()`). The notices carry the bill's amount and the trades' waivers, which are the money team's
(the owner's rule: finances stay with the owner and the controller). A project with neither reads nothing.

The architect's reminder goes to the architect's billing email, else its contact email (`customerBillingEmail`, the
address `certify_ask` uses), and replies go to the project manager, whoever they are (`gc-customer-email`'s rule). An
architect with no address gets nothing, and the project manager's notice at 5 says so.

## When

- **Bill day** is the 25th (`OWNER_BILL_DAY`, `nextOwnerBillDay`). The notice is due on the 23rd and the 24th, so a
  missed 23rd still goes on the 24th, once. A job hears it only while being built (`stage = 'building'`), with a signed
  contract (`owner_contract_signed_on`), no pay application whose period runs to this bill day or later, and no
  final one.
- **The architect's reminder** is due from the third day after `sent_on`, and **the project manager's** from the fifth,
  while `certified_on` is null; each once per pay application.
- **Only pay applications sent since the switch went on** (the lead's rule), so turning it on never fires a backlog.
  The switch's value is the day it went on (`'2026-10-15'`), written by the Settings toggle; `'false'` or anything that
  is not a date is off. A pay application sent before that day hears nothing, ever; turned off and on again, the day
  is the new one. Bill day needs no such rule: it is only ever this month's.
- **8 AM Central.** pg_cron calls the function hourly at :13 (`bid-followup-reminders`' precedent, its own lane); the
  ticks before 8 AM office time do nothing (`officeHour`), so the schedule needs no daylight-saving arithmetic.

## Once, and kept

The function inserts the notice's row **before** it sends (`bid_followup_reminders`' precedent): a partial unique index
per bill day and per pay application makes a second tick's insert a no-op, so a notice goes at most once. After the
send it writes the row's `email_send_log_id` by the Resend id. A send that fails leaves its row: the notice is not
retried (the next notice on the same pay application still goes). The money team reads the rows (`<table>_money_read`).

The architect's reminder keeps its sent copy on the billing job's Documents tab (`docs/SENT_COPIES.md`, filed as
`gc_certify_reminder`). The project manager's two are mail to our own staff, deliberately not filed (SENT_COPIES' rule):
`email_send_log` holds them.

## The switch, and the live walk

`gc_office_notices_on_v1` starts `'false'`. On, it holds the day it went on (an ISO date, the app's own day,
`todayYmdInAppTz`): no new column on `app_settings`, which every page reads, and one row the policy already lets the
owner write. Off, the cron's ticks return at once and nothing is written. The money
team's **Preview** (`mode: 'preview'`) returns today's notices as they would go, with their recipients and words, and
writes nothing. It reads as if on since the switch's day, or since today while off; a `since` day in the request reads
further back for the walk; **Email me a test** (`mode: 'test_send'`) sends each one to the caller alone, `[TEST]` before its
subject, nothing filed and no row written (the Monday money email's two modes). The owner turns the switch on in
Settings → Jobs & billing after the live walk, on Grace's yes typed in Helper 5's chat. The test projects on prod are
named for deletion; they would hear notices too once it is on, so the walk reads Preview first.

## O10a's SQL (byte for byte at the cut, but for the version and the stamp)

```sql
SET lock_timeout = '3s';

-- GC mode, Owner Billing's O10a (v2.NNNN): the office's notices, their record and what is due. Three emails nobody
-- presses: the project manager two days before bill day (the 25th), the architect three days after a pay application
-- went with no certificate yet, and the project manager at five. gc-office-notices (O10b) reads what is due today from
-- get_gc_office_notices_due() and writes the notice's row here before it sends, so each goes once. They go to the
-- project manager only when a real account on the money team, since they carry the bill's money; otherwise to the
-- company's owner. The switch, app_settings gc_office_notices_on_v1, starts 'false'; on, it holds the day it went on,
-- and only a pay application sent since that day hears, so turning it on fires no backlog (the lead's rule). The owner
-- and dev flip it in Settings (O8c's pattern, 20261010042000). Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.gc_office_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  kind text NOT NULL
    CONSTRAINT gc_office_notices_kind_known CHECK (kind IN ('bill_day', 'certify_reminder', 'certify_late')),
  -- What it is about: the bill day for bill_day, the pay application for the other two.
  bill_day date,
  pay_app_id uuid REFERENCES public.gc_owner_pay_apps(id) ON DELETE CASCADE,
  -- Who heard it: one of ours, or the architect (a customer record), and the address it went to.
  recipient_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  recipient_email text NOT NULL
    CONSTRAINT gc_office_notices_address_said CHECK (btrim(recipient_email) <> ''),
  email_send_log_id uuid REFERENCES public.email_send_log(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_office_notices_about CHECK (
    (kind = 'bill_day' AND bill_day IS NOT NULL AND pay_app_id IS NULL)
    OR (kind <> 'bill_day' AND pay_app_id IS NOT NULL AND bill_day IS NULL))
);

-- Once each: a project's bill day, and each kind on a pay application. The function's insert skips a row that exists.
CREATE UNIQUE INDEX IF NOT EXISTS gc_office_notices_bill_day_once
  ON public.gc_office_notices (project_id, bill_day) WHERE kind = 'bill_day';
CREATE UNIQUE INDEX IF NOT EXISTS gc_office_notices_pay_app_once
  ON public.gc_office_notices (pay_app_id, kind) WHERE pay_app_id IS NOT NULL;

COMMENT ON TABLE public.gc_office_notices IS
  'GC mode (v2.NNNN, Owner Billing O10a): one row per office notice sent by gc-office-notices (bill_day, certify_reminder, certify_late), written before its send so the unique indexes make each go once. The service role writes; the money team reads.';

ALTER TABLE public.gc_office_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_office_notices_money_read ON public.gc_office_notices;
CREATE POLICY gc_office_notices_money_read ON public.gc_office_notices FOR SELECT TO authenticated
  USING ((SELECT public.gc_money_team()));
REVOKE ALL ON TABLE public.gc_office_notices FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.gc_office_notices FROM authenticated;

-- What is due on a day (today unless the bed names one), for the service role: each notice not sent yet, with what
-- its words need. A pay application's notices go only for one sent since the switch's day (p_since, else the switch's
-- own value when it is a date; none while off). The money team's
-- roles are named here as gc_money_team() names them (access.test.ts holds the two lists together); the bill day is
-- OWNER_BILL_DAY's 25th (ownerBillingNotices.test.ts holds them together).
CREATE OR REPLACE FUNCTION public.get_gc_office_notices_due(p_today date DEFAULT NULL, p_since date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH bill AS (
  SELECT t.d,
         CASE WHEN EXTRACT(DAY FROM t.d) <= 25
              THEN make_date(EXTRACT(YEAR FROM t.d)::int, EXTRACT(MONTH FROM t.d)::int, 25)
              ELSE (make_date(EXTRACT(YEAR FROM t.d)::int, EXTRACT(MONTH FROM t.d)::int, 25) + interval '1 month')::date
         END AS on_d,
         coalesce(p_since, (
           SELECT CASE WHEN s.value_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(s.value_text, 'date')
                       THEN s.value_text::date END
           FROM public.app_settings s WHERE s.key = 'gc_office_notices_on_v1')) AS since
  FROM (SELECT coalesce(p_today, public.app_today()) AS d) t
),
ours AS (
  SELECT g.project_id, g.stage, g.billing_job_id, g.architect_customer_id, g.owner_contract_signed_on,
         p.name AS project, a.name AS architect,
         rp.id AS pm_id, rp.name AS pm_name, rp.email AS pm_email,
         COALESCE(mp.id, public.company_owner_user_id()) AS office_user_id
  FROM public.gc_projects g
  JOIN public.projects p ON p.id = g.project_id
  LEFT JOIN public.customers a ON a.id = g.architect_customer_id
  LEFT JOIN public.users rp ON rp.id = g.project_manager_user_id
    AND NOT rp.is_sample AND NOT rp.is_digital_twin AND rp.archived_at IS NULL
  LEFT JOIN public.users mp ON mp.id = rp.id AND mp.role IN ('dev', 'master_technician', 'controller')
),
office AS (
  SELECT o.*, u.name AS office_name, u.email AS office_email
  FROM ours o
  JOIN public.users u ON u.id = o.office_user_id
    AND NOT u.is_sample AND NOT u.is_digital_twin AND u.archived_at IS NULL
),
bill_days AS (
  SELECT jsonb_build_object(
    'kind', 'bill_day', 'projectId', o.project_id, 'project', o.project, 'billingJobId', o.billing_job_id,
    'billDay', b.on_d,
    'number', (SELECT count(*) + 1 FROM public.gc_owner_pay_apps x WHERE x.project_id = o.project_id),
    'waiversOwed', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('company', c.name, 'draws', w.draws, 'final', w.final) ORDER BY c.name), '[]'::jsonb)
      FROM (
        SELECT s.company_id,
               coalesce(array_agg(d.number ORDER BY d.number) FILTER (WHERE NOT d.final), '{}') AS draws,
               bool_or(d.final) AS final
        FROM public.gc_draws d
        JOIN public.gc_sows s ON s.id = d.sow_id
        JOIN public.gc_trade_packages k ON k.id = s.package_id
        WHERE k.project_id = o.project_id AND d.status = 'paid' AND d.waiver = 'conditional'
        GROUP BY s.company_id
      ) w
      JOIN public.gc_companies c ON c.id = w.company_id),
    'to', jsonb_build_object('userId', o.office_user_id, 'name', o.office_name, 'email', o.office_email)
  ) AS notice
  FROM office o CROSS JOIN bill b
  WHERE o.stage = 'building'
    AND o.owner_contract_signed_on IS NOT NULL
    AND b.on_d - b.d BETWEEN 1 AND 2
    AND NOT EXISTS (SELECT 1 FROM public.gc_owner_pay_apps x WHERE x.project_id = o.project_id AND (x.period_to >= b.on_d OR x.final))
    AND NOT EXISTS (SELECT 1 FROM public.gc_office_notices n WHERE n.kind = 'bill_day' AND n.project_id = o.project_id AND n.bill_day = b.on_d)
),
waiting AS (
  SELECT o.project_id, o.project, o.billing_job_id, o.architect_customer_id, o.architect, o.pm_name, o.pm_email,
         o.office_user_id, a.id AS pay_app_id, a.number, a.final, a.due, a.sent_on, b.d
  FROM ours o
  JOIN public.gc_owner_pay_apps a ON a.project_id = o.project_id
  CROSS JOIN bill b
  WHERE a.sent_on IS NOT NULL AND a.certified_on IS NULL
    AND b.since IS NOT NULL AND a.sent_on >= b.since
),
reminders AS (
  SELECT jsonb_build_object(
    'kind', 'certify_reminder', 'projectId', w.project_id, 'project', w.project, 'billingJobId', w.billing_job_id,
    'payAppId', w.pay_app_id, 'number', w.number, 'final', w.final, 'due', w.due, 'sentOn', w.sent_on,
    'to', jsonb_build_object('customerId', w.architect_customer_id, 'name', w.architect),
    'replyTo', jsonb_build_object('name', w.pm_name, 'email', w.pm_email)
  ) AS notice
  FROM waiting w
  WHERE w.architect_customer_id IS NOT NULL
    AND w.sent_on + 3 <= w.d
    AND NOT EXISTS (SELECT 1 FROM public.gc_office_notices n WHERE n.kind = 'certify_reminder' AND n.pay_app_id = w.pay_app_id)
),
lates AS (
  SELECT jsonb_build_object(
    'kind', 'certify_late', 'projectId', w.project_id, 'project', w.project, 'billingJobId', w.billing_job_id,
    'payAppId', w.pay_app_id, 'number', w.number, 'final', w.final, 'due', w.due, 'sentOn', w.sent_on,
    'architect', w.architect,
    'remindedOn', (SELECT (n.created_at AT TIME ZONE 'America/Chicago')::date FROM public.gc_office_notices n
                   WHERE n.kind = 'certify_reminder' AND n.pay_app_id = w.pay_app_id),
    'to', jsonb_build_object('userId', u.id, 'name', u.name, 'email', u.email)
  ) AS notice
  FROM waiting w
  JOIN public.users u ON u.id = w.office_user_id
    AND NOT u.is_sample AND NOT u.is_digital_twin AND u.archived_at IS NULL
  WHERE w.sent_on + 5 <= w.d
    AND NOT EXISTS (SELECT 1 FROM public.gc_office_notices n WHERE n.kind = 'certify_late' AND n.pay_app_id = w.pay_app_id)
)
SELECT jsonb_build_object(
  'today', (SELECT d FROM bill),
  'billDay', (SELECT on_d FROM bill),
  'notices', coalesce((
    SELECT jsonb_agg(x.notice ORDER BY x.notice->>'kind', x.notice->>'project', x.notice->>'number')
    FROM (SELECT notice FROM bill_days UNION ALL SELECT notice FROM reminders UNION ALL SELECT notice FROM lates) x
  ), '[]'::jsonb)
);
$$;

COMMENT ON FUNCTION public.get_gc_office_notices_due(date, date) IS
  'GC mode (v2.NNNN, Owner Billing O10a): the office notices due today and not sent yet, for gc-office-notices. bill_day: the 23rd and 24th, a job being built with a signed contract and this bill day''s pay application not sent, to the project manager on the money team, else the company owner, with the trades owing an unconditional waiver on a paid draw. certify_reminder: from the third day after a pay application went uncertified, to the architect, Reply-To the project manager. certify_late: from the fifth, to the same office reader as bill_day. The two on a pay application only for one sent since p_since, else since the switch''s day (gc_office_notices_on_v1 holding a date; none while off). p_today: the day to read for (the bed); the cron passes neither. Service role only.';

REVOKE ALL ON FUNCTION public.get_gc_office_notices_due(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_gc_office_notices_due(date, date) TO service_role;

-- The switch: 'false' until the owner turns it on, after the live walk; on, the day it went on.
INSERT INTO public.app_settings (key, value_text)
VALUES ('gc_office_notices_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "master_or_dev_update_gc_office_notices_on" ON public.app_settings;
CREATE POLICY "master_or_dev_update_gc_office_notices_on"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'gc_office_notices_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'gc_office_notices_on_v1' AND public.is_master_or_dev());

-- Required after every CREATE TABLE: the training-mode write blocks and the digital twins' fence.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
```

## O10a's bed: `supabase/tests/gc_owner_billing/93_office_notices.sql`

The fixture as postgres, its days fixed (October 2026), and the payload read for a named day
(`get_gc_office_notices_due('2026-10-23')`), so the bed never depends on the day it runs: a job being built with a signed contract and its project manager on the
money team; a second whose project manager is an estimator; a third with none; pay applications sent 2, 3 and 5 days
ago, one certified, one final; a paid draw whose unconditional waiver is still owed. Checks:

- **The shape**: the table, its two unique indexes, its money read policy and no write policy; the function the service
  role's alone (`authenticated` and `anon` refused); the switch off, with its key-scoped UPDATE policy.
- **Bill day**: due on the 23rd and the 24th, not the 22nd or the 25th; not for a job bidding, in buyout or without a
  signed contract; not once this bill day's pay application went, nor after the final; gone once its row is written.
  With the waivers owed by company and draw.
- **The office reader**: the money-team project manager; the owner for the estimator's job and for the job with none;
  nobody when the owner is not set.
- **The architect at 3 and the project manager at 5**: due on the day and after, never before; not once certified;
  each once (a second insert skipped by its index); `remindedOn` read from the reminder's row; no reminder without an
  architect, while the project manager's still comes.
- **The on-date** (the lead's rule): with the switch holding a day, a pay application sent the day before hears
  nothing on any later day, and one sent that day hears both; with `'false'`, `'true'` or a word that is not a date,
  no pay application hears; `p_since` reads as given. Bill day still comes with the switch off, for Preview.
- **Who reads the rows**: the money team; an estimator reads none and nobody signed in writes one.
- **The switch**: the owner and a dev flip it; the controller, an estimator and a trainee do not (91_card_switch's
  checks).

Six mutants: the on-date dropped (`a.sent_on >= b.since` taken out: the backlog would fire), the bill-day window
`BETWEEN 0 AND 2` (the 25th would remind), `sent_on + 2` for the architect, the
money team's role check dropped from the project manager's join (an estimator project manager would hear), the unique
index on `(project_id, kind)` (a second pay application's reminder would never go), and the read policy on
`gc_office_team()`.

## O10b, the sender

- **`supabase/functions/gc-office-notices/index.ts`**, `verify_jwt = false` (the cron sends no JWT):
  - cron (no mode, `X-Cron-Secret`): before 8 AM Central, nothing; the switch off, nothing; else the payload, and for
    each notice: resolve the address (the architect's by `customerBillingEmail`; ours from the payload, a real account),
    insert its row (`ON CONFLICT DO NOTHING`; no row back, another tick has it, skip), build the words, send through
    Resend, write `email_send_log_id`, and file the architect's sent copy. Answers what went and what was skipped, and
    why (no address, sent already).
  - `mode: 'preview'` and `mode: 'test_send'`, the caller's JWT on the money team, never a training account or a twin
    (the Monday money email's gate): the payload's notices as they would go, or each one to the caller with `[TEST]`.
    Neither writes a row, files a copy, or reads the switch.
- **`supabase/functions/_shared/gcOfficeNotices.ts`** (pure, tested from vitest): the subject and lines of each kind,
  in plain words; the architect's reminder framed by `buildGcCustomerEmail` (From Click Construction, signed by the
  project manager); the two office ones by the internal frame the Monday email uses, with the press to open **Bill the
  customer** (`/gc?bill=<projectId>`). Words, as drafted:
  - *Bill day for Oak Ridge Clinic is Oct 25. Pay application 4 is ready to draft in Bill the customer.* Then, when
    trades owe one: *Ridgeway Concrete still owes its unconditional waiver on draw 1.*
  - To the architect: *Pay application 3 for Oak Ridge Clinic, for $288,879, went to you on Oct 2 to certify. We have
    not had your certificate yet. Reply here if anything on it needs a change.*
  - *Pay application 3 for Oak Ridge Clinic went to Hart Architects on Oct 2 and still waits on their certificate.* Then
    *We reminded them on Oct 5.* or *They have no email on file, so they were not reminded.*
- **The cron**, its own migration (block below), hourly at :13.
- **Settings → Jobs & billing**: *Email the office's GC notices* (`GcOfficeNoticesSettingsBlock`, the card switch's
  block's shape), for dev and the owner, with **Preview** beside it. Turning it on writes today's date; it then reads
  *On since Oct 15. Only pay applications sent from that day get reminders.* Off writes `'false'`. The parse lives
  once, `gcOfficeNoticesSince` in `_shared/gcOfficeNotices.ts`, for the block and the function.
- **Bill the customer**: a sent pay application waiting on the architect says *We reminded the architect on Oct 5.*
  from the money team's read of `gc_office_notices`.
- Registries: `config.toml`, the email catalog, `docs/EDGE_FUNCTIONS.md` (section and TOC), `docs/REPORT_SUBSCRIPTIONS.md`'s
  stream table (an event stream, its lane), `docs/SENT_COPIES.md` (`gc_certify_reminder`), the dev-mcp catalog, and
  the guide `bill-the-customer-on-a-gc-job` (*The reminders the app sends*).

### O10b's cron SQL (byte for byte at the cut, but for the version and the stamp)

```sql
SET lock_timeout = '3s';

-- GC mode, Owner Billing's O10b (v2.NNNN): gc-office-notices hourly at :13, its own lane (the precedent of
-- bid-followup-reminders, 20261002160000). The function waits for 8 AM office time and does nothing while
-- app_settings gc_office_notices_on_v1 is off. Vault PROJECT_URL and CRON_SECRET, uppercase.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gc-office-notices';

SELECT cron.schedule(
  'gc-office-notices',
  '13 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/gc-office-notices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

The order: O10b's PR merges, the lead deploys `gc-office-notices`, then pushes the cron migration, so no tick finds the
function missing.

## Tests

- O10a: the bed above; `access.test.ts` holds the payload's role list to `GC_MONEY_TEAM`; a test holds its 25 to
  `OWNER_BILL_DAY`; `doors.test.ts` gains `gc_office_notices` (Owner Billing, `money`).
- O10b: `gcOfficeNotices.test.ts` (each kind's words; the waivers line; reminded or no address; the frames; `[TEST]`);
  the function's parse and gates; the Settings block's render; Bill the customer's reminded line.

## The calls this adds

1. **Who hears the office's notices when the project manager is not on the money team**: the company's owner (the
   default), or the project manager without the money (no amount and no waivers in their words).
2. **The bill-day notice says no amount.** The draft's amount is the client's kernel (`ownerPayApp`), which the server
   cannot run yet (the Deno question). The notice names the pay application and opens the window, which shows it.
   The other way is a SQL copy of the draft, a second mapper that drifts.
3. **The architect's reminder carries no form.** The form is drawn in the window (`payAppFile`). The reminder says
   when it went and asks them to reply. The other way waits for the server to draw the form.
4. **Once each, never again.** One reminder to the architect and one notice to us per pay application. The other way
   repeats weekly while it waits.
5. **The customer's notice 3 days before a bill is due** stays out of O10 until the owner says so (see *What it is*).

## Is this the best we can do?

It sends what the README's table promised for the office, with the record that makes each go once, behind a switch,
with a preview. It could be better three ways:

1. **The draft's amount on bill day**, once the kernels run in Deno or the draft is kept on the server, so the notice
   reads *about $288,879*.
2. **The Dashboard's Needs you** could carry the same three as lines, for the office that never opens email. Each
   already shows in its window; a line would bring them to the front.
3. **One notices stream for the whole of GC mode.** Building's and the Portal's tables in the README want the same
   machinery: a record written before the send, a payload, a switch and a preview. `gc_office_notices` could take
   their kinds later rather than each lane making its own.
