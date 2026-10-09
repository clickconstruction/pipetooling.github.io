import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const token = env.SUPABASE_MGMT_TOKEN, ref = 'yewfzhbofbbyvkvtaatw'
async function q(name, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body: JSON.stringify({query}) })
  const text = await res.text(); let out = text
  try { const j = JSON.parse(text); out = Array.isArray(j) ? JSON.stringify(j) : (j.message || text) } catch {}
  console.log(`\n[${name}] HTTP ${res.status}\n${String(out).slice(0, 600)}`)
}
const asDev = `SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM public.users WHERE role = 'dev' AND NOT coalesce(read_only,false) ORDER BY created_at LIMIT 1), 'role', 'authenticated')::text, true); SET LOCAL ROLE authenticated;`
// 140000
await q('140000/1 columns gone', `SELECT count(*) AS left_over FROM information_schema.columns WHERE table_schema='public' AND table_name='gc_projects' AND column_name IN ('general_conditions','contingency_pct','fee_pct');`)
await q('140000/2 policies', `SELECT polrelid::regclass::text AS t, string_agg(polname, ',' ORDER BY polname) AS pols FROM pg_policy WHERE polrelid IN ('public.gc_sows'::regclass,'public.gc_sow_lines'::regclass) GROUP BY 1 ORDER BY 1;`)
await q('140000/3a leveled (expect null)', `BEGIN; ${asDev} SELECT public.gc_leveled_total('115b6971-ee16-4459-9340-85fc35d5c1e3') AS leveled; ROLLBACK;`)
await q('140000/3b award refused', `BEGIN; ${asDev} SELECT public.gc_award('115b6971-ee16-4459-9340-85fc35d5c1e3'); ROLLBACK;`)
await q('140000/4 consent check', `SELECT pg_get_constraintdef(oid) LIKE '%''gc_sow''%' AS takes_gc_sow FROM pg_constraint WHERE conname = 'esign_consents_record_type_check';`)
// 210000
await q('210000/1 function once, invoker, anon', `SELECT count(*), bool_and(NOT prosecdef) AS invoker, has_function_privilege('anon','public.gc_remind_customer_to_pay(uuid, date, date, text, text, text[])','EXECUTE') AS anon_can FROM pg_proc WHERE proname = 'gc_remind_customer_to_pay';`)
await q('210000/2 refusal', `BEGIN; ${asDev} SELECT public.gc_remind_customer_to_pay('00000000-0000-0000-0000-000000000001', public.app_today(), public.app_today() + 5, '', 'x', ARRAY['y']); ROLLBACK;`)
// 220000
await q('220000/1 functions once, invoker, anon', `SELECT count(*), bool_and(NOT prosecdef) AS invoker, bool_or(has_function_privilege('anon', oid, 'EXECUTE')) AS anon_can FROM pg_proc WHERE proname IN ('gc_owner_billing_revenue','gc_send_owner_interest_bill');`)
await q('220000/2 restated carry the helper', `SELECT proname, prosrc LIKE '%gc_owner_billing_revenue%' AS carries FROM pg_proc WHERE proname IN ('gc_send_owner_pay_app','gc_record_certificate') ORDER BY 1;`)
await q('220000/3 revenue unchanged', `SELECT count(*) AS billing_jobs, count(*) FILTER (WHERE j.revenue = public.gc_owner_contract_now(g.project_id)) AS at_contract, (SELECT count(*) FROM public.gc_owner_interest_bills) AS interest_bills FROM public.gc_projects g JOIN public.jobs_ledger j ON j.id = g.billing_job_id;`)
await q('after: nothing kept', `SELECT (SELECT count(*) FROM public.gc_sows) AS sows, (SELECT count(*) FROM public.gc_owner_pay_reminders) AS reminders;`)
