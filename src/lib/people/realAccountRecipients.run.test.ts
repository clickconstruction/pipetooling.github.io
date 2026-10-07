/**
 * weekly-money-email-dispatch's own handler, run here (punch list #29): its `index.ts` with the URL
 * imports stood in for, a fake database that applies the function's filters, and `fetch` caught,
 * so no mail leaves. Three queued sends: a person, a twin and a View-as sample account, all three
 * with a role the report goes to, so the only thing between the twin and an email is the
 * real-account rule. The person is sent; the twin and the sample are marked unavailable.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, makeFakeDb, type FakeDb } from '../../test/edgeFakeDb'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null; db: FakeDb } = { handler: null, db: makeFakeDb() }
const mail: string[][] = []

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => fakeClient(box.db, {}, () => null) }))

const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  RESEND_API_KEY: 're_test',
  CRON_SECRET: 'cron-secret',
}

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/weekly-money-email-dispatch/index.ts'

const realFetch = globalThis.fetch
beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  // Resend: record the recipients and answer like Resend. The email wording and the send log
  // (Supabase REST): answer "not ok", which both helpers treat as nothing to read or keep.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === 'https://api.resend.com/emails') {
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

const account = { is_sample: false, is_digital_twin: false, archived_at: null }
beforeEach(() => {
  mail.length = 0
  box.db = makeFakeDb()
  box.db.tables.users = [
    { ...account, id: 'u-owner', name: 'Owner', role: 'dev', email: 'owner@example.com' },
    { ...account, id: 'u-controller', name: 'Controller', role: 'controller', email: 'controller@example.com' },
    { ...account, id: 'u-twin', name: 'A twin', role: 'controller', email: 'twin-2@twins.pipetooling.local', is_digital_twin: true },
    { ...account, id: 'u-sample', name: 'Sample controller', role: 'controller', email: 'sample@example.com', is_sample: true },
  ]
  const queued = (id: string, recipient: string) => ({
    id, requested_by: 'u-owner', recipient_user_id: recipient, send_at: '2026-10-05T12:00:00Z', repeat_weekly: false, attempts: 0, sent_at: null,
  })
  box.db.tables.weekly_money_email_requests = [queued('q-person', 'u-controller'), queued('q-twin', 'u-twin'), queued('q-sample', 'u-sample')]
  box.db.rpcs.get_weekly_money_movement_payload = {
    week_monday: '2026-09-28',
    week_end: '2026-10-04',
    jobs: [],
    overhead: { office_labor_hours: 0, office_labor_cost: 0, office_job_charges: 0, bid_labor_hours: 0, bid_labor_cost: 0 },
  }
})

async function runCron() {
  const res = await box.handler!(new Request('http://localhost/functions/v1/weekly-money-email-dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': 'cron-secret' },
    body: '{}',
  }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

describe('weekly-money-email-dispatch sends only to a real account (punch list #29)', () => {
  it('mails the person and marks the twin and the sample unavailable', async () => {
    expect(await runCron()).toEqual({ status: 200, body: { ok: true, processed: 3, sent: 1, errors: [] } })
    expect(mail).toEqual([['controller@example.com']])
    const outcome = (id: string) =>
      box.db.writes.find((w) => w.op === 'update' && w.table === 'weekly_money_email_requests' && w.matched.some((r) => r.id === id))?.values
    expect(outcome('q-person')).toMatchObject({ error: null })
    expect(outcome('q-twin')).toMatchObject({ error: 'recipient unavailable (archived, role, or no email)' })
    expect(outcome('q-sample')).toMatchObject({ error: 'recipient unavailable (archived, role, or no email)' })
  })
})
