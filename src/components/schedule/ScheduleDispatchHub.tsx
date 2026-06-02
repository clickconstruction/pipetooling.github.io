import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useToastContext } from '../../contexts/ToastContext'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
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
import { scheduleDispatchCellDroppableId } from '../../lib/scheduleDispatchDnd'
import { ScheduleDispatchBlockNoteIcon } from '../icons/ScheduleDispatchBlockNoteIcon'
import { ScheduleDispatchLinkedChainsIcon } from '../icons/ScheduleDispatchLinkedChainsIcon'
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
import type { ScheduleDispatchCardPlacementMode } from './ScheduleDispatchGrid'
import {
  SCHEDULE_DISPATCH_TODAY_COLUMN_BG,
  scheduleDispatchDayColumnCellIdleBg,
  scheduleDispatchDayColumnHeaderStyle,
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
  border: '1px solid #e5e7eb',
  background: '#f3f4f6',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: '#111827',
}

const hubExpectedManpowerRowTd: CSSProperties = {
  padding: '0.45rem',
  border: '1px solid #e5e7eb',
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
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{jobsError}</p>
      ) : null}
      {summariesError ? (
        <p style={{ color: '#92400e', fontSize: '0.875rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
          Could not load schedule counts for this week ({summariesError}). Counts shown as 0.
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search HCP or job name"
            aria-label="Search HCP or job name"
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', minWidth: 200 }}
          />
        </label>
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyWithBlocks} onChange={(e) => setOnlyWithBlocks(e.target.checked)} />
          Only jobs with blocks this week
        </label>
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={hideWeekend}
            onChange={(e) => onHideWeekendChange(e.target.checked)}
            aria-label="Hide Saturday and Sunday columns"
          />
          Hide weekend
        </label>
      </div>

      {loading ? <p style={{ color: '#6b7280' }}>Loading…</p> : null}

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
                  border: '1px solid #e5e7eb',
                  background: '#f3f4f6',
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
                  border: '1px solid #e5e7eb',
                  background: '#f3f4f6',
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
                    border: '1px solid #e5e7eb',
                    ...scheduleDispatchDayColumnHeaderStyle(dk, { scheduleTodayYmd, columnFocusDayYmd }, '#f3f4f6'),
                    fontSize: '0.75rem',
                    minWidth: 88,
                  }}
                  title={dk}
                >
                  {hubDayColumnHeaderLabel(dk)}
                </th>
              ))}
              <th style={{ padding: '0.5rem', border: '1px solid #e5e7eb', background: '#f3f4f6' }} aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={2 + visibleDayKeys.length + 1}
                  style={{ padding: '1rem', border: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'center' }}
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
                      border: '1px solid #e5e7eb',
                      position: 'sticky',
                      left: 0,
                      background: '#fff',
                      zIndex: 1,
                      maxWidth: 280,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenJob(r.id)}
                      style={{
                        padding: 0,
                        margin: 0,
                        border: 'none',
                        background: 'none',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        font: 'inherit',
                        textAlign: 'left',
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                      }}
                    >
                      {r.displayTitle}
                    </button>
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #e5e7eb', fontWeight: 600 }}>
                    {r.totalBlocks}
                  </td>
                  {visibleDayKeys.map((dk) => (
                    <td
                      key={dk}
                      style={{
                        textAlign: 'center',
                        padding: '0.35rem',
                        border: '1px solid #e5e7eb',
                        color: '#4b5563',
                        background: scheduleDispatchDayColumnJobsSummaryCellBg(dk, {
                          scheduleTodayYmd,
                          columnFocusDayYmd,
                        }),
                      }}
                    >
                      {r.byDay[dk] ?? '—'}
                    </td>
                  ))}
                  <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>
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
  color: '#9ca3af',
  fontWeight: 400,
  lineHeight: 1.1,
}

function HubPeopleBlockCard({
  block,
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
  onOpenJob,
  onOpenHubJobDetail,
  onDeleteBlock,
  onRequestEditBlockNote,
}: {
  block: JobScheduleBlockRow
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
  onOpenJob: (jobId: string) => void
  onOpenHubJobDetail: (block: JobScheduleBlockRow, workDateYmd: string) => void
  onDeleteBlock: (id: string) => void
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
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
  const dragDisabled = !canEdit || hubMultiCellAddActive
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
  const showEditNoteBtn = canEdit && !placementPickingActive && !!onRequestEditBlockNote
  const showTopRightControls = showEditNoteBtn
  const showMinusPlusButtons = canEdit && !placementPickingActive
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
        background: linkedAccent?.background ?? '#eff6ff',
        borderStyle: 'solid',
        borderColor: linkedAccent?.borderColor ?? '#93c5fd',
        borderWidth: linkedAccent ? '3px 1px 1px 1px' : 1,
        borderRadius: 4,
        fontSize: '0.72rem',
        color: '#1e3a8a',
        overflow: 'visible',
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
          width: 14,
          minHeight: 40,
          touchAction: dragDisabled ? undefined : 'none',
          cursor: dragDisabled ? 'pointer' : 'grab',
          background: dragDisabled
            ? 'linear-gradient(90deg, #fee2e2 0%, #fecaca 100%)'
            : 'linear-gradient(90deg, #dbeafe 0%, #eff6ff 100%)',
          borderRight: `1px solid ${dragDisabled ? '#fca5a5' : '#bfdbfe'}`,
          outline: 'none',
        }}
        aria-label={
          dragDisabled ? disabledStripAriaLabel : 'Drag to move block to another day or person row'
        }
      />
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
            borderBottom: '1px solid #bfdbfe',
            background: 'transparent',
            cursor: placementPickingActive ? 'default' : 'pointer',
            textAlign: 'left',
            font: 'inherit',
            color: 'inherit',
          }}
        >
          <span style={{ fontWeight: 700, color: '#1e3a8a', wordBreak: 'break-word' }}>
            {getJobDisplayTitle(block.job_id)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (placementPickingActive) return
            onOpenJob(block.job_id)
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
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
            }}
          >
            <span>{scheduleFormatWindow(block.time_start, block.time_end)}</span>
          </div>
          {block.note ? (
            <div style={{ color: '#4b5563', marginTop: 2, overflowWrap: 'anywhere' }}>{block.note}</div>
          ) : null}
        </button>
      </div>
      {showTopRightControls ? (
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
          {showEditNoteBtn ? (
            <button
              type="button"
              title="Edit block note"
              aria-label="Edit block note"
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
          ) : null}
        </div>
      ) : null}
      {showLinkedFloat ? (
        <button
          type="button"
          disabled={placementPickingActive}
          title={
            placementPickingActive
              ? undefined
              : 'Linked: time and note stay in sync. Click to see every block in this group.'
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
              'drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 0 2px rgba(255,255,255,0.7))',
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
  timeOffInfo,
  onRequestUndoNotComingIn,
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
  timeOffInfo?: UserTimeOffCellInfo | null
  onRequestUndoNotComingIn?: (personUserId: string, workDate: string) => void
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
  let cellBg = isOver ? '#dbeafe' : idleBg
  if (assignJobPickingActive) {
    cellBg = isOver ? '#a7f3d0' : '#d1fae5'
  } else if (placementPickingActive && linkedWrongDay) {
    cellBg = '#f3f4f6'
  } else if (placementPickingActive && !linkedWrongDay) {
    cellBg = isOver ? '#c7d2fe' : '#eef2ff'
  }
  // Time-off days are not valid scheduling targets in the picker / placement
  // flows: gray them out the same way the existing "linked wrong day" cells
  // do, so they read as "not a target".
  if (cellHasTimeOff && (assignJobPickingActive || placementPickingActive)) {
    cellBg = '#f3f4f6'
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
    !cellHasTimeOff
  const multiSelectCellActive =
    hubMultiCellAddActive && canEdit && onHubMultiCellAddToggle != null && !cellHasTimeOff
  const multiSelectKey = hubPersonDayKey(personUserId, workDate)
  const isMultiSelected = hubMultiCellAddSelectedKeys.has(multiSelectKey)
  if (multiSelectCellActive && isMultiSelected) {
    cellBg = isOver ? '#fcd34d' : '#fef3c7'
  }
  const showCellAddJobTriangle =
    canEdit &&
    onAddJobToScheduleForCell != null &&
    cellBlocks.length > 0 &&
    !assignJobPickingActive &&
    !placementPickingActive &&
    !hubMultiCellAddActive &&
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
        border: isMultiSelected && multiSelectCellActive ? '2px solid #ca8a04' : '1px solid #e5e7eb',
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
                timeOffInfo.variant === 'not_coming_in'
                  ? () => onRequestUndoNotComingIn(personUserId, workDate)
                  : undefined
              }
              interactiveTitle="Click to mark as coming in"
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
              timeOffInfo.variant === 'not_coming_in'
                ? () => onRequestUndoNotComingIn(personUserId, workDate)
                : undefined
            }
            interactiveTitle="Click to mark as coming in"
          />
        </div>
      ) : null}
      {cellBlocks.length === 0 ? (
        timeOffInfo ? null : <span style={{ color: '#d1d5db' }}>—</span>
      ) : (
        cellBlocks.map((b) => {
          const g = b.shared_block_group_id
          const linkPeerCount = g ? groupMemberCountByGroupId.get(g) ?? 0 : 0
          return (
            <HubPeopleBlockCard
              key={b.id}
              block={b}
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
              onOpenJob={onOpenJob}
              onOpenHubJobDetail={onOpenHubJobDetail}
              onDeleteBlock={onDeleteBlock}
              onRequestEditBlockNote={onRequestEditBlockNote}
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
  visibleDayKeys: string[]
  hideWeekend: boolean
  onHideWeekendChange: (hide: boolean) => void
  allPeopleRows: { userId: string; displayName: string }[]
  userIdsWithBlocksThisWeek: ReadonlySet<string>
  salariedUserIds: ReadonlySet<string>
  personDayBlocks: Map<string, JobScheduleBlockRow[]>
  getJobDisplayTitle: (jobId: string) => string
  groupMemberCountByGroupId: ReadonlyMap<string, number>
  scheduleTodayYmd: string
  canEdit: boolean
  loading: boolean
  jobsError: string | null
  summariesError: string | null
  onOpenJob: (jobId: string) => void
  onOpenHubJobDetail: (block: JobScheduleBlockRow, workDateYmd: string) => void
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
  onRequestHubMultiCellAddMode?: () => void
  columnFocusDayYmd: string
  columnScrollKey: string
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  /** When false, hide the Expected Manpower block below the People grid (e.g. Quickfill tomorrow snapshot). */
  showExpectedManpower?: boolean
  /** When false, hide the Hide weekend checkbox in the People toolbar (e.g. Quickfill tomorrow). */
  showHideWeekendToggle?: boolean
  /** Per-cell time-off info keyed by `userTimeOffCellKey`; when present a chip is rendered. */
  userTimeOffByCell?: ReadonlyMap<string, UserTimeOffCellInfo>
  /** Optional click handler for the "Not coming in" chip — opens the undo confirm modal. */
  onRequestUndoNotComingIn?: (personUserId: string, workDate: string) => void
}

function HubPeoplePanel({
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  allPeopleRows,
  userIdsWithBlocksThisWeek,
  salariedUserIds,
  personDayBlocks,
  getJobDisplayTitle,
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
  onRequestHubMultiCellAddMode,
  onRequestEditBlockNote,
  showExpectedManpower = true,
  showHideWeekendToggle = true,
  userTimeOffByCell,
  onRequestUndoNotComingIn,
}: HubPeoplePanelProps) {
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
      for (const dk of visibleDayKeys) {
        const blocks = personDayBlocks.get(hubPersonDayKey(row.userId, dk)) ?? []
        for (const b of blocks) {
          if (getJobDisplayTitle(b.job_id).toLowerCase().includes(q)) return true
        }
      }
      return false
    })
  }, [afterBlockFilter, search, visibleDayKeys, personDayBlocks, getJobDisplayTitle])

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
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{jobsError}</p>
      ) : null}
      {summariesError ? (
        <p style={{ color: '#92400e', fontSize: '0.875rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
          Could not load schedule blocks for this week ({summariesError}). People grid is empty.
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
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
                  color: hubMultiCellAddActive ? '#ca8a04' : '#2563eb',
                  background: hubMultiCellAddActive ? '#fffbeb' : '#fff',
                }}
                onClick={onRequestHubMultiCellAddMode}
              >
                ++
              </button>
            ) : null}
          </div>
        ) : null}
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Person or Job"
            aria-label="Search person or job"
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', minWidth: 200 }}
          />
        </label>
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={onlyWithBlocksThisWeek}
            onChange={(e) => setOnlyWithBlocksThisWeek(e.target.checked)}
          />
          Hide Inactive
        </label>
        {showHideWeekendToggle ? (
          <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hideWeekend}
              onChange={(e) => onHideWeekendChange(e.target.checked)}
              aria-label="Hide Saturday and Sunday columns"
            />
            Hide weekend
          </label>
        ) : null}
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={highlightLinkedGroups}
            onChange={(e) => onHighlightLinkedGroupsChange(e.target.checked)}
            aria-label="Highlight linked: matching border and background on mirrored crew blocks"
          />
          Highlight linked
        </label>
      </div>

      {loading ? <p style={{ color: '#6b7280' }}>Loading…</p> : null}

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
                  borderTop: '1px solid #e5e7eb',
                  borderRight: '1px solid #e5e7eb',
                  borderBottom: '1px solid #e5e7eb',
                  background: isMobile ? 'transparent' : '#f3f4f6',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  width: '1%',
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  boxShadow: isMobile
                    ? undefined
                    : 'inset 1px 0 0 #e5e7eb, inset -1px 0 0 #e5e7eb',
                }}
              >
                {isMobile ? <span style={scheduleDispatchMobileNamePill}>Person</span> : 'Person'}
              </th>
              {visibleDayKeys.map((dk) => (
                <th
                  key={dk}
                  data-schedule-column-day={dk}
                  style={{
                    textAlign: 'center',
                    padding: '0.35rem',
                    border: '1px solid #e5e7eb',
                    ...scheduleDispatchDayColumnHeaderStyle(dk, { scheduleTodayYmd, columnFocusDayYmd }, '#f3f4f6'),
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
                        title={`${missingNoteCount} card${missingNoteCount === 1 ? '' : 's'} missing a note for ${hubDayColumnHeaderLabel(dk)}`}
                        aria-label={`${missingNoteCount} card${missingNoteCount === 1 ? '' : 's'} missing a note for ${hubDayColumnHeaderLabel(dk)}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          color: '#dc2626',
                          fontWeight: 700,
                        }}
                      >
                        <ScheduleDispatchBlockNoteIcon size={12} />
                        <span>{missingNoteCount}</span>
                      </span>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAssignees.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={1 + visibleDayKeys.length}
                  style={{ padding: '1rem', border: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'center' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredAssignees.map((person) => (
                <tr key={person.userId}>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderTop: '1px solid #e5e7eb',
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: '1px solid #e5e7eb',
                      position: 'sticky',
                      left: 0,
                      background: isMobile ? 'transparent' : '#fff',
                      zIndex: 1,
                      fontWeight: 600,
                      color: '#111827',
                      verticalAlign: 'top',
                      width: '1%',
                      minWidth: 0,
                      whiteSpace: isMobile ? undefined : 'nowrap',
                      boxShadow: isMobile
                        ? undefined
                        : 'inset 1px 0 0 #e5e7eb, inset -1px 0 0 #e5e7eb',
                    }}
                  >
                    {isMobile ? (
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
                        timeOffInfo={timeOffInfo}
                        onRequestUndoNotComingIn={onRequestUndoNotComingIn}
                      />
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
              color: '#111827',
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
                  ? '#eff6ff'
                  : '#fff'
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
                    border: selected ? '2px solid #2563eb' : '1px solid #d1d5db',
                    background,
                    color: selected ? '#1d4ed8' : '#374151',
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
                    background: allWeekSelected ? '#d1fae5' : '#ecfdf5',
                    color: allWeekSelected ? '#047857' : '#065f46',
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
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
                No schedule blocks for {expectedManpowerSelectionLabel}.
              </p>
            ) : (
              <>
                {expectedManpowerDayStats ? (
                  <p style={{ margin: '0 0 0.65rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                    {expectedManpowerSelectionLabel}:{' '}
                    <strong style={{ color: '#374151' }}>
                      {formatExpectedManpowerPersonHours(expectedManpowerDayStats.personHours)}
                    </strong>{' '}
                    person-hours · {expectedManpowerDayStats.jobCount}{' '}
                    {expectedManpowerDayStats.jobCount === 1 ? 'job' : 'jobs'} ·{' '}
                    {expectedManpowerDayStats.distinctPeople}{' '}
                    {expectedManpowerDayStats.distinctPeople === 1 ? 'person' : 'people'}
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
                                color: '#374151',
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
                                        color: '#374151',
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
                                        color: '#1d4ed8',
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
                                        color: '#4b5563',
                                        fontWeight: 400,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {'[ '}
                                      <span style={{ fontWeight: 400, color: '#374151' }}>
                                        {formatExpectedManpowerPersonHours(job.totalPersonHours)}
                                      </span>
                                      <span style={{ color: '#4b5563' }}>{' • '}</span>
                                      <span style={{ fontWeight: 600 }}>{job.distinctPeopleCount}</span>
                                      {' ]'}
                                    </span>
                                    {canShowExpectedManpowerPayroll ? (
                                      <span
                                        style={{
                                          flexShrink: 0,
                                          color: '#6b7280',
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
                                      background: '#fafafa',
                                      padding: '0.35rem 0.5rem 0.45rem',
                                      fontSize: '0.75rem',
                                      color: '#6b7280',
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
                                          borderLeft: '2px solid #e5e7eb',
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
                                            color: '#4b5563',
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
                                                    borderBottom: '1px solid #e5e7eb',
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
                                                  borderBottom: '1px solid #e5e7eb',
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
                                                  borderBottom: '1px solid #e5e7eb',
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
                                                  borderBottom: '1px solid #e5e7eb',
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
              color: '#374151',
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
  groupMemberCountByGroupId: ReadonlyMap<string, number>
  scheduleTodayYmd: string
  canEdit: boolean
  onWeekShift: (deltaWeeks: number) => void
  onThisWeek: () => void
  onOpenJob: (jobId: string) => void
  onOpenHubJobDetail: (block: JobScheduleBlockRow, workDateYmd: string) => void
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
  onHubAssignJobCellPick: (assigneeUserId: string, workDate: string) => void
  onDeleteBlock: (id: string) => void
  onHubEmptyCellClick?: (personUserId: string, workDate: string) => void
  onHubAddJobToScheduleForCell?: (assigneeUserId: string, workDate: string) => void
  hubMultiCellAddActive: boolean
  hubMultiCellAddSelectedKeys: ReadonlySet<string>
  onHubMultiCellAddToggle?: (personUserId: string, workDate: string) => void
  onRequestHubMultiCellAddMode?: () => void
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  /** When false, hide Expected Manpower on the People tab. */
  showExpectedManpower?: boolean
  /** When set, the Day tab uses this as Quickfill schedule work date (e.g. tomorrow in Quickfill). */
  dayTabWorkDateYmd?: string
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
  background: '#fff',
  color: '#2563eb',
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
  groupMemberCountByGroupId,
  scheduleTodayYmd,
  canEdit,
  onWeekShift,
  onThisWeek,
  onOpenJob,
  onOpenHubJobDetail,
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
  onHubAssignJobCellPick,
  onDeleteBlock,
  onHubEmptyCellClick,
  onHubAddJobToScheduleForCell,
  hubMultiCellAddActive,
  hubMultiCellAddSelectedKeys,
  onHubMultiCellAddToggle,
  onRequestHubMultiCellAddMode,
  onRequestEditBlockNote,
  showExpectedManpower = true,
  dayTabWorkDateYmd,
  showWeekNavigation = true,
  showHubViewTabs = true,
  showHideWeekendToggle = true,
  userTimeOffByCell,
  onRequestUndoNotComingIn,
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

  return (
    <div style={{ padding: '1rem 1.25rem', maxWidth: '100%' }}>
      {showWeekNavigation ? (
        <ScheduleDispatchWeekNav
          weekStart={weekStart}
          onWeekShift={onWeekShift}
          onThisWeek={onThisWeek}
          dateRangeOverride={weekNavDateRangeOverride}
          rightSlot={weekNavRightSlot}
        />
      ) : null}

      {showHubViewTabs ? (
        <div
          role="tablist"
          aria-label="Hub view"
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: '1rem',
            borderBottom: '1px solid #e5e7eb',
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
              borderBottom: hubTab === 'people' ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -3,
              background: 'none',
              cursor: 'pointer',
              color: hubTab === 'people' ? '#1d4ed8' : '#6b7280',
              fontWeight: hubTab === 'people' ? 600 : 400,
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
              borderBottom: hubTab === 'jobs' ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -3,
              background: 'none',
              cursor: 'pointer',
              color: hubTab === 'jobs' ? '#1d4ed8' : '#6b7280',
              fontWeight: hubTab === 'jobs' ? 600 : 400,
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
              borderBottom: hubTab === 'day' ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -3,
              background: 'none',
              cursor: 'pointer',
              color: hubTab === 'day' ? '#1d4ed8' : '#6b7280',
              fontWeight: hubTab === 'day' ? 600 : 400,
            }}
          >
            Day
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setDispatchSettingsOpen(true)}
              title="Dispatch settings"
              aria-label="Open dispatch settings"
              style={{
                marginLeft: 'auto',
                padding: '0.4rem 0.85rem',
                fontSize: '0.8125rem',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                color: '#374151',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Dispatch Settings
            </button>
          ) : null}
        </div>
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
          onRequestHubMultiCellAddMode={onRequestHubMultiCellAddMode}
          onRequestEditBlockNote={onRequestEditBlockNote}
          showExpectedManpower={showExpectedManpower}
          showHideWeekendToggle={showHideWeekendToggle}
          userTimeOffByCell={userTimeOffByCell}
          onRequestUndoNotComingIn={onRequestUndoNotComingIn}
        />
      ) : hubTab === 'day' ? (
        <QuickfillScheduleSection initialWorkDateYmd={dayTabWorkDateYmd} />
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
          visibleDayKeys={visibleDayKeys}
          hideWeekend={hideWeekend}
          onHideWeekendChange={onHideWeekendChange}
          allPeopleRows={allPeopleRows}
          userIdsWithBlocksThisWeek={userIdsWithBlocksThisWeek}
          salariedUserIds={salariedUserIds}
          personDayBlocks={personDayBlocks}
          getJobDisplayTitle={getJobDisplayTitle}
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
          onRequestHubMultiCellAddMode={onRequestHubMultiCellAddMode}
          onRequestEditBlockNote={onRequestEditBlockNote}
          showExpectedManpower={showExpectedManpower}
          showHideWeekendToggle={showHideWeekendToggle}
          userTimeOffByCell={userTimeOffByCell}
          onRequestUndoNotComingIn={onRequestUndoNotComingIn}
        />
      )}
      <DispatchSettingsModal
        open={dispatchSettingsOpen}
        onClose={() => setDispatchSettingsOpen(false)}
        roster={dispatchSettingsRoster}
      />
    </div>
  )
}
