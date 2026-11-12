import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { permitCity } from '../_shared/permitCities.ts'
import {
  addressQuery,
  askableParcelId,
  askablePoint,
  askedBexarLayer,
  askedOtherQuestion,
  askedWithoutId,
  askedWithoutNeighbours,
  askedWithoutPoint,
  idQuery,
  neighbourPointQuestion,
  neighbourSources,
  parcelFactsAtNeighbour,
  parcelFactsByAddress,
  parcelFactsById,
  parcelFactsByPoint,
  parcelSourceFor,
  pointQuery,
  pointQueryOf,
  pointQuestion,
  QUESTION_JOIN,
  streetParts,
  type ParcelSource,
} from '../_shared/permitParcels.ts'
import {
  BEXAR_PARCEL_FIELDS,
  BEXAR_PARCELS_QUERY,
  companyFactsFromPlaces,
  companyLookupKey,
  lookupIsFresh,
  parcelFactsFromCounty,
  parcelFactsFromCountyAtPoint,
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
 * Travis, Hays, Comal and Guadalupe take its number and street name (`_shared/permitParcels.ts`).
 * Every county is asked for the parcel under the permit's own point when the street address has
 * no parcel (Bexar since punch list #320). A city's limits cross county lines, so when its own
 * county holds nothing at the point the neighbouring counties' layers are asked there, and the
 * facts name the county the parcel is in. An Austin permit carries
 * the county's own id for its lot (`raw.tcad_id`, the layer's `geo_id`), so with `permit_id`
 * Travis is asked by that id first (punch list #316): the lot the permit names, no matching.
 * An id the layer does not hold falls back to the address and the point. A source that fails
 * answers with its reason, cached too, so a dead source is not hammered.
 *
 * Auth: a researcher's JWT (`user_can_research_permits()`), the archived-caller guard.
 * Body: `{ kind: 'company', contact, city }` or `{ kind: 'parcel', address, city, lat?, lng?, permit_id? }`.
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

type Body = { kind?: unknown; contact?: unknown; address?: unknown; city?: unknown; refresh?: unknown; lat?: unknown; lng?: unknown; permit_id?: unknown }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The parcel id the permit's own feed row carries, when the layer can be asked by it. Read with
 * the service client: the list the app reads (`research_permits_v2`) does not carry the row.
 * Held to the permit at the address being looked up, since the answer is kept under that address.
 * Null on any miss, so the lookup falls back to the address and the point.
 */
async function parcelIdOnPermit(admin: ReturnType<typeof createClient>, source: ParcelSource, permitId: unknown, key: string): Promise<string | null> {
  if (!source.id || typeof permitId !== 'string' || !UUID.test(permitId)) return null
  const { data, error } = await admin.from('permits').select(`city, address, parcel_id:raw->>${source.id.permitKey}`).eq('id', permitId).maybeSingle()
  if (error) console.warn(JSON.stringify({ fn: 'permit-lookup', permit: error.message }))
  const row = data as { city?: string | null; address?: string | null; parcel_id?: unknown } | null
  if (!row || parcelLookupKey(row.city ?? '', row.address) !== key) return null
  return askableParcelId(source, row.parcel_id)
}

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
  // The id the permit carries for its lot, where the county can be asked by it. A row kept before the id was asked, found or not, is asked again once.
  const parcelId = countySource !== null ? await parcelIdOnPermit(admin, countySource, body.permit_id, key) : null
  const askedBeforeId = countySource !== null && cached != null && askedWithoutId(countySource, cached.query as string | null | undefined, parcelId)
  // Bexar was asked by the street address alone until it could be asked by the point: a kept "no parcel" from then is asked again once. A kept failure is left alone.
  const askedBeforePoint = kind === 'parcel' && countySource === null && cached?.found === false && !cached.error && askedWithoutPoint(cached.query as string | null | undefined, askablePoint(body.lat, body.lng))
  // The neighbouring counties were not asked until they could be: a kept "no parcel" from then is asked again once. A kept failure is left alone.
  const askedBeforeNeighbours = countySource !== null && cached?.found === false && !cached.error && askedWithoutNeighbours(countySource, cached.query as string | null | undefined, askablePoint(body.lat, body.lng))
  if (cached && !askedWrongCounty && !askedOldQuestion && !askedBeforeId && !askedBeforePoint && !askedBeforeNeighbours && body.refresh !== true && lookupIsFresh(cached.looked_up_at as string, Date.now())) {
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
      // Travis, Hays, Comal, Guadalupe: the id the permit carries where the county has one, then the number and the street name, then the permit's point when the street address has no parcel.
      const source = parcelSourceFor(permitCity(city)?.county)!
      const byId = idQuery(source, parcelId)
      const parts = streetParts(typeof body.address === 'string' ? body.address : null)
      const point = askablePoint(body.lat, body.lng)
      const askAt = async (layer: ParcelSource, params: URLSearchParams): Promise<unknown> => {
        const res = await fetch(`${layer.queryUrl}?${params.toString()}`, { headers: { Accept: 'application/json' } })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || (json as { error?: unknown }).error) throw new Error(`the county answered ${res.status}: ${JSON.stringify((json as { error?: unknown }).error ?? {}).slice(0, 160)}`)
        return json
      }
      const ask = (params: URLSearchParams) => askAt(source, params)
      if (!byId && !parts && !point) error = 'nothing to look up'
      else {
        let f = null
        const asked: string[] = []
        // Each question is written down before it is asked, so a failure's row says how far the asking got.
        const noteAsked = (q: string) => {
          asked.push(q)
          query = asked.join(QUESTION_JOIN)
        }
        if (byId) {
          noteAsked(byId.get('where') ?? '')
          f = parcelFactsById(source, await ask(byId))
        }
        if (!f && parts) {
          const params = addressQuery(source, parts)
          noteAsked(params.get('where') ?? '')
          f = parcelFactsByAddress(source, await ask(params), parts)
        }
        if (!f && point) {
          noteAsked(pointQuestion(point))
          f = parcelFactsByPoint(source, await ask(pointQuery(source, point)))
        }
        // The city's own county holds nothing at the point: the lot may be over the county line.
        if (!f && point) {
          for (const neighbour of neighbourSources(source)) {
            noteAsked(neighbourPointQuestion(neighbour, point))
            f = parcelFactsAtNeighbour(neighbour, await askAt(neighbour, pointQuery(neighbour, point)))
            if (f) break
          }
        }
        if (f) {
          found = true
          facts = f
        }
      }
    } else {
      // Bexar: the street address as one string, then the permit's point when the address has no parcel.
      const where = situsWhere(typeof body.address === 'string' ? body.address : null)
      const point = askablePoint(body.lat, body.lng)
      const ask = async (params: URLSearchParams): Promise<unknown> => {
        const res = await fetch(`${BEXAR_PARCELS_QUERY}?${params.toString()}`, { headers: { Accept: 'application/json' } })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || (json as { error?: unknown }).error) throw new Error(`the county answered ${res.status}: ${JSON.stringify((json as { error?: unknown }).error ?? {}).slice(0, 160)}`)
        return json
      }
      if (!where && !point) error = 'nothing to look up'
      else {
        let f = null
        if (where) {
          query = where
          f = parcelFactsFromCounty(await ask(new URLSearchParams({ where, outFields: BEXAR_PARCEL_FIELDS, returnGeometry: 'false', resultRecordCount: '3', f: 'json' })))
        }
        if (!f && point) {
          query = [query, pointQuestion(point)].filter(Boolean).join(QUESTION_JOIN)
          f = parcelFactsFromCountyAtPoint(await ask(pointQueryOf(BEXAR_PARCEL_FIELDS, point)))
        }
        if (f) {
          found = true
          facts = f
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
