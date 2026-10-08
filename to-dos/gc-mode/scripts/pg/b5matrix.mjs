/**
 * The Board's B5-a role matrix (Helper 2, 2026-10-08): gc_project_money, the carry columns, the bid tabs
 * and the gc_mark_* functions, read and written by one user of each role as `authenticated`, on PGlite.
 * It loads the real training-mode and twin blocks from their own migrations (is_read_only,
 * is_digital_twin, block_if_read_only, apply_read_only_write_blocks, apply_read_only_stmt_blocks,
 * apply_digital_twin_write_blocks), then the GC chain through B1 and B5-a.
 *
 * Run it from a scratch folder, never the repo:
 *   mkdir /tmp/pg && cd /tmp/pg && npm init -y && npm i @electric-sql/pglite
 *   cp <repo>/to-dos/gc-mode/scripts/pg/b5matrix.mjs . && node b5matrix.mjs <repo root> out.txt
 * Gotchas: clear test.uid after each role, or the training-mode statement trigger blocks the cleanup;
 * once a file name crashed the wasm ("unreachable") while an identical copy ran, so copy it under a new name.
 * For another door, swap the roles' policy (gc_office_team, gc_money_team) and the tables in the loop.
 */
import { PGlite } from '@electric-sql/pglite'
import fs from 'fs'
const [repo] = process.argv.slice(2)
const mig = (f) => fs.readFileSync(`${repo}/supabase/migrations/${f}`, 'utf8')
/** One function's CREATE … $tag$; block, as the file writes it. */
const fn = (file, name) => {
  const s = mig(file)
  const i = s.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  if (i < 0) throw new Error(`${name} not in ${file}`)
  const tag = s.slice(i).match(/AS (\$[a-z]*\$)/)[1]
  const open = s.indexOf(tag, i) + tag.length
  const close = s.indexOf(tag, open) + tag.length
  return s.slice(i, close) + ';'
}
const db = new PGlite()
const log = []
const say = (...a) => { log.push(a.join(' ')); }
await db.exec(`
CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
CREATE TABLE public.users (id uuid PRIMARY KEY, role text, read_only boolean NOT NULL DEFAULT false, is_digital_twin boolean NOT NULL DEFAULT false);
CREATE TABLE public.customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
CREATE TABLE public.projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, customer_id uuid);
CREATE TABLE public.bids (id uuid PRIMARY KEY DEFAULT gen_random_uuid()); CREATE TABLE public.email_send_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE FUNCTION public.is_dev() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev') $$;
CREATE FUNCTION public.app_today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT current_date - 1 $$;
CREATE FUNCTION public.gc_office_team() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev','master_technician','assistant','controller','estimator')) $$;
`)
// The real training-mode and twin blocks, from their own migrations.
await db.exec(fn('20260713090000_read_only_training_mode.sql', 'is_read_only'))
await db.exec(fn('20260828070000_digital_twin_write_fence.sql', 'is_digital_twin'))
await db.exec(fn('20260713090000_read_only_training_mode.sql', 'apply_read_only_write_blocks'))
await db.exec(fn('20260717000000_read_only_all_roles_and_rpc_block.sql', 'block_if_read_only'))
await db.exec(fn('20260814185815_read_only_stmt_blocks_skip_existing.sql', 'apply_read_only_stmt_blocks'))
await db.exec(fn('20261005222937_twin_fence_skip_existing.sql', 'apply_digital_twin_write_blocks'))
for (const m of ['20261006233000_gc_projects_trades_scope.sql', '20261006234000_gc_plan_sets_questions.sql', '20261007210000_gc_schedule_tables.sql', '20261007220000_gc_schedule_moves_records.sql', '20261008020000_gc_company_record.sql']) await db.exec(mig(m))
// Door 1's team policy on gc_projects and gc_trade_packages (the rest of door 1 touches tables this test has no use for).
await db.exec(`
DROP POLICY IF EXISTS gc_projects_dev ON public.gc_projects; CREATE POLICY gc_projects_team ON public.gc_projects FOR ALL TO authenticated USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));
DROP POLICY IF EXISTS gc_trade_packages_dev ON public.gc_trade_packages; CREATE POLICY gc_trade_packages_team ON public.gc_trade_packages FOR ALL TO authenticated USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));
`)
// Today's state: a project whose three values someone typed (prod's are 0; a non-zero row proves the copy).
const [{ id: proj }] = (await db.query(`INSERT INTO projects (name) VALUES ('GC test project') RETURNING id`)).rows
await db.query(`INSERT INTO gc_projects (project_id, general_conditions, contingency_pct, fee_pct) VALUES ($1, 12000, 3, 8)`, [proj])
const [{ id: proj2 }] = (await db.query(`INSERT INTO projects (name) VALUES ('Second test project') RETURNING id`)).rows
await db.query(`INSERT INTO gc_projects (project_id) VALUES ($1)`, [proj2])
const b5 = mig('20261008130000_gc_our_number.sql')
await db.exec(b5); await db.exec(b5)
say('applied twice')
say('backfill', JSON.stringify((await db.query(`SELECT general_conditions::text gc, contingency_pct::text c, fee_pct::text f FROM gc_project_money WHERE project_id = $1`, [proj])).rows[0]))
say('blocks on gc_project_money', (await db.query(`SELECT count(*)::int n FROM pg_policies WHERE tablename = 'gc_project_money' AND policyname <> 'gc_project_money_team'`)).rows[0].n, 'policies,', (await db.query(`SELECT count(*)::int n FROM pg_trigger WHERE tgrelid = 'public.gc_project_money'::regclass AND tgname = 'read_only_block_stmt'`)).rows[0].n, 'stmt trigger')
await db.exec(`GRANT USAGE ON SCHEMA public TO authenticated, anon; GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;`)
// One shared bid tab, so its column tells a dev from everyone else.
const [{ id: roofing }] = (await db.query(`INSERT INTO gc_trade_packages (project_id, trade) VALUES ($1, 'Roofing') RETURNING id`, [proj2])).rows
await db.query(`INSERT INTO gc_bid_tabs (package_id) VALUES ($1)`, [roofing])
// The cast: one user per role.
const people = [
  ['dev', false, false], ['master_technician', false, false], ['controller', false, false],
  ['assistant', false, false], ['estimator', false, false], ['superintendent', false, false],
  ['primary', false, false], ['subcontractor', false, false], ['helpers', false, false],
  ['controller', true, false], ['estimator', true, false], ['estimator', false, true],
]
let n = 0
const rows = []
for (const [role, ro, twin] of people) {
  n += 1
  const id = `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
  await db.query(`INSERT INTO users VALUES ($1, $2, $3, $4)`, [id, role, ro, twin])
  const who = `${role}${ro ? ' (training mode)' : ''}${twin ? ' (digital twin)' : ''}`
  const as = async (sql, params = []) => {
    await db.exec(`SELECT set_config('test.uid', '${id}', false); SET ROLE authenticated;`)
    try { return { ok: true, rows: (await db.query(sql, params)).rows } } catch (e) { return { ok: false, err: e.message } } finally { await db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`) }
  }
  const read = await as(`SELECT count(*)::int n FROM gc_project_money`)
  const write = await as(`UPDATE gc_project_money SET fee_pct = 9 WHERE project_id = $1 RETURNING project_id`, [proj])
  const insert = await as(`INSERT INTO gc_project_money (project_id, fee_pct) VALUES ($1, 5) ON CONFLICT (project_id) DO UPDATE SET fee_pct = 5 RETURNING project_id`, [proj2])
  const sent = await as(`SELECT public.gc_mark_bid_sent($1)`, [proj2])
  const tabs = await as(`SELECT count(*)::int n FROM gc_bid_tabs`)
  const r = (x, kind) => (x.ok ? (kind === 'read' ? `${x.rows[0].n} rows` : x.rows.length ? 'wrote' : 'no row changed') : `refused: ${x.err.slice(0, 60)}`)
  rows.push([who, r(read, 'read'), r(write), r(insert), sent.ok ? 'marked' : `refused: ${sent.err.slice(0, 50)}`, tabs.ok ? `${tabs.rows[0].n} rows` : 'refused'])
  // Put the fee back so the next role starts the same.
  await db.query(`UPDATE gc_project_money SET fee_pct = 8 WHERE project_id = $1`, [proj])
  await db.query(`UPDATE gc_projects SET our_bid_sent_on = NULL WHERE project_id = $1`, [proj2])
  await db.query(`DELETE FROM gc_project_money WHERE project_id = $1`, [proj2])
}
// anon: no grants on the table at all.
await db.exec(`SET ROLE anon`)
let anon
try { anon = `${(await db.query(`SELECT count(*)::int n FROM gc_project_money`)).rows[0].n} rows` } catch (e) { anon = `refused: ${e.message.slice(0, 50)}` }
await db.exec('RESET ROLE')
rows.push(['anon', anon, '-', '-', '-', '-'])
say('| Who | Reads gc_project_money | Updates it | Inserts | gc_mark_bid_sent | Reads gc_bid_tabs |')
say('|---|---|---|---|---|---|')
for (const r of rows) say(`| ${r.join(' | ')} |`)
// The outcome functions and carry, as a dev.
await db.exec(`SELECT set_config('test.uid', '00000000-0000-0000-0000-000000000001', false)`)
const tryq = async (label, sql, params) => { try { say('ok  ', label, JSON.stringify((await db.query(sql, params)).rows).slice(0, 140)) } catch (e) { say('ERR ', label, '→', e.message) } }
await tryq('mark sent', `SELECT gc_mark_bid_sent($1)`, [proj])
await tryq('sent on is the company day', `SELECT our_bid_sent_on = public.app_today() AS ok FROM gc_projects WHERE project_id = $1`, [proj])
await tryq('lost: no reason refused', `SELECT gc_mark_lost($1, 'cheaper')`, [proj])
await tryq('lost', `SELECT gc_mark_lost($1, 'price', ' Lone Oak Builders ', '')`, [proj])
await tryq('lost row', `SELECT lost_on = public.app_today() AS day_ok, lost_why, won_by, lost_note FROM gc_projects WHERE project_id = $1`, [proj])
await tryq('won while lost refused', `SELECT gc_mark_won($1)`, [proj])
await tryq('bring back', `SELECT gc_bring_back($1)`, [proj])
await tryq('bring back again refused', `SELECT gc_bring_back($1)`, [proj])
await tryq('won', `SELECT gc_mark_won($1)`, [proj])
await tryq('stage', `SELECT stage, our_bid_sent_on IS NOT NULL AS sent FROM gc_projects WHERE project_id = $1`, [proj])
const [{ id: pkg }] = (await db.query(`INSERT INTO gc_trade_packages (project_id, trade) VALUES ($1, 'Concrete') RETURNING id`, [proj2])).rows
const [{ id: other }] = (await db.query(`INSERT INTO gc_trade_packages (project_id, trade) VALUES ($1, 'Sitework') RETURNING id`, [proj2])).rows
const [{ id: co }] = (await db.query(`SELECT gc_add_company('{"name":"GC test trade company, delete me","trades":["Concrete","Sitework"],"known":true}'::jsonb) AS id`)).rows
const [{ ids }] = (await db.query(`SELECT gc_invite_companies($1, ARRAY[$2]::uuid[]) AS ids`, [pkg, co])).rows
const ask = ids[0]
await tryq('carry the ask', `UPDATE gc_trade_packages SET carried_invite_id = $1 WHERE id = $2 RETURNING carried_invite_id IS NOT NULL AS carried`, [ask, pkg])
await tryq('carry an ask from another trade refused', `UPDATE gc_trade_packages SET carried_invite_id = $1 WHERE id = $2`, [ask, other])
await tryq('carry both refused', `UPDATE gc_trade_packages SET carry_budget = true WHERE id = $1`, [pkg])
await tryq('delete the ask clears the carry', `DELETE FROM gc_invites WHERE id = $1`, [ask])
await tryq('carry after', `SELECT id = $1 AS same_trade, carried_invite_id FROM gc_trade_packages WHERE id = $1`, [pkg])
await tryq('share a tab', `INSERT INTO gc_bid_tabs (package_id) VALUES ($1) RETURNING shared_on = public.app_today() AS day_ok, show_names`, [pkg])
await tryq('seen', `INSERT INTO gc_bid_tab_views (package_id, company_id) VALUES ($1, $2) RETURNING seen_on = public.app_today() AS day_ok`, [pkg, co])
fs.writeFileSync(process.argv[3] ?? '/dev/stdout', log.join('\n') + '\n')
