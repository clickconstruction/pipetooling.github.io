import { useCallback, useMemo, useState, type ComponentProps } from 'react'
import type { useToastContext } from '../contexts/ToastContext'
import { blockCoverageKey, coverageOfAssignees, supervisionWarningFor } from '../lib/schedule/blockGroupCoverage'
import { dispatchMinutesToHHmm, timeInputToPg } from '../lib/dispatchAddBlockTime'
import { scheduleTimeToMinutesFromMidnight } from '../lib/jobScheduleOverlap'
import { defaultNewBlockRangeInFirstGap, type AddBlockTimelineSegment } from '../lib/scheduleDispatchAddBlockTimeline'
import { scheduleBlockAnchorId, type JobScheduleBlockRow } from '../lib/jobScheduleBlocks'
import { formatScheduleDispatchHubJobTitle, hubPersonDayKey } from '../lib/scheduleDispatchHub'
import { saveEditedScheduleBlockTimes, saveNewScheduleBlockForPersonDay } from '../lib/scheduleDispatchAddBlockSave'
import type { HubModePageEntry } from '../lib/scheduleDispatch/hubModes'
import type { ScheduleDispatchAddBlockModal } from '../components/schedule/ScheduleDispatchAddBlockModal'
import type { useScheduleDispatchHubData } from './useScheduleDispatchHubData'

export type ScheduleDispatchBlockModalState =
  | { kind: 'add'; assigneeUserId: string; workDate: string; jobId: string }
  | { kind: 'edit'; blockId: string }

type HubData = ReturnType<typeof useScheduleDispatchHubData>

export interface UseScheduleDispatchAddBlockModalInput {
  /** The vestigial job-week view's job, its title and blocks; '' and empty on this page (quirk #1). */
  jobId: string
  jobTitle: string
  blocks: JobScheduleBlockRow[]
  blockById: Map<string, JobScheduleBlockRow>
  nameByUserId: Map<string, string>
  hubPersonDayBlocks: HubData['hubPersonDayBlocks']
  hubJobTitleById: HubData['hubJobTitleById']
  hubPeopleNameById: HubData['hubPeopleNameById']
  hubPersonById: HubData['hubPersonById']
  hubBlockCoverageByKey: HubData['hubBlockCoverageByKey']
  getHubJobDisplayTitle: HubData['getHubJobDisplayTitle']
  authUser: { id: string } | null
  showToast: ReturnType<typeof useToastContext>['showToast']
  /** The vestigial job-week view's reload. */
  load: () => Promise<void>
  loadHub: HubData['loadHub']
  /** The modes hook's door: opening and shutting the window go through the mode rule, which owns every mode. */
  leaveModesFor: (entry: Extract<HubModePageEntry, 'openAddBlock' | 'closeAddBlock'>) => void
}

/** The add-block window's props, all but `onRemove`: the dormant edit-mode Remove needs the page's delete flow. */
export type ScheduleDispatchAddBlockModalProps = Omit<ComponentProps<typeof ScheduleDispatchAddBlockModal>, 'onRemove'>

/**
 * The Dispatch hub's add-block window (the SCHEDULE_DISPATCH map's step 6): which person, day and
 * job it is open for, its times, note, saving and error, the person-day's timeline and the drafts
 * the timeline edits, the opener that seeds the first free gap, the save, and the props the window
 * draws from. Moved from `ScheduleDispatchHubPage` verbatim; the window's JSX became the props it
 * returns.
 *
 * It owns no mode. Opening and shutting go through the modes hook's `leaveModesFor` ('openAddBlock'
 * and 'closeAddBlock'), and the modes hook shuts the window through `closeAddBlockWindow` when a
 * placement starts. The `kind: 'edit'` branch stays, dormant on this page (quirk #1).
 */
export function useScheduleDispatchAddBlockModal({
  jobId,
  jobTitle,
  blocks,
  blockById,
  nameByUserId,
  hubPersonDayBlocks,
  hubJobTitleById,
  hubPeopleNameById,
  hubPersonById,
  hubBlockCoverageByKey,
  getHubJobDisplayTitle,
  authUser,
  showToast,
  load,
  loadHub,
  leaveModesFor,
}: UseScheduleDispatchAddBlockModalInput) {
  const [blockModalState, setBlockModalState] = useState<ScheduleDispatchBlockModalState | null>(null)
  const [addTimeStart, setAddTimeStart] = useState('08:00')
  const [addTimeEnd, setAddTimeEnd] = useState('16:00')
  const [addNote, setAddNote] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addBlockTimelineSegments, setAddBlockTimelineSegments] = useState<AddBlockTimelineSegment[]>([])
  const [addBlockDraftByBlockId, setAddBlockDraftByBlockId] = useState<
    Record<string, { time_start: string; time_end: string }>
  >({})

  /** Entering a placement closes the add-block window (`addBlock` in the mode rule). */
  const closeAddBlockWindow = useCallback(() => {
    setBlockModalState(null)
    setAddError(null)
  }, [])

  const openAddBlock = useCallback(
    (args: { assigneeUserId: string; workDate: string; jobId: string }) => {
      leaveModesFor('openAddBlock')
      setBlockModalState({ kind: 'add', assigneeUserId: args.assigneeUserId, workDate: args.workDate, jobId: args.jobId })
      const rows = jobId
        ? blocks.filter((b) => b.assignee_user_id === args.assigneeUserId && b.work_date === args.workDate)
        : (hubPersonDayBlocks.get(hubPersonDayKey(args.assigneeUserId, args.workDate)) ?? [])
      const labelFor = (jid: string) =>
        jobId ? jobTitle : hubJobTitleById.get(jid) ?? formatScheduleDispatchHubJobTitle(null, null)
      const segments: AddBlockTimelineSegment[] = [...rows]
        .map((b) => ({
          blockId: b.id,
          jobId: scheduleBlockAnchorId(b),
          label: labelFor(scheduleBlockAnchorId(b)),
          time_start: b.time_start,
          time_end: b.time_end,
          shared_block_group_id: b.shared_block_group_id,
        }))
        .sort(
          (a, b) =>
            scheduleTimeToMinutesFromMidnight(timeInputToPg(a.time_start.slice(0, 5))) -
            scheduleTimeToMinutesFromMidnight(timeInputToPg(b.time_start.slice(0, 5))),
        )
      setAddBlockTimelineSegments(segments)
      setAddBlockDraftByBlockId({})
      const def = defaultNewBlockRangeInFirstGap({ segments, draftByBlockId: {} })
      if (def) {
        setAddTimeStart(dispatchMinutesToHHmm(def.startMin))
        setAddTimeEnd(dispatchMinutesToHHmm(def.endMin))
      } else {
        setAddTimeStart('08:00')
        setAddTimeEnd('16:00')
      }
      setAddNote('')
      setAddError(null)
    },
    [blocks, hubPersonDayBlocks, jobId, jobTitle, hubJobTitleById, leaveModesFor],
  )

  const closeAdd = useCallback(() => {
    leaveModesFor('closeAddBlock')
    setAddBlockTimelineSegments([])
    setAddBlockDraftByBlockId({})
  }, [leaveModesFor])

  const blockModalPersonLabel = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') {
      if (jobId) {
        return nameByUserId.get(blockModalState.assigneeUserId) ?? 'Unknown'
      }
      return hubPeopleNameById.get(blockModalState.assigneeUserId) ?? 'Unknown'
    }
    const b = blockById.get(blockModalState.blockId)
    return b ? nameByUserId.get(b.assignee_user_id) ?? 'Unknown' : ''
  }, [blockModalState, nameByUserId, blockById, jobId, hubPeopleNameById])

  /** v2.3612 Supervision: the live line under the person while a block is built — null when covered. */
  const blockModalSupervisionWarning = useMemo(() => {
    if (!blockModalState) return null
    if (blockModalState.kind === 'add') {
      const id = blockModalState.assigneeUserId
      return supervisionWarningFor(blockModalPersonLabel, hubPersonById.get(id), coverageOfAssignees([id], hubPersonById))
    }
    const b = blockById.get(blockModalState.blockId)
    if (!b) return null
    return supervisionWarningFor(blockModalPersonLabel, hubPersonById.get(b.assignee_user_id), hubBlockCoverageByKey.get(blockCoverageKey(b)))
  }, [blockModalState, blockModalPersonLabel, hubPersonById, blockById, hubBlockCoverageByKey])

  const blockModalJobTitleForModal = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') {
      return getHubJobDisplayTitle(blockModalState.jobId)
    }
    return jobTitle
  }, [blockModalState, getHubJobDisplayTitle, jobTitle])

  const blockModalWorkDate = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') return blockModalState.workDate
    const b = blockById.get(blockModalState.blockId)
    return b?.work_date ?? ''
  }, [blockModalState, blockById])

  const addBlockModalTimeline = useMemo(() => {
    if (blockModalState?.kind !== 'add') return undefined
    return {
      segments: addBlockTimelineSegments,
      draftByBlockId: addBlockDraftByBlockId,
      setDraftByBlockId: setAddBlockDraftByBlockId,
    }
  }, [blockModalState, addBlockTimelineSegments, addBlockDraftByBlockId])

  const saveBlockModal = useCallback(async () => {
    if (!blockModalState) return
    if (blockModalState.kind === 'edit' && !jobId) return
    if (blockModalState.kind === 'add' && !authUser?.id) return

    if (blockModalState.kind === 'add') {
      const createdBy = authUser?.id
      if (!createdBy) return
      setAddSaving(true)
      setAddError(null)
      const res = await saveNewScheduleBlockForPersonDay({
        authUserId: createdBy,
        assigneeUserId: blockModalState.assigneeUserId,
        workDate: blockModalState.workDate,
        targetJobId: blockModalState.jobId,
        addTimeStart,
        addTimeEnd,
        addNote,
        addBlockDraftByBlockId,
      })
      setAddSaving(false)
      if (!res.ok) {
        setAddError(res.error)
        return
      }
      showToast('Block added.', 'success')
      closeAdd()
      if (jobId) {
        await load()
      } else {
        await loadHub({ quiet: true })
      }
      return
    }

    const b = blockById.get(blockModalState.blockId)
    if (!b) {
      showToast('Block not found.', 'error')
      closeAdd()
      return
    }
    setAddSaving(true)
    setAddError(null)
    const res = await saveEditedScheduleBlockTimes({
      blockId: blockModalState.blockId,
      jobId,
      assigneeUserId: b.assignee_user_id,
      workDate: b.work_date,
      sharedBlockGroupId: b.shared_block_group_id,
      timeStart: addTimeStart,
      timeEnd: addTimeEnd,
      note: addNote,
    })
    setAddSaving(false)
    if (!res.ok) {
      setAddError(res.error)
      return
    }
    showToast('Block updated.', 'success')
    closeAdd()
    await load()
  }, [
    blockModalState,
    jobId,
    authUser?.id,
    addTimeStart,
    addTimeEnd,
    addNote,
    addBlockDraftByBlockId,
    blockById,
    closeAdd,
    load,
    loadHub,
    showToast,
  ])

  const addBlockModalProps: ScheduleDispatchAddBlockModalProps = {
    open: blockModalState != null,
    mode: blockModalState?.kind === 'edit' ? 'edit' : 'add',
    jobTitle: blockModalJobTitleForModal,
    personLabel: blockModalPersonLabel,
    workDate: blockModalWorkDate,
    timeStart: addTimeStart,
    timeEnd: addTimeEnd,
    note: addNote,
    saving: addSaving,
    error: addError,
    onClose: closeAdd,
    onChangeStart: setAddTimeStart,
    onChangeEnd: setAddTimeEnd,
    onChangeNote: setAddNote,
    onSave: () => void saveBlockModal(),
    addTimeline: addBlockModalTimeline,
    warning: blockModalSupervisionWarning,
  }

  return { blockModalState, openAddBlock, closeAdd, closeAddBlockWindow, addBlockModalProps }
}
