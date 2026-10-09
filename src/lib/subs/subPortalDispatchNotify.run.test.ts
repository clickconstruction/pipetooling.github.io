/**
 * submit-sub-portal's own handler, run here (v2.5042): the function's `index.ts` with its two URL imports stood in
 * for, a fake database and a recorded fetch. A sub's note lands in the dispatch inbox and its push goes to
 * notify-dispatch-request as an internal caller, with the service key as the bearer. Before, the call carried no
 * Authorization header, the notifier answered 401 and no phone heard the note. Nothing here reaches a real database.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { internalFunctionCall } from '../../../supabase/functions/_shared/internalFunctionCall'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }
const db: { calls: string[] } = { calls: [] }

const LINK = { id: 'link-1', person_id: 'person-1', created_by: 'office-1', revoked_at: null }

type Chain = { [method: string]: (...args: unknown[]) => unknown }
function table(name: string): Chain {
  let op = 'select'
  const result = () => {
    db.calls.push(`${op} ${name}`)
    if (name === 'sub_portal_links') return { data: LINK, error: null }
    if (name === 'people') return { data: { id: 'person-1', name: 'Sam Sub' }, error: null }
    if (name === 'dispatch_requests' && op === 'insert') return { data: { id: 'req-1' }, error: null }
    return { data: null, error: null, count: 0 }
  }
  const chain: Chain = {}
  for (const m of ['select', 'eq', 'gte', 'in', 'is', 'order', 'limit']) chain[m] = () => chain
  for (const m of ['insert', 'update', 'delete', 'upsert']) chain[m] = () => ((op = m), chain)
  chain.maybeSingle = () => Promise.resolve(result())
  chain.single = () => Promise.resolve(result())
  chain.then = (resolve: unknown, reject: unknown) => Promise.resolve(result()).then(resolve as (v: unknown) => unknown, reject as (e: unknown) => unknown)
  return chain
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => ({ from: (name: string) => table(name) }) }))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_ANON_KEY: 'anon-key' }

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/submit-sub-portal/index.ts'

const fetchMock = vi.fn()

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
beforeEach(() => {
  db.calls = []
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function postAvailability() {
  const res = await box.handler!(new Request('http://localhost/functions/v1/submit-sub-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'sub-token-0123456789', kind: 'availability', description: 'Free all next week', website: '' }),
  }))
  return { status: res.status, body: (await res.json()) as unknown }
}

describe('a sub portal note reaches the dispatch group (v2.5042)', () => {
  it('the push goes to notify-dispatch-request with the service key as its bearer', async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    expect(await postAvailability()).toEqual({ status: 200, body: { ok: true } })
    expect(db.calls).toContain('insert dispatch_requests')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:9/functions/v1/notify-dispatch-request')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer service-key')
    expect(JSON.parse(String(init.body))).toEqual({ dispatch_request_id: 'req-1' })
  })

  it('a refused push is logged, and the sub still gets their answer: the note is already in the inbox', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"Unauthorized - No authorization header"}', { status: 401 }))
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await postAvailability()).toEqual({ status: 200, body: { ok: true } })
    expect(logged).toHaveBeenCalledWith('notify-dispatch-request refused', 401, '{"error":"Unauthorized - No authorization header"}')
  })
})

describe('internalFunctionCall', () => {
  it('posts JSON to the function with the service key as the bearer', () => {
    const call = internalFunctionCall('https://ref.supabase.co/', 'svc', 'notify-dispatch-request', { dispatch_request_id: 'r' })
    expect(call.url).toBe('https://ref.supabase.co/functions/v1/notify-dispatch-request')
    expect(call.init.method).toBe('POST')
    expect(call.init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer svc' })
    expect(call.init.body).toBe('{"dispatch_request_id":"r"}')
  })
})
