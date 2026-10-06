/**
 * send-bid-pricing-package's own handler, run here (punch list #29): its `index.ts` with the URL
 * imports stood in for and a fake database that applies the function's filters to real-shaped
 * rows. Twins are estimators, and this function lets an estimator send a GC the bid's prices, so
 * until the sweep a twin's session passed its sender check. `REAL_ACCOUNT` refuses a twin, as a
 * sender and as a recipient, while a person goes the way they always went. Nothing reaches a
 * database or an inbox.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, makeFakeDb, type FakeDb } from '../../test/edgeFakeDb'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null; db: FakeDb; bearer: string | null } = { handler: null, db: makeFakeDb(), bearer: null }

const SESSIONS: Record<string, string> = { 'estimator-jwt': 'u-estimator', 'twin-jwt': 'u-twin', 'sample-jwt': 'u-sample' }

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => fakeClient(box.db, SESSIONS, () => box.bearer),
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_ANON_KEY: 'anon-key' }

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/send-bid-pricing-package/index.ts'

const person = { is_sample: false, is_digital_twin: false, archived_at: null }
const USERS = [
  { ...person, id: 'u-estimator', name: 'Wendi', role: 'estimator', email: 'wendi@example.com' },
  { ...person, id: 'u-gc-contact', name: 'Office Pat', role: 'assistant', email: 'pat@example.com' },
  { ...person, id: 'u-twin', name: 'Twin Estimator 1', role: 'estimator', email: 'twin-1@twins.pipetooling.local', is_digital_twin: true },
  { ...person, id: 'u-sample', name: 'Sample estimator', role: 'estimator', email: 'sample@example.com', is_sample: true },
]

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
beforeEach(() => {
  box.db = makeFakeDb()
  box.db.tables.users = USERS.map((u) => ({ ...u }))
  box.db.tables.bids = [{ id: 'bid-1', project_name: 'B494 restrooms', bid_number: 'B494', service_types: null }]
})

async function send(bearer: string, recipient: string) {
  box.bearer = bearer
  const res = await box.handler!(new Request('http://localhost/functions/v1/send-bid-pricing-package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ bid_id: 'bid-1', price_book_version_id: 'pbv-1', recipient_user_id: recipient }),
  }))
  return { status: res.status, body: (await res.json()) as { ok?: boolean; error?: string } }
}

describe('send-bid-pricing-package takes only a real account (punch list #29)', () => {
  it('refuses a twin as the sender, before it reads the bid', async () => {
    expect(await send('twin-jwt', 'u-gc-contact')).toEqual({ status: 403, body: { ok: false, error: 'Sender not found' } })
    expect(box.db.calls).toEqual(['auth.getUser', 'select users'])
  })

  it('refuses a View-as sample account as the sender, as it did before', async () => {
    expect(await send('sample-jwt', 'u-gc-contact')).toEqual({ status: 403, body: { ok: false, error: 'Sender not found' } })
  })

  it('refuses a twin as the recipient', async () => {
    expect(await send('estimator-jwt', 'u-twin')).toEqual({ status: 404, body: { ok: false, error: 'Recipient not found' } })
    expect(box.db.calls).toEqual(['auth.getUser', 'select users', 'select bids', 'select users'])
  })

  it('lets a person send to a person: past both checks, on to the price', async () => {
    const res = await send('estimator-jwt', 'u-gc-contact')
    expect(res).toEqual({ status: 404, body: { ok: false, error: 'Price book version not found' } })
    expect(box.db.calls).toEqual(['auth.getUser', 'select users', 'select bids', 'select users', 'select price_book_versions'])
  })
})
