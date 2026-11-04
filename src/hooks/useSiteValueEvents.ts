import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { siteValueEventsFromRows, type SitePctEventRow, type SiteReportRow } from '../lib/developments/siteTimeline'
import type { JobValueEvent } from '../lib/jobChargesTimeline'
import { ymdFromDateOnlyOrIso } from '../lib/jobChargesTimeline'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { formatErrorMessage } from '../utils/errorHandling'

export type SiteValueEventsRead = { state: 'off' } | { state: 'reading' } | { state: 'read'; byJobId: ReadonlyMap<string, JobValueEvent[]> } | { state: 'failed'; reason: string }

/**
 * The percent events behind the Development page's Timeline's value line (v2.6499, punch list #257):
 * every field report and every hand-set percent on the site's jobs, read in one chunked, paged read
 * each by job id, never one round per job, only while the view is open (`enabled`). A read that fails
 * says so and the chart draws without the value line, never a false zero.
 */
export function useSiteValueEvents(jobIds: ReadonlyArray<string>, enabled: boolean): SiteValueEventsRead {
  const key = useMemo(() => (enabled && jobIds.length ? [...jobIds].sort().join(',') : ''), [jobIds, enabled])
  const [state, setState] = useState<{ key: string; read: SiteValueEventsRead } | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    void (async () => {
      const ids = key.split(',')
      try {
        const paged = { parallel: 3 }
        const [reports, pctEvents] = await Promise.all([
          fetchAllRowsChunkedIn<SiteReportRow, string>(
            ids,
            (chunk, from, to) =>
              supabase.from('reports').select('id, job_ledger_id, created_at, field_values, users!reports_created_by_user_id_fkey(name)').in('job_ledger_id', chunk).order('created_at', { ascending: true }).order('id').range(from, to) as unknown as PromiseLike<{ data: SiteReportRow[] | null; error: { message: string } | null }>,
            'site reports',
            paged,
          ),
          // The office's hand-set percents (v2.3372): 'seed' and 'service' rows are not a hand-set.
          fetchAllRowsChunkedIn<SitePctEventRow, string>(
            ids,
            (chunk, from, to) =>
              supabase.from('job_pct_events').select('id, job_id, pct, changed_at, users!job_pct_events_changed_by_user_id_fkey(name)').in('job_id', chunk).eq('source', 'manual').order('changed_at', { ascending: true }).order('id').range(from, to) as unknown as PromiseLike<{ data: SitePctEventRow[] | null; error: { message: string } | null }>,
            'site percent events',
            paged,
          ),
        ])
        if (cancelled) return
        setState({ key, read: { state: 'read', byJobId: siteValueEventsFromRows(reports, pctEvents, (raw) => ymdFromDateOnlyOrIso(raw, calendarYmdInAppTzFromIso)) } })
      } catch (e) {
        if (!cancelled) setState({ key, read: { state: 'failed', reason: formatErrorMessage(e, 'the read did not finish') } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  if (!key) return { state: 'off' }
  return state && state.key === key ? state.read : { state: 'reading' }
}
