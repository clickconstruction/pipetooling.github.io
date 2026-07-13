import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import { batchGeocodeCacheKeys } from '../lib/map/geocodeCacheBatches'
import { mapGeocodeErrorMessage } from '../lib/map/geocodeErrorMessage'

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

/** Matches [`geocode-address-batch`](supabase/functions/geocode-address-batch/index.ts) `MAX_ADDRESSES`. */
const GEOCODE_BATCH_MAX = 20

type GeocodeBatchResultRow = { address_normalized: string; lat: number; lng: number }
type GeocodeBatchFailureRow = { address_normalized: string; error_code: string; detail?: string }

function resolveEstimateAddress(e: EstimateRow): string | null {
  const a = e.for_address?.trim()
  if (a) return a
  const j = e.jobs_ledger?.job_address?.trim()
  if (j) return j
  const c = e.customers?.address?.trim()
  if (c) return c
  return null
}

export type GeocodeAddressRow = {
  address_normalized: string
  addressLabel: string
  status: 'pending' | 'in_progress' | 'ok' | 'error'
  errorMessage?: string
}

export function useMapPageData(enabled: boolean) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entities, setEntities] = useState<MapPageEntity[]>([])
  const [geocodeAddressRows, setGeocodeAddressRows] = useState<GeocodeAddressRow[]>([])
  const loadGenerationRef = useRef(0)

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const gen = ++loadGenerationRef.current
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

      if (gen !== loadGenerationRef.current) return

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
      // Batched: one .in() with every key overflows the GET URL past ~600 addresses → 400.
      const cached: GeocodeRow[] = (
        await Promise.all(
          batchGeocodeCacheKeys(keys).map((batch) =>
            withSupabaseRetry<GeocodeRow[]>(
              async () => supabase.from('address_geocodes').select('address_normalized, lat, lng').in('address_normalized', batch),
              'map address_geocodes'
            )
          )
        )
      ).flat()

      if (gen !== loadGenerationRef.current) return

      const byKey = new Map<string, { lat: number; lng: number }>(
        cached.map((c) => [c.address_normalized, { lat: c.lat, lng: c.lng }])
      )

      const mergeCoords = (list: MapPageEntity[], m: Map<string, { lat: number; lng: number }>): MapPageEntity[] =>
        list.map((en) => {
          const o = m.get(en.addressKey)
          return o ? { ...en, lat: o.lat, lng: o.lng } : en
        })

      const missing = keys.filter((k) => !byKey.has(k))
      const displayByKey = new Map<string, string>()
      for (const en of next) {
        if (missing.includes(en.addressKey) && !displayByKey.has(en.addressKey)) {
          displayByKey.set(en.addressKey, en.addressLabel)
        }
      }
      const ordered = missing.map((k) => ({ key: k, display: displayByKey.get(k) ?? k }))

      if (ordered.length > 0) {
        setGeocodeAddressRows(
          ordered.map(({ key, display }) => ({ address_normalized: key, addressLabel: display, status: 'pending' as const }))
        )
      }

      setEntities(mergeCoords(next, byKey))
      setLoading(false)

      if (ordered.length > 0) {
        for (let offset = 0; offset < ordered.length; offset += GEOCODE_BATCH_MAX) {
          if (gen !== loadGenerationRef.current) return
          const chunk = ordered.slice(offset, offset + GEOCODE_BATCH_MAX)
          const chunkKeys = new Set(chunk.map((c) => c.key))
          setGeocodeAddressRows((prev) =>
            prev.map((r) => (chunkKeys.has(r.address_normalized) ? { ...r, status: 'in_progress' as const } : r))
          )

          const { data, error: fnErr } = await supabase.functions.invoke<{
            results?: GeocodeBatchResultRow[]
            failures?: GeocodeBatchFailureRow[]
          }>('geocode-address-batch', { body: { addresses: chunk.map((c) => c.display) } })

          if (gen !== loadGenerationRef.current) return

          if (fnErr) {
            setGeocodeAddressRows((prev) =>
              prev.map((r) =>
                chunkKeys.has(r.address_normalized)
                  ? { ...r, status: 'error' as const, errorMessage: fnErr.message }
                  : r
              )
            )
            continue
          }

          const rawResults =
            data != null && typeof data === 'object' && Array.isArray(data.results) ? data.results : []
          const results: GeocodeBatchResultRow[] = rawResults.filter(
            (r): r is GeocodeBatchResultRow =>
              r != null &&
              typeof r === 'object' &&
              typeof (r as GeocodeBatchResultRow).address_normalized === 'string' &&
              typeof (r as GeocodeBatchResultRow).lat === 'number' &&
              typeof (r as GeocodeBatchResultRow).lng === 'number'
          )
          const got = new Set(results.map((r) => r.address_normalized))
          for (const r of results) {
            byKey.set(r.address_normalized, { lat: r.lat, lng: r.lng })
          }
          const rawFailures =
            data != null && typeof data === 'object' && Array.isArray(data.failures) ? data.failures : []
          const failureMessageByKey = new Map<string, string>(
            rawFailures
              .filter(
                (f): f is GeocodeBatchFailureRow =>
                  f != null &&
                  typeof f === 'object' &&
                  typeof (f as GeocodeBatchFailureRow).address_normalized === 'string' &&
                  typeof (f as GeocodeBatchFailureRow).error_code === 'string'
              )
              .map((f) => [
                f.address_normalized,
                mapGeocodeErrorMessage(f.error_code, typeof f.detail === 'string' ? f.detail : undefined),
              ])
          )
          setGeocodeAddressRows((prev) =>
            prev.map((row) => {
              if (!chunkKeys.has(row.address_normalized)) return row
              if (got.has(row.address_normalized)) return { ...row, status: 'ok' as const }
              return {
                ...row,
                status: 'error' as const,
                errorMessage: failureMessageByKey.get(row.address_normalized) ?? 'Could not geocode address',
              }
            })
          )
          setEntities(mergeCoords(next, byKey))
        }
      }
    } catch (e) {
      if (gen !== loadGenerationRef.current) return
      setError(formatErrorMessage(e, 'Could not load map data'))
      setEntities([])
    } finally {
      if (gen === loadGenerationRef.current) {
        setLoading(false)
      }
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

export { mapGeocodeErrorMessage } from '../lib/map/geocodeErrorMessage'
