import { parseTxParcelIdentify, TX_PARCEL_IDENTIFY_URL, type ParcelRecord } from './txParcelRecord.ts'

/**
 * The parcel under a map pin, from the Texas statewide parcel roll (TxGIO
 * StratMap, fed by the appraisal districts; public, keyless). Extracted from
 * `property-lookup` (v2.3004 / v2.3016) in v2.3450 so the nightly
 * `owner-confirm-nightly` function asks the same service the same way.
 *
 * The layer is scale-dependent: a very tight extent returns nothing, so the
 * extent is ±0.005° at 400px (≈2.7 m per pixel). Tolerance 1px first (the
 * containing polygon only), then 3px (≈8 m) for a pin that landed a few
 * metres onto the street — measured 2026-09-07 across Comal, Hays and Bexar.
 */

const IDENTIFY_TIMEOUT_MS = 12_000

export type ParcelIdentifyResult = { parcel: ParcelRecord | null; error?: string }

export async function identifyParcelOnce(lat: number, lng: number, tolerance: number): Promise<ParcelIdentifyResult> {
  const d = 0.005
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    layers: 'all:0',
    tolerance: String(tolerance),
    mapExtent: `${lng - d},${lat - d},${lng + d},${lat + d}`,
    imageDisplay: '400,400,96',
    returnGeometry: 'false',
    f: 'json',
  })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), IDENTIFY_TIMEOUT_MS)
  try {
    const r = await fetch(`${TX_PARCEL_IDENTIFY_URL}?${params.toString()}`, { signal: ctrl.signal })
    if (!r.ok) return { parcel: null, error: `parcel service HTTP ${r.status}` }
    const j: unknown = await r.json()
    const err = (j as { error?: { message?: string } } | null)?.error
    if (err) return { parcel: null, error: `parcel service: ${err.message ?? 'error'}` }
    return { parcel: parseTxParcelIdentify(j) }
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError' ? 'parcel service timed out' : 'parcel service unreachable'
    return { parcel: null, error: msg }
  } finally {
    clearTimeout(timer)
  }
}

/** Tight first, then the 3px fallback for a pin on the street. */
export async function identifyParcel(lat: number, lng: number): Promise<ParcelIdentifyResult> {
  const tight = await identifyParcelOnce(lat, lng, 1)
  if (tight.parcel || tight.error) return tight
  return identifyParcelOnce(lat, lng, 3)
}
