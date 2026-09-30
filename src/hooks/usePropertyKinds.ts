import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { chunkIds } from '../lib/supabasePaging'

/** `customer_id` is the property's home: the job's customer, else its GC (v2.4222). */
export type PropertyKindJob = { id: string; customer_address_id: string | null; customer_id?: string | null }

/**
 * Every Pipeline row's property kind (v2.4160) — `customer_addresses.property_kind`
 * for each job's linked property, one chunked read keyed on the address ids
 * (`useBilledLienClocks` reads the same column for the Billed rows' lien clocks;
 * this covers every stage for the address badge). `byJobId` is null while the
 * first read is out and empty on error, so the rows simply draw no badge.
 * `setKind` records a save at once, so the badge changes before the board reloads.
 *
 * A job with no linked property but a customer gets '' (v2.4212) — its badge is
 * the ? that saves the address as a property on the pick; `linkJob` remembers
 * that new link (`linkByJobId`) so the next pick on the row edits the property
 * instead of making another, until the board reloads with the row's own column.
 */
export function usePropertyKinds(jobs: ReadonlyArray<PropertyKindJob>): {
  byJobId: ReadonlyMap<string, string> | null
  linkByJobId: ReadonlyMap<string, string>
  setKind: (customerAddressId: string, kind: string) => void
  linkJob: (jobId: string, customerAddressId: string, kind: string) => void
} {
  const [kindByAddress, setKindByAddress] = useState<Map<string, string> | null>(null)
  const [linkByJobId, setLinkByJobId] = useState<Map<string, string>>(() => new Map())
  const addressKey = useMemo(
    () => [...new Set(jobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))].sort().join('|'),
    [jobs],
  )

  useEffect(() => {
    const addressIds = addressKey ? addressKey.split('|') : []
    if (addressIds.length === 0) {
      setKindByAddress(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = new Map<string, string>()
        for (const chunk of chunkIds(addressIds)) {
          if (chunk.length === 0) continue
          const rows = await withSupabaseRetry(
            () => supabase.from('customer_addresses').select('id, property_kind').in('id', chunk),
            'pipeline: property kinds',
          )
          for (const r of (rows ?? []) as { id: string; property_kind: string | null }[]) next.set(r.id, r.property_kind ?? '')
        }
        if (!cancelled) setKindByAddress(next)
      } catch {
        if (!cancelled) setKindByAddress(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [addressKey])

  const setKind = useCallback((customerAddressId: string, kind: string) => {
    setKindByAddress((prev) => {
      const next = new Map(prev ?? [])
      next.set(customerAddressId, kind)
      return next
    })
  }, [])

  const linkJob = useCallback((jobId: string, customerAddressId: string, kind: string) => {
    setLinkByJobId((prev) => new Map(prev).set(jobId, customerAddressId))
    setKindByAddress((prev) => new Map(prev ?? []).set(customerAddressId, kind))
  }, [])

  const byJobId = useMemo(() => {
    if (!kindByAddress) return null
    const m = new Map<string, string>()
    for (const j of jobs) {
      const addressId = j.customer_address_id ?? linkByJobId.get(j.id) ?? null
      if (!addressId) {
        if (j.customer_id) m.set(j.id, '')
        continue
      }
      const k = kindByAddress.get(addressId)
      if (k != null) m.set(j.id, k)
    }
    return m
  }, [jobs, kindByAddress, linkByJobId])

  return { byJobId, linkByJobId, setKind, linkJob }
}
