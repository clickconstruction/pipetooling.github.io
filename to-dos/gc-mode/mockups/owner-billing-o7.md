---
name: "GC mode, Owner Billing O7: closeout with the customer, and the Monday email"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 9, O7, and PR 10, O7b)
status: planned 2026-10-08 by Helper 5 at the lead's ask · O7a's SQL tested on a local Postgres 15 · every piece waits on O4a, marked below · O7a built (v2.5019), its SQL as built below word for word (Helper 15, 2026-10-09)
---

# O7: closeout with the customer, and the Monday email

The plan's O7 has four parts:
- **Accept the work**, recorded by the office;
- our **final pay application** for what the customer holds;
- our **waivers on final payment**;
- **the Monday email** to the money team.

The plan's O7b is the customer portal's own presses. This mockup splits them into three PRs. Every one waits on O4a: there is no closeout before there are bills.

| PR | What | Waits on |
|---|---|---|
| **O7a** | `gc_record_acceptance`, the keep-the-acceptance guard, and **Closeout** in Bill the customer (the steps, Accept the work, Send the final pay application, our waivers on final payment) | O4a (the bills and Send); O5c for the unconditional waiver; Building's U6 for the trades' step |
| **O7b** | The Monday email: `gc-money-monday-email`, a Report Subscriptions stream for the money team | O4a (nothing to say before bills); the six weeks line, `cashAhead` server side, its own PR |
| **O7c** | The customer portal's **Accept the work** and **Sign** / **Decline** on a change order, through `submit-portal-request` | O7a; Helper 3 owns the trade portal, and this is the customer portal (the Pipeline's `customer-portal`) |

## The closeout, step by step

`ownerCloseout` is on main (O2b). It has six steps, and each says who moves it. What each one needs on real data:

| Step | Who | Reads | Waits on |
|---|---|---|---|
| Every line billed | office | The last progress pay application's work so far against the contract (`ownerAllBilled`) | O4a |
| Every trade's final pay application | trades | Each trade's signed statement of work and its final draw (`tradeCloseout`) | **Building's U6.** On main every trade has `sow: null`, so this step reads "has no signed statement of work" for each trade. |
| The customer accepts the work | customer | `gc_owner_acceptances` (O1), through O7a | O7a |
| Our final pay application | office | `ownerFinalPayAppToSend`: every line done, nothing held, it asks for the rest | O4a's `gc_send_owner_pay_app`, which already takes `final` and refuses it before the acceptance |
| The architect certifies it | architect | O4a's certificate | O4a |
| They pay it | customer | The final bill's payments on the billing job | O5c |

`canSendFinal` needs all three: every line billed, every trade's final, and the acceptance. Until U6, no GC job can send its final from the window. **The call:** the kernel keeps that order (the trades' retainage is paid from ours), and I recommend keeping it. The other way is a "this trade closed out off the app" mark per trade, which is U6's to decide with Helper 4.

## O7a: the acceptance (SQL, byte for byte)

Its stamp is claimed at the cut, after O4a-1's.

```sql
SET lock_timeout = '3s';

-- The customer accepts the work (decision 5): the office records it here, their portal's Accept the work
-- calls it as the service role with how = 'portal' (O7c). Only once every line is billed: the last progress
-- pay application's work so far covers the contract today (the kernel's ownerAllBilled, checked in the
-- client too). Our final pay application waits for it (gc_send_owner_pay_app already refuses before).
CREATE OR REPLACE FUNCTION public.gc_record_acceptance(p_project_id uuid, p_on date, p_by_name text, p_how text DEFAULT 'office', p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_gc public.gc_projects%ROWTYPE;
  v_on date;
  v_work numeric;
BEGIN
  IF p_how = 'portal' AND current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Only the customer''s portal records an acceptance as theirs.';
  END IF;
  IF p_how = 'office' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to record that they accepted the work.';
  END IF;
  IF p_how IS NULL OR p_how NOT IN ('office', 'portal') THEN
    RAISE EXCEPTION 'They accept the work at the office or in their portal.';
  END IF;
  SELECT * INTO v_gc FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.';
  END IF;
  IF v_gc.stage = 'bidding' OR v_gc.lost_on IS NOT NULL THEN
    RAISE EXCEPTION 'Only a job we won is accepted.';
  END IF;
  SELECT accepted_on INTO v_on FROM public.gc_owner_acceptances WHERE project_id = p_project_id;
  IF FOUND THEN
    RAISE EXCEPTION 'They accepted the work on %.', to_char(v_on, 'Mon FMDD');
  END IF;
  IF p_on IS NULL OR p_on > public.app_today() THEN
    RAISE EXCEPTION 'Pick the day they accepted it. It cannot be still to come.';
  END IF;
  IF btrim(COALESCE(p_by_name, '')) = '' THEN
    RAISE EXCEPTION 'Say who walked it and accepted it.';
  END IF;
  SELECT work_to_date INTO v_work FROM public.gc_owner_pay_apps
  WHERE project_id = p_project_id AND NOT final ORDER BY number DESC LIMIT 1;
  IF v_work IS NULL OR v_work < public.gc_owner_contract_now(p_project_id) - 0.5 THEN
    RAISE EXCEPTION 'Bill every line first. They accept the work once our pay applications have billed all of it.';
  END IF;
  INSERT INTO public.gc_owner_acceptances (project_id, accepted_on, accepted_by_name, how, note)
  VALUES (p_project_id, p_on, btrim(p_by_name), p_how, btrim(COALESCE(p_note, '')));
END;
$$;

COMMENT ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) IS
  'GC mode (O7a): the customer accepts the work on a GC project, as the office records it (how = office) or their portal presses it (how = portal, the service role only). Once, and only when every line is billed. Our final pay application waits for it. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) TO authenticated, service_role;

-- An acceptance stays once our final pay application went on it; before that the office may fix a
-- mistake (dev only today, by RLS). The project's cascade passes.
CREATE OR REPLACE FUNCTION public.gc_owner_acceptances_keep()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() <= 1 AND EXISTS (SELECT 1 FROM public.gc_owner_pay_apps WHERE project_id = OLD.project_id AND final) THEN
    RAISE EXCEPTION 'Our final pay application went on this acceptance, so it stays.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS gc_owner_acceptances_keep ON public.gc_owner_acceptances;
CREATE TRIGGER gc_owner_acceptances_keep
  BEFORE UPDATE OR DELETE ON public.gc_owner_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.gc_owner_acceptances_keep();
```

**Checked on a local Postgres 15** (2026-10-08). The run had O1's, O3's and O4a-1's migrations, the same stand-ins as O4a's, and a `service_role` role:
- **Refusals**, each in its words:
  - part billed: one pay application at 54,000 of 180,900;
  - a day still to come;
  - no name;
  - a project that is not there;
  - `how = 'portal'` from a signed-in user.
- **The final waits:** before the acceptance, `gc_send_owner_pay_app` refused the final.
- **Accepted** after pay application 2 billed all 180,900. It was recorded as office, by the dev, with the name trimmed and the note.
  - A second acceptance was refused: *They accepted the work on Oct 26.*
  - Fixing its note before the final was allowed.
- **After the final:** it went, retainage 0, asking for the 18,090 held. Then deleting or moving the acceptance was refused: *Our final pay application went on this acceptance, so it stays.*
- **The portal path** as the service role passed the portal gate and stopped at the billing check, as it should on a job with nothing billed.
- **The project deleted** took its acceptance.

### O7a's SQL as built (Helper 15, 2026-10-09)

The migration `20261009230000_gc_record_acceptance.sql`, word for word, for the byte-for-byte compare. It is the SQL above with one comment changed, the keep trigger's: the money team may fix a mistake before the final (the Owner Billing door's policy), where it said the office, dev only by RLS. The Owner Billing SQL bed's `40_closeout.sql` runs the checks above against every migration on GitHub's runners: 19 checks passed on 2026-10-09.

```sql
SET lock_timeout = '3s';

-- The customer accepts the work (decision 5): the office records it here, their portal's Accept the work
-- calls it as the service role with how = 'portal' (O7c). Only once every line is billed: the last progress
-- pay application's work so far covers the contract today (the kernel's ownerAllBilled, checked in the
-- client too). Our final pay application waits for it (gc_send_owner_pay_app already refuses before).
CREATE OR REPLACE FUNCTION public.gc_record_acceptance(p_project_id uuid, p_on date, p_by_name text, p_how text DEFAULT 'office', p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_gc public.gc_projects%ROWTYPE;
  v_on date;
  v_work numeric;
BEGIN
  IF p_how = 'portal' AND current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Only the customer''s portal records an acceptance as theirs.';
  END IF;
  IF p_how = 'office' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to record that they accepted the work.';
  END IF;
  IF p_how IS NULL OR p_how NOT IN ('office', 'portal') THEN
    RAISE EXCEPTION 'They accept the work at the office or in their portal.';
  END IF;
  SELECT * INTO v_gc FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.';
  END IF;
  IF v_gc.stage = 'bidding' OR v_gc.lost_on IS NOT NULL THEN
    RAISE EXCEPTION 'Only a job we won is accepted.';
  END IF;
  SELECT accepted_on INTO v_on FROM public.gc_owner_acceptances WHERE project_id = p_project_id;
  IF FOUND THEN
    RAISE EXCEPTION 'They accepted the work on %.', to_char(v_on, 'Mon FMDD');
  END IF;
  IF p_on IS NULL OR p_on > public.app_today() THEN
    RAISE EXCEPTION 'Pick the day they accepted it. It cannot be still to come.';
  END IF;
  IF btrim(COALESCE(p_by_name, '')) = '' THEN
    RAISE EXCEPTION 'Say who walked it and accepted it.';
  END IF;
  SELECT work_to_date INTO v_work FROM public.gc_owner_pay_apps
  WHERE project_id = p_project_id AND NOT final ORDER BY number DESC LIMIT 1;
  IF v_work IS NULL OR v_work < public.gc_owner_contract_now(p_project_id) - 0.5 THEN
    RAISE EXCEPTION 'Bill every line first. They accept the work once our pay applications have billed all of it.';
  END IF;
  INSERT INTO public.gc_owner_acceptances (project_id, accepted_on, accepted_by_name, how, note)
  VALUES (p_project_id, p_on, btrim(p_by_name), p_how, btrim(COALESCE(p_note, '')));
END;
$$;

COMMENT ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) IS
  'GC mode (O7a): the customer accepts the work on a GC project, as the office records it (how = office) or their portal presses it (how = portal, the service role only). Once, and only when every line is billed. Our final pay application waits for it. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_record_acceptance(uuid, date, text, text, text) TO authenticated, service_role;

-- An acceptance stays once our final pay application went on it; before that the money team may fix a
-- mistake (the Owner Billing door's policy). The project's cascade passes.
CREATE OR REPLACE FUNCTION public.gc_owner_acceptances_keep()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() <= 1 AND EXISTS (SELECT 1 FROM public.gc_owner_pay_apps WHERE project_id = OLD.project_id AND final) THEN
    RAISE EXCEPTION 'Our final pay application went on this acceptance, so it stays.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS gc_owner_acceptances_keep ON public.gc_owner_acceptances;
CREATE TRIGGER gc_owner_acceptances_keep
  BEFORE UPDATE OR DELETE ON public.gc_owner_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.gc_owner_acceptances_keep();
```

## O7a: Closeout in Bill the customer (the window)

Below the sent pay applications, once every line is billed or the final went, the way the prototype's Bill the owner tab draws it:
- **The six steps** from `ownerCloseout`, each with who moves it and its words, and the first not done marked next. The trades' step lists `tradesWaiting`, each with what still stands in the way.
- **Accept the work** (when `canAccept`): the day, who walked it and a note. Its guide words: "the customer walks the job and accepts it."
- **Send the final pay application** (when `canSendFinal`): `ownerFinalPayAppToSend`'s record through the same payload as Send (`payAppSendPayload` takes `final`), with our **conditional waiver on final payment** through O4a-4's modal on `conditional_final`, asking for what they hold.
- **Our unconditional waiver on final payment**, once the final bill is paid. That is O5c: the Pipeline's follow-up (`unconditionalFollowUpForm`) on the billing job.

Guide: `close-out-a-gc-job-with-the-customer.md`. Docs: `BILLING_FLOWS.md` → *GC mode* gains the final bill. `GLOSSARY.md` needs no new word; acceptance is in the plan's words.

## O7b: the Monday email

The plan wants one line Monday morning, to the owner and the controller: *We go down to $39,272 carrying the week of Oct 12.* That line is `cashAhead` with the late money not counted. `cashAhead` lives in `src/lib/gc`, which an edge function cannot import. Moving it to `supabase/functions/_shared` would take most of `ownerBilling*.ts` with it.

**What O7b can say from SQL alone, and does:**
- who owes us, by job: the certified bills open on each billing job (`jobs_ledger_invoices` less `jobs_ledger_payments`), late past `owner_pay_days`;
- what waits on the architect (`gc_owner_pay_apps` with no certificate);
- what went last week (sent and certified);
- **Open Money**, a link to the lens.

**The six weeks line** comes with its own PR, once U6's draws make the weeks worth trusting. That PR moves `cashAhead` and what it reads to `_shared`, or has the client store a weekly snapshot the email reads.

**The house pattern, like `weekly-money-email-dispatch`:**
- **The function:** `gc-money-monday-email`, cron only (`X-Cron-Secret`), with `[functions.gc-money-monday-email] verify_jwt = false` in `config.toml`. Without that block the gateway refuses the cron, the v2.4817 outage.
- **Its data:** a payload function `get_gc_money_monday_payload()`, SECURITY DEFINER and service role only, rendered by `render.ts`.
- **The cron:** its own minute lane, per the stagger rule (`20260821010000`), with the uppercase Vault names.
- **The recipients:** `gc_money_team()`, the owner and the controller, and dev.
- **The record:** `logEmailSendBestEffort`. It is an internal email, so no sent copy.
- **Docs:** `docs/EDGE_FUNCTIONS.md` and `docs/REPORT_SUBSCRIPTIONS.md` (its stream and lane). The lead deploys it, and its first send goes to the lead's address on the owner's yes.

**The call:** a Report Subscriptions stream, so the owner and the controller subscribe and pick the day the way they do the weekly money report, or a fixed Monday 7 am cron to the money team. I recommend the stream: it is the app's way, and it lets the controller turn it off.

## O7c: the customer's own presses

The customer portal (`customer-portal`, the Pipeline's) shows a GC job's change orders to sign and **Accept the work**. `submit-portal-request` gains two kinds:
- `gc_change_order_answer` calls O3's `gc_answer_change_order` with `p_how = 'portal'`;
- `gc_accept_work` calls O7a's `gc_record_acceptance` with `how = 'portal'`.

Both run as the service role, checked against the portal link's customer (`projects.customer_id`). The office sees the answer in Change orders and Closeout with "in their portal". The lead deploys both functions. Each gets a journey step and an answer in `personJourney.ts` (HANDOFF's list), since the customer sees new words.

## The calls this adds

1. **Our final pay application waits for every trade's final** (the kernel's order). Keep it, my recommendation, or add a per-trade "closed out off the app" mark with U6.
2. **The Monday email's first cut leaves out the six weeks line** until `cashAhead` can run on the server.
3. **The Monday email as a Report Subscriptions stream** (my recommendation) or a fixed cron.
