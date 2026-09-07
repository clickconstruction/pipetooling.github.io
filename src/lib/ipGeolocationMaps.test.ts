import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
// The edge twin (supabase/functions/_shared/ipGeoValidation.ts) is not imported here: it does
// not typecheck under the app's strict tsconfig (noUncheckedIndexedAccess). Its gate is the
// same table by construction; a parity guard can follow once that file is strict-clean.
import { fetchCallerIpGeoForMaps, fetchIpGeoForMaps, googleMapsUrlForLatLng, isRoutablePublicIp, openGoogleMapsAt } from './ipGeolocationMaps'

/**
 * IP → map pin for clock punches and estimate views: the routable-IP gate
 * (kept in step with the edge function's), the Google Maps link, and the
 * authorised resolve call with its 24 h sessionStorage cache.
 */
const store = new Map<string, string>()
const g = globalThis as unknown as { sessionStorage: unknown; window: unknown; fetch: unknown }
g.sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
}
const open = vi.fn()
g.window = { open }
const fetchMock = vi.fn()
g.fetch = fetchMock
const client = (token: string | null = 'jwt-1') => ({ auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) } }) as unknown as SupabaseClient
const respond = (ok: boolean, body: unknown) => fetchMock.mockResolvedValueOnce({ ok, json: async () => body })

beforeEach(() => {
  store.clear()
  open.mockClear()
  fetchMock.mockReset()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-07T18:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('isRoutablePublicIp', () => {
  const cases: Array<[string, boolean]> = [
    ['8.8.8.8', true],
    [' 203.0.113.9 ', true],
    ['10.1.2.3', false],
    ['172.16.0.1', false],
    ['172.31.255.255', false],
    ['172.32.0.1', true],
    ['192.168.1.1', false],
    ['127.0.0.1', false],
    ['169.254.1.1', false],
    ['0.0.0.0', false],
    ['100.64.0.1', false], // carrier-grade NAT
    ['100.128.0.1', true],
    ['256.1.1.1', false],
    ['1.2.3', false],
    ['', false],
    ['not an ip', false],
    ['::1', false],
    ['[::1]', false],
    ['fe80::1', false],
    ['FD00::1', false],
    ['fc00::1', false],
    ['2001:db8::1', true],
    ['[2001:db8::1]', true],
    ['::ffff:8.8.8.8', true],
  ]
  it('hides the map for private, loopback, link-local, CGNAT and malformed addresses', () => {
    for (const [ip, expected] of cases) expect(isRoutablePublicIp(ip), ip).toBe(expected)
  })
})

describe('Google Maps link', () => {
  it('builds the q= URL with the pair encoded, and opens it in a new tab', () => {
    expect(googleMapsUrlForLatLng(29.7, -98.1)).toBe('https://www.google.com/maps?q=29.7%2C-98.1')
    openGoogleMapsAt(29.7, -98.1)
    expect(open).toHaveBeenCalledWith('https://www.google.com/maps?q=29.7%2C-98.1', '_blank', 'noopener,noreferrer')
  })
})

describe('fetchIpGeoForMaps', () => {
  it('calls the resolve function with the encoded IP, the session JWT and the anon key, then caches for 24 h', async () => {
    respond(true, { lat: 29.7, lng: -98.1, label: 'Kyle, TX' })
    expect(await fetchIpGeoForMaps(client(), ' 8.8.8.8 ')).toEqual({ lat: 29.7, lng: -98.1 })
    expect(fetchMock).toHaveBeenCalledWith('https://proj.supabase.co/functions/v1/resolve-ip-geolocation?ip=8.8.8.8', {
      method: 'GET',
      headers: { Authorization: 'Bearer jwt-1', apikey: 'anon-key' },
    })
    expect(JSON.parse(store.get('ipgeo:v1:8.8.8.8')!)).toEqual({ lat: 29.7, lng: -98.1, exp: Date.parse('2026-09-08T18:00:00Z') })

    expect(await fetchIpGeoForMaps(client(), '8.8.8.8')).toEqual({ lat: 29.7, lng: -98.1 }) // cache hit
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-09-08T18:00:01Z')) // expired
    respond(true, { lat: 1, lng: 2 })
    expect(await fetchIpGeoForMaps(client(), '8.8.8.8')).toEqual({ lat: 1, lng: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('ignores a corrupt or malformed cache entry and refetches', async () => {
    store.set('ipgeo:v1:8.8.8.8', '{oops')
    respond(true, { lat: 1, lng: 2 })
    expect(await fetchIpGeoForMaps(client(), '8.8.8.8')).toEqual({ lat: 1, lng: 2 })
    store.set('ipgeo:v1:8.8.8.8', JSON.stringify({ lat: 'x', lng: 2, exp: Date.now() + 1000 }))
    respond(true, { lat: 3, lng: 4 })
    expect(await fetchIpGeoForMaps(client(), '8.8.8.8')).toEqual({ lat: 3, lng: 4 })
    expect(store.has('ipgeo:v1:8.8.8.8')).toBe(true) // rewritten with the fresh value
  })
  it('names each failure: blank IP, not signed in, the service’s own error, a bare failure, an invalid payload', async () => {
    await expect(fetchIpGeoForMaps(client(), '   ')).rejects.toThrow('Missing IP')
    await expect(fetchIpGeoForMaps(client(null), '8.8.8.8')).rejects.toThrow('Not signed in')
    expect(fetchMock).not.toHaveBeenCalled()
    respond(false, { error: 'IP is not routable' })
    await expect(fetchIpGeoForMaps(client(), '8.8.8.8')).rejects.toThrow('IP is not routable')
    respond(false, {})
    await expect(fetchIpGeoForMaps(client(), '8.8.8.8')).rejects.toThrow('Could not resolve IP location')
    respond(true, { lat: '29.7', lng: -98.1 })
    await expect(fetchIpGeoForMaps(client(), '8.8.8.8')).rejects.toThrow('Invalid response from geolocation service')
    expect(store.size).toBe(0) // nothing cached on failure
  })
})

describe('fetchCallerIpGeoForMaps', () => {
  it('resolves the signed-in caller (no ip query) and never touches the cache', async () => {
    respond(true, { lat: 5, lng: 6 })
    expect(await fetchCallerIpGeoForMaps(client())).toEqual({ lat: 5, lng: 6 })
    expect(fetchMock.mock.calls[0]![0]).toBe('https://proj.supabase.co/functions/v1/resolve-ip-geolocation')
    expect(store.size).toBe(0)
    respond(true, { lat: 7, lng: 8 })
    expect(await fetchCallerIpGeoForMaps(client())).toEqual({ lat: 7, lng: 8 }) // no cache: asks again
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
