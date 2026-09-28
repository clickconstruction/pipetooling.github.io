import { useEffect, useMemo, useRef, useState } from 'react'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import type { DayEditorSession } from '../../lib/myTimeDayTimeline'
import {
  bidFallbackLabel,
  bidLabelsForIds,
  jobFallbackLabel,
  jobLabelsForIds,
  missingJobBidLabelIds,
  type MyTimeBidLabelRow,
  type MyTimeJobLabelRow,
} from '../../lib/myTimeJobBidLabels'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

export type UseMyTimeJobBidLabelsInput = {
  sortedSessions: DayEditorSession[]
  /** Labels the parent already has (the editor's `jobLabels` / `bidLabels` props). */
  jobLabels: Record<string, string>
  bidLabels: Record<string, string>
  /** A new person or day drops the labels this hook loaded. */
  effectiveSubjectUserId: string | null | undefined
  dateStr: string
}

/**
 * The My Time day editor's job / bid labels: the parent's, plus the ones this hook loads for
 * sessions whose job or bid the parent did not label. A failed read labels them by id.
 */
export function useMyTimeJobBidLabels({
  sortedSessions,
  jobLabels,
  bidLabels,
  effectiveSubjectUserId,
  dateStr,
}: UseMyTimeJobBidLabelsInput) {
  const prefixMap = useLedgerPrefixMap()
  const [extraJobLabels, setExtraJobLabels] = useState<Record<string, string>>({})
  const [extraBidLabels, setExtraBidLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    setExtraJobLabels({})
    setExtraBidLabels({})
  }, [effectiveSubjectUserId, dateStr])

  const jobLabelsRef = useRef(jobLabels)
  const bidLabelsRef = useRef(bidLabels)
  jobLabelsRef.current = jobLabels
  bidLabelsRef.current = bidLabels
  const jobLabelsSerialized = JSON.stringify(jobLabels)
  const bidLabelsSerialized = JSON.stringify(bidLabels)

  useEffect(() => {
    if (sortedSessions.length === 0) return
    const { needJobs, needBids } = missingJobBidLabelIds(
      sortedSessions,
      { ...jobLabelsRef.current, ...extraJobLabels },
      { ...bidLabelsRef.current, ...extraBidLabels },
    )
    if (needJobs.length === 0 && needBids.length === 0) return

    let cancelled = false
    void (async () => {
      try {
        const [jobsData, bidsData] = await Promise.all([
          needJobs.length > 0
            ? withSupabaseRetry(
                () => supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: needJobs }),
                'my time editor job labels'
              )
            : Promise.resolve([]),
          needBids.length > 0
            ? withSupabaseRetry(
                () => supabase.rpc('get_bids_by_ids', { p_bid_ids: needBids }),
                'my time editor bid labels'
              )
            : Promise.resolve([]),
        ])
        if (cancelled) return
        const nextJ = jobLabelsForIds(needJobs, (jobsData ?? []) as MyTimeJobLabelRow[], prefixMap)
        const nextB = bidLabelsForIds(needBids, (bidsData ?? []) as MyTimeBidLabelRow[], prefixMap)
        if (Object.keys(nextJ).length > 0) setExtraJobLabels((prev) => ({ ...prev, ...nextJ }))
        if (Object.keys(nextB).length > 0) setExtraBidLabels((prev) => ({ ...prev, ...nextB }))
      } catch {
        const nextJ: Record<string, string> = {}
        for (const id of needJobs) nextJ[id] = jobFallbackLabel(id)
        const nextB: Record<string, string> = {}
        for (const id of needBids) nextB[id] = bidFallbackLabel(id)
        if (needJobs.length > 0) setExtraJobLabels((prev) => ({ ...prev, ...nextJ }))
        if (needBids.length > 0) setExtraBidLabels((prev) => ({ ...prev, ...nextB }))
      }
    })()
    return () => {
      cancelled = true
    }
    // The parent's label props are read through refs and compared by content: a parent that
    // builds a new object every render must not restart the read.
  }, [sortedSessions, extraJobLabels, extraBidLabels, jobLabelsSerialized, bidLabelsSerialized, prefixMap])

  const mergedJobLabels = useMemo(
    () => ({ ...jobLabels, ...extraJobLabels }),
    [jobLabels, extraJobLabels]
  )
  const mergedBidLabels = useMemo(() => ({ ...bidLabels, ...extraBidLabels }), [bidLabels, extraBidLabels])

  return { mergedJobLabels, mergedBidLabels }
}
