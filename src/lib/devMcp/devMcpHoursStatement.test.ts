/**
 * The signed hours statement through the dev MCP (punch list #212, PR 5, v2.6414), on the catalog-checked fake reader:
 * the ask checked, the parties resolved by id and by name, every read a table and column the catalog has, the paper
 * built from the rows with the reading line, the pay netted as the pay report nets it, the statements made listed,
 * `make` shaped with the snapshot and the stated days marked, `file_on_matter` shaped with the file facts and refused
 * on a draft, and the send leg's calls with the link in the reply and the row marked sent. Since punch list #212's
 * residuals: the charged basis priced as the window prices it (the crew-days, the card, the job's rule) and a sub's
 * sheets read as the sheet kind, each refused where the window holds its switch.
 */
import { describe, expect, it, vi } from 'vitest'
import { CATALOG_RPCS, CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { buildRowsQuery, buildRpcQuery } from '../../../supabase/functions/_shared/devMcpDoor'
import type { Reader, Row, RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
import {
  HOURS_STATEMENT_SHAPE,
  HS_SESSIONS_CAP,
  HS_SHEET_NOT_CHARGED,
  getHoursStatement,
  hoursStatementClockLabel,
  hoursStatementNetPay,
  hoursStatementReading,
  parseHoursStatementAsk,
  prepareHoursStatementWrite,
  readHoursStatement,
  resolveHoursStatementParties,
  sendHoursStatementAsDev,
  type HoursStatementInvoke,
} from '../../../supabase/functions/_shared/devMcpHoursStatement'
import { buildHoursStatement } from '../people/hoursStatement'

// Every name, job and number here is made up.
const JOB = '0e4dcd2b-a524-4056-b93c-16713041a6e7'
const USER = '11111111-2222-4333-8444-555555555555'
const PERSON = '22222222-2222-4333-8444-555555555555'
const STUB = '33333333-2222-4333-8444-555555555555'
const HS = '44444444-2222-4333-8444-555555555555'
const DOC = '55555555-2222-4333-8444-555555555555'
const MATTER = '66666666-2222-4333-8444-555555555555'

function plainColumns(select: string): string[] {
  const out: string[] = []
  let depth = 0
  let token = ''
  for (const ch of `${select},`) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      const t = token.trim()
      if (t && t !== '*' && !/[(:!]/.test(t)) out.push(t)
      token = ''
    } else token += ch
  }
  return out
}

/** The composites test's reader: refuses what the real door refuses, so a read that passes here passes live. */
function catalogReader(data: { rpc?: Record<string, unknown>; rows?: Record<string, Row[]> }): Reader & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    rpc: async (name, args = {}, limit) => {
      asked.push(`rpc:${name}`)
      const sigs = CATALOG_RPCS[name]
      if (!sigs) throw new Error(`rpc ${name} is not in the catalog`)
      const known = new Set(sigs.flatMap((s) => Object.keys(s.args).map((a) => a.replace(/\?$/, ''))))
      for (const a of Object.keys(args)) if (!known.has(a)) throw new Error(`rpc ${name} has no argument ${a}`)
      const built = buildRpcQuery(args, limit)
      if (!built.ok) throw new Error(built.error)
      return data.rpc?.[name] ?? []
    },
    rows: async (table: string, query: RowsQuery) => {
      asked.push(`rows:${table}`)
      const entry = CATALOG_TABLES[table]
      if (!entry) throw new Error(`table ${table} is not in the catalog`)
      const columns = new Set(Object.keys(entry.columns))
      const built = buildRowsQuery(query, columns)
      if (!built.ok) throw new Error(`${table}: ${built.error}`)
      for (const c of plainColumns(query.select ?? '*')) if (!columns.has(c)) throw new Error(`${table} has no column ${c} (select)`)
      return data.rows?.[table] ?? []
    },
  }
}

const TOBY = '77777777-2222-4333-8444-555555555555'
const sessions: Row[] = [
  { id: 's1', user_id: USER, users: { name: 'Marcus Reyes' }, origin: 'user_punch', work_date: '2026-06-01', clocked_in_at: '2026-06-01T12:00:00Z', clocked_out_at: '2026-06-01T20:00:00Z', notes: 'Rough-in', approved_at: '2026-06-02T00:00:00Z', quick_add_minutes: null, approved_by_user: { name: 'Dana Office' } },
  { id: 's2', user_id: USER, users: { name: 'Marcus Reyes' }, origin: 'user_punch', work_date: '2026-06-02', clocked_in_at: '2026-06-02T12:00:00Z', clocked_out_at: '2026-06-02T20:00:00Z', notes: 'Rough-in', approved_at: '2026-06-03T00:00:00Z', quick_add_minutes: null, approved_by_user: { name: 'Dana Office' } },
  { id: 's3', user_id: USER, users: { name: 'Marcus Reyes' }, origin: 'user_punch', work_date: '2026-06-03', clocked_in_at: '2026-06-03T12:00:00Z', clocked_out_at: '2026-06-03T16:00:00Z', notes: 'Water lines', approved_at: null, quick_add_minutes: null, approved_by_user: null },
  { id: 's4', user_id: USER, users: { name: 'Marcus Reyes' }, origin: 'user_punch', work_date: '2026-06-03', clocked_in_at: '2026-06-03T17:00:00Z', clocked_out_at: '2026-06-03T17:15:00Z', notes: 'a quick add', approved_at: null, quick_add_minutes: 15, approved_by_user: null },
]
// The crew on the first day (the charged basis): a master out with Marcus. The fake reader answers every clock_sessions read with
// the same rows, so the person's own read sees Toby's row too and skips it on the user filter the live door applies — here it
// is left out of the person's rows by its own clocked_out_at being on a day the paper never counts for Marcus (none: it is
// counted), so the crew fixture is a separate table copy handed to the charged test alone.
const tobySession: Row = { id: 's9', user_id: TOBY, users: { name: 'Toby Lane' }, origin: 'user_punch', work_date: '2026-06-01', clocked_in_at: '2026-06-01T12:00:00Z', clocked_out_at: '2026-06-01T20:00:00Z', notes: '', approved_at: '2026-06-02T00:00:00Z', quick_add_minutes: null, approved_by_user: { name: 'Dana Office' } }
const snapshotMade = { input: { kind: 'clock', periodStart: '2026-06-01', periodEnd: '2026-06-13', rows: [{ day: '2026-06-01', hours: 8, note: 'Rough-in' }], withPay: true, worker: { name: 'Marcus Reyes' } }, worker: { name: 'Marcus Reyes', standing: 'helper' }, job: { number: '1042', name: 'Ridgeway Lofts', customer: 'Ridgeway Builders', site: '12 Elm St', isOfficeJob: false }, approvedBy: 'Dana Office', preparedBy: 'Dana Office', preparedOn: 'June 20, 2026', asOf: 'June 20, 2026 3:00 pm' }
const data = {
  rows: {
    jobs_ledger: [{ id: JOB, hcp_number: '1042', click_number: null, job_name: 'Ridgeway Lofts', job_address: '12 Elm St', customer_name: 'Ridgeway Builders', charge_rule: null, charge_shape: null, hourly_charge_rate: null }],
    users: [{ id: USER, name: 'Marcus Reyes', role: 'helpers', email: 'marcus@example.com', phone: null }],
    people: [{ id: PERSON, name: 'Marcus Reyes', kind: 'employee' }],
    app_settings: [] as Row[],
    clock_sessions: sessions,
    clock_typed_entries: [{ work_date: '2026-06-01' }],
    people_pay_config: [{ hourly_wage: 24, office_hourly_wage: null, is_salary: false }],
    pay_stubs: [{ id: STUB, period_start: '2026-05-31', period_end: '2026-06-06', gross_pay: 600 }],
    pay_stub_days: [{ pay_stub_id: STUB, work_date: '2026-06-01', rate_at_time: 24, job_rate: null, office_rate: null }, { pay_stub_id: STUB, work_date: '2026-06-02', rate_at_time: 24, job_rate: null, office_rate: null }],
    pay_stub_deductions: [{ pay_stub_id: STUB, amount: 100 }],
    pay_stub_additional_lines: [] as Row[],
    pay_stub_payments: [{ pay_stub_id: STUB, paid_at: '2026-06-12T15:00:00Z', amount: 500, memo: null, source_kind: 'cashapp', source_id: 'D-1' }],
    hours_statements: [{ id: HS, record_id: 'HS-1042-0001', state: 'signed', job_ledger_id: JOB, user_id: USER, period_start: '2026-06-01', period_end: '2026-06-13', with_pay: true, kind: 'clock', stated_days: [], snapshot: snapshotMade, contract_document_id: DOC, matter_document_id: null, prepared_at: '2026-06-20T20:00:00Z', updated_at: '2026-11-02T10:00:00Z' }],
  },
  rpc: { search_jobs_ledger: [{ id: JOB, hcp_number: '1042', click_number: '', job_name: 'Ridgeway Lofts', job_address: '12 Elm St', service_type_id: 'st', service_type_name: 'Plumbing' }] },
}
const ask = { job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13' }

// The charged basis: the crew's sessions, the standings, the rate card and one adjustment. The fake reader answers every
// clock_sessions read with the same rows, so the person's own rows here hold Toby's too; the person read keeps the ones it
// would (the live door filters by user_id), and the test asserts on the days Marcus has.
const chargedData = {
  ...data,
  rows: {
    ...data.rows,
    clock_sessions: [...sessions, tobySession],
    app_settings: [{ key: 'hourly_charge_rate_v1', value_num: 285, value_text: null }, { key: 'charge_rate_helper_alone_v1', value_num: 95, value_text: null }],
    job_charge_adjustments: [] as Row[],
  },
  rpc: { ...data.rpc, charge_standings: [{ id: USER, name: 'Marcus Reyes', charge_standing: 'helper', archived_at: null }, { id: TOBY, name: 'Toby Lane', charge_standing: 'master', archived_at: null }] },
}

// A sub on the job's sheets (v2.6636's kind): one sheet, two lines, one payment.
const SUB = '88888888-2222-4333-8444-555555555555'
const SUB_PERSON = '99999999-2222-4333-8444-555555555555'
const SHEET = 'aaaaaaaa-2222-4333-8444-555555555555'
const sheetData = {
  ...data,
  rows: {
    ...data.rows,
    users: [{ id: SUB, name: 'Dale Whitfield', role: 'subcontractor', email: null, phone: null }],
    people: [{ id: SUB_PERSON, name: 'Dale Whitfield', kind: 'sub' }],
    // The app's first clock day alone (no punch of the sub's): the first recorded day is the earlier of it and the first sheet.
    clock_sessions: [{ id: 's0', user_id: TOBY, users: { name: 'Toby Lane' }, origin: 'user_punch', work_date: '2026-03-12', clocked_in_at: '2026-03-12T12:00:00Z', clocked_out_at: null, notes: '', approved_at: null, quick_add_minutes: null, approved_by_user: null }] as Row[],
    people_labor_job_assignees: [{ labor_job_id: SHEET, person_id: SUB_PERSON }],
    people_labor_jobs: [{ id: SHEET, job_date: '2026-06-02', created_at: '2026-06-01T15:00:00Z', labor_rate: 85, job_ledger_id: JOB }],
    people_labor_job_items: [
      { id: 'i1', job_id: SHEET, fixture: 'Water heater', count: 1, hrs_per_unit: 4, is_fixed: false, labor_rate: null, direct_labor_amount: null, sequence_order: 0 },
      { id: 'i2', job_id: SHEET, fixture: 'Lavatory', count: 2, hrs_per_unit: 1.5, is_fixed: false, labor_rate: 90, direct_labor_amount: null, sequence_order: 1 },
    ],
    people_labor_job_payments: [{ job_id: SHEET, amount: 610, payment_date: '2026-06-10', created_at: '2026-06-10T15:00:00Z', memo: 'check 1182' }],
  },
}
const subAsk = { job: JOB, person: SUB, from: '2026-06-01', to: '2026-06-13' }

describe('get_hours_statement (punch list #212, PR 5)', () => {
  it('checks the ask: both parties, the span as days running forward, the switches, the basis and the source', () => {
    expect(parseHoursStatementAsk({ ...ask, basis: 'charged', with_pay: true })).toMatchObject({ basis: 'charged', withPay: false, kind: null })
    expect(parseHoursStatementAsk({ ...ask, kind: 'sheet' })).toMatchObject({ basis: 'paid', kind: 'sheet' })
    expect(parseHoursStatementAsk({ ...ask, basis: 'wholesale' })).toMatchObject({ error: expect.stringContaining('basis must be paid') })
    expect(parseHoursStatementAsk({ ...ask, kind: 'schedule' })).toMatchObject({ error: expect.stringContaining('kind must be clock') })
    expect(parseHoursStatementAsk({ ...ask, basis: 'charged', kind: 'sheet' })).toEqual({ error: `get_hours_statement: ${HS_SHEET_NOT_CHARGED}` })
    expect(parseHoursStatementAsk({ job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13' })).toEqual({ job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13', withPay: true, addStatedBlock: false, basis: 'paid', kind: null })
    expect(parseHoursStatementAsk({ job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13', with_pay: false, add_stated_block: true })).toMatchObject({ withPay: false, addStatedBlock: true })
    expect(parseHoursStatementAsk({ job: JOB, from: '2026-06-01', to: '2026-06-13' })).toMatchObject({ error: expect.stringContaining('needs job') })
    expect(parseHoursStatementAsk({ job: JOB, person: USER, from: 'June', to: '2026-06-13' })).toMatchObject({ error: expect.stringContaining('YYYY-MM-DD') })
    expect(parseHoursStatementAsk({ job: JOB, person: USER, from: '2026-06-13', to: '2026-06-01' })).toMatchObject({ error: expect.stringContaining('runs forward') })
  })

  it('resolves the parties by id, and by the words find_job and find_person resolve to one', async () => {
    const byId = await resolveHoursStatementParties(catalogReader(data), { job: JOB, person: USER })
    expect(byId).toEqual({ job: { id: JOB, number: '1042', name: 'Ridgeway Lofts', customer: 'Ridgeway Builders', site: '12 Elm St' }, user: { id: USER, name: 'Marcus Reyes', role: 'helpers', email: 'marcus@example.com', phone: null } })
    const reader = catalogReader(data)
    const byName = await resolveHoursStatementParties(reader, { job: '1042', person: 'Marcus Reyes' })
    expect('refused' in byName).toBe(false)
    expect(reader.asked).toContain('rpc:search_jobs_ledger')
    expect(await resolveHoursStatementParties(catalogReader({ ...data, rows: { ...data.rows, users: [] } }), { job: JOB, person: 'Nobody Here' })).toEqual({ refused: 'No person matches "Nobody Here".' })
  })

  it('reads as the window reads and builds the paper: the days with their clock labels, the pending session named, the quick add left off, the pay netted and paid in full', async () => {
    const reader = catalogReader(data)
    const parties = await resolveHoursStatementParties(reader, ask)
    if ('refused' in parties) throw new Error(parties.refused)
    const read = await readHoursStatement(reader, parties, { ...ask, withPay: true, addStatedBlock: false })
    if ('refused' in read) throw new Error(read.refused)
    expect(reader.asked).toEqual(expect.arrayContaining(['rows:clock_sessions', 'rows:people', 'rows:app_settings', 'rows:clock_typed_entries', 'rows:people_pay_config', 'rows:pay_stubs', 'rows:pay_stub_days', 'rows:pay_stub_deductions', 'rows:pay_stub_additional_lines', 'rows:pay_stub_payments']))
    expect(read.counts).toEqual({ approved: 2, pending: 1, typedDays: 1, quickAddsLeftOff: 1 })
    expect(read.worker).toEqual({ name: 'Marcus Reyes', standing: 'helper' })
    expect(read.approvedBy).toBe('Dana Office')
    expect(read.personId).toBe(PERSON)
    expect(read.input.rows.map((r) => [r.day, r.hours, r.inLabel, r.pending ?? false])).toEqual([['2026-06-01', 8, '7:00 am', false], ['2026-06-02', 8, '7:00 am', false], ['2026-06-03', 4, '7:00 am', true]])
    expect(read.input.dayRates).toEqual({ '2026-06-01': 24, '2026-06-02': 24 })
    expect(read.input.fallbackRate).toBe(24)
    expect(read.input.payGroups).toEqual([{ key: STUB, label: 'Week of May 31', from: '2026-05-31', to: '2026-06-06', due: 500, payments: [{ on: '2026-06-12', amount: 500, memo: null, sourceKind: 'cashapp', sourceId: 'D-1' }] }])
    const s = buildHoursStatement(read.input)
    expect(s.totals).toMatchObject({ hours: 16, days: 2, pendingCount: 1, amount: 384 })
    expect(s.pay?.lines.map((l) => l.state)).toEqual(['paid'])
    expect(hoursStatementReading(s, read.counts, read.firstRecordedDay, read.capped)).toBe('16 h on 2 days · 1 waiting for approval, not counted, 1 week paid in full, 1 quick add left off until approved')
    expect(hoursStatementNetPay(600, 100, 0)).toBe(500)
    expect(hoursStatementClockLabel('2026-06-01T20:00:00Z')).toBe('3:00 pm')
    expect(hoursStatementClockLabel('nope')).toBe('')
  })

  it('answers the composite: the reading first, the paper, and the statements already made last; hours only for an assistant’s read', async () => {
    const out = (await getHoursStatement(catalogReader(data), ask)) as Record<string, unknown>
    expect(out.reading).toContain('16 h on 2 days')
    expect(out.job).toMatchObject({ number: '1042' })
    expect(out.worker).toMatchObject({ name: 'Marcus Reyes', roster_id: PERSON, pay_name: 'Marcus Reyes' })
    expect((out.statement as { withPay: boolean }).withPay).toBe(true)
    expect(out.statements_made).toEqual([expect.objectContaining({ record_id: 'HS-1042-0001', state: 'signed', state_words: 'Signed. The copy is filed.', signed_copy: DOC, on_matter: null })])
    const hoursOnly = (await getHoursStatement(catalogReader(data), { ...ask, with_pay: false })) as Record<string, unknown>
    expect((hoursOnly.statement as { pay: unknown }).pay).toBeNull()
    expect(hoursOnly.reading).toContain('hours only, the pay left off')
    expect(await getHoursStatement(catalogReader(data), { job: JOB })).toMatchObject({ refused: expect.stringContaining('needs job') })
  })

  it('a span before the app’s first day reads as the worker’s own, and a span at the door’s cap says so', async () => {
    const reader = catalogReader(data)
    const parties = await resolveHoursStatementParties(reader, ask)
    if ('refused' in parties) throw new Error(parties.refused)
    const read = await readHoursStatement(reader, parties, { from: '2025-09-15', to: '2026-06-13', withPay: false, addStatedBlock: false })
    if ('refused' in read) throw new Error(read.refused)
    const s = buildHoursStatement(read.input)
    expect(read.firstRecordedDay).toBe('2026-06-01')
    expect(hoursStatementReading(s, read.counts, read.firstRecordedDay, true)).toBe(`16 h on 2 days · 1 waiting for approval, not counted, hours only, the pay left off, 1 quick add left off until approved; nothing in the app before 2026-06-01, so September 15, 2025 – May 31, 2026 is the worker's own statement; the span holds more than ${HS_SESSIONS_CAP} sessions and the paper is short by the rest — narrow the span`)
  })
})

describe('the charged basis and a sub’s sheets (punch list #212, the dev MCP’s charged and sheet papers)', () => {
  it('charged: the days priced as the crew they were part of, from the card, the standings and the job’s rule, the pay reads skipped, the reading saying what was charged', async () => {
    const reader = catalogReader(chargedData)
    const parties = await resolveHoursStatementParties(reader, ask)
    if ('refused' in parties) throw new Error(parties.refused)
    const read = await readHoursStatement(reader, parties, { ...ask, withPay: true, addStatedBlock: false, basis: 'charged', kind: null })
    if ('refused' in read) throw new Error(read.refused)
    expect(reader.asked).toEqual(expect.arrayContaining(['rpc:charge_standings', 'rows:app_settings', 'rows:jobs_ledger', 'rows:job_charge_adjustments']))
    expect(reader.asked).not.toContain('rows:pay_stubs')
    expect(read.source).toBe('clock')
    expect(read.input.basis).toBe('charged')
    expect(read.input.withPay).toBe(false)
    // June 1: Marcus with Toby, a master with a helper at $285; June 2: Marcus alone, a helper alone at $95; June 3 stays pending.
    expect(read.input.rows.map((r) => [r.day, r.hours, r.chargeRate ?? null, r.pending ?? false])).toEqual([['2026-06-01', 8, 285, false], ['2026-06-02', 8, 95, false], ['2026-06-03', 4, null, true]])
    expect(read.input.rows[0]!.note).toBe('with Toby · master with a helper')
    expect(read.input.rows[1]!.note).toBe('alone · a helper alone')
    expect(read.charge).toEqual({ rate: 285, words: 'the crew on each day · $285.00 the crew’s hour', unpriced: [], crewDays: 2, uncharged: [], unchargedDays: 0 })
    expect(read.input.chargeWords).toBe('the crew on each day · $285.00 the crew’s hour')
    const s = buildHoursStatement(read.input)
    expect(s.basis).toBe('charged')
    expect(s.pay).toBeNull()
    expect(s.charged).toMatchObject({ total: 3040 })
    expect(hoursStatementReading(s, read.counts, read.firstRecordedDay, read.capped)).toBe('16 h on 2 days · 1 waiting for approval, not counted, charged 16 h as the crew on each day · $285.00 the crew’s hour = $3,040.00, 1 quick add left off until approved')
    const out = (await getHoursStatement(catalogReader(chargedData), { ...ask, basis: 'charged' })) as Record<string, unknown>
    expect(out).toMatchObject({ basis: 'charged', kind: 'clock', rows_from: 'clock', with_pay: false, charge: { rate: 285 } })
  })

  it('a sub on the job’s sheets reads the sheets: the lines as rows grouped by sheet, one pay group a sheet, the counts and the reading in sheet words; kind clock reads their punches instead', async () => {
    const reader = catalogReader(sheetData)
    const parties = await resolveHoursStatementParties(reader, subAsk)
    if ('refused' in parties) throw new Error(parties.refused)
    const read = await readHoursStatement(reader, parties, { ...subAsk, withPay: true, addStatedBlock: false, basis: 'paid', kind: null })
    if ('refused' in read) throw new Error(read.refused)
    expect(reader.asked).toEqual(expect.arrayContaining(['rows:people', 'rows:people_labor_job_assignees', 'rows:people_labor_jobs', 'rows:people_labor_job_items', 'rows:people_labor_job_payments']))
    expect(read.source).toBe('sheet')
    expect(read.input.kind).toBe('sheet')
    expect(read.worker).toEqual({ name: 'Dale Whitfield', standing: 'subcontractor' })
    expect(read.approvedBy).toBeNull()
    expect(read.personId).toBe(SUB_PERSON)
    expect(read.counts).toEqual({ approved: 2, pending: 0, typedDays: 0, quickAddsLeftOff: 0, sheets: 1 })
    expect(read.input.rows.map((r) => [r.day, r.hours, r.note, r.rate, r.amount, r.group?.label])).toEqual([
      ['2026-06-02', 4, 'Water heater', 85, 340, 'Sheet 1 · June 2, 2026'],
      ['2026-06-02', 3, 'Lavatory × 2', 90, 270, 'Sheet 1 · June 2, 2026'],
    ])
    expect(read.input.payGroups).toEqual([{ key: SHEET, label: 'Sheet 1 · June 2, 2026', from: '2026-06-02', to: '2026-06-02', due: 610, payments: [{ on: '2026-06-10', amount: 610, memo: 'check 1182', sourceKind: null, sourceId: null }] }])
    // The first recorded day is the earlier of the clock's and the sheets'.
    expect(read.firstRecordedDay).toBe('2026-03-12')
    const s = buildHoursStatement(read.input)
    expect(s.kind).toBe('sheet')
    expect(hoursStatementReading(s, read.counts, read.firstRecordedDay, read.capped)).toBe('7 h on 2 lines over 1 sheet, 1 sheet paid in full')
    const out = (await getHoursStatement(catalogReader(sheetData), subAsk)) as Record<string, unknown>
    expect(out).toMatchObject({ kind: 'sheet', rows_from: 'sheet', basis: 'paid', with_pay: true })
    // The sub's own punches, by name: the clock kind, which here holds nothing.
    const clock = await readHoursStatement(catalogReader(sheetData), parties, { ...subAsk, withPay: true, addStatedBlock: false, basis: 'paid', kind: 'clock' })
    if ('refused' in clock) throw new Error(clock.refused)
    expect(clock.source).toBe('clock')
    expect(clock.input.rows).toEqual([])
  })

  it('refuses a charged sheet paper in words, in the ask and once the sub is found on the sheets; a sub with no sheet on the job reads the clock', async () => {
    expect(await getHoursStatement(catalogReader(sheetData), { ...subAsk, basis: 'charged' })).toEqual({ refused: `Dale Whitfield is on this job’s sheets: ${HS_SHEET_NOT_CHARGED}` })
    const noSheets = { ...sheetData, rows: { ...sheetData.rows, people_labor_job_assignees: [] as Row[] } }
    const out = (await getHoursStatement(catalogReader(noSheets), subAsk)) as Record<string, unknown>
    expect(out).toMatchObject({ kind: 'clock', rows_from: 'clock' })
    expect(out.reading).toContain('0 h on 0 days')
  })
})

describe('plan_hours_statement: the shaping before the write', () => {
  const io = (over: Partial<Parameters<typeof prepareHoursStatementWrite>[0]> = {}) => ({
    reader: catalogReader(data),
    signedPdf: vi.fn(async () => ({ bytes: new Uint8Array([37, 80, 68, 70, 45]), mime: 'application/pdf' })),
    sha256: vi.fn(async () => 'c'.repeat(64)),
    ...over,
  })
  const who = { userId: 'u-dev', name: 'Robert Dev' }

  it('make: the parties resolved, the clock read into the snapshot with its as-of left for apply, the stated days marked as stated by the dev with their source, send kept', async () => {
    const out = await prepareHoursStatementWrite(io(), { statement: { job: '1042', person: USER, from: '2026-06-01', to: '2026-06-13', stated_days: [{ day: '9/15/2025', hours: '8', note: 'Rough-in', source: 'a text from the worker' }], send: { how: 'link' } }, plan_hash: 'a'.repeat(64) }, who, '2026-11-03')
    if ('error' in out) throw new Error(out.error)
    const p = out.args.statement as Record<string, unknown>
    expect(out.args.plan_hash).toBe('a'.repeat(64))
    expect(p).toMatchObject({ action: 'make', job_ledger_id: JOB, user_id: USER, person_id: PERSON, period_start: '2026-06-01', period_end: '2026-06-13', with_pay: true, kind: 'clock', gap_from: null, gap_to: null, send: { how: 'link' } })
    expect(p.stated_days).toEqual([{ day: '2025-09-15', hours: 8, note: 'Rough-in', statedBy: 'Robert Dev, 2026-11-03 · a text from the worker' }])
    expect(out.snapshot).toMatchObject({ worker: { name: 'Marcus Reyes', standing: 'helper' }, job: { number: '1042', site: '12 Elm St', isOfficeJob: false }, approvedBy: 'Dana Office', preparedBy: 'Robert Dev', preparedOn: 'November 3, 2026', asOf: '' })
    expect((out.snapshot as { input: { rows: unknown[] } }).input.rows).toHaveLength(3)
    expect(out.send).toEqual({ how: 'link' })
    expect(out.file).toBeNull()
  })

  it('make on the charged basis carries the basis, the rate and the words the row keeps, with the pay off; a sheet paper asked charged is refused', async () => {
    const out = await prepareHoursStatementWrite(io({ reader: catalogReader(chargedData) }), { statement: { job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13', basis: 'charged', with_pay: true } }, who, '2026-11-07')
    if ('error' in out) throw new Error(out.error)
    expect(out.args.statement).toMatchObject({ action: 'make', basis: 'charged', with_pay: false, charge_rate: 285, charge_words: 'the crew on each day · $285.00 the crew’s hour', kind: 'clock' })
    expect((out.snapshot as { input: { basis: string } }).input.basis).toBe('charged')
    const paid = await prepareHoursStatementWrite(io(), { statement: { job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13' } }, who, '2026-11-03')
    if ('error' in paid) throw new Error(paid.error)
    expect(paid.args.statement).toMatchObject({ basis: 'paid', charge_rate: null, charge_words: null, with_pay: true })
    const sheet = await prepareHoursStatementWrite(io({ reader: catalogReader(sheetData) }), { statement: { job: JOB, person: SUB, from: '2026-06-01', to: '2026-06-13' } }, who, '2026-11-07')
    if ('error' in sheet) throw new Error(sheet.error)
    expect(sheet.args.statement).toMatchObject({ kind: 'sheet', basis: 'paid', with_pay: true, person_id: SUB_PERSON, labor_company: null })
    // The sub's company on the attestation goes with a sheet paper alone (the card's last residual).
    const named = await prepareHoursStatementWrite(io({ reader: catalogReader(sheetData) }), { statement: { job: JOB, person: SUB, from: '2026-06-01', to: '2026-06-13', labor_company: ' Whitfield Plumbing LLC ' } }, who, '2026-11-07')
    if ('error' in named) throw new Error(named.error)
    expect(named.args.statement).toMatchObject({ kind: 'sheet', labor_company: 'Whitfield Plumbing LLC' })
    expect(named.snapshot).toMatchObject({ worker: { name: 'Dale Whitfield', standing: 'subcontractor', company: 'Whitfield Plumbing LLC' }, input: { worker: { name: 'Dale Whitfield', company: 'Whitfield Plumbing LLC' } } })
    expect(buildHoursStatement((named.snapshot as { input: Parameters<typeof buildHoursStatement>[0] }).input).attestation).toContain('for Whitfield Plumbing LLC')
    expect(await prepareHoursStatementWrite(io(), { statement: { job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13', labor_company: 'Whitfield Plumbing LLC' } }, who, '2026-11-03')).toMatchObject({ error: expect.stringContaining('labor_company names a sub’s company on a sheet paper') })
    expect(await prepareHoursStatementWrite(io({ reader: catalogReader(sheetData) }), { statement: { job: JOB, person: SUB, from: '2026-06-01', to: '2026-06-13', basis: 'charged' } }, who, '2026-11-07')).toEqual({ error: `plan_hours_statement: Dale Whitfield is on this job’s sheets: ${HS_SHEET_NOT_CHARGED}` })
  })

  it('make refuses in words: a span ahead of today, a bad send, a stated row with no day, a missing party', async () => {
    expect(await prepareHoursStatementWrite(io(), { statement: { job: JOB, person: USER, from: '2026-06-01', to: '2026-12-01' } }, who, '2026-11-03')).toEqual({ error: 'plan_hours_statement: to cannot be ahead of today.' })
    expect(await prepareHoursStatementWrite(io(), { statement: { job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13', send: { how: 'text' } } }, who, '2026-11-03')).toMatchObject({ error: expect.stringContaining('send.how must be email') })
    expect(await prepareHoursStatementWrite(io(), { statement: { job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13', stated_days: [{ hours: '8' }] } }, who, '2026-11-03')).toMatchObject({ error: expect.stringContaining('row 1 needs a day') })
    expect(await prepareHoursStatementWrite(io(), { statement: { job: JOB, from: '2026-06-01', to: '2026-06-13' } }, who, '2026-11-03')).toMatchObject({ error: expect.stringContaining('plan_hours_statement needs job') })
    expect(await prepareHoursStatementWrite(io(), { statement: { action: 'mark_sent', statement_id: HS } }, who, '2026-11-03')).toMatchObject({ error: expect.stringContaining('server’s own step') })
    expect(await prepareHoursStatementWrite(io(), {}, who, '2026-11-03')).toEqual({ error: HOURS_STATEMENT_SHAPE })
  })

  it('file_on_matter: the signed PDF read through the gate into its facts, the title and the shows line as the desk writes them; a draft or a copy on a matter already is refused', async () => {
    const fake = io()
    const out = await prepareHoursStatementWrite(fake, { statement: { action: 'file_on_matter', statement_id: HS, matter_id: MATTER } }, who, '2026-11-03')
    if ('error' in out) throw new Error(out.error)
    expect(fake.signedPdf).toHaveBeenCalledWith(DOC)
    expect(out.args.statement).toEqual({
      action: 'file_on_matter',
      statement_id: HS,
      matter_id: MATTER,
      title: 'Signed hours statement HS-1042-0001 · Marcus Reyes',
      shows: 'Marcus Reyes signed for 8 h of work on job 1042 at 12 Elm St, June 1 – June 13, 2026 and what the company paid for it, from the clock and the pay reports as they stood.',
      original_name: 'HS-1042-0001 signed.pdf',
      mime: 'application/pdf',
      size_bytes: 5,
      sha256: 'c'.repeat(64),
      dated_on: '2026-11-02',
    })
    expect(out.file).toMatchObject({ name: 'HS-1042-0001 signed.pdf', mime: 'application/pdf' })
    const draft = { ...data, rows: { ...data.rows, hours_statements: [{ ...data.rows.hours_statements[0], state: 'draft' }] } }
    expect(await prepareHoursStatementWrite(io({ reader: catalogReader(draft) }), { statement: { action: 'file_on_matter', statement_id: HS, matter_id: MATTER } }, who, '2026-11-03')).toEqual({ error: 'HS-1042-0001 is draft: only a signed statement goes on the matter.' })
    const onMatter = { ...data, rows: { ...data.rows, hours_statements: [{ ...data.rows.hours_statements[0], matter_document_id: 'ld-1' }] } }
    expect(await prepareHoursStatementWrite(io({ reader: catalogReader(onMatter) }), { statement: { action: 'file_on_matter', statement_id: HS, matter_id: MATTER } }, who, '2026-11-03')).toMatchObject({ error: expect.stringContaining('on a matter already') })
  })
})

describe('the send leg after a make lands', () => {
  const invoke = (answers: Record<string, { ok: boolean; status: number; body: unknown }>): HoursStatementInvoke & { calls: Array<[string, Record<string, unknown>]> } => {
    const calls: Array<[string, Record<string, unknown>]> = []
    const fn = (async (name: string, body: Record<string, unknown>) => {
      calls.push([name, body])
      return answers[name] ?? { ok: false, status: 404, body: { error: 'no such function' } }
    }) as HoursStatementInvoke & { calls: typeof calls }
    fn.calls = calls
    return fn
  }

  it('draws the form, mints the link by email, marks the row sent, and keeps the link out of the reply when the email went', async () => {
    const fake = invoke({ 'hours-statement-signing': { ok: true, status: 200, body: { ok: true, document_id: DOC, worker: { name: 'Marcus Reyes', email: 'marcus@example.com', phone: null } } }, 'send-contract-for-signature': { ok: true, status: 200, body: { ok: true, emailed: true, accept_url: 'https://clicktooling.com/contract/accept?t=tok' } } })
    const markSent = vi.fn(async () => true)
    const reply = await sendHoursStatementAsDev(fake, markSent, { statementId: HS, how: 'email', publicOrigin: 'https://clicktooling.com' })
    expect(fake.calls).toEqual([
      ['hours-statement-signing', { action: 'prepare', statement_id: HS, how: 'email' }],
      ['send-contract-for-signature', { person_contract_document_id: DOC, public_origin: 'https://clicktooling.com', signer_email: 'marcus@example.com' }],
    ])
    expect(markSent).toHaveBeenCalledWith(HS)
    expect(reply).toEqual({ how: 'email', document_id: DOC, emailed: true, accept_url: null, worker_email: 'marcus@example.com', marked_sent: true, problem: null })
  })

  it('hands the link back for how link, and holds an email with no address before minting anything', async () => {
    const fake = invoke({ 'hours-statement-signing': { ok: true, status: 200, body: { ok: true, document_id: DOC, worker: { name: 'Marcus Reyes', email: null, phone: null } } }, 'send-contract-for-signature': { ok: true, status: 200, body: { ok: true, emailed: false, accept_url: 'https://clicktooling.com/contract/accept?t=tok' } } })
    const link = await sendHoursStatementAsDev(fake, async () => true, { statementId: HS, how: 'link', publicOrigin: null })
    expect(fake.calls[1]).toEqual(['send-contract-for-signature', { person_contract_document_id: DOC, mode: 'link' }])
    expect(link).toMatchObject({ how: 'link', accept_url: 'https://clicktooling.com/contract/accept?t=tok', marked_sent: true, problem: null })
    const held = await sendHoursStatementAsDev(fake, async () => true, { statementId: HS, how: 'email', publicOrigin: null })
    expect(held.problem).toContain('no email on the roster')
    expect(held.marked_sent).toBe(false)
    expect(fake.calls).toHaveLength(3)
  })

  it('a form that cannot be drawn leaves the row a draft and says why', async () => {
    const fake = invoke({ 'hours-statement-signing': { ok: false, status: 409, body: { error: 'This statement is already signed. Open the signed PDF instead.' } } })
    const reply = await sendHoursStatementAsDev(fake, async () => true, { statementId: HS, how: 'link', publicOrigin: null })
    expect(reply.problem).toBe('The form could not be drawn: This statement is already signed. Open the signed PDF instead.')
    expect(reply.marked_sent).toBe(false)
  })
})
