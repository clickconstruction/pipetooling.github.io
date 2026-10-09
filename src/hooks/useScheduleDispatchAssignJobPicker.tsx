import { useCallback, useEffect, useMemo, useState } from 'react'
import { scheduleFormatWeekdayLong } from '../lib/jobScheduleChicago'
import { findDuplicateJobAddress } from '../lib/scheduleDispatchHub'
import { buildHubBidPickerRows, filterHubJobPickerRows } from '../lib/scheduleDispatch/hubJobPicker'
import { fetchJobSearchEvidence, jobSearchEvidenceModeForRole, type JobSearchEvidence } from '../lib/jobSearchEvidence'
import type { HubAssignJobPickerIntent, HubCellAddContextState } from './useScheduleDispatchHubModes'
import type { useScheduleDispatchHubData } from './useScheduleDispatchHubData'

type HubData = ReturnType<typeof useScheduleDispatchHubData>

export interface UseScheduleDispatchAssignJobPickerInput {
  // Whether the picker is open, why, and for which cell: the modes hook owns these (the picker is a mode).
  hubAssignJobPickerOpen: boolean
  hubAssignJobPickerIntent: HubAssignJobPickerIntent
  hubCellAddContext: HubCellAddContextState | null
  hubMultiCellAddSelection: ReadonlySet<string>
  hubMergedRows: HubData['hubMergedRows']
  hubBids: HubData['hubBids']
  hubWeekBlocks: HubData['hubWeekBlocks']
  hubPeopleNameById: HubData['hubPeopleNameById']
  role: string | null | undefined
}

/**
 * The Dispatch hub's assign-job picker list (the SCHEDULE_DISPATCH map's step 6, its last piece):
 * the search and number query, the job and bid rows they narrow, the money-rail evidence fetched
 * for a short list, the same-address notice, the subtitles, and the reset to empty that the modes
 * hook calls as it opens the picker. Moved from `ScheduleDispatchHubPage` verbatim.
 *
 * It owns no mode: whether the picker is open, why, and for which cell stay with
 * `useScheduleDispatchHubModes`, which this hook only reads. The two text setters it hands back
 * take a value, not an updater.
 */
export function useScheduleDispatchAssignJobPicker({
  hubAssignJobPickerOpen,
  hubAssignJobPickerIntent,
  hubCellAddContext,
  hubMultiCellAddSelection,
  hubMergedRows,
  hubBids,
  hubWeekBlocks,
  hubPeopleNameById,
  role,
}: UseScheduleDispatchAssignJobPickerInput) {
  const [hubAssignJobPickerSearch, setHubAssignJobPickerSearch] = useState('')
  /** Money-rail evidence for picker rows, accumulated per job id (fetched only for short result lists). */
  const [hubJobEvidence, setHubJobEvidence] = useState<Map<string, JobSearchEvidence>>(() => new Map())
  const [hubAssignJobPickerNumberQuery, setHubAssignJobPickerNumberQuery] = useState('')

  /** The picker's search and number query start empty each time it opens (the modes hook calls this as it opens the picker). */
  const onPickerOpened = useCallback(() => {
    setHubAssignJobPickerSearch('')
    setHubAssignJobPickerNumberQuery('')
  }, [])

  const hubAssignJobPickerRows = useMemo(
    () => filterHubJobPickerRows(hubMergedRows, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery),
    [hubMergedRows, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery],
  )

  /**
   * Bid rows for the assign picker (v2.1613): same generic row shape the modal
   * renders, listed after every job row under their violet "Bid" chip. Search
   * matches bid number / project / address; the digits-only number query
   * matches bid_number.
   */
  const hubAssignBidPickerRows = useMemo(
    () => buildHubBidPickerRows(hubBids, hubWeekBlocks, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery),
    [hubBids, hubWeekBlocks, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery],
  )

  /** Enrich visible picker rows with money-rail evidence — short lists only, debounced, accumulating, failure-silent. */
  useEffect(() => {
    if (!hubAssignJobPickerOpen) return
    if (hubAssignJobPickerRows.length === 0 || hubAssignJobPickerRows.length > 30) return
    const missing = hubAssignJobPickerRows.filter((r) => !hubJobEvidence.has(r.id)).map((r) => r.id)
    if (missing.length === 0) return
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const got = await fetchJobSearchEvidence(missing, jobSearchEvidenceModeForRole(role))
          if (cancelled) return
          setHubJobEvidence((prev) => {
            const next = new Map(prev)
            for (const [k, v] of got) next.set(k, v)
            return next
          })
        } catch {
          // Rows simply render without the rail.
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [hubAssignJobPickerOpen, hubAssignJobPickerRows, hubJobEvidence, role])

  /** Same-address ambiguity warning — only while a search narrows the list (the full ledger always has repeats). */
  const hubAssignJobPickerDuplicateAddressNotice = useMemo(() => {
    const searching =
      hubAssignJobPickerSearch.trim() !== '' || hubAssignJobPickerNumberQuery.replace(/\D/g, '') !== ''
    if (!searching || hubAssignJobPickerRows.length > 8) return null
    const dup = findDuplicateJobAddress(hubAssignJobPickerRows)
    return dup ? `${dup.count} jobs at ${dup.address} — check the status before picking` : null
  }, [hubAssignJobPickerRows, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery])

  const hubEmptyCellChoiceSubtitle = useMemo(() => {
    if (!hubCellAddContext) return ''
    const name = hubPeopleNameById.get(hubCellAddContext.assigneeUserId) ?? 'Unknown'
    return `${name} · ${scheduleFormatWeekdayLong(hubCellAddContext.workDate)} (${hubCellAddContext.workDate})`
  }, [hubCellAddContext, hubPeopleNameById])

  const hubAssignJobPickerSubtitle = useMemo(() => {
    if (!hubAssignJobPickerOpen) return null
    if (hubAssignJobPickerIntent === 'multi') {
      return (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-600)' }}>
          Adding the same job to <strong>{hubMultiCellAddSelection.size}</strong> selected person/day cell
          {hubMultiCellAddSelection.size === 1 ? '' : 's'} (this week&apos;s hub list).
        </p>
      )
    }
    if (hubCellAddContext) {
      return (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-600)' }}>
          Pick a job to add a block for <strong>{hubEmptyCellChoiceSubtitle}</strong> (this week&apos;s hub list).
        </p>
      )
    }
    return null
  }, [
    hubAssignJobPickerOpen,
    hubAssignJobPickerIntent,
    hubMultiCellAddSelection.size,
    hubCellAddContext,
    hubEmptyCellChoiceSubtitle,
  ])

  const onSearchChange = useCallback((value: string) => setHubAssignJobPickerSearch(value), [])
  const onNumberQueryChange = useCallback((value: string) => setHubAssignJobPickerNumberQuery(value), [])

  return {
    hubAssignJobPickerSearch,
    setHubAssignJobPickerSearch: onSearchChange,
    hubAssignJobPickerNumberQuery,
    setHubAssignJobPickerNumberQuery: onNumberQueryChange,
    hubJobEvidence: hubJobEvidence as ReadonlyMap<string, JobSearchEvidence>,
    hubAssignJobPickerRows,
    hubAssignBidPickerRows,
    hubAssignJobPickerDuplicateAddressNotice,
    hubAssignJobPickerSubtitle,
    onPickerOpened,
  }
}
