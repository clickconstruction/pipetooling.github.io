import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import { usePropertyKinds } from './usePropertyKinds'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { chunkIds } from '../lib/supabasePaging'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { jobBilledUnpaidDollars } from '../lib/jobs/invoiceBilling'
import { propertyKindRows, type PropertyKindQueueJob, type PropertyKindRow } from '../lib/quickfill/propertyKinds'
import type { PropertyKind } from '../lib/jobs/propertyKind'

/**
 * Quickfill → Property kinds (v2.4727): the unpaid jobs from the jobs cache
 * (the same list Missing job info reads), each job's property kind from the
 * Pipeline's own hook (`usePropertyKinds`, one chunked read), the customers'
 * own type for the hint (one chunked read), folded into property rows by the
 * kernel. Office roles only — the same roles the Pipeline's badge lets pick.
 */
export function useQuickfillPropertyKinds(): {
  rows: PropertyKindRow[]
  noCustomerCount: number
  loading: boolean
  jobsListBusy: boolean
  fetchEnabled: boolean
  /** A linked property's kind was saved: remember it so the row leaves at once. */
  setKind: (customerAddressId: string, kind: PropertyKind) => void
  /** A typed-address job was linked to a property on the pick (v2.4212). */
  linkJob: (jobId: string, customerAddressId: string, kind: PropertyKind) => void
} {
  const { user: authUser, role } = useAuth()
  const { jobs, jobsListLoading, jobsListRefreshing, runFetchJobs } = useJobsListCache()

  const fetchEnabled = Boolean(authUser?.id && (role === 'dev' || role === 'master_technician' || isAssistantLike(role)))

  useEffect(() => {
    if (!fetchEnabled) return
    void runFetchJobs(null)
  }, [fetchEnabled, runFetchJobs])

  // The property's home is the customer, else the GC (v2.4222), as the Pipeline badge has it.
  const propertyKindJobs = useMemo(
    () => (fetchEnabled ? jobs.map((j) => ({ id: j.id, customer_address_id: j.customer_address_id ?? null, customer_id: j.customer_id ?? j.gc_customer_id ?? null })) : []),
    [fetchEnabled, jobs],
  )
  const propertyKinds = usePropertyKinds(propertyKindJobs)

  const homeKey = useMemo(
    () => [...new Set(propertyKindJobs.map((j) => j.customer_id).filter((v): v is string => Boolean(v)))].sort().join('|'),
    [propertyKindJobs],
  )
  const [customerTypeById, setCustomerTypeById] = useState<Map<string, string | null>>(() => new Map())
  useEffect(() => {
    const ids = homeKey ? homeKey.split('|') : []
    if (ids.length === 0) {
      setCustomerTypeById(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      const next = new Map<string, string | null>()
      try {
        for (const chunk of chunkIds(ids)) {
          if (chunk.length === 0) continue
          const rows = await withSupabaseRetry(() => supabase.from('customers').select('id, customer_type').in('id', chunk), 'quickfill: customer types')
          for (const r of (rows ?? []) as { id: string; customer_type: string | null }[]) next.set(r.id, r.customer_type)
        }
      } catch {
        /* the hint is a nicety: no types, no hint */
      }
      if (!cancelled) setCustomerTypeById(next)
    })()
    return () => {
      cancelled = true
    }
  }, [homeKey])

  const queueJobs = useMemo<PropertyKindQueueJob[]>(
    () =>
      fetchEnabled
        ? jobs.map((j) => ({
            id: j.id,
            status: j.status,
            collections_at: j.collections_at ?? null,
            customer_id: j.customer_id ?? null,
            gc_customer_id: j.gc_customer_id ?? null,
            customer_name: j.customer_name ?? null,
            gc_name: j.gcCustomer?.name ?? null,
            customer_address_id: j.customer_address_id ?? null,
            job_address: j.job_address ?? null,
            job_number: effectiveJobLedgerNumber(j.hcp_number, j.click_number) ?? '',
            job_name: j.job_name ?? null,
            open_balance: jobBilledUnpaidDollars(j),
          }))
        : [],
    [fetchEnabled, jobs],
  )

  const built = useMemo(() => propertyKindRows(queueJobs, fetchEnabled ? propertyKinds.byJobId : new Map(), customerTypeById), [queueJobs, fetchEnabled, propertyKinds.byJobId, customerTypeById])

  return {
    rows: built.rows,
    noCustomerCount: built.noCustomerCount,
    loading: fetchEnabled && (jobsListLoading || built.loading),
    jobsListBusy: jobsListLoading || jobsListRefreshing,
    fetchEnabled,
    setKind: propertyKinds.setKind,
    linkJob: propertyKinds.linkJob,
  }
}
