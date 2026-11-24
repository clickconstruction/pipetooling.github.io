import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { geocodeWithGoogle } from '../_shared/googleGeocode.ts'
import { geocodeWithCensus } from '../_shared/censusGeocode.ts'
import { inUsPointBox } from '../_shared/usPointBox.ts'
import {
  geocodeMissDetail,
  geocodeServiceSaid,
  isSettledGeocodeMiss,
  rememberedGeocodeFailure,
  standingGeocodeMisses,
  type GeocodeMissRow,
  type GeocodeServiceSaid,
} from '../_shared/geocodeMissMemory.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ADDRESSES = 20
const MIN_KEY_LEN = 3

function normalizeKey(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

function appendDetail(base: string | undefined, extra: string): string {
  return base ? `${base}; ${extra}` : extra
}

/**
 * A cache write refused by RLS (42501) — a read-only (training-mode) user hits the
 * restrictive write-block policies. The coordinates are still good; return them
 * and skip the cache rather than fail the whole batch (v2.3131). The statement
 * trigger that holds a training account says so in words, with its own code, and
 * reads as the same refusal (punch list #408).
 */
function isRlsRefusal(err: { code?: string; message?: string }): boolean {
  return err.code === '42501' || /row-level security|read-only \(training\) mode/i.test(err.message ?? '')
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

  // v2.3131: every signed-in app user may geocode — the Dashboard "Your jobs on
  // a map" card resolves pins for every role. The gate is "has a users row with
  // a role and is not archived"; before, only the four Map-page roles passed.
  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('role, archived_at')
    .eq('id', user.id)
    .single()
  if (profileErr) {
    return jsonResponse(500, { error: 'Could not load user role' })
  }
  const geocodeProfile = profile as { role: string | null; archived_at: string | null } | null
  if (!geocodeProfile?.role || geocodeProfile.archived_at) {
    return jsonResponse(403, { error: 'Geocoding requires an active app account' })
  }

  let body: { addresses?: unknown; retry?: unknown }
  try {
    body = (await req.json()) as { addresses?: unknown; retry?: unknown }
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
  // `remembered` and `checked_at` (punch list #408) mark a miss answered from memory, with nothing asked.
  // `checked_at` alone marks a fresh miss that was just kept (v2.8484).
  const failures: { address_normalized: string; error_code: string; detail?: string; remembered?: true; checked_at?: string }[] = []
  const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''

  // The misses that still stand (punch list #408): an address Google and the Census both missed in the last
  // GEOCODE_MISS_STANDS_DAYS days is answered from here, and no service is asked. `retry: true`,
  // a person's Try again, asks past it. Best effort: a failed read asks as before.
  const retry = body.retry === true
  let remembered = new Map<string, GeocodeMissRow>()
  if (!retry && uniqueInput.length > 0) {
    const { data: missRows, error: missErr } = await supabase
      .from('address_geocode_misses')
      .select('address_normalized, error_code, detail, checked_at')
      .in(
        'address_normalized',
        uniqueInput.map((u) => u.key)
      )
    if (missErr) console.warn(`geocode-address-batch: the misses could not be read, asking as before: ${missErr.message}`)
    else remembered = standingGeocodeMisses((missRows ?? []) as GeocodeMissRow[], new Date())
  }
  for (let i = 0; i < uniqueInput.length; i++) {
    const { key, display } = uniqueInput[i]!
    let failure: { error_code: string; detail?: string } | null = null
    // What each service said. A miss is kept when Google and the Census both said *not found*.
    let googleSaid: GeocodeServiceSaid = 'not_asked'

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
      results.push({ address_normalized: key, lat: existing.lat, lng: existing.lng })
      continue
    }

    const stands = remembered.get(key)
    if (stands) {
      failures.push(rememberedGeocodeFailure(stands))
      continue
    }

    // Google is asked first, then the US Census (punch list #436). OpenStreetMap's lookup is no longer
    // asked: it turned every call from this function away, and each address waited on it for nothing.
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
        if (upErr && !isRlsRefusal(upErr)) {
          return jsonResponse(500, { error: upErr.message })
        }
        results.push({ address_normalized: key, lat: g.lat, lng: g.lng })
        continue
      }
      googleSaid = geocodeServiceSaid(g.error)
      failure = g.error === 'not_found' && !g.detail ? { error_code: 'not_found', detail: 'No match from Google' } : { error_code: g.error, detail: g.detail }
    }

    // The second ask: the US Census geocoder (free, no key, US addresses only).
    let c: Awaited<ReturnType<typeof geocodeWithCensus>>
    try {
      c = await geocodeWithCensus(display)
    } catch {
      c = { ok: false, error: 'census_upstream', detail: 'US Census geocoder request failed' }
    }
    if (c.ok) {
      const { error: upErr } = await supabase.from('address_geocodes').upsert(
        {
          address_normalized: key,
          lat: c.lat,
          lng: c.lng,
          geocoded_at: new Date().toISOString(),
          geocode_error: null,
        },
        { onConflict: 'address_normalized' }
      )
      if (upErr && !isRlsRefusal(upErr)) {
        return jsonResponse(500, { error: upErr.message })
      }
      results.push({ address_normalized: key, lat: c.lat, lng: c.lng })
      continue
    }
    // Keep the earlier (more actionable) failure code; note the Census outcome in the detail.
    if (failure) {
      failure = {
        ...failure,
        detail: appendDetail(
          failure.detail,
          c.error === 'census_upstream' ? `US Census: ${c.detail ?? 'service error'}` : (c.detail ?? 'no match from US Census')
        ),
      }
    } else {
      failure =
        c.error === 'census_upstream'
          ? { error_code: 'census_upstream', detail: c.detail }
          : { error_code: 'not_found', detail: c.detail ?? 'No match from US Census' }
      // Only reached with no Google key set: say so, since the Census alone was asked.
      failure = { ...failure, detail: appendDetail(failure.detail, 'Google Geocoding is not configured') }
    }

    // Google and the Census both answered and neither found it: keep the miss, so the next open does not
    // ask again (punch list #408). Either of them down, refused or over its limit keeps nothing.
    // The keeping is best effort: a refused or failed write never fails the batch. A miss that was
    // kept answers with the day, so the caller can tell it from one that was not.
    let keptAt: string | null = null
    if (isSettledGeocodeMiss({ google: googleSaid, census: geocodeServiceSaid(c.error) })) {
      const { error: missWriteErr } = await supabase
        .from('address_geocode_misses')
        .upsert({ address_normalized: key, error_code: 'not_found', detail: geocodeMissDetail(failure.detail) }, { onConflict: 'address_normalized' })
      if (!missWriteErr) keptAt = new Date().toISOString()
      else if (!isRlsRefusal(missWriteErr)) {
        console.warn(`geocode-address-batch: the miss could not be kept: ${missWriteErr.message}`)
      }
    }

    failures.push({ address_normalized: key, ...failure, ...(keptAt ? { checked_at: keptAt } : {}) })
  }

  return new Response(JSON.stringify({ results, failures }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
