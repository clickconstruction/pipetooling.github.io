/**
 * geocode-address-batch's own handler, run here (punch list #408): the function's `index.ts` with its
 * two URL imports stood in for, a fake database and a fake network, as `geocodeOne.run.test.ts` runs
 * geocode-one. The cases prove the memory of a miss: an address every service missed is kept, a kept
 * one is answered with no service asked, an outage keeps nothing, and a person's Try again asks past
 * it. Nothing here reaches a real database or a map service. Every address is made up.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }

type MissRow = { address_normalized: string; error_code: string; detail: string | null; checked_at: string }
const db: {
  cached: Record<string, { lat: number; lng: number }>
  misses: MissRow[]
  missReadError: string | null
  missWriteError: { code?: string; message: string } | null
  pointUpserts: string[]
  missUpserts: Array<{ address_normalized: string; error_code: string; detail: string | null }>
} = { cached: {}, misses: [], missReadError: null, missWriteError: null, pointUpserts: [], missUpserts: [] }

type Chain = { [method: string]: (...args: unknown[]) => unknown }
function table(name: string): Chain {
  const chain: Chain = {}
  let eqKey = ''
  chain.select = () => chain
  chain.eq = (_col: unknown, value: unknown) => {
    eqKey = String(value)
    return chain
  }
  chain.single = () => Promise.resolve({ data: name === 'users' ? { role: 'helpers', archived_at: null } : null, error: null })
  chain.maybeSingle = () => Promise.resolve({ data: name === 'address_geocodes' ? (db.cached[eqKey] ?? null) : null, error: null })
  chain.in = (_col: unknown, keys: unknown) =>
    Promise.resolve(
      db.missReadError
        ? { data: null, error: { message: db.missReadError } }
        : { data: name === 'address_geocode_misses' ? db.misses.filter((m) => (keys as string[]).includes(m.address_normalized)) : [], error: null },
    )
  chain.upsert = (row: unknown) => {
    if (name === 'address_geocode_misses') {
      if (db.missWriteError) return Promise.resolve({ error: db.missWriteError })
      db.missUpserts.push(row as { address_normalized: string; error_code: string; detail: string | null })
    } else db.pointUpserts.push((row as { address_normalized: string }).address_normalized)
    return Promise.resolve({ error: null })
  }
  return chain
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u-helper' } }, error: null }) },
    from: (name: string) => table(name),
  }),
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'anon-key', GOOGLE_MAPS_API_KEY: 'test-key' }

/**
 * The two map services, each answering what the case sets. OpenStreetMap's lookup is not among them
 * (punch list #436): a request to it is an unexpected fetch, so a case that reached it would fail.
 */
type Point = { lat: number; lng: number }
const net: { google: string; googlePoint: Point | null; census: 'none' | number | Point; asked: string[] } = { google: 'ZERO_RESULTS', googlePoint: null, census: 'none', asked: [] }
const realFetch = globalThis.fetch
function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input instanceof Request ? input.url : input)
  const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  if (url.includes('maps.googleapis.com')) {
    net.asked.push('google')
    return net.googlePoint ? json({ status: 'OK', results: [{ geometry: { location: net.googlePoint } }] }) : json({ status: net.google, results: [] })
  }
  if (url.includes('/locations/onelineaddress')) {
    net.asked.push('census')
    if (typeof net.census === 'number') return json({}, net.census)
    return json({ result: { addressMatches: net.census === 'none' ? [] : [{ coordinates: { x: net.census.lng, y: net.census.lat } }] } })
  }
  return Promise.reject(new Error(`unexpected fetch ${url}`))
}

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/geocode-address-batch/index.ts'

const DAY_MS = 86_400_000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString()
const WORDS = 'ZZ the pasture behind the made up barn'
const KEY = 'zz the pasture behind the made up barn'

let warn: ReturnType<typeof vi.spyOn>
beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = fakeFetch as typeof fetch
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  globalThis.fetch = realFetch
})
beforeEach(() => {
  db.cached = {}
  db.misses = []
  db.missReadError = null
  db.missWriteError = null
  db.pointUpserts = []
  db.missUpserts = []
  net.googlePoint = null
  net.google = 'ZERO_RESULTS'
  net.census = 'none'
  net.asked = []
  ENV.GOOGLE_MAPS_API_KEY = 'test-key'
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

type Answer = {
  results: Array<{ address_normalized: string; lat: number; lng: number }>
  failures: Array<{ address_normalized: string; error_code: string; detail?: string; remembered?: boolean; checked_at?: string }>
}
async function post(body: Record<string, unknown>): Promise<Answer> {
  const res = await box.handler!(new Request('http://fn/geocode-address-batch', { method: 'POST', headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  expect(res.status).toBe(200)
  return (await res.json()) as Answer
}

describe('geocode-address-batch remembers an address no service could place (punch list #408)', () => {
  it('Google and the Census both say not found: the miss is kept, with what they said', async () => {
    const out = await post({ addresses: [WORDS] })
    // Google first, then the Census, and nobody else (punch list #436).
    expect(net.asked).toEqual(['google', 'census'])
    expect(out.results).toEqual([])
    expect(out.failures).toHaveLength(1)
    expect(out.failures[0]).toMatchObject({ address_normalized: KEY, error_code: 'not_found' })
    expect(out.failures[0]!.remembered).toBeUndefined()
    // A miss that was kept answers with the day, and one that was not does not (v2.8484).
    expect(Number.isFinite(Date.parse(String(out.failures[0]!.checked_at)))).toBe(true)
    expect(db.missUpserts).toEqual([{ address_normalized: KEY, error_code: 'not_found', detail: 'No match from Google; no match from US Census' }])
    expect(db.pointUpserts).toEqual([])
  })

  it('two addresses nobody can place: each is asked of both services and each miss is kept', async () => {
    const out = await post({ addresses: [WORDS, `${WORDS} two`] })
    expect(out.failures).toHaveLength(2)
    expect(net.asked).toEqual(['google', 'census', 'google', 'census'])
    expect(db.missUpserts.map((m) => m.address_normalized)).toEqual([KEY, `${KEY} two`])
    expect(warn).not.toHaveBeenCalled()
  })

  it('a miss that stands: no service is asked, and the answer says so with the day it was checked', async () => {
    const checked = daysAgo(3)
    db.misses = [{ address_normalized: KEY, error_code: 'not_found', detail: 'No match from Google; no match from US Census', checked_at: checked }]
    const out = await post({ addresses: [WORDS] })
    expect(net.asked).toEqual([])
    expect(out.failures).toEqual([{ address_normalized: KEY, error_code: 'not_found', detail: 'No match from Google; no match from US Census', remembered: true, checked_at: checked }])
    expect(db.missUpserts).toEqual([])
  })

  it('a miss past its days is asked again, and kept again', async () => {
    db.misses = [{ address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(31) }]
    const out = await post({ addresses: [WORDS] })
    expect(net.asked).toEqual(['google', 'census'])
    expect(out.failures[0]!.remembered).toBeUndefined()
    expect(db.missUpserts).toHaveLength(1)
  })

  it('retry: true, a person\'s Try again, asks past a miss that stands', async () => {
    db.misses = [{ address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(1) }]
    const out = await post({ addresses: [WORDS], retry: true })
    expect(net.asked).toEqual(['google', 'census'])
    expect(out.failures[0]!.remembered).toBeUndefined()
    expect(db.missUpserts).toHaveLength(1)
  })

  it('a saved point answers first, whatever the memory holds', async () => {
    db.cached[KEY] = { lat: 29.5688, lng: -97.9647 }
    db.misses = [{ address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(1) }]
    const out = await post({ addresses: [WORDS] })
    expect(out.results).toEqual([{ address_normalized: KEY, lat: 29.5688, lng: -97.9647 }])
    expect(out.failures).toEqual([])
    expect(net.asked).toEqual([])
  })

  it('an address Google places is saved as a point: the Census is not asked, and no miss is written', async () => {
    net.googlePoint = { lat: 29.5688, lng: -97.9647 }
    const out = await post({ addresses: ['123 Made Up St, Seguin, TX 78155'] })
    expect(out.results).toEqual([{ address_normalized: '123 made up st, seguin, tx 78155', lat: 29.5688, lng: -97.9647 }])
    expect(net.asked).toEqual(['google'])
    expect(db.pointUpserts).toEqual(['123 made up st, seguin, tx 78155'])
    expect(db.missUpserts).toEqual([])
  })

  it('an address Google misses and the Census places is saved as a point (punch list #436)', async () => {
    net.census = { lat: 29.5688, lng: -97.9647 }
    const out = await post({ addresses: ['123 Made Up St, Seguin, TX 78155'] })
    expect(out.results).toHaveLength(1)
    expect(out.failures).toEqual([])
    expect(net.asked).toEqual(['google', 'census'])
    expect(db.missUpserts).toEqual([])
  })
})

describe('an outage keeps nothing, so good addresses are not marked for weeks', () => {
  it('Google over its limit', async () => {
    net.google = 'OVER_QUERY_LIMIT'
    const out = await post({ addresses: [WORDS] })
    expect(out.failures[0]).toMatchObject({ error_code: 'google_over_query' })
    expect(out.failures[0]!.checked_at).toBeUndefined()
    expect(db.missUpserts).toEqual([])
  })

  it('Google refusing the key', async () => {
    net.google = 'REQUEST_DENIED'
    const out = await post({ addresses: [WORDS] })
    expect(out.failures[0]).toMatchObject({ error_code: 'google_denied' })
    expect(db.missUpserts).toEqual([])
  })

  it('the Census down', async () => {
    net.census = 500
    const out = await post({ addresses: [WORDS] })
    expect(out.failures[0]).toMatchObject({ error_code: 'not_found' })
    expect(db.missUpserts).toEqual([])
  })

  it('Google never asked, with no key set: the answer says the Census alone was asked', async () => {
    ENV.GOOGLE_MAPS_API_KEY = ''
    const out = await post({ addresses: [WORDS] })
    expect(net.asked).toEqual(['census'])
    expect(out.failures[0]).toMatchObject({ error_code: 'not_found', detail: 'No match from US Census; Google Geocoding is not configured' })
    expect(db.missUpserts).toEqual([])
  })
})

describe('the memory is best effort and never fails a batch', () => {
  it('a failed read of the misses asks as before', async () => {
    db.missReadError = 'relation "address_geocode_misses" does not exist'
    const out = await post({ addresses: [WORDS] })
    expect(net.asked).toEqual(['google', 'census'])
    expect(out.failures).toHaveLength(1)
    expect(warn).toHaveBeenCalled()
  })

  it('a training account\'s refused write still answers the miss', async () => {
    db.missWriteError = { code: 'P0001', message: 'Read-only (training) mode: changes are blocked.' }
    const out = await post({ addresses: [WORDS] })
    expect(out.failures[0]).toMatchObject({ address_normalized: KEY, error_code: 'not_found' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('any other failed write still answers the miss, and is logged', async () => {
    db.missWriteError = { code: '57014', message: 'canceling statement due to statement timeout' }
    const out = await post({ addresses: [WORDS] })
    expect(out.failures).toHaveLength(1)
    expect(warn).toHaveBeenCalled()
  })
})

describe('no address waits on another (punch list #436)', () => {
  it('two new addresses are asked one after the other, with no pause between them', async () => {
    const timeouts = vi.spyOn(globalThis, 'setTimeout')
    await post({ addresses: ['ZZ one made up corner', 'ZZ another made up corner'] })
    expect(timeouts.mock.calls.filter((c) => typeof c[1] === 'number' && c[1] >= 1000)).toHaveLength(0)
    timeouts.mockRestore()
  })

  it('a remembered address ahead of a new one is answered from memory, and only the new one is asked', async () => {
    db.misses = [{ address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(1) }]
    const out = await post({ addresses: [WORDS, 'ZZ another made up corner'] })
    expect(net.asked).toEqual(['google', 'census'])
    expect(out.failures.map((f) => [f.address_normalized, f.remembered === true])).toEqual([
      [KEY, true],
      ['zz another made up corner', false],
    ])
  })
})
