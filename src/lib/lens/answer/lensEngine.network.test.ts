import { describe, expect, it, vi } from 'vitest'
import { LENS_PEOPLE } from '../lensPeople'
import { MapStore, type LensWorld } from '../world/lensWorld'
import { createLensEngine, type LensAsk, type LensNetwork } from './lensEngine'
import type { LensSchema } from './lensSchemaTypes'

const schema: LensSchema = { tables: { users: { columns: ['id', 'name', 'role', 'read_only'], rel: [] } }, rpcs: {} }
const SUPABASE = 'https://lenstest.supabase.co'

function setup(opts: { network?: LensNetwork | null; mood?: 'full' | 'offline' } = {}) {
  const asks: LensAsk[] = []
  const world: LensWorld = {
    viewer: LENS_PEOPLE.dev,
    mood: opts.mood ?? 'full',
    store: new MapStore({ users: [{ id: LENS_PEOPLE.dev.id, name: 'Dev Sample', role: 'dev', read_only: false }] }),
    readOnly: false,
    rpc: {},
    functions: { 'street-view-preview': () => ({ ok: false }) },
  }
  const engine = createLensEngine({ as: 'dev', mood: world.mood, theme: 'light' }, { schema, world, report: (a) => asks.push(a), network: opts.network ?? null, slowMs: 1 })
  return { engine, asks }
}

describe("the engine on a customer's sample page (punch list #202)", () => {
  it('sends an edge-function call out whole, as the anonymous customer, and keeps the rest in the world', async () => {
    const network = vi.fn(async () => new Response(JSON.stringify({ estimate: 'the sample' }), { status: 200 }))
    const { engine, asks } = setup({ network })
    const url = new URL(`${SUPABASE}/functions/v1/get-estimate-for-customer?token=sample&preview=1`)
    const headers = new Headers({ apikey: 'anon-key', Authorization: 'Bearer the-invented-session' })
    const res = await engine.handle(url, { method: 'GET', headers, bodyText: null, raw: { input: url.href, init: { headers } } })
    expect(await res.json()).toEqual({ estimate: 'the sample' })
    expect(network).toHaveBeenCalledTimes(1)
    const [input, init] = network.mock.calls[0] as unknown as [string, RequestInit]
    expect(input).toBe(url.href)
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer anon-key')
    expect(init.method).toBe('GET')
    expect(asks).toEqual([{ kind: 'function', name: 'get-estimate-for-customer', method: 'GET', by: 'network', status: 200 }])
    const users = await engine.handle(new URL(`${SUPABASE}/rest/v1/users?select=name&id=eq.${LENS_PEOPLE.dev.id}`), { method: 'GET', headers: new Headers({ apikey: 'anon-key' }), bodyText: null })
    expect(await users.json()).toEqual([{ name: 'Dev Sample' }])
    expect(network).toHaveBeenCalledTimes(1)
  })

  it('drops the token when the page sent no key, and sends a POST with its body', async () => {
    const network = vi.fn(async () => new Response('{}', { status: 200 }))
    const { engine } = setup({ network })
    const url = new URL(`${SUPABASE}/functions/v1/submit-portal-request`)
    const res = await engine.handle(url, { method: 'POST', headers: new Headers({ Authorization: 'Bearer the-invented-session', 'Content-Type': 'application/json' }), bodyText: '{"token":"sample"}' })
    expect(res.status).toBe(200)
    const [input, init] = network.mock.calls[0] as unknown as [string, RequestInit]
    expect(input).toBe(url.href)
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"token":"sample"}')
  })

  it('answers every function from the world on any other page, and the state knob still rules a sample page', async () => {
    const network = vi.fn(async () => new Response('{}', { status: 200 }))
    const plain = setup()
    const res = await plain.engine.handle(new URL(`${SUPABASE}/functions/v1/street-view-preview`), { method: 'POST', headers: new Headers(), bodyText: '{}' })
    expect(await res.json()).toEqual({ ok: false })
    const offline = setup({ network, mood: 'offline' })
    await expect(offline.engine.handle(new URL(`${SUPABASE}/functions/v1/customer-portal?token=sample`), { method: 'GET', headers: new Headers(), bodyText: null })).rejects.toThrow('Failed to fetch')
    expect(network).not.toHaveBeenCalled()
  })
})
