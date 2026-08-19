import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Driven distance between two points via the Google Routes API
 * (routes.googleapis.com computeRoutes, DRIVE mode). Used by the bid form's
 * "Distance to Office" auto-fill; the client falls back to a straight-line
 * estimate whenever this returns ok:false, so failures here degrade cleanly —
 * including GOOGLE_MAPS_API_KEY missing or the Routes API not being enabled.
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
        'X-Goog-FieldMask': 'routes.distanceMeters',
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
    const data = (await res.json()) as { routes?: { distanceMeters?: number }[] }
    const meters = data.routes?.[0]?.distanceMeters
    if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) {
      return jsonResponse(200, { ok: false, error: 'no_route' })
    }
    return jsonResponse(200, { ok: true, meters })
  } catch (e) {
    return jsonResponse(200, { ok: false, error: 'routes_fetch_failed', detail: String(e).slice(0, 300) })
  }
})
