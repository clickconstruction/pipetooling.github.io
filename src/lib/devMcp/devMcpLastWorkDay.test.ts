/**
 * The dev seat's last day of work (v2.7206; server 0.84.0): plan_last_work_day → apply_last_work_day. The kernel runs
 * here against a recording fake; the pins hold the server, its instructions, the README and the function docs to it,
 * and hold the verb to the Lien window's own save and its own rules.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CLOCK_PAGE,
  LAST_WORK_DAY_VERBS,
  LAST_WORK_JOB_COLS,
  LAST_WORK_REASON_MAX,
  isLastWorkDayVerb,
  lastWorkDayAppliedWords,
  lastWorkDayDryRun,
  lastWorkDayInput,
  lastWorkDayPatch,
  readLastWorkWorld,
  type LastWorkDayPayload,
  type LastWorkJobRow,
  type LastWorkWorld,
} from '../../../supabase/functions/_shared/devMcpLastWorkDay'
import { WRITE_VERBS, isWriteVerb, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { LIEN_LAST_WORK_CLEAR, lienLastWorkDayPatch } from '../jobs/lienLastWorkDay'
import { lienLastWorkPreview } from '../jobs/lienLastWorkDayPreview'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const WINDOW_LINE = readFileSync('src/components/jobs/LienLastWorkDayLine.tsx', 'utf8')
const WINDOW_CONFIRM = readFileSync('src/components/jobs/LienLastWorkDayConfirm.tsx', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261006120000_lien_last_work_day.sql', 'utf8')
const KERNELS = readFileSync('scripts/edge-kernels.mjs', 'utf8')

const JOB = '99999999-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const TODAY = '2026-11-13'

const job = (over: Partial<LastWorkJobRow> = {}): LastWorkJobRow => ({
  id: JOB, job_name: 'ZZ TEST seat walk', click_number: '', hcp_number: '608', status: 'billed', created_at: '2026-02-24T15:15:24+00:00', customer_address_id: 'aaaaaaaa-1111-4111-8111-111111111111',
  last_work_date: null, lien_last_work_on: null, lien_last_work_note: '', lien_last_work_set_at: null, lien_last_work_set_by: null,
  ...over,
})
const world = (over: Partial<LastWorkWorld> = {}, jobOver: Partial<LastWorkJobRow> = {}): LastWorkWorld => ({ job: job(jobOver), propertyKind: 'residential', clockMonths: [], noticedMonths: [], ...over })
const day = (over: Record<string, unknown> = {}): LastWorkDayPayload => {
  const built = lastWorkDayInput('plan_last_work_day', { day: { job_id: JOB, last_work_on: '2026-09-11', reason: 'Certified the gas line.', ...over } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const clear: LastWorkDayPayload = { action: 'last_work_day', job_id: JOB, clear: true }
const reply = (d: ReturnType<typeof lastWorkDayDryRun>) => {
  if (!d.ok) throw new Error(d.refused)
  return d.reply as { before: Record<string, unknown>; after: Record<string, unknown>; verdict?: string; shift?: string; says: string; dates: Array<{ what: string; before: string; after: string; changed: boolean }>; not_done: string; property_kind: string }
}

describe('the verbs — in the table, on the server, in the docs', () => {
  it('is a pair that names no RPC, declared and handled by the server at 0.84.0', () => {
    expect(LAST_WORK_DAY_VERBS).toEqual(['plan_last_work_day', 'apply_last_work_day'])
    for (const v of LAST_WORK_DAY_VERBS) {
      expect(isLastWorkDayVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(isLastWorkDayVerb('plan_contract_ended')).toBe(false)
    expect(planVerbFor('apply_last_work_day')).toBe('plan_last_work_day')
    expect(SERVER).toContain("const SERVER_VERSION = '0.87.0'")
    expect(SERVER).toContain('Writes are one hundred and five verbs and nothing else:')
    expect(SERVER).toContain('plan_last_work_day → apply_last_work_day (a job\'s last day of work for the lien clocks')
    expect(SERVER).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    expect(README).toContain('`plan_last_work_day(day)` · `apply_last_work_day(day, plan_hash)`')
    expect(README).toContain("one hundred and one since v2.7206's last day of work")
    expect(EDGE).toContain('**v2.7206 (server 0.84.0)')
  })
  it('writes the window’s own columns with the window’s own patch, and reads the kernels from the mirror', () => {
    for (const col of ['lien_last_work_on', 'lien_last_work_note', 'lien_last_work_set_at', 'lien_last_work_set_by']) {
      expect(MIGRATION).toContain(col)
      expect(LAST_WORK_JOB_COLS).toContain(col)
    }
    expect(WINDOW_LINE).toContain("supabase.from('jobs_ledger').update(patch as never).eq('id', jobId)")
    expect(WINDOW_LINE).toContain('lienLastWorkDayPatch(dayDraft, noteDraft, userId, new Date().toISOString())')
    expect(SERVER).toContain("await restRows(session, 'PATCH', 'jobs_ledger', `id=eq.${p.job_id}`, patch)")
    expect(lastWorkDayPatch(day(), { userId: DEV }, '2026-11-13T22:00:00.000Z')).toEqual(lienLastWorkDayPatch('2026-09-11', 'Certified the gas line.', DEV, '2026-11-13T22:00:00.000Z'))
    expect(lastWorkDayPatch(clear, { userId: DEV }, 'now')).toEqual(LIEN_LAST_WORK_CLEAR)
    expect(KERNELS).toContain("'lib/jobs/lienLastWorkDay.ts': { values: [], types: [] },")
    expect(KERNELS).toContain("'lib/jobs/lienLastWorkDayPreview.ts': { values: [], types: [] },")
    // The window's Set the day is off until a reason stands, and reads Set the day anyway on a far day.
    expect(WINDOW_CONFIRM).toContain('const canSet = !refused && note.trim().length > 0 && !busy')
    expect(WINDOW_CONFIRM).toContain("preview.verdict === 'look' ? 'Set the day anyway' : 'Set the day'")
  })
})

describe('lastWorkDayInput — the shape', () => {
  it('takes a day with its reason, or a clear, and refuses the rest in words', () => {
    expect(lastWorkDayInput('plan_last_work_day', { day: { job_id: JOB.toUpperCase(), last_work_on: ' 2026-09-11 ', reason: ' Certified the gas line. ' } })).toEqual({ ok: true, p: { action: 'last_work_day', job_id: JOB, last_work_on: '2026-09-11', reason: 'Certified the gas line.' }, target: JOB, planHash: null })
    expect(lastWorkDayInput('plan_last_work_day', { day: { job_id: JOB, clear: true } })).toMatchObject({ ok: true, p: { action: 'last_work_day', job_id: JOB, clear: true } })
    expect(day({ anyway: true })).toMatchObject({ anyway: true })
    expect(lastWorkDayInput('plan_last_work_day', {})).toMatchObject({ ok: false, error: expect.stringContaining('plan_last_work_day needs day') })
    expect(lastWorkDayInput('plan_last_work_day', { day: { job_id: 'J608', last_work_on: '2026-09-11', reason: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('find_job') })
    expect(lastWorkDayInput('plan_last_work_day', { day: { job_id: JOB, last_work_on: 'Sep 11', reason: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('last_work_on is YYYY-MM-DD') })
    expect(lastWorkDayInput('plan_last_work_day', { day: { job_id: JOB, last_work_on: '2026-09-11' } })).toMatchObject({ ok: false, error: expect.stringContaining('reason is required') })
    expect(lastWorkDayInput('plan_last_work_day', { day: { job_id: JOB, last_work_on: '2026-09-11', reason: 'x'.repeat(LAST_WORK_REASON_MAX + 1) } })).toMatchObject({ ok: false, error: expect.stringContaining('under 500') })
    expect(lastWorkDayInput('plan_last_work_day', { day: { job_id: JOB, last_work_on: '2026-09-11', reason: 'x', anyway: 'yes' } })).toMatchObject({ ok: false, error: expect.stringContaining('anyway is true or left out') })
    expect(lastWorkDayInput('plan_last_work_day', { day: { job_id: JOB, clear: true, reason: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('no day and no reason') })
    expect(lastWorkDayInput('apply_last_work_day', { day: { job_id: JOB, clear: true } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(lastWorkDayInput('apply_last_work_day', { day: { job_id: JOB, clear: true }, plan_hash: HASH })).toMatchObject({ ok: true, planHash: HASH })
  })
  it('goes through the seat’s one write door with no RPC and no dry-run body', () => {
    const built = writeRpcBody('plan_last_work_day', { day: { job_id: JOB, last_work_on: '2026-09-11', reason: 'Certified the gas line.' } })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'plan', dryRunBody: null, target: JOB })
    expect(writeRpcBody('apply_last_work_day', { day: { job_id: JOB, clear: true } })).toMatchObject({ ok: false })
  })
})

describe('readLastWorkWorld — what the window reads before it draws', () => {
  it('reads the job, its property’s kind, its approved clock months paged, and the months its live notices name', async () => {
    const asked: string[] = []
    const page0 = Array.from({ length: CLOCK_PAGE }, () => ({ work_date: '2026-04-01' }))
    const reads = {
      rows: async (table: string, query: string) => {
        asked.push(`${table}?${query}`)
        if (table === 'jobs_ledger') return [job({ last_work_date: '2026-04-01' })]
        if (table === 'customer_addresses') return [{ property_kind: ' non_residential ' }]
        if (table === 'clock_sessions') return query.includes('offset=0') ? page0 : [{ work_date: '2026-03-31' }, { work_date: null }]
        if (table === 'job_lien_filings') return [{ months_covered: ['2026-04', 'bad'] }, { months_covered: null }, { months_covered: ['2026-03', '2026-04'] }]
        return []
      },
    }
    const w = await readLastWorkWorld(reads, JOB)
    expect(w.job?.id).toBe(JOB)
    expect(w.propertyKind).toBe('non_residential')
    expect(w.clockMonths).toEqual(['2026-03', '2026-04'])
    expect(w.noticedMonths).toEqual(['2026-03', '2026-04'])
    expect(asked[0]).toBe(`jobs_ledger?select=${LAST_WORK_JOB_COLS}&id=eq.${JOB}`)
    // The SQL readers' rule for a month of work: approved, not rejected, not revoked.
    expect(asked.filter((a) => a.startsWith('clock_sessions?'))).toHaveLength(2)
    expect(asked[2]).toContain('approved_at=not.is.null&rejected_at=is.null&revoked_at=is.null')
    expect(asked[2]).toContain(`limit=${CLOCK_PAGE}&offset=0`)
    expect(asked[3]).toContain(`offset=${CLOCK_PAGE}`)
    expect(asked[4]).toBe(`job_lien_filings?select=months_covered&job_id=eq.${JOB}&kind=eq.notice_53_056&voided_at=is.null`)
  })
  it('reads nothing more of a job that is not visible, and no property of a job with no record', async () => {
    const asked: string[] = []
    expect(await readLastWorkWorld({ rows: async (t) => { asked.push(t); return [] } }, JOB)).toEqual({ job: null, propertyKind: '', clockMonths: [], noticedMonths: [] })
    expect(asked).toEqual(['jobs_ledger'])
    const tables: string[] = []
    const w = await readLastWorkWorld({ rows: async (t) => { tables.push(t); return t === 'jobs_ledger' ? [job({ customer_address_id: null })] : [] } }, JOB)
    expect(w.propertyKind).toBe('')
    expect(tables).toEqual(['jobs_ledger', 'clock_sessions', 'job_lien_filings'])
  })
})

describe('lastWorkDayDryRun — the window’s rules and the window’s table', () => {
  it('a job with no hours: the day is the one the dates hang on, and the table is the window’s own', () => {
    const d = reply(lastWorkDayDryRun(day(), world(), { userId: DEV }, TODAY))
    const preview = lienLastWorkPreview({ candidate: '2026-09-11', currentDay: '2026-02-24', currentSource: 'created', lastSessionDay: null, clockMonths: [], noticedMonths: [], propertyKind: 'residential', todayYmd: TODAY })
    expect(d.dates).toEqual(preview.rows)
    expect(d.shift).toBe(preview.shiftWords)
    expect(d.says).toBe('The job has no clock hours, so this day is the one the lien dates hang on.')
    expect(d.verdict).toBe('fine')
    expect(d.before).toMatchObject({ reads: '2026-02-24', from: "from the job's creation", lien_last_work_on: null })
    expect(d.after).toEqual({ reads: '2026-09-11', from: 'set by hand', lien_last_work_on: '2026-09-11', lien_last_work_note: 'Certified the gas line.', lien_last_work_set_at: 'now', lien_last_work_set_by: DEV })
    // A house, September work: the notice by Nov 16 (the 15th is a Sunday), the affidavit by Dec 15.
    expect(d.dates.find((r) => r.what === '§ 53.056 for the last month')).toMatchObject({ after: 'Sep 2026 · mail by Nov 16', changed: true })
    expect(d.dates.find((r) => r.what === '§ 53.052 affidavit')).toMatchObject({ before: 'file by May 15', after: 'file by Dec 15', changed: true })
    expect(d.not_done).toContain('Clock hours and pay are not changed.')
    expect(d.not_done).toContain('No notice or affidavit is drafted, approved, sent or recorded')
  })
  it('refuses what the window refuses: no job, a day after today, a day before the clock hours, the day it already reads', () => {
    expect(lastWorkDayDryRun(day(), world({ job: null }), { userId: DEV }, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('find_job') })
    expect(lastWorkDayDryRun(day({ last_work_on: '2026-11-14' }), world(), { userId: DEV }, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('A last day of work has to be a day that has happened.') })
    expect(lastWorkDayDryRun(day({ last_work_on: '2026-03-20' }), world({ clockMonths: ['2026-03', '2026-04'] }, { last_work_date: '2026-04-01' }), { userId: DEV }, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('The clock hours already show work on Apr 1, so the last day cannot be earlier.') })
    const same = lastWorkDayDryRun(day(), world({}, { lien_last_work_on: '2026-09-11', lien_last_work_note: 'old words' }), { userId: DEV }, TODAY)
    expect(same).toMatchObject({ ok: false, refused: expect.stringContaining('Nothing changes.') })
    expect(same).toMatchObject({ refused: expect.stringContaining('clear the day, then set it again') })
  })
  it('a day far from the clock hours is the window’s second look: refused until anyway: true, and anyway refused when it is not far', () => {
    const far = world({ clockMonths: ['2026-03', '2026-04'] }, { last_work_date: '2026-04-01' })
    const held = lastWorkDayDryRun(day(), far, { userId: DEV }, TODAY)
    expect(held).toMatchObject({ ok: false, refused: expect.stringContaining('That is a long way past the last clocked hour.') })
    expect(held).toMatchObject({ refused: expect.stringContaining('plan again with anyway: true') })
    const set = reply(lastWorkDayDryRun(day({ anyway: true }), far, { userId: DEV }, TODAY))
    expect(set.verdict).toBe('far from the clock hours, set anyway')
    expect(set.dates.find((r) => r.what === 'Months the notice names')).toMatchObject({ before: 'Mar 2026, Apr 2026', after: 'Mar 2026, Apr 2026, Sep 2026', changed: true })
    expect(set.before).toMatchObject({ reads: '2026-04-01', from: 'from clock hours' })
    expect(lastWorkDayDryRun(day({ anyway: true }), world(), { userId: DEV }, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('plan again without it') })
    // In reach of the hours: no second look.
    expect(reply(lastWorkDayDryRun(day({ last_work_on: '2026-04-20' }), far, { userId: DEV }, TODAY)).verdict).toBe('fine')
  })
  it('a new month whose notice window already closed is named as one that would read as missed', () => {
    const d = reply(lastWorkDayDryRun(day({ last_work_on: '2026-07-10' }), world(), { userId: DEV }, TODAY))
    expect(d.says).toContain('Jul 2026 would join the notice with its window already closed, so it would read as missed.')
    expect(d.dates.find((r) => r.what === '§ 53.056 for the last month')?.after).toContain('window closed, would read as missed')
  })
  it('a property with no kind on record: the words stand and no dates are drawn', () => {
    const d = reply(lastWorkDayDryRun(day(), world({ propertyKind: '' }), { userId: DEV }, TODAY))
    expect(d.dates).toEqual([])
    expect(d.property_kind).toBe('not on record')
    expect(d.says).toContain('The property kind is not on record, so the dates cannot be drawn here')
  })
  it('clear goes back to the clock hours or the creation day, and is refused on a day nobody set by hand', () => {
    expect(lastWorkDayDryRun(clear, world(), { userId: DEV }, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('is not set by hand') })
    const hand = { lien_last_work_on: '2026-09-11', lien_last_work_note: 'Certified the gas line.', lien_last_work_set_at: '2026-11-13T21:48:46+00:00', lien_last_work_set_by: DEV }
    const toCreation = reply(lastWorkDayDryRun(clear, world({}, hand), { userId: DEV }, TODAY))
    expect(toCreation.after).toEqual({ reads: '2026-02-24', from: "from the job's creation", ...LIEN_LAST_WORK_CLEAR })
    expect(toCreation.dates[0]).toMatchObject({ what: 'Last day of work', before: 'Sep 11 · set by hand', after: "Feb 24 · the job's creation", changed: true })
    expect(toCreation.dates.find((r) => r.what === '§ 53.052 affidavit')).toMatchObject({ before: 'file by Dec 15', after: 'file by May 15', changed: true })
    expect(toCreation.says).toContain('The reason on the job is taken off with the day.')
    const toHours = reply(lastWorkDayDryRun(clear, world({ clockMonths: ['2026-03', '2026-04'] }, { ...hand, last_work_date: '2026-04-01' }), { userId: DEV }, TODAY))
    expect(toHours.after).toMatchObject({ reads: '2026-04-01', from: 'from clock hours', lien_last_work_on: null })
    expect(toHours.dates[0]).toMatchObject({ after: 'Apr 1 · clock hours' })
    expect(toHours.dates.find((r) => r.what === 'Months the notice names')).toMatchObject({ before: 'Mar 2026, Apr 2026, Sep 2026', after: 'Mar 2026, Apr 2026', changed: true })
  })
  it('the plan’s hash commits to the day the job reads, so a day set since refuses the apply', async () => {
    const p = day()
    const a = lastWorkDayDryRun(p, world(), { userId: DEV }, TODAY)
    const b = lastWorkDayDryRun(p, world({}, { lien_last_work_on: '2026-08-30', lien_last_work_note: 'someone else' }), { userId: DEV }, TODAY)
    if (!a.ok || !b.ok) throw new Error('both plans stand')
    const ha = await planHash('plan_last_work_day', p, a.reply)
    expect(await planHash('plan_last_work_day', p, a.reply)).toBe(ha)
    expect(await planHash('plan_last_work_day', p, b.reply)).not.toBe(ha)
    expect(planReply('plan_last_work_day', a.reply, ha).next).toContain('apply_last_work_day')
  })
})

describe('lastWorkDayAppliedWords — what the apply says', () => {
  it('says the day landed and what was not done, the clear, and a row RLS kept', () => {
    expect(lastWorkDayAppliedWords(day(), 'JP608', { ok: true, detail: { row: { lien_last_work_on: '2026-09-11' } } })).toMatchObject({ ok: true, job: 'JP608', row: { lien_last_work_on: '2026-09-11' }, next: expect.stringContaining('nothing was drafted or sent') })
    expect(lastWorkDayAppliedWords(clear, 'JP608', { ok: true })).toMatchObject({ ok: true, next: expect.stringContaining('no longer set by hand') })
    expect(lastWorkDayAppliedWords(day(), 'JP608', { ok: false, error: 'RLS let no row through.' })).toEqual({ action: 'last_work_day', job: 'JP608', ok: false, error: 'RLS let no row through.' })
  })
})
