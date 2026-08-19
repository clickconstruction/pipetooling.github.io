import { supabase } from './supabase'
import type { Database } from '../types/database'
import { APP_SETTINGS_KEY_OFFICE_ADDRESS_V1 } from './appSettingsKeys'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { fetchMapDefaultViewFromAppSettings } from './mapDefaultViewSettings'
import { mapGeocodeErrorMessage } from './map/geocodeErrorMessage'
import type { GeocodeOneFail, GeocodeOneOk, GeocodeOneResponse } from './map/invokeGeocodeOneRefreshGoogleOnly'

/**
 * The company office's address + coordinates (`app_settings.office_address_v1`) —
 * the anchor for the bid form's "Distance to Office" auto-fill. Dev-only write
 * (Settings → Office address); all roles read. When unset, consumers fall back
 * to the Map default view center via `resolveOfficeAnchor`.
 */

export type OfficeAddressV1 = {
  address: string
  lat: number
  lng: number
}

function isValidLat(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90
}
function isValidLng(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180
}

export function parseOfficeAddressV1(valueText: string | null | undefined): OfficeAddressV1 | null {
  if (valueText == null || valueText.trim() === '') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(valueText) as unknown
  } catch {
    return null
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const o = parsed as Record<string, unknown>
  if (!isValidLat(o.lat) || !isValidLng(o.lng)) return null
  if (typeof o.address !== 'string' || o.address.trim() === '') return null
  return { address: o.address.trim(), lat: o.lat, lng: o.lng }
}

export function serializeOfficeAddressV1(v: OfficeAddressV1): string {
  return JSON.stringify({ address: v.address, lat: v.lat, lng: v.lng })
}

type AppSettingsValueTextRow = Pick<Database['public']['Tables']['app_settings']['Row'], 'value_text'>

export async function fetchOfficeAddressFromAppSettings(): Promise<OfficeAddressV1 | null> {
  const row: AppSettingsValueTextRow | null = await withSupabaseRetry(
    async () =>
      supabase
        .from('app_settings')
        .select('value_text')
        .eq('key', APP_SETTINGS_KEY_OFFICE_ADDRESS_V1)
        .maybeSingle(),
    'fetch office address app setting'
  )
  return parseOfficeAddressV1(row?.value_text ?? null)
}

export async function deleteOfficeAddressSetting(): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.from('app_settings').delete().eq('key', APP_SETTINGS_KEY_OFFICE_ADDRESS_V1),
    'delete office address app setting'
  )
}

export async function upsertOfficeAddressV1(v: OfficeAddressV1): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').upsert(
        { key: APP_SETTINGS_KEY_OFFICE_ADDRESS_V1, value_text: serializeOfficeAddressV1(v) },
        { onConflict: 'key' }
      ),
    'upsert office address app setting'
  )
}

/** Geocode an address, then save it as the office anchor. For Settings (dev) save. */
export async function saveOfficeAddressFromAddress(
  address: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const t = address.trim()
  if (t === '') return { ok: false, message: 'Address is required' }

  let data: GeocodeOneResponse
  try {
    data = await withSupabaseRetry(
      async () => supabase.functions.invoke<GeocodeOneResponse>('geocode-one', { body: { address: t } }),
      'geocode-one office address'
    )
  } catch (e) {
    return { ok: false, message: formatErrorMessage(e, 'Geocoding failed') }
  }
  if (data && typeof data === 'object' && 'ok' in data && !data.ok) {
    const d = data as GeocodeOneFail
    return { ok: false, message: mapGeocodeErrorMessage(d.error ?? 'unknown', d.detail) }
  }
  if (data && typeof data === 'object' && 'ok' in data && data.ok) {
    const d = data as GeocodeOneOk
    await upsertOfficeAddressV1({ address: t, lat: d.lat, lng: d.lng })
    return { ok: true }
  }
  return { ok: false, message: 'Unexpected geocode response' }
}

export type OfficeAnchor = {
  lat: number
  lng: number
  /** Where the anchor came from — shown in hints so a stale anchor is visible. */
  source: 'office_address' | 'map_default_view'
  label: string
}

/** Office address setting when present, else the Map default view center. Null when neither is set. */
export async function resolveOfficeAnchor(): Promise<OfficeAnchor | null> {
  const office = await fetchOfficeAddressFromAppSettings()
  if (office) return { lat: office.lat, lng: office.lng, source: 'office_address', label: office.address }
  const mapView = await fetchMapDefaultViewFromAppSettings()
  if (mapView) return { lat: mapView.centerLat, lng: mapView.centerLng, source: 'map_default_view', label: mapView.addressLabel }
  return null
}
