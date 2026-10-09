import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const token = env.SUPABASE_MGMT_TOKEN, ref = 'yewfzhbofbbyvkvtaatw'
async function q(name, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body: JSON.stringify({query}) })
  const text = await res.text(); let out = text
  try { const j = JSON.parse(text); out = Array.isArray(j) ? JSON.stringify(j) : (j.message || text) } catch {}
  console.log(`\n[${name}] HTTP ${res.status}\n${String(out).slice(0, 500)}`)
}
const asDev = `SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM public.users WHERE role = 'dev' AND NOT coalesce(read_only,false) ORDER BY created_at LIMIT 1), 'role', 'authenticated')::text, true); SET LOCAL ROLE authenticated;`
await q('asks and their quotes', `SELECT i.id, i.project_id, (SELECT count(*) FROM public.gc_quotes qq WHERE qq.invite_id = i.id) AS quotes FROM public.gc_invites i WHERE i.id IN ('115b6971-ee16-4459-9340-85fc35d5c1e3','67b19cf7-32db-4567-b270-89442bf73a67');`)
await q('gate on the quote-less ask (expect refusal)', `BEGIN; ${asDev} SELECT public.gc_award('67b19cf7-32db-4567-b270-89442bf73a67'); ROLLBACK;`)
await q('the drafted SOW inside a rolled-back award (read, then rollback)', `BEGIN; ${asDev} SELECT public.gc_award('115b6971-ee16-4459-9340-85fc35d5c1e3') AS sow; SELECT s.status, s.price, s.retainage_pct, (SELECT count(*) FROM public.gc_sow_lines l WHERE l.sow_id = s.id) AS lines FROM public.gc_sows s; ROLLBACK;`)
await q('after: nothing kept', `SELECT (SELECT count(*) FROM public.gc_sows) AS sows, (SELECT count(*) FROM public.gc_trade_packages WHERE awarded_invite_id IS NOT NULL) AS awarded;`)
