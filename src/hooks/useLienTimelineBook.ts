import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { chunkIds } from '../lib/supabasePaging'
import { parseLienNoticePolicy, type LienDeskItemRow, type LienNoticeMonthRow, type LienNoticePolicy } from '../lib/jobs/lienDesk'
import type { LienAffidavitRow } from '../lib/jobs/lienDeskAffidavits'
import type { JobLienFilingRow } from '../lib/jobs/lienDeadlines'
import { lienPropertyOwnerDisplayName, resolveLienProperty, type CustomerAddressRow, type JobPropertyOwnerLike } from '../lib/jobs/lienProperty'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { buildLienTimelineBook, type LienBookJob, type LienTimelineBook } from '../lib/jobs/lienTimelineBook'

/** Wide enough that every open month and every affidavit window is inside it — the book is the whole path, not this month's. */
export const LIEN_BOOK_WINDOW_DAYS = 400

/**
 * The Timeline tab's read (v2.3768): the desk's two RPCs over a 400-day
 * window (so every billed job with money open and a lien month comes back,
 * not just this month's), the jobs, their GCs and standing rules, the
 * property records and owner overrides (the grid's owner and kind), and the
 * jobs' affidavits and releases (the tail). The desk's items are handed in —
 * they are already loaded. Loads only while `enabled`; null until then.
 */
export function useLienTimelineBook(enabled: boolean, todayYmd: string, items: ReadonlyArray<LienDeskItemRow> | null): { book: LienTimelineBook | null; loading: boolean; error: string; refetch: () => void } {
  const [book, setBook] = useState<LienTimelineBook | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled || !items) return
    let cancelled = false
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const [rowsRaw, affRaw] = await Promise.all([
          withSupabaseRetry(() => supabase.rpc('list_lien_notice_months', { p_within_days: LIEN_BOOK_WINDOW_DAYS } as never), 'lien book: months'),
          withSupabaseRetry(() => supabase.rpc('list_lien_affidavit_windows', { p_within_days: LIEN_BOOK_WINDOW_DAYS } as never), 'lien book: affidavit windows').catch(() => []),
        ])
        if (cancelled) return
        const rows = ((rowsRaw ?? []) as unknown as LienNoticeMonthRow[]).map((r) => ({ ...r, approved_hours: Number(r.approved_hours) || 0, open_balance: Number(r.open_balance) || 0 }))
        const affidavitRows = ((affRaw ?? []) as unknown as LienAffidavitRow[]).map((r) => ({ ...r, open_balance: Number(r.open_balance) || 0 }))
        const jobIds = [...new Set([...rows.map((r) => r.job_id), ...affidavitRows.map((r) => r.job_id)])]

        type JobRow = { id: string; hcp_number: string; click_number: string | null; job_name: string | null; job_address: string | null; gc_customer_id: string | null; customer_address_id: string | null; revenue: number | null; payments_made: number | null; last_work_date: string | null }
        const jobs: JobRow[] = []
        for (const chunk of chunkIds(jobIds)) {
          if (chunk.length === 0) continue
          const part = await withSupabaseRetry(
            () => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, gc_customer_id, customer_address_id, revenue, payments_made, last_work_date').in('id', chunk),
            'lien book: jobs',
          )
          jobs.push(...((part ?? []) as JobRow[]))
        }
        if (cancelled) return
        const gcIds = [...new Set(jobs.map((j) => j.gc_customer_id).filter((v): v is string => Boolean(v)))]
        const addressIds = [...new Set(jobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
        const filingsByJob: Record<string, JobLienFilingRow[]> = {}
        const [gcRows, addrRows, ownerRows] = await Promise.all([
          gcIds.length ? withSupabaseRetry(() => supabase.from('customers').select('id, name, lien_notice_policy').in('id', gcIds), 'lien book: GCs') : Promise.resolve([]),
          addressIds.length ? withSupabaseRetry(() => supabase.from('customer_addresses').select('*').in('id', addressIds), 'lien book: property records') : Promise.resolve([] as CustomerAddressRow[]),
          jobIds.length
            ? withSupabaseRetry(() => supabase.from('job_property_owners').select('job_id, owner_mode, owner_name, company_name, mailing_address, owner_email').in('job_id', jobIds), 'lien book: owner overrides').catch(() => [])
            : Promise.resolve([]),
        ])
        for (const chunk of chunkIds(jobIds)) {
          if (chunk.length === 0) continue
          const part = await withSupabaseRetry(
            () => supabase.from('job_lien_filings').select('*').in('job_id', chunk).in('kind', ['affidavit', 'release_of_record']).is('voided_at', null),
            'lien book: filings',
          ).catch(() => [])
          for (const f of (part ?? []) as JobLienFilingRow[]) (filingsByJob[f.job_id] ??= []).push(f)
        }
        if (cancelled) return
        const gcName: Record<string, string> = {}
        const policyByCustomer: Record<string, LienNoticePolicy> = {}
        for (const c of (gcRows ?? []) as { id: string; name: string | null; lien_notice_policy: string | null }[]) {
          gcName[c.id] = (c.name ?? '').trim()
          policyByCustomer[c.id] = parseLienNoticePolicy(c.lien_notice_policy)
        }
        const addressById: Record<string, CustomerAddressRow> = {}
        for (const a of (addrRows ?? []) as CustomerAddressRow[]) addressById[a.id] = a
        const ownerByJob: Record<string, JobPropertyOwnerLike> = {}
        for (const o of (ownerRows ?? []) as (NonNullable<JobPropertyOwnerLike> & { job_id: string })[]) ownerByJob[o.job_id] = o
        const kindByJob: Record<string, string> = {}
        for (const r of rows) kindByJob[r.job_id] = r.property_kind
        for (const r of affidavitRows) kindByJob[r.job_id] ??= r.property_kind
        const isSubByJob: Record<string, boolean> = {}
        for (const r of affidavitRows) isSubByJob[r.job_id] = r.is_sub

        const jobsById: Record<string, LienBookJob> = {}
        for (const j of jobs) {
          const address = j.customer_address_id ? addressById[j.customer_address_id] ?? null : null
          const property = resolveLienProperty(address, ownerByJob[j.id] ?? null)
          const number = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
          const name = (j.job_name ?? '').trim()
          jobsById[j.id] = {
            id: j.id,
            label: name ? `${number} · ${name}` : number,
            address: (j.job_address ?? '').trim(),
            gcId: j.gc_customer_id,
            gcName: j.gc_customer_id ? gcName[j.gc_customer_id] ?? '' : '',
            propertyKind: kindByJob[j.id] ?? property.propertyKind ?? '',
            homestead: Boolean(address?.homestead),
            county: property.county ?? '',
            ownerName: lienPropertyOwnerDisplayName(property.owner),
            openBalance: Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)),
            lastWorkDate: j.last_work_date,
            isSub: isSubByJob[j.id] ?? Boolean(j.gc_customer_id),
          }
        }
        if (cancelled) return
        setBook(buildLienTimelineBook({ rows, affidavitRows, items, filingsByJob, jobs: jobsById, policyByCustomer, todayYmd }))
      } catch (e) {
        if (cancelled) return
        setBook(null)
        setError(e instanceof Error ? e.message : 'The book could not be read.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, todayYmd, items, tick])

  return useMemo(() => ({ book, loading, error, refetch }), [book, loading, error, refetch])
}
