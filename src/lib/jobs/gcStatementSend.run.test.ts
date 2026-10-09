/**
 * send-gc-statement-email's own handler, run here (v2.5022; the owner's call of 2026-10-09): Draft
 * Message's Send goes out only on this week's standing check, whatever the client let through. Its
 * `index.ts` with the URL imports stood in for, the fake database from `src/test/edgeFakeDb.ts`, and
 * `fetch` caught, so no mail leaves.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, makeFakeDb, type FakeDb } from '../../test/edgeFakeDb'
import { GC_STATEMENT_UNCHECKED_WORDS, gcCertWeekStartYmd } from '../../../supabase/functions/_shared/gcStatementGate'
import { todayYmdInAppTz } from '../../../supabase/functions/_shared/appTimeZone'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null; db: FakeDb } = { handler: null, db: makeFakeDb() }
const mail: string[][] = []

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => fakeClient(box.db, { 'tok-office': 'u-office' }, () => null) }))

const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  RESEND_API_KEY: 're_test',
}

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/send-gc-statement-email/index.ts'

const realFetch = globalThis.fetch
beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://api.resend.com/emails') {
      mail.push((JSON.parse(String(init?.body)) as { to: string[] }).to)
      return new Response(JSON.stringify({ id: `mail-${mail.length}` }), { status: 200 })
    }
    return new Response('{}', { status: 503 })
  }) as typeof fetch
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  globalThis.fetch = realFetch
})

beforeEach(() => {
  mail.length = 0
  box.db = makeFakeDb()
  const week = gcCertWeekStartYmd(todayYmdInAppTz())
  box.db.tables.users = [{ id: 'u-office', name: 'Taunya', email: 'taunya@example.com', role: 'assistant' }]
  box.db.tables.customers = [{ id: 'gc-knight' }, { id: 'gc-harper' }]
  box.db.tables.gc_review_certifications = [
    { gc_customer_id: 'gc-knight', week_start: week, certified_at: `${week}T18:00:00Z`, total: 26000, snapshot: { rows: [{ key: 'j-knight', jobId: 'j-knight', remaining: 26000 }], total: 26000, jobCount: 1 } },
  ]
  box.db.tables.jobs_ledger = [{ id: 'j-knight', revenue: 26000 }, { id: 'j-harper', revenue: 30000 }]
})

/** The payload the RPC answers — the fake answers one, so each case sets the GC it is about. */
function payloadFor(gcId: string, jobId: string, remaining: number) {
  box.db.rpcs.get_gc_statement_email_payload = {
    generated_at: '2026-10-09T15:00:00Z',
    group_by: 'gc',
    include_collections: false,
    grand_total: remaining,
    groups: [{ entity_id: gcId, entity_name: gcId, is_no_entity: false, job_count: 1, subtotal: remaining, oldest_age_days: 38, rows: [{ job_id: jobId, row_key: `b-${jobId}`, display_number: '651', job_name: 'Job', job_address: 'Main St', customer_name: 'Owner', ref_date: '2026-09-01', ref_is_estimate: false, age_days: 38, remaining, in_collections: false }] }],
  }
}

async function send(gcId: string) {
  const res = await box.handler!(
    new Request('http://localhost/functions/v1/send-gc-statement-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok-office' },
      body: JSON.stringify({ gc_customer_id: gcId, gc_name: gcId, group_by: 'gc', to_email: `ap@${gcId}.example`, subject: 'Statement', email_html: '<p>Statement</p>', email_text: 'Statement', total: 1, job_count: 1 }),
    }),
  )
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

describe('send-gc-statement-email holds a GC’s statement until it is checked (v2.5022)', () => {
  it('a GC checked this week and unchanged: it goes', async () => {
    payloadFor('gc-knight', 'j-knight', 26000)
    const { status, body } = await send('gc-knight')
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(mail).toEqual([['ap@gc-knight.example']])
  })

  it('a GC not checked this week: held with the worklist row’s words, nothing sent, nothing audited', async () => {
    payloadFor('gc-harper', 'j-harper', 30000)
    expect(await send('gc-harper')).toEqual({ status: 200, body: { success: false, refused: 'unchecked', error: GC_STATEMENT_UNCHECKED_WORDS } })
    expect(mail).toEqual([])
    expect(box.db.writes.filter((w) => w.table === 'gc_statement_emails')).toEqual([])
  })

  it('checked, then a payment moved it: held until it is checked again', async () => {
    payloadFor('gc-knight', 'j-knight', 25000)
    expect((await send('gc-knight')).body).toMatchObject({ success: false, refused: 'unchecked' })
    expect(mail).toEqual([])
  })
})
