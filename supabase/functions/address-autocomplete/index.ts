import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Address autocomplete for the Job form (v2.2338): proxies Google Places
 * Autocomplete (New) with the server-side GOOGLE_MAPS_API_KEY so no key ever
 * reaches the browser. Suggestions are biased to the company's service area
 * (a circle over San Antonio – New Braunfels – Seguin) and restricted to US
 * addresses. The client debounces; this function is a thin pass-through that
 * returns a lean suggestion list. 503 when the key is unset — the client
 * hides the dropdown and the field behaves like a plain input.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rough center of the service area; wide enough to cover Blanco to Seguin.
const BIAS_CENTER = { latitude: 29.55, longitude: -98.2 }
const BIAS_RADIUS_METERS = 80_000
const MAX_INPUT_LEN = 200

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type PlacesSuggestion = {
  placePrediction?: {
    text?: { text?: string }
    structuredFormat?: {
      mainText?: { text?: string; matches?: { endOffset?: number }[] }
      secondaryText?: { text?: string }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse(401, { error: 'Unauthorized' })

  // Validate the JWT in-body (getUser) — gateway verify_jwt has caused 401s
  // for legitimate browser sessions (see config.toml precedents).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) return jsonResponse(401, { error: 'Unauthorized' })

  const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''
  if (!googleKey) return jsonResponse(503, { error: 'Address autocomplete not configured' })

  let body: { input?: unknown }
  try {
    body = (await req.json()) as { input?: unknown }
  } catch {
    return jsonResponse(400, { error: 'Expected JSON body' })
  }
  const input = typeof body.input === 'string' ? body.input.trim().slice(0, MAX_INPUT_LEN) : ''
  if (input.length < 3) return jsonResponse(200, { suggestions: [] })

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': googleKey,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ['us'],
      locationBias: { circle: { center: BIAS_CENTER, radius: BIAS_RADIUS_METERS } },
    }),
  })
  if (!res.ok) {
    // Fail soft: the client treats any error as "no suggestions".
    return jsonResponse(502, { error: `Places upstream ${res.status}` })
  }
  const data = (await res.json()) as { suggestions?: PlacesSuggestion[] }
  const suggestions = (data.suggestions ?? [])
    .map((s) => {
      const p = s.placePrediction
      const main = p?.structuredFormat?.mainText?.text ?? ''
      if (!main) return null
      return {
        main,
        mainMatchEnd: p?.structuredFormat?.mainText?.matches?.[0]?.endOffset ?? 0,
        secondary: p?.structuredFormat?.secondaryText?.text ?? '',
        full: p?.text?.text ?? main,
      }
    })
    .filter((x) => x != null)
    .slice(0, 5)

  return jsonResponse(200, { suggestions })
})
