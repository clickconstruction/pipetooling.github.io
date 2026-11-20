import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LABOR_RATE_KEY,
  LABOR_ASSIGNED_DELIMITER,
  SHEET_PAYMENT_REMOVE_RPC,
  SHEET_PAY_METHODS,
  SHEET_PAY_METHODS_WITH_REF,
  SHEET_PAY_METHOD_LABEL,
  SHEET_SENDING_RPC,
  SUB_LABOR_PAYMENT_VERBS,
  SUB_LABOR_VERBS,
  bankLinesLikeThisPay,
  isSubLaborPaymentVerb,
  isSubLaborVerb,
  laborLineWords,
  laborPersonFacts,
  SHEET_TEAM_KINDS,
  SHEET_TEAM_ROLES,
  teammateWords,
  payeeReadsLike,
  readLaborPerson,
  readSubLaborPaymentWorld,
  readSubLaborWorld,
  sheetBalance,
  sheetInsertRow,
  sheetItemRows,
  sheetJobCostCents,
  sheetOwedCents,
  sheetPayHowWords,
  sheetPayMethodFrom,
  sheetPaymentInsertRow,
  sheetPaymentMemo,
  sheetRateFor,
  sheetSendingArgs,
  sheetSentTo,
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
import { SUB_PAY_METHODS, subPayMethodLabel, subPayMethodRefField } from '../subWorkOrders/subPaymentWindow'
import { ALLOC, BANK, BENCH_ROW, DEV, GONE_ROW, JOB, MASTER_ROW, MASTER_USER, MONEY, OTHER_JOB, PRIMARY_ROW, PRIMARY_USER, SHEET, SHEET_PAY, SUB_ROW, SUB_USER, TODAY, TWIN_USER, bank, bankLine, fakeRest, job, masterRow, masterUser, otherJob, sheet, sheetLine, sheetPay, standingWorld, subRow, subUser, worldWithSheet } from './subLaborFixture'

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
const PAID = { sheet_id: SHEET, amount: 400, paid_on: '2026-10-20', method: 'Mercury', reference: 'ZZ-1001' }
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
    expect(SERVER).toContain("const SERVER_VERSION = '0.118.0'")
    expect(SERVER).toContain('Writes are one hundred and forty-nine verbs and nothing else:')
    expect(README).toContain("eighty-seven since v2.6944's sub labor pairs")
    expect(README).toContain('one hundred and forty-nine `plan_` / `apply_` / `revert_` verbs')
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
    // The record's door is the Record payment window's: the same function, called with the arguments the catalog has.
    expect(SHEET_SENDING_RPC).toBe('record_sub_sending')
    expect(LEDGER).toContain(`supabase.rpc('${SHEET_SENDING_RPC}' as never, {`)
    expect(SERVER).toContain('restPost(session, `rpc/${SHEET_SENDING_RPC}`, sheetSendingArgs(p, world))')
    const args = sheetSendingArgs(shapedPay(PAID) as SheetPaymentRecord, { sentTo: null })
    expect(Object.keys(args).sort()).toEqual(Object.keys(CATALOG_RPCS[SHEET_SENDING_RPC]![0]!.args).map((k) => k.replace('?', '')).sort())
    for (const k of Object.keys(args)) expect(LEDGER).toContain(`      ${k}: `)
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
  it('refuses a helper, an archived sub, a sub on the bench, a twin, nobody and two people of one name', async () => {
    const say = async (asked: string, data?: Data) => {
      const f = await facts(asked, data)
      if (f.ok) throw new Error('expected a refusal')
      return f.refused
    }
    // A helper is on neither of the form's lists: by account, and by a roster row with no account.
    const helper = standingWorld({ users: [masterUser({ role: 'helpers' })], people: [masterRow({ kind: 'helper' })] })
    expect(await say(MASTER_USER, helper)).toContain("ZZ Sample Master is not someone the form's Paid to step offers (a helper)")
    expect(await say(MASTER_USER, helper)).toContain('A helper is paid through payroll from their hours')
    expect(await say(MASTER_ROW, standingWorld({ users: [], people: [masterRow({ kind: 'helper', account_user_id: null })] }))).toContain('(on the roster as helper)')
    expect(FORM).toContain("const kindsExceptSub: PersonKind[] = [\n      'master_technician',\n      'assistant',\n      'estimator',\n      'primary',\n      'superintendent',\n    ]")
    expect(await say(GONE_ROW)).toContain('ZZ Gone Sub is archived')
    expect(await say(BENCH_ROW)).toContain('on the bench since 2026-08-01')
    expect(await say(TWIN_USER)).toContain('is a digital twin')
    expect(await say('ZZ Nobody')).toContain('No person "ZZ Nobody" is visible to you')
    const two = standingWorld({ people: [subRow(), subRow({ id: BENCH_ROW, account_user_id: null, end_date: null })] })
    expect(await say('ZZ Sample Sub', two)).toContain('matches 2 people')
    // A teammate who has left, by account and by a roster row with no account.
    expect(await say(MASTER_USER, standingWorld({ users: [masterUser({ archived_at: '2026-07-01T12:00:00+00:00' })] }))).toContain('ZZ Sample Master is archived')
    expect(await say(MASTER_ROW, standingWorld({ users: [], people: [masterRow({ account_user_id: null, archived_at: '2026-07-01T12:00:00+00:00' })] }))).toContain('ZZ Sample Master is archived')
  })
  it('a teammate the form’s Office Team offers is taken, and the plan says the sheet is their own, on top of their wages', async () => {
    for (const asked of ['zz sample master', MASTER_ROW, MASTER_USER]) {
      expect(await facts(asked)).toMatchObject({ ok: true, person: { name: 'ZZ Sample Master', people_id: MASTER_ROW, user_id: MASTER_USER, kind: 'master_technician', role: 'master_technician', pay_ledger: 'crew', offered_as: 'office_team' } })
    }
    const r = await reply({ ...FLAT, person: MASTER_USER })
    expect(r.person).toEqual({ name: 'ZZ Sample Master', people_id: MASTER_ROW, user_id: MASTER_USER, kind: 'master_technician', account_role: 'master_technician', offered_by: "the form's Office Team group", pay_ledger: 'Team · sub labor: a sheet of their own, which the Pay ledger counts as owed to them' })
    expect(r.sheet).toMatchObject({ assigned_to_name: 'ZZ Sample Master' })
    const warned = (r.warnings as string[]).join(' ')
    expect(warned).toContain("ZZ Sample Master is a master technician, not a roster sub. The form's Office Team group offers them.")
    expect(warned).toContain('It is money on top of their wages, and no payroll screen reads a sheet.')
    expect(warned).toContain('still counts on JP9102 as sub labor')
    expect(r.does_not as string[]).toContain("It writes a sheet for one person the form's Paid to step offers: a subcontractor, a primary or one of the Office Team. A sheet for several people, or for a helper, is the form's own.")
    // Every role the group reads an account by, and the form's own words for each.
    for (const role of SHEET_TEAM_ROLES) expect(await facts(MASTER_USER, standingWorld({ users: [masterUser({ role })] }))).toMatchObject({ ok: true, person: { role, offered_as: 'office_team', pay_ledger: 'crew' } })
    expect(FORM).toContain("(k === 'assistant' ? isAssistantLike(u.role) : u.role === userRole)")
    expect(FORM).toContain(".filter((u) => u.role === 'dev')")
    // A roster row with no account is offered by its kind.
    for (const kind of SHEET_TEAM_KINDS) expect(await facts(MASTER_ROW, standingWorld({ users: [], people: [masterRow({ kind, account_user_id: null })] }))).toMatchObject({ ok: true, person: { user_id: null, people_id: MASTER_ROW, kind, role: null, offered_as: 'office_team', pay_ledger: 'crew' } })
  })
  it('a superintendent whose roster row is kind sub is a teammate: the account’s role decides, and the bench is a sub’s', async () => {
    // The case that asked for this: a roster row of kind sub behind a login that is not a subcontractor's.
    const world = standingWorld({ users: [subUser({ role: 'superintendent' })] })
    for (const asked of ['ZZ Sample Sub', SUB_ROW, SUB_USER]) {
      expect(await facts(asked, world)).toMatchObject({ ok: true, person: { name: 'ZZ Sample Sub', people_id: SUB_ROW, user_id: SUB_USER, kind: 'sub', role: 'superintendent', pay_ledger: 'crew', offered_as: 'office_team' } })
    }
    const r = await reply(FLAT, world)
    expect(r.person).toEqual({ name: 'ZZ Sample Sub', people_id: SUB_ROW, user_id: SUB_USER, kind: 'sub', account_role: 'superintendent', offered_by: "the form's Office Team group", pay_ledger: 'Team · sub labor: a sheet of their own, which the Pay ledger counts as owed to them' })
    expect((r.warnings as string[]).join(' ')).toContain('ZZ Sample Sub is a superintendent, on the roster as a sub, not a roster sub.')
    expect(teammateWords({ kind: 'sub', role: 'assistant' })).toBe('an assistant, on the roster as a sub')
    expect(teammateWords({ kind: 'estimator', role: null })).toBe('an estimator on the roster with no account')
    // The form benches a sub by its roster row; a teammate's account is still offered under Office Team.
    expect(await facts(SUB_USER, standingWorld({ users: [subUser({ role: 'superintendent' })], people: [subRow({ end_date: '2026-08-01' })] }))).toMatchObject({ ok: true, person: { offered_as: 'office_team' } })
    // A roster row that no longer stands ties nothing: the name trigger reads no archived row.
    const gone = await reply({ ...FLAT, person: SUB_USER }, standingWorld({ users: [subUser({ role: 'superintendent' })], people: [subRow({ archived_at: '2026-07-01T12:00:00+00:00' })] }))
    expect(gone.person).toMatchObject({ people_id: null, kind: 'superintendent', pay_ledger: 'no roster row: the Pay ledger reads the name as an outside sub until People gives them one' })
    expect((gone.warnings as string[]).join(' ')).toContain('would not read as Team · sub labor until they have a roster row')
  })
  it('a primary is taken as the form’s Subcontractors list offers one, and the plan says the sheet is their own, owed to them', async () => {
    for (const asked of ['ZZ Sample Primary', PRIMARY_ROW, PRIMARY_USER]) {
      expect(await facts(asked)).toMatchObject({ ok: true, person: { name: 'ZZ Sample Primary', people_id: PRIMARY_ROW, user_id: PRIMARY_USER, kind: 'primary', role: 'primary', pay_ledger: 'crew' } })
    }
    const r = await reply({ ...FLAT, person: PRIMARY_USER })
    expect(r.person).toEqual({ name: 'ZZ Sample Primary', people_id: PRIMARY_ROW, user_id: PRIMARY_USER, kind: 'primary', pay_ledger: 'Team · sub labor: a sheet of their own, which the Pay ledger counts as owed to them' })
    expect(r.sheet).toMatchObject({ assigned_to_name: 'ZZ Sample Primary' })
    const warned = (r.warnings as string[]).join(' ')
    expect(warned).toContain('ZZ Sample Primary is a primary, not a roster sub')
    expect(warned).toContain('A sheet that names them alone is their own: the Pay ledger counts what is open on it as owed to them')
    expect(warned).not.toContain('Crew pay')
    expect(warned).not.toContain('payroll)')
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
    expect(shapedPay({ ...PAID, mercury_transaction_id: BANK.toUpperCase(), hidden_from_sub: true })).toEqual({ action: 'record', sheet_id: SHEET, amount: 400, paid_on: '2026-10-20', method: 'mercury', reference: 'ZZ-1001', mercury_transaction_id: BANK, hidden_from_sub: true })
    expect(payError({ ...PAID, amount: -5 })).toContain('more than 0')
    expect(payError({ ...PAID, paid_on: '2026-11-30' })).toContain('ahead of today')
    expect(payError({ ...PAID, mercury_transaction_id: 'the October transfer' })).toContain('mercury_transactions.id')
    expect(payError({ action: 'backcharge', sheet_id: SHEET, amount: 5 })).toContain('a backcharge is the payment window\'s own press')
    expect(payError({ action: 'remove', payment_id: SHEET_PAY })).toContain('a remove needs reason')
    expect(payError({ sheet_id: 'x' })).toContain('needs payment')
  })
  it('takes the window’s methods by key or by words, and a reference only where the window has a box for one', () => {
    // The seat's list is the window's own, with the window's words and the window's rule for which carry a number.
    expect([...SHEET_PAY_METHODS]).toEqual([...SUB_PAY_METHODS])
    for (const m of SHEET_PAY_METHODS) {
      expect(SHEET_PAY_METHOD_LABEL[m]).toBe(subPayMethodLabel(m))
      expect(SHEET_PAY_METHODS_WITH_REF.includes(m)).toBe(subPayMethodRefField(m) !== null)
      expect(sheetPayMethodFrom(m)).toBe(m)
      expect(sheetPayMethodFrom(SHEET_PAY_METHOD_LABEL[m].toUpperCase())).toBe(m)
    }
    expect(sheetPayMethodFrom('cash app')).toBe('cashapp')
    expect(sheetPayMethodFrom('Apple-Pay')).toBe('apple_pay')
    expect(sheetPayMethodFrom('ACH')).toBeNull()
    // Never the stored word for a payment made from a credit: no money left for one.
    expect(sheetPayMethodFrom('credit')).toBeNull()
    expect(payError({ ...PAID, method: 'ACH' })).toContain('one of the Record payment window\'s chips: Check, Zelle, Mercury, Cash App, Apple Pay, Cash, Client direct, Other. A transfer out of the Mercury account is Mercury')
    expect(payError({ sheet_id: SHEET, amount: 400, paid_on: '2026-10-20', reference: '1187' })).toContain('so it needs method')
    expect(payError({ ...PAID, method: 'cash' })).toContain('Cash carries no number of its own in the window. Put "ZZ-1001" in note.')
    expect(shapedPay({ sheet_id: SHEET, amount: 400, paid_on: '2026-10-20', method: 'CHECK', reference: '1187', note: 'second half' })).toMatchObject({ method: 'check', reference: '1187', note: 'second half' })
    expect(sheetPayHowWords({ method: 'check', method_ref: '1187' })).toBe('Check 1187')
    expect(sheetPayHowWords({ method: 'credit' })).toBe('From credit')
    expect(sheetPayHowWords({ method: null, method_ref: '1187' })).toBe('')
  })
  it('lands as the Record payment window’s sending: one line, the method and its number in their columns, the note as the memo', async () => {
    const { p, world, dry } = await planPay(PAID)
    if (!dry.ok) throw new Error(dry.refused)
    const row = { job_id: SHEET, amount: 400, memo: null, sequence_order: 0, payment_date: '2026-10-20', hidden_from_sub: false, method: 'mercury', method_ref: 'ZZ-1001' }
    expect(sheetPaymentInsertRow(p as SheetPaymentRecord, world)).toEqual(row)
    expect(sheetSendingArgs(p as SheetPaymentRecord, world)).toEqual({ p_person_id: SUB_ROW, p_lines: [{ job_id: SHEET, amount: 400 }], p_credit: 0, p_payment_date: '2026-10-20', p_method: 'mercury', p_method_ref: 'ZZ-1001', p_memo: null, p_hidden_from_sub: false })
    expect(dry.reply.records).toEqual({
      sending: { to: 'ZZ Sample Sub', person_id: SUB_ROW, who_reads: 'ZZ Sample Sub, the sheet\'s one sub, on the roster', sent: 400, lines: 1, credit_kept: 0, number: 'minted on apply, never reused' },
      payment: row,
      how_paid: 'Mercury ZZ-1001',
    })
    expect(String(dry.reply.door)).toContain('record_sub_sending as you, the Record payment window\'s own door')
    expect((dry.reply.sets_off as string[]).join(' ')).toContain('how it was paid and its sending\'s number')
    expect(dry.reply.sheet).toMatchObject({ id: SHEET, who: 'ZZ Sample Sub', owed: 600, paid: 0, open: 600 })
    expect(dry.reply.after).toEqual({ paid: 400, open: 200, reads: '$200.00 still owed' })
    expect(String(dry.reply.job_profit)).toContain('unchanged')
    // The method is in its own column, so nothing of it is in the memo the sub reads.
    expect((dry.reply.warnings as string[]).join(' ')).not.toContain('shows to ZZ Sample Sub')
    expect((dry.reply.warnings as string[]).join(' ')).toContain('No bank row was named')
    expect((dry.reply.does_not as string[]).join(' ')).toContain('It matches no bank row.')
    const second = await planPay({ ...PAID, amount: 400, hidden_from_sub: true, note: 'second half' }, worldWithSheet({ people_labor_job_payments: [sheetPay({ method: 'check', method_ref: '1187', sending_id: 'eeeeeeee-0000-4000-8000-000000000001' })] }))
    if (!second.dry.ok) throw new Error(second.dry.refused)
    expect((second.dry.reply.records as { payment: unknown }).payment).toEqual({ ...row, memo: 'second half', sequence_order: 1, hidden_from_sub: true })
    expect(sheetSendingArgs(second.p as SheetPaymentRecord, second.world)).toMatchObject({ p_memo: 'second half', p_hidden_from_sub: true })
    expect(second.dry.reply.after).toEqual({ paid: 600, open: 0, reads: 'paid in full: the Pay ledger shows it Paid by itself' })
    // The payments already on the sheet say how each was paid and which sending it is part of.
    expect(second.dry.reply.payments).toEqual([{ id: SHEET_PAY, amount: 200, kind: 'payment', paid_on: '2026-10-20', how_paid: 'Check 1187', memo: 'ACH', hidden_from_sub: false, sending_id: 'eeeeeeee-0000-4000-8000-000000000001', typed_in_on: '2026-10-21' }])
    // A note with no method: the memo shows to the sub, and the plan says How paid will read blank.
    const bare = await payReply({ sheet_id: SHEET, amount: 100, paid_on: '2026-10-20', note: 'cash draw' })
    expect((bare.records as { how_paid: unknown }).how_paid).toBeNull()
    expect((bare.warnings as string[]).join(' ')).toContain('The memo "cash draw" shows to ZZ Sample Sub on their portal')
    expect((bare.warnings as string[]).join(' ')).toContain('How paid reads blank')
    expect(sheetPaymentMemo({})).toBeNull()
  })
  it('names who the sending is to by the Pay view’s rule', async () => {
    const sub = subRow()
    const mate = masterRow()
    const users = [subUser(), masterUser()]
    const on = (ids: string[]) => ids.map((person_id) => ({ labor_job_id: SHEET, person_id }))
    // One sub on the roster, with a teammate riding along: the sub.
    expect(sheetSentTo(sheet(), on([SUB_ROW, MASTER_ROW]), [sub, mate], users)).toEqual({ person_id: SUB_ROW, name: 'ZZ Sample Sub', reads: 'ZZ Sample Sub, the sheet\'s one sub, on the roster' })
    // A roster sub row behind a teammate's login is a teammate. Alone on the sheet, it is their own (Taunya, 2026-11-15).
    expect(sheetSentTo(sheet({ assigned_to_name: 'ZZ Sample Master' }), on([MASTER_ROW]), [masterRow({ kind: 'sub' })], users)).toEqual({ person_id: MASTER_ROW, name: 'ZZ Sample Master', reads: 'ZZ Sample Master, a teammate, alone on a sheet of their own: sub labor paid to someone on payroll' })
    // Two teammates and no sub: shared, so no one person.
    expect(sheetSentTo(sheet({ assigned_to_name: 'ZZ Sample Master | ZZ Second Master' }), on([MASTER_ROW, BENCH_ROW]), [masterRow({ kind: 'sub' }), { ...masterRow({ kind: 'sub' }), id: BENCH_ROW, name: 'ZZ Second Master' }], users)).toEqual({ person_id: null, name: 'ZZ Sample Master | ZZ Second Master', reads: '2 teammates share the sheet and no sub is on it, so the sending names no one person' })
    // No name at all.
    expect(sheetSentTo(sheet({ assigned_to_name: '' }), [], [], [])).toEqual({ person_id: null, name: 'nobody named', reads: 'nobody is named on the sheet, so the sending names no person' })
    // Two subs share the sheet: no one person.
    expect(sheetSentTo(sheet(), on([SUB_ROW, BENCH_ROW]), [sub, { ...sub, id: BENCH_ROW, name: 'ZZ Bench Sub', account_user_id: null }], users)).toMatchObject({ person_id: null, name: 'ZZ Sample Sub | ZZ Bench Sub', reads: '2 subs share the sheet, so the sending names no one person' })
    // No assignee row: the typed name, found on the roster in any case, or not found.
    expect(sheetSentTo(sheet({ assigned_to_name: 'zz sample sub' }), [], [sub], users)).toMatchObject({ person_id: SUB_ROW, name: 'ZZ Sample Sub' })
    expect(sheetSentTo(sheet({ assigned_to_name: 'ZZ Walk-up Tile' }), [], [], [])).toEqual({ person_id: null, name: 'ZZ Walk-up Tile', reads: 'ZZ Walk-up Tile is not on the roster, so the sending names no person' })
    // Read through the fake: a sheet with no assignee row is matched by its typed name, and a name with a wildcard by nobody.
    const typed = await planPay(PAID, worldWithSheet({ people_labor_job_assignees: [] }))
    expect(typed.world.sentTo).toMatchObject({ person_id: SUB_ROW })
    const wild = await planPay(PAID, worldWithSheet({ people_labor_job_assignees: [], people_labor_jobs: [sheet({ assigned_to_name: 'ZZ Sample %' })] }))
    expect(wild.world.sentTo).toMatchObject({ person_id: null })
    // A remove reads nobody.
    const gone = await planPay({ action: 'remove', payment_id: SHEET_PAY, reason: 'wrong sheet' }, worldWithSheet({ people_labor_job_payments: [sheetPay()] }))
    expect(gone.world.sentTo).toBeNull()
  })
  it('refuses an amount past what the sheet still owes, with the figure it takes', async () => {
    expect(await payRefusal({ ...PAID, amount: 700 })).toBe('$700.00 is $100.00 more than this sheet still owes ZZ Sample Sub ($600.00). The Record payment window places what is sent past a sheet on their other open sheets or keeps it as their credit; the seat records one sheet\'s line. Record up to $600.00 here.')
    const paid = worldWithSheet({ people_labor_job_payments: [sheetPay({ amount: 600 })] })
    expect(await payRefusal({ ...PAID, amount: 50 }, paid)).toContain('has nothing left to pay: it owes $600.00 and holds $600.00 paid.')
    // A sheet with no priced line takes a payment, and the plan says how the ledger reads it.
    const unpriced = await payReply(PAID, worldWithSheet({ people_labor_job_items: [] }))
    expect((unpriced.warnings as string[]).join(' ')).toContain('The sheet has no priced line')
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
    // Nothing to warn of at all: the method is named, the bank row checks out and the memo is empty.
    expect(r.warnings).toBeUndefined()
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
    const twice = worldWithSheet({ people_labor_job_payments: [sheetPay({ amount: 200 })] })
    expect(await payRefusal({ ...PAID, amount: 200 }, twice)).toContain('pays it twice')
    expect((await payReply({ ...PAID, amount: 200, duplicate_ok: true }, twice)).after).toMatchObject({ paid: 400, open: 200, reads: '$200.00 still owed' })
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
