import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { groupRosterUsersByAuthRoleSection } from '../../lib/usersTabRosterRoleSections'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useToastContext } from '../../contexts/ToastContext'
import { scheduleBlockAnchorId, type JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import {
  scheduleBlockActionLinkedIconButtonStyle,
  scheduleBlockActionTextButtonStyle,
  scheduleBlockControlPlateBackgroundStyle,
} from '../../lib/scheduleBlockActionChromeStyle'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import {
  expectedManpowerJobGroupPayrollEstimate,
  expectedManpowerJobGroupsForDay,
  expectedManpowerPersonHoursTotalForDayKeys,
  expectedManpowerRowsForDay,
  expectedManpowerRowsForVisibleDays,
  formatExpectedManpowerPersonHours,
  HUB_EXPECTED_MANPOWER_ALL_WEEK,
} from '../../lib/scheduleDispatchExpectedManpower'
import { formatCurrency } from '../../lib/format'
import { SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE } from '../../lib/scheduleDispatchDragHelp'
import { formatFieldMovedFrom } from '../../lib/selfScheduleJobs'
import { scheduleDispatchCellDroppableId } from '../../lib/scheduleDispatchDnd'
import { ScheduleDispatchBlockNoteIcon } from '../icons/ScheduleDispatchBlockNoteIcon'
import { ScheduleDispatchLinkedChainsIcon } from '../icons/ScheduleDispatchLinkedChainsIcon'
import type { LinkedCopyMode } from '../../lib/scheduleDispatchLinkedCopy'
import type { DispatchSwimLanesData } from '../../lib/dispatchSwimLanes'
import {
  buildSwimLaneDisplaySections,
  personMatchesLaneQuery,
  summarizeExpectedManpowerByLane,
} from '../../lib/dispatchSwimLaneSections'
import type { LinkedGroupCardAccent } from '../../lib/scheduleDispatchLinkedGroupPalette'
import { hubPersonDayKey, type ScheduleDispatchHubJobRow } from '../../lib/scheduleDispatchHub'
import {
  APP_CALENDAR_TZ,
  formatMmDdSlash,
  formatScheduleDispatchVisibleDateRange,
  referenceDateForWorkDateYmd,
} from '../../utils/dateUtils'
import { QuickfillScheduleSection } from '../quickfill/QuickfillScheduleSection'
import { ScheduleDispatchPlusCopyMenu } from './ScheduleDispatchPlusCopyMenu'
import { ScheduleDispatchWeekNav } from './ScheduleDispatchWeekNav'
import QuickAssignSheet from '../dispatchMode/QuickAssignSheet'
import type { ScheduleDispatchCardPlacementMode } from './ScheduleDispatchGrid'
import {
  SCHEDULE_DISPATCH_TODAY_COLUMN_BG,
  scheduleDispatchDayColumnCellIdleBg,
  scheduleDispatchDayColumnHeaderStyle,
  scheduleDispatchTodayColumnBoxShadow,
  scheduleDispatchDayColumnJobsSummaryCellBg,
  useScrollScheduleDispatchColumnIntoView,
} from '../../lib/scheduleDispatchColumnFocus'
import { scheduleDispatchMobileNamePill } from '../../lib/scheduleDispatchMobileNamePill'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  userTimeOffCellKey,
  type UserTimeOffCellInfo,
} from '../../lib/userTimeOffByCell'
import { ScheduleDispatchTimeOffChip } from './ScheduleDispatchTimeOffChip'
import { DispatchSettingsModal, type DispatchSettingsModalRosterRow } from './DispatchSettingsModal'
import { useDispatchNoteRequirements } from '../../contexts/DispatchNoteRequirementsContext'
import {
  editNoteIconColorForBlock,
  effectiveNoteRequirement,
  surroundingIconColorForRequirement,
} from '../../lib/dispatchNoteRequirements'
const hubExpectedManpowerSrOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/** Chevron column; indent for expanded assignee detail (dashboard strip rhythm). */
const HUB_EXPECTED_MANPOWER_EXPAND_COL = '1.75rem'
const HUB_EXPECTED_MANPOWER_JOB_COL_SPAN = 2

const hubExpectedManpowerSectionTh: CSSProperties = {
  textAlign: 'left' as const,
  padding: '0.45rem',
  border: '1px solid var(--border)',
  background: 'var(--bg-muted)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text-strong)',
}

const hubExpectedManpowerRowTd: CSSProperties = {
  padding: '0.45rem',
  border: '1px solid var(--border)',
  verticalAlign: 'middle' as const,
  fontSize: '0.8125rem',
}

export type ScheduleDispatchHubMergedRow = ScheduleDispatchHubJobRow & {
  displayTitle: string
  totalBlocks: number
  byDay: Record<string, number>
}

function shortDowLabel(dateKey: string): string {
  const d = referenceDateForWorkDateYmd(dateKey)
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: APP_CALENDAR_TZ }).format(d)
}

function hubDayColumnHeaderLabel(dateKey: string): string {
  return `${shortDowLabel(dateKey)} (${formatMmDdSlash(dateKey)})`
}

/** Jobs-grid day header (v2.1362): weekday over date on two lines so columns stay narrow. */
function hubDayColumnHeaderStacked(dateKey: string) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.25 }}>
      <span>{shortDowLabel(dateKey)}</span>
      <span style={{ fontWeight: 400 }}>({formatMmDdSlash(dateKey)})</span>
    </span>
  )
}

type HubJobsPanelProps = {
  rows: ScheduleDispatchHubMergedRow[]
  loading: boolean
  jobsError: string | null
  summariesError: string | null
  visibleDayKeys: string[]
  hideWeekend: boolean
  onHideWeekendChange: (hide: boolean) => void
  onOpenJob: (jobId: string) => void
  scheduleTodayYmd: string
  columnFocusDayYmd: string
  columnScrollKey: string
}

function HubJobsPanel({
  rows,
  loading,
  jobsError,
  summariesError,
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  onOpenJob,
  scheduleTodayYmd,
  columnFocusDayYmd,
  columnScrollKey,
}: HubJobsPanelProps) {
  const jobsScrollRef = useRef<HTMLDivElement>(null)
  useScrollScheduleDispatchColumnIntoView({
    columnFocusDayYmd,
    loading,
    scrollRootRef: jobsScrollRef,
    scrollKey: columnScrollKey,
  })

  const [search, setSearch] = useState('')
  const [onlyWithBlocks, setOnlyWithBlocks] = useState(true)
  // Phone (v2.1360): search behind a magnifier toggle; the two checkboxes move into a View menu.
  const jobsIsMobile = useIsMobile()
  const [mobileJobsSearchOpen, setMobileJobsSearchOpen] = useState(false)
  const [jobsViewMenuOpen, setJobsViewMenuOpen] = useState(false)
  const jobsViewMenuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!jobsViewMenuOpen) return
    const onDown = (e: globalThis.MouseEvent) => {
      if (jobsViewMenuRef.current && !jobsViewMenuRef.current.contains(e.target as Node)) setJobsViewMenuOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setJobsViewMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [jobsViewMenuOpen])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows
    if (q) {
      list = list.filter(
        (r) =>
          (r.hcp_number ?? '').toLowerCase().includes(q) ||
          (r.job_name ?? '').toLowerCase().includes(q) ||
          r.displayTitle.toLowerCase().includes(q),
      )
    }
    if (onlyWithBlocks) {
      list = list.filter((r) => r.totalBlocks > 0)
    }
    return list
  }, [rows, search, onlyWithBlocks])

  return (
    <>
      {jobsError ? (
        <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{jobsError}</p>
      ) : null}
      {summariesError ? (
        <p style={{ color: 'var(--text-amber-800)', fontSize: '0.875rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
          Could not load schedule counts for this week ({summariesError}). Counts shown as 0.
        </p>
      ) : null}

      {jobsIsMobile ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setMobileJobsSearchOpen((o) => !o)}
              title="Search HCP or job name"
              aria-label="Search HCP or job name"
              aria-expanded={mobileJobsSearchOpen}
              style={{
                ...hubPeopleToolbarIconBtn,
                ...(mobileJobsSearchOpen || search.trim() !== ''
                  ? { borderColor: '#2563eb', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }
                  : { borderColor: 'var(--border-strong)', color: 'var(--text-700)' }),
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
                <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4 457.4 502.6 330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
              </svg>
            </button>
            <div ref={jobsViewMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={jobsViewMenuOpen}
                aria-label="View options: only jobs with blocks, hide weekend"
                onClick={() => setJobsViewMenuOpen((o) => !o)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: jobsViewMenuOpen ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: 'var(--text-700)',
                  cursor: 'pointer',
                }}
              >
                View
                <span aria-hidden style={{ fontSize: '0.65rem' }}>{jobsViewMenuOpen ? '▲' : '▼'}</span>
              </button>
              {jobsViewMenuOpen ? (
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
                    <input type="checkbox" checked={onlyWithBlocks} onChange={(e) => setOnlyWithBlocks(e.target.checked)} />
                    Only jobs with blocks this week
                  </label>
                  <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hideWeekend}
                      onChange={(e) => onHideWeekendChange(e.target.checked)}
                      aria-label="Hide Saturday and Sunday columns"
                    />
                    Hide weekend
                  </label>
                </div>
              ) : null}
            </div>
          </div>
          {mobileJobsSearchOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search HCP or job name"
                aria-label="Search HCP or job name"
                style={{ flex: 1, minWidth: 0, padding: '0.4rem 0.5rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setMobileJobsSearchOpen(false)
                }}
                title="Clear search and close"
                aria-label="Clear search and close"
                style={{ ...hubPeopleToolbarIconBtn, borderColor: 'var(--border-strong)', color: 'var(--text-700)' }}
              >
                ×
              </button>
            </div>
          ) : null}
        </div>
      ) : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search HCP or job name"
            aria-label="Search HCP or job name"
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', minWidth: 200 }}
          />
        </label>
        <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyWithBlocks} onChange={(e) => setOnlyWithBlocks(e.target.checked)} />
          Only jobs with blocks this week
        </label>
        <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={hideWeekend}
            onChange={(e) => onHideWeekendChange(e.target.checked)}
            aria-label="Hide Saturday and Sunday columns"
          />
          Hide weekend
        </label>
      </div>
      )}

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : null}

      <div
        ref={jobsScrollRef}
        style={{
          overflowX: 'auto',
          marginLeft: 'calc(-1 * (var(--app-main-pad) + 1.25rem))',
          marginRight: 'calc(-1 * (var(--app-main-pad) + 1.25rem))',
        }}
      >
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-muted)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                }}
              >
                Job
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                Total
              </th>
              {visibleDayKeys.map((dk) => (
                <th
                  key={dk}
                  data-schedule-column-day={dk}
                  style={{
                    textAlign: 'center',
                    padding: '0.35rem',
                    border: '1px solid var(--border)',
                    ...scheduleDispatchDayColumnHeaderStyle(dk, { scheduleTodayYmd, columnFocusDayYmd }, 'var(--bg-muted)'),
                    fontSize: '0.75rem',
                    minWidth: 60,
                  }}
                  title={dk}
                >
                  {hubDayColumnHeaderStacked(dk)}
                </th>
              ))}
              <th style={{ padding: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-muted)' }} aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={2 + visibleDayKeys.length + 1}
                  style={{ padding: '1rem', border: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'center' }}
                >
                  {rows.length === 0 && !jobsError
                    ? 'No jobs to show.'
                    : 'No jobs match your search or filter.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td
                    style={{
                      padding: '0.5rem',
                      border: '1px solid var(--border)',
                      position: 'sticky',
                      left: 0,
                      background: 'var(--surface)',
                      zIndex: 1,
                      minWidth: 130,
                      maxWidth: 280,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenJob(r.id)}
                      title={r.displayTitle}
                      style={{
                        padding: 0,
                        margin: 0,
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-blue-700)',
                        cursor: 'pointer',
                        font: 'inherit',
                        textAlign: 'left',
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {r.displayTitle}
                    </button>
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid var(--border)', fontWeight: 600 }}>
                    {r.totalBlocks}
                  </td>
                  {visibleDayKeys.map((dk) => (
                    <td
                      key={dk}
                      style={{
                        textAlign: 'center',
                        padding: '0.35rem',
                        border: '1px solid var(--border)',
                        color: 'var(--text-600)',
                        background: scheduleDispatchDayColumnJobsSummaryCellBg(dk, {
                          scheduleTodayYmd,
                          columnFocusDayYmd,
                        }),
                      }}
                    >
                      {r.byDay[dk] ?? '—'}
                    </td>
                  ))}
                  <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onOpenJob(r.id)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

const hubPeopleSalarySuffix: CSSProperties = {
  display: 'block',
  fontSize: '0.68rem',
  color: 'var(--text-faint)',
  fontWeight: 400,
  lineHeight: 1.1,
}

function HubPeopleBlockCard({
  block,
  linkedCopyStage = null,
  linkedCopySelected = false,
  onLinkedCopyToggle,
  workDate,
  scheduleTodayYmd,
  canEdit,
  hubMultiCellAddActive,
  linkPeerCount,
  highlightLinkedGroups,
  linkedGroupAccentByGroupId,
  onOpenLinkedGroup,
  cardPlacementMode,
  plusMenuOpen,
  onPlusMenuBlockIdChange,
  onStartCardPlacement,
  getJobDisplayTitle,
  getJobAddress,
  onOpenJob,
  onOpenHubJobDetail,
  onDeleteBlock,
  onRequestEditBlockNote,
  onOpenPersonDay,
}: {
  block: JobScheduleBlockRow
  linkedCopyStage?: 1 | 2 | null
  linkedCopySelected?: boolean
  onLinkedCopyToggle?: (blockId: string) => void
  workDate: string
  scheduleTodayYmd: string
  canEdit: boolean
  hubMultiCellAddActive: boolean
  linkPeerCount: number
  highlightLinkedGroups: boolean
  linkedGroupAccentByGroupId: ReadonlyMap<string, LinkedGroupCardAccent>
  onOpenLinkedGroup: (groupId: string) => void
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  plusMenuOpen: boolean
  onPlusMenuBlockIdChange: (blockId: string | null) => void
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: 'linked' | 'unlinked') => void
  getJobDisplayTitle: (jobId: string) => string
  /** Job address for the card's one-line ellipsized subline; empty string when none. */
  getJobAddress?: (jobId: string) => string
  onOpenJob: (jobId: string) => void
  onOpenHubJobDetail: (block: JobScheduleBlockRow, workDateYmd: string) => void
  onDeleteBlock: (id: string) => void
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  /** Clock button (v2.1817): open the assignee's whole-day Manage modal. */
  onOpenPersonDay?: (b: JobScheduleBlockRow) => void
}) {
  const { showToast } = useToastContext()
  const { requirementForBlock } = useDispatchNoteRequirements()
  const noteRequirement = requirementForBlock({
    userId: block.assignee_user_id,
    jobId: block.job_id,
  })
  const isPastWorkDate = block.work_date < scheduleTodayYmd
  const effectiveRequirement = effectiveNoteRequirement(noteRequirement, isPastWorkDate)
  const editNoteColor = editNoteIconColorForBlock({
    requirement: effectiveRequirement,
    hasNote: Boolean(block.note),
  })
  const chainsColor = surroundingIconColorForRequirement(effectiveRequirement, '#1d4ed8')
  const minusColor = surroundingIconColorForRequirement(effectiveRequirement, '#b91c1c')
  const plusColor = surroundingIconColorForRequirement(effectiveRequirement, '#1d4ed8')
  const plusButtonRef = useRef<HTMLButtonElement>(null)
  const placementPickingActive = cardPlacementMode != null
  const linkedCopyActive = linkedCopyStage != null
  const dragDisabled = !canEdit || hubMultiCellAddActive || linkedCopyActive
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    disabled: dragDisabled,
  })

  const explainDisabledDrag = () => {
    showToast(SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE, 'info')
  }

  const disabledStripAriaLabel =
    'Cannot drag: you do not have permission to reassign schedule blocks. Click for an explanation.'

  const groupId = block.shared_block_group_id
  const showLinkedFloat = Boolean(groupId && linkPeerCount > 1)
  const showEditNoteBtn = canEdit && !placementPickingActive && !linkedCopyActive && !!onRequestEditBlockNote
  const showPersonDayBtn = !placementPickingActive && !linkedCopyActive && !!onOpenPersonDay
  const showMinusPlusButtons = canEdit && !placementPickingActive && !linkedCopyActive
  const linkedAccent =
    highlightLinkedGroups && groupId && linkPeerCount > 1
      ? linkedGroupAccentByGroupId.get(groupId)
      : undefined

  const style: CSSProperties = {
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if (placementPickingActive) e.stopPropagation()
      }}
      style={{
        ...style,
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        marginBottom: 4,
        background: linkedAccent?.background ?? 'var(--bg-blue-tint)',
        borderStyle: 'solid',
        borderColor: linkedAccent?.borderColor ?? '#93c5fd',
        borderWidth: linkedAccent ? '3px 1px 1px 1px' : 1,
        borderRadius: 4,
        fontSize: '0.72rem',
        color: 'var(--text-blue-900)',
        overflow: 'visible',
        ...(linkedCopySelected ? { boxShadow: '0 0 0 2px #4338ca' } : {}),
        ...(linkedCopyActive && !linkedCopySelected && linkedCopyStage === 2 ? { opacity: 0.55 } : {}),
      }}
      title={
        linkedAccent
          ? 'Mirrored crew block — same accent color as other people in this linked group for this week.'
          : undefined
      }
    >
      <div
        {...(dragDisabled
          ? {
              role: 'button' as const,
              tabIndex: 0,
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                explainDisabledDrag()
              },
              onKeyDown: (e: KeyboardEvent) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                e.stopPropagation()
                explainDisabledDrag()
              },
            }
          : { ...listeners, ...attributes })}
        style={{
          flexShrink: 0,
          // v2.1816: the handle was a bare 14px sliver nobody could find —
          // dispatchers were deleting + re-adding blocks instead of moving
          // them. Wider, with visible grip dots and a tooltip.
          width: 22,
          minHeight: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: dragDisabled ? undefined : 'none',
          cursor: dragDisabled ? 'pointer' : 'grab',
          background: dragDisabled
            ? 'linear-gradient(90deg, var(--bg-red-100) 0%, var(--bg-red-200) 100%)'
            : 'linear-gradient(90deg, var(--bg-blue-200) 0%, var(--bg-blue-tint) 100%)',
          borderRight: `1px solid ${dragDisabled ? 'var(--border-red)' : 'var(--border-blue)'}`,
          outline: 'none',
        }}
        title={
          dragDisabled ? undefined : 'Drag to move this block to another day or person'
        }
        aria-label={
          dragDisabled ? disabledStripAriaLabel : 'Drag to move block to another day or person row'
        }
      >
        <span
          aria-hidden
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            fontSize: '0.7rem',
            lineHeight: 1,
            letterSpacing: '-1px',
            color: dragDisabled ? 'var(--text-red-600)' : 'var(--text-blue-900)',
            opacity: 0.6,
          }}
        >
          ⠿
        </span>
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (placementPickingActive) return
            onOpenHubJobDetail(block, workDate)
          }}
          style={{
            display: 'block',
            width: '100%',
            padding: '0.35rem 0.45rem',
            margin: 0,
            border: 'none',
            borderBottom: '1px solid var(--border-blue)',
            background: 'transparent',
            cursor: placementPickingActive ? 'default' : 'pointer',
            textAlign: 'left',
            font: 'inherit',
            color: 'inherit',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--text-blue-900)', wordBreak: 'break-word' }}>
            {getJobDisplayTitle(scheduleBlockAnchorId(block))}
          </span>
          {(() => {
            const addr = getJobAddress?.(scheduleBlockAnchorId(block)) ?? ''
            if (!addr) return null
            return (
              <span
                title={addr}
                style={{
                  display: 'block',
                  color: 'var(--text-600)',
                  fontWeight: 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {addr}
              </span>
            )
          })()}
        </button>
        <button
          type="button"
          onClick={() => {
            if (placementPickingActive) return
            onOpenJob(scheduleBlockAnchorId(block))
          }}
          style={{
            display: 'block',
            width: '100%',
            minWidth: 0,
            padding: '0.35rem 0.45rem',
            margin: 0,
            border: 'none',
            background: 'transparent',
            cursor: placementPickingActive ? 'default' : 'pointer',
            textAlign: 'left',
            font: 'inherit',
            color: 'inherit',
          }}
        >
          <div
            style={{
              color: 'var(--text-blue-800)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
            }}
          >
            <span>{scheduleFormatWindow(block.time_start, block.time_end)}</span>
            {/* v2.1568 self-scheduling trail: the assignee moved this dispatch-made
                block themselves — movement is allowed, silence isn't. */}
            {block.field_moved_at ? (
              <span
                title={`Moved by the assignee — ${formatFieldMovedFrom(block as { field_moved_from?: { work_date?: string; time_start?: string; time_end?: string } | null }) ?? 'original window unknown'}`}
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: 'var(--text-amber-800)',
                  background: 'var(--bg-orange-tint)',
                  border: '1px solid #f59e0b',
                  borderRadius: 999,
                  padding: '0.05rem 0.4rem',
                  whiteSpace: 'nowrap',
                }}
              >
                moved by tech{(() => {
                  const was = formatFieldMovedFrom(
                    block as { field_moved_from?: { work_date?: string; time_start?: string; time_end?: string } | null },
                  )
                  return was ? ` · ${was.replace(/^was /, 'was ')}` : ''
                })()}
              </span>
            ) : null}
          </div>
          {block.note ? (
            <div style={{ color: 'var(--text-600)', marginTop: 2, overflowWrap: 'anywhere' }}>{block.note}</div>
          ) : null}
        </button>
      </div>
      {showEditNoteBtn ? (
        <div
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            zIndex: 3,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 0,
          }}
        >
          <button
            type="button"
            title="Edit job instructions"
            aria-label="Edit job instructions"
            onClick={(e) => {
              e.stopPropagation()
              onRequestEditBlockNote?.(block)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 51,
              height: 51,
              minWidth: 51,
              minHeight: 51,
              boxSizing: 'border-box',
              padding: 0,
              color: editNoteColor,
              cursor: 'pointer',
              fontFamily: 'inherit',
              margin: 0,
              ...scheduleBlockControlPlateBackgroundStyle,
              ...scheduleBlockActionLinkedIconButtonStyle,
            }}
          >
            <ScheduleDispatchBlockNoteIcon size={32} />
          </button>
        </div>
      ) : null}
      {showPersonDayBtn ? (
        <button
          type="button"
          title="See this person's whole day — rearrange times, unlink"
          aria-label="See this person's whole day"
          onClick={(e) => {
            e.stopPropagation()
            onOpenPersonDay?.(block)
          }}
          style={{
            position: 'absolute',
            // Top-left corner of the note plate, mirroring the chain (top-right)
            // and −/+ (bottom corners); falls left of the chain when no plate.
            top: 2,
            right: showEditNoteBtn ? 33 : 24,
            zIndex: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            padding: 0,
            margin: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-700)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            ...scheduleBlockActionLinkedIconButtonStyle,
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden focusable={false}>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
      {showLinkedFloat ? (
        <button
          type="button"
          disabled={placementPickingActive || linkedCopyActive}
          title={
            placementPickingActive || linkedCopyActive
              ? undefined
              : 'Linked: time and instructions stay in sync. Click to see every block in this group.'
          }
          aria-label="View linked schedule group details"
          onClick={(e) => {
            e.stopPropagation()
            if (placementPickingActive || !groupId) return
            onOpenLinkedGroup(groupId)
          }}
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            zIndex: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            padding: 0,
            margin: 0,
            border: 'none',
            background: 'transparent',
            color: chainsColor,
            cursor: placementPickingActive ? 'default' : 'pointer',
            fontFamily: 'inherit',
            filter:
              'drop-shadow(0 0 1px var(--surface)) drop-shadow(0 0 2px var(--surface))',
          }}
        >
          <ScheduleDispatchLinkedChainsIcon size={12} />
        </button>
      ) : null}
      {showMinusPlusButtons ? (
        <button
          type="button"
          aria-label="Remove block"
          title="Remove block"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteBlock(block.id)
          }}
          style={{
            position: 'absolute',
            top: showEditNoteBtn ? 33 : 28,
            right: showEditNoteBtn ? 33 : 18,
            zIndex: 4,
            width: 20,
            height: 20,
            padding: 0,
            margin: 0,
            lineHeight: '18px',
            fontSize: '0.85rem',
            fontWeight: 700,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: minusColor,
            cursor: 'pointer',
            ...scheduleBlockActionTextButtonStyle,
          }}
        >
          −
        </button>
      ) : null}
      {showMinusPlusButtons ? (
        <div
          style={{
            position: 'absolute',
            top: showEditNoteBtn ? 33 : 28,
            right: 2,
            zIndex: 4,
          }}
        >
          <button
            ref={plusButtonRef}
            type="button"
            aria-label="Copy block to another cell"
            title="Copy to another person & day"
            onClick={(e) => {
              e.stopPropagation()
              onPlusMenuBlockIdChange(plusMenuOpen ? null : block.id)
            }}
            style={{
              width: 20,
              height: 20,
              padding: 0,
              margin: 0,
              lineHeight: '18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: plusColor,
              cursor: 'pointer',
              ...scheduleBlockActionTextButtonStyle,
            }}
          >
            +
          </button>
          <ScheduleDispatchPlusCopyMenu
            open={plusMenuOpen}
            anchorRef={plusButtonRef}
            onClose={() => onPlusMenuBlockIdChange(null)}
            onLinkedCopy={() => {
              onPlusMenuBlockIdChange(null)
              onStartCardPlacement(block, 'linked')
            }}
            onSoloCopy={() => {
              onPlusMenuBlockIdChange(null)
              onStartCardPlacement(block, 'unlinked')
            }}
          />
        </div>
      ) : null}
      {linkedCopyStage != null ? (
        <button
          type="button"
          aria-label={
            linkedCopyStage === 1
              ? linkedCopySelected
                ? 'Deselect this block for linked copy'
                : 'Select this block for linked copy'
              : linkedCopySelected
                ? 'Selected for linked copy'
                : 'Not selected'
          }
          aria-pressed={linkedCopySelected}
          onClick={(e) => {
            e.stopPropagation()
            if (linkedCopyStage === 1) onLinkedCopyToggle?.(block.id)
          }}
          style={{
            position: 'absolute',
            inset: -1,
            zIndex: 8,
            padding: 0,
            margin: 0,
            borderRadius: 4,
            border:
              linkedCopyStage === 1 && !linkedCopySelected
                ? '2px dashed rgba(67, 56, 202, 0.55)'
                : 'none',
            background: linkedCopySelected ? 'rgba(67, 56, 202, 0.14)' : 'transparent',
            cursor: linkedCopyStage === 1 ? 'pointer' : 'default',
          }}
        />
      ) : null}
    </div>
  )
}

function HubPeopleDayCell({
  personUserId,
  workDate,
  scheduleTodayYmd,
  columnFocusDayYmd,
  cellBlocks,
  canEdit,
  cardPlacementMode,
  placementSourceWorkDate,
  plusMenuBlockId,
  onPlusMenuBlockIdChange,
  onStartCardPlacement,
  onCardPlacementCellPick,
  groupMemberCountByGroupId,
  getJobDisplayTitle,
  getJobAddress,
  onOpenJob,
  onOpenHubJobDetail,
  highlightLinkedGroups,
  linkedGroupAccentByGroupId,
  onOpenLinkedGroup,
  hubAssignJobPlacement,
  onHubAssignJobCellPick,
  onDeleteBlock,
  onEmptyCellClick,
  onAddJobToScheduleForCell,
  hubMultiCellAddActive,
  hubMultiCellAddSelectedKeys,
  onHubMultiCellAddToggle,
  onRequestEditBlockNote,
  onOpenPersonDay,
  timeOffInfo,
  onRequestUndoNotComingIn,
  onMarkNotComingInForCell,
  linkedCopyMode = null,
  onLinkedCopyToggleBlock,
  isBottomRow = false,
}: {
  personUserId: string
  workDate: string
  scheduleTodayYmd: string
  columnFocusDayYmd: string
  cellBlocks: JobScheduleBlockRow[]
  canEdit: boolean
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  placementSourceWorkDate: string | null
  plusMenuBlockId: string | null
  onPlusMenuBlockIdChange: (blockId: string | null) => void
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: 'linked' | 'unlinked') => void
  onCardPlacementCellPick: (assigneeUserId: string, workDate: string) => void
  groupMemberCountByGroupId: ReadonlyMap<string, number>
  getJobDisplayTitle: (jobId: string) => string
  /** Job address for the card's one-line ellipsized subline; empty string when none. */
  getJobAddress?: (jobId: string) => string
  onOpenJob: (jobId: string) => void
  onOpenHubJobDetail: (block: JobScheduleBlockRow, workDateYmd: string) => void
  highlightLinkedGroups: boolean
  linkedGroupAccentByGroupId: ReadonlyMap<string, LinkedGroupCardAccent>
  onOpenLinkedGroup: (groupId: string) => void
  hubAssignJobPlacement: { jobId: string } | null
  onHubAssignJobCellPick: (assigneeUserId: string, workDate: string) => void
  onDeleteBlock: (id: string) => void
  onEmptyCellClick?: (personUserId: string, workDate: string) => void
  onAddJobToScheduleForCell?: (assigneeUserId: string, workDate: string) => void
  hubMultiCellAddActive: boolean
  hubMultiCellAddSelectedKeys: ReadonlySet<string>
  onHubMultiCellAddToggle?: (personUserId: string, workDate: string) => void
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  onOpenPersonDay?: (b: JobScheduleBlockRow) => void
  timeOffInfo?: UserTimeOffCellInfo | null
  onRequestUndoNotComingIn?: (personUserId: string, workDate: string) => void
  onMarkNotComingInForCell?: (personUserId: string, workDate: string) => void
  linkedCopyMode?: LinkedCopyMode | null
  onLinkedCopyToggleBlock?: (blockId: string) => void
  /** Last grid row closes the orange today-column outline with a bottom edge. */
  isBottomRow?: boolean
}) {
  const cellHasTimeOff = timeOffInfo != null
  const droppableId = scheduleDispatchCellDroppableId(workDate, personUserId)
  const { isOver, setNodeRef } = useDroppable({ id: droppableId, disabled: cellHasTimeOff })
  const idleBg = scheduleDispatchDayColumnCellIdleBg(workDate, {
    scheduleTodayYmd,
    columnFocusDayYmd,
  })
  const assignJobPickingActive = hubAssignJobPlacement != null && canEdit
  const placementPickingActive = cardPlacementMode != null && canEdit
  const linkedWrongDay =
    cardPlacementMode?.variant === 'linked' &&
    placementSourceWorkDate != null &&
    workDate !== placementSourceWorkDate
  let cellBg = isOver ? 'var(--bg-blue-200)' : idleBg
  if (assignJobPickingActive) {
    cellBg = isOver ? 'var(--bg-green-100)' : 'var(--bg-emerald-tint)'
  } else if (placementPickingActive && linkedWrongDay) {
    cellBg = 'var(--bg-muted)'
  } else if (placementPickingActive && !linkedWrongDay) {
    cellBg = isOver ? 'var(--bg-blue-200)' : 'var(--bg-sky-tint)'
  }
  // Time-off days are not valid scheduling targets in the picker / placement
  // flows: gray them out the same way the existing "linked wrong day" cells
  // do, so they read as "not a target".
  if (cellHasTimeOff && (assignJobPickingActive || placementPickingActive)) {
    cellBg = 'var(--bg-muted)'
  }

  const cellClickable =
    (assignJobPickingActive || placementPickingActive) && !linkedWrongDay && !cellHasTimeOff
  const emptyCellClickable =
    canEdit &&
    cellBlocks.length === 0 &&
    onEmptyCellClick != null &&
    !assignJobPickingActive &&
    !placementPickingActive &&
    !hubMultiCellAddActive &&
    linkedCopyMode == null &&
    !cellHasTimeOff
  const multiSelectCellActive =
    hubMultiCellAddActive && canEdit && onHubMultiCellAddToggle != null && !cellHasTimeOff
  const multiSelectKey = hubPersonDayKey(personUserId, workDate)
  const isMultiSelected = hubMultiCellAddSelectedKeys.has(multiSelectKey)
  if (multiSelectCellActive && isMultiSelected) {
    cellBg = isOver ? 'var(--bg-amber-100)' : 'var(--bg-amber-tint)'
  }
  const showCellAddJobTriangle =
    canEdit &&
    onAddJobToScheduleForCell != null &&
    cellBlocks.length > 0 &&
    !assignJobPickingActive &&
    !placementPickingActive &&
    !hubMultiCellAddActive &&
    linkedCopyMode == null &&
    !cellHasTimeOff

  return (
    <td
      ref={setNodeRef}
      onClick={() => {
        if (cellHasTimeOff) return
        if (multiSelectCellActive) {
          onHubMultiCellAddToggle(personUserId, workDate)
          return
        }
        if (assignJobPickingActive) {
          onHubAssignJobCellPick(personUserId, workDate)
          return
        }
        if (placementPickingActive) {
          if (linkedWrongDay) return
          onCardPlacementCellPick(personUserId, workDate)
          return
        }
        if (emptyCellClickable) {
          onEmptyCellClick(personUserId, workDate)
        }
      }}
      style={{
        position: 'relative',
        isolation: 'isolate',
        padding: '0.35rem',
        border: isMultiSelected && multiSelectCellActive ? '2px solid #ca8a04' : '1px solid var(--border)',
        boxShadow: scheduleDispatchTodayColumnBoxShadow(workDate === scheduleTodayYmd, {
          bottom: isBottomRow,
        }),
        verticalAlign: 'top',
        maxWidth: 200,
        maxHeight: 180,
        overflowY: 'auto',
        background: cellBg,
        cursor:
          multiSelectCellActive || cellClickable || emptyCellClickable ? 'pointer' : undefined,
      }}
    >
      {timeOffInfo && cellBlocks.length === 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.35rem',
            pointerEvents: 'none',
          }}
        >
          <span style={{ pointerEvents: 'auto' }}>
            <ScheduleDispatchTimeOffChip
              info={timeOffInfo}
              onClick={
                canEdit &&
                onRequestUndoNotComingIn &&
                (timeOffInfo.variant === 'not_coming_in' || timeOffInfo.variant === 'ncns')
                  ? () => onRequestUndoNotComingIn(personUserId, workDate)
                  : undefined
              }
              interactiveTitle={
                timeOffInfo.variant === 'ncns'
                  ? 'Click to clear the schedule marking (the attendance incident stays on record)'
                  : 'Click to mark as coming in'
              }
            />
          </span>
        </div>
      ) : timeOffInfo ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <ScheduleDispatchTimeOffChip
            info={timeOffInfo}
            onClick={
              canEdit &&
              onRequestUndoNotComingIn &&
              (timeOffInfo.variant === 'not_coming_in' || timeOffInfo.variant === 'ncns')
                ? () => onRequestUndoNotComingIn(personUserId, workDate)
                : undefined
            }
            interactiveTitle={
              timeOffInfo.variant === 'ncns'
                ? 'Click to clear the schedule marking (the attendance incident stays on record)'
                : 'Click to mark as coming in'
            }
          />
        </div>
      ) : null}
      {cellBlocks.length === 0 ? (
        timeOffInfo ? null : emptyCellClickable ? (
          // Empty person-day: the add affordance is a full-width bar (same action
          // as clicking the cell) instead of the corner triangle used on cells
          // that already have blocks; "off" beside it marks the day not-coming-in.
          <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
            <button
              type="button"
              aria-label="Add job to schedule for this person and day"
              title="Add job to schedule for this person and day"
              onClick={(e) => {
                e.stopPropagation()
                onEmptyCellClick(personUserId, workDate)
              }}
              style={{
                display: 'block',
                flex: '1 1 auto',
                minWidth: 0,
                padding: '0.1rem 0',
                margin: 0,
                border: 'none',
                borderRadius: 4,
                background: '#1d4ed8',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                lineHeight: 1.2,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
              }}
            >
              +
            </button>
            {onMarkNotComingInForCell ? (
              <button
                type="button"
                aria-label="Mark as not coming in this day"
                title="Mark as not coming in this day"
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkNotComingInForCell(personUserId, workDate)
                }}
                style={{
                  flex: '0 0 auto',
                  padding: '0.1rem 0.45rem',
                  margin: 0,
                  border: 'none',
                  borderRadius: 4,
                  background: '#ea580c',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
                }}
              >
                off
              </button>
            ) : null}
          </div>
        ) : (
          <span style={{ color: 'var(--text-faint-300)' }}>—</span>
        )
      ) : (
        cellBlocks.map((b) => {
          const g = b.shared_block_group_id
          const linkPeerCount = g ? groupMemberCountByGroupId.get(g) ?? 0 : 0
          return (
            <HubPeopleBlockCard
              key={b.id}
              block={b}
              linkedCopyStage={linkedCopyMode?.stage ?? null}
              linkedCopySelected={linkedCopyMode?.selectedBlockIds.has(b.id) ?? false}
              onLinkedCopyToggle={onLinkedCopyToggleBlock}
              workDate={workDate}
              scheduleTodayYmd={scheduleTodayYmd}
              canEdit={canEdit}
              hubMultiCellAddActive={hubMultiCellAddActive}
              linkPeerCount={linkPeerCount}
              highlightLinkedGroups={highlightLinkedGroups}
              linkedGroupAccentByGroupId={linkedGroupAccentByGroupId}
              onOpenLinkedGroup={onOpenLinkedGroup}
              cardPlacementMode={cardPlacementMode}
              plusMenuOpen={plusMenuBlockId === b.id}
              onPlusMenuBlockIdChange={onPlusMenuBlockIdChange}
              onStartCardPlacement={onStartCardPlacement}
              getJobDisplayTitle={getJobDisplayTitle}
              getJobAddress={getJobAddress}
              onOpenJob={onOpenJob}
              onOpenHubJobDetail={onOpenHubJobDetail}
              onDeleteBlock={onDeleteBlock}
              onRequestEditBlockNote={onRequestEditBlockNote}
              onOpenPersonDay={onOpenPersonDay}
            />
          )
        })
      )}
      {showCellAddJobTriangle ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: 24,
            height: 24,
            zIndex: 6,
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            aria-label="Add job to schedule for this person and day"
            title="Add job to schedule for this person and day"
            onClick={(e) => {
              e.stopPropagation()
              onAddJobToScheduleForCell(personUserId, workDate)
            }}
            style={{
              pointerEvents: 'auto',
              width: '100%',
              height: '100%',
              padding: 0,
              margin: 0,
              border: 'none',
              cursor: 'pointer',
              clipPath: 'polygon(0 100%, 100% 100%, 0 0)',
              background: '#1d4ed8',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-start',
              paddingLeft: 3,
              paddingBottom: 2,
              fontFamily: 'inherit',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
            }}
          >
            +
          </button>
        </div>
      ) : null}
    </td>
  )
}

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
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: 'linked' | 'unlinked') => void
  onCardPlacementCellPick: (assigneeUserId: string, workDate: string) => void
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
  /** Optional click handler for the "Not coming in" chip — opens the undo confirm modal. */
  onRequestUndoNotComingIn?: (personUserId: string, workDate: string) => void
  onMarkNotComingInForCell?: (personUserId: string, workDate: string) => void
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
  swimLanes = null,
  onRequestHubMultiCellAddMode,
  onRequestEditBlockNote,
  onOpenPersonDay,
  showExpectedManpower = true,
  showHideWeekendToggle = true,
  userTimeOffByCell,
  onRequestUndoNotComingIn,
  onMarkNotComingInForCell,
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
  const peopleScrollRef = useRef<HTMLDivElement>(null)
  useScrollScheduleDispatchColumnIntoView({
    columnFocusDayYmd,
    loading,
    scrollRootRef: peopleScrollRef,
    scrollKey: columnScrollKey,
  })

  const [search, setSearch] = useState('')
  const [onlyWithBlocksThisWeek, setOnlyWithBlocksThisWeek] = useState(false)
  const [expectedManpowerByJobSectionCollapsed, setExpectedManpowerByJobSectionCollapsed] = useState(false)
  const [collapsedExpectedManpowerJobIds, setCollapsedExpectedManpowerJobIds] = useState<Set<string>>(
    () => new Set(),
  )
  const prevHubExpectedManpowerKeyRef = useRef<string | null>(null)

  const expectedManpowerWeekPersonHours = useMemo(
    () => expectedManpowerPersonHoursTotalForDayKeys(hubWeekBlocks, visibleDayKeys),
    [hubWeekBlocks, visibleDayKeys],
  )

  const expectedManpowerDayRows = useMemo(() => {
    if (hubExpectedManpowerDayKey == null) return []
    if (hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK) {
      return expectedManpowerRowsForVisibleDays(
        hubWeekBlocks,
        visibleDayKeys,
        getJobDisplayTitle,
        (uid) => hubPeopleNameById.get(uid) ?? 'Unknown',
      )
    }
    return expectedManpowerRowsForDay(
      hubWeekBlocks,
      hubExpectedManpowerDayKey,
      getJobDisplayTitle,
      (uid) => hubPeopleNameById.get(uid) ?? 'Unknown',
    )
  }, [
    hubWeekBlocks,
    hubExpectedManpowerDayKey,
    visibleDayKeys,
    getJobDisplayTitle,
    hubPeopleNameById,
  ])

  const expectedManpowerSelectionLabel = useMemo(() => {
    if (hubExpectedManpowerDayKey == null) return ''
    if (hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK) {
      const range = formatScheduleDispatchVisibleDateRange(visibleDayKeys)
      return range ? `All week (${range})` : 'All week'
    }
    return hubDayColumnHeaderLabel(hubExpectedManpowerDayKey)
  }, [hubExpectedManpowerDayKey, visibleDayKeys])

  const expectedManpowerShowDayColumn =
    hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK

  const expectedManpowerJobGroups = useMemo(
    () => expectedManpowerJobGroupsForDay(expectedManpowerDayRows),
    [expectedManpowerDayRows],
  )

  const expectedManpowerDayStats = useMemo(() => {
    if (expectedManpowerDayRows.length === 0) return null
    let personHours = 0
    const people = new Set<string>()
    const jobs = new Set<string>()
    for (const r of expectedManpowerDayRows) {
      personHours += r.personHours
      people.add(r.assigneeUserId)
      jobs.add(r.jobId)
    }
    return {
      personHours,
      distinctPeople: people.size,
      jobCount: jobs.size,
    }
  }, [expectedManpowerDayRows])

  /** Lane-scoped manpower breakdown — [] hides the line (no lanes configured). */
  const expectedManpowerLaneRows = useMemo(() => {
    if (!swimLanes || expectedManpowerDayRows.length === 0) return []
    return summarizeExpectedManpowerByLane(expectedManpowerDayRows, swimLanes)
  }, [swimLanes, expectedManpowerDayRows])

  /** Scroll the ?focusPerson row into view once rows are rendered. */
  useEffect(() => {
    if (!focusPersonUserId || loading) return
    document
      .getElementById(`hub-person-row-${focusPersonUserId}`)
      ?.scrollIntoView({ block: 'center' })
  }, [focusPersonUserId, loading])

  useEffect(() => {
    const prev = prevHubExpectedManpowerKeyRef.current
    const cur = hubExpectedManpowerDayKey
    prevHubExpectedManpowerKeyRef.current = cur

    if (cur == null) {
      setCollapsedExpectedManpowerJobIds(new Set())
      return
    }

    if (cur === HUB_EXPECTED_MANPOWER_ALL_WEEK) {
      if (prev !== HUB_EXPECTED_MANPOWER_ALL_WEEK) {
        setCollapsedExpectedManpowerJobIds(new Set(expectedManpowerJobGroups.map((g) => g.jobId)))
      }
      return
    }

    if (prev !== cur) {
      setCollapsedExpectedManpowerJobIds(new Set())
    }
  }, [hubExpectedManpowerDayKey, expectedManpowerJobGroups])

  const afterBlockFilter = useMemo(() => {
    if (!onlyWithBlocksThisWeek) return allPeopleRows
    return allPeopleRows.filter((row) => userIdsWithBlocksThisWeek.has(row.userId))
  }, [allPeopleRows, onlyWithBlocksThisWeek, userIdsWithBlocksThisWeek])

  const filteredAssignees = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return afterBlockFilter
    return afterBlockFilter.filter((row) => {
      if (row.displayName.toLowerCase().includes(q)) return true
      if (swimLanes && personMatchesLaneQuery(row.userId, q, swimLanes)) return true
      for (const dk of visibleDayKeys) {
        const blocks = personDayBlocks.get(hubPersonDayKey(row.userId, dk)) ?? []
        for (const b of blocks) {
          if (getJobDisplayTitle(scheduleBlockAnchorId(b)).toLowerCase().includes(q)) return true
        }
      }
      return false
    })
  }, [afterBlockFilter, search, visibleDayKeys, personDayBlocks, getJobDisplayTitle, swimLanes])

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

  const missingNoteCount = useMemo(() => {
    if (!missingNoteDayYmd) return 0
    // Past-day columns: the missing-notes indicator is part of the "needs attention"
    // surface alongside per-card colors, and both gate on `block.work_date < scheduleTodayYmd`
    // returning to default. History never lights up red.
    if (missingNoteDayYmd < scheduleTodayYmd) return 0
    let n = 0
    for (const person of filteredAssignees) {
      const blocks = personDayBlocks.get(hubPersonDayKey(person.userId, missingNoteDayYmd)) ?? []
      for (const b of blocks) {
        if (b.note) continue
        const req = noteRequirementForBlockFromContext({
          userId: person.userId,
          jobId: b.job_id,
        })
        if (req === 'skip') continue
        n++
      }
    }
    return n
  }, [
    missingNoteDayYmd,
    scheduleTodayYmd,
    filteredAssignees,
    personDayBlocks,
    noteRequirementForBlockFromContext,
  ])

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
                  background: isMobile ? 'transparent' : 'var(--bg-muted)',
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
                          : isMobile
                            ? 'transparent'
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
                        groupMemberCountByGroupId={groupMemberCountByGroupId}
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
                        onRequestUndoNotComingIn={onRequestUndoNotComingIn}
                        onMarkNotComingInForCell={onMarkNotComingInForCell}
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
      </div>

      {isMobile && canEdit ? (
        <QuickAssignSheet
          open={quickAssignOpen}
          onClose={() => setQuickAssignOpen(false)}
          onScheduled={onQuickAssignScheduled}
        />
      ) : null}
      {visibleDayKeys.length > 0 && showExpectedManpower ? (
        <section
          style={{ marginTop: '1.25rem' }}
          aria-label="Expected manpower for the selected day or week"
        >
          <h3
            style={{
              margin: '0 0 0.65rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--text-strong)',
            }}
          >
            Expected Manpower
          </h3>
          <div
            role="tablist"
            aria-label="Expected manpower day or all week"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: '0.65rem',
              alignItems: 'center',
            }}
          >
            {visibleDayKeys.map((dk) => {
              const selected = dk === hubExpectedManpowerDayKey
              const isToday = dk === scheduleTodayYmd
              const background = isToday
                ? SCHEDULE_DISPATCH_TODAY_COLUMN_BG
                : selected
                  ? 'var(--bg-blue-tint)'
                  : 'var(--surface)'
              return (
                <button
                  key={dk}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  id={`hub-expected-manpower-tab-${dk}`}
                  aria-controls="hub-expected-manpower-panel"
                  title={isToday ? 'Today' : undefined}
                  onClick={() => onHubExpectedManpowerDayChange(dk)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.75rem',
                    borderRadius: 6,
                    border: selected ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                    background,
                    color: selected ? 'var(--text-blue-700)' : 'var(--text-700)',
                    fontWeight: selected ? 600 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hubDayColumnHeaderLabel(dk)}
                </button>
              )
            })}
            {(() => {
              const allWeekSelected = hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK
              return (
                <button
                  type="button"
                  role="tab"
                  id="hub-expected-manpower-tab-all-week"
                  aria-selected={allWeekSelected}
                  aria-controls="hub-expected-manpower-panel"
                  title={`Visible week: ${formatScheduleDispatchVisibleDateRange(visibleDayKeys)}`}
                  onClick={() => onHubExpectedManpowerDayChange(HUB_EXPECTED_MANPOWER_ALL_WEEK)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.75rem',
                    borderRadius: 6,
                    border: allWeekSelected ? '2px solid #059669' : '1px solid #34d399',
                    background: allWeekSelected ? 'var(--bg-green-100)' : 'var(--bg-emerald-tint)',
                    color: allWeekSelected ? '#047857' : 'var(--text-emerald-800)',
                    fontWeight: allWeekSelected ? 600 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    marginLeft: 2,
                  }}
                >
                  All week
                </button>
              )
            })()}
          </div>

          <div
            role="tabpanel"
            id="hub-expected-manpower-panel"
            aria-labelledby={
              hubExpectedManpowerDayKey
                ? hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK
                  ? 'hub-expected-manpower-tab-all-week'
                  : `hub-expected-manpower-tab-${hubExpectedManpowerDayKey}`
                : undefined
            }
          >
            {hubExpectedManpowerDayKey == null ? null : expectedManpowerDayRows.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No schedule blocks for {expectedManpowerSelectionLabel}.
              </p>
            ) : (
              <>
                {expectedManpowerDayStats ? (
                  <p style={{ margin: '0 0 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {expectedManpowerSelectionLabel}:{' '}
                    <strong style={{ color: 'var(--text-700)' }}>
                      {formatExpectedManpowerPersonHours(expectedManpowerDayStats.personHours)}
                    </strong>{' '}
                    person-hours · {expectedManpowerDayStats.jobCount}{' '}
                    {expectedManpowerDayStats.jobCount === 1 ? 'job' : 'jobs'} ·{' '}
                    {expectedManpowerDayStats.distinctPeople}{' '}
                    {expectedManpowerDayStats.distinctPeople === 1 ? 'person' : 'people'}
                  </p>
                ) : null}
                {expectedManpowerLaneRows.length > 0 ? (
                  <p style={{ margin: '-0.35rem 0 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {expectedManpowerLaneRows.map((lane, i) => (
                      <span key={lane.laneId ?? 'rest'}>
                        {i > 0 ? ' · ' : ''}
                        {lane.label}{' '}
                        <strong style={{ color: 'var(--text-700)' }}>
                          {formatExpectedManpowerPersonHours(lane.personHours)}
                        </strong>{' '}
                        ({lane.distinctPeople} {lane.distinctPeople === 1 ? 'person' : 'people'})
                      </span>
                    ))}
                  </p>
                ) : null}
                <div
                  id="hub-expected-manpower-by-job-panel"
                  role="region"
                  aria-labelledby="hub-expected-manpower-by-job-section-toggle"
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr>
                          <th
                            style={{
                              ...hubExpectedManpowerSectionTh,
                              width: HUB_EXPECTED_MANPOWER_EXPAND_COL,
                              textAlign: 'center',
                              verticalAlign: 'middle',
                            }}
                          >
                            <button
                              type="button"
                              id="hub-expected-manpower-by-job-section-toggle"
                              aria-expanded={!expectedManpowerByJobSectionCollapsed}
                              aria-controls="hub-expected-manpower-by-job-panel"
                              onClick={() => setExpectedManpowerByJobSectionCollapsed((v) => !v)}
                              aria-label={
                                expectedManpowerByJobSectionCollapsed
                                  ? `Show scheduled jobs for this day, ${expectedManpowerJobGroups.length} jobs`
                                  : `Hide scheduled jobs for this day, ${expectedManpowerJobGroups.length} jobs`
                              }
                              style={{
                                border: 'none',
                                background: 'none',
                                padding: '0.1rem',
                                cursor: 'pointer',
                                fontSize: '0.65rem',
                                color: 'var(--text-700)',
                                lineHeight: 1,
                              }}
                            >
                              <span aria-hidden>
                                {expectedManpowerByJobSectionCollapsed ? '\u25B6' : '\u25BC'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={hubExpectedManpowerSectionTh}>
                            <span style={hubExpectedManpowerSrOnly}>{'Expand rows per job. '}</span>
                            Scheduled by job ({expectedManpowerJobGroups.length})
                          </th>
                        </tr>
                      </thead>
                      <tbody hidden={expectedManpowerByJobSectionCollapsed}>
                        {expectedManpowerJobGroups.map((job) => {
                          const hasDetail = job.rows.length > 0
                          const jobDetailExpanded =
                            hasDetail && !collapsedExpectedManpowerJobIds.has(job.jobId)
                          const jobDetailScope =
                            hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK
                              ? 'all-week'
                              : hubExpectedManpowerDayKey
                          const jobDetailId = `hub-expected-manpower-job-${job.jobId}-${jobDetailScope}`
                          const statsLabel = `${formatExpectedManpowerPersonHours(job.totalPersonHours)} person-hours, ${
                            job.distinctPeopleCount
                          } ${job.distinctPeopleCount === 1 ? 'person' : 'people'}`
                          return (
                            <Fragment key={job.jobId}>
                              <tr>
                                <td
                                  style={{
                                    ...hubExpectedManpowerRowTd,
                                    width: HUB_EXPECTED_MANPOWER_EXPAND_COL,
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                  }}
                                >
                                  {hasDetail ? (
                                    <button
                                      type="button"
                                      aria-expanded={jobDetailExpanded}
                                      aria-controls={jobDetailId}
                                      aria-label={
                                        jobDetailExpanded
                                          ? `Hide assignees for ${job.jobTitle}`
                                          : `Show assignees for ${job.jobTitle}`
                                      }
                                      onClick={() =>
                                        setCollapsedExpectedManpowerJobIds((prev) => {
                                          const next = new Set(prev)
                                          if (next.has(job.jobId)) next.delete(job.jobId)
                                          else next.add(job.jobId)
                                          return next
                                        })
                                      }
                                      style={{
                                        border: 'none',
                                        background: 'none',
                                        padding: '0.1rem',
                                        cursor: 'pointer',
                                        fontSize: '0.65rem',
                                        color: 'var(--text-700)',
                                        lineHeight: 1,
                                      }}
                                    >
                                      <span aria-hidden>{jobDetailExpanded ? '\u25BC' : '\u25B6'}</span>
                                    </button>
                                  ) : null}
                                </td>
                                <td style={hubExpectedManpowerRowTd}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'baseline',
                                      gap: '0.15rem',
                                      flexWrap: 'wrap',
                                      minWidth: 0,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => onOpenJob(job.jobId)}
                                      title={`${job.jobTitle} — ${statsLabel}`}
                                      aria-label={`Open job ${job.jobTitle}, ${statsLabel}`}
                                      style={{
                                        padding: 0,
                                        margin: 0,
                                        border: 'none',
                                        background: 'none',
                                        color: 'var(--text-blue-700)',
                                        cursor: 'pointer',
                                        font: 'inherit',
                                        fontWeight: 600,
                                        textAlign: 'left',
                                        textDecoration: 'underline',
                                        textUnderlineOffset: 2,
                                        wordBreak: 'break-word',
                                        flex: '0 1 auto',
                                        minWidth: 0,
                                      }}
                                    >
                                      {job.jobTitle}
                                    </button>
                                    <span
                                      style={{
                                        flexShrink: 0,
                                        color: 'var(--text-600)',
                                        fontWeight: 400,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {'[ '}
                                      <span style={{ fontWeight: 400, color: 'var(--text-700)' }}>
                                        {formatExpectedManpowerPersonHours(job.totalPersonHours)}
                                      </span>
                                      <span style={{ color: 'var(--text-600)' }}>{' • '}</span>
                                      <span style={{ fontWeight: 600 }}>{job.distinctPeopleCount}</span>
                                      {' ]'}
                                    </span>
                                    {canShowExpectedManpowerPayroll ? (
                                      <span
                                        style={{
                                          flexShrink: 0,
                                          color: 'var(--text-muted)',
                                          fontWeight: 400,
                                          whiteSpace: 'nowrap',
                                        }}
                                        title="Uses People Pay hourly wage times scheduled hours. Salary-only rows may show $0 if no hourly rate is set. Not a full payroll estimate (no overtime or burden)."
                                      >
                                        {' · Est. $'}
                                        {formatCurrency(
                                          expectedManpowerJobGroupPayrollEstimate(job.rows, (id) => {
                                            return hubHourlyWageByUserId.get(id) ?? 0
                                          }),
                                        )}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                              {jobDetailExpanded && hasDetail ? (
                                <tr>
                                  <td
                                    colSpan={HUB_EXPECTED_MANPOWER_JOB_COL_SPAN}
                                    style={{
                                      ...hubExpectedManpowerRowTd,
                                      borderBottom: 'none',
                                      background: 'var(--bg-page)',
                                      padding: '0.35rem 0.5rem 0.45rem',
                                      fontSize: '0.75rem',
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    <div
                                      id={jobDetailId}
                                      role="region"
                                      aria-label={`Scheduled assignees on ${job.jobTitle}`}
                                    >
                                      <div
                                        style={{
                                          overflowX: 'auto',
                                          maxWidth: '100%',
                                          marginLeft: `calc(${HUB_EXPECTED_MANPOWER_EXPAND_COL} + 0.45rem)`,
                                          borderLeft: '2px solid var(--border)',
                                          paddingLeft: '0.45rem',
                                        }}
                                      >
                                        <span style={hubExpectedManpowerSrOnly}>
                                          {`Assignees for ${job.jobTitle}`}
                                        </span>
                                        <table
                                          style={{
                                            borderCollapse: 'collapse',
                                            fontSize: '0.72rem',
                                            color: 'var(--text-600)',
                                            width: '100%',
                                          }}
                                        >
                                          <thead>
                                            <tr>
                                              {expectedManpowerShowDayColumn ? (
                                                <th
                                                  scope="col"
                                                  style={{
                                                    textAlign: 'left',
                                                    padding: '0.25rem 0.4rem 0.35rem 0',
                                                    borderBottom: '1px solid var(--border)',
                                                    fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                >
                                                  Day
                                                </th>
                                              ) : null}
                                              <th
                                                scope="col"
                                                style={{
                                                  textAlign: 'left',
                                                  padding: '0.25rem 0.4rem 0.35rem 0',
                                                  borderBottom: '1px solid var(--border)',
                                                  fontWeight: 600,
                                                }}
                                              >
                                                Person
                                              </th>
                                              <th
                                                scope="col"
                                                style={{
                                                  textAlign: 'right',
                                                  padding: '0.25rem 0.4rem 0.35rem 0',
                                                  borderBottom: '1px solid var(--border)',
                                                  fontWeight: 600,
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                Hours
                                              </th>
                                              <th
                                                scope="col"
                                                style={{
                                                  textAlign: 'left',
                                                  padding: '0.25rem 0.4rem 0.35rem 0',
                                                  borderBottom: '1px solid var(--border)',
                                                  fontWeight: 600,
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                Window
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {job.rows.map((r) => (
                                              <tr key={r.blockId}>
                                                {expectedManpowerShowDayColumn ? (
                                                  <td
                                                    style={{
                                                      padding: '0.3rem 0.45rem 0.3rem 0',
                                                      verticalAlign: 'top',
                                                      whiteSpace: 'nowrap',
                                                    }}
                                                  >
                                                    {hubDayColumnHeaderLabel(r.workDate)}
                                                  </td>
                                                ) : null}
                                                <td style={{ padding: '0.3rem 0.4rem 0.3rem 0', verticalAlign: 'top' }}>
                                                  {r.personName}
                                                </td>
                                                <td
                                                  style={{
                                                    padding: '0.3rem 0.4rem',
                                                    textAlign: 'right',
                                                    whiteSpace: 'nowrap',
                                                    verticalAlign: 'top',
                                                  }}
                                                >
                                                  {formatExpectedManpowerPersonHours(r.personHours)}
                                                </td>
                                                <td
                                                  style={{
                                                    padding: '0.3rem 0 0.3rem 0.4rem',
                                                    verticalAlign: 'top',
                                                  }}
                                                >
                                                  {r.windowLabel}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          <p
            style={{
              margin: '0.75rem 0 0',
              fontSize: '0.8125rem',
              color: 'var(--text-700)',
              fontWeight: 500,
            }}
          >
            This week: {formatExpectedManpowerPersonHours(expectedManpowerWeekPersonHours)} person-hours
          </p>
        </section>
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
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: 'linked' | 'unlinked') => void
  onCardPlacementCellPick: (assigneeUserId: string, workDate: string) => void
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
  /** Optional click handler for the "Not coming in" chip — opens the undo confirm modal. */
  onRequestUndoNotComingIn?: (personUserId: string, workDate: string) => void
  onMarkNotComingInForCell?: (personUserId: string, workDate: string) => void
  /** Right-aligned content for the week-nav row (e.g. the Share button). */
  weekNavRightSlot?: ReactNode
}

const HUB_PEOPLE_TOOLBAR_BTN_H = 32

const hubPeopleToolbarBtn: CSSProperties = {
  boxSizing: 'border-box',
  height: HUB_PEOPLE_TOOLBAR_BTN_H,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 0.75rem',
  border: '1px solid #2563eb',
  borderRadius: 4,
  background: 'var(--surface)',
  color: 'var(--text-link)',
  cursor: 'pointer',
  fontSize: '0.8125rem',
}

const hubPeopleToolbarIconBtn: CSSProperties = {
  ...hubPeopleToolbarBtn,
  padding: '0 0.55rem',
  minWidth: HUB_PEOPLE_TOOLBAR_BTN_H,
  lineHeight: 1,
  fontWeight: 600,
  fontSize: '1rem',
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
  onRequestUndoNotComingIn,
  onMarkNotComingInForCell,
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
          swimLanes={swimLanes}
          onRequestHubMultiCellAddMode={onRequestHubMultiCellAddMode}
          onRequestEditBlockNote={onRequestEditBlockNote}
              onOpenPersonDay={onOpenPersonDay}
          showExpectedManpower={showExpectedManpower}
          showHideWeekendToggle={showHideWeekendToggle}
          userTimeOffByCell={userTimeOffByCell}
          onRequestUndoNotComingIn={onRequestUndoNotComingIn}
          onMarkNotComingInForCell={onMarkNotComingInForCell}
        />
      ) : hubTab === 'day' ? (
        <QuickfillScheduleSection
          hideConflictPrompt
          initialWorkDateYmd={dayTabWorkDateYmd}
          onBlocksSaved={onDayScheduleChanged}
          showDaySettings
          onDaySettingsApiChange={setDaySettingsApi}
        />
      ) : hubTab === 'jobs' ? (
        <HubJobsPanel
          rows={rows}
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
          swimLanes={swimLanes}
          onRequestHubMultiCellAddMode={onRequestHubMultiCellAddMode}
          onRequestEditBlockNote={onRequestEditBlockNote}
              onOpenPersonDay={onOpenPersonDay}
          showExpectedManpower={showExpectedManpower}
          showHideWeekendToggle={showHideWeekendToggle}
          userTimeOffByCell={userTimeOffByCell}
          onRequestUndoNotComingIn={onRequestUndoNotComingIn}
          onMarkNotComingInForCell={onMarkNotComingInForCell}
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
    </div>
  )
}
