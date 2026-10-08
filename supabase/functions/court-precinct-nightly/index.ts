import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { classifyCourtPoint, courtAreaFromRow, type CourtArea } from '../_shared/courtAreasClassify.ts'
import { geocodeWithGoogle } from '../_shared/googleGeocode.ts'
import { censusCountyFromPoint, geocodeWithCensus } from '../_shared/censusGeocode.ts'
import { inUsPointBox } from '../_shared/usPointBox.ts'

/**
 * Which court, step 4 (v2.4770): put every property record in its justice precinct
 * from the office's own court map (`court_areas`), using the point the geocode cache
 * already holds for its address. Runs nightly from pg_cron (migration
 * 20261007120000) and on demand from the Map page's *Classify now*.
 *
 * The rule: a record whose precinct was typed by hand (`jp_precinct_source = 'hand'`)
 * is never touched. Every other record with a point is classified against the active
 * areas; the row is written only when the precinct or the on-the-line note changed,
 * stamped `map` and now. A record outside every area keeps '' (and loses a stale
 * precinct when its area was removed). A record with no county takes the area's county
 * (`county_source = 'map'`, v2.4778). A record with a point outside every area and no
 * county takes the county the point sits in (`county_source = 'geocoder'`, v2.4790). Before
 * it classifies, it geocodes up to GEOCODE_PER_NIGHT addresses that have no point yet —
 * Google, else the Census — through the same cache the Map page and the job form use
 * (v2.4790), so the backlog of unplaced records drains by itself. The lookups stop at
 * LOOKUP_BUDGET_MS (v2.4824) and the run classifies with what it has; the rest wait for the next run.
 *
 * Auth: `X-Cron-Secret` = `CRON_SECRET`, or a signed-in office user (`is_office_staff()`
 * under the caller's JWT). Body: `{ dry_run?: boolean }`.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** The geocode cache's key, as owner-confirm-nightly and the Map page write it. */
function normalizeKey(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

const MAX_ROWS = 5000
const BATCH = 200
/** Addresses with no point that one night geocodes; the rest wait for the next night. */
const GEOCODE_PER_NIGHT = 300
/**
 * How long one run spends on outside lookups (the geocoder, the Census county) before it classifies with
 * what it has (v2.4824). A long backlog ran past the gateway, so Classify now saw a dropped connection
 * while the work finished unseen. What is left waits for the next run (`lookupsDeferred`).
 */
const LOOKUP_BUDGET_MS = 75_000

type AddressRow = { id: string; address: string | null; county: string | null; jp_precinct: string | null; jp_precinct_note: string | null; jp_precinct_source: string | null }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: { cron_secret?: unknown; dry_run?: unknown } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return jsonResponse({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)

  // Who may run it: the cron, or a signed-in office user.
  const cronSecret = Deno.env.get('CRON_SECRET')
  const given = req.headers.get('x-cron-secret') ?? (typeof body.cron_secret === 'string' ? body.cron_secret : null)
  let allowed = Boolean(cronSecret && given === cronSecret)
  if (!allowed) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth.toLowerCase().startsWith('bearer ') && anonKey) {
      const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
      const { data: office } = await asUser.rpc('is_office_staff')
      allowed = office === true
    }
  }
  if (!allowed) return jsonResponse({ error: 'Unauthorized' }, 401)
  const dryRun = body.dry_run === true
  const admin = createClient(supabaseUrl, serviceKey)

  const lookupsUntil = Date.now() + LOOKUP_BUDGET_MS
  try {
    const { data: areaRows, error: areaErr } = await admin.from('court_areas').select('id, county, precinct, label, polygon, source, source_note, active').eq('active', true)
    if (areaErr) return jsonResponse({ error: areaErr.message }, 500)
    const areas = ((areaRows ?? []) as Array<Parameters<typeof courtAreaFromRow>[0]>).map(courtAreaFromRow).filter((a): a is CourtArea => a !== null)

    const { data: rowsRaw, error: rowsErr } = await admin
      .from('customer_addresses')
      .select('id, address, county, jp_precinct, jp_precinct_note, jp_precinct_source')
      .neq('jp_precinct_source', 'hand')
      .limit(MAX_ROWS)
    if (rowsErr) return jsonResponse({ error: rowsErr.message }, 500)
    const rows = (rowsRaw ?? []) as AddressRow[]

    let placed = 0
    let outside = 0
    let onLine = 0
    let noPoint = 0
    let written = 0
    let geocoded = 0
    let geocodeMisses = 0
    let countyFilled = 0
    let lookupsDeferred = 0
    const now = new Date().toISOString()
    const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''

    // 1 · every point the cache holds for these addresses. One outside the lower 48 is a geocoder's wrong
    // answer and reads as none, so step 2 asks again and a good answer replaces it (v2.4975).
    const point = new Map<string, { lat: number; lng: number; county?: string }>()
    const keysAll = [...new Set(rows.map((r) => normalizeKey(r.address ?? '')).filter(Boolean))]
    for (let i = 0; i < keysAll.length; i += BATCH) {
      const { data: geo } = await admin.from('address_geocodes').select('address_normalized, lat, lng').in('address_normalized', keysAll.slice(i, i + BATCH))
      for (const g of (geo ?? []) as Array<{ address_normalized: string; lat: number | null; lng: number | null }>) {
        if (g.lat != null && g.lng != null && inUsPointBox(g.lat, g.lng)) point.set(g.address_normalized, { lat: g.lat, lng: g.lng })
      }
    }

    // 2 · up to GEOCODE_PER_NIGHT addresses with no point: Google, else the Census, into the cache (v2.4790).
    const unplaced = [...new Set(rows.map((r) => (r.address ?? '').trim().replace(/\s+/g, ' ')).filter((a) => a.length >= 8 && !point.has(normalizeKey(a))))].slice(0, GEOCODE_PER_NIGHT)
    for (const display of unplaced) {
      if (Date.now() > lookupsUntil) {
        lookupsDeferred += 1
        continue
      }
      const key = normalizeKey(display)
      let hit: { lat: number; lng: number; county?: string } | null = null
      if (googleKey) {
        const g = await geocodeWithGoogle(display, googleKey)
        if (g.ok) hit = { lat: g.lat, lng: g.lng, county: g.county }
      }
      if (!hit) {
        const c = await geocodeWithCensus(display)
        if (c.ok) hit = { lat: c.lat, lng: c.lng }
      }
      if (!hit) {
        geocodeMisses += 1
        continue
      }
      geocoded += 1
      point.set(key, hit)
      if (dryRun) continue
      const { error: geoErr } = await admin.from('address_geocodes').upsert({ address_normalized: key, lat: hit.lat, lng: hit.lng, geocoded_at: now, geocode_error: null }, { onConflict: 'address_normalized' })
      if (geoErr) console.error('court-precinct-nightly: cache write failed', key, geoErr.message)
    }

    // 3 · the classification, and the county for a record that has none.
    for (const r of rows) {
      const pt = point.get(normalizeKey(r.address ?? ''))
      if (!pt) {
        noPoint += 1
        continue
      }
      const hadCounty = Boolean((r.county ?? '').trim())
      const c = classifyCourtPoint(pt, areas, { county: (r.county ?? '').trim() || undefined })
      if (c.precinct) placed += 1
      else outside += 1
      if (c.onLine) onLine += 1
      const next = { jp_precinct: c.precinct, jp_precinct_note: c.note }
      // A record with no county: the area's county when it fell in one (v2.4778, the county's own line), else the
      // county the point sits in — Google's answer when it geocoded tonight, else the Census lookup (v2.4790).
      let fillCounty: { county: string; county_source: string } | null = null
      if (!hadCounty) {
        if (c.precinct) fillCounty = { county: c.county, county_source: 'map' }
        else if (pt.county?.trim()) fillCounty = { county: pt.county.trim(), county_source: 'geocoder' }
        else if (Date.now() > lookupsUntil) lookupsDeferred += 1
        else {
          const county = await censusCountyFromPoint(pt.lat, pt.lng)
          if (county) fillCounty = { county, county_source: 'geocoder' }
        }
      }
      if (fillCounty) countyFilled += 1
      if ((r.jp_precinct ?? '') === next.jp_precinct && (r.jp_precinct_note ?? '') === next.jp_precinct_note && !fillCounty) continue
      written += 1
      if (dryRun) continue
      const { error: upErr } = await admin.from('customer_addresses').update({ ...next, ...(fillCounty ?? {}), jp_precinct_source: c.precinct ? 'map' : '', jp_precinct_at: now }).eq('id', r.id)
      if (upErr) console.error('court-precinct-nightly: write failed', r.id, upErr.message)
    }
    const out = { ok: true, dryRun, areas: areas.length, rows: rows.length, placed, outside, onLine, noPoint, written, geocoded, geocodeMisses, countyFilled, lookupsDeferred }
    console.log('court-precinct-nightly', JSON.stringify(out))
    return jsonResponse(out)
  } catch (e) {
    console.error('court-precinct-nightly: unexpected', e)
    return jsonResponse({ error: 'The classification could not run.' }, 500)
  }
})
