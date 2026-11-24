import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { geocodeWithGoogle, type GoogleGeocodeErrorCode } from '../_shared/googleGeocode.ts'
import { censusCountyFromPoint, geocodeWithCensus } from '../_shared/censusGeocode.ts'
import { inUsPointBox } from '../_shared/usPointBox.ts'
import {
  geocodeMissDetail,
  geocodeMissStands,
  geocodeServiceSaid,
  isSettledGeocodeMiss,
  type GeocodeMissRow,
  type GeocodeServiceSaid,
} from '../_shared/geocodeMissMemory.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MIN_KEY_LEN = 3

function normalizeKey(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** `county` (v2.4783): Google's answer, else the county the point sits in by the Census lookup; '' when neither knows. */
type OkCache = { ok: true; address_normalized: string; lat: number; lng: number; fromCache: true; source: 'cache'; county?: string }
type OkGeocode = {
  ok: true
  address_normalized: string
  lat: number
  lng: number
  fromCache: false
  source: 'google' | 'census'
  county?: string
  /** Present when `refresh_google_only` was used. */
  refreshed?: true
}
/** `remembered` and `checked_at` (punch list #408): the miss was answered from memory, and no service was asked. `checked_at` alone: a fresh miss that was just kept (v2.8484). */
type Fail = { ok: false; address_normalized: string; error: string; detail?: string; remembered?: true; checked_at?: string }

/**
 * The 200 answer; an ok one without a county asks the Census lookup for the point's (v2.4783).
 * v2.4878: it builds the Response itself. v2.4783 had it call itself, so every answer recursed
 * until the stack overflowed and Deno sent a 500 with no CORS header.
 */
async function answer(out: OkCache | OkGeocode | Fail): Promise<Response> {
  if (out.ok && !out.county) out.county = await censusCountyFromPoint(out.lat, out.lng)
  return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function googleErrorToClientCode(e: GoogleGeocodeErrorCode): string {
  if (e === 'not_found') return 'not_found'
  return e
}

async function upsertGeocode(
  supabase: SupabaseClient,
  key: string,
  lat: number,
  lng: number
) {
  return supabase.from('address_geocodes').upsert(
    {
      address_normalized: key,
      lat,
      lng,
      geocoded_at: new Date().toISOString(),
      geocode_error: null,
    },
    { onConflict: 'address_normalized' }
  )
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

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profileErr) {
    return jsonResponse(500, { error: 'Could not load user role' })
  }
  // The roles that may open /map — the client's `isPathAllowedForRole(role, '/map')`. The
  // controller acts as an assistant everywhere (v2.662); v2.4974 names it here too, so the job
  // form's *On the map* line and the Map page's Google refresh answer the controller as well.
  const mapGeocodeRole = (profile as { role: string } | null)?.role
  if (
    mapGeocodeRole !== 'dev' &&
    mapGeocodeRole !== 'master_technician' &&
    mapGeocodeRole !== 'assistant' &&
    mapGeocodeRole !== 'controller' &&
    mapGeocodeRole !== 'estimator'
  ) {
    return jsonResponse(403, {
      error: 'Map geocoding is restricted to dev, master_technician, assistant, controller, and estimator roles',
    })
  }

  let body: { address?: unknown; refresh_google_only?: unknown; retry?: unknown }
  try {
    body = (await req.json()) as { address?: unknown; refresh_google_only?: unknown; retry?: unknown }
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' })
  }

  if (typeof body.address !== 'string') {
    return jsonResponse(400, { error: 'Expected address: string' })
  }
  const display = body.address.trim()
  if (display.length < MIN_KEY_LEN) {
    return jsonResponse(400, { error: 'Address too short' })
  }
  const key = normalizeKey(display)
  const refreshGoogleOnly = body.refresh_google_only === true

  if (refreshGoogleOnly) {
    const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''
    if (googleKey.length === 0) {
      const out: Fail = {
        ok: false,
        address_normalized: key,
        error: 'google_unconfigured',
        detail: 'GOOGLE_MAPS_API_KEY is not set for Edge Functions',
      }
      return await answer(out)
    }
    const g = await geocodeWithGoogle(display, googleKey)
    if (g.ok) {
      const { error: upErr } = await upsertGeocode(supabase, key, g.lat, g.lng)
      if (upErr) {
        return jsonResponse(500, { error: upErr.message })
      }
      const out: OkGeocode = {
        ok: true,
        address_normalized: key,
        lat: g.lat,
        lng: g.lng,
        fromCache: false,
        source: 'google',
        county: g.county,
        refreshed: true,
      }
      return await answer(out)
    }
    const out: Fail = {
      ok: false,
      address_normalized: key,
      error: googleErrorToClientCode(g.error),
      ...(g.detail ? { detail: g.detail } : {}),
    }
    return await answer(out)
  }

  const { data: existing, error: exErr } = await supabase
    .from('address_geocodes')
    .select('lat, lng')
    .eq('address_normalized', key)
    .maybeSingle()
  if (exErr) {
    return jsonResponse(500, { error: exErr.message })
  }
  // A cached point outside the lower 48 reads as none, so it is asked again and a good answer replaces it (v2.4975).
  if (existing && inUsPointBox(existing.lat, existing.lng)) {
    const out: OkCache = {
      ok: true,
      address_normalized: key,
      lat: existing.lat,
      lng: existing.lng,
      fromCache: true,
      source: 'cache',
    }
    return await answer(out)
  }

  // A miss that still stands (punch list #408): Google and the Census both missed this address in the last
  // GEOCODE_MISS_STANDS_DAYS days, so it is answered from memory and none is asked. `retry: true`,
  // a person's press, asks past it. Best effort: a failed read asks as before.
  if (body.retry !== true) {
    const { data: missRow, error: missErr } = await supabase
      .from('address_geocode_misses')
      .select('address_normalized, error_code, detail, checked_at')
      .eq('address_normalized', key)
      .maybeSingle()
    if (missErr) console.warn(`geocode-one: the miss could not be read, asking as before: ${missErr.message}`)
    const miss = missRow as GeocodeMissRow | null
    if (!missErr && miss && geocodeMissStands(miss.checked_at, new Date())) {
      const out: Fail = {
        ok: false,
        address_normalized: key,
        error: miss.error_code,
        ...(miss.detail ? { detail: miss.detail } : {}),
        remembered: true,
        checked_at: miss.checked_at,
      }
      return await answer(out)
    }
  }

  const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''

  // Google is asked first, then the US Census (punch list #436). OpenStreetMap's lookup is no longer
  // asked: it turned every call from this function away. A miss is kept when Google and the Census
  // both said *not found* (punch list #408).
  let googleSaid: GeocodeServiceSaid = 'not_asked'

  let googleFail: Fail | null = null
  if (googleKey.length > 0) {
    const g = await geocodeWithGoogle(display, googleKey)
    if (g.ok) {
      const { error: upErr } = await upsertGeocode(supabase, key, g.lat, g.lng)
      if (upErr) {
        return jsonResponse(500, { error: upErr.message })
      }
      const out: OkGeocode = {
        ok: true,
        address_normalized: key,
        lat: g.lat,
        lng: g.lng,
        fromCache: false,
        source: 'google',
        county: g.county,
      }
      return await answer(out)
    }
    googleSaid = geocodeServiceSaid(g.error)
    googleFail = {
      ok: false,
      address_normalized: key,
      error: googleErrorToClientCode(g.error),
      ...(g.detail ? { detail: g.detail } : {}),
    }
  }

  // The second ask: the US Census geocoder (free, no key, US addresses only).
  const c = await geocodeWithCensus(display)
  if (c.ok) {
    const { error: upErr } = await upsertGeocode(supabase, key, c.lat, c.lng)
    if (upErr) {
      return jsonResponse(500, { error: upErr.message })
    }
    const out: OkGeocode = {
      ok: true,
      address_normalized: key,
      lat: c.lat,
      lng: c.lng,
      fromCache: false,
      source: 'census',
    }
    return await answer(out)
  }
  const missNote = c.error === 'census_upstream' ? `US Census: ${c.detail ?? 'service error'}` : (c.detail ?? 'no match from US Census')

  // Google and the Census both answered and neither found it: keep the miss, so the next ask is answered
  // from memory (punch list #408). Either of them down, refused or over its limit keeps nothing.
  // The keeping is best effort: a refused or failed write never changes the answer, and a miss that
  // was kept answers with the day.
  let keptAt: string | null = null
  if (isSettledGeocodeMiss({ google: googleSaid, census: geocodeServiceSaid(c.error) })) {
    const kept = googleFail?.detail ? `${googleFail.detail}; ${missNote}` : missNote
    const { error: missWriteErr } = await supabase
      .from('address_geocode_misses')
      .upsert({ address_normalized: key, error_code: 'not_found', detail: geocodeMissDetail(kept) }, { onConflict: 'address_normalized' })
    if (!missWriteErr) keptAt = new Date().toISOString()
    else if (missWriteErr.code !== '42501' && !/row-level security|read-only \(training\) mode/i.test(missWriteErr.message ?? '')) {
      console.warn(`geocode-one: the miss could not be kept: ${missWriteErr.message}`)
    }
  }
  const keptDay = keptAt ? { checked_at: keptAt } : {}

  // Keep the more actionable Google failure as the primary error; note the Census outcome in the detail.
  if (googleFail) {
    const out: Fail = {
      ...googleFail,
      detail: googleFail.detail ? `${googleFail.detail}; ${missNote}` : missNote,
      ...keptDay,
    }
    return await answer(out)
  }
  // Only reached with no Google key set: the Census alone was asked, and the answer says so.
  const out: Fail = {
    ok: false,
    address_normalized: key,
    error: c.error === 'census_upstream' ? 'census_upstream' : 'not_found',
    detail: `${missNote}; Google Geocoding is not configured`,
  }
  return await answer(out)
})
