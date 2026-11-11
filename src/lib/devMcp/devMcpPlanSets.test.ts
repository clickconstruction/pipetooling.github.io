import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ASK_LANES,
  DRAWING_KINDS,
  PAPER_KINDS,
  PAPER_SOURCES,
  PLAN_PART_VERBS,
  SET_SOURCES,
  filedPlansSetRow,
  filedPlansTargets,
  filedPlansWords,
  isPlanPartVerb,
  jobLabel,
  paperHistoryLine,
  partSwitchLine,
  planLinkKey,
  planPartApply,
  planPartDryRun,
  planPartInput,
  readPlanPartWorld,
  type Json,
  type PartReads,
  type PartWrites,
  type PlanPartWorld,
  type SetRow,
} from '../../../supabase/functions/_shared/devMcpPlanSets'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { PLAN_SET_KINDS, PLAN_SET_SOURCES } from '../plans/planSets'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const TWIN = readFileSync('supabase/functions/twin-mcp/index.ts', 'utf8')
const PAPERS_MIGRATION = readFileSync('supabase/migrations/20261102010000_plan_sets_papers.sql', 'utf8')
const PRICED_MIGRATION = readFileSync('supabase/migrations/20261102060000_bid_priced_on_set.sql', 'utf8')
const SWITCH_MIGRATION = readFileSync('supabase/migrations/20261102063000_plan_part_switch_history.sql', 'utf8')

const PART = 'aaaaaaaa-1111-4111-8111-111111111111'
const PART2 = 'aaaaaaaa-2222-4222-8222-222222222222'
const JOB = 'bbbbbbbb-1111-4111-8111-111111111111'
const DEV = 'cccccccc-1111-4111-8111-111111111111'
const ISSUED = 'dddddddd-1111-4111-8111-111111111111'
const PERMIT = 'dddddddd-2222-4222-8222-222222222222'
const TASKLIST = 'dddddddd-3333-4333-8333-333333333333'
const OWED = 'dddddddd-4444-4444-8444-444444444444'
const ME = 'eeeeeeee-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const TODAY = '2026-11-02'

const setRow = (over: Partial<SetRow> & Pick<SetRow, 'id' | 'name' | 'kind'>): SetRow => ({
  part_id: PART,
  source: 'gc',
  link: 'https://drive.google.com/drive/folders/x',
  owed: false,
  came_at: '2026-10-20T15:00:00+00:00',
  marks_up_set_id: null,
  replaces_set_id: null,
  job_id: null,
  ...over,
})

/** A development's part the job JP9001 builds from: an issued set (current) and a permit set, with one paper kept and one owed. */
function world(over: Partial<PlanPartWorld> = {}): PlanPartWorld {
  return {
    part: { id: PART, development_id: DEV, job_id: null, name: 'North Wing', current_set_id: ISSUED },
    development: { id: DEV, name: 'ZZ Test Meadows' },
    job: { id: JOB, job_name: 'ZZ North plumbing', click_number: '9001', hcp_number: null, plan_part_id: PART, development_id: DEV },
    sets: [
      setRow({ id: ISSUED, name: 'Issued set', kind: 'issued' }),
      setRow({ id: PERMIT, name: 'Permit set', kind: 'permit', came_at: '2026-10-25T15:00:00+00:00' }),
      setRow({ id: TASKLIST, name: "Owner's punch list", kind: 'task_list', marks_up_set_id: ISSUED, came_at: '2026-10-26T12:00:00+00:00' }),
      setRow({ id: OWED, name: 'Soil report', kind: 'report', source: 'engineer', owed: true, link: '', came_at: '2026-10-27T12:00:00+00:00' }),
    ],
    paper: null,
    ...over,
  }
}

/** A recording fake over the two interfaces: reads answer from a table of canned rows, writes are kept in order. */
function fake(rows: Record<string, Json[]>) {
  const calls: string[] = []
  const written: Array<{ op: string; table: string; query?: string; row: Json }> = []
  let nextId = 1
  const reads: PartReads = {
    rows: async (table, query) => {
      calls.push(`read ${table} ${query}`)
      const id = /(?:^|&)id=eq\.([^&]+)/.exec(query)?.[1]
      const partId = /(?:^|&)part_id=eq\.([^&]+)/.exec(query)?.[1]
      return (rows[table] ?? []).filter((r) => (id ? r.id === id : true) && (partId ? r.part_id === partId : true))
    },
  }
  const writes: PartWrites = {
    insert: async (table, row) => {
      calls.push(`insert ${table}`)
      written.push({ op: 'insert', table, row })
      return { ...row, id: `made-${nextId++}` }
    },
    update: async (table, query, patch) => {
      calls.push(`update ${table} ${query}`)
      written.push({ op: 'update', table, query, row: patch })
    },
    invoke: async (fn, body) => {
      calls.push(`invoke ${fn} ${JSON.stringify(body)}`)
      return { ok: true, error: null }
    },
  }
  return { reads, writes, calls, written }
}

describe('the plan-part verbs mirror the Plans section (v2.6317, punch list #239)', () => {
  it('the kinds and sources are the database’s own, and the drawings are the Plans section’s', () => {
    // The drawings and their sources: the Plans section's picker (src/lib/plans/planSets.ts).
    expect(DRAWING_KINDS.map((k) => k.kind)).toEqual(PLAN_SET_KINDS.map((k) => k.kind))
    expect(DRAWING_KINDS.map((k) => k.label)).toEqual(PLAN_SET_KINDS.map((k) => k.label))
    expect([...SET_SOURCES]).toEqual(PLAN_SET_SOURCES.map((s) => s.source))
    // Every kind the papers migration allows, in its order, split where plan_set_is_drawing splits them: no more, no fewer.
    const quoted = (sql: string) => [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    const allowed = quoted(/plan_sets_kind_known CHECK \(kind IN \(([\s\S]*?)\)\);/.exec(PAPERS_MIGRATION)?.[1] ?? '')
    const drawings = quoted(/SELECT p_kind IN \(([^)]*)\)/.exec(PAPERS_MIGRATION)?.[1] ?? '')
    expect(drawings).toEqual(DRAWING_KINDS.map((k) => k.kind))
    expect(allowed).toEqual([...DRAWING_KINDS, ...PAPER_KINDS].map((k) => k.kind))
    expect(PAPERS_MIGRATION).toContain("CHECK (source IN ('gc', 'architect', 'engineer', 'supplier', 'ours'))")
    expect([...PAPER_SOURCES]).toEqual(['gc', 'architect', 'engineer', 'supplier', 'ours'])
    expect(PAPERS_MIGRATION).toContain("CHECK (ask_lane IS NULL OR ask_lane IN ('estimators', 'dispatch'))")
    expect([...ASK_LANES]).toEqual(['estimators', 'dispatch'])
    // The History line is the trigger's (plan_set_paper_words): paperHistoryLine writes the same words into the plan.
    expect(PAPERS_MIGRATION).toContain("WHEN p.owed THEN 'Owed: ' || p.name || ' from ' || CASE p.source WHEN 'ours' THEN 'us'")
    expect(PAPERS_MIGRATION).toContain("ELSE 'Kept ' || replace(p.kind, '_', ' ') || ' ' || p.name || ', '")
    expect(PAPERS_MIGRATION).toContain("|| CASE WHEN p_goes_with IS NOT NULL THEN ', on ' || p_goes_with ELSE '' END")
    expect(PAPERS_MIGRATION).toContain("|| CASE WHEN p_replaces IS NOT NULL THEN ' · replaces ' || p_replaces ELSE '' END")
  })

  it('are four write verbs on the allowlist with no RPC, plan before apply, and the server declares and handles each in its own branch', () => {
    expect([...PLAN_PART_VERBS]).toEqual(['plan_plan_set', 'apply_plan_set', 'plan_paper', 'apply_paper'])
    for (const v of PLAN_PART_VERBS) {
      expect(isPlanPartVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`name: '${v}'`)
      expect(SERVER).toContain(`case '${v}':`)
    }
    expect(isPlanPartVerb('plan_file_plans')).toBe(false)
    expect(planVerbFor('apply_plan_set')).toBe('plan_plan_set')
    expect(planVerbFor('apply_paper')).toBe('plan_paper')
    expect(String(planReply('plan_plan_set', { part: { name: 'North Wing' } }, HASH).next)).toContain('apply_plan_set')
    expect(String(planReply('plan_paper', { part: { name: 'North Wing' } }, HASH).next)).toContain('apply_paper')
    expect(alreadyApplied('apply_plan_set', { target: PART, at: '2026-11-02T06:00:00Z' })).toContain('on this plan part')
    expect(alreadyApplied('apply_paper', { target: PART, at: null })).toContain('action: came')
    // The server: its own read of the part is the dry run, its table writes go through restRows and nowhere else, 0.14.0 (0.23.0 with the file index, v2.6367, get_person_file, the evidence verbs, the clock session verbs, the hours statement, the report verbs, get_job's paged reads and its card rule behind it).
    expect(SERVER).toContain("const SERVER_VERSION = '0.70.0'")
    expect(SERVER).toContain('Writes are eighty-three verbs and nothing else')
    expect(SERVER).toContain('const world = await readPlanPartWorld(reads, p)')
    expect(SERVER).toContain('const dry = planPartDryRun(p, world, todayYmdInAppTz())')
    expect(SERVER).toContain('await planPartApply(writes, p, dry.reply, { userId: who.userId }, new Date().toISOString())')
    expect(SERVER.match(/restRows\(/g)?.length).toBe(28) // declared once; insert + update in the plan-part branch; the part leg's insert + update in apply_file_plans; the job's PATCH in apply_job_update (v2.6793); the revision, the rows, a log line and a patch in the submittal branch (v2.6804); one note row in the activity-note branch (v2.6822); the contract's end in apply_contract_ended (v2.6795); a payment's row, its words and the reason's note in apply_job_payment (v2.6940)
    expect(SERVER).toContain("Prefer: prefer ?? (method === 'POST' ? 'return=representation' : 'return=minimal')")
    // The one-apply rule and the mismatch refusal hold for these verbs as for every other.
    expect(SERVER).toContain('if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? \'\', fresh), { target: built.target })\n      const prior = await hooks.priorApply(name, fresh)\n      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })\n      const writes: PartWrites')
  })

  it('writeRpcBody hands the four verbs to planPartInput: no RPC, the payload under p, apply needs its hash', () => {
    const plan = writeRpcBody('plan_plan_set', { set: { part_id: PART, name: 'Addendum 1', kind: 'addendum', source: 'gc' } })
    expect(plan).toEqual({ ok: true, rpc: null, step: 'plan', body: { p: { action: 'add_set', part_id: PART, name: 'Addendum 1', kind: 'addendum', source: 'gc', memo: '', link: '' } }, dryRunBody: null, target: PART, planHash: null })
    expect(writeRpcBody('apply_plan_set', { set: { part_id: PART, name: 'Addendum 1', kind: 'addendum', source: 'gc' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('apply_paper', { paper: { action: 'came', paper_id: OWED, link: 'https://drive.google.com/file/d/1/view' }, plan_hash: HASH })).toMatchObject({ ok: true, step: 'apply', rpc: null, body: { p: { action: 'came', paper_id: OWED } }, planHash: HASH })
  })
})

describe('planPartInput — the shape each verb takes', () => {
  it('a set: part_id and/or job_id, a drawing kind, a set source; trims; a paper kind points at plan_paper', () => {
    const ok = planPartInput('plan_plan_set', { set: { job_id: JOB.toUpperCase(), name: ' Permit set ', kind: 'Permit', source: 'GC', dated: '2026-10-14', memo: ' stamped ', link: ' https://drive.google.com/drive/folders/p ', make_current: true } })
    expect(ok).toEqual({ ok: true, target: JOB, p: { action: 'add_set', job_id: JOB, name: 'Permit set', kind: 'permit', source: 'gc', dated: '2026-10-14', memo: 'stamped', link: 'https://drive.google.com/drive/folders/p', make_current: true } })
    expect(planPartInput('plan_plan_set', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs set') })
    expect(planPartInput('plan_plan_set', { set: { name: 'x', kind: 'issued', source: 'gc' } })).toMatchObject({ ok: false }) // no part and no job
    expect(planPartInput('plan_plan_set', { set: { part_id: 'the north wing', name: 'x', kind: 'issued', source: 'gc' } })).toMatchObject({ ok: false })
    expect(planPartInput('plan_plan_set', { set: { part_id: PART, name: 'Spec book', kind: 'spec', source: 'gc' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_paper') })
    expect(planPartInput('plan_plan_set', { set: { part_id: PART, name: 'x', kind: 'issued', source: 'engineer' } })).toMatchObject({ ok: false }) // a set's source is gc | architect | ours
    expect(planPartInput('plan_plan_set', { set: { part_id: PART, name: 'x', kind: 'issued', source: 'gc', link: 'drive.google.com/x' } })).toMatchObject({ ok: false, error: expect.stringContaining('https://') })
    expect(planPartInput('plan_plan_set', { set: { part_id: PART, name: 'x', kind: 'issued', source: 'gc', dated: 'Oct 14' } })).toMatchObject({ ok: false })
    expect(planPartInput('plan_plan_set', { set: { part_id: PART, name: 'a'.repeat(201), kind: 'issued', source: 'gc' } })).toMatchObject({ ok: false })
    expect(planPartInput('plan_plan_set', { set: { part_id: PART, name: 'x', kind: 'issued', source: 'gc', make_current: 'yes' } })).toMatchObject({ ok: false })
  })
  it('an as-built is ours, on a job, never what the part builds from', () => {
    expect(planPartInput('plan_plan_set', { set: { part_id: PART, name: 'As-built', kind: 'as_built', source: 'ours' } })).toMatchObject({ ok: false, error: expect.stringContaining('job_id') })
    expect(planPartInput('plan_plan_set', { set: { job_id: JOB, name: 'As-built', kind: 'as_built', source: 'gc' } })).toMatchObject({ ok: false, error: expect.stringContaining('ours') })
    expect(planPartInput('plan_plan_set', { set: { job_id: JOB, name: 'As-built', kind: 'as_built', source: 'ours', make_current: true } })).toMatchObject({ ok: false, error: expect.stringContaining('never from an as-built') })
    expect(planPartInput('plan_plan_set', { set: { job_id: JOB, name: 'As-built · JP9001 · 2026-11-02', kind: 'as_built', source: 'ours', marks_up_set_id: ISSUED } })).toMatchObject({ ok: true, p: { kind: 'as_built', marks_up_set_id: ISSUED } })
  })
  it('a paper: a paper kind, one of five sources, the day it came, its ask; owed needs the ask and drops the link; a drawing kind points at plan_plan_set', () => {
    const kept = planPartInput('plan_paper', { paper: { job_id: JOB, kind: 'task_list', name: " Owner's punch list ", from: 'gc', came_on: '2026-10-26', memo: 'fixtures already ordered', link: 'https://drive.google.com/file/d/t/view', goes_with_set_id: ISSUED, ask: { lane: 'Estimators', words: ' Do the fixtures change the rough-in? ' } } })
    expect(kept).toEqual({ ok: true, target: JOB, p: { action: 'keep', job_id: JOB, name: "Owner's punch list", kind: 'task_list', from: 'gc', came_on: '2026-10-26', memo: 'fixtures already ordered', link: 'https://drive.google.com/file/d/t/view', goes_with_set_id: ISSUED, owed: false, ask: { lane: 'estimators', words: 'Do the fixtures change the rough-in?' } } })
    const owed = planPartInput('plan_paper', { paper: { part_id: PART, kind: 'report', name: 'Soil report', from: 'engineer', owed: true, link: 'https://x', ask: { lane: 'dispatch', words: 'The engineer owes the soil report before the slab' } } })
    expect(owed).toMatchObject({ ok: true, p: { owed: true, link: '', ask: { lane: 'dispatch' } } })
    expect(planPartInput('plan_paper', { paper: { part_id: PART, kind: 'report', name: 'Soil report', from: 'engineer', owed: true } })).toMatchObject({ ok: false, error: expect.stringContaining('owed paper carries its ask') })
    expect(planPartInput('plan_paper', { paper: { part_id: PART, kind: 'permit', name: 'Permit set', from: 'gc' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_plan_set') })
    expect(planPartInput('plan_paper', { paper: { part_id: PART, kind: 'spec', name: 'x', from: 'owner' } })).toMatchObject({ ok: false })
    expect(planPartInput('plan_paper', { paper: { part_id: PART, kind: 'spec', name: 'x', from: 'gc', came_on: 'today' } })).toMatchObject({ ok: false })
    expect(planPartInput('plan_paper', { paper: { part_id: PART, kind: 'spec', name: 'x', from: 'gc', ask: { lane: 'owner', words: 'x' } } })).toMatchObject({ ok: false })
    expect(planPartInput('plan_paper', { paper: { part_id: PART, kind: 'spec', name: 'x', from: 'gc', ask: { lane: 'dispatch', words: 'a'.repeat(501) } } })).toMatchObject({ ok: false })
    expect(planPartInput('plan_paper', {})).toMatchObject({ ok: false, error: expect.stringContaining('needs paper') })
  })
  it('came: an owed paper’s id and the link it landed at', () => {
    expect(planPartInput('plan_paper', { paper: { action: 'came', paper_id: OWED, link: 'https://drive.google.com/file/d/s/view' } })).toEqual({ ok: true, target: OWED, p: { action: 'came', paper_id: OWED, link: 'https://drive.google.com/file/d/s/view' } })
    expect(planPartInput('plan_paper', { paper: { action: 'came', paper_id: OWED } })).toMatchObject({ ok: false })
    expect(planPartInput('plan_paper', { paper: { action: 'came', paper_id: OWED, link: 'ftp://x' } })).toMatchObject({ ok: false })
    expect(planPartInput('plan_paper', { paper: { action: 'remove', paper_id: OWED } })).toMatchObject({ ok: false })
  })
})

describe('the dry run — the part as it stands and the row as it will be written', () => {
  const addSet = (over: Json = {}) => planPartInput('plan_plan_set', { set: { job_id: JOB, name: 'Addendum 1', kind: 'addendum', source: 'gc', dated: '2026-11-01', link: 'https://drive.google.com/drive/folders/a', ...over } })
  it('a set that becomes current replaces the current one, as the Plans section’s Add the set and build from it does', () => {
    const built = addSet({ make_current: true })
    if (!built.ok) throw new Error(built.error)
    const dry = planPartDryRun(built.p, world(), TODAY)
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply).toMatchObject({
      action: 'add_set',
      part: { id: PART, name: 'North Wing', on: 'development', development: { id: DEV, name: 'ZZ Test Meadows' }, job: null, sets_on_part: 4, builds_from: { id: ISSUED, name: 'Issued set', kind: 'issued' } },
      set: { name: 'Addendum 1', kind: 'addendum', kind_words: 'Addendum', source_words: 'the GC', dated: '2026-11-01', replaces: { id: ISSUED, name: 'Issued set' }, marks_up: null, job: null, line: 'Addendum · the GC · dated Nov 1, 2026' },
      make_current: true,
      after: { builds_from: 'Addendum 1', replaced: 'Issued set' },
    })
    // The switch writes the site's History by trigger (v2.6344); the plan shows the line.
    expect(dry.reply.history_line).toBe('Plans · North Wing now builds from Addendum 1, dated Nov 1, 2026 · replaces Issued set')
    expect(String(dry.reply.history)).toContain("ZZ Test Meadows's History")
  })
  it('left out, make_current is true only when the part builds from nothing; an undated set reads the day it came', () => {
    const built = addSet()
    if (!built.ok) throw new Error(built.error)
    const kept = planPartDryRun(built.p, world(), TODAY)
    expect(kept).toMatchObject({ ok: true, reply: { make_current: false, history_line: null, set: { replaces: null }, after: { builds_from: 'Issued set', note: expect.stringContaining('make_current: true') } } })
    const empty = planPartDryRun(built.p, world({ part: { id: PART, development_id: DEV, job_id: null, name: 'North Wing', current_set_id: null }, sets: [] }), TODAY)
    expect(empty).toMatchObject({ ok: true, reply: { make_current: true, history_line: 'Plans · North Wing now builds from Addendum 1, dated Nov 1, 2026', part: { builds_from: null, sets_on_part: 0 }, set: { replaces: null }, after: { builds_from: 'Addendum 1', replaced: null } } })
    const undated = addSet({ dated: undefined })
    if (!undated.ok) throw new Error(undated.error)
    expect(planPartDryRun(undated.p, world(), TODAY)).toMatchObject({ ok: true, reply: { set: { line: 'Addendum · the GC · came Nov 2' } } })
  })
  it('an as-built marks up the current set unless told otherwise, sits on the job, and never switches the part', () => {
    const built = planPartInput('plan_plan_set', { set: { job_id: JOB, name: 'As-built · JP9001 · 2026-11-02', kind: 'as_built', source: 'ours' } })
    if (!built.ok) throw new Error(built.error)
    const dry = planPartDryRun(built.p, world(), TODAY)
    expect(dry).toMatchObject({ ok: true, reply: { make_current: false, set: { marks_up: { id: ISSUED }, job: { id: JOB, label: 'JP9001' }, source_words: 'ours' }, after: { builds_from: 'Issued set', note: expect.stringContaining('Our as-builts') } } })
  })
  it('a job outside any development switches with no History line, and the switch words are the trigger’s', () => {
    const own = world({ part: { id: PART, development_id: null, job_id: JOB, name: 'ZZ North plumbing', current_set_id: ISSUED }, development: null, job: { id: JOB, job_name: 'ZZ North plumbing', click_number: '9001', hcp_number: null, plan_part_id: PART, development_id: null } })
    const built = addSet({ make_current: true })
    if (!built.ok) throw new Error(built.error)
    expect(planPartDryRun(built.p, own, TODAY)).toMatchObject({ ok: true, reply: { make_current: true, history_line: null, history: expect.stringContaining('no site History') } })
    expect(partSwitchLine('North Wing', { name: 'Permit set', dated: null }, 'Permit set')).toBe('Plans · North Wing now builds from Permit set')
    expect(SWITCH_MIGRATION).toContain("SELECT 'Plans · ' || p_part || ' now builds from ' || p_set.name")
    expect(SWITCH_MIGRATION).toContain("CASE WHEN p_set.dated IS NOT NULL THEN ', dated ' || to_char(p_set.dated, 'Mon FMDD, YYYY') ELSE '' END")
    expect(SWITCH_MIGRATION).toContain("CASE WHEN p_old IS NOT NULL AND p_old <> p_set.name THEN ' · replaces ' || p_old ELSE '' END")
    expect(SWITCH_MIGRATION).toContain('IF NEW.development_id IS NULL THEN RETURN NEW; END IF;')
  })
  it('refuses in words: no job, a job with no part, a part the job does not build from, a set that is not on the part, a paper where a drawing goes', () => {
    const built = addSet()
    if (!built.ok) throw new Error(built.error)
    expect(planPartDryRun(built.p, world({ job: null, part: null, development: null, sets: [] }), TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('find_job') })
    expect(planPartDryRun(built.p, world({ job: { id: JOB, job_name: 'ZZ North plumbing', click_number: '9001', hcp_number: null, plan_part_id: null, development_id: DEV }, part: null, sets: [] }), TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('JP9001 has no plan part yet') })
    const other = planPartInput('plan_plan_set', { set: { part_id: PART2, job_id: JOB, name: 'x', kind: 'issued', source: 'gc' } })
    if (!other.ok) throw new Error(other.error)
    expect(planPartDryRun(other.p, world({ part: { id: PART2, development_id: DEV, job_id: null, name: 'South Wing', current_set_id: null }, sets: [] }), TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('builds from part') })
    const stray = addSet({ replaces_set_id: PART2 })
    if (!stray.ok) throw new Error(stray.error)
    expect(planPartDryRun(stray.p, world(), TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('not a set on North Wing') })
    const onPaper = addSet({ replaces_set_id: TASKLIST })
    if (!onPaper.ok) throw new Error(onPaper.error)
    expect(planPartDryRun(onPaper.p, world(), TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('is a paper') })
    const noPart = planPartInput('plan_plan_set', { set: { part_id: PART2, name: 'x', kind: 'issued', source: 'gc' } })
    if (!noPart.ok) throw new Error(noPart.error)
    expect(planPartDryRun(noPart.p, world({ part: null, job: null, development: null, sets: [] }), TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('No plan part') })
  })
  it('a paper: its line, its ask about the job, the History line the trigger writes, the count of papers the hash commits to', () => {
    const built = planPartInput('plan_paper', { paper: { job_id: JOB, kind: 'change_order', name: 'CO 3', from: 'gc', memo: 'adds a hose bibb', link: 'https://drive.google.com/file/d/c/view', goes_with_set_id: ISSUED, ask: { lane: 'estimators', words: 'Price CO 3' } } })
    if (!built.ok) throw new Error(built.error)
    const dry = planPartDryRun(built.p, world(), TODAY)
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply).toMatchObject({
      action: 'keep',
      paper: { name: 'CO 3', kind_words: 'Change order', from_words: 'the owner', came_on: TODAY, goes_with: { id: ISSUED, name: 'Issued set' }, replaces: null, job: { id: JOB, label: 'JP9001' }, owed: false, line: 'Change order · the owner · came Nov 2' },
      ask: { lane: 'estimators', words: 'Price CO 3', about: 'JP9001', lands_in: 'estimator_requests', pushed_by: 'notify-estimator-request' },
      papers_on_part: 2,
      history_line: 'Kept change order CO 3, the owner, on Issued set: adds a hose bibb',
    })
    expect(String(dry.reply.history)).toContain("ZZ Test Meadows's History")
  })
  it('an owed paper on the site itself: the ask is about the site, the line reads asked, the History line reads Owed', () => {
    const built = planPartInput('plan_paper', { paper: { part_id: PART, kind: 'report', name: 'Soil report', from: 'engineer', owed: true, came_on: '2026-10-27', memo: 'before the slab', ask: { lane: 'dispatch', words: 'The engineer owes the soil report' } } })
    if (!built.ok) throw new Error(built.error)
    const dry = planPartDryRun(built.p, world(), TODAY)
    expect(dry).toMatchObject({ ok: true, reply: { paper: { owed: true, link: '', job: null, line: 'Report · the engineer · asked Oct 27' }, ask: { about: '🏠 ZZ Test Meadows', lands_in: 'dispatch_requests' }, history_line: 'Owed: Soil report from the engineer · before the slab' } })
    expect(paperHistoryLine({ kind: 'report', name: 'Soil report', from: 'ours', memo: '', owed: true }, null, null)).toBe('Owed: Soil report from us')
  })
  it('a paper on a job outside any development writes no History line, and a paper cannot go with a paper or replace a drawing', () => {
    const own = world({ part: { id: PART, development_id: null, job_id: JOB, name: 'ZZ North plumbing', current_set_id: ISSUED }, development: null, job: { id: JOB, job_name: 'ZZ North plumbing', click_number: '9001', hcp_number: null, plan_part_id: PART, development_id: null } })
    const built = planPartInput('plan_paper', { paper: { job_id: JOB, kind: 'spec', name: 'Spec book', from: 'architect' } })
    if (!built.ok) throw new Error(built.error)
    expect(planPartDryRun(built.p, own, TODAY)).toMatchObject({ ok: true, reply: { part: { on: 'job', job: { label: 'JP9001' } }, history_line: null, history: expect.stringContaining('no site History') } })
    const withPaper = planPartInput('plan_paper', { paper: { part_id: PART, kind: 'spec', name: 'x', from: 'gc', goes_with_set_id: TASKLIST } })
    if (!withPaper.ok) throw new Error(withPaper.error)
    expect(planPartDryRun(withPaper.p, world(), TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('goes with a set of drawings') })
    const overDrawing = planPartInput('plan_paper', { paper: { part_id: PART, kind: 'spec', name: 'x', from: 'gc', replaces_paper_id: PERMIT } })
    if (!overDrawing.ok) throw new Error(overDrawing.error)
    expect(planPartDryRun(overDrawing.p, world(), TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('a paper replaces a paper') })
  })
  it('came: only an owed paper, never a drawing or one that already came', () => {
    const built = planPartInput('plan_paper', { paper: { action: 'came', paper_id: OWED, link: 'https://drive.google.com/file/d/s/view' } })
    if (!built.ok) throw new Error(built.error)
    const w = world()
    expect(planPartDryRun(built.p, { ...w, paper: w.sets[3] ?? null }, TODAY)).toMatchObject({ ok: true, reply: { action: 'came', paper: { id: OWED, name: 'Soil report', owed: true, link_before: '' }, after: { owed: false, link: 'https://drive.google.com/file/d/s/view' } } })
    expect(planPartDryRun(built.p, { ...w, paper: w.sets[2] ?? null }, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('already came') })
    expect(planPartDryRun(built.p, { ...w, paper: w.sets[1] ?? null }, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('not a paper') })
    expect(planPartDryRun(built.p, { ...w, paper: null }, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('No paper') })
  })
  it('the hash moves when a set is added to the part or the part switches, and holds across runs', async () => {
    const built = addSet()
    if (!built.ok) throw new Error(built.error)
    const a = planPartDryRun(built.p, world(), TODAY)
    const b = planPartDryRun(built.p, world(), TODAY)
    const w = world()
    const more = planPartDryRun(built.p, world({ sets: [...w.sets, setRow({ id: PART2, name: 'Bulletin 1', kind: 'bulletin' })] }), TODAY)
    const switched = planPartDryRun(built.p, world({ part: { ...w.part!, current_set_id: PERMIT } }), TODAY)
    if (!a.ok || !b.ok || !more.ok || !switched.ok) throw new Error('dry run refused')
    const h = await Promise.all([a.reply, b.reply, more.reply, switched.reply].map((r) => planHash('plan_plan_set', built.p, r)))
    expect(h[0]).toBe(h[1])
    expect(h[2]).not.toBe(h[0])
    expect(h[3]).not.toBe(h[0])
  })
})

describe('readPlanPartWorld — the reads, as the dev', () => {
  const rows: Record<string, Json[]> = {
    jobs_ledger: [{ id: JOB, job_name: 'ZZ North plumbing', click_number: '9001', hcp_number: null, plan_part_id: PART, development_id: DEV }],
    plan_parts: [{ id: PART, development_id: DEV, job_id: null, name: 'North Wing', current_set_id: ISSUED }],
    developments: [{ id: DEV, name: 'ZZ Test Meadows' }],
    plan_sets: [{ ...setRow({ id: ISSUED, name: 'Issued set', kind: 'issued' }) }, { ...setRow({ id: OWED, name: 'Soil report', kind: 'report', owed: true, link: '' }) }],
  }
  it('from a job: the job, its part, the development and every set on the part', async () => {
    const f = fake(rows)
    const built = planPartInput('plan_plan_set', { set: { job_id: JOB, name: 'x', kind: 'issued', source: 'gc' } })
    if (!built.ok) throw new Error(built.error)
    const w = await readPlanPartWorld(f.reads, built.p)
    expect(w.part?.name).toBe('North Wing')
    expect(w.development?.name).toBe('ZZ Test Meadows')
    expect(w.job?.id).toBe(JOB)
    expect(w.sets.map((s) => s.name)).toEqual(['Issued set', 'Soil report'])
    expect(f.calls).toEqual([
      `read jobs_ledger select=id,job_name,click_number,hcp_number,plan_part_id,development_id&id=eq.${JOB}`,
      `read plan_parts select=id,development_id,job_id,name,current_set_id&id=eq.${PART}`,
      `read developments select=id,name&id=eq.${DEV}`,
      `read plan_sets select=id,part_id,name,kind,source,link,owed,came_at,marks_up_set_id,replaces_set_id,job_id&part_id=eq.${PART}&order=came_at.desc`,
    ])
  })
  it('for came: the paper first, then its part', async () => {
    const f = fake(rows)
    const built = planPartInput('plan_paper', { paper: { action: 'came', paper_id: OWED, link: 'https://x.y/z' } })
    if (!built.ok) throw new Error(built.error)
    const w = await readPlanPartWorld(f.reads, built.p)
    expect(w.paper?.name).toBe('Soil report')
    expect(w.part?.id).toBe(PART)
    expect(f.calls[0]).toContain(`read plan_sets select=id,part_id,name,kind,source,link,owed,came_at,marks_up_set_id,replaces_set_id,job_id&id=eq.${OWED}`)
  })
  it('a row RLS hides is a row that is not there', async () => {
    const f = fake({})
    const built = planPartInput('plan_plan_set', { set: { part_id: PART, name: 'x', kind: 'issued', source: 'gc' } })
    if (!built.ok) throw new Error(built.error)
    const w = await readPlanPartWorld(f.reads, built.p)
    expect(w).toEqual({ part: null, development: null, job: null, sets: [], paper: null })
  })
})

describe('planPartApply — the rows planSetsIo writes, in its order', () => {
  it('a set: the plan_sets row, then the part’s current set when make_current (the job link follows by trigger)', async () => {
    const f = fake({})
    const built = planPartInput('plan_plan_set', { set: { job_id: JOB, name: 'Addendum 1', kind: 'addendum', source: 'gc', dated: '2026-11-01', memo: 'm', link: 'https://drive.google.com/drive/folders/a', make_current: true } })
    if (!built.ok) throw new Error(built.error)
    const dry = planPartDryRun(built.p, world(), TODAY)
    if (!dry.ok) throw new Error(dry.refused)
    const reply = await planPartApply(f.writes, built.p, dry.reply, { userId: ME }, '2026-11-02T18:00:00.000Z')
    expect(f.written).toEqual([
      { op: 'insert', table: 'plan_sets', row: { part_id: PART, name: 'Addendum 1', kind: 'addendum', source: 'gc', dated: '2026-11-01', memo: 'm', link: 'https://drive.google.com/drive/folders/a', replaces_set_id: ISSUED, marks_up_set_id: null, job_id: null, created_by: ME } },
      { op: 'update', table: 'plan_parts', query: `id=eq.${PART}`, row: { current_set_id: 'made-1', current_set_by: ME, current_set_at: '2026-11-02T18:00:00.000Z' } },
    ])
    expect(reply).toMatchObject({ ok: true, action: 'add_set', set_id: 'made-1', part_id: PART, builds_from: 'Addendum 1' })
    expect(String(reply.next)).toContain('builds from Addendum 1 now')
  })
  it('a set kept under Older sets touches the part not at all; an as-built carries the job and what it marks up', async () => {
    const f = fake({})
    const built = planPartInput('plan_plan_set', { set: { job_id: JOB, name: 'As-built · JP9001 · 2026-11-02', kind: 'as_built', source: 'ours', link: 'https://drive.google.com/file/d/ab/view' } })
    if (!built.ok) throw new Error(built.error)
    const dry = planPartDryRun(built.p, world(), TODAY)
    if (!dry.ok) throw new Error(dry.refused)
    const reply = await planPartApply(f.writes, built.p, dry.reply, { userId: ME }, '2026-11-02T18:00:00.000Z')
    expect(f.written).toEqual([{ op: 'insert', table: 'plan_sets', row: expect.objectContaining({ kind: 'as_built', source: 'ours', marks_up_set_id: ISSUED, job_id: JOB, replaces_set_id: null }) }])
    expect(reply).toMatchObject({ builds_from: 'Issued set' })
    expect(String(reply.next)).toContain('Our as-builts')
  })
  it('a paper with an ask: the question into its lane first, then the row naming it, then the lane’s push — a push that fails never fails the keep', async () => {
    const f = fake({})
    const built = planPartInput('plan_paper', { paper: { job_id: JOB, kind: 'task_list', name: "Owner's punch list", from: 'gc', came_on: '2026-10-26', memo: 'fixtures ordered', link: 'https://drive.google.com/file/d/t/view', goes_with_set_id: ISSUED, ask: { lane: 'estimators', words: 'Do the fixtures change the rough-in?' } } })
    if (!built.ok) throw new Error(built.error)
    const dry = planPartDryRun(built.p, world(), TODAY)
    if (!dry.ok) throw new Error(dry.refused)
    const reply = await planPartApply(f.writes, built.p, dry.reply, { userId: ME }, '2026-11-02T18:00:00.000Z')
    expect(f.written).toEqual([
      { op: 'insert', table: 'estimator_requests', row: { from_user_id: ME, title: 'Do the fixtures change the rough-in?', links: [], development_id: null, job_ledger_id: JOB, bid_id: null, reference_summary: 'JP9001' } },
      { op: 'insert', table: 'plan_sets', row: { part_id: PART, name: "Owner's punch list", kind: 'task_list', source: 'gc', dated: null, came_at: '2026-10-26T12:00:00', memo: 'fixtures ordered', link: 'https://drive.google.com/file/d/t/view', marks_up_set_id: ISSUED, replaces_set_id: null, job_id: JOB, owed: false, ask_lane: 'estimators', ask_request_id: 'made-1', created_by: ME } },
    ])
    expect(f.calls[f.calls.length - 1]).toBe('invoke notify-estimator-request {"estimator_request_id":"made-1"}')
    expect(reply).toMatchObject({ ok: true, action: 'keep', paper_id: 'made-2', ask: { lane: 'estimators', request_id: 'made-1', pushed: true, push_error: null }, history_line: "Kept task list Owner's punch list, the owner, on Issued set: fixtures ordered" })
    // The push refused: the row stands, the reply says so.
    const g = fake({})
    g.writes.invoke = async () => ({ ok: false, error: 'notify-estimator-request answered 500' })
    const again = await planPartApply(g.writes, built.p, dry.reply, { userId: ME }, '2026-11-02T18:00:00.000Z')
    expect(again).toMatchObject({ ask: { pushed: false, push_error: 'notify-estimator-request answered 500' } })
    expect(String(again.next)).toContain('the push did not go')
  })
  it('an owed paper on the site: the ask names the site and its development, the row has no link; came clears it', async () => {
    const f = fake({})
    const built = planPartInput('plan_paper', { paper: { part_id: PART, kind: 'report', name: 'Soil report', from: 'engineer', owed: true, came_on: '2026-10-27', ask: { lane: 'dispatch', words: 'The engineer owes the soil report' } } })
    if (!built.ok) throw new Error(built.error)
    const dry = planPartDryRun(built.p, world(), TODAY)
    if (!dry.ok) throw new Error(dry.refused)
    const reply = await planPartApply(f.writes, built.p, dry.reply, { userId: ME }, '2026-11-02T18:00:00.000Z')
    expect(f.written[0]).toEqual({ op: 'insert', table: 'dispatch_requests', row: { from_user_id: ME, title: 'The engineer owes the soil report', links: [], development_id: DEV, job_ledger_id: null, bid_id: null, reference_summary: '🏠 ZZ Test Meadows' } })
    expect(f.written[1]).toMatchObject({ table: 'plan_sets', row: { owed: true, link: '', job_id: null, ask_lane: 'dispatch', ask_request_id: 'made-1', came_at: '2026-10-27T12:00:00' } })
    expect(f.calls[f.calls.length - 1]).toBe('invoke notify-dispatch-request {"dispatch_request_id":"made-1"}')
    expect(String(reply.next)).toContain('action: came')
    const came = planPartInput('plan_paper', { paper: { action: 'came', paper_id: OWED, link: 'https://drive.google.com/file/d/s/view' } })
    if (!came.ok) throw new Error(came.error)
    const w = world()
    const cameDry = planPartDryRun(came.p, { ...w, paper: w.sets[3] ?? null }, TODAY)
    if (!cameDry.ok) throw new Error(cameDry.refused)
    const g = fake({})
    const cameReply = await planPartApply(g.writes, came.p, cameDry.reply, { userId: ME }, '2026-11-02T18:00:00.000Z')
    expect(g.written).toEqual([{ op: 'update', table: 'plan_sets', query: `id=eq.${OWED}`, row: { owed: false, link: 'https://drive.google.com/file/d/s/view', came_at: '2026-11-02T18:00:00.000Z' } }])
    expect(cameReply).toMatchObject({ ok: true, action: 'came', paper_id: OWED, part_id: PART })
  })
  it('a paper with no ask writes one row and invokes nothing', async () => {
    const f = fake({})
    const built = planPartInput('plan_paper', { paper: { part_id: PART, kind: 'spec', name: 'Spec book', from: 'architect', link: 'https://drive.google.com/file/d/sb/view' } })
    if (!built.ok) throw new Error(built.error)
    const dry = planPartDryRun(built.p, world(), TODAY)
    if (!dry.ok) throw new Error(dry.refused)
    const reply = await planPartApply(f.writes, built.p, dry.reply, { userId: ME }, '2026-11-02T18:00:00.000Z')
    expect(f.calls).toEqual(['insert plan_sets'])
    expect(f.written[0]?.row).toMatchObject({ ask_lane: null, ask_request_id: null, owed: false, came_at: `${TODAY}T12:00:00` })
    expect(reply).toMatchObject({ ask: null })
  })
})

describe('a filed plan set lands on the bid’s job’s part too (plan_file_plans / apply_file_plans, twin-mcp file_plans)', () => {
  const jobs = [
    { id: JOB, job_name: 'ZZ North plumbing', click_number: '9001', hcp_number: null, plan_part_id: PART },
    { id: PART2, job_name: 'ZZ North billing', click_number: '9002', hcp_number: null, plan_part_id: PART },
    { id: DEV, job_name: 'ZZ South plumbing', click_number: null, hcp_number: '9100', plan_part_id: PART2 },
    { id: ISSUED, job_name: 'No part yet', click_number: '974', hcp_number: null, plan_part_id: null },
  ]
  const parts = [
    { id: PART, name: 'North Wing', current_set_id: ISSUED },
    { id: PART2, name: 'South Wing', current_set_id: null },
  ]
  it('one target per distinct part, its jobs named, current only where the part builds from nothing', () => {
    expect(filedPlansTargets(jobs, parts)).toEqual([
      { part_id: PART, part_name: 'North Wing', jobs: ['JP9001', 'JP9002'], make_current: false },
      { part_id: PART2, part_name: 'South Wing', jobs: ['JP9100'], make_current: true },
    ])
    expect(filedPlansTargets([], [])).toEqual([])
    expect(filedPlansTargets(jobs, [])).toEqual([]) // a part RLS hides is not written to
    expect(jobLabel({ click_number: '', hcp_number: 'HCP-9', job_name: 'x' })).toBe('HCP-9')
    expect(jobLabel({ click_number: null, hcp_number: null, job_name: null })).toBe('this job')
  })
  it('the row is an issued set from the GC with the file’s facts as plan-fetch keeps them', () => {
    const t = filedPlansTargets(jobs, parts)[1]!
    expect(filedPlansSetRow(t, { name: 'Plans for the robot', link: 'https://drive.google.com/drive/folders/f', memo: 'North 25 + South 44', file_name: 'plans.pdf', file_size: 1048576, pages: 12, createdBy: ME }, '2026-11-02T18:00:00.000Z')).toEqual({
      part_id: PART2, name: 'Plans for the robot', kind: 'issued', source: 'gc', dated: null, memo: 'North 25 + South 44', link: 'https://drive.google.com/drive/folders/f', file_name: 'plans.pdf', file_size: 1048576, file_count: 1, checked_at: '2026-11-02T18:00:00.000Z', check_note: '12 pages', created_by: ME,
    })
    expect(filedPlansSetRow(t, { name: 'Plans', link: 'https://x', memo: '', file_name: null, file_size: null, pages: null, createdBy: null }, 'now')).toMatchObject({ file_count: null, checked_at: null, check_note: null })
  })
  it('the words say where it landed, or that the bid’s row is alone', () => {
    expect(filedPlansWords(filedPlansTargets(jobs, parts))).toBe('North Wing (JP9001, JP9002) — under Older sets; the part keeps its current set; South Wing (JP9100) — builds from it now')
    expect(filedPlansWords([])).toContain('bid_plan_sets')
  })
  it('two links are the same set across space, a trailing slash and Drive’s ?usp= tail, as the database’s plan_set_link_key reads them', () => {
    const folder = 'https://drive.google.com/drive/folders/abc123'
    expect(planLinkKey(` ${folder}/ `)).toBe(folder)
    expect(planLinkKey(`${folder}?usp=sharing`)).toBe(folder)
    expect(planLinkKey(null)).toBe('')
    expect(PRICED_MIGRATION).toContain("regexp_replace(regexp_replace(regexp_replace(btrim(COALESCE(p_link, '')), '[?&]usp=[^&#]*', '', 'g'), '\\?$', ''), '/+$', '')")
    // Both seats skip a part that already holds the filed link.
    expect(SERVER).toContain("const onPart = await restGet(session, 'plan_sets', `select=id,link&part_id=eq.${t.part_id}`)")
    expect(SERVER).toContain('planLinkKey(r.link) === planLinkKey(folderLink)')
    expect(TWIN).toContain('planLinkKey(r.link) === planLinkKey(plansLink)')
  })
  it('the dev seat commits the parts into the plan hash and writes them after the RPC; the twin seat lands the rows after drive-intake, from 1.11.0 on', () => {
    expect(SERVER).toContain("const jobsRes = await restGet(session, 'jobs_ledger', `select=id,job_name,click_number,hcp_number,plan_part_id&bid_id=eq.${plans.bid_id}&plan_part_id=not.is.null`)")
    expect(SERVER).toContain('const targets = filedPlansTargets(partJobs, parts)')
    expect(SERVER).toContain('const committed = { ...((dry.body as Record<string, unknown> | null) ?? {}), job_parts: targets }')
    expect(SERVER).toContain('const fresh = await planHash(name, built.body.p, committed)')
    expect(SERVER).toContain('lands_on_parts: filedPlansWords(targets)')
    expect(SERVER).toContain("const ins = await restRows(session, 'POST', 'plan_sets', '', row)")
    expect(SERVER).toContain('plan_parts: { words: filedPlansWords(targets), sets: partSets }')
    expect(TWIN).toContain("from '../_shared/devMcpPlanSets.ts'")
    expect(TWIN).toContain('const landed = await landFiledPlans(admin, twin, String(args.bid ?? \'\').trim(), plansLink, typeof args.plans_file_name === \'string\' ? args.plans_file_name : null)')
    expect(TWIN).toContain("admin.from('bid_plan_sets').insert({ bid_id: bid.id, name: setName, link: plansLink, memo: 'Filed by the robot (file_plans)'")
    expect(TWIN).toContain("admin.from('plan_sets').insert(row as never).select('id').single()")
    // The landing shipped in server 1.11.0; a later version still carries it, so the pin is a floor, not an exact match.
    const served = /serverInfo: \{ name: 'pipetooling-twin-mcp', version: '(\d+)\.(\d+)\.(\d+)' \}/.exec(TWIN)
    expect(served, 'twin-mcp names its version').not.toBeNull()
    const [major, minor] = [Number(served![1]), Number(served![2])]
    expect(major > 1 || (major === 1 && minor >= 11), `twin-mcp ${served![0]} is at least 1.11.0`).toBe(true)
  })
})
