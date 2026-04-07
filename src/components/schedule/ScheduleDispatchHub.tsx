import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useToastContext } from '../../contexts/ToastContext'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import {
  expectedManpowerJobGroupPayrollEstimate,
  expectedManpowerJobGroupsForDay,
  expectedManpowerRowsForDay,
  expectedManpowerWeekPersonHoursTotal,
  formatExpectedManpowerPersonHours,
} from '../../lib/scheduleDispatchExpectedManpower'
import { formatCurrency } from '../../lib/format'
import { SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE } from '../../lib/scheduleDispatchDragHelp'
import { scheduleDispatchCellDroppableId } from '../../lib/scheduleDispatchDnd'
import type { LinkedGroupCardAccent } from '../../lib/scheduleDispatchLinkedGroupPalette'
import { hubPersonDayKey, type ScheduleDispatchHubJobRow } from '../../lib/scheduleDispatchHub'
import { APP_CALENDAR_TZ, formatMmDdSlash, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
import { ScheduleDispatchWeekNav } from './ScheduleDispatchWeekNav'
import type { ScheduleDispatchCardPlacementMode } from './ScheduleDispatchGrid'

const SCHEDULE_DISPATCH_TODAY_COLUMN_BG = '#fefce8'

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
}: HubJobsPanelProps) {
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

      <div style={{ overflowX: 'auto' }}>
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
                  style={{
                    textAlign: 'center',
                    padding: '0.35rem',
                    border: '1px solid #e5e7eb',
                    background: dk === scheduleTodayYmd ? SCHEDULE_DISPATCH_TODAY_COLUMN_BG : '#f3f4f6',
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
                        background: dk === scheduleTodayYmd ? SCHEDULE_DISPATCH_TODAY_COLUMN_BG : undefined,
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
  marginLeft: '0.15rem',
  fontSize: '0.68rem',
  color: '#9ca3af',
  fontWeight: 400,
}

const hubPlusMenuItemStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.28rem 0.4rem',
  fontSize: '0.65rem',
  border: 'none',
  background: '#fff',
  color: '#1e3a8a',
  cursor: 'pointer',
  textAlign: 'left',
}

function HubPeopleBlockCard({
  block,
  workDate,
  canEdit,
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
  onOpenJobPreview,
}: {
  block: JobScheduleBlockRow
  workDate: string
  canEdit: boolean
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
  onOpenJobPreview: (jobId: string, workDateYmd: string) => void
}) {
  const { showToast } = useToastContext()
  const placementPickingActive = cardPlacementMode != null
  const dragDisabled = !canEdit
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
  const linkedAccent =
    highlightLinkedGroups && groupId ? linkedGroupAccentByGroupId.get(groupId) : undefined

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
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <button
          type="button"
          onClick={() => {
            if (placementPickingActive) return
            onOpenJobPreview(block.job_id, workDate)
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
            {groupId ? (
              <button
                type="button"
                disabled={placementPickingActive}
                title={
                  placementPickingActive
                    ? undefined
                    : linkPeerCount > 1
                      ? 'Linked: time and note stay in sync. Click to see every block in this group.'
                      : 'Linked group — click to see all blocks (including outside this week).'
                }
                aria-label="View linked schedule group details"
                onClick={(e) => {
                  e.stopPropagation()
                  if (placementPickingActive) return
                  onOpenLinkedGroup(groupId)
                }}
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#1d4ed8',
                  background: '#dbeafe',
                  border: '1px solid #93c5fd',
                  borderRadius: 3,
                  padding: '0.1rem 0.28rem',
                  cursor: placementPickingActive ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Linked
              </button>
            ) : null}          </div>
          {block.note ? (
            <div style={{ color: '#4b5563', marginTop: 2, wordBreak: 'break-word' }}>{block.note}</div>
          ) : null}
        </button>
      </div>
      {canEdit && !placementPickingActive ? (
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            zIndex: 3,
          }}
        >
          <button
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
              lineHeight: '18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: 4,
              border: '1px solid #60a5fa',
              background: '#fff',
              color: '#1d4ed8',
              cursor: 'pointer',
            }}
          >
            +
          </button>
          {plusMenuOpen ? (
            <div
              role="menu"
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 2,
                minWidth: 108,
                borderRadius: 4,
                border: '1px solid #93c5fd',
                background: '#f8fafc',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                role="menuitem"
                style={{ ...hubPlusMenuItemStyle, borderBottom: '1px solid #e2e8f0' }}
                onClick={(e) => {
                  e.stopPropagation()
                  onPlusMenuBlockIdChange(null)
                  onStartCardPlacement(block, 'linked')
                }}
              >
                Linked copy
              </button>
              <button
                type="button"
                role="menuitem"
                style={hubPlusMenuItemStyle}
                onClick={(e) => {
                  e.stopPropagation()
                  onPlusMenuBlockIdChange(null)
                  onStartCardPlacement(block, 'unlinked')
                }}
              >
                Solo copy
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function HubPeopleDayCell({
  personUserId,
  workDate,
  scheduleTodayYmd,
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
  onOpenJobPreview,
  highlightLinkedGroups,
  linkedGroupAccentByGroupId,
  onOpenLinkedGroup,
  hubAssignJobPlacement,
  onHubAssignJobCellPick,
}: {
  personUserId: string
  workDate: string
  scheduleTodayYmd: string
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
  onOpenJobPreview: (jobId: string, workDateYmd: string) => void
  highlightLinkedGroups: boolean
  linkedGroupAccentByGroupId: ReadonlyMap<string, LinkedGroupCardAccent>
  onOpenLinkedGroup: (groupId: string) => void
  hubAssignJobPlacement: { jobId: string } | null
  onHubAssignJobCellPick: (assigneeUserId: string, workDate: string) => void
}) {
  const droppableId = scheduleDispatchCellDroppableId(workDate, personUserId)
  const { isOver, setNodeRef } = useDroppable({ id: droppableId })
  const idleBg = workDate === scheduleTodayYmd ? SCHEDULE_DISPATCH_TODAY_COLUMN_BG : '#fafafa'
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

  const cellClickable = (assignJobPickingActive || placementPickingActive) && !linkedWrongDay

  return (
    <td
      ref={setNodeRef}
      onClick={() => {
        if (assignJobPickingActive) {
          onHubAssignJobCellPick(personUserId, workDate)
          return
        }
        if (!placementPickingActive) return
        if (linkedWrongDay) return
        onCardPlacementCellPick(personUserId, workDate)
      }}
      style={{
        padding: '0.35rem',
        border: '1px solid #e5e7eb',
        verticalAlign: 'top',
        maxHeight: 180,
        overflowY: 'auto',
        background: cellBg,
        cursor: cellClickable ? 'pointer' : undefined,
      }}
    >
      {cellBlocks.length === 0 ? (
        <span style={{ color: '#d1d5db' }}>—</span>
      ) : (
        cellBlocks.map((b) => {
          const g = b.shared_block_group_id
          const linkPeerCount = g ? groupMemberCountByGroupId.get(g) ?? 0 : 0
          return (
            <HubPeopleBlockCard
              key={b.id}
              block={b}
              workDate={workDate}
              canEdit={canEdit}
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
              onOpenJobPreview={onOpenJobPreview}
            />
          )
        })
      )}
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
  onOpenJobPreview: (jobId: string, workDateYmd: string) => void
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
  canEdit,
  loading,
  jobsError,
  summariesError,
  onOpenJob,
  onOpenJobPreview,
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
}: HubPeoplePanelProps) {
  const [search, setSearch] = useState('')
  const [onlyWithBlocksThisWeek, setOnlyWithBlocksThisWeek] = useState(true)
  const [expectedManpowerByJobSectionCollapsed, setExpectedManpowerByJobSectionCollapsed] = useState(false)
  const [collapsedExpectedManpowerJobIds, setCollapsedExpectedManpowerJobIds] = useState<Set<string>>(
    () => new Set(),
  )

  const expectedManpowerWeekPersonHours = useMemo(
    () => expectedManpowerWeekPersonHoursTotal(hubWeekBlocks),
    [hubWeekBlocks],
  )

  const expectedManpowerDayRows = useMemo(() => {
    if (hubExpectedManpowerDayKey == null) return []
    return expectedManpowerRowsForDay(
      hubWeekBlocks,
      hubExpectedManpowerDayKey,
      getJobDisplayTitle,
      (uid) => hubPeopleNameById.get(uid) ?? 'Unknown',
    )
  }, [hubWeekBlocks, hubExpectedManpowerDayKey, getJobDisplayTitle, hubPeopleNameById])

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
    setCollapsedExpectedManpowerJobIds(new Set())
  }, [hubExpectedManpowerDayKey])

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
          Only people with blocks this week
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
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={highlightLinkedGroups}
            onChange={(e) => onHighlightLinkedGroupsChange(e.target.checked)}
            aria-label="Highlight linked schedule groups: matching border and background on mirrored crew blocks"
          />
          Highlight linked groups
        </label>
      </div>

      {loading ? <p style={{ color: '#6b7280' }}>Loading…</p> : null}

      <div style={{ overflowX: 'auto' }}>
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
                  minWidth: 140,
                }}
              >
                Person
              </th>
              {visibleDayKeys.map((dk) => (
                <th
                  key={dk}
                  style={{
                    textAlign: 'center',
                    padding: '0.35rem',
                    border: '1px solid #e5e7eb',
                    background: dk === scheduleTodayYmd ? SCHEDULE_DISPATCH_TODAY_COLUMN_BG : '#f3f4f6',
                    fontSize: '0.75rem',
                    minWidth: 104,
                  }}
                  title={dk}
                >
                  {hubDayColumnHeaderLabel(dk)}
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
                      border: '1px solid #e5e7eb',
                      position: 'sticky',
                      left: 0,
                      background: '#fff',
                      zIndex: 1,
                      fontWeight: 600,
                      color: '#111827',
                      verticalAlign: 'top',
                    }}
                  >
                    {person.displayName}
                    {salariedUserIds.has(person.userId) ? (
                      <span
                        title="Salaried (Pay settings)"
                        aria-label="Salaried (Pay settings)"
                        style={hubPeopleSalarySuffix}
                      >
                        {' '}(s)
                      </span>
                    ) : null}
                  </td>
                  {visibleDayKeys.map((dk) => {
                    const cellBlocks = personDayBlocks.get(hubPersonDayKey(person.userId, dk)) ?? []
                    return (
                      <HubPeopleDayCell
                        key={dk}
                        personUserId={person.userId}
                        workDate={dk}
                        scheduleTodayYmd={scheduleTodayYmd}
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
                        onOpenJobPreview={onOpenJobPreview}
                        highlightLinkedGroups={highlightLinkedGroups}
                        linkedGroupAccentByGroupId={linkedGroupAccentByGroupId}
                        onOpenLinkedGroup={onOpenLinkedGroup}
                        hubAssignJobPlacement={hubAssignJobPlacement}
                        onHubAssignJobCellPick={onHubAssignJobCellPick}
                      />
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {visibleDayKeys.length > 0 ? (
        <section
          style={{ marginTop: '1.25rem' }}
          aria-label="Expected manpower for the selected day"
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
            aria-label="Expected manpower day"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '0.65rem' }}
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
          </div>

          <div
            role="tabpanel"
            id="hub-expected-manpower-panel"
            aria-labelledby={
              hubExpectedManpowerDayKey
                ? `hub-expected-manpower-tab-${hubExpectedManpowerDayKey}`
                : undefined
            }
          >
            {hubExpectedManpowerDayKey == null ? null : expectedManpowerDayRows.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
                No schedule blocks on {hubDayColumnHeaderLabel(hubExpectedManpowerDayKey)}.
              </p>
            ) : (
              <>
                {expectedManpowerDayStats ? (
                  <p style={{ margin: '0 0 0.65rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                    {hubDayColumnHeaderLabel(hubExpectedManpowerDayKey)}:{' '}
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
                          const jobDetailId = `hub-expected-manpower-job-${job.jobId}-${hubExpectedManpowerDayKey}`
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
  /** Sorted full list (before search / filter). */
  rows: ScheduleDispatchHubMergedRow[]
  loading: boolean
  jobsError: string | null
  summariesError: string | null
  hubTab: 'jobs' | 'people'
  onHubTabChange: (t: 'jobs' | 'people') => void
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
  onOpenJobPreview: (jobId: string, workDateYmd: string) => void
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
  onRequestHubNewJob: () => void
  onHubAssignJobCellPick: (assigneeUserId: string, workDate: string) => void
}

const hubPeopleToolbarBtn: CSSProperties = {
  padding: '0.4rem 0.75rem',
  border: '1px solid #2563eb',
  borderRadius: 4,
  background: '#fff',
  color: '#2563eb',
  cursor: 'pointer',
  fontSize: '0.8125rem',
}

export function ScheduleDispatchHub({
  weekStart,
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  weekNavDateRangeOverride,
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
  onOpenJobPreview,
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
  onRequestHubNewJob,
  onHubAssignJobCellPick,
}: Props) {
  return (
    <div style={{ padding: '1rem 1.25rem', maxWidth: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: 0,
        }}
      >
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <ScheduleDispatchWeekNav
            weekStart={weekStart}
            onWeekShift={onWeekShift}
            onThisWeek={onThisWeek}
            dateRangeOverride={weekNavDateRangeOverride}
            hideWeekend={hideWeekend}
            onHideWeekendChange={onHideWeekendChange}
          />
        </div>
        {hubTab === 'people' && canEdit && !hubAssignJobPlacement ? (
          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              paddingTop: 2,
            }}
          >
            <button type="button" style={hubPeopleToolbarBtn} onClick={onRequestHubAddJob}>
              Add job
            </button>
            <button type="button" style={hubPeopleToolbarBtn} onClick={onRequestHubNewJob}>
              New job
            </button>
          </div>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Hub view"
        style={{ display: 'flex', gap: 4, marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: 2 }}
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
      </div>

      {hubTab === 'jobs' ? (
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
          canEdit={canEdit}
          loading={loading}
          jobsError={jobsError}
          summariesError={summariesError}
          onOpenJob={onOpenJob}
          onOpenJobPreview={onOpenJobPreview}
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
        />
      )}
    </div>
  )
}
