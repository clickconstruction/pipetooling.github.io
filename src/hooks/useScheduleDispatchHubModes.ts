import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'
import type { useToastContext } from '../contexts/ToastContext'
import { scheduleBlockAnchorId, type JobScheduleBlockRow } from '../lib/jobScheduleBlocks'
import { moveScheduleDispatchBlockTo } from '../lib/scheduleDispatchDragEnd'
import { moveDayLabel } from '../lib/scheduleDispatchMoveBlock'
import { insertScheduleDispatchCopiedLeg } from '../lib/scheduleDispatchMirrorInsert'
import {
  summarizeLinkedCopyApply,
  summarizeLinkedCopyLaneApply,
  toggleLinkedCopyBlockSelection,
  type LinkedCopyLegResult,
  type LinkedCopyMode,
} from '../lib/scheduleDispatchLinkedCopy'
import { hubPersonDayKey } from '../lib/scheduleDispatchHub'
import {
  MULTI_CELL_ADD_TIME_END,
  MULTI_CELL_ADD_TIME_START,
  addJobToHubCells,
  summarizeMultiCellAddResult,
} from '../lib/scheduleDispatch/multiCellAdd'
import { hubModeClears, type HubModeEntry, type HubModePageEntry } from '../lib/scheduleDispatch/hubModes'
import { validateScheduleDispatchBlockTimeRange } from '../components/schedule/scheduleDispatchRemoveBlockModal'
import type { ScheduleDispatchCardPlacementMode, ScheduleDispatchCardPlacementVariant } from '../components/schedule/ScheduleDispatchGrid'
import type { useScheduleDispatchHubData } from './useScheduleDispatchHubData'

export type HubAssignJobPlacementState = { jobId: string }

export type HubCellAddContextState = { assigneeUserId: string; workDate: string }

export type HubAssignJobPickerIntent = 'toolbar' | 'cell' | 'multi'

type HubData = ReturnType<typeof useScheduleDispatchHubData>

export interface UseScheduleDispatchHubModesInput {
  /** The vestigial job-week view's job; always '' on this page (quirk #1). */
  jobId: string
  isTomorrow: boolean
  hubTab: 'people' | 'jobs' | 'day'
  weekStart: string
  hubLoading: boolean
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
  canEdit: boolean
  authUser: { id: string } | null
  showToast: ReturnType<typeof useToastContext>['showToast']
  /** The vestigial job-week view's blocks, by id and as a list. */
  blockById: Map<string, JobScheduleBlockRow>
  blocks: JobScheduleBlockRow[]
  hubBlockById: HubData['hubBlockById']
  hubWeekBlocks: HubData['hubWeekBlocks']
  hubPeopleNameById: HubData['hubPeopleNameById']
  /** The vestigial job-week view's reload. */
  load: () => Promise<void>
  loadHub: HubData['loadHub']
  /** The picker's search and number query, page-owned, start empty each time it opens. */
  onPickerOpened: () => void
  /** Closes the page's add-block window: `addBlock` in the mode rule. */
  closeAddBlockWindow: () => void
}

/**
 * The Dispatch hub's interaction modes (the SCHEDULE_DISPATCH map's step 6): moving or copying a
 * block and its + menu, the two-stage linked copy, placing a picked job, the multi-cell add, and
 * the job picker with its intent and cell. This hook owns every one of those flags and the rule
 * that entering one leaves the others (`lib/scheduleDispatch/hubModes.ts`): `leave(entry)` is the
 * only place a flag is cleared, and it clears exactly the row's `end` cells.
 *
 * It hands the page intents and the mode banners' three clearers, never a flag's setter, so the
 * page cannot change a mode around the rule. The writers outside the modes (the add-block window,
 * the tabs, the week arrows, the new-job path) go through `leaveModesFor`, `pickJobToPlace` and
 * `placeNewJob`. Moved from `ScheduleDispatchHubPage` verbatim, except that each handler's run of
 * clearing setters is its row's `leave(...)`.
 */
export function useScheduleDispatchHubModes({
  jobId,
  isTomorrow,
  hubTab,
  weekStart,
  hubLoading,
  searchParams,
  setSearchParams,
  canEdit,
  authUser,
  showToast,
  blockById,
  blocks,
  hubBlockById,
  hubWeekBlocks,
  hubPeopleNameById,
  load,
  loadHub,
  onPickerOpened,
  closeAddBlockWindow,
}: UseScheduleDispatchHubModesInput) {
  const [cardPlacementMode, setCardPlacementMode] = useState<ScheduleDispatchCardPlacementMode | null>(null)
  /** Two-stage "copy jobs linked to people" flow (toolbar chains button). */
  const [linkedCopyMode, setLinkedCopyMode] = useState<LinkedCopyMode | null>(null)
  const [linkedCopyApplyBusy, setLinkedCopyApplyBusy] = useState(false)
  const [plusMenuBlockId, setPlusMenuBlockId] = useState<string | null>(null)
  const [hubAssignJobPlacement, setHubAssignJobPlacement] = useState<HubAssignJobPlacementState | null>(null)
  const [hubAssignJobPickerOpen, setHubAssignJobPickerOpen] = useState(false)
  const [hubCellAddContext, setHubCellAddContext] = useState<HubCellAddContextState | null>(null)
  const [hubAssignJobPickerIntent, setHubAssignJobPickerIntent] = useState<HubAssignJobPickerIntent>('toolbar')
  const [hubMultiCellAddActive, setHubMultiCellAddActive] = useState(false)
  const [hubMultiCellAddSelection, setHubMultiCellAddSelection] = useState<Set<string>>(() => new Set())
  const placeJobArmKeyRef = useRef<string>('')

  const stripPlaceJobFromUrl = useCallback(() => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (!n.has('placeJob')) return prev
      n.delete('placeJob')
      return n
    }, { replace: true })
  }, [setSearchParams])

  // `leave` is the one place a flag is cleared. It reads the page's two callbacks through refs, so
  // it never changes and the effects that call it keep the timing they had in the page.
  const closeAddBlockWindowRef = useRef(closeAddBlockWindow)
  closeAddBlockWindowRef.current = closeAddBlockWindow
  const stripPlaceJobFromUrlRef = useRef(stripPlaceJobFromUrl)
  stripPlaceJobFromUrlRef.current = stripPlaceJobFromUrl
  const leave = useCallback((entry: HubModeEntry) => {
    const ends = hubModeClears(entry)
    if (ends.has('placement')) setCardPlacementMode(null)
    if (ends.has('plusMenu')) setPlusMenuBlockId(null)
    if (ends.has('linkedCopy')) setLinkedCopyMode(null)
    if (ends.has('assignPlacement')) setHubAssignJobPlacement(null)
    if (ends.has('multiCell')) {
      setHubMultiCellAddActive(false)
      setHubMultiCellAddSelection(new Set())
    }
    if (ends.has('picker')) setHubAssignJobPickerOpen(false)
    if (ends.has('pickerIntent')) setHubAssignJobPickerIntent('toolbar')
    if (ends.has('cellContext')) setHubCellAddContext(null)
    if (ends.has('addBlock')) closeAddBlockWindowRef.current()
    if (ends.has('placeJobParam')) stripPlaceJobFromUrlRef.current()
    if (ends.has('armKey')) placeJobArmKeyRef.current = ''
  }, [])

  /** The page's own writers end modes only through the rule. */
  const leaveModesFor = useCallback((entry: HubModePageEntry) => leave(entry), [leave])

  /** A job picked in the toolbar picker: the placing strip for it. */
  const pickJobToPlace = useCallback(
    (pickedJobId: string) => {
      leave('pickJobToPlace')
      setHubAssignJobPlacement({ jobId: pickedJobId })
    },
    [leave],
  )

  /** A new job saved from the picker with no cell to put it on: the placing strip for it. */
  const placeNewJob = useCallback(
    (newJobId: string) => {
      leave('newJobToPlace')
      setHubAssignJobPlacement({ jobId: newJobId })
    },
    [leave],
  )

  /** A block's + button opens its menu, or shuts it with null. */
  const onPlusMenuBlockIdChange = useCallback(
    (blockId: string | null) => {
      leave('togglePlusMenu')
      setPlusMenuBlockId(blockId)
    },
    [leave],
  )

  // The mode banners' three clearers (ScheduleDispatchModeBanners): each ends one flag and takes
  // only null, so they cannot turn a mode on.
  const clearCardPlacementMode = useCallback((next: null) => setCardPlacementMode(next), [])
  const clearPlusMenuBlockId = useCallback((next: null) => setPlusMenuBlockId(next), [])
  const clearLinkedCopyMode = useCallback((next: null) => setLinkedCopyMode(next), [])

  const placementSourceBlock = useMemo(() => {
    if (!cardPlacementMode) return null
    const m = jobId ? blockById : hubBlockById
    return m.get(cardPlacementMode.sourceBlockId) ?? null
  }, [cardPlacementMode, jobId, blockById, hubBlockById])

  useEffect(() => {
    leave('weekChanged')
  }, [weekStart, leave])

  useEffect(() => {
    if (jobId) return
    if (isTomorrow) {
      leave('urlIdle')
      return
    }
    const pj = searchParams.get('placeJob')?.trim() ?? ''
    if (!pj) {
      leave('urlIdle')
      return
    }
    if (hubTab === 'jobs') {
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev)
        n.set('week', weekStart)
        n.delete('hubTab')
        n.set('placeJob', pj)
        return n
      }, { replace: true })
      return
    }
    if (hubLoading) return
    const key = `${pj}|${weekStart}`
    if (placeJobArmKeyRef.current === key) return
    placeJobArmKeyRef.current = key
    leave('urlArm')
    setHubAssignJobPlacement({ jobId: pj })
  }, [isTomorrow, jobId, weekStart, hubTab, hubLoading, searchParams, setSearchParams, leave])

  useEffect(() => {
    if (!jobId) return
    leave('jobWeek')
  }, [jobId, leave])

  useEffect(() => {
    if (!cardPlacementMode && !hubAssignJobPlacement) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        leave('escapePlacement')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cardPlacementMode, hubAssignJobPlacement, setSearchParams, leave])

  useEffect(() => {
    if (!linkedCopyMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave('escapeLinkedCopy')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [linkedCopyMode, leave])

  useEffect(() => {
    if (!hubMultiCellAddActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave('escapeMultiCell')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hubMultiCellAddActive, leave])

  const onCancelCardPlacement = useCallback(() => {
    leave('cancelPlacement')
  }, [leave])

  const onStartCardPlacement = useCallback(
    (source: JobScheduleBlockRow, variant: ScheduleDispatchCardPlacementVariant) => {
      if (!canEdit) return
      if (jobId) {
        if (source.job_id !== jobId) return
      } else if (hubTab !== 'people') {
        showToast('Switch to the People tab to place a copy on the grid.', 'info')
        return
      }
      leave('startPlacement')
      setCardPlacementMode({ sourceBlockId: source.id, variant })
      if (variant === 'move') {
        showToast('Tap a day above, or any cell, to move this block there. Cancel to keep it where it is.', 'info')
        return
      }
      const extra =
        variant === 'linked'
          ? ' Linked copies stay on the same work day as the source.'
          : ' Solo copies can go on any day in this week.'
      showToast(`Click a team member's day cell to add the copy. Press Esc to cancel.${extra}`, 'info')
    },
    [canEdit, jobId, hubTab, showToast, leave],
  )

  const onCardPlacementPickCell = useCallback(
    async (assigneeUserId: string, workDate: string) => {
      if (!cardPlacementMode || !authUser?.id) return
      const placementVariant = cardPlacementMode.variant
      const sourceBlockId = cardPlacementMode.sourceBlockId

      if (placementVariant === 'move') {
        // Tap-to-move: same kernel as a drop, on either grid.
        const moved = await moveScheduleDispatchBlockTo(
          sourceBlockId,
          { workDate, assigneeUserId },
          {
            blockById: jobId ? blockById : hubBlockById,
            canEdit,
            showToast,
            onSuccess: async () => {
              if (jobId) await load()
              else await loadHub({ quiet: true })
            },
          },
        )
        if (moved) {
          leave('placementDone')
          showToast(`Moved to ${moveDayLabel(workDate)}.`, 'success')
        }
        return
      }

      if (jobId) {
        const source = blockById.get(sourceBlockId)
        if (!source || source.job_id !== jobId) {
          leave('placementDone')
          return
        }
        if (placementVariant === 'linked' && workDate !== source.work_date) {
          showToast(
            'Linked copies use the source block’s day. Use drag to move the whole crew to another day.',
            'info',
          )
          return
        }

        const { error } = await insertScheduleDispatchCopiedLeg({
          jobId,
          createdBy: authUser.id,
          source,
          targetAssigneeUserId: assigneeUserId,
          targetWorkDate: workDate,
          linkMode: placementVariant === 'linked' ? 'linked' : 'unlinked',
          allJobBlocks: blocks,
        })
        if (error) {
          showToast(error, 'error')
          return
        }
        leave('placementDone')
        showToast(placementVariant === 'linked' ? 'Linked copy added.' : 'Solo copy added.', 'success')
        await load()
        return
      }

      const source = hubBlockById.get(sourceBlockId)
      if (!source) {
        leave('placementDone')
        return
      }
      if (placementVariant === 'linked' && workDate !== source.work_date) {
        showToast(
          'Linked copies use the source block’s day. Use drag to move the whole crew to another day.',
          'info',
        )
        return
      }

      const allJobBlocks = hubWeekBlocks.filter((b) => scheduleBlockAnchorId(b) === scheduleBlockAnchorId(source))
      const { error: hubInsErr } = await insertScheduleDispatchCopiedLeg({
        jobId: scheduleBlockAnchorId(source),
        createdBy: authUser.id,
        source,
        targetAssigneeUserId: assigneeUserId,
        targetWorkDate: workDate,
        linkMode: placementVariant === 'linked' ? 'linked' : 'unlinked',
        allJobBlocks,
      })
      if (hubInsErr) {
        showToast(hubInsErr, 'error')
        return
      }
      leave('placementDone')
      showToast(placementVariant === 'linked' ? 'Linked copy added.' : 'Solo copy added.', 'success')
      await loadHub({ quiet: true })
    },
    [
      cardPlacementMode,
      jobId,
      authUser?.id,
      canEdit,
      blockById,
      hubBlockById,
      blocks,
      hubWeekBlocks,
      load,
      loadHub,
      showToast,
      leave,
    ],
  )

  const onCancelHubAssignJobPlacement = useCallback(() => {
    leave('cancelAssign')
  }, [leave])

  const onRequestHubAddJob = useCallback(() => {
    leave('openToolbarPicker')
    setHubAssignJobPickerIntent('toolbar')
    onPickerOpened()
    setHubAssignJobPickerOpen(true)
  }, [leave, onPickerOpened])

  const onHubEmptyCellOpenChoice = useCallback((personUserId: string, workDate: string) => {
    leave('openCellPicker')
    setHubCellAddContext({ assigneeUserId: personUserId, workDate })
    setHubAssignJobPickerIntent('cell')
    onPickerOpened()
    setHubAssignJobPickerOpen(true)
  }, [leave, onPickerOpened])

  const onRequestHubMultiCellAddChooseJob = useCallback(() => {
    if (hubMultiCellAddSelection.size === 0) return
    leave('openMultiPicker')
    setHubAssignJobPickerIntent('multi')
    onPickerOpened()
    setHubAssignJobPickerOpen(true)
  }, [hubMultiCellAddSelection, leave, onPickerOpened])

  const closeHubAssignJobPicker = useCallback(() => {
    leave('closePicker')
  }, [leave])

  const onRequestHubMultiCellAddMode = useCallback(() => {
    if (hubMultiCellAddActive) {
      leave('endMultiCell')
      return
    }
    leave('startMultiCell')
    setHubMultiCellAddSelection(new Set())
    setHubMultiCellAddActive(true)
  }, [hubMultiCellAddActive, leave])

  const onHubMultiCellAddToggle = useCallback((personUserId: string, workDate: string) => {
    const k = hubPersonDayKey(personUserId, workDate)
    setHubMultiCellAddSelection((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }, [])

  const applyHubMultiCellJob = useCallback(
    async (targetJobId: string, selectionKeys: readonly string[]) => {
      const createdBy = authUser?.id
      if (!createdBy) {
        showToast('You must be signed in to add blocks.', 'error')
        return
      }
      if (selectionKeys.length === 0) {
        showToast('No cells selected.', 'info')
        return
      }
      const rangeErr = validateScheduleDispatchBlockTimeRange(MULTI_CELL_ADD_TIME_START, MULTI_CELL_ADD_TIME_END)
      if (rangeErr) {
        showToast(rangeErr, 'error')
        return
      }
      const counts = await addJobToHubCells({ targetJobId, selectionKeys, createdBy })
      const summary = summarizeMultiCellAddResult(counts)
      showToast(summary.message, summary.tone)

      leave('multiCellApplied')
      await loadHub({ quiet: true })
    },
    [authUser?.id, showToast, loadHub, leave],
  )

  /** Toolbar chains button: enter (or exit) the two-stage linked-copy flow. */
  const onStartLinkedCopyMode = useCallback(() => {
    if (linkedCopyMode) {
      leave('endLinkedCopy')
      return
    }
    leave('startLinkedCopy')
    setLinkedCopyMode({ stage: 1, selectedBlockIds: new Set() })
  }, [linkedCopyMode, leave])

  /** Stage 1: card click toggles a source block in/out of the selection. */
  const onLinkedCopyToggleBlock = useCallback((blockId: string) => {
    setLinkedCopyMode((m) =>
      m && m.stage === 1
        ? { ...m, selectedBlockIds: toggleLinkedCopyBlockSelection(m.selectedBlockIds, blockId) }
        : m,
    )
  }, [])

  const onLinkedCopySetStage = useCallback((stage: 1 | 2) => {
    setLinkedCopyMode((m) => (m ? { ...m, stage } : m))
  }, [])

  /** Stage 2: person click applies a linked copy of every selected block to them
   * (each on its source block's own day; per-leg overlap/duplicate safety lives
   * in insertScheduleDispatchCopiedLeg). Mode stays active for more people. */
  const onLinkedCopyApplyToPerson = useCallback(
    async (personUserId: string) => {
      if (!linkedCopyMode || linkedCopyMode.stage !== 2 || !authUser?.id || linkedCopyApplyBusy) return
      const sources = [...linkedCopyMode.selectedBlockIds]
        .map((id) => hubBlockById.get(id))
        .filter((b): b is JobScheduleBlockRow => b != null)
      if (sources.length === 0) return
      setLinkedCopyApplyBusy(true)
      try {
        const results: LinkedCopyLegResult[] = []
        for (const source of sources) {
          const allJobBlocks = hubWeekBlocks.filter((b) => scheduleBlockAnchorId(b) === scheduleBlockAnchorId(source))
          const { error } = await insertScheduleDispatchCopiedLeg({
            jobId: scheduleBlockAnchorId(source),
            createdBy: authUser.id,
            source,
            targetAssigneeUserId: personUserId,
            targetWorkDate: source.work_date,
            linkMode: 'linked',
            allJobBlocks,
          })
          results.push({ blockId: source.id, error })
        }
        const sum = summarizeLinkedCopyApply(results)
        const personName = hubPeopleNameById.get(personUserId) ?? 'Person'
        showToast(`${personName}: ${sum.message}`, sum.tone)
        await loadHub({ quiet: true })
      } finally {
        setLinkedCopyApplyBusy(false)
      }
    },
    [
      linkedCopyMode,
      linkedCopyApplyBusy,
      authUser?.id,
      hubBlockById,
      hubWeekBlocks,
      hubPeopleNameById,
      loadHub,
      showToast,
    ],
  )

  /** Stage 2 + lanes grouping: lane-heading click = the person apply for every
   * crew member, one combined toast (per-leg safety unchanged). */
  const onLinkedCopyApplyToLane = useCallback(
    async (laneLabel: string, memberUserIds: string[]) => {
      if (!linkedCopyMode || linkedCopyMode.stage !== 2 || !authUser?.id || linkedCopyApplyBusy) return
      const sources = [...linkedCopyMode.selectedBlockIds]
        .map((id) => hubBlockById.get(id))
        .filter((b): b is JobScheduleBlockRow => b != null)
      if (sources.length === 0 || memberUserIds.length === 0) return
      setLinkedCopyApplyBusy(true)
      try {
        const results: LinkedCopyLegResult[] = []
        for (const memberUserId of memberUserIds) {
          for (const source of sources) {
            const allJobBlocks = hubWeekBlocks.filter((b) => scheduleBlockAnchorId(b) === scheduleBlockAnchorId(source))
            const { error } = await insertScheduleDispatchCopiedLeg({
              jobId: scheduleBlockAnchorId(source),
              createdBy: authUser.id,
              source,
              targetAssigneeUserId: memberUserId,
              targetWorkDate: source.work_date,
              linkMode: 'linked',
              allJobBlocks,
            })
            results.push({ blockId: source.id, error })
          }
        }
        const sum = summarizeLinkedCopyLaneApply(laneLabel, memberUserIds.length, results)
        showToast(sum.message, sum.tone)
        await loadHub({ quiet: true })
      } finally {
        setLinkedCopyApplyBusy(false)
      }
    },
    [
      linkedCopyMode,
      linkedCopyApplyBusy,
      authUser?.id,
      hubBlockById,
      hubWeekBlocks,
      loadHub,
      showToast,
    ],
  )

  /** v2.3156: the phone board's Copy to techs sheet — one block to a chosen list of people, no mode state needed. */
  const onCopyBlockToPeople = useCallback(
    async (args: { blockId: string; userIds: string[]; linked: boolean }): Promise<{ applied: number } | null> => {
      // `null` = nothing was attempted (the sheet stays open); the busy case is silent, the rest say why.
      if (!authUser?.id || linkedCopyApplyBusy) return null
      const source = hubBlockById.get(args.blockId)
      if (!source) {
        showToast('That block is no longer on the schedule.', 'error')
        return null
      }
      if (args.userIds.length === 0) return null
      setLinkedCopyApplyBusy(true)
      try {
        const results: LinkedCopyLegResult[] = []
        const allJobBlocks = hubWeekBlocks.filter((b) => scheduleBlockAnchorId(b) === scheduleBlockAnchorId(source))
        for (const userId of args.userIds) {
          const { error } = await insertScheduleDispatchCopiedLeg({
            jobId: scheduleBlockAnchorId(source),
            createdBy: authUser.id,
            source,
            targetAssigneeUserId: userId,
            targetWorkDate: source.work_date,
            linkMode: args.linked ? 'linked' : 'unlinked',
            allJobBlocks,
          })
          results.push({ blockId: source.id, error })
        }
        const sum = summarizeLinkedCopyLaneApply('Selected techs', args.userIds.length, results, { linked: args.linked })
        showToast(sum.message, sum.tone)
        await loadHub({ quiet: true })
        return { applied: sum.applied }
      } finally {
        setLinkedCopyApplyBusy(false)
      }
    },
    [authUser?.id, linkedCopyApplyBusy, hubBlockById, hubWeekBlocks, loadHub, showToast],
  )

  return {
    cardPlacementMode,
    plusMenuBlockId,
    linkedCopyMode,
    linkedCopyApplyBusy,
    hubAssignJobPlacement,
    hubAssignJobPickerOpen,
    hubAssignJobPickerIntent,
    hubCellAddContext,
    hubMultiCellAddActive,
    hubMultiCellAddSelection,
    placementSourceBlock,
    setCardPlacementMode: clearCardPlacementMode,
    setPlusMenuBlockId: clearPlusMenuBlockId,
    setLinkedCopyMode: clearLinkedCopyMode,
    onPlusMenuBlockIdChange,
    onCancelCardPlacement,
    onStartCardPlacement,
    onCardPlacementPickCell,
    onCancelHubAssignJobPlacement,
    onRequestHubAddJob,
    onHubEmptyCellOpenChoice,
    onRequestHubMultiCellAddMode,
    onHubMultiCellAddToggle,
    onRequestHubMultiCellAddChooseJob,
    closeHubAssignJobPicker,
    applyHubMultiCellJob,
    onStartLinkedCopyMode,
    onLinkedCopyToggleBlock,
    onLinkedCopySetStage,
    onLinkedCopyApplyToPerson,
    onLinkedCopyApplyToLane,
    onCopyBlockToPeople,
    leaveModesFor,
    pickJobToPlace,
    placeNewJob,
  }
}
