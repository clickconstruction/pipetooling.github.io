import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Routed drive times between consecutive scheduled jobs (Day-view travel
 * hints, Option B). Reads/fills the job_travel_times cache; misses go to the
 * Google Routes computeRouteMatrix API. Every failure path returns partial
 * results — the client ALWAYS falls back to its straight-line estimate for
 * any pair missing from `results`, so this function failing (no key, API
 * disabled, quota) degrades to Option A, never breaks the page.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_PAIRS = 25
/** Cached rows older than this are refreshed (roads change rarely; addresses almost never). */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type PairIn = {
  fromJobId: string
  toJobId: string
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
}

type PairOut = {
  fromJobId: string
  toJobId: string
  seconds: number
  meters: number
  source: string
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
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return jsonResponse(401, { error: 'Unauthorized' })
  }

  const { data: profile, error: profileErr } = await userClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profileErr) {
    return jsonResponse(500, { error: 'Could not load user role' })
  }
  const role = (profile as { role: string } | null)?.role ?? ''
  const allowed = new Set([
    'dev',
    'master_technician',
    'assistant',
    'controller',
    'superintendent',
    'estimator',
  ])
  if (!allowed.has(role)) {
    return jsonResponse(403, { error: 'Travel times are restricted to scheduling roles' })
  }

  let body: { pairs?: unknown }
  try {
    body = (await req.json()) as { pairs?: unknown }
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' })
  }
  const rawPairs = Array.isArray(body.pairs) ? (body.pairs as PairIn[]) : []
  const pairs = rawPairs
    .filter(
      (p) =>
        p &&
        typeof p.fromJobId === 'string' &&
        typeof p.toJobId === 'string' &&
        p.fromJobId !== p.toJobId &&
        Number.isFinite(p.from?.lat) &&
        Number.isFinite(p.from?.lng) &&
        Number.isFinite(p.to?.lat) &&
        Number.isFinite(p.to?.lng),
    )
    .slice(0, MAX_PAIRS)
  if (pairs.length === 0) {
    return jsonResponse(200, { results: [] })
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = createClient(supabaseUrl, serviceKey)

  // 1. Cache lookup (fetch by from-ids, filter pairs in memory — pair count is tiny).
  const results: PairOut[] = []
  const misses: PairIn[] = []
  try {
    const fromIds = [...new Set(pairs.map((p) => p.fromJobId))]
    const { data: cached } = await admin
      .from('job_travel_times')
      .select('from_job_id, to_job_id, duration_seconds, distance_meters, source, computed_at')
      .in('from_job_id', fromIds)
    const cacheMap = new Map<string, { s: number; m: number; src: string; at: number }>()
    for (const r of cached ?? []) {
      cacheMap.set(`${r.from_job_id}|${r.to_job_id}`, {
        s: r.duration_seconds,
        m: r.distance_meters,
        src: r.source,
        at: Date.parse(r.computed_at),
      })
    }
    const now = Date.now()
    for (const p of pairs) {
      const hit = cacheMap.get(`${p.fromJobId}|${p.toJobId}`)
      if (hit && now - hit.at < CACHE_TTL_MS) {
        results.push({ fromJobId: p.fromJobId, toJobId: p.toJobId, seconds: hit.s, meters: hit.m, source: hit.src })
      } else {
        misses.push(p)
      }
    }
  } catch {
    misses.push(...pairs.filter((p) => !results.some((r) => r.fromJobId === p.fromJobId && r.toJobId === p.toJobId)))
  }

  // 2. Route the misses via Google Routes computeRouteMatrix.
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? ''
  if (misses.length > 0 && apiKey) {
    try {
      const waypoint = (c: { lat: number; lng: number }) => ({
        waypoint: { location: { latLng: { latitude: c.lat, longitude: c.lng } } },
      })
      const resp = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
        },
        body: JSON.stringify({
          origins: misses.map((p) => waypoint(p.from)),
          destinations: misses.map((p) => waypoint(p.to)),
          travelMode: 'DRIVE',
        }),
      })
      if (resp.ok) {
        const elements = (await resp.json()) as Array<{
          originIndex?: number
          destinationIndex?: number
          duration?: string
          distanceMeters?: number
          condition?: string
        }>
        const upserts: Array<Record<string, unknown>> = []
        for (const el of Array.isArray(elements) ? elements : []) {
          // We only need the diagonal: pair i is (origins[i] -> destinations[i]).
          if (el.originIndex == null || el.originIndex !== el.destinationIndex) continue
          const p = misses[el.originIndex]
          if (!p || el.condition !== 'ROUTE_EXISTS') continue
          const seconds = Math.round(Number(String(el.duration ?? '0s').replace(/s$/, '')))
          const meters = Math.round(Number(el.distanceMeters ?? 0))
          if (!Number.isFinite(seconds) || seconds <= 0) continue
          results.push({ fromJobId: p.fromJobId, toJobId: p.toJobId, seconds, meters, source: 'google_routes' })
          upserts.push({
            from_job_id: p.fromJobId,
            to_job_id: p.toJobId,
            duration_seconds: seconds,
            distance_meters: meters,
            source: 'google_routes',
            computed_at: new Date().toISOString(),
          })
        }
        if (upserts.length > 0) {
          await admin.from('job_travel_times').upsert(upserts, { onConflict: 'from_job_id,to_job_id' })
        }
      }
    } catch {
      // Routing unavailable — client falls back to straight-line for the missing pairs.
    }
  }

  return jsonResponse(200, { results })
})
