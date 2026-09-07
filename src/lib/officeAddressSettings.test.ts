import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The company office's address + coordinates — the anchor for the bid form's
 * "Distance to Office": the stored JSON's validation, the app_settings read /
 * upsert / delete, geocode-then-save, and the anchor resolution that falls back
 * to the Map default view.
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
const mapView = vi.fn(async (): Promise<{ centerLat: number; centerLng: number; zoom: number; addressLabel: string } | null> => null)
vi.mock('./mapDefaultViewSettings', () => ({ fetchMapDefaultViewFromAppSettings: () => mapView() }))

import { APP_SETTINGS_KEY_OFFICE_ADDRESS_V1 } from './appSettingsKeys'
import {
  deleteOfficeAddressSetting,
  fetchOfficeAddressFromAppSettings,
  parseOfficeAddressV1,
  resolveOfficeAnchor,
  saveOfficeAddressFromAddress,
  serializeOfficeAddressV1,
  upsertOfficeAddressV1,
} from './officeAddressSettings'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const office = { address: '12925 FM 20, Kingsbury TX', lat: 29.7, lng: -98.1 }

beforeEach(() => {
  queries.length = 0
  route = () => ({ data: null, error: null })
  invoke.mockClear()
  invoke.mockResolvedValue({ data: { ok: true, lat: 29.7, lng: -98.1 }, error: null })
  mapView.mockReset()
  mapView.mockResolvedValue(null)
})

describe('parseOfficeAddressV1 / serializeOfficeAddressV1', () => {
  it('accepts in-range coordinates with a non-blank address (trimmed) and round-trips; rejects blanks, bad JSON, arrays, out-of-range or missing fields', () => {
    expect(parseOfficeAddressV1(JSON.stringify({ ...office, address: '  12925 FM 20, Kingsbury TX ' }))).toEqual(office)
    expect(parseOfficeAddressV1(serializeOfficeAddressV1(office))).toEqual(office)
    expect(JSON.parse(serializeOfficeAddressV1({ ...office, extra: 1 } as never))).toEqual(office)
    for (const bad of [null, '', '  ', '{oops', '[]', JSON.stringify({ ...office, lat: 91 }), JSON.stringify({ ...office, lng: '-98.1' }), JSON.stringify({ ...office, address: ' ' }), JSON.stringify({ lat: 1, lng: 1 })]) {
      expect(parseOfficeAddressV1(bad), String(bad)).toBeNull()
    }
  })
})

describe('app_settings read / write', () => {
  it('reads by key and parses; no row or an invalid row → null; upsert writes the serialised value; delete removes the key; failures throw', async () => {
    route = () => ({ data: { value_text: serializeOfficeAddressV1(office) }, error: null })
    expect(await fetchOfficeAddressFromAppSettings()).toEqual(office)
    expect(argsOf(queries[0]!.steps, 'eq')).toEqual([['key', APP_SETTINGS_KEY_OFFICE_ADDRESS_V1]])
    expect(queries[0]!.steps.some((s) => s.method === 'maybeSingle')).toBe(true)
    route = () => ({ data: null, error: null })
    expect(await fetchOfficeAddressFromAppSettings()).toBeNull()
    route = () => ({ data: { value_text: '{oops' }, error: null })
    expect(await fetchOfficeAddressFromAppSettings()).toBeNull()
    queries.length = 0
    route = () => ({ data: null, error: null })
    await upsertOfficeAddressV1(office)
    expect(argsOf(queries[0]!.steps, 'upsert')).toEqual([[{ key: APP_SETTINGS_KEY_OFFICE_ADDRESS_V1, value_text: serializeOfficeAddressV1(office) }, { onConflict: 'key' }]])
    queries.length = 0
    await deleteOfficeAddressSetting()
    expect(queries[0]!.steps.some((s) => s.method === 'delete')).toBe(true)
    expect(argsOf(queries[0]!.steps, 'eq')).toEqual([['key', APP_SETTINGS_KEY_OFFICE_ADDRESS_V1]])
    route = () => ({ data: null, error: { message: 'rls' } })
    await expect(fetchOfficeAddressFromAppSettings()).rejects.toThrow('rls')
    await expect(upsertOfficeAddressV1(office)).rejects.toThrow('rls')
  })
})

describe('saveOfficeAddressFromAddress', () => {
  it('requires an address, geocodes the trimmed text, saves the point with the typed address, and maps the failure shapes with nothing saved', async () => {
    expect(await saveOfficeAddressFromAddress('   ')).toEqual({ ok: false, message: 'Address is required' })
    expect(invoke).not.toHaveBeenCalled()
    expect(await saveOfficeAddressFromAddress(' 12925 FM 20, Kingsbury TX ')).toEqual({ ok: true })
    expect(invoke).toHaveBeenCalledWith('geocode-one', { body: { address: '12925 FM 20, Kingsbury TX' } })
    expect(argsOf(queries[0]!.steps, 'upsert')).toEqual([[{ key: APP_SETTINGS_KEY_OFFICE_ADDRESS_V1, value_text: serializeOfficeAddressV1(office) }, { onConflict: 'key' }]])
    queries.length = 0
    invoke.mockResolvedValueOnce({ data: { ok: false, error: 'not_found', detail: 'no match' }, error: null })
    expect(await saveOfficeAddressFromAddress('nowhere')).toEqual({ ok: false, message: 'geocode not_found (no match)' })
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'function down' } })
    expect(await saveOfficeAddressFromAddress('nowhere')).toEqual({ ok: false, message: 'function down' })
    invoke.mockResolvedValueOnce({ data: { odd: true }, error: null })
    expect(await saveOfficeAddressFromAddress('nowhere')).toEqual({ ok: false, message: 'Unexpected geocode response' })
    expect(queries).toHaveLength(0)
  })
})

describe('resolveOfficeAnchor', () => {
  it('prefers the office address, falls back to the Map default view centre with its source named, and is null when neither is set', async () => {
    route = () => ({ data: { value_text: serializeOfficeAddressV1(office) }, error: null })
    expect(await resolveOfficeAnchor()).toEqual({ lat: 29.7, lng: -98.1, source: 'office_address', label: '12925 FM 20, Kingsbury TX' })
    expect(mapView).not.toHaveBeenCalled()
    route = () => ({ data: null, error: null })
    mapView.mockResolvedValueOnce({ centerLat: 30.2, centerLng: -97.7, zoom: 10, addressLabel: 'Austin, TX' })
    expect(await resolveOfficeAnchor()).toEqual({ lat: 30.2, lng: -97.7, source: 'map_default_view', label: 'Austin, TX' })
    expect(await resolveOfficeAnchor()).toBeNull()
  })
})
