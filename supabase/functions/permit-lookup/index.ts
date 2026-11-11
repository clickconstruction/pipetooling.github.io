import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { permitCity } from '../_shared/permitCities.ts'
import { addressQuery, askablePoint, askedBexarLayer, askedOtherQuestion, parcelFactsByAddress, parcelFactsByPoint, parcelSourceFor, pointQuery, streetParts } from '../_shared/permitParcels.ts'
import {
  BEXAR_PARCEL_FIELDS,
  BEXAR_PARCELS_QUERY,
  companyFactsFromPlaces,
  companyLookupKey,
  lookupIsFresh,
  parcelFactsFromCounty,
  parcelLookupKey,
  placesQuery,
  situsWhere,
} from '../_shared/permitLookup.ts'

/**
 * Research, Who pulled it (punch list #292, PR 4, v2.6786): the two lookups behind the card,
 * cached in `permit_lookups` so each name and each address is asked once a month at most.
 * `company`: the contact's company (or the person) on Google Places Text Search, with the
 * server-side GOOGLE_MAPS_API_KEY the address autocomplete uses, leaning toward the permit's
 * city. `parcel`: the permit's street address on its county's parcel layer (owner of record,
 * mailing address, values; the DBA in Bexar). Bexar's layer takes the address as one string;
 * Travis, Hays, Comal and Guadalupe take its number and street name (`_shared/permitParcels.ts`)
 * and, when the street address has no parcel, the permit's own point. A source that fails
 * answers with its reason, cached too, so a dead source is not hammered.
 *
 * Auth: a researcher's JWT (`user_can_research_permits()`), the archived-caller guard.
 * Body: `{ kind: 'company', contact, city }` or `{ kind: 'parcel', address, city, lat?, lng? }`.
 * Answer: `{ ok, kind, key, found, facts, error, cached, looked_up_at }`.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const PLACES_FIELDS = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.googleMapsUri'
const BIAS = { center: { latitude: 29.45, longitude: -98.5 }, radius: 50_000 }
/** Google's answers lean toward the permit's city; San Antonio for a city the list does not hold. */
function biasFor(city: string): typeof BIAS {
  const c = permitCity(city)?.center
  return c ? { center: { latitude: c.lat, longitude: c.lng }, radius: BIAS.radius } : BIAS
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type Body = { kind?: unknown; contact?: unknown; address?: unknown; city?: unknown; refresh?: unknown; lat?: unknown; lng?: unknown }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401)
  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
  const { data: userData } = await asUser.auth.getUser()
  const userId = userData?.user?.id ?? null
  if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401)
  const { data: allowed } = await asUser.rpc('user_can_research_permits')
  if (allowed !== true) return jsonResponse({ error: 'Unauthorized' }, 401)
  const admin = createClient(supabaseUrl, serviceKey)
  const refused = await refuseArchivedCaller(admin, userId, corsHeaders)
  if (refused) return refused

  let body: Body = {}
  try {
    body = (await req.json()) ?? {}
  } catch {
    body = {}
  }
  const kind = body.kind === 'company' || body.kind === 'parcel' ? body.kind : null
  const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim() : 'San Antonio'
  if (!kind) return jsonResponse({ error: 'kind must be company or parcel' }, 400)

  const key = kind === 'company' ? companyLookupKey(typeof body.contact === 'string' ? body.contact : null) : parcelLookupKey(city, typeof body.address === 'string' ? body.address : null)
  if (!key) return jsonResponse({ ok: true, kind, key: null, found: false, facts: {}, error: 'nothing to look up', cached: false })

  const { data: cached } = await admin.from('permit_lookups').select('query, found, facts, error, looked_up_at').eq('kind', kind).eq('lookup_key', key).maybeSingle()
  // A row the earlier function kept for a city outside Bexar asked Bexar's layer, so its "no parcel" is not this county's answer.
  const askedWrongCounty = kind === 'parcel' && askedBexarLayer(cached?.query as string | null | undefined) && parcelSourceFor(permitCity(city)?.county) !== null
  // A "no parcel" asked with a question this function no longer asks (a spelling learned since) is asked again.
  const countySource = kind === 'parcel' ? parcelSourceFor(permitCity(city)?.county) : null
  const askedOldQuestion = countySource !== null && cached?.found === false && askedOtherQuestion(countySource, cached?.query as string | null | undefined, typeof body.address === 'string' ? body.address : null)
  if (cached && !askedWrongCounty && !askedOldQuestion && body.refresh !== true && lookupIsFresh(cached.looked_up_at as string, Date.now())) {
    return jsonResponse({ ok: true, kind, key, found: cached.found, facts: cached.facts, error: cached.error, cached: true, looked_up_at: cached.looked_up_at })
  }

  let query = ''
  let found = false
  let facts: Record<string, unknown> = {}
  let error: string | null = null
  try {
    if (kind === 'company') {
      const q = placesQuery(typeof body.contact === 'string' ? body.contact : null, city)
      query = q ?? ''
      const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? ''
      if (!q) error = 'nothing to look up'
      else if (!apiKey) error = 'the Google key is not set on the server'
      else {
        const res = await fetch(PLACES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': PLACES_FIELDS },
          body: JSON.stringify({ textQuery: q, locationBias: { circle: biasFor(city) }, maxResultCount: 3, languageCode: 'en' }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) error = `Google answered ${res.status}: ${String((json as { error?: { message?: string } }).error?.message ?? '').slice(0, 160)}`
        else {
          const f = companyFactsFromPlaces(json, key)
          if (f) {
            found = true
            facts = f
          }
        }
      }
    } else if (parcelSourceFor(permitCity(city)?.county)) {
      // Travis, Hays, Comal, Guadalupe: the number and the street name, then the permit's point when the street address has no parcel.
      const source = parcelSourceFor(permitCity(city)?.county)!
      const parts = streetParts(typeof body.address === 'string' ? body.address : null)
      const point = askablePoint(body.lat, body.lng)
      const ask = async (params: URLSearchParams): Promise<unknown> => {
        const res = await fetch(`${source.queryUrl}?${params.toString()}`, { headers: { Accept: 'application/json' } })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || (json as { error?: unknown }).error) throw new Error(`the county answered ${res.status}: ${JSON.stringify((json as { error?: unknown }).error ?? {}).slice(0, 160)}`)
        return json
      }
      if (!parts && !point) error = 'nothing to look up'
      else {
        let f = null
        if (parts) {
          const params = addressQuery(source, parts)
          query = params.get('where') ?? ''
          f = parcelFactsByAddress(source, await ask(params), parts)
        }
        if (!f && point) {
          query = `${query}${query ? ' | ' : ''}point ${point.lng},${point.lat}`
          f = parcelFactsByPoint(source, await ask(pointQuery(source, point)))
        }
        if (f) {
          found = true
          facts = f
        }
      }
    } else {
      const where = situsWhere(typeof body.address === 'string' ? body.address : null)
      query = where ?? ''
      if (!where) error = 'nothing to look up'
      else {
        const params = new URLSearchParams({ where, outFields: BEXAR_PARCEL_FIELDS, returnGeometry: 'false', resultRecordCount: '3', f: 'json' })
        const res = await fetch(`${BEXAR_PARCELS_QUERY}?${params.toString()}`, { headers: { Accept: 'application/json' } })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || (json as { error?: unknown }).error) error = `the county answered ${res.status}: ${JSON.stringify((json as { error?: unknown }).error ?? {}).slice(0, 160)}`
        else {
          const f = parcelFactsFromCounty(json)
          if (f) {
            found = true
            facts = f
          }
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const row = { kind, lookup_key: key, query, found, facts, error, looked_up_at: new Date().toISOString(), looked_up_by: userId }
  const { error: writeError } = await admin.from('permit_lookups').upsert(row, { onConflict: 'kind,lookup_key' })
  if (writeError) console.warn(JSON.stringify({ fn: 'permit-lookup', write: writeError.message }))
  return jsonResponse({ ok: error === null, kind, key, found, facts, error, cached: false, looked_up_at: row.looked_up_at })
})
