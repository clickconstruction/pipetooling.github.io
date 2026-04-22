import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import type { Database } from '../types/database'

type JobRow = Pick<
  Database['public']['Tables']['jobs_ledger']['Row'],
  'id' | 'hcp_number' | 'job_name' | 'job_address' | 'status'
>
type BidRow = Pick<Database['public']['Tables']['bids']['Row'], 'id' | 'bid_number' | 'project_name' | 'address' | 'outcome'>

type EstimateRow = Pick<
  Database['public']['Tables']['estimates']['Row'],
  'id' | 'estimate_number' | 'title' | 'status' | 'total_cents' | 'for_address' | 'job_ledger_id' | 'customer_id'
> & {
  jobs_ledger: { job_address: string } | null
  customers: { address: string | null } | null
}

export type MapPageEntity = {
  kind: 'job' | 'bid' | 'estimate'
  id: string
  addressKey: string
  addressLabel: string
  lat: number | null
  lng: number | null
  tableLabel: string
  sublabel: string
  linkTo: string
  meta: string
}

const NOMINATIM_CLIENT_DELAY_MS = 1100

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

export type GeocodeAddressRow = {
  address_normalized: string
  addressLabel: string
  status: 'pending' | 'in_progress' | 'ok' | 'error'
  errorMessage?: string
}

type GeocodeOneOk = {
  ok: true
  address_normalized: string
  lat: number
  lng: number
  fromCache: boolean
  /** Added with Google fallback; when missing, non-cache successes follow legacy Nominatim pacing. */
  source?: 'cache' | 'nominatim' | 'google'
  /** Set by Edge when `refresh_google_only` was used. */
  refreshed?: true
}
type GeocodeOneFail = { ok: false; address_normalized: string; error: string; detail?: string }
type GeocodeOneResponse = GeocodeOneOk | GeocodeOneFail

function userFacingGeocodeError(errorCode: string, detail?: string) {
  let base: string
  switch (errorCode) {
    case 'not_found':
      base = 'Address not found'
      break
    case 'upstream':
      base = 'Geocoding service error'
      break
    case 'invalid_coordinates':
      base = 'Invalid coordinates from geocoder'
      break
    case 'google_denied':
      base = 'Google Geocoding denied (check API key, restrictions, and billing)'
      break
    case 'google_over_query':
      base = 'Google Geocoding quota exceeded'
      break
    case 'google_invalid':
      base = 'Invalid address for Google Geocoding'
      break
    case 'google_unknown':
    case 'google_no_results':
      base = 'Google Geocoding could not resolve this address'
      break
    case 'google_upstream':
      base = 'Google Geocoding service error'
      break
    case 'google_unconfigured':
      base = 'Google Geocoding is not configured (set GOOGLE_MAPS_API_KEY for Edge Functions)'
      break
    default:
      base = errorCode
  }
  if (detail && detail.trim().length > 0) {
    return `${base} — ${detail.trim()}`
  }
  return base
}

function shouldDelayAfterNominatimSuccess(d: GeocodeOneOk) {
  if (d.fromCache) return false
  const s = d.source
  if (s === 'google' || s === 'cache') return false
  if (s === 'nominatim') return true
  return true
}

function resolveEstimateAddress(e: EstimateRow): string | null {
  const a = e.for_address?.trim()
  if (a) return a
  const j = e.jobs_ledger?.job_address?.trim()
  if (j) return j
  const c = e.customers?.address?.trim()
  if (c) return c
  return null
}

export function useMapPageData(enabled: boolean) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entities, setEntities] = useState<MapPageEntity[]>([])
  const [geocodeAddressRows, setGeocodeAddressRows] = useState<GeocodeAddressRow[]>([])

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setGeocodeAddressRows([])
    try {
      const [jobRows, bidRows, estRows] = await Promise.all([
        withSupabaseRetry<JobRow[]>(
          async () => supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, status').order('job_name'),
          'map jobs_ledger'
        ),
        withSupabaseRetry<BidRow[]>(
          async () => supabase.from('bids').select('id, bid_number, project_name, address, outcome').order('project_name'),
          'map bids'
        ),
        withSupabaseRetry<EstimateRow[]>(
          async () =>
            supabase
              .from('estimates')
              .select(
                'id, estimate_number, title, status, total_cents, for_address, job_ledger_id, customer_id, jobs_ledger ( job_address ), customers!estimates_customer_id_fkey ( address )'
              )
              .order('estimate_number', { ascending: false }),
          'map estimates'
        ),
      ])

      const next: MapPageEntity[] = []
      for (const j of jobRows) {
        const addr = j.job_address?.trim()
        if (!addr) continue
        const key = normalizeAddressForGeocodeKey(addr)
        if (key.length < 3) continue
        next.push({
          kind: 'job',
          id: j.id,
          addressKey: key,
          addressLabel: addr,
          lat: null,
          lng: null,
          tableLabel: j.job_name,
          sublabel: j.hcp_number,
          linkTo: `/jobs?edit=${encodeURIComponent(j.id)}`,
          meta: j.status,
        })
      }
      for (const b of bidRows) {
        const addr = b.address?.trim()
        if (!addr) continue
        const key = normalizeAddressForGeocodeKey(addr)
        if (key.length < 3) continue
        const title = b.project_name?.trim() || 'Bid'
        next.push({
          kind: 'bid',
          id: b.id,
          addressKey: key,
          addressLabel: addr,
          lat: null,
          lng: null,
          tableLabel: title,
          sublabel: b.bid_number ?? '',
          linkTo: `/bids?bidId=${encodeURIComponent(b.id)}`,
          meta: b.outcome ?? '',
        })
      }
      for (const e of estRows) {
        const addr = resolveEstimateAddress(e)
        if (!addr) continue
        const key = normalizeAddressForGeocodeKey(addr)
        if (key.length < 3) continue
        const total = (e.total_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
        next.push({
          kind: 'estimate',
          id: e.id,
          addressKey: key,
          addressLabel: addr,
          lat: null,
          lng: null,
          tableLabel: e.title,
          sublabel: `#${e.estimate_number}`,
          linkTo: `/estimates/${e.id}`,
          meta: `${e.status} ${total}`,
        })
      }

      const keys = [...new Set(next.map((n) => n.addressKey))]

      type GeocodeRow = { address_normalized: string; lat: number; lng: number }
      const cached: GeocodeRow[] =
        keys.length === 0
          ? []
          : await withSupabaseRetry<GeocodeRow[]>(
              async () => supabase.from('address_geocodes').select('address_normalized, lat, lng').in('address_normalized', keys),
              'map address_geocodes'
            )

      const byKey = new Map<string, { lat: number; lng: number }>(
        cached.map((c) => [c.address_normalized, { lat: c.lat, lng: c.lng }])
      )

      const mergeCoords = (list: MapPageEntity[], m: Map<string, { lat: number; lng: number }>): MapPageEntity[] =>
        list.map((en) => {
          const o = m.get(en.addressKey)
          return o ? { ...en, lat: o.lat, lng: o.lng } : en
        })

      const missing = keys.filter((k) => !byKey.has(k))
      if (missing.length > 0) {
        const displayByKey = new Map<string, string>()
        for (const en of next) {
          if (missing.includes(en.addressKey) && !displayByKey.has(en.addressKey)) {
            displayByKey.set(en.addressKey, en.addressLabel)
          }
        }
        const ordered = missing.map((k) => ({ key: k, display: displayByKey.get(k) ?? k }))
        setGeocodeAddressRows(ordered.map(({ key, display }) => ({ address_normalized: key, addressLabel: display, status: 'pending' as const })))
        for (let i = 0; i < ordered.length; i++) {
          const { key, display } = ordered[i]!
          setGeocodeAddressRows((prev) =>
            prev.map((r) => (r.address_normalized === key ? { ...r, status: 'in_progress' } : r))
          )
          const { data, error: fnErr } = await supabase.functions.invoke<GeocodeOneResponse>('geocode-one', {
            body: { address: display },
          })
          if (fnErr) {
            setGeocodeAddressRows((prev) =>
              prev.map((r) =>
                r.address_normalized === key ? { ...r, status: 'error', errorMessage: fnErr.message } : r
              )
            )
            if (i < ordered.length - 1) await sleep(NOMINATIM_CLIENT_DELAY_MS)
            continue
          }
          if (data && typeof data === 'object' && 'ok' in data && data.ok) {
            const d = data as GeocodeOneOk
            byKey.set(d.address_normalized, { lat: d.lat, lng: d.lng })
            setGeocodeAddressRows((prev) =>
              prev.map((r) => (r.address_normalized === key ? { ...r, status: 'ok' } : r))
            )
            setEntities(mergeCoords(next, byKey))
            if (i < ordered.length - 1 && shouldDelayAfterNominatimSuccess(d)) {
              await sleep(NOMINATIM_CLIENT_DELAY_MS)
            }
            continue
          }
          if (data && typeof data === 'object' && 'ok' in data && !data.ok) {
            const d = data as GeocodeOneFail
            setGeocodeAddressRows((prev) =>
              prev.map((r) =>
                r.address_normalized === key
                  ? { ...r, status: 'error', errorMessage: userFacingGeocodeError(d.error, d.detail) }
                  : r
              )
            )
            if (i < ordered.length - 1) await sleep(NOMINATIM_CLIENT_DELAY_MS)
            continue
          }
          setGeocodeAddressRows((prev) =>
            prev.map((r) =>
              r.address_normalized === key
                ? { ...r, status: 'error', errorMessage: 'Unexpected geocode response' }
                : r
            )
          )
          if (i < ordered.length - 1) await sleep(NOMINATIM_CLIENT_DELAY_MS)
        }
      }

      setEntities(mergeCoords(next, byKey))
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not load map data'))
      setEntities([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])

  const geocodeInProgress = useMemo(
    () => geocodeAddressRows.some((r) => r.status === 'pending' || r.status === 'in_progress'),
    [geocodeAddressRows]
  )

  return {
    loading,
    error,
    entities,
    geocodeBusy: geocodeInProgress,
    geocodeInProgress,
    geocodeAddressRows,
    reload: load,
  }
}

export { userFacingGeocodeError as mapGeocodeErrorMessage }
