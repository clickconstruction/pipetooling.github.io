import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CALIBRATION_PERSON_SELECT,
  CALIBRATION_RUN_SELECT,
  calibrationRunCounts,
  calibrationStandardAppliedWords,
  calibrationStandardDryRun,
  calibrationStandardInput,
  calibrationStandardPatch,
  calibrationStandardPatchQuery,
  isCalibrationStandardVerb,
  type CalibrationPersonRow,
  type CalibrationRunRow,
  type CalibrationWorld,
} from '../../../supabase/functions/_shared/devMcpCalibrationStandard'
import { TEACHER_ROLES, canBeCalibrationStandard, teacherCandidates } from '../../../supabase/functions/_shared/twinTeachers'
import { WRITE_VERBS, alreadyApplied, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import * as clientTeachers from '../twinTeachers'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const PANEL = readFileSync('src/components/settings/DigitalTwinsPanel.tsx', 'utf8')
const TWIN_SEAT = readFileSync('supabase/functions/twin-mcp/index.ts', 'utf8')

// Made-up people: no real name or address.
const A = 'aaaaaaaa-1111-4111-8111-111111111111'
const B = 'bbbbbbbb-2222-4222-8222-222222222222'
const person = (over: Partial<CalibrationPersonRow> = {}): CalibrationPersonRow => ({ id: A, name: 'Ada Example', email: 'ada@example.com', role: 'estimator', is_digital_twin: false, archived_at: null, calibration_standard: false, ...over })
const other = (over: Partial<CalibrationPersonRow> = {}): CalibrationPersonRow => person({ id: B, name: 'Bo Example', email: 'bo@example.com', calibration_standard: true, ...over })
const run = (axis: string | null, assisted = false): CalibrationRunRow => ({ axis, assisted_at: assisted ? '2026-11-01T00:00:00Z' : null })
const RUNS = [run('small TI'), run('small TI'), run('institutional'), run(null), run('small TI', true)]
const world = (over: Partial<CalibrationWorld> = {}): CalibrationWorld => ({ person: person(), standards: [], runs: [], ...over })
const plan = (standard: boolean, w: Partial<CalibrationWorld> = {}) => {
  const dry = calibrationStandardDryRun({ person: A, standard }, world(w))
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply as { person: Record<string, unknown>; from: string; to: string; standards_before: unknown[]; standards_after: unknown[]; scored_shadow_runs: Record<string, unknown> | null; warnings: string[]; then: string }
}
const refusal = (standard: boolean, w: Partial<CalibrationWorld> = {}): string => {
  const dry = calibrationStandardDryRun({ person: A, standard }, world(w))
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('the calibration standard from the dev seat (v2.7934)', () => {
  it('is two write verbs on the allowlist with no wrapper RPC', () => {
    expect(WRITE_VERBS.plan_calibration_standard).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_calibration_standard).toEqual({ rpc: null, step: 'apply' })
    expect(isCalibrationStandardVerb('apply_calibration_standard')).toBe(true)
    expect(isCalibrationStandardVerb('plan_twin_rung')).toBe(false)
    expect(planVerbFor('apply_calibration_standard')).toBe('plan_calibration_standard')
  })

  it('takes a person by id and true or false, and nothing else', () => {
    expect(calibrationStandardInput('plan_calibration_standard', { calibration: { person: ` ${A.toUpperCase()} `, standard: true } })).toEqual({ ok: true, p: { person: A, standard: true }, target: A })
    for (const bad of [{}, { calibration: 'ada' }, { calibration: { standard: true } }, { calibration: { person: 'Ada Example', standard: true } }, { calibration: { person: A } }, { calibration: { person: A, standard: 'true' } }, { calibration: { person: A, standard: null } }]) {
      const r = calibrationStandardInput('plan_calibration_standard', bad)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('plan_calibration_standard needs calibration — { person (a users.id — find_person)')
    }
    expect(calibrationStandardInput('apply_calibration_standard', { calibration: { person: A, standard: true, role: 'dev' } })).toEqual({ ok: false, error: 'apply_calibration_standard: calibration takes person and standard alone, not role.' })
    const built = writeRpcBody('apply_calibration_standard', { calibration: { person: A, standard: false }, plan_hash: 'b'.repeat(64) })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', body: { p: { person: A, standard: false } }, dryRunBody: null, target: A, planHash: 'b'.repeat(64) })
  })

  it('offers whom the panel offers: the rule is one kernel, and the client re-exports it', () => {
    expect(clientTeachers.teacherCandidates).toBe(teacherCandidates)
    expect(clientTeachers.TEACHER_ROLES).toBe(TEACHER_ROLES)
    expect(PANEL).toContain("from '../../lib/twinTeachers'")
    expect(PANEL).toContain('{teacherCandidates(teachers).map((u) => (')
    expect(canBeCalibrationStandard(person())).toBe(true)
    expect(canBeCalibrationStandard(person({ role: 'subcontractor' }))).toBe(false)
    expect(canBeCalibrationStandard(person({ is_digital_twin: true }))).toBe(false)
    expect(canBeCalibrationStandard(person({ archived_at: '2026-01-01T00:00:00Z' }))).toBe(false)
    // A flag already set never hides, so it can always be lifted.
    expect(teacherCandidates([person({ archived_at: '2026-01-01T00:00:00Z', calibration_standard: true })])).toHaveLength(1)
    for (const c of CALIBRATION_PERSON_SELECT.split(',')) expect(Object.keys(CATALOG_TABLES.users?.columns ?? {}), c).toContain(c)
    for (const c of [...CALIBRATION_RUN_SELECT.split(','), 'status', 'teacher_user_id']) expect(Object.keys(CATALOG_TABLES.twin_shadow_runs?.columns ?? {}), c).toContain(c)
  })

  it('counts a person’s scored runs as the gate reads them: assisted runs apart, the rest by axis', () => {
    expect(calibrationRunCounts(RUNS)).toEqual({ scored: 5, counted: 4, assisted: 1, by_axis: { institutional: 1, 'small TI': 2, unclassified: 1 } })
    expect(calibrationRunCounts([])).toEqual({ scored: 0, counted: 0, assisted: 0, by_axis: {} })
    // twin-mcp's gate math: a standard teacher's run counts unless the estimator took robot fixtures on it.
    expect(TWIN_SEAT).toContain('const isStandard = !!r.teacher_user_id && standardIds.has(r.teacher_user_id as string) && !r.assisted_at')
  })

  it('plans the first standard: who stands after, and the scored runs that start to count', () => {
    const reply = plan(true, { runs: RUNS })
    expect(reply).toMatchObject({
      person: { id: A, name: 'Ada Example', role: 'estimator', archived: false },
      from: 'not a calibration standard',
      to: 'a calibration standard',
      standards_before: [],
      standards_after: [{ id: A, name: 'Ada Example' }],
      scored_shadow_runs: { scored: 5, counted: 4, assisted: 1, at_least: false },
      warnings: [],
    })
    expect(reply.then).toContain('apply sets calibration_standard true on their users row as you, as the ★ Calibration standard card at Settings → System → Digital twins does.')
    expect(reply.then).toContain('Ada Example is the calibration standard — only shadows scored against their sent numbers count toward Gate B.')
    expect(reply.then).toContain('4 scored shadow runs that name Ada Example as teacher would count toward Gate B, where they read as practice today. 1 more is assisted (the estimator took robot fixtures) and never counts either way.')
    expect(reply.then).toContain('no score is rewritten')
    expect(reply.then).toContain('The way back is this pair with standard: false.')
  })

  it('warns when a new standard would stand beside another, and when the last one would be lifted', () => {
    const beside = plan(true, { standards: [other()] })
    expect(beside.warnings).toEqual(['Bo Example is the standard today, and Ada Example would be one beside them: this door adds, it does not replace.'])
    expect(beside.standards_after).toEqual([{ id: A, name: 'Ada Example' }, { id: B, name: 'Bo Example' }])
    expect(beside.then).toContain('No scored shadow run names Ada Example as teacher yet, so no score moves today: the flag decides the ones to come.')
    const last = plan(false, { person: person({ calibration_standard: true }), standards: [person({ calibration_standard: true })], runs: [run('small TI')] })
    expect(last.warnings).toEqual(['No calibration standard would be left: every shadow score counts as practice and Gate B cannot be met.'])
    expect(last.standards_after).toEqual([])
    expect(last.then).toContain('1 scored shadow run that names Ada Example as teacher would read as practice, where it counts toward Gate B today.')
    expect(last.then).toContain('The way back is this pair with standard: true.')
    const oneOfTwo = plan(false, { person: person({ calibration_standard: true }), standards: [person({ calibration_standard: true }), other()] })
    expect(oneOfTwo.warnings).toEqual([])
    expect(oneOfTwo.standards_after).toEqual([{ id: B, name: 'Bo Example' }])
  })

  it('says so when the runs could not be read, and when the count stopped at its limit', () => {
    expect(plan(true, { runs: null }).scored_shadow_runs).toBeNull()
    expect(plan(true, { runs: null }).then).toContain('could not be read, so how many move is not known')
    const many = plan(true, { runs: Array.from({ length: 1000 }, () => run('small TI')) })
    expect(many.scored_shadow_runs).toMatchObject({ scored: 1000, at_least: true })
    expect(many.then).toContain('At least 1000 scored shadow runs')
  })

  it('refuses in words: no person, a person already as asked, and a new standard the card would not offer', () => {
    expect(refusal(true, { person: null })).toBe(`No person ${A} is visible to you — find_person resolves a name.`)
    expect(refusal(false)).toContain('Nothing to plan: Ada Example is not a calibration standard. No calibration standard set')
    expect(refusal(true, { person: person({ calibration_standard: true }), standards: [person({ calibration_standard: true })] })).toContain('Nothing to plan: Ada Example is already a calibration standard.')
    expect(refusal(true, { person: person({ is_digital_twin: true }) })).toContain('Ada Example is a digital twin, and the robots calibrate to people.')
    expect(refusal(true, { person: person({ archived_at: '2026-01-01T00:00:00Z' }) })).toContain('Ada Example is archived.')
    expect(refusal(true, { person: person({ role: 'subcontractor' }) })).toContain('Ada Example is a subcontractor, and the roles that send bids the robots could learn from are estimator, dev, master_technician, assistant.')
    // An archived standard can still be lifted: the flag never hides on the card either.
    expect(plan(false, { person: person({ archived_at: '2026-01-01T00:00:00Z', calibration_standard: true }), standards: [person({ archived_at: '2026-01-01T00:00:00Z', calibration_standard: true }), other()] }).to).toBe('not a calibration standard')
  })

  it('the plan commits to the person, the standards and the runs', async () => {
    const p = { person: A, standard: true }
    const a = calibrationStandardDryRun(p, world({ runs: RUNS }))
    const same = calibrationStandardDryRun(p, world({ runs: [...RUNS] }))
    const another = calibrationStandardDryRun(p, world({ runs: RUNS, standards: [other()] }))
    const scored = calibrationStandardDryRun(p, world({ runs: [...RUNS, run('small TI')] }))
    if (!a.ok || !same.ok || !another.ok || !scored.ok) throw new Error('expected plans')
    const hash = await planHash('plan_calibration_standard', p, a.reply)
    expect(await planHash('apply_calibration_standard', p, same.reply)).toBe(hash)
    expect(await planHash('apply_calibration_standard', p, another.reply)).not.toBe(hash)
    expect(await planHash('apply_calibration_standard', p, scored.reply)).not.toBe(hash)
  })

  it('the write is the panel’s, held to the row as the plan read it, and the closing line is the panel’s toast', () => {
    expect(calibrationStandardPatch(true)).toEqual({ calibration_standard: true })
    expect(PANEL).toContain(".from('users').update({ calibration_standard: standard }).eq('id', u.id).select('id')")
    expect(calibrationStandardPatchQuery(person(), true)).toBe(`id=eq.${A}&calibration_standard=not.is.true&is_digital_twin=not.is.true&archived_at=is.null`)
    expect(calibrationStandardPatchQuery(person(), false)).toBe(`id=eq.${A}&calibration_standard=is.true`)
    expect(calibrationStandardAppliedWords(true, person(), true)).toBe(`Ada Example is now a calibration standard — shadows scored against their bids count toward Gate B. The way back is plan_calibration_standard { calibration: { person: "${A}", standard: false } }.`)
    expect(calibrationStandardAppliedWords(true, person(), false)).toContain('Ada Example is no longer a calibration standard — their shadow scores now read as practice.')
    expect(calibrationStandardAppliedWords(false, person(), true, 'no row changed: the flag moved a moment ago, or RLS let no row through')).toBe('Nothing changed: Ada Example is still not a calibration standard (no row changed: the flag moved a moment ago, or RLS let no row through). Plan again from the row as it stands.')
    expect(alreadyApplied('apply_calibration_standard', { target: A, at: null })).toContain('Nothing written: this plan was already applied')
  })

  it('the server declares the pair, writes one row of users, and the docs carry the door', () => {
    for (const verb of ['plan_calibration_standard', 'apply_calibration_standard']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    const from = SERVER.indexOf("case 'plan_calibration_standard':")
    const branch = SERVER.slice(from, SERVER.indexOf("case 'plan_robot_book_price':", from))
    expect(branch).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    expect(branch).toContain("await restGet(session, 'users', `select=${CALIBRATION_PERSON_SELECT}&id=eq.${p.person}&limit=1`)")
    expect(branch).toContain("await restGet(session, 'twin_shadow_runs', `select=${CALIBRATION_RUN_SELECT}&status=eq.scored&teacher_user_id=eq.${p.person}&limit=${CALIBRATION_RUNS_LIMIT}`)")
    expect(branch).toContain("await restRows(session, 'PATCH', 'users', `${calibrationStandardPatchQuery(dry.person, p.standard)}&select=id`, calibrationStandardPatch(p.standard), 'return=representation')")
    expect(branch.match(/restRows\(/g)).toHaveLength(1) // one write, and it is the flag
    expect(branch).not.toContain("'twin_shadow_runs', `id=eq.") // no score is rewritten
    expect(branch).toContain('if (fresh !== built.planHash) return refused(planMismatch(')
    expect(branch).toContain('const prior = await hooks.priorApply(name, fresh)')
    expect(SERVER).toContain("const SERVER_VERSION = '0.111.0'")
    expect(SERVER).toContain('Writes are one hundred and thirty-seven verbs and nothing else')
    expect(SERVER).toContain('plan_calibration_standard → apply_calibration_standard (a person made a calibration standard')
    expect(README).toContain('| `plan_calibration_standard(calibration)` · `apply_calibration_standard(calibration, plan_hash)` |')
    expect(README).toContain("one hundred and thirty-five since v2.7934's calibration standard pair")
    expect(README).toContain('one hundred and thirty-seven `plan_` / `apply_` / `revert_` verbs')
    expect(EDGE).toContain('v2.7934 (server 0.110.0) — a calibration standard set from the seat')
  })
})
