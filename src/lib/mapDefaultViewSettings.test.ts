import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The org's default Map view (Settings → Map default view, read by the Map
 * page and the office-address setting): the stored JSON's validation, the
 * app_settings read / upsert / delete, and the geocode-then-save flow.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: () => { data: unknown; error: { message: string } | null } = () => ({ data: null, error: null })
const invoke = vi.fn(async (_name: string, _opts: unknown): Promise<{ data: unknown; error: { message: string } | null }> => ({ data: { ok: true, lat: 29.7, lng: -98.1 }, error: null }))
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route())
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
    functions: { invoke: (name: string, opts: unknown) => invoke(name, opts) },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}))
vi.mock('./map/geocodeErrorMessage', () => ({ mapGeocodeErrorMessage: (error: string, detail?: string | null) => `geocode ${error}${detail ? ` (${detail})` : ''}` }))

import { APP_SETTINGS_KEY_MAP_DEFAULT_VIEW_V1 } from './appSettingsKeys'
import {
  DEFAULT_MAP_FALLBACK_CENTER,
  DEFAULT_MAP_FALLBACK_ZOOM,
  deleteMapDefaultViewSetting,
  fetchMapDefaultViewFromAppSettings,
  parseMapDefaultViewV1,
  saveMapDefaultViewFromAddress,
  serializeMapDefaultViewV1,
  upsertMapDefaultViewV1,
} from './mapDefaultViewSettings'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const view = { centerLat: 29.7, centerLng: -98.1, zoom: 12, addressLabel: '1 Main St, Kyle TX' }

beforeEach(() => {
  queries.length = 0
  route = () => ({ data: null, error: null })
  invoke.mockClear()
  invoke.mockResolvedValue({ data: { ok: true, lat: 29.7, lng: -98.1 }, error: null })
})

describe('parseMapDefaultViewV1 / serializeMapDefaultViewV1', () => {
  it('accepts a complete, in-range view (trimming the label) and round-trips through serialize', () => {
    expect(parseMapDefaultViewV1(JSON.stringify({ ...view, addressLabel: '  1 Main St, Kyle TX ' }))).toEqual(view)
    expect(parseMapDefaultViewV1(serializeMapDefaultViewV1(view))).toEqual(view)
    expect(JSON.parse(serializeMapDefaultViewV1({ ...view, extra: 'dropped' } as never))).toEqual(view)
  })
  it('rejects blanks, bad JSON, non-objects, out-of-range coordinates or zoom, and a missing label', () => {
    expect(parseMapDefaultViewV1(null)).toBeNull()
    expect(parseMapDefaultViewV1('   ')).toBeNull()
    expect(parseMapDefaultViewV1('{oops')).toBeNull()
    expect(parseMapDefaultViewV1('[1,2]')).toBeNull()
    expect(parseMapDefaultViewV1(JSON.stringify({ ...view, centerLat: 91 }))).toBeNull()
    expect(parseMapDefaultViewV1(JSON.stringify({ ...view, centerLng: -181 }))).toBeNull()
    expect(parseMapDefaultViewV1(JSON.stringify({ ...view, zoom: 3 }))).toBeNull()
    expect(parseMapDefaultViewV1(JSON.stringify({ ...view, zoom: 19 }))).toBeNull()
    expect(parseMapDefaultViewV1(JSON.stringify({ ...view, zoom: '12' }))).toBeNull()
    expect(parseMapDefaultViewV1(JSON.stringify({ ...view, addressLabel: '  ' }))).toBeNull()
    expect(parseMapDefaultViewV1(JSON.stringify({ ...view, centerLat: Number.NaN }))).toBeNull()
  })
  it('keeps the historical fallback for callers with no row', () => {
    expect(DEFAULT_MAP_FALLBACK_CENTER).toEqual({ lat: 41.878, lng: -87.63 })
    expect(DEFAULT_MAP_FALLBACK_ZOOM).toBe(10)
  })
})

describe('app_settings read / write', () => {
  it('reads the org row by key and parses it; no row or an invalid row reads as null; a failed read throws', async () => {
    route = () => ({ data: { value_text: serializeMapDefaultViewV1(view) }, error: null })
    expect(await fetchMapDefaultViewFromAppSettings()).toEqual(view)
    expect(queries[0]!.table).toBe('app_settings')
    expect(argsOf(queries[0]!.steps, 'eq')).toEqual([['key', APP_SETTINGS_KEY_MAP_DEFAULT_VIEW_V1]])
    expect(queries[0]!.steps.some((s) => s.method === 'maybeSingle')).toBe(true)
    route = () => ({ data: null, error: null })
    expect(await fetchMapDefaultViewFromAppSettings()).toBeNull()
    route = () => ({ data: { value_text: '{oops' }, error: null })
    expect(await fetchMapDefaultViewFromAppSettings()).toBeNull()
    route = () => ({ data: null, error: { message: 'rls' } })
    await expect(fetchMapDefaultViewFromAppSettings()).rejects.toThrow('rls')
  })
  it('upsert writes the serialized view under the key; delete removes the key', async () => {
    await upsertMapDefaultViewV1(view)
    expect(argsOf(queries[0]!.steps, 'upsert')).toEqual([[{ key: APP_SETTINGS_KEY_MAP_DEFAULT_VIEW_V1, value_text: serializeMapDefaultViewV1(view) }, { onConflict: 'key' }]])
    queries.length = 0
    await deleteMapDefaultViewSetting()
    expect(queries[0]!.steps.some((s) => s.method === 'delete')).toBe(true)
    expect(argsOf(queries[0]!.steps, 'eq')).toEqual([['key', APP_SETTINGS_KEY_MAP_DEFAULT_VIEW_V1]])
    route = () => ({ data: null, error: { message: 'read only' } })
    await expect(upsertMapDefaultViewV1(view)).rejects.toThrow('read only')
  })
})

describe('saveMapDefaultViewFromAddress', () => {
  it('validates the address and zoom, geocodes the trimmed address, and saves the view with the typed label', async () => {
    expect(await saveMapDefaultViewFromAddress('   ', 12)).toEqual({ ok: false, message: 'Address is required' })
    expect(await saveMapDefaultViewFromAddress('1 Main', 3)).toEqual({ ok: false, message: 'Zoom must be between 4 and 18' })
    expect(await saveMapDefaultViewFromAddress('1 Main', 18.5)).toEqual({ ok: false, message: 'Zoom must be between 4 and 18' })
    expect(invoke).not.toHaveBeenCalled()

    expect(await saveMapDefaultViewFromAddress(' 1 Main St, Kyle TX ', 12)).toEqual({ ok: true })
    expect(invoke).toHaveBeenCalledWith('geocode-one', { body: { address: '1 Main St, Kyle TX' } })
    expect(argsOf(queries[0]!.steps, 'upsert')).toEqual([[{ key: APP_SETTINGS_KEY_MAP_DEFAULT_VIEW_V1, value_text: serializeMapDefaultViewV1(view) }, { onConflict: 'key' }]])
  })
  it('maps a geocode refusal, a transport failure and an unexpected payload to messages, saving nothing', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: false, error: 'not_found', detail: 'no match' }, error: null })
    expect(await saveMapDefaultViewFromAddress('nowhere', 12)).toEqual({ ok: false, message: 'geocode not_found (no match)' })
    invoke.mockResolvedValueOnce({ data: { ok: false }, error: null })
    expect(await saveMapDefaultViewFromAddress('nowhere', 12)).toEqual({ ok: false, message: 'geocode unknown' })
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'function down' } })
    expect(await saveMapDefaultViewFromAddress('nowhere', 12)).toEqual({ ok: false, message: 'function down' })
    invoke.mockResolvedValueOnce({ data: { something: 'else' }, error: null })
    expect(await saveMapDefaultViewFromAddress('nowhere', 12)).toEqual({ ok: false, message: 'Unexpected geocode response' })
    expect(queries).toHaveLength(0)
  })
})
