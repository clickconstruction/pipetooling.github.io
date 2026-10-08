/**
 * geocode-one's own handler, run here (v2.4878): the function's `index.ts` with its two URL imports
 * stood in for, a fake database, and a fake network. v2.4783 had `answer()` call itself, so every
 * answer recursed until the stack overflowed and Deno sent a 500 with no CORS header, which the
 * browser reports as a CORS error. Each case here proves an answer comes back as a 200 that the
 * browser may read. Nothing here reaches a real database or a map service.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }
const db: { cached: { lat: number; lng: number } | null; upserts: string[]; role: string } = { cached: null, upserts: [], role: 'dev' }

type Chain = { [method: string]: (...args: unknown[]) => unknown }
function table(name: string): Chain {
  const chain: Chain = {}
  for (const m of ['select', 'eq']) chain[m] = () => chain
  chain.single = () => Promise.resolve({ data: name === 'users' ? { role: db.role } : null, error: null })
  chain.maybeSingle = () => Promise.resolve({ data: name === 'address_geocodes' ? db.cached : null, error: null })
  chain.upsert = (row: unknown) => {
    db.upserts.push((row as { address_normalized: string }).address_normalized)
    return Promise.resolve({ error: null })
  }
  return chain
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u-dev' } }, error: null }) },
    from: (name: string) => table(name),
  }),
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'anon-key' }

/** The map services: Nominatim's search, the Census county lookup by point, the Census address lookup. */
const net: { nominatim: Array<{ lat: string; lon: string }>; county: string } = { nominatim: [], county: 'Travis County' }
const realFetch = globalThis.fetch
function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input instanceof Request ? input.url : input)
  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  if (url.includes('nominatim.openstreetmap.org')) return json(net.nominatim)
  if (url.includes('/geographies/coordinates')) return json({ result: { geographies: { Counties: [{ NAME: net.county }] } } })
  if (url.includes('/locations/onelineaddress')) return json({ result: { addressMatches: [] } })
  return Promise.reject(new Error(`unexpected fetch ${url}`))
}

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/geocode-one/index.ts'

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = fakeFetch as typeof fetch
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  globalThis.fetch = realFetch
})
beforeEach(() => {
  db.cached = null
  db.upserts = []
  db.role = 'dev'
  net.nominatim = []
  net.county = 'Travis County'
})

function post(address: string): Promise<Response> {
  return box.handler!(new Request('http://fn/geocode-one', { method: 'POST', headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) }))
}

describe('geocode-one answers with a 200 the browser can read (v2.4878)', () => {
  it('a cached address: the point and the county from the Census, with the CORS header', async () => {
    db.cached = { lat: 30.2642, lng: -97.7437 }
    const res = await post('100 Congress Ave, Austin, TX 78701')
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await res.json()).toMatchObject({ ok: true, fromCache: true, source: 'cache', lat: 30.2642, lng: -97.7437, county: 'Travis' })
  })

  it('a new address: placed by the street map, kept in the cache, the county named', async () => {
    net.nominatim = [{ lat: '29.5688', lon: '-97.9647' }]
    net.county = 'Guadalupe County'
    const res = await post('123 Main St, Seguin, TX 78155')
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await res.json()).toMatchObject({ ok: true, fromCache: false, source: 'nominatim', county: 'Guadalupe' })
    expect(db.upserts).toEqual(['123 main st, seguin, tx 78155'])
  })

  it('an address nobody can place: a 200 that says so, never a crash', async () => {
    const res = await post('nowhere at all')
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await res.json()).toMatchObject({ ok: false, error: 'not_found' })
  })
})

describe('geocode-one admits the roles that may open /map (v2.4974)', () => {
  it('a controller is answered like an assistant, not refused', async () => {
    db.role = 'controller'
    db.cached = { lat: 30.2642, lng: -97.7437 }
    const res = await post('100 Congress Ave, Austin, TX 78701')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, fromCache: true })
  })

  it('a superintendent, who cannot open /map, is refused with a 403 the browser can read', async () => {
    db.role = 'superintendent'
    db.cached = { lat: 30.2642, lng: -97.7437 }
    const res = await post('100 Congress Ave, Austin, TX 78701')
    expect(res.status).toBe(403)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(db.upserts).toEqual([])
  })
})

describe('geocode-one keeps only points in the lower 48 (v2.4975)', () => {
  it("the street map's point in Assam is a miss: not stored, and the answer says why", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    net.nominatim = [{ lat: '26.7813', lon: '91.9274' }]
    const res = await post('1 Main Street')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: false, error: 'not_found' })
    expect(body.detail).toContain('OpenStreetMap placed it outside the lower 48 (26.7813, 91.9274)')
    expect(db.upserts).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('a cached point in Assam is asked again, and the good answer replaces it', async () => {
    db.cached = { lat: 26.7813, lng: 91.9274 }
    net.nominatim = [{ lat: '29.5688', lon: '-97.9647' }]
    net.county = 'Guadalupe County'
    const res = await post('123 Main St, Seguin, TX 78155')
    expect(await res.json()).toMatchObject({ ok: true, fromCache: false, source: 'nominatim', lat: 29.5688, lng: -97.9647, county: 'Guadalupe' })
    expect(db.upserts).toEqual(['123 main st, seguin, tx 78155'])
  })
})
