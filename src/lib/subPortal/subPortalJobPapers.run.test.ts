/**
 * Papers before a job opens, step 6: the two functions behind a sub's own page, run here. `sub-portal`'s and
 * `submit-sub-portal`'s own `index.ts` with their URL imports stood in for and the fake database from
 * `src/test/edgeFakeDb.ts`, so nothing here reaches a database. The sub is Harlan Mechanical of the papers' fixture,
 * with work on two jobs: 2041 Cedar Hollow Clinic and 2033 Alder Court Remodel. Every name, job and amount is made up.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, makeFakeDb, type FakeDb, type FakeRow } from '../../test/edgeFakeDb'
import { ALDER_1, ASSIGNEES, CEDAR_1, CREDITS, HARLAN, ITEMS, JOBS_LEDGER, JOB_ALDER, JOB_CEDAR, PAYMENTS, PEOPLE, RIDGE_1, SENDINGS, SHEETS, USERS, registerRows } from './subPortalPapersFixture'

type Handler = (req: Request) => Promise<Response>
type RpcCall = { name: string; args: Record<string, unknown> }
const box: { handlers: Handler[]; db: FakeDb; refuse: Set<string>; papers: Record<string, unknown>; brokenRpcs: Set<string>; rpcCalls: RpcCall[] } = { handlers: [], db: makeFakeDb(), refuse: new Set(), papers: {}, brokenRpcs: new Set(), rpcCalls: [] }

const TOKEN = 'harlan-token-0123456789abcdef'
const NDA = '00000000-0000-4000-8000-000000002391'
const SITE = '00000000-0000-4000-8000-000000002392'
const ELSEWHERE = '00000000-0000-4000-8000-000000002393'
const TAKEN_OFF = '00000000-0000-4000-8000-000000002394'
const JOB_ELSEWHERE = '00000000-0000-4000-8000-0000000371f9'
const DOC = '00000000-0000-4000-8000-0000000023d1'
const OFFER_CEDAR = '00000000-0000-4000-8000-0000000023a1'
const OFFER_ALDER = '00000000-0000-4000-8000-0000000023a2'
const ORDER_CEDAR = '00000000-0000-4000-8000-0000000023a3'

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void box.handlers.push(h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => {
    const client = fakeClient(box.db, {}, () => null)
    return {
      ...client,
      // A table in `refuse` answers every read with a refusal.
      from: (name: string) => {
        if (!box.refuse.has(name)) return client.from(name)
        const chain: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit', 'range', 'gte']) chain[m] = () => chain
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: `relation ${name} refused` } }).then(resolve)
        chain.maybeSingle = () => Promise.resolve({ data: null, error: { message: `relation ${name} refused` } })
        return chain
      },
      // The papers' two functions answer by their arguments: one job's papers, and the id of the sub's own copy.
      rpc: async (name: string, args: Record<string, unknown> = {}) => {
        box.rpcCalls.push({ name, args })
        if (box.brokenRpcs.has(name)) return { data: null, error: { message: `function ${name} is not there` } }
        if (name === 'job_papers_for_person') return { data: box.papers[String(args.p_job_id)] ?? { job_number: '', papers: [] }, error: null }
        if (name === 'job_paper_start') return { data: DOC, error: null }
        return { data: null, error: null }
      },
    }
  },
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key' }
// Deno files: loaded by path at run time, so the app's typecheck does not follow them into Deno's globals.
const READ_FILE = '../../../supabase/functions/sub-portal/index.ts'
const PRESS_FILE = '../../../supabase/functions/submit-sub-portal/index.ts'

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  await import(/* @vite-ignore */ READ_FILE)
  await import(/* @vite-ignore */ PRESS_FILE)
})

const fetchMock = vi.fn()
const CEDAR_OWED = { job_number: '2041', papers: [{ id: NDA, paper_name: 'Ridgeway Builders NDA', is_form: true, document_id: null, status: 'none', signed_at: null }, { id: SITE, paper_name: 'Site rules and photo policy', is_form: false, document_id: DOC, status: 'sent', signed_at: null }] }
const CEDAR_SIGNED = { job_number: '2041', papers: CEDAR_OWED.papers.map((p) => ({ ...p, status: 'signed', signed_at: '2026-11-16' })) }
const REQUIRED = [
  { id: NDA, job_id: JOB_CEDAR, removed_at: null },
  { id: SITE, job_id: JOB_CEDAR, removed_at: null },
  { id: ELSEWHERE, job_id: JOB_ELSEWHERE, removed_at: null },
  { id: TAKEN_OFF, job_id: JOB_ALDER, removed_at: '2026-11-01T15:00:00Z' },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-17T18:00:00Z') })
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  box.db = makeFakeDb()
  box.refuse = new Set()
  box.papers = { [JOB_CEDAR]: CEDAR_OWED }
  box.brokenRpcs = new Set()
  box.rpcCalls = []
  const copy = <T,>(rows: readonly T[]): FakeRow[] => rows.map((r) => ({ ...(r as FakeRow) }))
  box.db.tables.sub_portal_links = [{ id: 'link-harlan', person_id: HARLAN, token: TOKEN, revoked_at: null, created_by: 'office-1' }]
  box.db.tables.people = copy(PEOPLE)
  box.db.tables.users = copy(USERS)
  box.db.tables.people_labor_job_assignees = copy(ASSIGNEES)
  box.db.tables.people_labor_jobs = copy(SHEETS)
  box.db.tables.people_labor_job_items = copy(ITEMS)
  box.db.tables.people_labor_job_payments = copy(PAYMENTS)
  box.db.tables.jobs_ledger = copy(JOBS_LEDGER)
  box.db.tables.sub_payment_sendings = copy(SENDINGS)
  box.db.tables.sub_credit_entries = copy(CREDITS)
  box.db.tables.sub_papers = copy(registerRows())
  box.db.tables.sub_paper_acks = []
  box.db.tables.job_required_papers = copy(REQUIRED)
  box.db.tables.person_contract_documents = [{ id: DOC, status: 'unsent', person_id: HARLAN, person_name: 'Harlan Mechanical', document_name: 'Site rules and photo policy (job 2041)', doc_type: 'agreement', signed_at: null, expires_at: null }]
  box.db.tables.job_stage_windows = [{ id: 'win-1', window_start: '2026-11-18', window_end: '2026-11-28', fixture: { name: 'Sewer tie-in' } }]
  box.db.tables.step_commitments = [
    { id: OFFER_CEDAR, person_id: HARLAN, status: 'offered', step_id: null, labor_job_id: null, job_id: JOB_CEDAR, amount: 2600, notes: 'Storm line at Cedar Hollow Clinic', offer_scope_snapshot: { anchor: 'sheet', sheetLabel: '2041 · 410 Cedar Hollow Rd', lines: [{ label: 'Storm line to the pond', amount: 2600 }] }, offer_expires_at: '2026-12-15', proposed_start: null, proposed_end: null, work_days: null, stage_window_id: null },
    { id: OFFER_ALDER, person_id: HARLAN, status: 'offered', step_id: null, labor_job_id: null, job_id: JOB_ALDER, amount: 300, notes: null, offer_scope_snapshot: { anchor: 'sheet', sheetLabel: '2033 · 12 Alder Ct', lines: [{ label: 'Haul the old heater', amount: 300 }] }, offer_expires_at: null, proposed_start: null, proposed_end: null, work_days: null, stage_window_id: null },
    // A signed order on the Cedar sheet, with the days the sub picked: the sheet's agreement and a day on Your days.
    { id: ORDER_CEDAR, person_id: HARLAN, status: 'accepted', step_id: null, labor_job_id: CEDAR_1, job_id: null, amount: 4100, signed_at: '2026-10-27T16:00:00Z', accepted_at: '2026-10-27T16:00:00Z', signer_printed_name: 'Harlan Mechanical', offer_scope_snapshot: { anchor: 'sheet', sheetLabel: '2041 · 410 Cedar Hollow Rd', lines: [{ label: 'Pipe the clinic wing', amount: 4100 }] }, signer_acknowledgements: null, work_days: 2, picked_start: '2026-11-20', picked_end: '2026-11-23', proposed_start: null, proposed_end: null, stage_window_id: 'win-1', change_requested_at: null, change_requested_note: null, job: { hcp_number: '2041', job_address: '410 Cedar Hollow Rd' } },
  ]
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type Body = Record<string, unknown>
async function read(): Promise<{ status: number; body: Body; text: string }> {
  const res = await box.handlers[0]!(new Request(`http://localhost/functions/v1/sub-portal?token=${TOKEN}`, { method: 'GET' }))
  const text = await res.text()
  return { status: res.status, body: JSON.parse(text) as Body, text }
}
async function press(body: Record<string, unknown>): Promise<{ status: number; body: Body }> {
  const res = await box.handlers[1]!(new Request('http://localhost/functions/v1/submit-sub-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: TOKEN, ...body }) }))
  return { status: res.status, body: (await res.json()) as Body }
}
const asked = () => box.rpcCalls.filter((c) => c.name === 'job_papers_for_person').map((c) => c.args.p_job_id)
const writes = () => box.db.writes.filter((w) => w.table !== 'public_page_views').map((w) => `${w.op} ${w.table}`)

/** Everything of Cedar Hollow Clinic that says where it is or what the work is. */
const CEDAR_WORDS = ['Cedar Hollow', 'Top-out', 'Rough-in', 'First draw', 'Damaged drywall', 'Storm line', 'Pipe the clinic wing', 'Sewer tie-in']
/** The open jobs beside it: Alder Court by its link, and a sheet tied to no Pipeline job. */
const OPEN_WORDS = ['12 Alder Ct', 'Alder Court Remodel', 'Finish', 'Balance', 'Haul the old heater', 'Ridgeway Builders, Lot 12', 'Underground']

describe('sub-portal: the read is the lock for a sub with no login', () => {
  it('nothing changes for a sub whose jobs require no paper: no job is asked about and every row goes out whole', async () => {
    box.db.tables.job_required_papers = []
    const { status, body, text } = await read()
    expect(status).toBe(200)
    expect(body.job_papers).toEqual([])
    expect(asked()).toEqual([])
    expect(text).not.toContain('papersFirstJobId')
    for (const word of [...CEDAR_WORDS, ...OPEN_WORDS]) expect(text, word).toContain(word)
    // The same sub with every paper signed reads the very same page.
    box.db.tables.job_required_papers = REQUIRED.map((r) => ({ ...r }))
    box.papers = { [JOB_CEDAR]: CEDAR_SIGNED }
    const signed = await read()
    expect(signed.body).toEqual(body)
    expect(asked()).toEqual([JOB_CEDAR])
  })

  it('a job the sub owes a paper on keeps its number, days and money, and nothing that says where it is or what the work is', async () => {
    box.db.tables.job_required_papers = []
    const open = (await read()).body
    box.db.tables.job_required_papers = REQUIRED.map((r) => ({ ...r }))
    const { status, body, text } = await read()
    expect(status).toBe(200)
    // Only the job that requires a live paper is asked about, once.
    expect(asked()).toEqual([JOB_CEDAR])
    expect(body.job_papers).toEqual([
      { job_id: JOB_CEDAR, job_number: '2041', papers: [{ id: NDA, paper_name: 'Ridgeway Builders NDA', is_form: true, status: 'none', signed_at: null }, { id: SITE, paper_name: 'Site rules and photo policy', is_form: false, status: 'sent', signed_at: null }] },
    ])
    for (const word of CEDAR_WORDS) expect(text, word).not.toContain(word)
    for (const word of OPEN_WORDS) expect(text, word).toContain(word)

    const sheets = body.sheets as Array<Record<string, unknown>>
    const cedar = sheets.find((s) => s.id === CEDAR_1)!
    expect(cedar).toMatchObject({ jobNumber: '2041', address: null, items: [], plansUrl: null, agreed: 4100, paid: 2500, backcharges: 100, open: 1500, papersFirstJobId: JOB_CEDAR })
    expect(cedar.agreement).toMatchObject({ amount: 4100, signerName: 'Harlan Mechanical', lines: [] })
    expect(cedar.dates).toMatchObject({ commitmentId: ORDER_CEDAR, start: '2026-11-20', end: '2026-11-23' })
    expect(sheets.find((s) => s.id === RIDGE_1)).toEqual((open.sheets as Array<Record<string, unknown>>).find((s) => s.id === RIDGE_1))

    const offers = body.offers as Array<Record<string, unknown>>
    expect(offers.find((o) => o.id === OFFER_CEDAR)).toMatchObject({ title: 'Work order', lines: [], total: 2600, expiresOn: '2026-12-15', papersFirstJobId: JOB_CEDAR })
    expect(offers.find((o) => o.id === OFFER_ALDER)).toEqual((open.offers as Array<Record<string, unknown>>).find((o) => o.id === OFFER_ALDER))

    const days = body.days as { bookings: Array<Record<string, unknown>> }
    expect(days.bookings).toEqual([{ start: '2026-11-20', end: '2026-11-23', label: '#2041', address: null, jobNumber: '2041', source: 'pick', commitmentId: ORDER_CEDAR, note: null, papersFirstJobId: JOB_CEDAR }])

    // Money is the sub's own to read: the totals and every payment's amount and day are what they were.
    expect(body.totals).toEqual(open.totals)
    const money = (b: Body) => (b.payments as Array<Record<string, unknown>>).map((p) => [p.date, p.jobNumber, p.amount])
    expect(money(body)).toEqual(money(open))
    expect((body.payments as Array<Record<string, unknown>>).filter((p) => p.jobNumber === '2041').every((p) => p.memo === null)).toBe(true)

    // The Statements view's papers still add up, with the job's sheets named by its number alone.
    const papers = body.papers as { ok: boolean; stillOpen: number; sheets: Array<{ id: string; jobNumber: string; jobName: string; address: string; number: string }>; numbers: Record<string, unknown> }
    expect(papers.ok).toBe(true)
    expect(papers.stillOpen).toBe((open.papers as { stillOpen: number }).stillOpen)
    expect(papers.sheets.filter((s) => s.jobNumber === '2041').map((s) => [s.jobName, s.address, s.number])).toEqual([['Papers to sign first', '', ''], ['Papers to sign first', '', '']])
    expect(papers.sheets.find((s) => s.id === ALDER_1)).toMatchObject({ jobName: 'Alder Court Remodel', address: '12 Alder Ct' })
    expect(papers.numbers).toEqual({})
    // A read writes nothing: no copy of a paper is made by looking.
    expect(writes()).toEqual([])
    expect(box.rpcCalls.some((c) => c.name === 'job_paper_start')).toBe(false)
  })

  it('fails closed: a job whose papers cannot be read is held back and listed unread, under its number', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    box.brokenRpcs = new Set(['job_papers_for_person'])
    const { status, body, text } = await read()
    expect(status).toBe(200)
    expect(body.job_papers).toEqual([{ job_id: JOB_CEDAR, job_number: '2041', papers: [], unread: true }])
    for (const word of CEDAR_WORDS) expect(text, word).not.toContain(word)
    for (const word of OPEN_WORDS) expect(text, word).toContain(word)
  })

  it('a failed look at the required papers opens nothing: every job is asked about', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    box.refuse = new Set(['job_required_papers'])
    const { body, text } = await read()
    expect([...asked()].sort()).toEqual([JOB_ALDER, JOB_CEDAR].sort())
    expect((body.job_papers as Array<{ job_id: string }>).map((j) => j.job_id)).toEqual([JOB_CEDAR])
    for (const word of CEDAR_WORDS) expect(text, word).not.toContain(word)
  })
})

describe('submit-sub-portal: sign_job_paper', () => {
  it('makes the sub’s own copy and answers a fresh signing link for it', async () => {
    const { status, body } = await press({ kind: 'sign_job_paper', required_paper_id: NDA })
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(String(body.signPath)).toMatch(/^\/contract\/accept\?t=[0-9a-f]{64}$/)
    expect(box.rpcCalls.filter((c) => c.name === 'job_paper_start')).toEqual([{ name: 'job_paper_start', args: { p_required_paper_id: NDA, p_person_id: HARLAN } }])
    const doc = box.db.tables.person_contract_documents![0]!
    expect(doc.status).toBe('sent')
    expect(String(doc.public_token_hash)).toMatch(/^[0-9a-f]{64}$/)
    // The link's own token is never stored: only its hash.
    expect(JSON.stringify(doc)).not.toContain(String(body.signPath).slice(-64))
  })

  it('refuses a paper of a job the sub has no work on, and starts nothing', async () => {
    const { status, body } = await press({ kind: 'sign_job_paper', required_paper_id: ELSEWHERE })
    expect(status).toBe(404)
    expect(body.error).toBe('That paper is not on your page.')
    expect(box.rpcCalls.some((c) => c.name === 'job_paper_start')).toBe(false)
    expect(writes()).toEqual([])
    // A paper that does not exist reads the same: nothing says whether it is there.
    expect((await press({ kind: 'sign_job_paper', required_paper_id: '00000000-0000-4000-8000-00000000dead' })).status).toBe(404)
    expect((await press({ kind: 'sign_job_paper', required_paper_id: 'not-an-id' })).status).toBe(400)
  })

  it('refuses a paper the office took off the job', async () => {
    const { status, body } = await press({ kind: 'sign_job_paper', required_paper_id: TAKEN_OFF })
    expect(status).toBe(409)
    expect(body.error).toBe('This job no longer requires that paper.')
    expect(box.rpcCalls.some((c) => c.name === 'job_paper_start')).toBe(false)
  })

  it('a paper already signed is not handed a new link', async () => {
    box.db.tables.person_contract_documents![0]!.status = 'signed'
    const { status, body } = await press({ kind: 'sign_job_paper', required_paper_id: SITE })
    expect(status).toBe(400)
    expect(body.error).toBe('This document is already signed.')
  })
})

describe('submit-sub-portal: a press on a job the sub still owes a paper on', () => {
  const FIRST = 'Sign this job’s papers first.'

  it('refuses every press on the job’s sheet and work orders, and writes nothing', async () => {
    for (const body of [
      { kind: 'mark_work_done', laborJobId: CEDAR_1, note: 'All done' },
      { kind: 'progress', laborJobId: CEDAR_1, pct: 50 },
      { kind: 'accept_offer', commitmentId: OFFER_CEDAR, printedName: 'Harlan Mechanical', agreedTerms: true },
      { kind: 'decline_offer', commitmentId: OFFER_CEDAR, reason: 'Booked that week' },
      { kind: 'pick_dates', commitmentId: ORDER_CEDAR, pickedStart: '2026-11-24', pickedEnd: '2026-11-25' },
      { kind: 'cant_do_dates', commitmentId: ORDER_CEDAR, note: 'Away' },
    ]) {
      const answer = await press(body)
      expect(answer.status, body.kind).toBe(403)
      expect(answer.body.error, body.kind).toBe(FIRST)
    }
    expect(writes()).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a press on an open job goes through as before', async () => {
    const { status, body } = await press({ kind: 'decline_offer', commitmentId: OFFER_ALDER, reason: 'Booked that week' })
    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(box.db.tables.step_commitments!.find((c) => c.id === OFFER_ALDER)).toMatchObject({ status: 'declined', decline_reason: 'Booked that week' })
    // Alder requires nothing live, so nobody asked the database about its papers.
    expect(asked()).toEqual([])
  })

  it('once every paper is signed the same press goes through', async () => {
    box.papers = { [JOB_CEDAR]: CEDAR_SIGNED }
    const { status, body } = await press({ kind: 'decline_offer', commitmentId: OFFER_CEDAR, reason: 'Booked that week' })
    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
  })

  it('fails closed: a job whose papers cannot be read refuses the press and says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    box.brokenRpcs = new Set(['job_papers_for_person'])
    const { status, body } = await press({ kind: 'progress', laborJobId: CEDAR_1, pct: 50 })
    expect(status).toBe(503)
    expect(body.error).toBe('We could not check this job’s papers. Please try again.')
    expect(writes()).toEqual([])
  })

  it('a day off and an availability note are not a job’s, and are not held', async () => {
    expect((await press({ kind: 'day_off', day: '2026-11-25', off: false })).status).toBe(200)
    expect(asked()).toEqual([])
  })
})
