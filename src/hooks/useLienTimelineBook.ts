import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { chunkIds } from '../lib/supabasePaging'
import type { LienDeskItemRow, LienNoticeMonthRow } from '../lib/jobs/lienDesk'
import type { LienAffidavitRow } from '../lib/jobs/lienDeskAffidavits'
import type { JobLienFilingRow } from '../lib/jobs/lienDeadlines'
import type { CustomerAddressRow } from '../lib/jobs/lienProperty'
import { buildLienTimelineBook, type LienTimelineBook } from '../lib/jobs/lienTimelineBook'
import { LIEN_BOOK_JOB_COLUMNS, assembleLienBookInput, type LienBookRaw, type LienBookRawGc, type LienBookRawJob } from '../lib/jobs/lienTimelineBookAssemble'

/** Wide enough that every open month and every affidavit window is inside it — the book is the whole path, not this month's. */
export const LIEN_BOOK_WINDOW_DAYS = 400

/**
 * The Timeline tab's read (v2.3768): the desk's two RPCs over a 400-day
 * window (so every billed job with money open and a lien month comes back,
 * not just this month's), the jobs, their GCs and standing rules, the
 * property records and owner overrides (the grid's owner and kind), and the
 * jobs' affidavits and releases (the tail). The desk's items are handed in —
 * they are already loaded. Loads only while `enabled`; null until then. The
 * fold from rows to the kernel's input is `assembleLienBookInput` — shared
 * with the firm's portal (#41 PR 2), which reads the same rows through
 * `legal-portal`.
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
        const rows = (rowsRaw ?? []) as unknown as LienNoticeMonthRow[]
        const affidavitRows = (affRaw ?? []) as unknown as LienAffidavitRow[]
        const jobIds = [...new Set([...rows.map((r) => r.job_id), ...affidavitRows.map((r) => r.job_id)])]

        const jobs: LienBookRawJob[] = []
        for (const chunk of chunkIds(jobIds)) {
          if (chunk.length === 0) continue
          const part = await withSupabaseRetry(() => supabase.from('jobs_ledger').select(LIEN_BOOK_JOB_COLUMNS).in('id', chunk), 'lien book: jobs')
          jobs.push(...((part ?? []) as LienBookRawJob[]))
        }
        if (cancelled) return
        const gcIds = [...new Set(jobs.map((j) => j.gc_customer_id).filter((v): v is string => Boolean(v)))]
        const addressIds = [...new Set(jobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
        const filings: JobLienFilingRow[] = []
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
          filings.push(...((part ?? []) as JobLienFilingRow[]))
        }
        if (cancelled) return
        const raw: LienBookRaw = {
          rows,
          affidavitRows,
          items: [...items],
          filings,
          jobs,
          gcs: (gcRows ?? []) as LienBookRawGc[],
          addresses: (addrRows ?? []) as CustomerAddressRow[],
          owners: (ownerRows ?? []) as LienBookRaw['owners'],
        }
        setBook(buildLienTimelineBook(assembleLienBookInput(raw, todayYmd)))
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
