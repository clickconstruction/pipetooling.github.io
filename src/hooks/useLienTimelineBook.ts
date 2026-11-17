import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../utils/errorHandling'
import type { LienDeskItemRow, LienNoticeMonthRow } from '../lib/jobs/lienDesk'
import type { LienAffidavitRow } from '../lib/jobs/lienDeskAffidavits'
import type { JobLienFilingRow } from '../lib/jobs/lienDeadlines'
import type { JobDemandLetterRow } from '../lib/jobs/demandLetterTracking'
import type { CustomerAddressRow } from '../lib/jobs/lienProperty'
import { buildLienTimelineBook, type LienTimelineBook } from '../lib/jobs/lienTimelineBook'
import { LIEN_BOOK_JOB_COLUMNS, assembleLienBookInput, type LienBookRawGc, type LienBookRawJob } from '../lib/jobs/lienTimelineBookAssemble'
import { readLienBookRows, type LienBookOwnerRow, type LienBookReads, type LienBookRows } from '../lib/jobs/lienTimelineBookRead'

/** Wide enough that every open month and every affidavit window is inside it — the book is the whole path, not this month's. */
export const LIEN_BOOK_WINDOW_DAYS = 400

/** The book's reads, one per table. Which run together is `readLienBookRows`'s to say (`lienTimelineBookRead.ts`). */
const LIEN_BOOK_READS: LienBookReads = {
  months: async () => ((await withSupabaseRetry(() => supabase.rpc('list_lien_notice_months', { p_within_days: LIEN_BOOK_WINDOW_DAYS } as never), 'lien book: months')) ?? []) as unknown as LienNoticeMonthRow[],
  affidavitWindows: async () =>
    ((await withSupabaseRetry(() => supabase.rpc('list_lien_affidavit_windows', { p_within_days: LIEN_BOOK_WINDOW_DAYS } as never), 'lien book: affidavit windows').catch(() => [])) ?? []) as unknown as LienAffidavitRow[],
  jobs: async (jobIds) => ((await withSupabaseRetry(() => supabase.from('jobs_ledger').select(LIEN_BOOK_JOB_COLUMNS).in('id', jobIds), 'lien book: jobs')) ?? []) as LienBookRawJob[],
  owners: async (jobIds) =>
    ((await withSupabaseRetry(() => supabase.from('job_property_owners').select('job_id, owner_mode, owner_name, company_name, mailing_address, owner_email').in('job_id', jobIds), 'lien book: owner overrides').catch(() => [])) ?? []) as LienBookOwnerRow[],
  filings: async (jobIds) =>
    ((await withSupabaseRetry(
      // The recorded § 53.056 notices ride the same read since v2.7485: the property view says the day each went.
      () => supabase.from('job_lien_filings').select('*').in('job_id', jobIds).in('kind', ['affidavit', 'release_of_record', 'notice_53_056']).is('voided_at', null),
      'lien book: filings',
    ).catch(() => [])) ?? []) as JobLienFilingRow[],
  // The demand letters (v2.3880) — the row's strip carries the letter the job's own strip draws.
  demandLetters: async (jobIds) =>
    ((await withSupabaseRetry(() => supabase.from('job_demand_letters').select('*').in('job_id', jobIds).is('voided_at', null), 'lien book: demand letters').catch(() => [])) ?? []) as JobDemandLetterRow[],
  gcs: async (customerIds) => ((await withSupabaseRetry(() => supabase.from('customers').select('id, name, lien_notice_policy').in('id', customerIds), 'lien book: GCs')) ?? []) as LienBookRawGc[],
  addresses: async (addressIds) => ((await withSupabaseRetry(() => supabase.from('customer_addresses').select('*').in('id', addressIds), 'lien book: property records')) ?? []) as CustomerAddressRow[],
}

/**
 * The Timeline tab's read (v2.3768): the desk's two RPCs over a 400-day
 * window (so every billed job with money open and a lien month comes back,
 * not just this month's), the jobs, their GCs and standing rules, the
 * property records and owner overrides (the grid's owner and kind), and the
 * jobs' affidavits and releases (the tail), and their demand letters. The desk's items are handed in —
 * they are already loaded. Loads only while `enabled`; null until then. The
 * fold from rows to the kernel's input is `assembleLienBookInput` — shared
 * with the firm's portal (#41 PR 2), which reads the same rows through
 * `legal-portal`.
 *
 * Since v2.7463 the read does not wait on the desk's: it starts as soon as it is `enabled`, in the three steps
 * `readLienBookRows` names, and the book is folded once its rows and the desk's `items` are both in hand. So on an
 * open by By job's own address the two reads run side by side, and `loading` is true from the first moment. The
 * desk handing over new items after its first (a refetch behind a write) reads the book again, as before.
 *
 * `hideZzTestJobs` (punch list #61, PR 3): ZZ test jobs leave the months, the affidavit windows and the
 * jobs right after the jobs join, by the joined rows' own names (the desk's items handed in are already
 * without them).
 */
export function useLienTimelineBook(
  enabled: boolean,
  todayYmd: string,
  items: ReadonlyArray<LienDeskItemRow> | null,
  hideZzTestJobs = false,
): { book: LienTimelineBook | null; loading: boolean; error: string; refetch: () => void } {
  const [bookRows, setBookRows] = useState<LienBookRows | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const refetch = useCallback(() => setTick((t) => t + 1), [])

  // The desk's refetch: a new list of items after the first one. The first hand-over (null, then the items) is the
  // desk's own first read finishing beside the book's, and is no reason to read the book twice.
  const [itemsSeen, setItemsSeen] = useState(items)
  const [deskRefetches, setDeskRefetches] = useState(0)
  if (items !== itemsSeen) {
    setItemsSeen(items)
    if (items && itemsSeen) setDeskRefetches((n) => n + 1)
  }

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setReading(true)
    setError('')
    void (async () => {
      try {
        const rows = await readLienBookRows(LIEN_BOOK_READS, { hideZzTestJobs })
        if (cancelled) return
        setBookRows(rows)
      } catch (e) {
        if (cancelled) return
        setBookRows(null)
        setError(formatErrorMessage(e, 'The book could not be read.'))
      } finally {
        if (!cancelled) setReading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, todayYmd, hideZzTestJobs, tick, deskRefetches])

  const book = useMemo(() => (bookRows && items ? buildLienTimelineBook(assembleLienBookInput({ ...bookRows, items: [...items] }, todayYmd)) : null), [bookRows, items, todayYmd])
  // Reading, or read and waiting on the desk's items: either way the book is on its way.
  const loading = reading || (enabled && !error && !items)

  return useMemo(() => ({ book, loading, error, refetch }), [book, loading, error, refetch])
}
