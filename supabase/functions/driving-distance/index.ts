import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Driven distance — and, since v2.3764, the drive time — between two points via
 * the Google Routes API (routes.googleapis.com computeRoutes, DRIVE mode).
 * Used by the bid form's "Distance to Office" auto-fill and the clocked-in
 * map's "Travel times" button; the client falls back to a straight-line
 * estimate whenever this returns ok:false, so failures here degrade cleanly —
 * including GOOGLE_MAPS_API_KEY missing or the Routes API not being enabled.
 * `seconds` is absent when Google returns no duration; callers treat that as
 * "distance only".
 *
 * v2.3773: answers are cached in `public.driving_distance_cache` (service
 * role, keyed by the two points to five decimals, 30-day TTL) so a repeat ask
 * — the clocked-in map's Travel times on a second day, the same bid address
 * again — costs no Routes call. A cached answer carries `cached: true`. The
 * cache is best effort: an absent table or a failed write is a miss, never
 * an error.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type LatLngBody = { lat?: unknown; lng?: unknown }

function readLatLng(v: unknown): { lat: number; lng: number } | null {
  if (v == null || typeof v !== 'object') return null
  const o = v as LatLngBody
  const lat = o.lat
  const lng = o.lng
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) return null
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/** Thirty days: an address's drive to the office does not change week to week. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** `29.65300,-97.79700` — a point to about a metre, the cache key. */
function pointKey(p: { lat: number; lng: number }): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
}

/** `"1234s"` → 1234; null for anything else. */
function parseDurationSeconds(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const m = /^(\d+(?:\.\d+)?)s$/.exec(v.trim())
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
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
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profileErr) {
    return jsonResponse(500, { ok: false, error: 'role_load_failed' })
  }
  const role = (profile as { role: string } | null)?.role
  if (
    role !== 'dev' &&
    role !== 'master_technician' &&
    role !== 'assistant' &&
    role !== 'controller' &&
    role !== 'estimator'
  ) {
    return jsonResponse(403, {
      ok: false,
      error: 'forbidden',
      detail: 'Driving distance is restricted to dev, master_technician, assistant, controller, and estimator roles',
    })
  }

  let body: { origin?: unknown; destination?: unknown }
  try {
    body = (await req.json()) as { origin?: unknown; destination?: unknown }
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_json' })
  }
  const origin = readLatLng(body.origin)
  const destination = readLatLng(body.destination)
  if (!origin || !destination) {
    return jsonResponse(400, { ok: false, error: 'invalid_coordinates' })
  }

  // Cache first — a hit answers even when the Routes key is missing or the API is off.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = serviceKey.length > 0 ? createClient(supabaseUrl, serviceKey) : null
  const originKey = pointKey(origin)
  const destinationKey = pointKey(destination)
  if (admin) {
    try {
      const { data: hit } = await admin
        .from('driving_distance_cache')
        .select('distance_meters, duration_seconds, computed_at')
        .eq('origin_key', originKey)
        .eq('destination_key', destinationKey)
        .maybeSingle()
      if (hit && Date.now() - Date.parse(hit.computed_at) < CACHE_TTL_MS) {
        const cachedSeconds = typeof hit.duration_seconds === 'number' ? hit.duration_seconds : null
        return jsonResponse(200, cachedSeconds == null ? { ok: true, meters: hit.distance_meters, cached: true } : { ok: true, meters: hit.distance_meters, seconds: cachedSeconds, cached: true })
      }
    } catch {
      /* no table yet, or a read error: a miss */
    }
  }

  const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''
  if (googleKey.length === 0) {
    return jsonResponse(200, { ok: false, error: 'no_key' })
  }

  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: 'DRIVE',
      }),
    })
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500)
      return jsonResponse(200, { ok: false, error: 'routes_error', detail })
    }
    const data = (await res.json()) as { routes?: { distanceMeters?: number; duration?: string }[] }
    const route = data.routes?.[0]
    const meters = route?.distanceMeters
    if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) {
      return jsonResponse(200, { ok: false, error: 'no_route' })
    }
    // Google's Duration is a string like "1234s"; anything else is left out rather than guessed.
    const seconds = parseDurationSeconds(route?.duration)
    if (admin) {
      try {
        await admin
          .from('driving_distance_cache')
          .upsert(
            { origin_key: originKey, destination_key: destinationKey, distance_meters: Math.round(meters), duration_seconds: seconds, source: 'google_routes', computed_at: new Date().toISOString() },
            { onConflict: 'origin_key,destination_key' },
          )
      } catch {
        /* best effort: the answer still goes back; the next ask routes again */
      }
    }
    return jsonResponse(200, seconds == null ? { ok: true, meters } : { ok: true, meters, seconds })
  } catch (e) {
    return jsonResponse(200, { ok: false, error: 'routes_fetch_failed', detail: String(e).slice(0, 300) })
  }
})
