import { supabase } from '../supabase'
import { suggestTxCountyForCity } from '../txCountyLookup'
import { splitJobAddressForPrefill } from '../txLocalityAddressSplit'
import { proposePropertyRecord, type ParcelRecord, type ProposedPropertyRecord } from './propertyRecord'
import { pinHoldWords, type PinHold } from './parcelPinMatch'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Client side of the property lookup (v2.3004): invoke the `property-lookup`
 * edge function for an address, then fold the city→county table (curated +
 * org extras) into the proposal so every rung of the county ladder is on it.
 * A `pin_hold` (v2.6520) rides along: why the pin or the parcel was not this
 * lot, said on the panel by `propertyLookupHoldLine`.
 */

export type PropertyLookupOutcome =
  | { ok: true; proposal: ProposedPropertyRecord; parcel: ParcelRecord | null; parcelError: string | null; hold: PinHold | null }
  | { ok: false; error: string }

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

const HOLD_KINDS: ReadonlySet<string> = new Set(['street_unknown', 'number_unknown', 'situs_mismatch'])

/** The function's `pin_hold`: null when absent or of a kind this client does not know. */
function parseHold(raw: unknown): PinHold | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kind = str(o.kind)
  return HOLD_KINDS.has(kind) ? { kind: kind as PinHold['kind'], detail: str(o.detail) } : null
}

/** The hold said on the record panel, with the typed address's city when the splitter finds one. */
export function propertyLookupHoldLine(hold: PinHold, address: string): string {
  return pinHoldWords(hold, splitJobAddressForPrefill(address).city)
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
  return { ok: true, proposal, parcel, parcelError: str(o.parcel_error) || null, hold: parseHold(o.pin_hold) }
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
    return { ok: false, error: formatErrorMessage(e, 'request failed') }
  }
}
