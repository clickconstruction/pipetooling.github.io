import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_LOCATION_LEN = 500

type StreetViewMetaJson = {
  status?: string
  location?: { lat?: number; lng?: number }
  error_message?: string
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'GET') {
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

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim()
  if (!apiKey) {
    return jsonResponse(503, { error: 'Street View not configured' })
  }

  try {
    const url = new URL(req.url)
    let location = url.searchParams.get('location')?.trim() ?? ''
    if (!location) {
      return jsonResponse(400, { error: 'Missing location' })
    }
    if (location.length > MAX_LOCATION_LEN) {
      return jsonResponse(400, { error: 'Location too long' })
    }

    const wantMeta = url.searchParams.get('meta') === '1'

    if (wantMeta) {
      const metaUrl =
        `https://maps.googleapis.com/maps/api/streetview/metadata?location=${
          encodeURIComponent(location)
        }&key=${encodeURIComponent(apiKey)}`
      const metaRes = await fetch(metaUrl)
      if (!metaRes.ok) {
        return jsonResponse(502, { error: 'Street View metadata request failed' })
      }
      const meta = (await metaRes.json()) as StreetViewMetaJson
      if (meta.status !== 'OK') {
        // 200 so the browser does not log 404 like a missing Edge route; client hides preview.
        return new Response(
          JSON.stringify({
            ok: false as const,
            googleStatus: typeof meta.status === 'string' ? meta.status : 'UNKNOWN',
            detail: typeof meta.error_message === 'string' ? meta.error_message : undefined,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const lat = meta.location?.lat
      const lng = meta.location?.lng
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return new Response(
          JSON.stringify({ ok: false as const, googleStatus: 'INVALID_LOCATION' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({ ok: true as const, lat, lng }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const imageUrl =
      `https://maps.googleapis.com/maps/api/streetview?size=640x320&location=${
        encodeURIComponent(location)
      }&fov=80&pitch=0&key=${encodeURIComponent(apiKey)}`
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      return jsonResponse(502, { error: 'Street View image request failed' })
    }
    const contentType = imgRes.headers.get('Content-Type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return jsonResponse(502, { error: 'Unexpected Street View response' })
    }
    const buf = await imgRes.arrayBuffer()
    if (buf.byteLength === 0) {
      return jsonResponse(502, { error: 'Empty Street View image' })
    }
    return new Response(buf, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': contentType },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return jsonResponse(500, { error: msg })
  }
})
