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
type MissRow = { address_normalized: string; error_code: string; detail: string | null; checked_at: string }
const db: { cached: { lat: number; lng: number } | null; upserts: string[]; role: string; miss: MissRow | null; missUpserts: Array<{ address_normalized: string; error_code: string; detail: string | null }> } = {
  cached: null,
  upserts: [],
  role: 'dev',
  miss: null,
  missUpserts: [],
}

type Chain = { [method: string]: (...args: unknown[]) => unknown }
function table(name: string): Chain {
  const chain: Chain = {}
  for (const m of ['select', 'eq']) chain[m] = () => chain
  chain.single = () => Promise.resolve({ data: name === 'users' ? { role: db.role } : null, error: null })
  chain.maybeSingle = () => Promise.resolve({ data: name === 'address_geocodes' ? db.cached : name === 'address_geocode_misses' ? db.miss : null, error: null })
  chain.upsert = (row: unknown) => {
    if (name === 'address_geocode_misses') db.missUpserts.push(row as { address_normalized: string; error_code: string; detail: string | null })
    else db.upserts.push((row as { address_normalized: string }).address_normalized)
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
const net: { nominatim: Array<{ lat: string; lon: string }>; county: string; google: string; asked: string[] } = { nominatim: [], county: 'Travis County', google: 'ZERO_RESULTS', asked: [] }
const realFetch = globalThis.fetch
function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input instanceof Request ? input.url : input)
  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  if (url.includes('nominatim.openstreetmap.org')) {
    net.asked.push('nominatim')
    return json(net.nominatim)
  }
  if (url.includes('/geographies/coordinates')) return json({ result: { geographies: { Counties: [{ NAME: net.county }] } } })
  if (url.includes('/locations/onelineaddress')) {
    net.asked.push('census')
    return json({ result: { addressMatches: [] } })
  }
  // Asked only by the cases that set a key (punch list #408).
  if (url.includes('maps.googleapis.com')) {
    net.asked.push('google')
    return json({ status: net.google, results: [] })
  }
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
  db.miss = null
  db.missUpserts = []
  net.nominatim = []
  net.county = 'Travis County'
  net.google = 'ZERO_RESULTS'
  net.asked = []
  delete ENV.GOOGLE_MAPS_API_KEY
})

function post(address: string, more: Record<string, unknown> = {}): Promise<Response> {
  return box.handler!(new Request('http://fn/geocode-one', { method: 'POST', headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json' }, body: JSON.stringify({ address, ...more }) }))
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

describe('geocode-one remembers an address no service could place (punch list #408)', () => {
  const WORDS = 'ZZ the pasture behind the made up barn'
  const KEY = 'zz the pasture behind the made up barn'
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

  it('all three services say not found: the miss is kept, with what they said', async () => {
    ENV.GOOGLE_MAPS_API_KEY = 'test-key'
    const res = await post(WORDS)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: false, error: 'not_found' })
    expect(net.asked).toEqual(['nominatim', 'google', 'census'])
    expect(db.missUpserts).toEqual([{ address_normalized: KEY, error_code: 'not_found', detail: 'no match from US Census' }])
    expect(db.upserts).toEqual([])
  })

  it('a miss that stands: no service is asked, and the answer says so with the day it was checked', async () => {
    ENV.GOOGLE_MAPS_API_KEY = 'test-key'
    const checked = daysAgo(3)
    db.miss = { address_normalized: KEY, error_code: 'not_found', detail: 'no match from US Census', checked_at: checked }
    const res = await post(WORDS)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await res.json()).toEqual({ ok: false, address_normalized: KEY, error: 'not_found', detail: 'no match from US Census', remembered: true, checked_at: checked })
    expect(net.asked).toEqual([])
    expect(db.missUpserts).toEqual([])
  })

  it('a miss past its days is asked again', async () => {
    ENV.GOOGLE_MAPS_API_KEY = 'test-key'
    db.miss = { address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(31) }
    const body = await (await post(WORDS)).json()
    expect(body.remembered).toBeUndefined()
    expect(net.asked).toEqual(['nominatim', 'google', 'census'])
    expect(db.missUpserts).toHaveLength(1)
  })

  it('retry: true, a person\'s press, asks past a miss that stands', async () => {
    ENV.GOOGLE_MAPS_API_KEY = 'test-key'
    db.miss = { address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(1) }
    const body = await (await post(WORDS, { retry: true })).json()
    expect(body.remembered).toBeUndefined()
    expect(net.asked).toEqual(['nominatim', 'google', 'census'])
  })

  it('a saved point answers first, whatever the memory holds', async () => {
    db.cached = { lat: 30.2642, lng: -97.7437 }
    db.miss = { address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(1) }
    expect(await (await post(WORDS)).json()).toMatchObject({ ok: true, fromCache: true })
  })

  it('Google over its limit keeps nothing', async () => {
    ENV.GOOGLE_MAPS_API_KEY = 'test-key'
    net.google = 'OVER_QUERY_LIMIT'
    expect(await (await post(WORDS)).json()).toMatchObject({ ok: false, error: 'google_over_query' })
    expect(db.missUpserts).toEqual([])
  })

  it('Google never asked, with no key set, keeps nothing', async () => {
    expect(await (await post(WORDS)).json()).toMatchObject({ ok: false, error: 'not_found' })
    expect(net.asked).toEqual(['nominatim', 'census'])
    expect(db.missUpserts).toEqual([])
  })

  it('the Google refresh reads no memory and keeps no miss', async () => {
    ENV.GOOGLE_MAPS_API_KEY = 'test-key'
    db.miss = { address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(1) }
    const body = await (await post(WORDS, { refresh_google_only: true })).json()
    expect(body).toMatchObject({ ok: false, error: 'not_found' })
    expect(body.remembered).toBeUndefined()
    expect(net.asked).toEqual(['google'])
    expect(db.missUpserts).toEqual([])
  })
})
