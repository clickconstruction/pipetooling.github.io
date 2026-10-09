import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const token = env.SUPABASE_MGMT_TOKEN
const ref = 'yewfzhbofbbyvkvtaatw'
async function q(name, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body: JSON.stringify({query}) })
  const text = await res.text()
  let out = text; try { const j = JSON.parse(text); out = Array.isArray(j) ? JSON.stringify(j) : (j.message || text) } catch {}
  console.log(`\n[${name}] HTTP ${res.status}\n${String(out).slice(0, 400)}`)
}
const asDev = `SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) FROM public.users WHERE role = 'dev' AND NOT coalesce(read_only,false) ORDER BY created_at LIMIT 1; SET LOCAL ROLE authenticated;`
await q('1 function + privileges', `SELECT p.proname, p.prosecdef AS definer, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public' WHERE p.proname = 'gc_save_daily_log';`)
await q('2a unknown project', `BEGIN; ${asDev} SELECT public.gc_save_daily_log('{"projectId":"00000000-0000-0000-0000-000000000001","date":"2026-10-08","today":"2026-10-08"}'::jsonb); ROLLBACK;`)
await q('2b bidding project', `BEGIN; ${asDev} SELECT public.gc_save_daily_log('{"projectId":"c4117b0d-0c64-4935-933f-01bd96bfef60","date":"2026-10-08","today":"2026-10-08"}'::jsonb); ROLLBACK;`)
await q('2c today two days ahead', `BEGIN; ${asDev} SELECT public.gc_save_daily_log(jsonb_build_object('projectId','ef8905d1-039a-4cbc-9d69-9468cfea50e0','date',(current_date+2)::text,'today',(current_date+2)::text)); ROLLBACK;`)
await q('4 training account', `BEGIN; SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) FROM public.users WHERE read_only LIMIT 1; SET LOCAL ROLE authenticated; SELECT public.gc_save_daily_log('{"projectId":"ef8905d1-039a-4cbc-9d69-9468cfea50e0","date":"2026-10-08","today":"2026-10-08"}'::jsonb); ROLLBACK;`)
await q('rows after (expect 0 logs)', `SELECT (SELECT count(*) FROM public.gc_daily_logs) AS logs, (SELECT count(*) FROM public.users WHERE read_only) AS training_users;`)
