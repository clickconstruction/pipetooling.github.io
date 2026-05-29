import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Always return HTTP 200 with an { ok: false, error } envelope for "expected"
// failures (not found, non-CONUS, unconfigured) so the client can show a
// friendly message and fall back to manual entry instead of treating it as a
// hard network error.
function envelope(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type GsaMonth = { value?: number | string }
type GsaRate = {
  meals?: number | string
  city?: string
  county?: string
  state?: string
  months?: { month?: GsaMonth[] }
}
type GsaResponse = {
  rates?: Array<{
    oconusInfo?: unknown
    rate?: GsaRate[]
    state?: string
  }>
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
  const role = (profile as { role: string } | null)?.role
  if (role !== 'dev' && role !== 'master_technician' && role !== 'assistant' && role !== 'estimator') {
    return jsonResponse(403, {
      error: 'GSA per-diem lookup is restricted to dev, master_technician, assistant, and estimator roles',
    })
  }

  let body: { zip?: unknown; year?: unknown }
  try {
    body = (await req.json()) as { zip?: unknown; year?: unknown }
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' })
  }

  const zip = typeof body.zip === 'string' ? body.zip.trim() : ''
  if (!/^\d{5}$/.test(zip)) {
    return jsonResponse(400, { error: 'Expected zip: 5-digit string' })
  }
  const year =
    typeof body.year === 'number' && Number.isFinite(body.year)
      ? Math.trunc(body.year)
      : new Date().getFullYear()

  // 1. Cache hit?
  const { data: cached } = await supabase
    .from('gsa_per_diem_cache')
    .select('meals_rate, hotel_rate_max, city, county, state')
    .eq('zip', zip)
    .eq('year', year)
    .maybeSingle()
  if (cached) {
    return envelope({
      ok: true,
      meals_rate: (cached as { meals_rate: number | null }).meals_rate,
      hotel_rate: (cached as { hotel_rate_max: number | null }).hotel_rate_max,
      city: (cached as { city: string | null }).city,
      state: (cached as { state: string | null }).state,
      fromCache: true,
    })
  }

  // 2. Fetch from GSA.
  const apiKey = Deno.env.get('GSA_API_KEY')?.trim() ?? ''
  if (apiKey.length === 0) {
    return envelope({ ok: false, error: 'unconfigured', detail: 'GSA_API_KEY is not set for Edge Functions' })
  }

  const url = `https://api.gsa.gov/travel/perdiem/v2/rates/zip/${zip}/year/${year}?api_key=${encodeURIComponent(apiKey)}`
  let gsa: GsaResponse
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) {
      return envelope({ ok: false, error: 'upstream', detail: `GSA API returned ${r.status}` })
    }
    gsa = (await r.json()) as GsaResponse
  } catch (e) {
    return envelope({ ok: false, error: 'upstream', detail: String(e) })
  }

  const ratesEntry = gsa.rates?.[0]
  if (!ratesEntry) {
    return envelope({ ok: false, error: 'not_found' })
  }
  if (ratesEntry.oconusInfo != null) {
    return envelope({ ok: false, error: 'oconus' })
  }
  const rate = ratesEntry.rate?.[0]
  if (!rate) {
    return envelope({ ok: false, error: 'not_found' })
  }

  const mealsRate = rate.meals != null ? Number(rate.meals) : null
  const months = rate.months?.month ?? []
  const monthValues = months
    .map((m) => (m.value != null ? Number(m.value) : NaN))
    .filter((n) => Number.isFinite(n))
  const hotelRateMax = monthValues.length > 0 ? Math.max(...monthValues) : null

  const city = rate.city ?? null
  const county = rate.county ?? null
  const state = rate.state ?? ratesEntry.state ?? null

  // 3. Cache upsert (best-effort; ignore errors so a cache write failure
  //    doesn't block returning the freshly fetched rate).
  await supabase.from('gsa_per_diem_cache').upsert(
    {
      zip,
      year,
      meals_rate: mealsRate,
      hotel_rate_max: hotelRateMax,
      city,
      county,
      state,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'zip,year' }
  )

  return envelope({
    ok: true,
    meals_rate: mealsRate,
    hotel_rate: hotelRateMax,
    city,
    state,
    fromCache: false,
  })
})
