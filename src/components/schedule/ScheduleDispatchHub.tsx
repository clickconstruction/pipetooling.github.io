import type { CSSProperties, ReactNode } from 'react'
import { type BlockCoverage } from '../../lib/schedule/blockGroupCoverage'
import type { SubBadge, SubLane } from '../../lib/subs/subDispatch'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { scheduleBlockAnchorId, type JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import type { LinkedCopyMode } from '../../lib/scheduleDispatchLinkedCopy'
import type { DispatchSwimLanesData } from '../../lib/dispatchSwimLanes'
import type { LinkedGroupCardAccent } from '../../lib/scheduleDispatchLinkedGroupPalette'
import { type ScheduleDispatchHubMergedRow } from '../../lib/scheduleDispatchHub'
import { type ScheduleDispatchHubBidMatrixRow } from '../../lib/scheduleBlockTitle'
import { type ScheduleHiddenBlockCount, type ScheduleHiddenCell } from '../../lib/scheduleHiddenBlocks'
import { QuickfillScheduleSection } from '../quickfill/QuickfillScheduleSection'
import { ScheduleDispatchWeekNav } from './ScheduleDispatchWeekNav'
import QuickAssignSheet from '../dispatchMode/QuickAssignSheet'
import type { ScheduleDispatchCardPlacementMode, ScheduleDispatchCardPlacementVariant } from './ScheduleDispatchGrid'
import { ScheduleBlockSheet } from './ScheduleBlockSheet'
import { HubJobsPanel } from './HubJobsPanel'
import { HubPeoplePanel } from './HubPeoplePanel'
import type { PhonePeopleView } from '../../lib/scheduleDispatch/phonePeopleBoard'
import { type UserTimeOffCellInfo } from '../../lib/userTimeOffByCell'
import { type PersonDayLateness } from '../../lib/scheduleLateness'
import { DispatchSettingsModal, type DispatchSettingsModalRosterRow } from './DispatchSettingsModal'
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
