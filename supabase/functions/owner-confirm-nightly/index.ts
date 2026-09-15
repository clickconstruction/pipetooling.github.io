import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { geocodeWithGoogle } from '../_shared/googleGeocode.ts'
import { geocodeWithCensus } from '../_shared/censusGeocode.ts'
import { identifyParcel } from '../_shared/txParcelIdentify.ts'
import { applyProposalToFields, proposePropertyRecord, type ParcelRecord, type PropertyRecordFields } from '../_shared/txParcelRecord.ts'
import { ownerConfirmPropertyKey, planOwnerConfirmWrites, type OwnerConfirmPlanJob } from '../_shared/ownerConfirmPlan.ts'

/**
 * owner-confirm-nightly (owner of record, PR 3 — v2.3450; decision 5).
 *
 * Every night pg_cron calls this with X-Cron-Secret. When Settings → Jobs &
 * billing → "Save owners from the appraisal roll automatically" is on, every
 * row of `list_jobs_owner_to_confirm()` with NO owner at all (`has_owner`
 * false — a GC job with approved hours whose property record names nobody)
 * is looked up on the statewide parcel roll the way `property-lookup` does
 * (geocode cache → Google → Census, then the parcel under the pin) and the
 * roll's answer is written exactly as a person's Use would write it
 * (`planOwnerConfirmWrites` — the shared kernel: fill-blanks on a linked
 * record, else one new row per home linking every job at the property) —
 * EXCEPT that `owner_confirmed_at` stays NULL: the record reads *from the
 * roll · unconfirmed*, the Lien desk drafts on it and shows the provenance,
 * and Record the run refuses until a person presses Confirm. Rows that
 * already carry an owner (typed, or saved by an earlier night) are never
 * touched. Public owners are saved too — the desk reads them and refuses to
 * draft (bond claim). One summary line is logged per run.
 *
 * Body: `{}`; `{ "dry_run": true }` looks everything up and writes nothing.
 * Auth: `X-Cron-Secret` (or `cron_secret` in the body) = `CRON_SECRET`;
 * gateway `verify_jwt = false`. Secrets: `SUPABASE_URL`,
 * `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, optional `GOOGLE_MAPS_API_KEY`.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const SETTING_KEY = 'owner_auto_confirm_from_roll_v1'
/** Properties looked up per night, earliest notice deadline first (the RPC's order); the rest wait for tomorrow. */
const MAX_PROPERTIES = 40
const MIN_ADDRESS_LEN = 5

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type ConfirmRow = {
  job_id: string
  job_address: string | null
  customer_id: string | null
  gc_customer_id: string | null
  customer_address_id: string | null
  has_owner: boolean
}

type Property = { key: string; address: string; jobs: OwnerConfirmPlanJob[] }

const EMPTY_FIELDS: PropertyRecordFields = {
  county: '',
  county_source: '',
  legal_description: '',
  property_kind: '',
  homestead: false,
  owner_mode: '',
  owner_name: '',
  owner_company: '',
  owner_mailing_address: '',
  parcel_id: '',
  parcel_source: '',
  parcel_tax_year: '',
}
const RECORD_KEYS = Object.keys(EMPTY_FIELDS) as (keyof PropertyRecordFields)[]

function fieldsOf(row: Record<string, unknown>): PropertyRecordFields {
  const s = (k: string) => (typeof row[k] === 'string' ? (row[k] as string) : '')
  return { ...EMPTY_FIELDS, county: s('county'), county_source: s('county_source'), legal_description: s('legal_description'), property_kind: s('property_kind'), homestead: row.homestead === true, owner_mode: s('owner_mode'), owner_name: s('owner_name'), owner_company: s('owner_company'), owner_mailing_address: s('owner_mailing_address'), parcel_id: s('parcel_id'), parcel_source: s('parcel_source'), parcel_tax_year: s('parcel_tax_year') }
}

function normalizeKey(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** The property-lookup ladder, server-side: the geocode cache, Google, Census; then the parcel under the pin. */
// deno-lint-ignore no-explicit-any
async function lookup(admin: any, display: string, googleKey: string): Promise<{ parcel: ParcelRecord | null; geocoderCounty: string; error?: string }> {
  const key = normalizeKey(display)
  let lat: number | null = null
  let lng: number | null = null
  let county = ''
  const { data: cached } = await admin.from('address_geocodes').select('lat, lng').eq('address_normalized', key).maybeSingle()
  const c = cached as { lat: number; lng: number } | null
  if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
    lat = c.lat
    lng = c.lng
  }
  if ((lat == null || lng == null) && googleKey) {
    const g = await geocodeWithGoogle(display, googleKey)
    if (g.ok) {
      lat = g.lat
      lng = g.lng
      county = g.county
      await admin.from('address_geocodes').upsert({ address_normalized: key, lat, lng, geocoded_at: new Date().toISOString(), geocode_error: null }, { onConflict: 'address_normalized' })
    }
  }
  if (lat == null || lng == null) {
    const cz = await geocodeWithCensus(display)
    if (cz.ok) {
      lat = cz.lat
      lng = cz.lng
    }
  }
  if (lat == null || lng == null) return { parcel: null, geocoderCounty: '', error: 'not_found' }
  const ident = await identifyParcel(lat, lng)
  return { parcel: ident.parcel, geocoderCounty: county, error: ident.error }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: { cron_secret?: unknown; dry_run?: unknown } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }
  const cronSecret = Deno.env.get('CRON_SECRET')
  const given = req.headers.get('x-cron-secret') ?? (typeof body.cron_secret === 'string' ? body.cron_secret : null)
  if (!cronSecret || given !== cronSecret) return jsonResponse({ error: 'Unauthorized' }, 401)
  const dryRun = body.dry_run === true

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return jsonResponse({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)
  const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''
  const admin = createClient(supabaseUrl, serviceKey)

  try {
    const { data: settingRow } = await admin.from('app_settings').select('value_text').eq('key', SETTING_KEY).maybeSingle()
    const on = ((settingRow as { value_text?: string | null } | null)?.value_text ?? '').trim().toLowerCase() === 'true'
    if (!on && !dryRun) {
      console.log('owner-confirm-nightly: switch off — nothing saved')
      return jsonResponse({ ok: true, skipped: 'switch off' })
    }

    const { data: rowsRaw, error: rpcErr } = await admin.rpc('list_jobs_owner_to_confirm')
    if (rpcErr) return jsonResponse({ error: rpcErr.message }, 500)
    const rows = ((rowsRaw ?? []) as ConfirmRow[]).filter((r) => r.has_owner !== true)

    // One lookup per property; every job at it shares the write (the RPC sorts by first deadline, so the queue does too).
    const byKey = new Map<string, Property>()
    let skippedAddress = 0
    for (const r of rows) {
      const address = (r.job_address ?? '').trim().replace(/\s+/g, ' ')
      if (address.length < MIN_ADDRESS_LEN) {
        skippedAddress += 1
        continue
      }
      const key = ownerConfirmPropertyKey(address)
      let p = byKey.get(key)
      if (!p) {
        p = { key, address, jobs: [] }
        byKey.set(key, p)
      }
      p.jobs.push({ jobId: r.job_id, customerId: r.customer_id, gcCustomerId: r.gc_customer_id, customerAddressId: r.customer_address_id })
    }
    const all = [...byKey.values()]
    const todo = all.slice(0, MAX_PROPERTIES)
    const remaining = all.length - todo.length

    let found = 0
    let misses = 0
    let noMailing = 0
    let updated = 0
    let inserted = 0
    let linked = 0
    let failed = 0
    const details: Array<{ address: string; outcome: string }> = []

    for (const p of todo) {
      try {
        const res = await lookup(admin, p.address, googleKey)
        const proposal = proposePropertyRecord({ address: p.address, parcel: res.parcel, geocoderCounty: res.geocoderCounty, cityCounty: '', city: '' })
        if (!proposal.found) {
          misses += 1
          details.push({ address: p.address, outcome: res.error ? `miss: ${res.error}` : 'miss: no parcel under the pin' })
          continue
        }
        if (!proposal.ownerMailingAddress.trim() || !(proposal.ownerName || proposal.ownerCompany)) {
          noMailing += 1
          details.push({ address: p.address, outcome: 'found, but the roll has no owner mailing address — left for a person' })
          continue
        }
        found += 1
        const owner = proposal.ownerCompany || proposal.ownerName
        if (dryRun) {
          details.push({ address: p.address, outcome: `would save ${owner} (${proposal.provenance?.source ?? ''} ${proposal.provenance?.taxYear ?? ''})` })
          continue
        }
        const stamp = new Date().toISOString()
        const plan = planOwnerConfirmWrites(p.jobs)

        for (const u of plan.updates) {
          const { data: existing } = await admin.from('customer_addresses').select('*').eq('id', u.customerAddressId).maybeSingle()
          if (!existing) continue
          const before = fieldsOf(existing as Record<string, unknown>)
          // A row that already names an owner is never touched by the night (the RPC said has_owner false, but a person may have typed one since).
          if ((before.owner_name.trim() || before.owner_company.trim()) && before.owner_mailing_address.trim()) continue
          const after = applyProposalToFields(before, proposal, 'fill-blanks')
          const patch: Record<string, unknown> = { parcel_looked_up_at: stamp, updated_at: stamp }
          for (const k of RECORD_KEYS) if (after[k] !== before[k]) patch[k] = after[k]
          const { error } = await admin.from('customer_addresses').update(patch).eq('id', u.customerAddressId)
          if (error) throw error
          updated += 1
        }

        for (const ins of plan.inserts) {
          const { count } = await admin.from('customer_addresses').select('id', { count: 'exact', head: true }).eq('customer_id', ins.homeCustomerId)
          const f = applyProposalToFields(EMPTY_FIELDS, proposal, 'replace')
          const { data: row, error } = await admin
            .from('customer_addresses')
            .insert({
              customer_id: ins.homeCustomerId,
              address: p.address,
              note: null,
              county: f.county.trim(),
              county_source: f.county.trim() ? f.county_source : '',
              legal_description: f.legal_description.trim(),
              property_kind: f.property_kind,
              homestead: f.homestead,
              owner_mode: f.owner_mode,
              owner_name: f.owner_name.trim(),
              owner_company: f.owner_company.trim(),
              owner_mailing_address: f.owner_mailing_address.trim(),
              parcel_id: f.parcel_id.trim(),
              parcel_source: f.parcel_source.trim(),
              parcel_tax_year: f.parcel_tax_year.trim(),
              parcel_looked_up_at: stamp,
              updated_at: stamp,
              sequence_order: typeof count === 'number' ? count : 0,
              owner_confirmed_at: null,
              owner_confirmed_by: null,
            })
            .select('id')
            .single()
          if (error) throw error
          const newId = (row as { id: string } | null)?.id
          if (!newId) throw new Error('no row came back from the property insert')
          inserted += 1
          const { error: linkErr } = await admin.from('jobs_ledger').update({ customer_address_id: newId }).in('id', ins.jobIds)
          if (linkErr) throw linkErr
          linked += ins.jobIds.length
        }
        details.push({ address: p.address, outcome: `saved ${owner} · unconfirmed` })
      } catch (e) {
        failed += 1
        details.push({ address: p.address, outcome: `failed: ${e instanceof Error ? e.message : String(e)}` })
      }
    }

    const summary = `owner-confirm-nightly${dryRun ? ' (dry run)' : ''}: ${rows.length} ownerless jobs on ${all.length} properties · ${todo.length} looked up · ${found} found · ${misses} misses · ${noMailing} without a mailing address · ${updated} records filled · ${inserted} records added · ${linked} jobs linked · ${failed} failed · ${remaining} left for tomorrow${skippedAddress ? ` · ${skippedAddress} jobs with no address` : ''}`
    console.log(summary)
    return jsonResponse({ ok: true, dry_run: dryRun, summary, jobs: rows.length, properties: all.length, looked_up: todo.length, found, misses, no_mailing: noMailing, updated, inserted, linked, failed, remaining, details })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('owner-confirm-nightly failed:', msg)
    return jsonResponse({ error: msg }, 500)
  }
})
