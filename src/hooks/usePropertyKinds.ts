import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { chunkIds } from '../lib/supabasePaging'

export type PropertyKindJob = { id: string; customer_address_id: string | null }

/**
 * Every Pipeline row's property kind (v2.4160) — `customer_addresses.property_kind`
 * for each job's linked property, one chunked read keyed on the address ids
 * (`useBilledLienClocks` reads the same column for the Billed rows' lien clocks;
 * this covers every stage for the address badge). `byJobId` is null while the
 * first read is out and empty on error, so the rows simply draw no badge.
 * `setKind` records a save at once, so the badge changes before the board reloads.
 */
export function usePropertyKinds(jobs: ReadonlyArray<PropertyKindJob>): { byJobId: ReadonlyMap<string, string> | null; setKind: (customerAddressId: string, kind: string) => void } {
  const [kindByAddress, setKindByAddress] = useState<Map<string, string> | null>(null)
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

  const byJobId = useMemo(() => {
    if (!kindByAddress) return null
    const m = new Map<string, string>()
    for (const j of jobs) {
      if (!j.customer_address_id) continue
      const k = kindByAddress.get(j.customer_address_id)
      if (k != null) m.set(j.id, k)
    }
    return m
  }, [jobs, kindByAddress])

  return { byJobId, setKind }
}
