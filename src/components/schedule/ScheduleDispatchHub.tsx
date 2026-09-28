import type { CSSProperties, ReactNode } from 'react'
import { type BlockCoverage } from '../../lib/schedule/blockGroupCoverage'
import { HubSubsLanes } from './HubSubsLanes'
import type { SubBadge, SubLane } from '../../lib/subs/subDispatch'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { groupRosterUsersByAuthRoleSection } from '../../lib/usersTabRosterRoleSections'
import { scheduleBlockAnchorId, type JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { ScheduleDispatchBlockNoteIcon } from '../icons/ScheduleDispatchBlockNoteIcon'
import { ScheduleDispatchLinkedChainsIcon } from '../icons/ScheduleDispatchLinkedChainsIcon'
import type { LinkedCopyMode } from '../../lib/scheduleDispatchLinkedCopy'
import type { DispatchSwimLanesData } from '../../lib/dispatchSwimLanes'
import { buildSwimLaneDisplaySections } from '../../lib/dispatchSwimLaneSections'
import type { LinkedGroupCardAccent } from '../../lib/scheduleDispatchLinkedGroupPalette'
import { hubPersonDayKey, type ScheduleDispatchHubMergedRow } from '../../lib/scheduleDispatchHub'
import { type ScheduleDispatchHubBidMatrixRow } from '../../lib/scheduleBlockTitle'
import { type ScheduleHiddenBlockCount, type ScheduleHiddenCell } from '../../lib/scheduleHiddenBlocks'
import { QuickfillScheduleSection } from '../quickfill/QuickfillScheduleSection'
import { ScheduleDispatchWeekNav } from './ScheduleDispatchWeekNav'
import QuickAssignSheet from '../dispatchMode/QuickAssignSheet'
import type { ScheduleDispatchCardPlacementMode, ScheduleDispatchCardPlacementVariant } from './ScheduleDispatchGrid'
import {
  scheduleDispatchDayColumnHeaderStyle,
  scheduleDispatchTodayColumnBoxShadow,
  useScrollScheduleDispatchColumnIntoView,
} from '../../lib/scheduleDispatchColumnFocus'
import { scheduleDispatchMobileNamePill } from '../../lib/scheduleDispatchMobileNamePill'
import { hubPeopleSalarySuffix, hubPeopleToolbarIconBtn } from '../../lib/scheduleDispatch/hubChromeStyle'
import { hubDayColumnHeaderLabel } from '../../lib/scheduleDispatch/hubDayLabels'
import {
  countBlocksMissingNoteForDay,
  filterHubPeopleBySearch,
  filterHubPeopleWithBlocks,
} from '../../lib/scheduleDispatch/hubPanels'
import { useIsMobile } from '../../hooks/useIsMobile'
import { HubPeoplePhoneBoard, PhonePeopleViewSwitch } from './HubPeoplePhoneBoard'
import { ScheduleBlockSheet } from './ScheduleBlockSheet'
import { HubExpectedManpowerSection } from './HubExpectedManpowerSection'
import { HubJobsPanel } from './HubJobsPanel'
import { HubPeopleDayCell } from './HubPeopleDayCell'
import type { PhonePeopleView } from '../../lib/scheduleDispatch/phonePeopleBoard'
import {
  userTimeOffCellKey,
  type UserTimeOffCellInfo,
} from '../../lib/userTimeOffByCell'
import { latenessCellKey, type PersonDayLateness } from '../../lib/scheduleLateness'
import { DispatchSettingsModal, type DispatchSettingsModalRosterRow } from './DispatchSettingsModal'
import { useDispatchNoteRequirements } from '../../contexts/DispatchNoteRequirementsContext'
type HubPeoplePanelProps = {
  /** Week navigation cluster rendered inline as the first item of the toolbar row,
   * so nav + controls share one line when the viewport is wide and wrap when narrow. */
  weekNav?: ReactNode
  visibleDayKeys: string[]
  hideWeekend: boolean
  onHideWeekendChange: (hide: boolean) => void
  allPeopleRows: { userId: string; displayName: string }[]
  userIdsWithBlocksThisWeek: ReadonlySet<string>
  salariedUserIds: ReadonlySet<string>
  personDayBlocks: Map<string, JobScheduleBlockRow[]>
  getJobDisplayTitle: (jobId: string) => string
  /** Job address for the card's one-line ellipsized subline; empty string when none. */
  getJobAddress?: (jobId: string) => string
  groupMemberCountByGroupId: ReadonlyMap<string, number>
  /** v2.3612 Supervision: covered / unsupervised per linked group or solo block (`blockCoverageKey`). */
  blockCoverageByKey?: ReadonlyMap<string, BlockCoverage>
  scheduleTodayYmd: string
  canEdit: boolean
  loading: boolean
  jobsError: string | null
  summariesError: string | null
  onOpenJob: (jobId: string) => void
  onOpenHubJobDetail: (block: JobScheduleBlockRow, workDateYmd: string) => void
  /** From ?focusPerson=<userId>: highlight + scroll to this person's row (Dashboard clock-strip shortcut). */
  focusPersonUserId?: string | null
  /** auth role per user — enables the Person-header sort cycle (alphabetical ↔ by role, Day-view section order). */
  roleByUserId?: Map<string, string>
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  placementSourceWorkDate: string | null
  plusMenuBlockId: string | null
  onPlusMenuBlockIdChange: (blockId: string | null) => void
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: ScheduleDispatchCardPlacementVariant) => void
  onCardPlacementCellPick: (assigneeUserId: string, workDate: string) => void
  /** Long-press on a card (phone-first): open the Move sheet for this block. */
  onRequestMoveBlock?: (b: JobScheduleBlockRow) => void
  highlightLinkedGroups: boolean
  onHighlightLinkedGroupsChange: (v: boolean) => void
  linkedGroupAccentByGroupId: ReadonlyMap<string, LinkedGroupCardAccent>
  onOpenLinkedGroup: (groupId: string) => void
  hubWeekBlocks: JobScheduleBlockRow[]
  hubExpectedManpowerDayKey: string | null
  onHubExpectedManpowerDayChange: (dayKey: string) => void
  hubPeopleNameById: ReadonlyMap<string, string>
  canShowExpectedManpowerPayroll: boolean
  hubHourlyWageByUserId: ReadonlyMap<string, number>
  hubAssignJobPlacement: { jobId: string } | null
  onHubAssignJobCellPick: (assigneeUserId: string, workDate: string) => void
  onDeleteBlock: (id: string) => void
  onEmptyCellClick?: (personUserId: string, workDate: string) => void
  onAddJobToScheduleForCell?: (assigneeUserId: string, workDate: string) => void
  hubMultiCellAddActive: boolean
  hubMultiCellAddSelectedKeys: ReadonlySet<string>
  onHubMultiCellAddToggle?: (personUserId: string, workDate: string) => void
  onRequestHubAddJob?: () => void
  /** Two-stage "copy jobs linked to people" flow (toolbar chains button). */
  linkedCopyMode?: LinkedCopyMode | null
  onStartLinkedCopyMode?: () => void
  onLinkedCopyToggleBlock?: (blockId: string) => void
  onLinkedCopyApplyToPerson?: (personUserId: string) => void
  /** Stage 2 + lanes grouping: lane-heading click applies to every member. */
  onLinkedCopyApplyToLane?: (laneLabel: string, memberUserIds: string[]) => void
  /** Refetch after Quick Assign writes blocks (mobile phone entry point). */
  onQuickAssignScheduled?: () => void
  linkedCopyApplyBusy?: boolean
  /** v2.3156 — the People board on a phone: which rendering a narrow viewport gets, and the page-owned switch. Absent → the grid. */
  phonePeopleView?: PhonePeopleView
  onPhonePeopleViewChange?: (view: PhonePeopleView) => void
  /** Copy to techs sheet: one block to a chosen list of people (linked or not), no mode needed. */
  onCopyBlockToPeople?: (args: { blockId: string; userIds: string[]; linked: boolean }) => void | Promise<void | { applied: number } | null>
  onCancelCardPlacement?: () => void
  onCancelHubAssignJobPlacement?: () => void
  onLinkedCopySetStage?: (stage: 1 | 2) => void
  /** Office-wide swim lanes for the 'lanes' person grouping (null until loaded). */
  swimLanes?: DispatchSwimLanesData | null
  onSwimLanesChanged?: () => void
  onRequestHubMultiCellAddMode?: () => void
  columnFocusDayYmd: string
  columnScrollKey: string
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  onOpenPersonDay?: (b: JobScheduleBlockRow) => void
  /** When false, hide the Expected Manpower block below the People grid (e.g. Quickfill tomorrow snapshot). */
  showExpectedManpower?: boolean
  /** When false, hide the Hide weekend checkbox in the People toolbar (e.g. Quickfill tomorrow). */
  showHideWeekendToggle?: boolean
  /** Per-cell time-off info keyed by `userTimeOffCellKey`; when present a chip is rendered. */
  userTimeOffByCell?: ReadonlyMap<string, UserTimeOffCellInfo>
  /** Derived per-cell lateness (v2.2550) — renders the informational amber Late chip. */
  latenessByCell?: ReadonlyMap<string, PersonDayLateness>
  /** Optional click handler for the "Not coming in" chip — opens the undo confirm modal. */
  onRequestUndoNotComingIn?: (personUserId: string, workDate: string) => void
  onMarkNotComingInForCell?: (personUserId: string, workDate: string) => void
  /** Per person-day RLS-hidden block counts keyed by `hubPersonDayKey` (superintendent board). */
  hiddenByCell?: ReadonlyMap<string, ScheduleHiddenCell>
  /** v2.2929: "sub" badges on crew cells (job team members, picked days only) and the read-only Subs lanes. */
  subBadgeByCell?: ReadonlyMap<string, SubBadge>
  subLanes?: SubLane[]
  /** Raw hidden-count rows for the Expected Manpower math (true totals, not just visible). */
  hiddenBlockCounts?: readonly ScheduleHiddenBlockCount[]
}

function HubPeoplePanel({
  weekNav,
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  allPeopleRows,
  userIdsWithBlocksThisWeek,
  salariedUserIds,
  personDayBlocks,
  getJobDisplayTitle,
  getJobAddress,
  groupMemberCountByGroupId,
  blockCoverageByKey,
  scheduleTodayYmd,
  columnFocusDayYmd,
  columnScrollKey,
  canEdit,
  loading,
  jobsError,
  summariesError,
  onOpenJob,
  onOpenHubJobDetail,
  focusPersonUserId = null,
  roleByUserId,
  cardPlacementMode,
  placementSourceWorkDate,
  plusMenuBlockId,
  onPlusMenuBlockIdChange,
  onStartCardPlacement,
  onCardPlacementCellPick,
  onRequestMoveBlock,
  highlightLinkedGroups,
  onHighlightLinkedGroupsChange,
  linkedGroupAccentByGroupId,
  onOpenLinkedGroup,
  hubWeekBlocks,
  hubExpectedManpowerDayKey,
  onHubExpectedManpowerDayChange,
  hubPeopleNameById,
  canShowExpectedManpowerPayroll,
  hubHourlyWageByUserId,
  hubAssignJobPlacement,
  onHubAssignJobCellPick,
  onDeleteBlock,
  onEmptyCellClick,
  onAddJobToScheduleForCell,
  hubMultiCellAddActive,
  hubMultiCellAddSelectedKeys,
  onHubMultiCellAddToggle,
  onRequestHubAddJob,
  linkedCopyMode = null,
  onStartLinkedCopyMode,
  onLinkedCopyToggleBlock,
  onLinkedCopyApplyToPerson,
  onLinkedCopyApplyToLane,
  onQuickAssignScheduled,
  linkedCopyApplyBusy = false,
  phonePeopleView,
  onPhonePeopleViewChange,
  onCopyBlockToPeople,
  onCancelCardPlacement,
  onCancelHubAssignJobPlacement,
  onLinkedCopySetStage,
  swimLanes = null,
  onRequestHubMultiCellAddMode,
  onRequestEditBlockNote,
  onOpenPersonDay,
  showExpectedManpower = true,
  showHideWeekendToggle = true,
  userTimeOffByCell,
  latenessByCell,
  onRequestUndoNotComingIn,
  onMarkNotComingInForCell,
  hiddenByCell,
  subBadgeByCell,
  subLanes,
  hiddenBlockCounts,
}: HubPeoplePanelProps) {
  /** "View" dropdown consolidating Hide Inactive / Hide weekend / Highlight linked. */
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  // Phone (v2.1357): search collapses behind a magnifier toggle in the toolbar row.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const viewMenuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!viewMenuOpen) return
    const onDown = (e: globalThis.MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) setViewMenuOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setViewMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [viewMenuOpen])
  const isMobile = useIsMobile()
  // v2.3156: the page resolves board vs grid (an explicit pick wins at any width, else narrow → board); absent in embeds.
  const phoneBoardActive = onPhonePeopleViewChange != null && phonePeopleView === 'board'
  // While something is being placed, the mode bar owns the bottom of the screen — the switch stands down.
  const phonePlacementActive = cardPlacementMode != null || hubAssignJobPlacement != null || linkedCopyMode != null || hubMultiCellAddActive
  const peopleScrollRef = useRef<HTMLDivElement>(null)
  useScrollScheduleDispatchColumnIntoView({
    columnFocusDayYmd,
    loading,
    scrollRootRef: peopleScrollRef,
    scrollKey: columnScrollKey,
  })

  const [search, setSearch] = useState('')
  const [onlyWithBlocksThisWeek, setOnlyWithBlocksThisWeek] = useState(false)
  // The board has no search box or Hide-inactive toggle, so a filter left on in the grid must not silently thin it.
  useEffect(() => {
    if (!phoneBoardActive) return
    setSearch('')
    setOnlyWithBlocksThisWeek(false)
    setMobileSearchOpen(false)
  }, [phoneBoardActive])
  /** Scroll the ?focusPerson row into view once rows are rendered. */
  useEffect(() => {
    if (!focusPersonUserId || loading) return
    document
      .getElementById(`hub-person-row-${focusPersonUserId}`)
      ?.scrollIntoView({ block: 'center' })
  }, [focusPersonUserId, loading])

  const afterBlockFilter = useMemo(
    () => filterHubPeopleWithBlocks(allPeopleRows, onlyWithBlocksThisWeek, userIdsWithBlocksThisWeek),
    [allPeopleRows, onlyWithBlocksThisWeek, userIdsWithBlocksThisWeek],
  )

  const filteredAssignees = useMemo(
    () => filterHubPeopleBySearch(afterBlockFilter, search, { visibleDayKeys, personDayBlocks, getJobDisplayTitle, swimLanes }),
    [afterBlockFilter, search, visibleDayKeys, personDayBlocks, getJobDisplayTitle, swimLanes],
  )

  /** Person-header sort cycle: swim lanes (default) ↔ alphabetical ↔ grouped by role like the Day view. Per-device; an explicit pick sticks. */
  const PEOPLE_SORT_STORAGE_KEY = 'pipetooling_dispatch_people_sort_v1'
  const [quickAssignOpen, setQuickAssignOpen] = useState(false)
  const [personSort, setPersonSort] = useState<'alpha' | 'role' | 'lanes'>(() => {
    try {
      const stored = localStorage.getItem(PEOPLE_SORT_STORAGE_KEY)
      return stored === 'role' || stored === 'alpha' ? stored : 'lanes'
    } catch {
      return 'lanes'
    }
  })
  const cyclePersonSort = () => {
    setPersonSort((prev) => {
      const next = prev === 'alpha' ? 'role' : prev === 'role' ? 'lanes' : 'alpha'
      try {
        localStorage.setItem(PEOPLE_SORT_STORAGE_KEY, next)
      } catch {
        /* per-device nicety only */
      }
      return next
    })
  }
  const peopleDisplayRows = useMemo((): Array<
    | { kind: 'heading'; key: string; label: string; laneMemberUserIds?: string[] }
    | { kind: 'person'; person: { userId: string; displayName: string } }
  > => {
    if (personSort === 'lanes' && swimLanes) {
      const sections = buildSwimLaneDisplaySections(
        swimLanes,
        filteredAssignees.map((p) => ({ userId: p.userId, displayName: p.displayName })),
      )
      const out: Array<
        | { kind: 'heading'; key: string; label: string; laneMemberUserIds?: string[] }
        | { kind: 'person'; person: { userId: string; displayName: string } }
      > = []
      for (const sec of sections) {
        out.push({
          kind: 'heading',
          key: `lane:${sec.laneId ?? 'rest'}`,
          label: sec.label,
          laneMemberUserIds: sec.laneId != null ? sec.people.map((p) => p.userId) : undefined,
        })
        for (const person of sec.people) out.push({ kind: 'person', person })
      }
      return out
    }
    if (personSort !== 'role' || !roleByUserId || roleByUserId.size === 0) {
      return filteredAssignees.map((person) => ({ kind: 'person' as const, person }))
    }
    const sections = groupRosterUsersByAuthRoleSection(
      filteredAssignees.map((person) => ({ id: person.userId, name: person.displayName })),
      roleByUserId,
    )
    const byId = new Map(filteredAssignees.map((person) => [person.userId, person]))
    const out: Array<
      | { kind: 'heading'; key: string; label: string; laneMemberUserIds?: string[] }
      | { kind: 'person'; person: { userId: string; displayName: string } }
    > = []
    for (const sec of sections) {
      out.push({ kind: 'heading', key: sec.sectionKey, label: sec.label })
      for (const r of sec.rows) {
        const person = byId.get(r.id)
        if (person) out.push({ kind: 'person', person })
      }
    }
    return out
  }, [personSort, roleByUserId, filteredAssignees, swimLanes])

  const emptyMessage = useMemo(() => {
    if (allPeopleRows.length === 0) {
      if (jobsError) return 'No people to show.'
      if (summariesError) return 'Could not load schedule blocks; people list may be incomplete.'
      return 'No people to show.'
    }
    if (afterBlockFilter.length === 0 && onlyWithBlocksThisWeek) {
      return 'No people have schedule blocks this week.'
    }
    return 'No people match your search.'
  }, [
    allPeopleRows.length,
    afterBlockFilter.length,
    onlyWithBlocksThisWeek,
    jobsError,
    summariesError,
  ])

  const missingNoteDayYmd = columnFocusDayYmd || scheduleTodayYmd

  const { requirementForBlock: noteRequirementForBlockFromContext } = useDispatchNoteRequirements()

  // Past-day columns: the missing-notes indicator is part of the "needs attention"
  // surface alongside per-card colors, and both gate on `block.work_date < scheduleTodayYmd`
  // returning to default. History never lights up red.
  const missingNoteCount = useMemo(
    () =>
      countBlocksMissingNoteForDay(
        missingNoteDayYmd,
        scheduleTodayYmd,
        filteredAssignees,
        personDayBlocks,
        noteRequirementForBlockFromContext,
      ),
    [
      missingNoteDayYmd,
      scheduleTodayYmd,
      filteredAssignees,
      personDayBlocks,
      noteRequirementForBlockFromContext,
    ],
  )

  return (
    <>
      {jobsError ? (
        <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{jobsError}</p>
      ) : null}
      {summariesError ? (
        <p style={{ color: 'var(--text-amber-800)', fontSize: '0.875rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
          Could not load schedule blocks for this week ({summariesError}). People grid is empty.
        </p>
      ) : null}

      {phoneBoardActive ? (
        <HubPeoplePhoneBoard
          visibleDayKeys={visibleDayKeys}
          scheduleTodayYmd={scheduleTodayYmd}
          columnFocusDayYmd={columnFocusDayYmd}
          peopleDisplayRows={peopleDisplayRows}
          personDayBlocks={personDayBlocks}
          hubWeekBlocks={hubWeekBlocks}
          hubPeopleNameById={hubPeopleNameById}
          getJobDisplayTitle={getJobDisplayTitle}
          getJobAddress={getJobAddress}
          salariedUserIds={salariedUserIds}
          userTimeOffByCell={userTimeOffByCell}
          latenessByCell={latenessByCell}
          hiddenByCell={hiddenByCell}
          subBadgeByCell={subBadgeByCell}
          noteRequirementForBlock={noteRequirementForBlockFromContext}
          onRequestUndoNotComingIn={onRequestUndoNotComingIn}
          missingNoteCount={missingNoteCount}
          missingNoteDayYmd={missingNoteDayYmd}
          canEdit={canEdit}
          loading={loading}
          cardPlacementMode={cardPlacementMode}
          hubAssignJobPlacement={hubAssignJobPlacement}
          linkedCopyMode={linkedCopyMode}
          linkedCopyApplyBusy={linkedCopyApplyBusy}
          hubMultiCellAddActive={hubMultiCellAddActive}
          hubMultiCellAddSelectedKeys={hubMultiCellAddSelectedKeys}
          onRequestHubAddJob={onRequestHubAddJob}
          onOpenQuickAssign={canEdit ? () => setQuickAssignOpen(true) : undefined}
          onStartLinkedCopyMode={onStartLinkedCopyMode}
          onLinkedCopySetStage={onLinkedCopySetStage}
          onLinkedCopyToggleBlock={onLinkedCopyToggleBlock}
          onLinkedCopyApplyToPerson={onLinkedCopyApplyToPerson}
          onLinkedCopyApplyToLane={onLinkedCopyApplyToLane}
          onCopyBlockToPeople={onCopyBlockToPeople}
          onCardPlacementCellPick={onCardPlacementCellPick}
          onCancelCardPlacement={onCancelCardPlacement}
          onHubAssignJobCellPick={onHubAssignJobCellPick}
          onCancelHubAssignJobPlacement={onCancelHubAssignJobPlacement}
          onHubMultiCellAddToggle={onHubMultiCellAddToggle}
          onAddJobToScheduleForCell={onAddJobToScheduleForCell}
          onEmptyCellClick={onEmptyCellClick}
          onStartCardPlacement={onStartCardPlacement}
          onOpenHubJobDetail={onOpenHubJobDetail}
          onOpenJob={onOpenJob}
          onDeleteBlock={onDeleteBlock}
          onRequestEditBlockNote={onRequestEditBlockNote}
        />
      ) : (
      <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        {weekNav}
        {canEdit && !hubAssignJobPlacement && onRequestHubAddJob ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              aria-label="Add job"
              title="Add job"
              style={hubPeopleToolbarIconBtn}
              onClick={onRequestHubAddJob}
            >
              +
            </button>
            {onRequestHubMultiCellAddMode ? (
              <button
                type="button"
                aria-label={
                  hubMultiCellAddActive
                    ? 'Exit multi-cell add mode'
                    : 'Select multiple person and day cells to add the same job'
                }
                title={
                  hubMultiCellAddActive
                    ? 'Exit multi-cell add (Esc)'
                    : 'Select multiple cells, then choose one job for all'
                }
                style={{
                  ...hubPeopleToolbarIconBtn,
                  borderColor: hubMultiCellAddActive ? '#ca8a04' : '#2563eb',
                  color: hubMultiCellAddActive ? '#ca8a04' : 'var(--text-link)',
                  background: hubMultiCellAddActive ? 'var(--bg-amber-tint)' : 'var(--surface)',
                }}
                onClick={onRequestHubMultiCellAddMode}
              >
                {/* Multiplication sign (v2.1815, owner request): the mode takes ONE
                    job × many cells, so × reads truer than ++ ("add twice"). */}
                ×
              </button>
            ) : null}
            {onStartLinkedCopyMode ? (
              <button
                type="button"
                aria-label={
                  linkedCopyMode
                    ? 'Exit copy-jobs-linked mode'
                    : 'Copy jobs linked to people: pick blocks, then click people'
                }
                title={
                  linkedCopyMode
                    ? 'Exit copy-jobs-linked mode (Esc)'
                    : 'Copy jobs linked: pick blocks, then click people'
                }
                style={{
                  ...hubPeopleToolbarIconBtn,
                  borderColor: linkedCopyMode ? '#4338ca' : '#2563eb',
                  color: linkedCopyMode ? '#4338ca' : 'var(--text-link)',
                  background: linkedCopyMode ? 'var(--bg-blue-tint)' : 'var(--surface)',
                }}
                onClick={onStartLinkedCopyMode}
              >
                <ScheduleDispatchLinkedChainsIcon size={14} />
              </button>
            ) : null}
            {isMobile && canEdit ? (
              <button
                type="button"
                aria-label="Assign work — pick a job, people, and a time"
                title="Assign work (Quick Assign)"
                style={{
                  ...hubPeopleToolbarIconBtn,
                  borderColor: '#16a34a',
                  color: 'var(--text-green-600)',
                }}
                onClick={() => setQuickAssignOpen(true)}
              >
                ⚡
              </button>
            ) : null}
          </div>
        ) : null}
        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileSearchOpen((o) => !o)}
            title="Search person or job"
            aria-label="Search person or job"
            aria-expanded={mobileSearchOpen}
            style={{
              ...hubPeopleToolbarIconBtn,
              marginLeft: 'auto',
              ...(mobileSearchOpen || search.trim() !== ''
                ? { borderColor: '#2563eb', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }
                : { borderColor: 'var(--border-strong)', color: 'var(--text-700)' }),
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
              <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4 457.4 502.6 330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
            </svg>
          </button>
        ) : (
        <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Person or Job"
            aria-label="Search person or job"
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', minWidth: 200 }}
          />
        </label>
        )}
        <div ref={viewMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={viewMenuOpen}
            aria-label="View options: hide inactive, hide weekend, highlight linked"
            onClick={() => setViewMenuOpen((o) => !o)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0.35rem 0.6rem',
              fontSize: '0.8125rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: viewMenuOpen ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: 'var(--text-700)',
              cursor: 'pointer',
            }}
          >
            View
            <span aria-hidden style={{ fontSize: '0.65rem' }}>{viewMenuOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
          {viewMenuOpen ? (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '0.6rem 0.85rem',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                whiteSpace: 'nowrap',
              }}
            >
              <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={onlyWithBlocksThisWeek}
                  onChange={(e) => setOnlyWithBlocksThisWeek(e.target.checked)}
                />
                Hide Inactive
              </label>
              {showHideWeekendToggle ? (
                <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hideWeekend}
                    onChange={(e) => onHideWeekendChange(e.target.checked)}
                    aria-label="Hide Saturday and Sunday columns"
                  />
                  Hide weekend
                </label>
              ) : null}
              <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={highlightLinkedGroups}
                  onChange={(e) => onHighlightLinkedGroupsChange(e.target.checked)}
                  aria-label="Highlight linked: matching border and background on mirrored crew blocks"
                />
                Highlight linked
              </label>
            </div>
          ) : null}
        </div>
      </div>
      {isMobile && mobileSearchOpen ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <input
            type="search"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Person or Job"
            aria-label="Search person or job"
            style={{ flex: 1, minWidth: 0, padding: '0.4rem 0.5rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
          />
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setMobileSearchOpen(false)
            }}
            title="Clear search and close"
            aria-label="Clear search and close"
            style={{ ...hubPeopleToolbarIconBtn, borderColor: 'var(--border-strong)', color: 'var(--text-700)' }}
          >
            ×
          </button>
        </div>
      ) : null}

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : null}

      <div
        ref={peopleScrollRef}
        style={{
          overflowX: 'auto',
          marginLeft: 'calc(-1 * (var(--app-main-pad) + 1.25rem))',
          marginRight: 'calc(-1 * (var(--app-main-pad) + 1.25rem))',
        }}
      >
        <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%', fontSize: '0.8125rem' }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  borderTop: '1px solid var(--border)',
                  borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-muted)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  width: '1%',
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  boxShadow: isMobile
                    ? undefined
                    : 'inset 1px 0 0 var(--border), inset -1px 0 0 var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={cyclePersonSort}
                  title={
                    personSort === 'alpha'
                      ? 'Sorted alphabetically — click to group by role'
                      : personSort === 'role'
                        ? 'Grouped by role — click to group by swim lanes'
                        : 'Grouped by swim lanes — click to sort alphabetically'
                  }
                  aria-label={
                    personSort === 'alpha'
                      ? 'People sorted alphabetically. Click to group by role.'
                      : personSort === 'role'
                        ? 'People grouped by role. Click to group by swim lanes.'
                        : 'People grouped by swim lanes. Click to sort alphabetically.'
                  }
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {isMobile ? <span style={scheduleDispatchMobileNamePill}>Person</span> : 'Person'}
                  <span aria-hidden style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    {personSort === 'alpha' ? 'A–Z' : personSort === 'role' ? 'by role' : 'by lanes'}
                  </span>
                </button>
              </th>
              {visibleDayKeys.map((dk) => {
                const headerStyle = scheduleDispatchDayColumnHeaderStyle(
                  dk,
                  { scheduleTodayYmd, columnFocusDayYmd },
                  'var(--bg-muted)',
                )
                const todayEdges = scheduleDispatchTodayColumnBoxShadow(dk === scheduleTodayYmd, {
                  top: true,
                })
                return (
                <th
                  key={dk}
                  data-schedule-column-day={dk}
                  style={{
                    textAlign: 'center',
                    padding: '0.35rem',
                    border: '1px solid var(--border)',
                    ...headerStyle,
                    boxShadow:
                      [headerStyle.boxShadow, todayEdges].filter(Boolean).join(', ') || undefined,
                    fontSize: '0.75rem',
                    minWidth: 104,
                  }}
                  title={dk}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{hubDayColumnHeaderLabel(dk)}</span>
                    {dk === missingNoteDayYmd && missingNoteCount > 0 ? (
                      <span
                        title={`${missingNoteCount} card${missingNoteCount === 1 ? '' : 's'} missing job instructions for ${hubDayColumnHeaderLabel(dk)}`}
                        aria-label={`${missingNoteCount} card${missingNoteCount === 1 ? '' : 's'} missing job instructions for ${hubDayColumnHeaderLabel(dk)}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          color: 'var(--text-red-600)',
                          fontWeight: 700,
                        }}
                      >
                        <ScheduleDispatchBlockNoteIcon size={12} />
                        <span>{missingNoteCount}</span>
                      </span>
                    ) : null}
                  </span>
                </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filteredAssignees.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={1 + visibleDayKeys.length}
                  style={{ padding: '1rem', border: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'center' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              peopleDisplayRows.map((item, itemIndex) => {
                if (item.kind === 'heading') {
                  const laneApplyActive =
                    linkedCopyMode?.stage === 2 &&
                    onLinkedCopyApplyToLane != null &&
                    item.laneMemberUserIds != null &&
                    item.laneMemberUserIds.length > 0
                  return (
                    <tr key={`people-role-heading-${item.key}`}>
                      <td
                        colSpan={1 + visibleDayKeys.length}
                        style={{
                          padding: '0.45rem 0.5rem',
                          borderTop: '1px solid var(--border)',
                          borderBottom: '1px solid var(--border)',
                          background: 'var(--bg-subtle)',
                        }}
                      >
                        {laneApplyActive ? (
                          <button
                            type="button"
                            disabled={linkedCopyApplyBusy}
                            aria-label={`Apply linked copies to everyone in ${item.label}`}
                            title={`Apply the selected linked copies to every member of ${item.label}`}
                            onClick={() =>
                              onLinkedCopyApplyToLane?.(item.label, item.laneMemberUserIds ?? [])
                            }
                            style={{
                              position: 'sticky',
                              left: 8,
                              display: 'inline-block',
                              padding: '0.1rem 0.4rem',
                              border: '2px dashed rgba(67, 56, 202, 0.55)',
                              borderRadius: 4,
                              background: 'var(--bg-blue-tint)',
                              color: 'var(--text-strong)',
                              font: 'inherit',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              textDecoration: 'underline',
                              cursor: linkedCopyApplyBusy ? 'wait' : 'pointer',
                            }}
                          >
                            {item.label} — whole crew
                          </button>
                        ) : (
                          <span
                            style={{
                              position: 'sticky',
                              left: 8,
                              display: 'inline-block',
                              fontWeight: 700,
                              textDecoration: 'underline',
                              color: 'var(--text-strong)',
                              fontSize: '0.9rem',
                            }}
                          >
                            {item.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                }
                const person = item.person
                const linkedCopyApplyActive =
                  linkedCopyMode?.stage === 2 && onLinkedCopyApplyToPerson != null
                return (
                <tr key={person.userId} id={`hub-person-row-${person.userId}`}>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderTop: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky',
                      left: 0,
                      background:
                        person.userId === focusPersonUserId
                          ? 'var(--bg-blue-tint)'
                          : 'var(--surface)',
                      zIndex: 1,
                      fontWeight: 600,
                      color: 'var(--text-strong)',
                      verticalAlign: 'top',
                      width: '1%',
                      minWidth: 0,
                      whiteSpace: isMobile ? undefined : 'nowrap',
                      boxShadow: isMobile
                        ? undefined
                        : 'inset 1px 0 0 var(--border), inset -1px 0 0 var(--border)',
                    }}
                  >
                    {linkedCopyApplyActive ? (
                      <button
                        type="button"
                        disabled={linkedCopyApplyBusy}
                        aria-label={`Apply linked copies to ${person.displayName}`}
                        title={`Apply the selected linked copies to ${person.displayName}`}
                        onClick={() => onLinkedCopyApplyToPerson?.(person.userId)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.15rem 0.35rem',
                          margin: '-0.15rem -0.35rem',
                          border: '2px dashed rgba(67, 56, 202, 0.55)',
                          borderRadius: 4,
                          background: 'var(--bg-blue-tint)',
                          color: 'inherit',
                          font: 'inherit',
                          fontWeight: 600,
                          cursor: linkedCopyApplyBusy ? 'wait' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {person.displayName}
                      </button>
                    ) : isMobile ? (
                      <span style={{ ...scheduleDispatchMobileNamePill, whiteSpace: 'nowrap' }}>
                        {person.displayName}
                        {salariedUserIds.has(person.userId) ? (
                          <span
                            title="Salaried (Pay settings)"
                            aria-label="Salaried (Pay settings)"
                            style={hubPeopleSalarySuffix}
                          >
                            (s)
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <>
                        {person.displayName}
                        {salariedUserIds.has(person.userId) ? (
                          <span
                            title="Salaried (Pay settings)"
                            aria-label="Salaried (Pay settings)"
                            style={hubPeopleSalarySuffix}
                          >
                            (s)
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  {visibleDayKeys.map((dk) => {
                    const cellBlocks = personDayBlocks.get(hubPersonDayKey(person.userId, dk)) ?? []
                    const timeOffInfo =
                      userTimeOffByCell?.get(userTimeOffCellKey(person.userId, dk)) ?? null
                    const lateInfo =
                      timeOffInfo ? null : latenessByCell?.get(latenessCellKey(person.userId, dk)) ?? null
                    const hiddenInfo = hiddenByCell?.get(hubPersonDayKey(person.userId, dk)) ?? null
                    const subBadge = subBadgeByCell?.get(hubPersonDayKey(person.userId, dk)) ?? null
                    return (
                      <HubPeopleDayCell
                        key={dk}
                        personUserId={person.userId}
                        workDate={dk}
                        linkedCopyMode={linkedCopyMode}
                        onLinkedCopyToggleBlock={onLinkedCopyToggleBlock}
                        scheduleTodayYmd={scheduleTodayYmd}
                        columnFocusDayYmd={columnFocusDayYmd}
                        cellBlocks={cellBlocks}
                        canEdit={canEdit}
                        cardPlacementMode={cardPlacementMode}
                        placementSourceWorkDate={placementSourceWorkDate}
                        plusMenuBlockId={plusMenuBlockId}
                        onPlusMenuBlockIdChange={onPlusMenuBlockIdChange}
                        onStartCardPlacement={onStartCardPlacement}
                        onCardPlacementCellPick={onCardPlacementCellPick}
                        onRequestMoveBlock={onRequestMoveBlock}
                        tapGripToMove={isMobile}
                        groupMemberCountByGroupId={groupMemberCountByGroupId}
                        blockCoverageByKey={blockCoverageByKey}
                        getJobDisplayTitle={getJobDisplayTitle}
                        getJobAddress={getJobAddress}
                        onOpenJob={onOpenJob}
                        onOpenHubJobDetail={onOpenHubJobDetail}
                        highlightLinkedGroups={highlightLinkedGroups}
                        linkedGroupAccentByGroupId={linkedGroupAccentByGroupId}
                        onOpenLinkedGroup={onOpenLinkedGroup}
                        hubAssignJobPlacement={hubAssignJobPlacement}
                        onHubAssignJobCellPick={onHubAssignJobCellPick}
                        onDeleteBlock={onDeleteBlock}
                        onEmptyCellClick={onEmptyCellClick}
                        onAddJobToScheduleForCell={onAddJobToScheduleForCell}
                        hubMultiCellAddActive={hubMultiCellAddActive}
                        hubMultiCellAddSelectedKeys={hubMultiCellAddSelectedKeys}
                        onHubMultiCellAddToggle={onHubMultiCellAddToggle}
                        onRequestEditBlockNote={onRequestEditBlockNote}
              onOpenPersonDay={onOpenPersonDay}
                        timeOffInfo={timeOffInfo}
                        lateInfo={lateInfo}
                        onRequestUndoNotComingIn={onRequestUndoNotComingIn}
                        onMarkNotComingInForCell={onMarkNotComingInForCell}
                        hiddenInfo={hiddenInfo}
                        subBadge={subBadge}
                        isBottomRow={itemIndex === peopleDisplayRows.length - 1}
                      />
                    )
                  })}
                </tr>
                )
              })
            )}
          </tbody>
        </table>
        <HubSubsLanes lanes={subLanes ?? []} visibleDayKeys={visibleDayKeys} scheduleTodayYmd={scheduleTodayYmd} onOpenJob={onOpenJob} />
      </div>
      </>
      )}

      {isMobile && canEdit ? (
        <QuickAssignSheet
          open={quickAssignOpen}
          onClose={() => setQuickAssignOpen(false)}
          onScheduled={onQuickAssignScheduled}
        />
      ) : null}
      <HubExpectedManpowerSection
        show={showExpectedManpower}
        hubWeekBlocks={hubWeekBlocks}
        visibleDayKeys={visibleDayKeys}
        hiddenBlockCounts={hiddenBlockCounts}
        hubExpectedManpowerDayKey={hubExpectedManpowerDayKey}
        onHubExpectedManpowerDayChange={onHubExpectedManpowerDayChange}
        getJobDisplayTitle={getJobDisplayTitle}
        hubPeopleNameById={hubPeopleNameById}
        swimLanes={swimLanes}
        canShowExpectedManpowerPayroll={canShowExpectedManpowerPayroll}
        hubHourlyWageByUserId={hubHourlyWageByUserId}
        onOpenJob={onOpenJob}
        scheduleTodayYmd={scheduleTodayYmd}
      />
      {/* At any width (v2.3169): a phone turned sideways, or a tablet, can still choose the board. */}
      {onPhonePeopleViewChange && !phonePlacementActive ? (
        <PhonePeopleViewSwitch view={phonePeopleView ?? 'board'} onChange={onPhonePeopleViewChange} />
      ) : null}
    </>
  )
}

type Props = {
  weekStart: string
  visibleDayKeys: string[]
  hideWeekend: boolean
  onHideWeekendChange: (hide: boolean) => void
  /** Phone layout (v2.1240; sole phone rendering since v2.1242): compact header — segmented tabs + "+ Schedule" sheet + ⋯ menu. */
  mobileNewMode?: boolean
  weekNavDateRangeOverride?: string
  /** URL `day` when in the visible week; column tint + scroll. */
  columnFocusDayYmd?: string
  /** Sorted full list (before search / filter). */
  rows: ScheduleDispatchHubMergedRow[]
  /** Jobs tab: bid visits with a block this week, one row each (Tier-2 #22). */
  bidRows?: ScheduleDispatchHubBidMatrixRow[]
  loading: boolean
  jobsError: string | null
  summariesError: string | null
  hubTab: 'jobs' | 'people' | 'day'
  onHubTabChange: (t: 'jobs' | 'people' | 'day') => void
  personDayBlocks: Map<string, JobScheduleBlockRow[]>
  allPeopleRows: { userId: string; displayName: string }[]
  userIdsWithBlocksThisWeek: ReadonlySet<string>
  salariedUserIds: ReadonlySet<string>
  getJobDisplayTitle: (jobId: string) => string
  /** Job address for the card's one-line ellipsized subline; empty string when none. */
  getJobAddress?: (jobId: string) => string
  groupMemberCountByGroupId: ReadonlyMap<string, number>
  /** v2.3612 Supervision: covered / unsupervised per linked group or solo block (`blockCoverageKey`). */
  blockCoverageByKey?: ReadonlyMap<string, BlockCoverage>
  scheduleTodayYmd: string
  canEdit: boolean
  onWeekShift: (deltaWeeks: number) => void
  onThisWeek: () => void
  onOpenJob: (jobId: string) => void
  onOpenHubJobDetail: (block: JobScheduleBlockRow, workDateYmd: string) => void
  /** From ?focusPerson=<userId>: highlight + scroll to this person's row (Dashboard clock-strip shortcut). */
  focusPersonUserId?: string | null
  /** auth role per user — enables the Person-header sort cycle (alphabetical ↔ by role, Day-view section order). */
  roleByUserId?: Map<string, string>
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  placementSourceWorkDate: string | null
  plusMenuBlockId: string | null
  onPlusMenuBlockIdChange: (blockId: string | null) => void
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: ScheduleDispatchCardPlacementVariant) => void
  onCardPlacementCellPick: (assigneeUserId: string, workDate: string) => void
  /** Long-press on a card (phone-first): open the Move sheet for this block. */
  onRequestMoveBlock?: (b: JobScheduleBlockRow) => void
  highlightLinkedGroups: boolean
  onHighlightLinkedGroupsChange: (v: boolean) => void
  linkedGroupAccentByGroupId: ReadonlyMap<string, LinkedGroupCardAccent>
  onOpenLinkedGroup: (groupId: string) => void
  hubWeekBlocks: JobScheduleBlockRow[]
  hubExpectedManpowerDayKey: string | null
  onHubExpectedManpowerDayChange: (dayKey: string) => void
  hubPeopleNameById: ReadonlyMap<string, string>
  canShowExpectedManpowerPayroll: boolean
  hubHourlyWageByUserId: ReadonlyMap<string, number>
  hubAssignJobPlacement: { jobId: string } | null
  onRequestHubAddJob: () => void
  linkedCopyMode?: LinkedCopyMode | null
  onStartLinkedCopyMode?: () => void
  onLinkedCopyToggleBlock?: (blockId: string) => void
  onLinkedCopyApplyToPerson?: (personUserId: string) => void
  /** Stage 2 + lanes grouping: lane-heading click applies to every member. */
  onLinkedCopyApplyToLane?: (laneLabel: string, memberUserIds: string[]) => void
  /** Refetch after Quick Assign writes blocks (mobile phone entry point). */
  onQuickAssignScheduled?: () => void
  linkedCopyApplyBusy?: boolean
  /** v2.3156 — the People board on a phone: which rendering a narrow viewport gets, and the page-owned switch. Absent → the grid. */
  phonePeopleView?: PhonePeopleView
  onPhonePeopleViewChange?: (view: PhonePeopleView) => void
  /** Copy to techs sheet: one block to a chosen list of people (linked or not), no mode needed. */
  onCopyBlockToPeople?: (args: { blockId: string; userIds: string[]; linked: boolean }) => void | Promise<void | { applied: number } | null>
  onCancelCardPlacement?: () => void
  onCancelHubAssignJobPlacement?: () => void
  onLinkedCopySetStage?: (stage: 1 | 2) => void
  /** Office-wide swim lanes for the 'lanes' person grouping (null until loaded). */
  swimLanes?: DispatchSwimLanesData | null
  onSwimLanesChanged?: () => void
  /** Standing office roster changed (v2.1812) — the page re-runs the ensure pass. */
  onOfficeRosterChanged?: () => void
  onHubAssignJobCellPick: (assigneeUserId: string, workDate: string) => void
  onDeleteBlock: (id: string) => void
  onHubEmptyCellClick?: (personUserId: string, workDate: string) => void
  onHubAddJobToScheduleForCell?: (assigneeUserId: string, workDate: string) => void
  hubMultiCellAddActive: boolean
  hubMultiCellAddSelectedKeys: ReadonlySet<string>
  onHubMultiCellAddToggle?: (personUserId: string, workDate: string) => void
  onRequestHubMultiCellAddMode?: () => void
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  onOpenPersonDay?: (b: JobScheduleBlockRow) => void
  /** When false, hide Expected Manpower on the People tab. */
  showExpectedManpower?: boolean
  /** When set, the Day tab uses this as Quickfill schedule work date (e.g. tomorrow in Quickfill). */
  dayTabWorkDateYmd?: string
  /** Fires when the Day tab writes schedule blocks (dot auto-save, add-block) so the host can refresh the week data behind the People/Jobs tabs. */
  onDayScheduleChanged?: () => void
  /** When false, hide the week nav row (e.g. Quickfill tomorrow embed). */
  showWeekNavigation?: boolean
  /** When false, hide the hub tab bar and show only the People grid (e.g. Quickfill tomorrow). */
  showHubViewTabs?: boolean
  /** When false, hide the Hide weekend checkbox on the People tab (e.g. Quickfill tomorrow). */
  showHideWeekendToggle?: boolean
  /** Map keyed by `userTimeOffCellKey(userId, workDate)` → time-off info to render as a chip on the cell. */
  userTimeOffByCell?: ReadonlyMap<string, UserTimeOffCellInfo>
  /** Derived per-cell lateness (v2.2550) — renders the informational amber Late chip. */
  latenessByCell?: ReadonlyMap<string, PersonDayLateness>
  /** Optional click handler for the "Not coming in" chip — opens the undo confirm modal. */
  onRequestUndoNotComingIn?: (personUserId: string, workDate: string) => void
  onMarkNotComingInForCell?: (personUserId: string, workDate: string) => void
  /** RLS-hidden block counts per person-day (superintendent board) — grey "busy" placeholders. */
  hiddenByCell?: ReadonlyMap<string, ScheduleHiddenCell>
  /** v2.2929: "sub" badges on crew cells (job team members, picked days only) and the read-only Subs lanes. */
  subBadgeByCell?: ReadonlyMap<string, SubBadge>
  subLanes?: SubLane[]
  /** Raw hidden-count rows so Expected Manpower shows the true total ("83 · 38 on your projects"). */
  hiddenBlockCounts?: readonly ScheduleHiddenBlockCount[]
  /** Right-aligned content for the week-nav row (e.g. the Share button). */
  weekNavRightSlot?: ReactNode
}

export function ScheduleDispatchHub({
  weekStart,
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  mobileNewMode = false,
  weekNavDateRangeOverride,
  columnFocusDayYmd = '',
  rows,
  bidRows = [],
  loading,
  jobsError,
  summariesError,
  hubTab,
  onHubTabChange,
  personDayBlocks,
  allPeopleRows,
  userIdsWithBlocksThisWeek,
  salariedUserIds,
  getJobDisplayTitle,
  getJobAddress,
  groupMemberCountByGroupId,
  blockCoverageByKey,
  scheduleTodayYmd,
  canEdit,
  onWeekShift,
  onThisWeek,
  onOpenJob,
  onOpenHubJobDetail,
  focusPersonUserId = null,
  roleByUserId,
  cardPlacementMode,
  placementSourceWorkDate,
  plusMenuBlockId,
  onPlusMenuBlockIdChange,
  onStartCardPlacement,
  onCardPlacementCellPick,
  onRequestMoveBlock,
  highlightLinkedGroups,
  onHighlightLinkedGroupsChange,
  linkedGroupAccentByGroupId,
  onOpenLinkedGroup,
  hubWeekBlocks,
  hubExpectedManpowerDayKey,
  onHubExpectedManpowerDayChange,
  hubPeopleNameById,
  canShowExpectedManpowerPayroll,
  hubHourlyWageByUserId,
  hubAssignJobPlacement,
  onRequestHubAddJob,
  linkedCopyMode = null,
  onStartLinkedCopyMode,
  onLinkedCopyToggleBlock,
  onLinkedCopyApplyToPerson,
  onLinkedCopyApplyToLane,
  onQuickAssignScheduled,
  linkedCopyApplyBusy = false,
  phonePeopleView,
  onPhonePeopleViewChange,
  onCopyBlockToPeople,
  onCancelCardPlacement,
  onCancelHubAssignJobPlacement,
  onLinkedCopySetStage,
  swimLanes = null,
  onSwimLanesChanged,
  onOfficeRosterChanged,
  onHubAssignJobCellPick,
  onDeleteBlock,
  onHubEmptyCellClick,
  onHubAddJobToScheduleForCell,
  hubMultiCellAddActive,
  hubMultiCellAddSelectedKeys,
  onHubMultiCellAddToggle,
  onRequestHubMultiCellAddMode,
  onRequestEditBlockNote,
  onOpenPersonDay,
  showExpectedManpower = true,
  dayTabWorkDateYmd,
  onDayScheduleChanged,
  showWeekNavigation = true,
  showHubViewTabs = true,
  showHideWeekendToggle = true,
  userTimeOffByCell,
  latenessByCell,
  onRequestUndoNotComingIn,
  onMarkNotComingInForCell,
  hiddenByCell,
  subBadgeByCell,
  subLanes,
  hiddenBlockCounts,
  weekNavRightSlot,
}: Props) {
  const tabForKey = showHubViewTabs ? hubTab : 'people'
  const hubJobsColumnScrollKey = `${weekStart}-${columnFocusDayYmd}-jobs-${tabForKey}`
  const hubPeopleColumnScrollKey = `${weekStart}-${columnFocusDayYmd}-people-${tabForKey}`

  const [dispatchSettingsOpen, setDispatchSettingsOpen] = useState(false)
  const dispatchSettingsRoster = useMemo<DispatchSettingsModalRosterRow[]>(
    () => allPeopleRows.map((r) => ({ userId: r.userId, displayName: r.displayName })),
    [allPeopleRows],
  )
  // Phone "new mode" chrome (v2.1240) — menu/sheet state is shell-local; every
  // action routes through the SAME page callbacks the desktop toolbar uses.
  const [mobileScheduleMenuOpen, setMobileScheduleMenuOpen] = useState(false)
  const [mobileMoreMenuOpen, setMobileMoreMenuOpen] = useState(false)
  const [mobileQuickAssignOpen, setMobileQuickAssignOpen] = useState(false)
  /** Day tab's visible-hours control, reported by QuickfillScheduleSection (v2.1243). */
  const [daySettingsApi, setDaySettingsApi] = useState<{ open: () => void; windowLabel: string | null; dispatchHref: string } | null>(null)
  /** The Day tab's block sheet on a phone (v2.3885) — the People tab's sheet, with the move sheet as its Move door. */
  const [daySheetBlock, setDaySheetBlock] = useState<JobScheduleBlockRow | null>(null)
  const newModeHeaderActive = mobileNewMode && showHubViewTabs
  const mobileTabButton = (tab: 'day' | 'people' | 'jobs', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={hubTab === tab}
      onClick={() => onHubTabChange(tab)}
      style={{
        padding: '0.35rem 0.8rem',
        fontSize: '0.8125rem',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        background: hubTab === tab ? '#3b82f6' : 'none',
        color: hubTab === tab ? 'white' : 'var(--text-muted)',
        fontWeight: hubTab === tab ? 700 : 500,
      }}
    >
      {label}
    </button>
  )
  const mobileMenuItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.55rem 0.85rem',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: 'var(--text-gray-800)',
    textAlign: 'left',
    borderRadius: 4,
    whiteSpace: 'nowrap',
  }
  const mobileMenuSurfaceStyle: CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    zIndex: 121,
    minWidth: 230,
    padding: '0.3rem',
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  }

  // One ⋯ menu at every width (v2.1243): Visible hours (Day view), Dispatch
  // settings, and Share live here on desktop and phones alike. The trigger
  // tints while a visible-hours window is active — the old inline gear doubled
  // as that status, and hidden state is worse than a hidden control.
  const moreMenuTinted = mobileMoreMenuOpen || daySettingsApi?.windowLabel != null
  const moreMenu =
    weekNavRightSlot || canEdit || daySettingsApi ? (
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setMobileMoreMenuOpen((o) => !o)}
          title="More"
          aria-label="More schedule tools"
          aria-haspopup="menu"
          aria-expanded={mobileMoreMenuOpen}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            background: moreMenuTinted ? 'var(--bg-blue-tint)' : 'var(--surface)',
            color: moreMenuTinted ? 'var(--text-link)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ⋯
        </button>
        {mobileMoreMenuOpen ? (
          <>
            <div onClick={() => setMobileMoreMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120 }} />
            <div role="menu" style={{ ...mobileMenuSurfaceStyle, right: 0, alignItems: 'stretch' }}>
              {daySettingsApi ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMobileMoreMenuOpen(false)
                    daySettingsApi.open()
                  }}
                  style={{ ...mobileMenuItemStyle, justifyContent: 'space-between' }}
                >
                  <span>Visible hours…</span>
                  {daySettingsApi.windowLabel ? (
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        background: 'var(--bg-blue-tint)',
                        color: 'var(--text-blue-700)',
                        borderRadius: 999,
                        padding: '0.1rem 0.5rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {daySettingsApi.windowLabel}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {daySettingsApi ? (
                <Link
                  to={daySettingsApi.dispatchHref}
                  role="menuitem"
                  onClick={() => setMobileMoreMenuOpen(false)}
                  style={{ ...mobileMenuItemStyle, textDecoration: 'none', display: 'block' }}
                >
                  Open in Dispatch week…
                </Link>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMobileMoreMenuOpen(false)
                    setDispatchSettingsOpen(true)
                  }}
                  style={mobileMenuItemStyle}
                >
                  Dispatch settings…
                </button>
              ) : null}
              {weekNavRightSlot ? (
                <>
                  <div style={{ height: 1, background: 'var(--border)', margin: '0.2rem 0.3rem' }} />
                  <div style={{ padding: '0.35rem 0.85rem' }} onClick={() => setMobileMoreMenuOpen(false)}>
                    {weekNavRightSlot}
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    ) : null

  return (
    <div style={{ padding: '1rem 1.25rem', maxWidth: '100%', position: 'relative' }}>
      {newModeHeaderActive ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div
              role="tablist"
              aria-label="Hub view"
              style={{ display: 'inline-flex', gap: 2, padding: 2, background: 'var(--bg-subtle)', borderRadius: 8, minWidth: 0 }}
            >
              {mobileTabButton('day', 'Day')}
              {mobileTabButton('people', 'People')}
              {mobileTabButton('jobs', 'Jobs')}
            </div>
            {canEdit && (onRequestHubAddJob || onRequestHubMultiCellAddMode || onStartLinkedCopyMode) ? (
              <div style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setMobileScheduleMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={mobileScheduleMenuOpen}
                  style={{
                    padding: '0.35rem 0.7rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text-link)',
                    background: 'var(--surface)',
                    border: '1px solid #2563eb',
                    borderRadius: 8,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Schedule
                </button>
                {mobileScheduleMenuOpen ? (
                  <>
                    <div onClick={() => setMobileScheduleMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120 }} />
                    <div role="menu" style={{ ...mobileMenuSurfaceStyle, right: 0 }}>
                      {onRequestHubAddJob ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMobileScheduleMenuOpen(false)
                            onRequestHubAddJob()
                          }}
                          style={mobileMenuItemStyle}
                        >
                          Add one job…
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMobileScheduleMenuOpen(false)
                          setMobileQuickAssignOpen(true)
                        }}
                        style={mobileMenuItemStyle}
                      >
                        Quick Assign — job, people, time…
                      </button>
                      {onRequestHubMultiCellAddMode ? (
                        <button
                          type="button"
                          role="menuitem"
                          title="Pick several person-day cells on the People grid, then add one job to all of them"
                          onClick={() => {
                            setMobileScheduleMenuOpen(false)
                            if (hubTab !== 'people') onHubTabChange('people')
                            onRequestHubMultiCellAddMode()
                          }}
                          style={mobileMenuItemStyle}
                        >
                          Fill several days at once
                        </button>
                      ) : null}
                      {onStartLinkedCopyMode ? (
                        <button
                          type="button"
                          role="menuitem"
                          title="Pick blocks on the People grid, then copy them to a person or lane as a linked chain"
                          onClick={() => {
                            setMobileScheduleMenuOpen(false)
                            if (hubTab !== 'people') onHubTabChange('people')
                            onStartLinkedCopyMode()
                          }}
                          style={mobileMenuItemStyle}
                        >
                          Copy as a linked chain
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {moreMenu}
          </div>
        </div>
      ) : null}
      {!newModeHeaderActive && showHubViewTabs ? (
        <div
          role="tablist"
          aria-label="Hub view"
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: 2,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={hubTab === 'people'}
            onClick={() => onHubTabChange('people')}
            style={{
              padding: '0.5rem 0.9rem',
              fontSize: '0.875rem',
              border: 'none',
              background: hubTab === 'people' ? '#3b82f6' : 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: hubTab === 'people' ? 'white' : 'var(--text-muted)',
              fontWeight: hubTab === 'people' ? 700 : 400,
            }}
          >
            People
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={hubTab === 'jobs'}
            onClick={() => onHubTabChange('jobs')}
            style={{
              padding: '0.5rem 0.9rem',
              fontSize: '0.875rem',
              border: 'none',
              background: hubTab === 'jobs' ? '#3b82f6' : 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: hubTab === 'jobs' ? 'white' : 'var(--text-muted)',
              fontWeight: hubTab === 'jobs' ? 700 : 400,
            }}
          >
            Jobs
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={hubTab === 'day'}
            onClick={() => onHubTabChange('day')}
            style={{
              padding: '0.5rem 0.9rem',
              fontSize: '0.875rem',
              border: 'none',
              background: hubTab === 'day' ? '#3b82f6' : 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: hubTab === 'day' ? 'white' : 'var(--text-muted)',
              fontWeight: hubTab === 'day' ? 700 : 400,
            }}
          >
            Day
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{moreMenu}</div>
        </div>
      ) : null}

      {/* Week nav sits BELOW the tab bar and only on the week-scoped tabs — the Day tab has its own
          day navigation. The right slot (Share) lives in the tab-bar cluster when tabs are shown.
          On the People tab the nav renders INSIDE the panel's toolbar row (weekNav prop below) so
          it shares a line with the controls when the viewport is wide. */}
      {showWeekNavigation &&
      (!showHubViewTabs || hubTab === 'jobs' || (newModeHeaderActive && hubTab === 'people')) ? (
        <ScheduleDispatchWeekNav
          weekStart={weekStart}
          onWeekShift={onWeekShift}
          onThisWeek={onThisWeek}
          dateRangeOverride={weekNavDateRangeOverride}
          rightSlot={showHubViewTabs ? undefined : weekNavRightSlot}
          compact={newModeHeaderActive}
        />
      ) : null}

      {!showHubViewTabs ? (
        <HubPeoplePanel
          visibleDayKeys={visibleDayKeys}
          hideWeekend={hideWeekend}
          onHideWeekendChange={onHideWeekendChange}
          allPeopleRows={allPeopleRows}
          userIdsWithBlocksThisWeek={userIdsWithBlocksThisWeek}
          salariedUserIds={salariedUserIds}
          personDayBlocks={personDayBlocks}
          getJobDisplayTitle={getJobDisplayTitle}
          getJobAddress={getJobAddress}
          groupMemberCountByGroupId={groupMemberCountByGroupId}
                        blockCoverageByKey={blockCoverageByKey}
          scheduleTodayYmd={scheduleTodayYmd}
          columnFocusDayYmd={columnFocusDayYmd}
          columnScrollKey={hubPeopleColumnScrollKey}
          canEdit={canEdit}
          loading={loading}
          jobsError={jobsError}
          summariesError={summariesError}
          onOpenJob={onOpenJob}
          onOpenHubJobDetail={onOpenHubJobDetail}
          focusPersonUserId={focusPersonUserId}
          roleByUserId={roleByUserId}
          cardPlacementMode={cardPlacementMode}
          placementSourceWorkDate={placementSourceWorkDate}
          plusMenuBlockId={plusMenuBlockId}
          onPlusMenuBlockIdChange={onPlusMenuBlockIdChange}
          onStartCardPlacement={onStartCardPlacement}
          onCardPlacementCellPick={onCardPlacementCellPick}
          onRequestMoveBlock={onRequestMoveBlock}
          highlightLinkedGroups={highlightLinkedGroups}
          onHighlightLinkedGroupsChange={onHighlightLinkedGroupsChange}
          linkedGroupAccentByGroupId={linkedGroupAccentByGroupId}
          onOpenLinkedGroup={onOpenLinkedGroup}
          hubWeekBlocks={hubWeekBlocks}
          hubExpectedManpowerDayKey={hubExpectedManpowerDayKey}
          onHubExpectedManpowerDayChange={onHubExpectedManpowerDayChange}
          hubPeopleNameById={hubPeopleNameById}
          canShowExpectedManpowerPayroll={canShowExpectedManpowerPayroll}
          hubHourlyWageByUserId={hubHourlyWageByUserId}
          hubAssignJobPlacement={hubAssignJobPlacement}
          onHubAssignJobCellPick={onHubAssignJobCellPick}
          onDeleteBlock={onDeleteBlock}
          onEmptyCellClick={onHubEmptyCellClick}
          onAddJobToScheduleForCell={onHubAddJobToScheduleForCell}
          hubMultiCellAddActive={hubMultiCellAddActive}
          hubMultiCellAddSelectedKeys={hubMultiCellAddSelectedKeys}
          onHubMultiCellAddToggle={onHubMultiCellAddToggle}
          onRequestHubAddJob={onRequestHubAddJob}
          linkedCopyMode={linkedCopyMode}
          onStartLinkedCopyMode={onStartLinkedCopyMode}
          onLinkedCopyToggleBlock={onLinkedCopyToggleBlock}
          onLinkedCopyApplyToPerson={onLinkedCopyApplyToPerson}
          onLinkedCopyApplyToLane={onLinkedCopyApplyToLane}
          onQuickAssignScheduled={onQuickAssignScheduled}
          linkedCopyApplyBusy={linkedCopyApplyBusy}
          phonePeopleView={phonePeopleView}
          onPhonePeopleViewChange={onPhonePeopleViewChange}
          onCopyBlockToPeople={onCopyBlockToPeople}
          onCancelCardPlacement={onCancelCardPlacement}
          onCancelHubAssignJobPlacement={onCancelHubAssignJobPlacement}
          onLinkedCopySetStage={onLinkedCopySetStage}
          swimLanes={swimLanes}
          onRequestHubMultiCellAddMode={onRequestHubMultiCellAddMode}
          onRequestEditBlockNote={onRequestEditBlockNote}
              onOpenPersonDay={onOpenPersonDay}
          showExpectedManpower={showExpectedManpower}
          showHideWeekendToggle={showHideWeekendToggle}
          userTimeOffByCell={userTimeOffByCell}
          latenessByCell={latenessByCell}
          onRequestUndoNotComingIn={onRequestUndoNotComingIn}
          onMarkNotComingInForCell={onMarkNotComingInForCell}
          hiddenByCell={hiddenByCell}
          subBadgeByCell={subBadgeByCell}
          subLanes={subLanes}
          hiddenBlockCounts={hiddenBlockCounts}
        />
      ) : hubTab === 'day' ? (
        <QuickfillScheduleSection
          hideConflictPrompt
          initialWorkDateYmd={dayTabWorkDateYmd}
          onBlocksSaved={onDayScheduleChanged}
          showDaySettings
          onDaySettingsApiChange={setDaySettingsApi}
          onPhoneBlockTap={setDaySheetBlock}
        />
      ) : hubTab === 'jobs' ? (
        <HubJobsPanel
          rows={rows}
          bidRows={bidRows}
          loading={loading}
          jobsError={jobsError}
          summariesError={summariesError}
          visibleDayKeys={visibleDayKeys}
          hideWeekend={hideWeekend}
          onHideWeekendChange={onHideWeekendChange}
          onOpenJob={onOpenJob}
          scheduleTodayYmd={scheduleTodayYmd}
          columnFocusDayYmd={columnFocusDayYmd}
          columnScrollKey={hubJobsColumnScrollKey}
        />
      ) : (
        <HubPeoplePanel
          weekNav={
            showWeekNavigation && !newModeHeaderActive ? (
              <ScheduleDispatchWeekNav
                inline
                weekStart={weekStart}
                onWeekShift={onWeekShift}
                onThisWeek={onThisWeek}
                dateRangeOverride={weekNavDateRangeOverride}
              />
            ) : undefined
          }
          visibleDayKeys={visibleDayKeys}
          hideWeekend={hideWeekend}
          onHideWeekendChange={onHideWeekendChange}
          allPeopleRows={allPeopleRows}
          userIdsWithBlocksThisWeek={userIdsWithBlocksThisWeek}
          salariedUserIds={salariedUserIds}
          personDayBlocks={personDayBlocks}
          getJobDisplayTitle={getJobDisplayTitle}
          getJobAddress={getJobAddress}
          groupMemberCountByGroupId={groupMemberCountByGroupId}
                        blockCoverageByKey={blockCoverageByKey}
          scheduleTodayYmd={scheduleTodayYmd}
          columnFocusDayYmd={columnFocusDayYmd}
          columnScrollKey={hubPeopleColumnScrollKey}
          canEdit={canEdit}
          loading={loading}
          jobsError={jobsError}
          summariesError={summariesError}
          onOpenJob={onOpenJob}
          onOpenHubJobDetail={onOpenHubJobDetail}
          focusPersonUserId={focusPersonUserId}
          roleByUserId={roleByUserId}
          cardPlacementMode={cardPlacementMode}
          placementSourceWorkDate={placementSourceWorkDate}
          plusMenuBlockId={plusMenuBlockId}
          onPlusMenuBlockIdChange={onPlusMenuBlockIdChange}
          onStartCardPlacement={onStartCardPlacement}
          onCardPlacementCellPick={onCardPlacementCellPick}
          onRequestMoveBlock={onRequestMoveBlock}
          highlightLinkedGroups={highlightLinkedGroups}
          onHighlightLinkedGroupsChange={onHighlightLinkedGroupsChange}
          linkedGroupAccentByGroupId={linkedGroupAccentByGroupId}
          onOpenLinkedGroup={onOpenLinkedGroup}
          hubWeekBlocks={hubWeekBlocks}
          hubExpectedManpowerDayKey={hubExpectedManpowerDayKey}
          onHubExpectedManpowerDayChange={onHubExpectedManpowerDayChange}
          hubPeopleNameById={hubPeopleNameById}
          canShowExpectedManpowerPayroll={canShowExpectedManpowerPayroll}
          hubHourlyWageByUserId={hubHourlyWageByUserId}
          hubAssignJobPlacement={hubAssignJobPlacement}
          onHubAssignJobCellPick={onHubAssignJobCellPick}
          onDeleteBlock={onDeleteBlock}
          onEmptyCellClick={onHubEmptyCellClick}
          onAddJobToScheduleForCell={onHubAddJobToScheduleForCell}
          hubMultiCellAddActive={hubMultiCellAddActive}
          hubMultiCellAddSelectedKeys={hubMultiCellAddSelectedKeys}
          onHubMultiCellAddToggle={onHubMultiCellAddToggle}
          onRequestHubAddJob={onRequestHubAddJob}
          linkedCopyMode={linkedCopyMode}
          onStartLinkedCopyMode={onStartLinkedCopyMode}
          onLinkedCopyToggleBlock={onLinkedCopyToggleBlock}
          onLinkedCopyApplyToPerson={onLinkedCopyApplyToPerson}
          onLinkedCopyApplyToLane={onLinkedCopyApplyToLane}
          onQuickAssignScheduled={onQuickAssignScheduled}
          linkedCopyApplyBusy={linkedCopyApplyBusy}
          phonePeopleView={phonePeopleView}
          onPhonePeopleViewChange={onPhonePeopleViewChange}
          onCopyBlockToPeople={onCopyBlockToPeople}
          onCancelCardPlacement={onCancelCardPlacement}
          onCancelHubAssignJobPlacement={onCancelHubAssignJobPlacement}
          onLinkedCopySetStage={onLinkedCopySetStage}
          swimLanes={swimLanes}
          onRequestHubMultiCellAddMode={onRequestHubMultiCellAddMode}
          onRequestEditBlockNote={onRequestEditBlockNote}
              onOpenPersonDay={onOpenPersonDay}
          showExpectedManpower={showExpectedManpower}
          showHideWeekendToggle={showHideWeekendToggle}
          userTimeOffByCell={userTimeOffByCell}
          latenessByCell={latenessByCell}
          onRequestUndoNotComingIn={onRequestUndoNotComingIn}
          onMarkNotComingInForCell={onMarkNotComingInForCell}
          hiddenByCell={hiddenByCell}
          subBadgeByCell={subBadgeByCell}
          subLanes={subLanes}
          hiddenBlockCounts={hiddenBlockCounts}
        />
      )}
      <DispatchSettingsModal
        open={dispatchSettingsOpen}
        onClose={() => setDispatchSettingsOpen(false)}
        roster={dispatchSettingsRoster}
        onSwimLanesChanged={onSwimLanesChanged}
        onOfficeRosterChanged={onOfficeRosterChanged}
      />
      {/* New-mode Quick Assign lives at the shell so the + Schedule sheet can open
          it from any tab; the People panel's own instance stays for its toolbar. */}
      {mobileNewMode && canEdit ? (
        <QuickAssignSheet
          open={mobileQuickAssignOpen}
          onClose={() => setMobileQuickAssignOpen(false)}
          onScheduled={onQuickAssignScheduled}
        />
      ) : null}
      {daySheetBlock && hubTab === 'day' ? (
        <ScheduleBlockSheet
          title={getJobDisplayTitle(scheduleBlockAnchorId(daySheetBlock))}
          subtitle={[scheduleFormatWindow(daySheetBlock.time_start, daySheetBlock.time_end), hubPeopleNameById.get(daySheetBlock.assignee_user_id) ?? '', getJobAddress?.(scheduleBlockAnchorId(daySheetBlock)) ?? ''].filter(Boolean).join(' · ')}
          note={daySheetBlock.note ?? ''}
          onClose={() => setDaySheetBlock(null)}
          onOpenJob={() => {
            const b = daySheetBlock
            setDaySheetBlock(null)
            onOpenHubJobDetail(b, b.work_date)
          }}
          onEditNote={
            canEdit && onRequestEditBlockNote
              ? () => {
                  const b = daySheetBlock
                  setDaySheetBlock(null)
                  onRequestEditBlockNote(b)
                }
              : undefined
          }
          onMove={
            canEdit && onRequestMoveBlock
              ? () => {
                  const b = daySheetBlock
                  setDaySheetBlock(null)
                  onRequestMoveBlock(b)
                }
              : undefined
          }
          moveLabel="Move or reassign"
          moveHint="Pick the day and the person"
          onRemove={
            canEdit
              ? () => {
                  const b = daySheetBlock
                  setDaySheetBlock(null)
                  onDeleteBlock(b.id)
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
