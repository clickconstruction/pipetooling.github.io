// @vitest-environment jsdom
/**
 * The hook behind the Dashboard, Pipeline and Bid Board maps remembers an address no service could
 * place (punch list #408): it reads `address_geocode_misses` for the addresses with no saved point
 * and sends `geocode-address-batch` only an address that is in neither. The first open asks; the
 * second, with the miss kept, asks nothing. Every address is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useAddressGeocodeCoords, type AddressToGeocode } from './useAddressGeocodeCoords'
import { GEOCODE_MISS_STANDS_DAYS } from '../../supabase/functions/_shared/geocodeMissMemory'

type MissRow = { address_normalized: string; error_code: string; detail: string | null; checked_at: string }
const db = vi.hoisted(() => ({
  points: [] as { address_normalized: string; lat: number; lng: number }[],
  misses: [] as { address_normalized: string; error_code: string; detail: string | null; checked_at: string }[],
  missReadFails: false,
  reads: [] as string[],
  invoke: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        in: async (_col: string, keys: string[]) => {
          db.reads.push(table)
          if (table === 'address_geocode_misses') {
            if (db.missReadFails) return { data: null, error: { message: 'lost signal' } }
            return { data: db.misses.filter((m) => keys.includes(m.address_normalized)), error: null }
          }
          return { data: db.points.filter((p) => keys.includes(p.address_normalized)), error: null }
        },
      }),
    }),
    functions: { invoke: (name: string, opts: unknown) => db.invoke(name, opts) },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async <T,>(op: () => PromiseLike<{ data: T; error: null }>) => (await op()).data,
}))

const PLACED: AddressToGeocode = { key: '12 made up st, kyle, tx', display: '12 Made Up St, Kyle, TX' }
const WORDS: AddressToGeocode = { key: 'zz the pasture behind the made up barn', display: 'ZZ the pasture behind the made up barn' }
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const miss = (checked_at: string): MissRow => ({ address_normalized: WORDS.key, error_code: 'not_found', detail: null, checked_at })

afterEach(() => {
  cleanup()
  db.points = []
  db.misses = []
  db.missReadFails = false
  db.reads = []
  db.invoke.mockReset()
})

async function open(addresses: AddressToGeocode[]) {
  const view = renderHook(() => useAddressGeocodeCoords(addresses, true))
  await waitFor(() => expect(view.result.current.resolving).toBe(false))
  // The read of the saved points has answered once the misses or the geocoder were reached, or nothing was cold.
  await waitFor(() => expect(db.reads).toContain('address_geocodes'))
  return view
}

describe('useAddressGeocodeCoords and the memory of a miss (punch list #408)', () => {
  it('the first open asks about an address with no point and no miss; the second, with the miss kept, asks nothing', async () => {
    db.points = [{ address_normalized: PLACED.key, lat: 29.99, lng: -97.87 }]
    db.invoke.mockResolvedValue({ data: { results: [], failures: [{ address_normalized: WORDS.key, error_code: 'not_found' }] }, error: null })
    const first = await open([PLACED, WORDS])
    await waitFor(() => expect(db.invoke).toHaveBeenCalledTimes(1))
    expect(db.invoke).toHaveBeenCalledWith('geocode-address-batch', { body: { addresses: [WORDS.display] } })
    expect(first.result.current.coords.has(PLACED.key)).toBe(true)
    first.unmount()

    // The function kept the miss on the first open.
    db.misses = [miss(daysAgo(0))]
    db.invoke.mockClear()
    db.reads = []
    const second = await open([PLACED, WORDS])
    await waitFor(() => expect(db.reads).toContain('address_geocode_misses'))
    await waitFor(() => expect(second.result.current.resolving).toBe(false))
    expect(db.invoke).not.toHaveBeenCalled()
    expect(second.result.current.coords.has(PLACED.key)).toBe(true)
    expect(second.result.current.coords.has(WORDS.key)).toBe(false)
  })

  it('a miss past its days is asked again by itself', async () => {
    db.misses = [miss(daysAgo(GEOCODE_MISS_STANDS_DAYS + 1))]
    db.invoke.mockResolvedValue({ data: { results: [], failures: [] }, error: null })
    await open([WORDS])
    await waitFor(() => expect(db.invoke).toHaveBeenCalledTimes(1))
  })

  it('a failed read of the misses asks as before', async () => {
    db.missReadFails = true
    db.invoke.mockResolvedValue({ data: { results: [], failures: [] }, error: null })
    await open([WORDS])
    await waitFor(() => expect(db.invoke).toHaveBeenCalledTimes(1))
  })

  it('with every address placed, the misses are not read at all', async () => {
    db.points = [{ address_normalized: PLACED.key, lat: 29.99, lng: -97.87 }]
    const view = await open([PLACED])
    await waitFor(() => expect(view.result.current.coords.has(PLACED.key)).toBe(true))
    expect(db.reads).toEqual(['address_geocodes'])
    expect(db.invoke).not.toHaveBeenCalled()
  })
})
