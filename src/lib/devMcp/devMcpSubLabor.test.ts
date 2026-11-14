import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LABOR_RATE_KEY,
  LABOR_ASSIGNED_DELIMITER,
  SHEET_PAYMENT_REMOVE_RPC,
  SUB_LABOR_PAYMENT_VERBS,
  SUB_LABOR_VERBS,
  bankLinesLikeThisPay,
  isSubLaborPaymentVerb,
  isSubLaborVerb,
  laborLineWords,
  laborPersonFacts,
  payeeReadsLike,
  readLaborPerson,
  readSubLaborPaymentWorld,
  readSubLaborWorld,
  sheetBalance,
  sheetInsertRow,
  sheetItemRows,
  sheetJobCostCents,
  sheetOwedCents,
  sheetPaymentInsertRow,
  sheetPaymentMemo,
  sheetRateFor,
  subLaborAppliedWords,
  subLaborCommitment,
  subLaborDryRun,
  subLaborInput,
  subLaborNoteBody,
  subLaborNoteJobId,
  subLaborPaymentAppliedWords,
  subLaborPaymentDryRun,
  subLaborPaymentInput,
  type SheetPaymentRecord,
  type SubLaborAdd,
  type SubLaborPayload,
  type SubLaborPaymentPayload,
} from '../../../supabase/functions/_shared/devMcpSubLabor'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_RPCS } from '../../../supabase/functions/dev-mcp/catalog'
import { LABOR_ASSIGNED_DELIMITER as APP_DELIMITER } from '../combinePeople'
import { lineLaborCost } from '../peopleLaborJobItemLineCost'
import { DEFAULT_LABOR_RATE_KEY as APP_RATE_KEY } from '../settings/jobsBillingValueLines'
import { ALLOC, BANK, BENCH_ROW, DEV, GONE_ROW, JOB, MASTER_USER, MONEY, OTHER_JOB, PRIMARY_ROW, PRIMARY_USER, SHEET, SHEET_PAY, SUB_ROW, SUB_USER, TODAY, TWIN_USER, bank, bankLine, fakeRest, job, masterUser, otherJob, sheet, sheetLine, sheetPay, standingWorld, subRow, subUser, worldWithSheet } from './subLaborFixture'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const FORM = readFileSync('src/components/jobs/JobsSubLaborFormModal.tsx', 'utf8')
const LEDGER = readFileSync('src/hooks/useSubLaborLedger.ts', 'utf8')

type Data = Record<string, Record<string, unknown>[]>

/** Three days of work known only from the sub's own day log: hours at a rate, a line a day. */
const THREE_DAYS = {
  job_id: JOB,
  person: 'zz sample sub',
  date: '2026-10-14',
  through: '2026-10-16',
  lines: [
    { what: 'Rough-in, east wing', day: '2026-10-14', hours: 8, rate: 45 },
    { what: 'Rough-in, east wing', day: '2026-10-15', hours: 8, rate: 45 },
    { what: 'Top-out', day: '2026-10-16', hours: 6, rate: 45 },
  ],
  note: 'Out-of-state site.',
  stated: { source: 'their own day log' },
}
/** The same three days as one flat amount. */
const FLAT = { job_id: JOB, person: SUB_ROW, date: '2026-10-14', through: '2026-10-16', lines: [{ what: 'Rough-in, three days', amount: 1800 }] }

const shaped = (labor: Record<string, unknown>, verb: 'plan_sub_labor' | 'apply_sub_labor' = 'plan_sub_labor', extra: Record<string, unknown> = {}): SubLaborPayload => {
  const built = subLaborInput(verb, { labor, ...extra }, TODAY)
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const inputError = (labor: unknown): string => {
  const built = subLaborInput('plan_sub_labor', { labor } as Record<string, unknown>, TODAY)
  if (built.ok) throw new Error('expected a shape error')
  return built.error
}
const plan = async (labor: Record<string, unknown>, data: Data = standingWorld(), money = MONEY) => {
  const p = shaped(labor)
  const world = await readSubLaborWorld(fakeRest(data, money), p, DEV)
  return { p, world, dry: subLaborDryRun(p, world) }
}
const refusal = async (labor: Record<string, unknown>, data: Data = standingWorld()): Promise<string> => {
  const { dry } = await plan(labor, data)
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}
const reply = async (labor: Record<string, unknown>, data: Data = standingWorld(), money = MONEY): Promise<Record<string, unknown>> => {
  const { dry } = await plan(labor, data, money)
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply
}

const shapedPay = (payment: Record<string, unknown>): SubLaborPaymentPayload => {
  const built = subLaborPaymentInput('plan_sub_labor_payment', { payment }, TODAY)
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const payError = (payment: unknown): string => {
  const built = subLaborPaymentInput('plan_sub_labor_payment', { payment } as Record<string, unknown>, TODAY)
  if (built.ok) throw new Error('expected a shape error')
  return built.error
}
const planPay = async (payment: Record<string, unknown>, data: Data = worldWithSheet()) => {
  const p = shapedPay(payment)
  const world = await readSubLaborPaymentWorld(fakeRest(data), p)
  return { p, world, dry: subLaborPaymentDryRun(p, world) }
}
const payRefusal = async (payment: Record<string, unknown>, data: Data = worldWithSheet()): Promise<string> => {
  const { dry } = await planPay(payment, data)
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}
const payReply = async (payment: Record<string, unknown>, data: Data = worldWithSheet()): Promise<Record<string, unknown>> => {
  const { dry } = await planPay(payment, data)
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply
}
const PAID = { sheet_id: SHEET, amount: 400, paid_on: '2026-10-20', method: 'ACH', reference: 'ZZ-1001' }
/** The job as it stands once the bank row that paid the sub was allocated to it as cost. */
const allocated = (over: Data = {}): Data => worldWithSheet({ mercury_transaction_job_allocations: [bankLine()], ...over })

describe('devMcpSubLabor — the verbs on the allowlist', () => {
  it('are four write verbs with no RPC in the table, plan before apply, named by the server and the README', () => {
    expect(SUB_LABOR_VERBS).toEqual(['plan_sub_labor', 'apply_sub_labor'])
    expect(SUB_LABOR_PAYMENT_VERBS).toEqual(['plan_sub_labor_payment', 'apply_sub_labor_payment'])
    for (const v of [...SUB_LABOR_VERBS, ...SUB_LABOR_PAYMENT_VERBS]) {
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
      expect(README).toContain(`\`${v}(`)
    }
    expect(isSubLaborVerb('plan_sub_labor')).toBe(true)
    expect(isSubLaborVerb('plan_sub_labor_payment')).toBe(false)
    expect(isSubLaborPaymentVerb('apply_sub_labor_payment')).toBe(true)
    expect(planVerbFor('apply_sub_labor')).toBe('plan_sub_labor')
    expect(planVerbFor('apply_sub_labor_payment')).toBe('plan_sub_labor_payment')
    expect(SERVER).toContain("const SERVER_VERSION = '0.87.0'")
    expect(SERVER).toContain('Writes are one hundred and nine verbs and nothing else:')
    expect(README).toContain("eighty-seven since v2.6944's sub labor pairs")
    expect(README).toContain('one hundred and nine `plan_` / `apply_` / `revert_` verbs')
  })
  it('go through writeRpcBody with the app’s day, and an apply needs the plan’s hash', () => {
    const planned = writeRpcBody('plan_sub_labor', { labor: FLAT })
    expect(planned).toMatchObject({ ok: true, rpc: null, step: 'plan', target: JOB, planHash: null })
    const noHash = writeRpcBody('apply_sub_labor', { labor: FLAT })
    expect(noHash.ok).toBe(false)
    if (!noHash.ok) expect(noHash.error).toContain('needs plan_hash')
    const applied = writeRpcBody('apply_sub_labor_payment', { payment: PAID, plan_hash: 'a'.repeat(64) })
    expect(applied).toMatchObject({ ok: true, rpc: null, step: 'apply', target: SHEET, planHash: 'a'.repeat(64) })
    expect(alreadyApplied('apply_sub_labor', { target: JOB, at: null })).toContain('already applied')
    expect(alreadyApplied('apply_sub_labor_payment', { target: SHEET, at: null })).toContain('duplicate_ok')
  })
  it('names the payment’s own remove RPC as the catalog has it, and the app’s own delimiter and settings key', () => {
    expect(Object.keys(CATALOG_RPCS[SHEET_PAYMENT_REMOVE_RPC]![0]!.args)).toEqual(['p_payment_id', 'p_reason?'])
    expect(LEDGER).toContain(`supabase.rpc('${SHEET_PAYMENT_REMOVE_RPC}' as never, { p_payment_id: paymentId, p_reason: reason } as never)`)
    expect(SERVER).toContain('rpc/${SHEET_PAYMENT_REMOVE_RPC}`, { p_payment_id: p.payment_id, p_reason: p.reason }')
    expect(LABOR_ASSIGNED_DELIMITER).toBe(APP_DELIMITER)
    expect(DEFAULT_LABOR_RATE_KEY).toBe(APP_RATE_KEY)
  })
})

describe('devMcpSubLabor — the shape of a sheet', () => {
  it('takes a flat line or hours at a rate, and holds a sheet to one of the two', () => {
    const p = shaped(THREE_DAYS) as SubLaborAdd
    expect(p).toMatchObject({ action: 'add', job_id: JOB, person: 'zz sample sub', date: '2026-10-14', through: '2026-10-16', note: 'Out-of-state site.', stated: { source: 'their own day log' } })
    expect(p.lines[2]).toEqual({ what: 'Top-out', day: '2026-10-16', hours: 6, rate: 45 })
    expect((shaped({ ...FLAT, lines: [{ what: 'Rough-in', amount: '$1,800.00' }] }) as SubLaborAdd).lines[0]).toEqual({ what: 'Rough-in', amount: 1800 })
    expect(inputError({ ...FLAT, lines: [{ what: 'A', amount: 100 }, { what: 'B', hours: 2, rate: 40 }] })).toContain('all flat amounts or all hours at a rate')
    expect(inputError({ ...FLAT, lines: [{ what: 'A', amount: 100, hours: 2, rate: 40 }] })).toContain('one of the two')
    expect(inputError({ ...FLAT, lines: [{ what: 'A', amount: 0 }] })).toContain('more than 0')
    expect(inputError({ ...FLAT, lines: [{ what: 'A', hours: 2 }] })).toContain('rate is dollars an hour')
    expect(inputError({ ...FLAT, lines: [{ amount: 5 }] })).toContain('needs what')
    expect(inputError({ ...FLAT, lines: [] })).toContain('1 to 40')
  })
  it('refuses a day ahead of today, a span that runs backwards, a line outside the span and a wildcard for a person', () => {
    expect(inputError({ ...FLAT, date: '2026-11-12', through: undefined })).toContain('ahead of today')
    expect(inputError({ ...FLAT, through: '2026-10-13' })).toContain('before date')
    expect(inputError({ ...FLAT, date: '2026-07-01', through: '2026-10-16' })).toContain('at most 62 days')
    expect(inputError({ ...FLAT, lines: [{ what: 'Late', day: '2026-10-20', amount: 5 }] })).toContain('outside the sheet\'s days 2026-10-14 to 2026-10-16')
    expect(inputError({ ...FLAT, person: 'ZZ*' })).toContain('no wildcard')
    expect(inputError({ ...FLAT, stated: {} })).toContain('stated is { source }')
    expect(inputError({ ...FLAT, job_id: 'JP9102' })).toContain('needs labor')
    expect(inputError(null)).toContain('needs labor')
  })
  it('a change names a day or lines, a remove a reason', () => {
    expect(shaped({ action: 'change', sheet_id: SHEET, date: '2026-10-14' })).toEqual({ action: 'change', sheet_id: SHEET, date: '2026-10-14' })
    expect(inputError({ action: 'change', sheet_id: SHEET })).toContain('Nothing to do')
    expect(inputError({ action: 'change', sheet_id: SHEET, date: '2026-10-14', stated: { source: 'a text thread' } })).toContain('sends the lines again')
    expect(inputError({ action: 'remove', sheet_id: SHEET })).toContain('a remove needs reason')
    expect(shaped({ action: 'remove', sheet_id: SHEET, reason: 'made twice' })).toEqual({ action: 'remove', sheet_id: SHEET, reason: 'made twice' })
  })
})

describe('devMcpSubLabor — who a sheet is for', () => {
  const facts = async (asked: string, data: Data = standingWorld()) => laborPersonFacts(await readLaborPerson(fakeRest(data), asked))
  it('finds the sub by name in any case, by roster row and by account, as one person', async () => {
    for (const asked of ['zz sample sub', SUB_ROW, SUB_USER]) {
      const f = await facts(asked)
      expect(f).toMatchObject({ ok: true, person: { name: 'ZZ Sample Sub', people_id: SUB_ROW, user_id: SUB_USER, kind: 'sub', role: 'subcontractor', pay_ledger: 'sub', sample: false, people_ids: [SUB_ROW], names: ['ZZ Sample Sub'] } })
    }
  })
  it('refuses a teammate who is not a sub, an archived sub, a sub on the bench, a twin, nobody and two people of one name', async () => {
    const say = async (asked: string, data?: Data) => {
      const f = await facts(asked, data)
      if (f.ok) throw new Error('expected a refusal')
      return f.refused
    }
    expect(await say(MASTER_USER)).toContain('ZZ Sample Master is not a subcontractor or a primary (a master technician)')
    expect(await say(MASTER_USER)).toContain('paid through payroll from their hours')
    expect(await say(GONE_ROW)).toContain('ZZ Gone Sub is archived')
    expect(await say(BENCH_ROW)).toContain('on the bench since 2026-08-01')
    expect(await say(TWIN_USER)).toContain('is a digital twin')
    expect(await say('ZZ Nobody')).toContain('No person "ZZ Nobody" is visible to you')
    const two = standingWorld({ people: [subRow(), subRow({ id: BENCH_ROW, account_user_id: null, end_date: null })] })
    expect(await say('ZZ Sample Sub', two)).toContain('matches 2 people')
    // A roster row of kind sub whose account is an office role is not on the form's list: the account's role decides.
    const office = standingWorld({ users: [subUser({ role: 'assistant' })] })
    expect(await say(SUB_ROW, office)).toContain('on the roster as a sub with a assistant account')
  })
  it('a primary is taken as the form’s Subcontractors list offers one, and the plan says the Pay ledger files the sheet under Crew pay', async () => {
    for (const asked of ['ZZ Sample Primary', PRIMARY_ROW, PRIMARY_USER]) {
      expect(await facts(asked)).toMatchObject({ ok: true, person: { name: 'ZZ Sample Primary', people_id: PRIMARY_ROW, user_id: PRIMARY_USER, kind: 'primary', role: 'primary', pay_ledger: 'crew' } })
    }
    const r = await reply({ ...FLAT, person: PRIMARY_USER })
    expect(r.person).toEqual({ name: 'ZZ Sample Primary', people_id: PRIMARY_ROW, user_id: PRIMARY_USER, kind: 'primary', pay_ledger: 'Crew pay: the Pay ledger files the sheet under Crew pay' })
    expect(r.sheet).toMatchObject({ assigned_to_name: 'ZZ Sample Primary' })
    const warned = (r.warnings as string[]).join(' ')
    expect(warned).toContain('ZZ Sample Primary is a primary, not a roster sub')
    expect(warned).toContain('under Crew pay')
    expect(warned).toContain('still counts on JP9102 as sub labor')
    expect(FORM).toContain("const fromPrimaries = byKind('primary')")
    // A primary with no account is offered by the roster row alone.
    expect(await facts(PRIMARY_ROW, standingWorld({ users: [] }))).toMatchObject({ ok: true, person: { user_id: null, kind: 'primary', pay_ledger: 'crew' } })
  })
  it('a sample sub is taken, and the plan says it is practice', async () => {
    const r = await reply(FLAT, standingWorld({ users: [subUser({ is_sample: true }), masterUser()] }))
    expect(r.person).toMatchObject({ sample: true })
    expect((r.warnings as string[]).join(' ')).toContain('is a sample account')
    // An account with no roster row: the sheet lands, and the plan says nothing would tie it to them.
    const bare = await reply(FLAT.person === SUB_ROW ? { ...FLAT, person: SUB_USER } : FLAT, standingWorld({ people: [] }))
    expect(bare.person).toMatchObject({ people_id: null, user_id: SUB_USER })
    expect((bare.warnings as string[]).join(' ')).toContain('has an account and no roster row')
    expect((bare.sets_off as string[])[0]).toContain('no assignee row is written')
  })
})

describe('devMcpSubLabor — a stated three-day sheet', () => {
  it('lands as the form’s rows: the sheet, then its lines, the day and the stated mark in each line’s words', async () => {
    const { p, world, dry } = await plan(THREE_DAYS)
    if (!dry.ok) throw new Error(dry.refused)
    const r = dry.reply
    expect(r.job).toMatchObject({ id: JOB, label: 'JP9102', address: '12 Cedar Ridge Rd' })
    expect(r.person).toEqual({ name: 'ZZ Sample Sub', people_id: SUB_ROW, user_id: SUB_USER, kind: 'sub', pay_ledger: 'a roster sub: the sheet reads as theirs in the Pay ledger' })
    expect(r.sheet).toEqual({ master_user_id: DEV, assigned_to_name: 'ZZ Sample Sub', address: '12 Cedar Ridge Rd', job_number: '9102', job_ledger_id: JOB, labor_rate: 45, job_date: '2026-10-14', distance_miles: 0, invoice_link: null })
    expect(sheetItemRows((p as SubLaborAdd).lines, (p as SubLaborAdd).stated)).toEqual([
      { fixture: '2026-10-14 · Rough-in, east wing (stated, their own day log)', count: 1, hrs_per_unit: 8, is_fixed: false, labor_rate: 45, direct_labor_amount: null, sequence_order: 1 },
      { fixture: '2026-10-15 · Rough-in, east wing (stated, their own day log)', count: 1, hrs_per_unit: 8, is_fixed: false, labor_rate: 45, direct_labor_amount: null, sequence_order: 2 },
      { fixture: '2026-10-16 · Top-out (stated, their own day log)', count: 1, hrs_per_unit: 6, is_fixed: false, labor_rate: 45, direct_labor_amount: null, sequence_order: 3 },
    ])
    expect(r.lines).toEqual([
      { words: '2026-10-14 · Rough-in, east wing (stated, their own day log)', hours: 8, rate: 45, costs: 360 },
      { words: '2026-10-15 · Rough-in, east wing (stated, their own day log)', hours: 8, rate: 45, costs: 360 },
      { words: '2026-10-16 · Top-out (stated, their own day log)', hours: 6, rate: 45, costs: 270 },
    ])
    expect(r.totals).toEqual({ owed_to_them: 990, cost_on_the_job: 990, hours: 22, priced: 'hours at a rate' })
    expect(r.days).toMatchObject({ sheet_day: '2026-10-14', through: '2026-10-16' })
    expect((r.days as { reads: string }).reads).toContain('The app keeps one day a sheet')
    expect(r.stated).toMatchObject({ source: 'their own day log' })
    expect(r.their_sheets_on_this_job).toEqual([])
    expect(r.job_sheets).toEqual([])
    expect(r.note_on_activity).toBe('Sub labor sheet for ZZ Sample Sub: 2026-10-14 to 2026-10-16, $990.00 on 3 lines, 22 h. The days are stated from their own day log, not punched. Out-of-state site.')
    expect(subLaborNoteBody(p, world, 'ZZ Sample Sub')).toBe(r.note_on_activity)
    expect(r.warnings).toBeUndefined()
    expect((r.does_not as string[]).join(' ')).toContain('It records no payment')
    expect((r.does_not as string[]).join(' ')).toContain('It moves no bank row')
  })
  it('shows the job’s sub labor and its profit before and after, from the screens’ kernels', async () => {
    const r = await reply(THREE_DAYS)
    expect(r.job_labor).toMatchObject({ sheets: 0, cost_before: 0, cost_after: 990 })
    expect(r.job_money).toMatchObject({ before: { total_bill: 20000, parts_cost: 4000, sub_labor: 0, profit: 16000 }, after: { total_bill: 20000, parts_cost: 4000, sub_labor: 990, profit: 15010 } })
    // The line cost is the Sub Labor screens' own.
    expect(lineLaborCost({ count: 1, hrs_per_unit: 8, is_fixed: false, labor_rate: 45, direct_labor_amount: null }, 45)).toBe(360)
    expect((await reply(THREE_DAYS, standingWorld(), { error: 'a cost source could not be read' })).job_money).toEqual({ read: false, why: 'The profit band could not be read: a cost source could not be read' })
  })
  it('a flat sheet carries the office’s default rate as the form’s rows do, and no hours', async () => {
    const r = await reply(FLAT)
    expect(r.sheet).toMatchObject({ labor_rate: 20, job_date: '2026-10-14' })
    expect(r.lines).toEqual([{ words: 'Rough-in, three days', amount: 1800, costs: 1800 }])
    expect(r.totals).toEqual({ owed_to_them: 1800, cost_on_the_job: 1800, priced: 'flat amounts' })
    expect((r.warnings as string[]).join(' ')).toContain('no line names its day')
    expect(r.note_on_activity).toBe('Sub labor sheet for ZZ Sample Sub: 2026-10-14 to 2026-10-16, $1,800.00 on 1 line.')
    const set = await reply(FLAT, standingWorld({ app_settings: [{ key: 'default_labor_rate', value_num: 55 }] }))
    expect(set.sheet).toMatchObject({ labor_rate: 55 })
    expect(sheetRateFor([{ what: 'A', hours: 2, rate: 40 }], [{ key: 'default_labor_rate', value_num: 55 }])).toBe(40)
    // One day, no note, no stated mark: nothing is left on the job's activity.
    expect((await reply({ ...FLAT, through: undefined })).note_on_activity).toBeNull()
  })
  it('writes what New Sub Labor writes', async () => {
    const { p, world } = await plan(FLAT)
    const f = laborPersonFacts(world.person!)
    if (!f.ok) throw new Error(f.refused)
    for (const key of Object.keys(sheetInsertRow(p as SubLaborAdd, job(), f.person, world))) expect(FORM).toContain(`        ${key}: `)
    for (const key of Object.keys(sheetItemRows((p as SubLaborAdd).lines)[0]!)) expect(FORM).toContain(`        ${key}: `)
    expect(FORM).toContain("direct_labor_amount: laborFixtureEntryMode === 'simple' ? Number(r.direct_labor_amount) : null,")
    expect(FORM).toContain("labor_rate: laborFixtureEntryMode === 'simple' ? null : r.labor_rate != null ? Number(r.labor_rate) : null,")
    expect(FORM).toContain(".upsert(rows, { onConflict: 'labor_job_id,person_id', ignoreDuplicates: true })")
    expect(SERVER).toContain("'people_labor_job_assignees', 'on_conflict=labor_job_id,person_id'")
    expect(laborLineWords({ what: 'Top-out', amount: 5 })).toBe('Top-out')
  })
  it('refuses a job RLS hides and a job with no address', async () => {
    expect(await refusal({ ...FLAT, job_id: 'aaaaaaaa-0000-4000-8000-00000000000f' })).toContain('No job')
    expect(await refusal(FLAT, standingWorld({ jobs_ledger: [job({ job_address: ' ' })] }))).toContain('JP9102 has no address')
  })
})

describe('devMcpSubLabor — a second sheet for the same days', () => {
  it('is refused, naming the sheet that stands, unless second_sheet_ok', async () => {
    const why = await refusal(THREE_DAYS, worldWithSheet())
    expect(why).toContain('ZZ Sample Sub already has a sheet on JP9102 for those days: 2026-10-15, $600.00')
    expect(why).toContain(SHEET)
    expect(why).toContain('counts the labor twice')
    const r = await reply({ ...THREE_DAYS, second_sheet_ok: true }, worldWithSheet())
    expect(r.their_sheets_on_this_job).toEqual([{ id: SHEET, who: 'ZZ Sample Sub', day: '2026-10-15', dated: true, lines: 1, owed: 600, paid: 0, open: 600, job_cost: 600, stage: 'working' }])
    expect(r.job_labor).toMatchObject({ sheets: 1, cost_before: 600, cost_after: 1590 })
    expect((r.warnings as string[]).join(' ')).toContain('because second_sheet_ok is true')
  })
  it('sees a sheet under their name that no assignee row ties to them, and lets a sheet on other days stand', async () => {
    const untied = worldWithSheet({ people_labor_job_assignees: [] })
    expect(await refusal(THREE_DAYS, untied)).toContain('already has a sheet')
    const shared = worldWithSheet({ people_labor_jobs: [sheet({ assigned_to_name: 'ZZ Other Sub | ZZ Sample Sub' })], people_labor_job_assignees: [] })
    expect(await refusal(THREE_DAYS, shared)).toContain('already has a sheet')
    const earlier = worldWithSheet({ people_labor_jobs: [sheet({ job_date: '2026-10-02' })] })
    const r = await reply(THREE_DAYS, earlier)
    expect((r.their_sheets_on_this_job as unknown[]).length).toBe(1)
    expect(r.warnings).toBeUndefined()
    // A sheet with no job date counts on the day it was made.
    const undated = worldWithSheet({ people_labor_jobs: [sheet({ job_date: null })] })
    expect(await refusal(THREE_DAYS, undated)).toContain('2026-10-16')
  })
  it('the hash commits to the job’s sheets and never to the profit band', async () => {
    const p = shaped(THREE_DAYS)
    const hashOf = async (data: Data, money = MONEY) => {
      const dry = subLaborDryRun(p, await readSubLaborWorld(fakeRest(data, money), p, DEV))
      if (!dry.ok) throw new Error(dry.refused)
      expect(subLaborCommitment(dry.reply).job_money).toBeUndefined()
      return planHash('plan_sub_labor', p, subLaborCommitment(dry.reply))
    }
    const base = await hashOf(standingWorld())
    expect(await hashOf(standingWorld(), { profit: { laborCost: 0, partsCost: 9000, totalBill: 20000, profit: 11000 } })).toBe(base)
    const other = { people_labor_jobs: [sheet({ assigned_to_name: 'ZZ Other Sub', job_date: '2026-09-01' })], people_labor_job_items: [sheetLine()] }
    expect(await hashOf(standingWorld(other))).not.toBe(base)
    expect(await planHash('apply_sub_labor', p, subLaborCommitment((await reply(THREE_DAYS)) as Record<string, unknown>))).toBe(base)
  })
})

describe('devMcpSubLabor — bank rows that may be the same pay', () => {
  it('names the job’s allocated bank row paid to a name like theirs, and says the dollars would count twice', async () => {
    const r = await reply(FLAT, standingWorld({ mercury_transaction_job_allocations: [bankLine()] }))
    expect(r.bank_rows_that_may_be_this_pay).toEqual([
      { allocation_id: ALLOC, mercury_transaction_id: BANK, cost_on_the_job: 1800, bank_row_amount: -1800, posted_on: '2026-10-20', paid_to: 'ZZ SAMPLE SUB LLC', note: 'October labor', why: 'paid to a name that reads like theirs, for the same amount' },
    ])
    const warned = (r.warnings as string[]).join(' ')
    expect(warned).toContain('the same dollars twice')
    expect(warned).toContain('plan_cost_batch takes it off the job')
    expect(warned).toContain('label it Payroll in Banking')
  })
  it('reads a payee by the name’s words, and leaves a refund and a stranger out', () => {
    expect(payeeReadsLike('ZZ SAMPLE SUB LLC', ['ZZ Sample Sub'])).toBe(true)
    expect(payeeReadsLike('ZZ Supply House', ['ZZ Sample Sub'])).toBe(false)
    expect(payeeReadsLike(null, ['ZZ Sample Sub'])).toBe(false)
    expect(payeeReadsLike('ZZ SAMPLE SUB LLC', ['ZZ'])).toBe(false)
    const stranger = bankLine({ id: 'dddddddd-0000-4000-8000-000000000009', amount: -75, mercury_transactions: { posted_at: null, counterparty_name: 'ZZ Supply House', amount: -75 } })
    const refund = bankLine({ amount: 1800, mercury_transactions: { posted_at: null, counterparty_name: 'ZZ SAMPLE SUB LLC', amount: 1800 } })
    expect(bankLinesLikeThisPay([stranger, refund], ['ZZ Sample Sub'], 180000)).toEqual([])
    expect(bankLinesLikeThisPay([stranger], ['ZZ Sample Sub'], 7500)).toMatchObject([{ why: 'money out of the same amount' }])
  })
})

describe('devMcpSubLabor — change and remove', () => {
  it('moves a sheet’s day with one patch, and leaves its lines', async () => {
    const r = await reply({ action: 'change', sheet_id: SHEET, date: '2026-10-14', reason: 'the day log says the 14th' }, worldWithSheet())
    expect(r.sheet_patch).toEqual({ job_date: '2026-10-14' })
    expect(r.replaces_lines).toBe(false)
    expect(r.after).toMatchObject({ day: '2026-10-14', lines: 'as they are', owed: 600, job_cost: 600 })
    expect(r.note_on_activity).toBe('Sub labor sheet for ZZ Sample Sub (2026-10-15) changed: its day 2026-10-15 → 2026-10-14. Reason: the day log says the 14th')
    expect(await refusal({ action: 'change', sheet_id: SHEET, date: '2026-10-15' }, worldWithSheet())).toContain('already reads that way')
  })
  it('replaces the lines whole, the sheet’s rate following the first line, and warns when it would read overpaid', async () => {
    const lines = [{ what: 'Set fixtures, unit 4', hours: 10, rate: 50 }]
    const r = await reply({ action: 'change', sheet_id: SHEET, lines }, worldWithSheet({ people_labor_job_payments: [sheetPay({ amount: 550 })] }))
    expect(r.replaces_lines).toBe(true)
    expect(r.sheet_patch).toEqual({ labor_rate: 50 })
    expect(r.after).toMatchObject({ sheet_rate: 50, owed: 500, paid: 550, open: -50, job_cost: 500 })
    expect(r.job_labor).toMatchObject({ cost_before: 600, cost_after: 500 })
    expect(r.job_money).toMatchObject({ after: { sub_labor: -100, profit: 16100 } })
    expect((r.warnings as string[]).join(' ')).toContain('overpaid by $50.00')
    expect(r.note_on_activity).toBeNull()
    expect(await refusal({ action: 'change', sheet_id: SHEET, lines: [{ what: 'Set fixtures, unit 4', amount: 600 }] }, worldWithSheet())).toContain('already reads that way')
    expect(FORM).toContain(".from('people_labor_job_items').delete().eq('job_id', editingLaborJob.id)")
  })
  it('moves a sheet to another job as the Edit window’s change beside the job does: the job, its number and its address', async () => {
    const MOVE = { action: 'change', sheet_id: SHEET, job_id: OTHER_JOB, reason: 'the work was on Birch Lane' }
    const withPay = worldWithSheet({ people_labor_job_payments: [sheetPay()] })
    const { p, world, dry } = await plan(MOVE, withPay)
    if (!dry.ok) throw new Error(dry.refused)
    const r = dry.reply
    expect(r.sheet_patch).toEqual({ job_number: '9103', job_ledger_id: OTHER_JOB, address: '4 Birch Lane' })
    expect(r.replaces_lines).toBe(false)
    expect(r.job).toMatchObject({ id: JOB, label: 'JP9102' })
    expect(r.moves_to).toMatchObject({ id: OTHER_JOB, label: 'JP9103', address: '4 Birch Lane' })
    expect(r.after).toMatchObject({ day: '2026-10-15', lines: 'as they are', owed: 600, paid: 200, open: 400, job_cost: 600 })
    expect(r.job_labor).toMatchObject({ sheets: 1, cost_before: 600, cost_after: 0 })
    expect(r.to_job_labor).toMatchObject({ sheets: 0, cost_before: 0, cost_after: 600 })
    expect(r.job_money).toMatchObject({ after: { sub_labor: -600, profit: 16600 } })
    expect(r.to_job_money).toMatchObject({ after: { sub_labor: 600, profit: 15400 } })
    expect(r.to_job_sheets).toEqual([])
    expect(String(r.door)).toContain('its job, number and address as the Edit window\'s change beside the job writes them')
    expect((r.sets_off as string[])[0]).toContain("JP9102's sub labor drops by $600.00 and JP9103's rises by $600.00")
    expect((r.sets_off as string[]).join(' ')).toContain('payments, stage and people go with it')
    expect(r.note_on_activity).toBe('Sub labor sheet for ZZ Sample Sub (2026-10-15, $600.00) moved here from JP9102. Reason: the work was on Birch Lane')
    expect(r.note_shows).toBe("JP9103's Job activity / notes, as a note by you")
    expect(subLaborNoteJobId(p, world)).toBe(OTHER_JOB)
    expect(r.warnings).toBeUndefined()
    expect(subLaborCommitment(r).to_job_money).toBeUndefined()
    expect(FORM).toContain('job_number: subLaborJobNumberForStorage(job) || null,\n        job_ledger_id: job.id,\n        address: job.job_address ?? \'\',')
    // A sheet tied to no job moves onto one, and nothing is said about the job it never had.
    const lone = await reply({ action: 'change', sheet_id: SHEET, job_id: OTHER_JOB }, worldWithSheet({ people_labor_jobs: [sheet({ job_ledger_id: null })] }))
    expect(lone.job).toBeNull()
    expect(lone.moves_to).toMatchObject({ label: 'JP9103' })
    expect(lone.warnings).toBeUndefined()
    expect(lone.note_on_activity).toBeNull()
  })
  it('a move refuses the job it is on, a job RLS hides and a job with no address, and warns of a second sheet or a bank row there', async () => {
    expect(await refusal({ action: 'change', sheet_id: SHEET, job_id: JOB }, worldWithSheet())).toBe('That sheet is already on JP9102. Nothing to change.')
    expect(await refusal({ action: 'change', sheet_id: SHEET, job_id: 'aaaaaaaa-0000-4000-8000-00000000000f' }, worldWithSheet())).toContain('No job')
    expect(await refusal({ action: 'change', sheet_id: SHEET, job_id: OTHER_JOB }, worldWithSheet({ jobs_ledger: [job(), otherJob({ job_address: '' })] }))).toContain('JP9103 has no address')
    const OTHER_SHEET = 'cccccccc-0000-4000-8000-000000000009'
    const busy = worldWithSheet({
      people_labor_jobs: [sheet(), sheet({ id: OTHER_SHEET, job_ledger_id: OTHER_JOB, job_number: '9103' })],
      people_labor_job_items: [sheetLine(), sheetLine({ id: 'cccccccc-0000-4000-8000-00000000000a', job_id: OTHER_SHEET, direct_labor_amount: 250 })],
      mercury_transaction_job_allocations: [bankLine({ job_id: OTHER_JOB, amount: -600, mercury_transactions: { posted_at: '2026-10-20T17:00:00+00:00', counterparty_name: 'ZZ SAMPLE SUB LLC', amount: -600 } })],
    })
    const r = await reply({ action: 'change', sheet_id: SHEET, job_id: OTHER_JOB, date: '2026-10-15' }, busy)
    expect(r.to_job_labor).toMatchObject({ sheets: 1, cost_before: 250, cost_after: 850 })
    expect((r.to_job_sheets as unknown[]).length).toBe(1)
    const warned = (r.warnings as string[]).join(' ')
    expect(warned).toContain(`ZZ Sample Sub already has a sheet on JP9103 for 2026-10-15 (${OTHER_SHEET})`)
    expect(warned).toContain('the same dollars twice')
    expect(r.bank_rows_that_may_be_this_pay).toMatchObject([{ allocation_id: ALLOC, why: 'paid to a name that reads like theirs, for the same amount' }])
    // The hash holds the job it moves to: a sheet landed there since refuses the apply.
    const p = shaped({ action: 'change', sheet_id: SHEET, job_id: OTHER_JOB })
    const hashOf = async (data: Data) => {
      const dry = subLaborDryRun(p, await readSubLaborWorld(fakeRest(data), p, DEV))
      if (!dry.ok) throw new Error(dry.refused)
      return planHash('plan_sub_labor', p, subLaborCommitment(dry.reply))
    }
    expect(await hashOf(worldWithSheet())).not.toBe(await hashOf(busy))
  })
  it('will not remove a sheet that carries a payment, and removes one that does not', async () => {
    const REMOVE = { action: 'remove', sheet_id: SHEET, reason: 'made twice for the same days' }
    const why = await refusal(REMOVE, worldWithSheet({ people_labor_job_payments: [sheetPay()] }))
    expect(why).toContain('carries 1 payment line: $200.00 paid')
    expect(why).toContain(`plan_sub_labor_payment { action: 'remove', payment_id, reason } (${SHEET_PAY})`)
    const r = await reply(REMOVE, worldWithSheet())
    expect(r.removes).toMatchObject({ id: SHEET, owed: 600, lines_now: [{ words: 'Set fixtures, unit 4', costs: 600 }] })
    expect(r.job_labor).toMatchObject({ sheets: 1, cost_before: 600, cost_after: 0 })
    expect(r.note_on_activity).toBe('Sub labor sheet removed: ZZ Sample Sub, 2026-10-15, $600.00. Reason: made twice for the same days')
    expect(LEDGER).toContain("supabase.from('people_labor_jobs').delete().eq('id', id)")
    expect(await refusal({ ...REMOVE, sheet_id: 'cccccccc-0000-4000-8000-00000000000f' }, worldWithSheet())).toContain('No sheet')
  })
  it('a sheet tied to no job changes with no note and no profit band', async () => {
    const r = await reply({ action: 'change', sheet_id: SHEET, date: '2026-10-14', reason: 'x' }, worldWithSheet({ people_labor_jobs: [sheet({ job_ledger_id: null })] }))
    expect(r.job).toBeNull()
    expect(r.note_on_activity).toBeNull()
    expect((r.warnings as string[]).join(' ')).toContain('tied to no job')
  })
  it('the apply says what landed and whether the note did', () => {
    const p = shaped(FLAT)
    expect(subLaborAppliedWords(p, 'JP9102', { ok: true, detail: { sheet_id: SHEET, lines: 1 }, note: { id: 'n1' } })).toMatchObject({ action: 'add', job: 'JP9102', ok: true, sheet_id: SHEET, note_on_activity: { written: true, id: 'n1' }, next: expect.stringContaining('plan_sub_labor_payment') })
    expect(subLaborAppliedWords(p, 'JP9102', { ok: true, detail: {}, note: { error: 'RLS' } })).toMatchObject({ note_on_activity: { written: false, why: 'RLS' } })
    expect(subLaborAppliedWords(p, 'JP9102', { ok: true, detail: {}, note: null }).note_on_activity).toBeUndefined()
    expect(subLaborAppliedWords(p, 'JP9102', { ok: false, error: 'new row violates row-level security policy' })).toEqual({ action: 'add', job: 'JP9102', ok: false, error: 'new row violates row-level security policy' })
  })
})

describe('devMcpSubLabor — the sheet’s math is the screens’', () => {
  it('owes the lines, costs the job the lines and the drive, and balances as the Pay ledger does', () => {
    const line = sheetLine({ direct_labor_amount: null, count: 3, hrs_per_unit: 2, labor_rate: null })
    expect(sheetOwedCents(40, [line])).toBe(24000)
    expect(sheetOwedCents(40, [sheetLine({ direct_labor_amount: null, count: 3, hrs_per_unit: 2, is_fixed: true, labor_rate: 50 })])).toBe(10000)
    expect(sheetJobCostCents({ labor_rate: 40, distance_miles: 10 }, [line], [])).toBe(24000 + 700 + 800)
    expect(sheetJobCostCents({ labor_rate: 40, distance_miles: 10 }, [line], [{ key: 'drive_mileage_cost', value_num: 1 }, { key: 'drive_time_per_mile', value_num: 0 }])).toBe(24000 + 1000)
    expect(sheetBalance(60000, [{ amount: 200 }, { amount: -50 }])).toEqual({ owed: 60000, paid: 20000, backcharged: 5000, open: 35000 })
    // No priced line and money moved: what was paid reads as what was owed.
    expect(sheetBalance(0, [{ amount: 200 }])).toEqual({ owed: 20000, paid: 20000, backcharged: 0, open: 0 })
  })
})

describe('devMcpSubLabor — a payment on a sheet', () => {
  it('shapes a record and a remove, and sends a backcharge to the app', () => {
    expect(shapedPay({ ...PAID, mercury_transaction_id: BANK.toUpperCase(), hidden_from_sub: true })).toEqual({ action: 'record', sheet_id: SHEET, amount: 400, paid_on: '2026-10-20', method: 'ACH', reference: 'ZZ-1001', mercury_transaction_id: BANK, hidden_from_sub: true })
    expect(payError({ ...PAID, amount: -5 })).toContain('more than 0')
    expect(payError({ ...PAID, paid_on: '2026-11-30' })).toContain('ahead of today')
    expect(payError({ ...PAID, mercury_transaction_id: 'the October transfer' })).toContain('mercury_transactions.id')
    expect(payError({ action: 'backcharge', sheet_id: SHEET, amount: 5 })).toContain('a backcharge is the payment window\'s own press')
    expect(payError({ action: 'remove', payment_id: SHEET_PAY })).toContain('a remove needs reason')
    expect(payError({ sheet_id: 'x' })).toContain('needs payment')
  })
  it('lands as Make Payment’s row, the method and reference in the memo, after the sheet’s last payment', async () => {
    const { p, world, dry } = await planPay(PAID)
    if (!dry.ok) throw new Error(dry.refused)
    expect(sheetPaymentInsertRow(p as SheetPaymentRecord, world)).toEqual({ job_id: SHEET, amount: 400, memo: 'ACH · ref ZZ-1001', sequence_order: 0, payment_date: '2026-10-20' })
    expect(dry.reply.records).toEqual({ job_id: SHEET, amount: 400, memo: 'ACH · ref ZZ-1001', sequence_order: 0, payment_date: '2026-10-20' })
    expect(dry.reply.sheet).toMatchObject({ id: SHEET, who: 'ZZ Sample Sub', owed: 600, paid: 0, open: 600 })
    expect(dry.reply.after).toEqual({ paid: 400, open: 200, reads: '$200.00 still owed' })
    expect(String(dry.reply.job_profit)).toContain('unchanged')
    expect((dry.reply.warnings as string[]).join(' ')).toContain('The memo "ACH · ref ZZ-1001" shows to ZZ Sample Sub on their portal')
    expect((dry.reply.warnings as string[]).join(' ')).toContain('No bank row was named')
    // The window's row, as the hook builds it: the same five fields. Since v2.7176 the window adds `method` and
    // `method_ref` only when a chip was picked; the seat still says the method in the memo and names neither column.
    expect(LEDGER).toContain('      job_id: jobId,\n      amount,\n      memo: memo?.trim() || null,\n      sequence_order: nextOrder,\n      payment_date: paymentDate?.trim() || null,\n')
    expect(LEDGER).toContain("...(extras.method ? { method: extras.method, method_ref: extras.method_ref?.trim() || null } : {}),")
    expect(LEDGER).toContain(".from('people_labor_job_payments').insert(row as never)")
    const second = await planPay({ ...PAID, amount: 400, hidden_from_sub: true, note: 'second half' }, worldWithSheet({ people_labor_job_payments: [sheetPay()] }))
    if (!second.dry.ok) throw new Error(second.dry.refused)
    expect(second.dry.reply.records).toEqual({ job_id: SHEET, amount: 400, memo: 'ACH · ref ZZ-1001 · second half', sequence_order: 1, payment_date: '2026-10-20', hidden_from_sub: true })
    expect(second.dry.reply.after).toEqual({ paid: 600, open: 0, reads: 'paid in full: the Pay ledger shows it Paid by itself' })
    expect(sheetPaymentMemo({})).toBeNull()
  })
  it('warns in words when the bank row is already allocated to a job as cost, naming the allocation', async () => {
    const r = await payReply({ ...PAID, mercury_transaction_id: BANK }, allocated())
    expect(r.bank_row).toMatchObject({ id: BANK, amount_out: 1800, posted_on: '2026-10-20', paid_to: 'ZZ SAMPLE SUB LLC' })
    expect(r.counts_twice).toEqual([{ allocation_id: ALLOC, job_id: JOB, job: 'JP9102', cost_on_the_job: 1800, note: 'October labor', same_job_as_the_sheet: true }])
    const warnings = r.warnings as string[]
    expect(warnings[0]).toBe(
      `These dollars would count twice. The bank row is already allocated to a job as cost: $1,800.00 on JP9102 (allocation ${ALLOC}). An allocated bank row counts in a job's profit as a card charge, and this sheet already counts on JP9102 as sub labor for what it owes. This verb does not move an allocation: plan_cost_batch takes it off the job, and the office's rule for a bank row that pays contract labor is to label it Payroll in Banking, never to split it onto the job.`,
    )
    expect(warnings.join(' ')).toContain('The bank row is $1,800.00 out and this payment $400.00')
    expect(r.may_count_twice).toBeUndefined()
    expect((r.does_not as string[]).join(' ')).toContain('It moves no allocation. plan_cost_batch moves a bank row off a job.')
    // Allocated to another job: still twice, and the plan says which job.
    const elsewhere = allocated({ mercury_transaction_job_allocations: [bankLine({ job_id: OTHER_JOB, jobs_ledger: { job_name: 'ZZ TEST Birch Lane', click_number: '9103', hcp_number: '' } })] })
    expect((await payReply({ ...PAID, mercury_transaction_id: BANK }, elsewhere)).counts_twice).toMatchObject([{ job: 'JP9103', same_job_as_the_sheet: false }])
  })
  it('a bank row allocated nowhere counts once, and the plan says so by saying nothing', async () => {
    const r = await payReply({ ...PAID, amount: 600, mercury_transaction_id: BANK }, worldWithSheet({ mercury_transactions: [bank({ amount: -600 })] }))
    expect(r.counts_twice).toEqual([])
    expect((r.warnings as string[]).join(' ')).not.toContain('count twice')
    expect(r.after).toMatchObject({ open: 0 })
  })
  it('with no bank row named, lists the job’s allocated rows that may be this payment', async () => {
    const r = await payReply({ ...PAID, amount: 1800 }, allocated({ people_labor_job_items: [sheetLine({ direct_labor_amount: 1800 })] }))
    expect(r.may_count_twice).toMatchObject([{ allocation_id: ALLOC, why: 'paid to a name that reads like theirs, for the same amount' }])
    expect((r.warnings as string[]).join(' ')).toContain('may be this same payment (may_count_twice)')
  })
  it('refuses money in, a returned payment, a bank row RLS hides, a sheet RLS hides and the same payment twice', async () => {
    const ask = { ...PAID, mercury_transaction_id: BANK }
    expect(await payRefusal(ask, worldWithSheet({ mercury_transactions: [bank({ amount: 1800 })] }))).toContain('money in, not a payment out')
    expect(await payRefusal(ask, worldWithSheet({ mercury_transactions: [bank({ status: 'failed' })] }))).toContain('The bank returned that payment')
    expect(await payRefusal(ask, worldWithSheet({ mercury_transactions: [] }))).toContain('No bank row')
    expect(await payRefusal(PAID, standingWorld())).toContain('No sheet')
    const twice = worldWithSheet({ people_labor_job_payments: [sheetPay({ amount: 400 })] })
    expect(await payRefusal(PAID, twice)).toContain('pays it twice')
    expect((await payReply({ ...PAID, duplicate_ok: true }, twice)).after).toMatchObject({ paid: 800, open: -200, reads: 'overpaid by $200.00' })
    expect(((await payReply({ ...PAID, duplicate_ok: true }, twice)).warnings as string[]).join(' ')).toContain('overpaid by $200.00')
    expect(((await payReply(ask, worldWithSheet({ mercury_transactions: [bank({ counterparty_name: 'ZZ Supply House', posted_at: '2026-09-01T12:00:00+00:00' })] }))).warnings as string[]).join(' ')).toMatch(/does not read like ZZ Sample Sub.*|more than ten days apart/)
  })
  it('removes a payment through its own RPC, the reason kept on its trace', async () => {
    const withPay = worldWithSheet({ people_labor_job_payments: [sheetPay()] })
    const r = await payReply({ action: 'remove', payment_id: SHEET_PAY, reason: 'applied to the wrong sheet' }, withPay)
    expect(r.removes).toEqual({ id: SHEET_PAY, amount: 200, kind: 'payment', paid_on: '2026-10-20', memo: 'ACH', hidden_from_sub: false, typed_in_on: '2026-10-21' })
    expect(r.sheet).toMatchObject({ paid: 200, open: 400 })
    expect(r.after).toEqual({ paid: 0, open: 600, reads: '$600.00 still owed' })
    expect(String(r.door)).toContain('remove_labor_job_payment as you')
    expect((r.sets_off as string[]).join(' ')).toContain('within 30 days')
    expect(await payRefusal({ action: 'remove', payment_id: 'cccccccc-0000-4000-8000-00000000000f', reason: 'x' }, withPay)).toContain('No sheet payment')
  })
  it('the hash moves when a payment lands on the sheet or the bank row is allocated', async () => {
    const p = shapedPay({ ...PAID, mercury_transaction_id: BANK })
    const hashOf = async (data: Data) => {
      const dry = subLaborPaymentDryRun(p, await readSubLaborPaymentWorld(fakeRest(data), p))
      if (!dry.ok) throw new Error(dry.refused)
      return planHash('plan_sub_labor_payment', p, dry.reply)
    }
    const base = await hashOf(worldWithSheet())
    expect(await hashOf(worldWithSheet())).toBe(base)
    expect(await hashOf(worldWithSheet({ people_labor_job_payments: [sheetPay()] }))).not.toBe(base)
    expect(await hashOf(allocated())).not.toBe(base)
  })
  it('the apply says what landed and the balance read back', () => {
    const p = shapedPay(PAID)
    expect(subLaborPaymentAppliedWords(p, 'ZZ Sample Sub', { ok: true, detail: { payment: { id: 'p1' } }, after: { paid: 400, open: 200 } })).toMatchObject({ action: 'record', sheet_of: 'ZZ Sample Sub', ok: true, payment: { id: 'p1' }, after: { paid: 400, open: 200, reads: '$200.00 still owed' } })
    expect(subLaborPaymentAppliedWords(p, 'ZZ Sample Sub', { ok: true, detail: {}, after: { paid: 600, open: 0 } })).toMatchObject({ after: { reads: 'paid in full' } })
    expect(subLaborPaymentAppliedWords(p, 'ZZ Sample Sub', { ok: false, error: 'RLS' })).toEqual({ action: 'record', sheet_of: 'ZZ Sample Sub', ok: false, error: 'RLS' })
  })
})
