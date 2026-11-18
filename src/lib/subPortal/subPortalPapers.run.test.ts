/**
 * sub-portal's own handler, run here (punch list #371, step 1): the `papers` block on the read, and the two answers
 * on a POST. Its `index.ts` with the URL imports stood in for and the fake database from `src/test/edgeFakeDb.ts`,
 * so nothing here reaches a database. Every name, job and amount is made up (`subPortalPapersFixture.ts`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, makeFakeDb, type FakeDb, type FakeRow } from '../../test/edgeFakeDb'
import {
  ALDER_1,
  ASSIGNEES,
  CEDAR_1,
  CEDAR_2,
  CREDITS,
  HARLAN,
  HIDDEN_MEMO,
  ITEMS,
  JOBS_LEDGER,
  ORA,
  ORA_1,
  PAPER_CEDAR_1_REV_2,
  PAYMENTS,
  PAY_SEP_CASH,
  PEOPLE,
  RIDGE_1,
  SENDINGS,
  SENDING_226,
  SENDING_231,
  SHEETS,
  USERS,
  registerRows,
} from './subPortalPapersFixture'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null; db: FakeDb; refuse: Set<string> } = { handler: null, db: makeFakeDb(), refuse: new Set() }

const HARLAN_TOKEN = 'harlan-token-0123456789abcdef'
const ORA_TOKEN = 'ora-token-0123456789abcdef0123'

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => {
    const client = fakeClient(box.db, { 'tok-office': 'u-office' }, () => null)
    return {
      ...client,
      // A table in `refuse` answers every read with a refusal, as a database a migration has not reached does.
      from: (name: string) => {
        if (!box.refuse.has(name)) return client.from(name)
        const chain: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit', 'range', 'gte']) chain[m] = () => chain
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: `relation ${name} refused` } }).then(resolve)
        chain.maybeSingle = () => Promise.resolve({ data: null, error: { message: `relation ${name} refused` } })
        return chain
      },
    }
  },
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key' }
// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/sub-portal/index.ts'

/** Every request the function made to another function: only the push for a note. Nothing leaves this machine. */
const calls: Array<{ url: string; body: unknown }> = []

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: typeof init?.body === 'string' ? JSON.parse(init.body) : null })
    return new Response('{}', { status: 200 })
  })
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  box.db = makeFakeDb()
  box.refuse = new Set()
  calls.length = 0
  const copy = <T,>(rows: readonly T[]): FakeRow[] => rows.map((r) => ({ ...(r as FakeRow) }))
  box.db.tables.sub_portal_links = [
    { id: 'link-harlan', person_id: HARLAN, token: HARLAN_TOKEN, revoked_at: null, created_by: 'u-office' },
    { id: 'link-ora', person_id: ORA, token: ORA_TOKEN, revoked_at: null, created_by: 'u-office' },
  ]
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
  box.db.tables.app_settings = [{ key: 'physical_invoice_issuer_v1', value_text: JSON.stringify({ companyName: 'Your Company Name', addressText: '100 Example Way\nSuite 4', phone: '(555) 010-0100', email: '' }) }]
})

type Papers = { ok: boolean; sheets?: Array<{ id: string; number: string; money: Array<{ memo: string }> }>; received?: Record<string, string>; wrong?: unknown[]; stillOpen?: number; sharedSheets?: number; ctx?: { company: { name: string; lines: string[] }; sub: { name: string } }; officePhone?: string; numbers?: Record<string, unknown> }

async function read(token: string, headers: Record<string, string> = {}): Promise<{ status: number; body: Record<string, unknown> & { papers?: Papers | null } }> {
  const res = await box.handler!(new Request(`http://localhost/functions/v1/sub-portal?token=${token}`, { method: 'GET', headers }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> & { papers?: Papers | null } }
}

async function answer(body: Record<string, unknown>, opts: { headers?: Record<string, string>; query?: string } = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await box.handler!(new Request(`http://localhost/functions/v1/sub-portal${opts.query ?? ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7, 10.0.0.1', ...(opts.headers ?? {}) }, body: JSON.stringify(body) }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

const acks = () => box.db.tables.sub_paper_acks ?? []
const wrote = () => box.db.writes.filter((w) => w.table !== 'public_page_views' && w.table !== 'dispatch_requests').map((w) => `${w.op} ${w.table}`)

describe('sub-portal: the papers block on the read', () => {
  it('hands back every sheet that is the sub’s alone, paid ones too, with the letterhead and the numbers the office gave', async () => {
    const { status, body } = await read(HARLAN_TOKEN)
    expect(status).toBe(200)
    const papers = body.papers!
    expect(papers.ok).toBe(true)
    expect(papers.sheets!.map((s) => [s.id, s.number])).toEqual([
      [ALDER_1, ''],
      [CEDAR_1, 'WS-2041-1'],
      [CEDAR_2, 'WS-2041-2'],
    ])
    expect(papers.stillOpen).toBe(1500)
    expect(papers.sharedSheets).toBe(1)
    expect(papers.ctx).toMatchObject({ company: { name: 'Your Company Name', lines: ['100 Example Way, Suite 4', '(555) 010-0100'] }, sub: { name: 'Harlan Mechanical' } })
    expect(papers.officePhone).toBe('(555) 010-0100')
    expect(Object.keys(papers.numbers!).sort()).toEqual([CEDAR_1, CEDAR_2].sort())
    // The page a sub knows is still there, beside the new block.
    expect(body).toMatchObject({ subName: 'Harlan Mechanical', requestToken: HARLAN_TOKEN })
    expect(Array.isArray(body.sheets) && Array.isArray(body.payments)).toBe(true)
  })

  it('reads the register and writes nothing: no paper is made and no number is given from the page', async () => {
    await read(HARLAN_TOKEN)
    expect(wrote()).toEqual([])
    expect(box.db.calls).not.toContain('rpc mint_sub_paper')
    expect(box.db.tables.sub_papers).toHaveLength(registerRows().length)
  })

  it('never carries a memo the office hid', async () => {
    const { body } = await read(HARLAN_TOKEN)
    expect(JSON.stringify(body.papers)).not.toContain(HIDDEN_MEMO)
    expect(JSON.stringify(body.papers)).toContain('First draw')
  })

  it('another sub’s link reads nothing of this sub’s', async () => {
    const { body } = await read(ORA_TOKEN)
    const papers = body.papers!
    expect(papers.ok).toBe(true)
    expect(papers.sheets!.map((s) => s.id)).toEqual([ORA_1])
    const text = JSON.stringify(papers)
    for (const theirs of [CEDAR_1, CEDAR_2, ALDER_1, RIDGE_1, 'WS-2041-1', 'First draw', SENDING_231, 'Harlan']) expect(text).not.toContain(theirs)
  })

  it('a refused read of the papers leaves the page as it was, with no papers block', async () => {
    box.refuse.add('sub_papers')
    const { status, body } = await read(HARLAN_TOKEN)
    expect(status).toBe(200)
    expect(body.papers).toBeNull()
    expect(body).toMatchObject({ subName: 'Harlan Mechanical' })
    expect(Array.isArray(body.sheets)).toBe(true)
  })

  it('a database the answers’ migration has not reached reads as no answer yet, and the figures still show', async () => {
    box.refuse.add('sub_paper_acks')
    const { body } = await read(HARLAN_TOKEN)
    expect(body.papers).toMatchObject({ ok: true, received: {}, wrong: [], stillOpen: 1500 })
  })

  it('a link that is unknown reads nothing', async () => {
    expect((await read('nobody-token-0123456789abcdef')).status).toBe(404)
  })
})

describe('sub-portal: Got it', () => {
  it('writes one row, kept the way a signed work order is, and the next read shows it', async () => {
    const first = await answer({ token: HARLAN_TOKEN, action: 'got_it', key: SENDING_231 })
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ ok: true, already: false })
    expect(Object.keys(first.body.received as Record<string, string>)).toEqual([SENDING_231])
    expect(acks()).toHaveLength(1)
    expect(acks()[0]).toMatchObject({ kind: 'received', person_id: HARLAN, sending_id: SENDING_231, payment_id: null, labor_job_id: null, paper_id: null, revision: null, amount: 2200, note: null, said_by_name: 'Harlan Mechanical', said_from: '203.0.113.7' })
    // An answer is not a view of the page.
    expect(box.db.writes.some((w) => w.table === 'public_page_views')).toBe(false)
  })

  it('a second Got it changes nothing', async () => {
    box.db.tables.sub_paper_acks = [{ id: 'ack-1', kind: 'received', person_id: HARLAN, sending_id: SENDING_231, payment_id: null, labor_job_id: null, paper_id: null, note: null, created_at: '2026-11-13T18:00:00Z' }]
    const again = await answer({ token: HARLAN_TOKEN, action: 'got_it', key: SENDING_231 })
    expect(again).toEqual({ status: 200, body: { ok: true, already: true, received: { [SENDING_231]: 'Nov 13, 2026' } } })
    expect(acks()).toHaveLength(1)
    expect(wrote()).toEqual([])
    const { body } = await read(HARLAN_TOKEN)
    expect(body.papers!.received).toEqual({ [SENDING_231]: 'Nov 13, 2026' })
  })

  it('a payment from before sendings is marked by its own row', async () => {
    const res = await answer({ token: HARLAN_TOKEN, action: 'got_it', key: `row:${PAY_SEP_CASH}` })
    expect(res.status).toBe(200)
    expect(acks()[0]).toMatchObject({ kind: 'received', sending_id: null, payment_id: PAY_SEP_CASH, amount: 950 })
  })

  it('another sub’s link cannot answer about this sub’s payment', async () => {
    expect(await answer({ token: ORA_TOKEN, action: 'got_it', key: SENDING_231 })).toEqual({ status: 404, body: { error: 'That payment is not on your page.' } })
    expect(acks()).toEqual([])
  })
})

describe('sub-portal: Something is wrong', () => {
  it('keeps the note on the sheet, with the office’s live paper and the revision the sub saw', async () => {
    const res = await answer({ token: HARLAN_TOKEN, action: 'something_wrong', about: 'statement', key: CEDAR_1, note: ' The back-charge was never talked about with me. ' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, wrong: { about: 'statement', key: CEDAR_1, note: 'The back-charge was never talked about with me.' } })
    expect(acks()[0]).toMatchObject({ kind: 'something_wrong', person_id: HARLAN, labor_job_id: CEDAR_1, sending_id: null, payment_id: null, paper_id: PAPER_CEDAR_1_REV_2, revision: 2, amount: 1500, note: 'The back-charge was never talked about with me.', said_by_name: 'Harlan Mechanical' })
    const { body } = await read(HARLAN_TOKEN)
    expect(body.papers!.wrong).toHaveLength(1)
  })

  it('tells the office: a line in the dispatch inbox naming the sub, the statement and the note, and a push (v2.7609)', async () => {
    await answer({ token: HARLAN_TOKEN, action: 'something_wrong', about: 'statement', key: CEDAR_1, note: 'The back-charge was never talked about with me.' })
    const notes = box.db.tables.dispatch_requests ?? []
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      from_user_id: 'u-office',
      title: 'Harlan Mechanical says something is wrong on WS-2041-1 · #2041 Cedar Hollow Clinic: “The back-charge was never talked about with me.”',
      pending_payload: { source: 'sub_portal', subPortalLinkId: 'link-harlan', kind: 'sub_paper_wrong', personId: HARLAN, about: 'WS-2041-1 · #2041 Cedar Hollow Clinic', laborJobId: CEDAR_1, sendingId: null, paymentId: null, ackId: acks()[0]!.id },
    })
    expect(calls.map((c) => [c.url, c.body])).toEqual([['http://127.0.0.1:9/functions/v1/notify-dispatch-request', { dispatch_request_id: notes[0]!.id }]])
  })

  it('Got it tells nobody: a quiet chip, not a to-do', async () => {
    await answer({ token: HARLAN_TOKEN, action: 'got_it', key: SENDING_231 })
    expect(box.db.tables.dispatch_requests ?? []).toEqual([])
    expect(calls).toEqual([])
  })

  it('a note the office cannot be told of is still kept', async () => {
    box.refuse.add('app_settings')
    box.db.tables.sub_portal_links![0]!.created_by = null
    const res = await answer({ token: HARLAN_TOKEN, action: 'something_wrong', about: 'payment', key: SENDING_226, note: 'The check was short.' })
    expect(res.status).toBe(200)
    expect(acks()).toHaveLength(1)
  })

  it('takes a note about a payment, and about a sheet the office has not papered', async () => {
    expect((await answer({ token: HARLAN_TOKEN, action: 'something_wrong', about: 'payment', key: SENDING_226, note: 'The check was short.' })).status).toBe(200)
    expect((await answer({ token: HARLAN_TOKEN, action: 'something_wrong', about: 'statement', key: ALDER_1, note: 'Wrong address.' })).status).toBe(200)
    expect(acks().map((a) => [a.sending_id, a.labor_job_id, a.paper_id === null])).toEqual([
      [SENDING_226, null, false],
      [null, ALDER_1, true],
    ])
  })

  it('refuses a note with no words, a shared sheet and another sub’s sheet, and writes nothing', async () => {
    expect(await answer({ token: HARLAN_TOKEN, action: 'something_wrong', about: 'statement', key: CEDAR_1, note: '  ' })).toEqual({ status: 400, body: { error: 'Tell the office what looks wrong.' } })
    expect(await answer({ token: HARLAN_TOKEN, action: 'something_wrong', about: 'statement', key: RIDGE_1, note: 'x' })).toEqual({ status: 404, body: { error: 'That statement is not on your page.' } })
    expect(await answer({ token: HARLAN_TOKEN, action: 'something_wrong', about: 'statement', key: ORA_1, note: 'x' })).toEqual({ status: 404, body: { error: 'That statement is not on your page.' } })
    expect(acks()).toEqual([])
  })

  it('stops at ten notes a day and says to call', async () => {
    box.db.tables.sub_paper_acks = Array.from({ length: 10 }, (_, i) => ({ id: `n-${i}`, kind: 'something_wrong', person_id: HARLAN, labor_job_id: CEDAR_1, sending_id: null, payment_id: null, paper_id: null, note: 'x', created_at: new Date().toISOString() }))
    expect(await answer({ token: HARLAN_TOKEN, action: 'something_wrong', about: 'statement', key: CEDAR_1, note: 'One more.' })).toEqual({ status: 429, body: { error: 'You have sent the office several notes today. Please call the office about anything more.' } })
    expect(acks()).toHaveLength(10)
  })
})

describe('sub-portal: who may answer', () => {
  it('the office looking at a sub’s page cannot answer for them: a signed-in teammate, or a preview', async () => {
    const refusal = { status: 403, body: { error: 'This is the office looking at the page. Only the sub can answer, from their own link.' } }
    expect(await answer({ token: HARLAN_TOKEN, action: 'got_it', key: SENDING_231 }, { headers: { Authorization: 'Bearer tok-office' } })).toEqual(refusal)
    expect(await answer({ token: HARLAN_TOKEN, action: 'got_it', key: SENDING_231 }, { query: '?preview=1' })).toEqual(refusal)
    expect(acks()).toEqual([])
  })

  it('a link that is unknown or turned off, a sample page and an empty body are refused', async () => {
    expect((await answer({ token: 'nobody-token-0123456789abcdef', action: 'got_it', key: SENDING_231 })).status).toBe(404)
    box.db.tables.sub_portal_links![0]!.revoked_at = '2026-11-01T00:00:00Z'
    expect((await answer({ token: HARLAN_TOKEN, action: 'got_it', key: SENDING_231 })).status).toBe(404)
    expect((await answer({ action: 'got_it', key: SENDING_231 })).status).toBe(400)
    expect(acks()).toEqual([])
  })

  it('an action it does not know is refused: Confirm is not built here', async () => {
    expect(await answer({ token: HARLAN_TOKEN, action: 'confirm', key: CEDAR_1 })).toEqual({ status: 400, body: { error: 'Unknown action.' } })
    expect(acks()).toEqual([])
  })
})
