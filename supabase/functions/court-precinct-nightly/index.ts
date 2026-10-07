import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { classifyCourtPoint, courtAreaFromRow, type CourtArea } from '../_shared/courtAreasClassify.ts'

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
 * precinct when its area was removed). No point in the cache = skipped; the lookup
 * that fills the cache is owner-confirm-nightly's and the Map page's.
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
    const now = new Date().toISOString()
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH)
      const keys = slice.map((r) => normalizeKey(r.address ?? '')).filter(Boolean)
      const { data: geo } = await admin.from('address_geocodes').select('address_normalized, lat, lng').in('address_normalized', keys)
      const point = new Map<string, { lat: number; lng: number }>()
      for (const g of (geo ?? []) as Array<{ address_normalized: string; lat: number | null; lng: number | null }>) {
        if (g.lat != null && g.lng != null && Number.isFinite(g.lat) && Number.isFinite(g.lng)) point.set(g.address_normalized, { lat: g.lat, lng: g.lng })
      }
      for (const r of slice) {
        const pt = point.get(normalizeKey(r.address ?? ''))
        if (!pt) {
          noPoint += 1
          continue
        }
        const c = classifyCourtPoint(pt, areas, { county: (r.county ?? '').trim() || undefined })
        if (c.precinct) placed += 1
        else outside += 1
        if (c.onLine) onLine += 1
        const next = { jp_precinct: c.precinct, jp_precinct_note: c.note }
        if ((r.jp_precinct ?? '') === next.jp_precinct && (r.jp_precinct_note ?? '') === next.jp_precinct_note) continue
        written += 1
        if (dryRun) continue
        const { error: upErr } = await admin.from('customer_addresses').update({ ...next, jp_precinct_source: c.precinct ? 'map' : '', jp_precinct_at: now }).eq('id', r.id)
        if (upErr) console.error('court-precinct-nightly: write failed', r.id, upErr.message)
      }
    }
    const out = { ok: true, dryRun, areas: areas.length, rows: rows.length, placed, outside, onLine, noPoint, written }
    console.log('court-precinct-nightly', JSON.stringify(out))
    return jsonResponse(out)
  } catch (e) {
    console.error('court-precinct-nightly: unexpected', e)
    return jsonResponse({ error: 'The classification could not run.' }, 500)
  }
})
