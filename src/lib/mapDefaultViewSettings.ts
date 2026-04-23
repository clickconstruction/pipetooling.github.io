import { supabase } from './supabase'
import type { Database } from '../types/database'
import { APP_SETTINGS_KEY_MAP_DEFAULT_VIEW_V1 } from './appSettingsKeys'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { mapGeocodeErrorMessage } from '../hooks/useMapPageData'
import type { GeocodeOneOk, GeocodeOneResponse, GeocodeOneFail } from './map/invokeGeocodeOneRefreshGoogleOnly'

/** Fallback when no `app_settings` row or parse fails; matches previous hardcoded Map default. */
export const DEFAULT_MAP_FALLBACK_CENTER: { lat: number; lng: number } = { lat: 41.878, lng: -87.63 }
export const DEFAULT_MAP_FALLBACK_ZOOM = 10

export type MapDefaultViewV1 = {
  centerLat: number
  centerLng: number
  /** Leaflet zoom level */
  zoom: number
  /** Address string shown in Settings / last geocoded on save */
  addressLabel: string
}

const ZOOM_MIN = 4
const ZOOM_MAX = 18

function isValidLat(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90
}
function isValidLng(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180
}
function isValidZoom(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= ZOOM_MIN && v <= ZOOM_MAX
}

export function parseMapDefaultViewV1(valueText: string | null | undefined): MapDefaultViewV1 | null {
  if (valueText == null || valueText.trim() === '') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(valueText) as unknown
  } catch {
    return null
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const o = parsed as Record<string, unknown>
  const centerLat = o.centerLat
  const centerLng = o.centerLng
  const zoom = o.zoom
  const addressLabel = o.addressLabel
  if (!isValidLat(centerLat) || !isValidLng(centerLng) || !isValidZoom(zoom)) return null
  if (typeof addressLabel !== 'string' || addressLabel.trim() === '') return null
  return {
    centerLat,
    centerLng,
    zoom,
    addressLabel: addressLabel.trim(),
  }
}

export function serializeMapDefaultViewV1(v: MapDefaultViewV1): string {
  return JSON.stringify({
    centerLat: v.centerLat,
    centerLng: v.centerLng,
    zoom: v.zoom,
    addressLabel: v.addressLabel,
  })
}

type AppSettingsValueTextRow = Pick<Database['public']['Tables']['app_settings']['Row'], 'value_text'>

export async function fetchMapDefaultViewFromAppSettings(): Promise<MapDefaultViewV1 | null> {
  const row: AppSettingsValueTextRow | null = await withSupabaseRetry(
    async () =>
      supabase
        .from('app_settings')
        .select('value_text')
        .eq('key', APP_SETTINGS_KEY_MAP_DEFAULT_VIEW_V1)
        .maybeSingle(),
    'fetch map default view app setting'
  )
  return parseMapDefaultViewV1(row?.value_text ?? null)
}

export async function deleteMapDefaultViewSetting(): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.from('app_settings').delete().eq('key', APP_SETTINGS_KEY_MAP_DEFAULT_VIEW_V1),
    'delete map default view app setting'
  )
}

export async function upsertMapDefaultViewV1(v: MapDefaultViewV1): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').upsert(
        { key: APP_SETTINGS_KEY_MAP_DEFAULT_VIEW_V1, value_text: serializeMapDefaultViewV1(v) },
        { onConflict: 'key' }
      ),
    'upsert map default view app setting'
  )
}

/**
 * Geocode an address, then save org default map view. For Settings (dev) save.
 */
export async function saveMapDefaultViewFromAddress(
  address: string,
  zoom: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const t = address.trim()
  if (t === '') return { ok: false, message: 'Address is required' }
  if (!isValidZoom(zoom)) {
    return { ok: false, message: `Zoom must be between ${ZOOM_MIN} and ${ZOOM_MAX}` }
  }

  let data: GeocodeOneResponse
  try {
    data = await withSupabaseRetry(
      async () => supabase.functions.invoke<GeocodeOneResponse>('geocode-one', { body: { address: t } }),
      'geocode-one map default view'
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
    const view: MapDefaultViewV1 = {
      centerLat: d.lat,
      centerLng: d.lng,
      zoom,
      addressLabel: t,
    }
    await upsertMapDefaultViewV1(view)
    return { ok: true }
  }
  return { ok: false, message: 'Unexpected geocode response' }
}
