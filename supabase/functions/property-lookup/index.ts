import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { geocodeWithGoogle } from '../_shared/googleGeocode.ts'
import { geocodeWithCensus } from '../_shared/censusGeocode.ts'
import type { ParcelRecord } from '../_shared/txParcelRecord.ts'
import { identifyParcel } from '../_shared/txParcelIdentify.ts'
import { lookupParcelForAddress } from '../_shared/parcelPinLookup.ts'
import type { PinHold } from '../_shared/parcelPinMatch.ts'

/**
 * property-lookup (customer properties train, PR 1 — v2.3004).
 *
 * One address in, the property's legal identity out: geocode the address
 * (Google first, since only Google says how well it placed it; then the
 * cache and the US Census), then ask the Texas statewide parcel roll
 * (TxGIO, fed by the appraisal districts; public, keyless) which parcel sits
 * under the pin. Returns the parcel record (owner of record, legal
 * description, owner mailing address, county, source district, tax year)
 * plus the geocoder's county as the fallback rung when no parcel matches.
 * A pin Google could not put on the lot, or a parcel whose own address names
 * another lot, is held (`pin_hold`, v2.6520) and no parcel is returned: a
 * street the map lacks used to come back with whatever parcel sat at the
 * city's pin. The ladder is `_shared/parcelPinLookup.ts`, shared with
 * `owner-confirm-nightly`. The client folds in the city→county table and
 * builds the proposal (`_shared/txParcelRecord.ts`).
 *
 * Auth: in-function `auth.getUser()` + role gate mirroring who may edit
 * `customer_addresses` (dev, master_technician, assistant, controller,
 * estimator). Gateway `verify_jwt = false` like geocode-one.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MIN_ADDRESS_LEN = 5
const ALLOWED_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller', 'estimator'])

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Ok = {
  ok: true
  address_normalized: string
  lat: number
  lng: number
  geocode_source: 'cache' | 'google' | 'census'
  /** County from the geocoder ('' when the point came from the cache or Census). */
  county_geocoder: string
  parcel: ParcelRecord | null
  /** Set when the parcel service failed (the county rung still answered). */
  parcel_error?: string
  /** Why the pin or the parcel was not trusted (v2.6520); `parcel` is null with it and the county rung still answers. */
  pin_hold?: PinHold
}
type Fail = { ok: false; address_normalized: string; error: string; detail?: string }

// The parcel identify (tolerance ladder, timeout) lives in `_shared/txParcelIdentify.ts`
// since v2.3450 so the nightly `owner-confirm-nightly` function asks the same way.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'Unauthorized' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    return jsonResponse(401, { error: 'Unauthorized' })
  }

  const { data: profile, error: profileErr } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profileErr) {
    return jsonResponse(500, { error: 'Could not load user role' })
  }
  const role = (profile as { role: string } | null)?.role ?? ''
  if (!ALLOWED_ROLES.has(role)) {
    return jsonResponse(403, { error: 'Property lookup is restricted to office roles and estimators' })
  }

  let body: { address?: unknown }
  try {
    body = (await req.json()) as { address?: unknown }
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }
  const display = typeof body.address === 'string' ? body.address.trim().replace(/\s+/g, ' ') : ''
  if (display.length < MIN_ADDRESS_LEN) {
    return jsonResponse(400, { error: `address must be at least ${MIN_ADDRESS_LEN} characters` })
  }
  const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''

  // The ladder (v2.6520): Google first, then the geocode cache the Map page
  // already fills, then the Census; the parcel under the pin; the county rung
  // when the roll has nothing. A held pin or parcel comes back as `pin_hold`.
  const res = await lookupParcelForAddress(display, {
    readCachedPoint: async (key) => {
      const { data } = await supabase.from('address_geocodes').select('lat, lng').eq('address_normalized', key).maybeSingle()
      return (data as { lat: number; lng: number } | null) ?? null
    },
    writeCachedPoint: async (key, lat, lng) => {
      await supabase.from('address_geocodes').upsert(
        { address_normalized: key, lat, lng, geocoded_at: new Date().toISOString(), geocode_error: null },
        { onConflict: 'address_normalized' },
      )
    },
    geocodeGoogle: googleKey.length > 0 ? (a) => geocodeWithGoogle(a, googleKey) : null,
    geocodeCensus: geocodeWithCensus,
    identify: identifyParcel,
    countyFromGoogleWhenNoParcel: true,
  })
  if (!res.ok) {
    const out: Fail = { ok: false, address_normalized: res.key, error: res.error, detail: res.detail }
    return jsonResponse(200, out)
  }
  const out: Ok = {
    ok: true,
    address_normalized: res.key,
    lat: res.lat,
    lng: res.lng,
    geocode_source: res.pinSource,
    county_geocoder: res.countyGeocoder,
    parcel: res.parcel,
    ...(res.parcelError ? { parcel_error: res.parcelError } : {}),
    ...(res.hold ? { pin_hold: res.hold } : {}),
  }
  return jsonResponse(200, out)
})
