import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const token = env.SUPABASE_MGMT_TOKEN, ref = 'yewfzhbofbbyvkvtaatw'
async function q(name, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body: JSON.stringify({query}) })
  const text = await res.text(); let out = text
  try { const j = JSON.parse(text); out = Array.isArray(j) ? JSON.stringify(j) : (j.message || text) } catch {}
  console.log(`\n[${name}] HTTP ${res.status}\n${String(out).slice(0, 700)}`)
}
const P = 'ef8905d1-039a-4cbc-9d69-9468cfea50e0'
const asDev = `SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) FROM public.users WHERE role = 'dev' AND NOT coalesce(read_only,false) ORDER BY created_at LIMIT 1; SET LOCAL ROLE authenticated;`
const sign = `SELECT public.gc_sign_owner_contract('${P}', public.app_today(), (SELECT jsonb_object_agg(id::text, 10000) FROM public.gc_trade_packages WHERE project_id = '${P}') || '{"gc": 5000, "contingency": 1000, "fee": 2000}'::jsonb);`
const send = `CREATE TEMP TABLE v AS SELECT public.gc_send_owner_pay_app('${P}', jsonb_build_object('number', 1, 'final', false, 'periodTo', public.app_today(), 'sentOn', public.app_today(), 'retainagePct', 10, 'retainageStep', NULL, 'workToDate', 1000 * n, 'retainage', 100 * n, 'due', 900 * n, 'lines', lines)) AS pa, n FROM (SELECT count(*) AS n, jsonb_agg(jsonb_build_object('line', 'trade', 'packageId', id, 'label', trade, 'worth', 10000, 'doneToDate', 1000, 'stored', 0) ORDER BY position) AS lines FROM public.gc_trade_packages WHERE project_id = '${P}') t;`
const cert = `CREATE TEMP TABLE c AS SELECT public.gc_record_certificate((SELECT pa FROM v), (SELECT 900 * n FROM v), public.app_today(), '') AS bill;`
await q('1 type once, billing-only', `SELECT count(*), bool_and(billing_only) FROM public.service_types WHERE name = 'General contracting';`)
await q('2 columns, trigger, grants', `SELECT (SELECT count(*) FROM information_schema.columns WHERE table_name='gc_owner_pay_apps' AND column_name IN ('invoice_id','conditional_waiver_id')) AS pa_cols, (SELECT count(*) FROM information_schema.columns WHERE table_name='gc_owner_interest_bills' AND column_name='invoice_id') AS ib_cols, (SELECT count(*) FROM pg_trigger WHERE tgname = 'gc_owner_pay_apps_links_once') AS trg, has_column_privilege('authenticated', 'public.gc_owner_pay_apps', 'invoice_id', 'UPDATE') AS inv_upd, has_column_privilege('authenticated', 'public.gc_owner_pay_apps', 'due', 'UPDATE') AS due_upd;`)
await q('3+4 send, job, certificate, bill (rolled back)', `BEGIN; ${asDev} ${sign} ${send} ${cert}
SELECT (SELECT pa FROM v) IS NOT NULL AS sent, j.billing_only, j.status, j.customer_name AS customer, j.project_id, (SELECT name FROM public.service_types WHERE id = j.service_type_id) AS type, j.revenue = public.gc_owner_contract_now('${P}') AS revenue_is_contract,
  (SELECT bill FROM c) IS NOT NULL AS certified, i.status AS bill_status, i.amount AS bill_amount, (i.billed_at AT TIME ZONE 'America/Chicago')::text AS billed_at_central, (p.invoice_id = (SELECT bill FROM c)) AS pa_links_bill
FROM public.gc_projects g JOIN public.jobs_ledger j ON j.id = g.billing_job_id
LEFT JOIN public.gc_owner_pay_apps p ON p.id = (SELECT pa FROM v)
LEFT JOIN public.jobs_ledger_invoices i ON i.id = (SELECT bill FROM c)
WHERE g.project_id = '${P}'; ROLLBACK;`)
await q('5a certificate again refused', `BEGIN; ${asDev} ${sign} ${send} ${cert} SELECT public.gc_record_certificate((SELECT pa FROM v), 1, public.app_today(), ''); ROLLBACK;`)
await q('5b clearing the bill link refused', `BEGIN; ${asDev} ${sign} ${send} ${cert} UPDATE public.gc_owner_pay_apps SET invoice_id = NULL WHERE id = (SELECT pa FROM v); ROLLBACK;`)
await q('after: nothing kept', `SELECT (SELECT count(*) FROM public.gc_owner_pay_apps) AS pay_apps, (SELECT billing_job_id FROM public.gc_projects WHERE project_id='${P}') AS billing_job, (SELECT count(*) FROM public.jobs_ledger WHERE billing_only) AS billing_jobs;`)
