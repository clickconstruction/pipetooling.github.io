import { supabase } from '../supabase'
import { suggestTxCountyForCity } from '../txCountyLookup'
import { splitJobAddressForPrefill } from '../txLocalityAddressSplit'
import { proposePropertyRecord, type ParcelRecord, type ProposedPropertyRecord } from './propertyRecord'

/**
 * Client side of the property lookup (v2.3004): invoke the `property-lookup`
 * edge function for an address, then fold the city→county table (curated +
 * org extras) into the proposal so every rung of the county ladder is on it.
 */

export type PropertyLookupOutcome =
  | { ok: true; proposal: ProposedPropertyRecord; parcel: ParcelRecord | null; parcelError: string | null }
  | { ok: false; error: string }

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function parseParcel(raw: unknown): ParcelRecord | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const rec: ParcelRecord = {
    propId: str(o.propId),
    ownerName: str(o.ownerName),
    nameCare: str(o.nameCare),
    legalDescription: str(o.legalDescription),
    situsAddress: str(o.situsAddress),
    mailingAddress: str(o.mailingAddress),
    county: str(o.county),
    source: str(o.source),
    taxYear: str(o.taxYear),
  }
  return rec.ownerName || rec.legalDescription || rec.propId ? rec : null
}

/** Human message for a failed lookup. */
export function propertyLookupErrorMessage(error: string): string {
  switch (error) {
    case 'not_found':
      return 'Could not place this address on the map. Check the street, city and ZIP, then try again.'
    case 'unauthorized':
      return 'Sign in again to look up properties.'
    case 'forbidden':
      return 'Property lookup is limited to office roles and estimators.'
    case 'offline':
      return 'You appear to be offline. The lookup needs a connection.'
    default:
      return `Property lookup failed: ${error}`
  }
}

/** Build the proposal from an edge-function payload (pure; exported for tests). */
export function proposalFromLookupPayload(address: string, payload: unknown): PropertyLookupOutcome {
  if (payload == null || typeof payload !== 'object') return { ok: false, error: 'empty response' }
  const o = payload as Record<string, unknown>
  if (o.ok !== true) {
    const err = str(o.error) || 'unknown'
    return { ok: false, error: err }
  }
  const parcel = parseParcel(o.parcel)
  const city = splitJobAddressForPrefill(address).city
  const proposal = proposePropertyRecord({
    address,
    parcel,
    geocoderCounty: str(o.county_geocoder),
    cityCounty: suggestTxCountyForCity(city),
    city,
  })
  return { ok: true, proposal, parcel, parcelError: str(o.parcel_error) || null }
}

export async function lookupPropertyRecord(address: string): Promise<PropertyLookupOutcome> {
  const a = address.trim()
  if (a.length < 5) return { ok: false, error: 'not_found' }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'offline' }
  try {
    const { data, error } = await supabase.functions.invoke('property-lookup', { body: { address: a } })
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status
      if (status === 401) return { ok: false, error: 'unauthorized' }
      if (status === 403) return { ok: false, error: 'forbidden' }
      return { ok: false, error: error.message || 'request failed' }
    }
    return proposalFromLookupPayload(a, data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'request failed' }
  }
}
