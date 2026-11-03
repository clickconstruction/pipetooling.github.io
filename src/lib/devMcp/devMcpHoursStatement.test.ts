/**
 * The signed hours statement through the dev MCP (punch list #212, PR 5, v2.6414), on the catalog-checked fake reader:
 * the ask checked, the parties resolved by id and by name, every read a table and column the catalog has, the paper
 * built from the rows with the reading line, the pay netted as the pay report nets it, the statements made listed,
 * `make` shaped with the snapshot and the stated days marked, `file_on_matter` shaped with the file facts and refused
 * on a draft, and the send leg's calls with the link in the reply and the row marked sent.
 */
import { describe, expect, it, vi } from 'vitest'
import { CATALOG_RPCS, CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { buildRowsQuery, buildRpcQuery } from '../../../supabase/functions/_shared/devMcpDoor'
import type { Reader, Row, RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
import {
  HOURS_STATEMENT_SHAPE,
  HS_SESSIONS_CAP,
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

const sessions: Row[] = [
  { id: 's1', work_date: '2026-06-01', clocked_in_at: '2026-06-01T12:00:00Z', clocked_out_at: '2026-06-01T20:00:00Z', notes: 'Rough-in', approved_at: '2026-06-02T00:00:00Z', quick_add_minutes: null, approved_by_user: { name: 'Dana Office' } },
  { id: 's2', work_date: '2026-06-02', clocked_in_at: '2026-06-02T12:00:00Z', clocked_out_at: '2026-06-02T20:00:00Z', notes: 'Rough-in', approved_at: '2026-06-03T00:00:00Z', quick_add_minutes: null, approved_by_user: { name: 'Dana Office' } },
  { id: 's3', work_date: '2026-06-03', clocked_in_at: '2026-06-03T12:00:00Z', clocked_out_at: '2026-06-03T16:00:00Z', notes: 'Water lines', approved_at: null, quick_add_minutes: null, approved_by_user: null },
  { id: 's4', work_date: '2026-06-03', clocked_in_at: '2026-06-03T17:00:00Z', clocked_out_at: '2026-06-03T17:15:00Z', notes: 'a quick add', approved_at: null, quick_add_minutes: 15, approved_by_user: null },
]
const snapshotMade = { input: { kind: 'clock', periodStart: '2026-06-01', periodEnd: '2026-06-13', rows: [{ day: '2026-06-01', hours: 8, note: 'Rough-in' }], withPay: true, worker: { name: 'Marcus Reyes' } }, worker: { name: 'Marcus Reyes', standing: 'helper' }, job: { number: '1042', name: 'Ridgeway Lofts', customer: 'Ridgeway Builders', site: '12 Elm St', isOfficeJob: false }, approvedBy: 'Dana Office', preparedBy: 'Dana Office', preparedOn: 'June 20, 2026', asOf: 'June 20, 2026 3:00 pm' }
const data = {
  rows: {
    jobs_ledger: [{ id: JOB, hcp_number: '1042', click_number: null, job_name: 'Ridgeway Lofts', job_address: '12 Elm St', customer_name: 'Ridgeway Builders' }],
    users: [{ id: USER, name: 'Marcus Reyes', role: 'helpers', email: 'marcus@example.com', phone: null }],
    people: [{ id: PERSON, name: 'Marcus Reyes' }],
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

describe('get_hours_statement (punch list #212, PR 5)', () => {
  it('checks the ask: both parties, the span as days running forward, the switches', () => {
    expect(parseHoursStatementAsk({ job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13' })).toEqual({ job: JOB, person: USER, from: '2026-06-01', to: '2026-06-13', withPay: true, addStatedBlock: false })
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
    const s = buildHoursStatement(read.input)
    expect(read.firstRecordedDay).toBe('2026-06-01')
    expect(hoursStatementReading(s, read.counts, read.firstRecordedDay, true)).toBe(`16 h on 2 days · 1 waiting for approval, not counted, hours only, the pay left off, 1 quick add left off until approved; nothing in the app before 2026-06-01, so September 15, 2025 – May 31, 2026 is the worker's own statement; the span holds more than ${HS_SESSIONS_CAP} sessions and the paper is short by the rest — narrow the span`)
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
