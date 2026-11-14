/**
 * The dev seat's renames on site (v2.7241; server 0.86.0): plan_container_edit → apply_container_edit and
 * plan_part_rename → apply_part_rename, both over dev_on_site_rename. The pins hold the verbs to the table, the
 * server, its instructions and the docs, the input checks to the screens' own limits, and the migration to the
 * rules its SQL walk proved.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WRITE_VERBS, applyVerbFor, isWriteVerb, planCommitment, planHash, planReply, planVerbFor, stateGuarded, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { BOX_NAME_MAX, BOX_WHERE_MAX } from '../materials/editBox'
import { PART_NAME_MAX } from '../materials/partRename'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const KERNEL = readFileSync('supabase/functions/_shared/devMcpWrites.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const ARCH = readFileSync('docs/MATERIALS_ON_SITE_ARCHITECTURE.md', 'utf8')
const SQL = readFileSync('supabase/migrations/20261114050000_dev_on_site_rename.sql', 'utf8')
const PART_RENAMES_SQL = readFileSync('supabase/migrations/20261113230000_on_site_part_renames.sql', 'utf8')
const STICKERS_SQL = readFileSync('supabase/migrations/20261113020000_box_stickers.sql', 'utf8')

const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const RENAME = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const VERBS = ['plan_container_edit', 'apply_container_edit', 'plan_part_rename', 'apply_part_rename'] as const
const pOf = (built: ReturnType<typeof writeRpcBody>) => (built.ok ? (built.body as { p: Record<string, unknown> }).p : null)

describe('the verbs — in the table, on the server, in the docs', () => {
  it('are two pairs over one SECURITY INVOKER RPC, declared and handled by the server at 0.86.0', () => {
    for (const v of VERBS) {
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBe('dev_on_site_rename')
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_container_edit')).toBe('plan_container_edit')
    expect(applyVerbFor('plan_part_rename')).toBe('apply_part_rename')
    expect(String(planReply('plan_part_rename', {}, 'e'.repeat(64)).next)).toContain('apply_part_rename')
    expect(Object.keys(WRITE_VERBS)).toHaveLength(107)
    const withRpc = Object.values(WRITE_VERBS).filter((v) => v.rpc !== null)
    expect(withRpc).toHaveLength(51)
    expect(new Set(withRpc.map((v) => v.rpc)).size).toBe(21)
    expect(SERVER).toContain("const SERVER_VERSION = '0.86.0'")
    expect(SERVER).toContain('Writes are one hundred and seven verbs and nothing else:')
    expect(SERVER).toContain('fifty-one POST one of twenty-one hard-coded, dev-gated RPCs as the dev (dev_on_site_write and')
    expect(SERVER).toContain('plan_container_edit → apply_container_edit (a live box')
    expect(SERVER).toContain('plan_part_rename → apply_part_rename (a typed part')
    expect(README).toContain('`plan_container_edit(edit)` · `apply_container_edit(edit, plan_hash)` · `plan_part_rename(rename)` · `apply_part_rename(rename, plan_hash)`')
    expect(README).toContain("one hundred and seven since v2.7241's box edit and part rename")
    expect(README).toContain('fifty-one POST only their twenty-one named RPCs')
    expect(EDGE).toContain('**v2.7241 (server 0.86.0)')
    expect(ARCH).toContain('`plan_container_edit` → `apply_container_edit`')
    expect(ARCH).toContain('`plan_part_rename` → `apply_part_rename`')
  })

  it('leaves a replay to the wrapper, which refuses it in words', () => {
    // The box already reads that way, no typed part carries the old name, the rename was already undone: each is a
    // refusal of the dry run apply runs first. A name fixed, undone and fixed again is a second act, not a replay.
    expect(stateGuarded('apply_container_edit')).toBe(true)
    expect(stateGuarded('apply_part_rename')).toBe(true)
    expect(stateGuarded('plan_part_rename')).toBe(false)
    expect(SQL).toContain("'dev_on_site_rename: nothing to change. % already reads that way.'")
    expect(SQL).toContain("'dev_on_site_rename: no typed part named % on job %")
    expect(SQL).toContain("'dev_on_site_rename: every line of that part on job % already reads %'")
    expect(SQL).toContain("'dev_on_site_rename: that rename was already undone.")
  })
})

describe('plan_container_edit — the Edit window’s limits before the database is asked', () => {
  const edit = (over: Record<string, unknown>) => writeRpcBody('plan_container_edit', { edit: { job_id: JOB, agent_label: 'the tidy robot', container: 'G12 COPPER 90', ...over } })

  it('sends only the keys it was given, cleaned', () => {
    expect(pOf(edit({ label: '  g12 ' }))).toEqual({ action: 'edit_container', job_id: JOB, agent_label: 'the tidy robot', container: 'G12 COPPER 90', label: 'g12' })
    expect(pOf(edit({ kind: ' Loose ', where: ' on a   pallet ' }))).toEqual({ action: 'edit_container', job_id: JOB, agent_label: 'the tidy robot', container: 'G12 COPPER 90', kind: 'loose', where: 'on a pallet' })
    expect(edit({ label: 'G12' })).toMatchObject({ ok: true, rpc: 'dev_on_site_rename', step: 'plan', target: `${JOB} G12 COPPER 90`, body: { p_dry_run: true }, dryRunBody: { p_dry_run: true } })
  })

  it('clears the where line with an empty one, and tells that from a key left out', () => {
    expect(pOf(edit({ where: '' }))).toMatchObject({ where: '' })
    expect(pOf(edit({ label: 'G12' }))).not.toHaveProperty('where')
  })

  it('refuses what the window refuses, and an edit of nothing', () => {
    expect(edit({})).toMatchObject({ ok: false, error: expect.stringContaining('at least one of') })
    expect(edit({ label: ' ' })).toMatchObject({ ok: false })
    expect(edit({ label: 'X'.repeat(BOX_NAME_MAX) })).toMatchObject({ ok: true })
    expect(edit({ label: 'X'.repeat(BOX_NAME_MAX + 1) })).toMatchObject({ ok: false })
    expect(edit({ kind: 'unsorted' })).toMatchObject({ ok: false })
    expect(edit({ kind: 'pallet' })).toMatchObject({ ok: false })
    expect(edit({ where: 'y'.repeat(BOX_WHERE_MAX) })).toMatchObject({ ok: true })
    expect(edit({ where: 'y'.repeat(BOX_WHERE_MAX + 1) })).toMatchObject({ ok: false })
    expect(edit({ label: 12 })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_container_edit', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs edit') })
    expect(writeRpcBody('plan_container_edit', { edit: { job_id: 'JP1085', agent_label: 'r', container: 'G12', label: 'G13' } })).toMatchObject({ ok: false, error: expect.stringContaining('find_job') })
    expect(writeRpcBody('plan_container_edit', { edit: { job_id: JOB, container: 'G12', label: 'G13' } })).toMatchObject({ ok: false, error: expect.stringContaining('agent_label') })
    expect(writeRpcBody('plan_container_edit', { edit: { job_id: JOB, agent_label: 'r', label: 'G13' } })).toMatchObject({ ok: false })
  })

  it('applies only with the plan’s hash, as a real run with the dry run kept for the check', () => {
    expect(writeRpcBody('apply_container_edit', { edit: { job_id: JOB, agent_label: 'r', container: 'G12', label: 'G13' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('apply_container_edit', { edit: { job_id: JOB, agent_label: 'r', container: 'G12', label: 'G13' }, plan_hash: 'a'.repeat(64) })).toMatchObject({ ok: true, step: 'apply', body: { p_dry_run: false }, dryRunBody: { p_dry_run: true }, planHash: 'a'.repeat(64) })
  })
})

describe('plan_part_rename — a rename or its undo', () => {
  const rename = (over: Record<string, unknown>) => writeRpcBody('plan_part_rename', { rename: { job_id: JOB, agent_label: 'the tidy robot', ...over } })

  it('sends the two names cleaned, their capitals kept', () => {
    expect(pOf(rename({ from: ' 3:4   pex ', to: ' 3/4  PEX ' }))).toEqual({ action: 'rename_part', job_id: JOB, agent_label: 'the tidy robot', from: '3:4 pex', to: '3/4 PEX' })
    expect(rename({ from: 'pex', to: 'PEX' })).toMatchObject({ ok: true, rpc: 'dev_on_site_rename', target: `${JOB} pex` })
  })

  it('sends an undo by the rename’s id alone', () => {
    expect(pOf(rename({ undo: RENAME.toUpperCase() }))).toEqual({ action: 'undo_part_rename', job_id: JOB, agent_label: 'the tidy robot', rename_id: RENAME })
    expect(rename({ undo: RENAME, from: 'a', to: 'b' })).toMatchObject({ ok: false })
    expect(rename({ undo: 'the last one' })).toMatchObject({ ok: false, error: expect.stringContaining('rename_id') })
  })

  it('refuses a name left out, one too long and a rename to itself', () => {
    expect(rename({ from: '3:4 pex' })).toMatchObject({ ok: false })
    expect(rename({ to: '3/4 PEX' })).toMatchObject({ ok: false })
    expect(rename({ from: 'a', to: 'x'.repeat(PART_NAME_MAX) })).toMatchObject({ ok: true })
    expect(rename({ from: 'a', to: 'x'.repeat(PART_NAME_MAX + 1) })).toMatchObject({ ok: false })
    expect(rename({ from: ' tee ', to: 'tee' })).toMatchObject({ ok: false, error: expect.stringContaining('the same name') })
    expect(writeRpcBody('plan_part_rename', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs rename') })
    expect(writeRpcBody('plan_part_rename', { rename: { job_id: JOB, from: 'a', to: 'b' } })).toMatchObject({ ok: false, error: expect.stringContaining('agent_label') })
  })

  it('commits the plan to what the rows read, so a press on the line since changes the hash', async () => {
    const built = rename({ from: 'pex rolls red', to: 'Red pex rolls' })
    const reply = { ok: true, dry_run: true, action: 'rename_part', after: { from: 'pex rolls red', to: 'Red pex rolls', rows: 3, spelled_now: [{ name: 'Pex rolls red', rows: 3 }], undo_restores: 'Pex rolls red', boxes: ['G12', 'G13'], merges: [{ box: 'G12', from_on_hand: 14, to_on_hand: 16, becomes: 14 }] } }
    const h = await planHash('plan_part_rename', pOf(built), reply)
    expect(h).toBe(await planHash('apply_part_rename', pOf(built), { ...reply, dry_run: false }))
    expect(planCommitment('plan_part_rename', reply)).not.toHaveProperty('dry_run')
    expect(h).not.toBe(await planHash('plan_part_rename', pOf(built), { ...reply, after: { ...reply.after, rows: 4 } }))
    expect(h).not.toBe(await planHash('plan_part_rename', pOf(built), { ...reply, after: { ...reply.after, merges: [{ box: 'G12', from_on_hand: 14, to_on_hand: 18, becomes: 14 }] } }))
    expect(h).not.toBe(await planHash('plan_part_rename', pOf(rename({ from: 'pex rolls red', to: 'Red PEX rolls' })), reply))
  })
})

describe('the migration — what the wrapper is and what it leaves to the screens’ own triggers', () => {
  it('opens with the lock timeout and makes no table', () => {
    expect(SQL.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(SQL).not.toMatch(/CREATE TABLE/i) // no table, so no fence call is owed
  })

  it('is SECURITY INVOKER behind the seat’s gate, with the dry run as the default', () => {
    const wrapper = SQL.slice(SQL.indexOf('CREATE OR REPLACE FUNCTION public.dev_on_site_rename('))
    expect(wrapper).toContain('dev_on_site_rename(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(wrapper.slice(0, 200)).toContain('SECURITY INVOKER')
    expect(wrapper).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(wrapper).toContain('IF public.is_read_only() THEN')
    expect(wrapper).toContain('IF public.is_digital_twin() THEN')
    expect(wrapper).toContain('IF NOT public.on_site_can_touch_job(v_job_id) THEN')
    expect(wrapper).toContain("IF v_action NOT IN ('edit_container', 'rename_part', 'undo_part_rename') THEN")
    expect(SQL).toContain('REVOKE ALL ON FUNCTION public.dev_on_site_rename(jsonb, boolean) FROM anon;')
    expect(SQL).toContain('GRANT EXECUTE ON FUNCTION public.dev_on_site_rename(jsonb, boolean) TO authenticated;')
  })

  it('writes what the two screens write and nothing else', () => {
    const wrapper = SQL.slice(SQL.indexOf('CREATE OR REPLACE FUNCTION public.dev_on_site_rename('))
    // One update of the box, two inserts of a rename row; the ledger is the apply trigger's alone.
    expect(wrapper.match(/\bUPDATE public\.\w+/g)).toEqual(['UPDATE public.job_containers'])
    expect(wrapper.match(/\bINSERT INTO public\.\w+/g)).toEqual(['INSERT INTO public.job_part_renames', 'INSERT INTO public.job_part_renames'])
    expect(wrapper).not.toMatch(/\bDELETE FROM/)
    // Every write sits behind NOT p_dry_run.
    expect(wrapper.match(/IF NOT p_dry_run THEN/g)).toHaveLength(4)
    expect(PART_RENAMES_SQL).toContain('UPDATE public.job_material_movements m')
  })

  it('holds the Edit window’s limits and Fix the name’s', () => {
    expect(SQL).toContain(`IF length(v_label) NOT BETWEEN 1 AND ${BOX_NAME_MAX} THEN`)
    expect(SQL).toContain(`IF length(v_where) > ${BOX_WHERE_MAX} THEN`)
    expect(SQL).toContain(`IF length(v_new) > ${PART_NAME_MAX} THEN`)
    expect(SQL).toContain("IF v_kind NOT IN ('cage', 'box', 'loose') THEN")
    expect(SQL).toContain("IF v_container.kind = 'unsorted' THEN")
    expect(SQL).toContain('c.retired_at IS NULL AND lower(btrim(c.label)) = lower(v_label)')
    expect(KERNEL).toContain(`const BOX_NAME_MAX = ${BOX_NAME_MAX}`)
    expect(KERNEL).toContain(`const PART_NAME_MAX = ${PART_NAME_MAX}`)
  })

  it('stamps the two records through on_site_by_name, for a dev alone, and clears the setting after each write', () => {
    expect(SQL).toContain("WHEN public.is_dev() AND btrim(COALESCE(current_setting('on_site.by_name', true), '')) <> ''")
    expect(SQL).toContain('ELSE public.box_sticker_caller_name()')
    expect(SQL.match(/PERFORM set_config\('on_site\.by_name', v_by_name, true\);/g)).toHaveLength(3)
    expect(SQL.match(/PERFORM set_config\('on_site\.by_name', '', true\);/g)).toHaveLength(3)
    expect(SQL).toContain('VALUES (NEW.id, OLD.label, NEW.label, auth.uid(), public.on_site_by_name());')
    expect(SQL).toContain('NEW.by_name := public.on_site_by_name();')
    expect(SQL).toContain('NEW.by_user_id := auth.uid();')
  })

  it('re-states the two trigger functions whole, changing the one name', () => {
    const body = (sql: string, fn: string) => {
      const from = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}()`)
      return sql.slice(from, sql.indexOf('$fn$;', from))
    }
    expect(body(SQL, 'job_part_renames_judge')).toBe(body(PART_RENAMES_SQL, 'job_part_renames_judge').replace('public.box_sticker_caller_name()', 'public.on_site_by_name()'))
    expect(body(SQL, 'job_containers_keep_names')).toBe(body(STICKERS_SQL, 'job_containers_keep_names').replace('public.box_sticker_caller_name()', 'public.on_site_by_name()'))
  })

  it('reads a merged line with the ledger’s own arithmetic', () => {
    const merged = SQL.slice(SQL.indexOf('CREATE OR REPLACE FUNCTION public.on_site_typed_names_on_hand('), SQL.indexOf('COMMENT ON FUNCTION public.on_site_typed_names_on_hand'))
    expect(merged).toContain('SECURITY INVOKER')
    expect(merged).toContain("WHERE reason = 'counted' AND from_container_id = p_container_id")
    expect(merged).toContain('OR (r.at, r.id::text) > (SELECT lc.at, lc.id::text FROM last_count lc)')
    expect(SQL).toContain('v_becomes := public.on_site_typed_names_on_hand(v_box.id, ARRAY[v_old, v_new]);')
    expect(SQL).toContain('the newer count of the two resets the line')
  })
})
