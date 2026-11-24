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

/** The three map services, each answering what the case sets. */
const net: { nominatim: Array<{ lat: string; lon: string }> | number; google: string; census: 'none' | number; asked: string[] } = { nominatim: [], google: 'ZERO_RESULTS', census: 'none', asked: [] }
const realFetch = globalThis.fetch
function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input instanceof Request ? input.url : input)
  const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  if (url.includes('nominatim.openstreetmap.org')) {
    net.asked.push('nominatim')
    return typeof net.nominatim === 'number' ? json({}, net.nominatim) : json(net.nominatim)
  }
  if (url.includes('maps.googleapis.com')) {
    net.asked.push('google')
    return json({ status: net.google, results: [] })
  }
  if (url.includes('/locations/onelineaddress')) {
    net.asked.push('census')
    return typeof net.census === 'number' ? json({}, net.census) : json({ result: { addressMatches: [] } })
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
  net.nominatim = []
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
  it('all three services say not found: the miss is kept, with what they said', async () => {
    const out = await post({ addresses: [WORDS] })
    expect(net.asked).toEqual(['nominatim', 'google', 'census'])
    expect(out.results).toEqual([])
    expect(out.failures).toHaveLength(1)
    expect(out.failures[0]).toMatchObject({ address_normalized: KEY, error_code: 'not_found' })
    expect(out.failures[0]!.remembered).toBeUndefined()
    expect(db.missUpserts).toEqual([{ address_normalized: KEY, error_code: 'not_found', detail: 'No match from OpenStreetMap or Google; no match from US Census' }])
    expect(db.pointUpserts).toEqual([])
  })

  it('a miss that stands: no service is asked, and the answer says so with the day it was checked', async () => {
    const checked = daysAgo(3)
    db.misses = [{ address_normalized: KEY, error_code: 'not_found', detail: 'No match from OpenStreetMap or Google; no match from US Census', checked_at: checked }]
    const out = await post({ addresses: [WORDS] })
    expect(net.asked).toEqual([])
    expect(out.failures).toEqual([{ address_normalized: KEY, error_code: 'not_found', detail: 'No match from OpenStreetMap or Google; no match from US Census', remembered: true, checked_at: checked }])
    expect(db.missUpserts).toEqual([])
  })

  it('a miss past its days is asked again, and kept again', async () => {
    db.misses = [{ address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(31) }]
    const out = await post({ addresses: [WORDS] })
    expect(net.asked).toEqual(['nominatim', 'google', 'census'])
    expect(out.failures[0]!.remembered).toBeUndefined()
    expect(db.missUpserts).toHaveLength(1)
  })

  it('retry: true, a person\'s Try again, asks past a miss that stands', async () => {
    db.misses = [{ address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(1) }]
    const out = await post({ addresses: [WORDS], retry: true })
    expect(net.asked).toEqual(['nominatim', 'google', 'census'])
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

  it('an address the street map places is saved as a point, and no miss is written', async () => {
    net.nominatim = [{ lat: '29.5688', lon: '-97.9647' }]
    const out = await post({ addresses: ['123 Made Up St, Seguin, TX 78155'] })
    expect(out.results).toHaveLength(1)
    expect(db.pointUpserts).toEqual(['123 made up st, seguin, tx 78155'])
    expect(db.missUpserts).toEqual([])
  })
})

describe('an outage keeps nothing, so good addresses are not marked for weeks', () => {
  it('Google over its limit', async () => {
    net.google = 'OVER_QUERY_LIMIT'
    const out = await post({ addresses: [WORDS] })
    expect(out.failures[0]).toMatchObject({ error_code: 'google_over_query' })
    expect(db.missUpserts).toEqual([])
  })

  it('Google refusing the key', async () => {
    net.google = 'REQUEST_DENIED'
    const out = await post({ addresses: [WORDS] })
    expect(out.failures[0]).toMatchObject({ error_code: 'google_denied' })
    expect(db.missUpserts).toEqual([])
  })

  it('the street map down', async () => {
    net.nominatim = 503
    await post({ addresses: [WORDS] })
    expect(db.missUpserts).toEqual([])
  })

  it('the Census down', async () => {
    net.census = 500
    const out = await post({ addresses: [WORDS] })
    expect(out.failures[0]).toMatchObject({ error_code: 'not_found' })
    expect(db.missUpserts).toEqual([])
  })

  it('Google never asked, with no key set', async () => {
    ENV.GOOGLE_MAPS_API_KEY = ''
    await post({ addresses: [WORDS] })
    expect(net.asked).toEqual(['nominatim', 'census'])
    expect(db.missUpserts).toEqual([])
  })
})

describe('the memory is best effort and never fails a batch', () => {
  it('a failed read of the misses asks as before', async () => {
    db.missReadError = 'relation "address_geocode_misses" does not exist'
    const out = await post({ addresses: [WORDS] })
    expect(net.asked).toEqual(['nominatim', 'google', 'census'])
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

describe('the wait between asks is owed only to an address that is asked', () => {
  it('a remembered address ahead of a new one adds no wait', async () => {
    db.misses = [{ address_normalized: KEY, error_code: 'not_found', detail: null, checked_at: daysAgo(1) }]
    const timeouts = vi.spyOn(globalThis, 'setTimeout')
    const out = await post({ addresses: [WORDS, 'ZZ another made up corner'] })
    expect(timeouts.mock.calls.filter((c) => c[1] === 1100)).toHaveLength(0)
    timeouts.mockRestore()
    expect(out.failures.map((f) => [f.address_normalized, f.remembered === true])).toEqual([
      [KEY, true],
      ['zz another made up corner', false],
    ])
  })
})
