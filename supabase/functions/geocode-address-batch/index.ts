import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { geocodeWithGoogle } from '../_shared/googleGeocode.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ADDRESSES = 20
const NOMINATIM_DELAY_MS = 1100
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

  let body: { addresses?: unknown }
  try {
    body = (await req.json()) as { addresses?: unknown }
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' })
  }

  const raw = body.addresses
  if (!Array.isArray(raw)) {
    return jsonResponse(400, { error: 'Expected addresses: string[]' })
  }
  if (raw.length > MAX_ADDRESSES) {
    return jsonResponse(400, { error: `At most ${MAX_ADDRESSES} addresses per request` })
  }

  const seen = new Set<string>()
  const uniqueInput: { key: string; display: string }[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const display = item.trim()
    if (display.length < MIN_KEY_LEN) continue
    const key = normalizeKey(display)
    if (seen.has(key)) continue
    seen.add(key)
    uniqueInput.push({ key, display })
  }

  const results: { address_normalized: string; lat: number; lng: number }[] = []
  // Per-address failure reasons; error_code values match mapGeocodeErrorMessage on the client.
  const failures: { address_normalized: string; error_code: string; detail?: string }[] = []
  const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''

  for (let i = 0; i < uniqueInput.length; i++) {
    const { key, display } = uniqueInput[i]!
    let failure: { error_code: string; detail?: string } | null = null

    const { data: existing, error: exErr } = await supabase
      .from('address_geocodes')
      .select('lat, lng')
      .eq('address_normalized', key)
      .maybeSingle()
    if (exErr) {
      return jsonResponse(500, { error: exErr.message })
    }
    if (existing) {
      results.push({ address_normalized: key, lat: existing.lat, lng: existing.lng })
      continue
    }

    if (i > 0) {
      await new Promise((r) => setTimeout(r, NOMINATIM_DELAY_MS))
    }

    let lat: number | null = null
    let lng: number | null = null

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(display)}&limit=1&addressdetails=0`
    try {
      const nRes = await fetch(url, {
        headers: { 'User-Agent': 'PipeTooling/1.0 (https://github.com/Click-Construction; map page geocode)' },
      })
      if (nRes.ok) {
        const arr = (await nRes.json()) as NominatimHit[]
        if (Array.isArray(arr) && arr.length > 0) {
          const la = parseFloat(arr[0]!.lat)
          const lo = parseFloat(arr[0]!.lon)
          if (Number.isFinite(la) && Number.isFinite(lo)) {
            lat = la
            lng = lo
          } else {
            failure = { error_code: 'invalid_coordinates', detail: 'OpenStreetMap returned unusable coordinates' }
          }
        } else {
          failure = { error_code: 'not_found', detail: 'No match from OpenStreetMap' }
        }
      } else {
        failure = { error_code: 'upstream', detail: `OpenStreetMap (Nominatim) HTTP ${nRes.status}` }
      }
    } catch {
      failure = { error_code: 'upstream', detail: 'OpenStreetMap (Nominatim) request failed' }
    }

    if (lat !== null && lng !== null) {
      const { error: upErr } = await supabase.from('address_geocodes').upsert(
        {
          address_normalized: key,
          lat,
          lng,
          geocoded_at: new Date().toISOString(),
          geocode_error: null,
        },
        { onConflict: 'address_normalized' }
      )
      if (upErr) {
        return jsonResponse(500, { error: upErr.message })
      }
      results.push({ address_normalized: key, lat, lng })
      continue
    }

    if (googleKey.length > 0) {
      let g: Awaited<ReturnType<typeof geocodeWithGoogle>>
      try {
        g = await geocodeWithGoogle(display, googleKey)
      } catch {
        g = { ok: false, error: 'google_upstream', detail: 'Google Geocoding request failed' }
      }
      if (g.ok) {
        const { error: upErr } = await supabase.from('address_geocodes').upsert(
          {
            address_normalized: key,
            lat: g.lat,
            lng: g.lng,
            geocoded_at: new Date().toISOString(),
            geocode_error: null,
          },
          { onConflict: 'address_normalized' }
        )
        if (upErr) {
          return jsonResponse(500, { error: upErr.message })
        }
        results.push({ address_normalized: key, lat: g.lat, lng: g.lng })
        continue
      }
      failure =
        g.error === 'not_found' && !g.detail
          ? { error_code: 'not_found', detail: 'No match from OpenStreetMap or Google' }
          : { error_code: g.error, detail: g.detail }
    } else if (failure) {
      failure = {
        ...failure,
        detail: failure.detail ? `${failure.detail}; Google fallback not configured` : 'Google fallback not configured',
      }
    }

    failures.push({ address_normalized: key, ...(failure ?? { error_code: 'not_found' }) })
  }

  return new Response(JSON.stringify({ results, failures }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
