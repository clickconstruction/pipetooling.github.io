import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { geocodeWithGoogle, type GoogleGeocodeErrorCode } from '../_shared/googleGeocode.ts'
import { geocodeWithCensus } from '../_shared/censusGeocode.ts'

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

type NominatimHit = { lat: string; lon: string }

type OkCache = { ok: true; address_normalized: string; lat: number; lng: number; fromCache: true; source: 'cache' }
type OkGeocode = {
  ok: true
  address_normalized: string
  lat: number
  lng: number
  fromCache: false
  source: 'nominatim' | 'google' | 'census'
  /** Present when `refresh_google_only` was used. */
  refreshed?: true
}
type Fail = { ok: false; address_normalized: string; error: string; detail?: string }

function googleErrorToClientCode(e: GoogleGeocodeErrorCode): string {
  if (e === 'not_found') return 'not_found'
  return e
}

async function upsertGeocode(
  supabase: ReturnType<typeof createClient>,
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
  const mapGeocodeRole = (profile as { role: string } | null)?.role
  if (
    mapGeocodeRole !== 'dev' &&
    mapGeocodeRole !== 'master_technician' &&
    mapGeocodeRole !== 'assistant' &&
    mapGeocodeRole !== 'estimator'
  ) {
    return jsonResponse(403, {
      error: 'Map geocoding is restricted to dev, master_technician, assistant, and estimator roles',
    })
  }

  let body: { address?: unknown; refresh_google_only?: unknown }
  try {
    body = (await req.json()) as { address?: unknown; refresh_google_only?: unknown }
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
      return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
        refreshed: true,
      }
      return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const out: Fail = {
      ok: false,
      address_normalized: key,
      error: googleErrorToClientCode(g.error),
      ...(g.detail ? { detail: g.detail } : {}),
    }
    return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { data: existing, error: exErr } = await supabase
    .from('address_geocodes')
    .select('lat, lng')
    .eq('address_normalized', key)
    .maybeSingle()
  if (exErr) {
    return jsonResponse(500, { error: exErr.message })
  }
  if (existing) {
    const out: OkCache = {
      ok: true,
      address_normalized: key,
      lat: existing.lat,
      lng: existing.lng,
      fromCache: true,
      source: 'cache',
    }
    return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(display)}&limit=1&addressdetails=0`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'PipeTooling/1.0 (https://github.com/Click-Construction; map page geocode-one)' },
  })
  if (r.ok) {
    const arr = (await r.json()) as NominatimHit[]
    if (Array.isArray(arr) && arr.length > 0) {
      const lat = parseFloat(arr[0]!.lat)
      const lng = parseFloat(arr[0]!.lon)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const { error: upErr } = await upsertGeocode(supabase, key, lat, lng)
        if (upErr) {
          return jsonResponse(500, { error: upErr.message })
        }
        const out: OkGeocode = {
          ok: true,
          address_normalized: key,
          lat,
          lng,
          fromCache: false,
          source: 'nominatim',
        }
        return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }
  }

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
      }
      return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    googleFail = {
      ok: false,
      address_normalized: key,
      error: googleErrorToClientCode(g.error),
      ...(g.detail ? { detail: g.detail } : {}),
    }
  }

  // Third-tier fallback: US Census geocoder (free, no key, US addresses only).
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
    return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const censusNote = c.error === 'census_upstream' ? `US Census: ${c.detail ?? 'service error'}` : 'no match from US Census'

  // Keep the more actionable Google failure as the primary error; note the Census outcome in the detail.
  if (googleFail) {
    const out: Fail = {
      ...googleFail,
      detail: googleFail.detail ? `${googleFail.detail}; ${censusNote}` : censusNote,
    }
    return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  if (!r.ok) {
    const out: Fail = { ok: false, address_normalized: key, error: 'upstream', detail: censusNote }
    return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const out: Fail = { ok: false, address_normalized: key, error: 'not_found', detail: censusNote }
  return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
