import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const token = env.SUPABASE_MGMT_TOKEN, ref = 'yewfzhbofbbyvkvtaatw'
export async function q(name, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body: JSON.stringify({query}) })
  const text = await res.text(); let out = text
  try { const j = JSON.parse(text); out = Array.isArray(j) ? JSON.stringify(j) : (j.message || text) } catch {}
  console.log(`\n[${name}] HTTP ${res.status}\n${String(out).slice(0, 700)}`)
}
export const P = 'ef8905d1-039a-4cbc-9d69-9468cfea50e0'
export const ASK = '115b6971-ee16-4459-9340-85fc35d5c1e3'
export const CO = 'ff11d0fb-269e-44de-b92a-e7256c180f67'
export const asRole = (role) => `SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM public.users WHERE role = '${role}' AND NOT coalesce(read_only,false) ORDER BY created_at LIMIT 1), 'role', 'authenticated')::text, true); SET LOCAL ROLE authenticated;`
export const asTrainee = `SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) FROM public.users WHERE read_only LIMIT 1; SET LOCAL ROLE authenticated;`
