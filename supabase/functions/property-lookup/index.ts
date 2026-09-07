import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { geocodeWithGoogle } from '../_shared/googleGeocode.ts'
import { geocodeWithCensus } from '../_shared/censusGeocode.ts'
import { parseTxParcelIdentify, TX_PARCEL_IDENTIFY_URL, type ParcelRecord } from '../_shared/txParcelRecord.ts'

/**
 * property-lookup (customer properties train, PR 1 — v2.3004).
 *
 * One address in, the property's legal identity out: geocode the address
 * (cache → Google → US Census), then ask the Texas statewide parcel roll
 * (TxGIO, fed by the appraisal districts; public, keyless) which parcel sits
 * under the pin. Returns the parcel record (owner of record, legal
 * description, owner mailing address, county, source district, tax year)
 * plus the geocoder's county as the fallback rung when no parcel matches.
 * The client folds in the city→county table and builds the proposal
 * (`_shared/txParcelRecord.ts`).
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
const IDENTIFY_TIMEOUT_MS = 12_000
const ALLOWED_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller', 'estimator'])

function normalizeKey(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

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
}
type Fail = { ok: false; address_normalized: string; error: string; detail?: string }

async function identifyParcel(lat: number, lng: number): Promise<{ parcel: ParcelRecord | null; error?: string }> {
  const d = 0.0005
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    layers: 'all:0',
    tolerance: '2',
    mapExtent: `${lng - d},${lat - d},${lng + d},${lat + d}`,
    imageDisplay: '200,200,96',
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
  const key = normalizeKey(display)

  // Rung 0: the geocode cache the Map page already fills.
  let lat: number | null = null
  let lng: number | null = null
  let geocodeSource: Ok['geocode_source'] = 'cache'
  let countyGeocoder = ''
  const { data: cached } = await supabase
    .from('address_geocodes')
    .select('lat, lng')
    .eq('address_normalized', key)
    .maybeSingle()
  const c = cached as { lat: number; lng: number } | null
  if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
    lat = c.lat
    lng = c.lng
  }

  const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''
  let googleDetail: string | undefined
  if (lat == null || lng == null) {
    if (googleKey.length > 0) {
      const g = await geocodeWithGoogle(display, googleKey)
      if (g.ok) {
        lat = g.lat
        lng = g.lng
        countyGeocoder = g.county
        geocodeSource = 'google'
        await supabase.from('address_geocodes').upsert(
          { address_normalized: key, lat, lng, geocoded_at: new Date().toISOString(), geocode_error: null },
          { onConflict: 'address_normalized' },
        )
      } else {
        googleDetail = g.detail ? `Google: ${g.error} (${g.detail})` : `Google: ${g.error}`
      }
    }
  }
  if (lat == null || lng == null) {
    const cz = await geocodeWithCensus(display)
    if (cz.ok) {
      lat = cz.lat
      lng = cz.lng
      geocodeSource = 'census'
    }
  }
  if (lat == null || lng == null) {
    const out: Fail = {
      ok: false,
      address_normalized: key,
      error: 'not_found',
      detail: [googleDetail, 'no match from US Census'].filter(Boolean).join('; '),
    }
    return jsonResponse(200, out)
  }

  // Rung 1: the parcel under the pin.
  const ident = await identifyParcel(lat, lng)

  // Rung 2: when the parcel is missing and the point came from the cache or
  // Census, ask Google once for the county so the sheet still gets an answer.
  if (!ident.parcel && countyGeocoder === '' && googleKey.length > 0 && geocodeSource !== 'google') {
    const g = await geocodeWithGoogle(display, googleKey)
    if (g.ok) countyGeocoder = g.county
  }

  const out: Ok = {
    ok: true,
    address_normalized: key,
    lat,
    lng,
    geocode_source: geocodeSource,
    county_geocoder: countyGeocoder,
    parcel: ident.parcel,
    ...(ident.error ? { parcel_error: ident.error } : {}),
  }
  return jsonResponse(200, out)
})
