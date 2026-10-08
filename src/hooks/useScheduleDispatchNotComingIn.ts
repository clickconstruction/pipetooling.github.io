import { useCallback, useState } from 'react'
import type { ScheduleDispatchHubData } from './useScheduleDispatchHubData'
import type { useToastContext } from '../contexts/ToastContext'
import { scheduleFormatWeekdayLong } from '../lib/jobScheduleChicago'
import { recordNotComingInForUserAsStaff, removeNotComingInForUserAsStaff } from '../lib/notComingInTimeOff'
import { hubPersonDayKey } from '../lib/scheduleDispatchHub'
import { userTimeOffCellKey } from '../lib/userTimeOffByCell'
import { ncnsResultToasts, notComingInResultToasts } from '../lib/scheduleDispatchNotComingInCopy'
import { removePersonDayBlocks } from '../lib/scheduleDispatch/removePersonDayBlocks'
import { recordNcnsForPersonDay } from '../lib/scheduleDispatch/recordNcns'

export type ScheduleDispatchNotComingInInput = Pick<
  ScheduleDispatchHubData,
  'hubPeopleNameById' | 'hubPersonDayBlocks' | 'hubUserTimeOffByCell' | 'loadHub' | 'refreshHubUserTimeOff'
> & {
  /** Always `''` on the hub page (SCHEDULE_DISPATCH map, quirk "`jobId = ''` vestigial dual-mode"); with `load`, the dead job-week reload branch stays verbatim. */
  jobId: string
  load: () => Promise<void>
  /** The page's edit gate — the undo asks for it again. */
  canEdit: boolean
  showToast: ReturnType<typeof useToastContext>['showToast']
}

/**
 * The Schedule Dispatch hub's not-coming-in flows (moved out of ScheduleDispatchHubPage,
 * punch list #46 row 7, the SCHEDULE_DISPATCH map's step 4): mark a person-day not
 * coming in (the empty cell's "off" behind its confirm, and the assign picker), record a
 * no-call-no-show, and undo either from the cell's chip. The writes are the tested kernels;
 * this holds the busy flags, the confirm targets, the toasts and the quiet reload. The two
 * picker entries stay in the page — they read the picker's cell and close it, then call
 * `markNotComingInForPersonDay` / `recordNcnsOnPersonDay`. A verbatim move: no behaviour changed.
 */
export function useScheduleDispatchNotComingIn({
  jobId,
  load,
  canEdit,
  showToast,
  hubPeopleNameById,
  hubPersonDayBlocks,
  hubUserTimeOffByCell,
  loadHub,
  refreshHubUserTimeOff,
}: ScheduleDispatchNotComingInInput) {
  const [notComingInBusy, setNotComingInBusy] = useState(false)

  /** Shared core: record unpaid time off + remove any blocks for the day (verbatim
   * from the assign-picker flow; also used by the empty-cell "off" button). */
  const markNotComingInForPersonDay = useCallback(async (subjectUserId: string, workDateYmd: string) => {
    const personName = hubPeopleNameById.get(subjectUserId) ?? 'Team member'
    const existingBlockIds = (
      hubPersonDayBlocks.get(hubPersonDayKey(subjectUserId, workDateYmd)) ?? []
    ).map((b) => b.id)

    setNotComingInBusy(true)
    const result = await recordNotComingInForUserAsStaff({ subjectUserId, workDateYmd })

    if (!result.ok) {
      setNotComingInBusy(false)
      showToast(result.message, 'error')
      return
    }

    const { removed, failed } = await removePersonDayBlocks(existingBlockIds)
    for (const t of notComingInResultToasts({
      personName,
      workDateYmd,
      alreadyMarked: result.alreadyMarked,
      syncWarning: result.alreadyMarked ? undefined : result.syncWarning,
      removed,
      failed,
    })) {
      showToast(t.message, t.tone)
    }

    if (jobId) {
      await load()
    } else {
      await loadHub({ quiet: true })
    }
    void refreshHubUserTimeOff()
    setNotComingInBusy(false)
  }, [
    hubPeopleNameById,
    hubPersonDayBlocks,
    showToast,
    jobId,
    load,
    loadHub,
    refreshHubUserTimeOff,
  ])

  /**
   * NCNS for one person-day (v2.2540; the assign picker reads its cell and calls this).
   * The writes and their order are `recordNcnsForPersonDay`; on any RPC refusal nothing
   * else happens — no half-marked day, no reload.
   */
  const recordNcnsOnPersonDay = useCallback(
    async (subjectUserId: string, workDateYmd: string, details: string) => {
      const personName = hubPeopleNameById.get(subjectUserId) ?? 'Team member'
      const existingBlockIds = (
        hubPersonDayBlocks.get(hubPersonDayKey(subjectUserId, workDateYmd)) ?? []
      ).map((b) => b.id)
      setNotComingInBusy(true)
      try {
        const result = await recordNcnsForPersonDay({ subjectUserId, workDateYmd, details, existingBlockIds })
        if (!result.ok) {
          showToast(result.message, 'error')
          return
        }
        for (const t of ncnsResultToasts({
          personName,
          workDateYmd,
          rejectedCount: result.rejectedCount,
          hadApprovedSessions: result.hadApprovedSessions,
          removed: result.removed,
          failed: result.failed,
          timeOff: result.timeOff,
        })) {
          showToast(t.message, t.tone)
        }

        if (jobId) {
          await load()
        } else {
          await loadHub({ quiet: true })
        }
        void refreshHubUserTimeOff()
      } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), 'error')
      } finally {
        setNotComingInBusy(false)
      }
    },
    [
      hubPeopleNameById,
      hubPersonDayBlocks,
      showToast,
      jobId,
      load,
      loadHub,
      refreshHubUserTimeOff,
    ],
  )

  /**
   * Empty-cell "off" button (J18-F3): asks first. The button only renders on a
   * cell with zero blocks, so the write is a time-off row and nothing else —
   * but it sits 20px from `+` on the board's densest row, and the only undo
   * is the chip's own confirm modal. One confirm makes the pair symmetric.
   */
  const [markOffConfirmTarget, setMarkOffConfirmTarget] = useState<
    { personUserId: string; workDate: string; personLabel: string; workDateLabel: string } | null
  >(null)
  const onMarkNotComingInForCell = useCallback(
    (personUserId: string, workDate: string) => {
      if (notComingInBusy) return
      setMarkOffConfirmTarget({
        personUserId,
        workDate,
        personLabel: hubPeopleNameById.get(personUserId) ?? 'Team member',
        workDateLabel: scheduleFormatWeekdayLong(workDate),
      })
    },
    [notComingInBusy, hubPeopleNameById],
  )
  const cancelMarkOffForCell = useCallback(() => setMarkOffConfirmTarget(null), [])
  const confirmMarkOffForCell = useCallback(() => {
    const target = markOffConfirmTarget
    setMarkOffConfirmTarget(null)
    if (!target || notComingInBusy) return
    void markNotComingInForPersonDay(target.personUserId, target.workDate)
  }, [markOffConfirmTarget, notComingInBusy, markNotComingInForPersonDay])

  // ──────────────────────────────────────────────────────────────────────
  // Undo "Not coming in" — confirm modal driven by a click on the cell chip.
  // ──────────────────────────────────────────────────────────────────────
  const [undoNotComingInTarget, setUndoNotComingInTarget] = useState<
    | {
        personUserId: string
        personLabel: string
        workDate: string
        workDateLabel: string
        /** NCNS chip: sterner modal copy — the attendance incident stays on record. */
        isNcns: boolean
      }
    | null
  >(null)
  const [undoNotComingInBusy, setUndoNotComingInBusy] = useState(false)

  const handleRequestUndoNotComingIn = useCallback(
    (personUserId: string, workDate: string) => {
      if (!canEdit) return
      const personLabel = hubPeopleNameById.get(personUserId) ?? 'Team member'
      const cellInfo = hubUserTimeOffByCell.get(userTimeOffCellKey(personUserId, workDate))
      setUndoNotComingInTarget({
        personUserId,
        personLabel,
        workDate,
        workDateLabel: scheduleFormatWeekdayLong(workDate),
        isNcns: cellInfo?.variant === 'ncns',
      })
    },
    [canEdit, hubPeopleNameById, hubUserTimeOffByCell],
  )

  const handleCancelUndoNotComingIn = useCallback(() => {
    if (undoNotComingInBusy) return
    setUndoNotComingInTarget(null)
  }, [undoNotComingInBusy])

  const handleConfirmUndoNotComingIn = useCallback(async () => {
    const target = undoNotComingInTarget
    if (!target || !canEdit) return
    setUndoNotComingInBusy(true)
    try {
      const result = await removeNotComingInForUserAsStaff({
        subjectUserId: target.personUserId,
        workDateYmd: target.workDate,
      })
      if (!result.ok) {
        showToast(result.message, 'error')
        return
      }
      if (result.deleted === 0) {
        // Already cleared by someone else — refresh quietly so the chip goes away.
        showToast(`${target.personLabel} was already cleared for ${target.workDate}.`, 'warning')
      } else {
        showToast(
          target.isNcns
            ? `NCNS schedule mark cleared for ${target.personLabel} (${target.workDate}). The attendance incident stays on record.`
            : `${target.personLabel} is no longer marked Not coming in (${target.workDate}).`,
          'success',
        )
        if (result.syncWarning) {
          showToast(`Salary sync: ${result.syncWarning}`, 'warning')
        }
      }
      setUndoNotComingInTarget(null)
      if (jobId) {
        await load()
      } else {
        await loadHub({ quiet: true })
      }
      void refreshHubUserTimeOff()
    } finally {
      setUndoNotComingInBusy(false)
    }
  }, [
    undoNotComingInTarget,
    canEdit,
    showToast,
    jobId,
    load,
    loadHub,
    refreshHubUserTimeOff,
  ])

  return {
    notComingInBusy,
    markNotComingInForPersonDay,
    recordNcnsOnPersonDay,
    markOffConfirmTarget,
    onMarkNotComingInForCell,
    cancelMarkOffForCell,
    confirmMarkOffForCell,
    undoNotComingInTarget,
    undoNotComingInBusy,
    handleRequestUndoNotComingIn,
    handleCancelUndoNotComingIn,
    handleConfirmUndoNotComingIn,
  }
}
