import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'
import { useRef } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { scheduleDispatchMobileNamePill } from '../../lib/scheduleDispatchMobileNamePill'
import {
  scheduleDispatchDayColumnCellIdleBg,
  scheduleDispatchDayColumnHeaderStyle,
  useScrollScheduleDispatchColumnIntoView,
} from '../../lib/scheduleDispatchColumnFocus'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useToastContext } from '../../contexts/ToastContext'
import { ScheduleDispatchBlockNoteIcon } from '../icons/ScheduleDispatchBlockNoteIcon'
import { ScheduleDispatchLinkedChainsIcon } from '../icons/ScheduleDispatchLinkedChainsIcon'
import { useDispatchNoteRequirements } from '../../contexts/DispatchNoteRequirementsContext'
import {
  editNoteIconColorForBlock,
  effectiveNoteRequirement,
  surroundingIconColorForRequirement,
} from '../../lib/dispatchNoteRequirements'
import type { JobScheduleBlockRow, ScheduleTeamMember } from '../../lib/jobScheduleBlocks'
import {
  userTimeOffCellKey,
  type UserTimeOffCellInfo,
} from '../../lib/userTimeOffByCell'
import { ScheduleDispatchTimeOffChip } from './ScheduleDispatchTimeOffChip'
import { scheduleBlockActionTextButtonStyle } from '../../lib/scheduleBlockActionChromeStyle'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE } from '../../lib/scheduleDispatchDragHelp'
import { scheduleDispatchCellDroppableId } from '../../lib/scheduleDispatchDnd'
import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
import { ScheduleDispatchPlusCopyMenu } from './ScheduleDispatchPlusCopyMenu'
import { ScheduleDispatchWeekNav } from './ScheduleDispatchWeekNav'

function formatDayHeader(dateKey: string): { dow: string; md: string } {
  const d = referenceDateForWorkDateYmd(dateKey)
  return {
    dow: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: APP_CALENDAR_TZ }).format(d),
    md: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ }).format(d),
  }
}

function cellKey(assigneeUserId: string, workDate: string): string {
  return `${assigneeUserId}\t${workDate}`
}

const scheduleGridSalarySuffix: CSSProperties = {
  display: 'block',
  fontSize: '0.68rem',
  color: 'var(--text-faint)',
  fontWeight: 400,
  lineHeight: 1.1,
}

export type ScheduleDispatchCardPlacementMode = { sourceBlockId: string; variant: 'linked' | 'unlinked' }

function ScheduleDispatchBlockCard({
  block,
  scheduleTodayYmd,
  canEdit,
  cardPlacementMode,
  plusMenuOpen,
  onPlusMenuBlockIdChange,
  onStartCardPlacement,
  onEditBlock,
  linkPeerCount,
  onDelete,
  onRequestEditBlockNote,
}: {
  block: JobScheduleBlockRow
  scheduleTodayYmd: string
  canEdit: boolean
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  plusMenuOpen: boolean
  onPlusMenuBlockIdChange: (blockId: string | null) => void
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: 'linked' | 'unlinked') => void
  onEditBlock: (b: JobScheduleBlockRow) => void
  linkPeerCount: number
  onDelete: (id: string) => void
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
  const dragDisabled = !canEdit
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    disabled: dragDisabled,
  })
  const placementPickingActive = cardPlacementMode != null
  const style: CSSProperties = {
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
    opacity: isDragging ? 0.5 : 1,
  }
  const openEdit = () => {
    if (!canEdit || placementPickingActive) return
    onEditBlock(block)
  }

  const explainDisabledDrag = () => {
    showToast(SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE, 'info')
  }

  const disabledStripAriaLabel =
    'Cannot drag: you do not have permission to reassign schedule blocks. Click for an explanation.'

  const showLinkedBadge = linkPeerCount > 1
  const showEditNoteBtn = canEdit && !placementPickingActive && !!onRequestEditBlockNote
  const showTopRightControls = showEditNoteBtn
  const showMinusPlusButtons = canEdit && !placementPickingActive
  const showBottomRightCluster = showLinkedBadge || showMinusPlusButtons

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
        background: 'var(--bg-blue-tint)',
        border: '1px solid #93c5fd',
        borderRadius: 4,
        fontSize: '0.75rem',
        overflow: 'visible',
      }}
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
            ? 'linear-gradient(90deg, var(--bg-red-100) 0%, var(--bg-red-200) 100%)'
            : 'linear-gradient(90deg, var(--bg-blue-200) 0%, var(--bg-blue-tint) 100%)',
          borderRight: `1px solid ${dragDisabled ? 'var(--border-red)' : 'var(--border-blue)'}`,
          outline: 'none',
        }}
        aria-label={
          dragDisabled ? disabledStripAriaLabel : 'Drag to move block to another day or team row'
        }
      />
      <div
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
        onClick={openEdit}
        onKeyDown={(e) => {
          if (!canEdit) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openEdit()
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          padding: '0.35rem 0.45rem',
          cursor: canEdit ? 'pointer' : 'default',
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-blue-900)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <span>{scheduleFormatWindow(block.time_start, block.time_end)}</span>
        </div>
        {block.note ? (
          <div style={{ color: 'var(--text-600)', marginTop: 2, overflowWrap: 'anywhere' }}>{block.note}</div>
        ) : null}
      </div>
      {showTopRightControls ? (
        <div
          style={{
            position: 'absolute',
            top: 4,
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
                width: 20,
                height: 20,
                minWidth: 20,
                minHeight: 20,
                boxSizing: 'border-box',
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: editNoteColor,
                cursor: 'pointer',
                fontFamily: 'inherit',
                margin: 0,
                filter:
                  'drop-shadow(0 0 1px var(--surface)) drop-shadow(0 0 2px var(--surface))',
              }}
            >
              <ScheduleDispatchBlockNoteIcon size={12} />
            </button>
          ) : null}
        </div>
      ) : null}
      {showBottomRightCluster ? (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: showEditNoteBtn ? 26 : 2,
            zIndex: 3,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 0,
          }}
        >
          {showLinkedBadge ? (
            <span
              role="img"
              aria-label="Linked"
              title="Linked: time and note stay in sync for this crew block"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                color: chainsColor,
                marginRight: showMinusPlusButtons ? -4 : 0,
                filter:
                  'drop-shadow(0 0 1px var(--surface)) drop-shadow(0 0 2px var(--surface))',
              }}
            >
              <ScheduleDispatchLinkedChainsIcon size={12} />
            </span>
          ) : null}
          {showMinusPlusButtons ? (
            <>
              <button
                type="button"
                aria-label="Remove block"
                title="Remove block"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(block.id)
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
                  color: minusColor,
                  cursor: 'pointer',
                  ...scheduleBlockActionTextButtonStyle,
                }}
              >
                −
              </button>
              <div style={{ position: 'relative', margin: 0, marginLeft: -4 }}>
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
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ScheduleDispatchCell({
  assigneeUserId,
  workDate,
  scheduleTodayYmd,
  columnFocusDayYmd,
  blocks,
  cardPlacementMode,
  placementSourceWorkDate,
  plusMenuBlockId,
  onPlusMenuBlockIdChange,
  onStartCardPlacement,
  onCardPlacementCellPick,
  groupMemberCountByGroupId,
  canEdit,
  onAddClick,
  onEditBlock,
  onDeleteBlock,
  onRequestEditBlockNote,
  timeOffInfo,
  onRequestUndoNotComingIn,
}: {
  assigneeUserId: string
  workDate: string
  scheduleTodayYmd: string
  columnFocusDayYmd: string
  blocks: JobScheduleBlockRow[]
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  placementSourceWorkDate: string | null
  plusMenuBlockId: string | null
  onPlusMenuBlockIdChange: (blockId: string | null) => void
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: 'linked' | 'unlinked') => void
  onCardPlacementCellPick: (assigneeUserId: string, workDate: string) => void
  groupMemberCountByGroupId: ReadonlyMap<string, number>
  canEdit: boolean
  onAddClick: () => void
  onEditBlock: (b: JobScheduleBlockRow) => void
  onDeleteBlock: (id: string) => void
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  timeOffInfo?: UserTimeOffCellInfo | null
  onRequestUndoNotComingIn?: (personUserId: string, workDate: string) => void
}) {
  const cellHasTimeOff = timeOffInfo != null
  const droppableId = scheduleDispatchCellDroppableId(workDate, assigneeUserId)
  const { isOver, setNodeRef } = useDroppable({ id: droppableId, disabled: cellHasTimeOff })
  const idleBg = scheduleDispatchDayColumnCellIdleBg(workDate, {
    scheduleTodayYmd,
    columnFocusDayYmd,
  })
  const placementPickingActive = cardPlacementMode != null && canEdit
  const linkedWrongDay =
    cardPlacementMode?.variant === 'linked' &&
    placementSourceWorkDate != null &&
    workDate !== placementSourceWorkDate
  let cellBg = isOver ? 'var(--bg-blue-200)' : idleBg
  if (placementPickingActive && linkedWrongDay) {
    cellBg = 'var(--bg-muted)'
  } else if (placementPickingActive && !linkedWrongDay) {
    cellBg = isOver ? 'var(--bg-blue-200)' : 'var(--bg-sky-tint)'
  }
  // Time-off cells aren't valid placement targets — gray them out the same
  // way `linked wrong day` cells do during the placement flow.
  if (cellHasTimeOff && placementPickingActive) {
    cellBg = 'var(--bg-muted)'
  }
  const placementPickingTargetable = placementPickingActive && !cellHasTimeOff

  return (
    <td
      ref={setNodeRef}
      onClick={() => {
        if (!placementPickingTargetable) return
        onCardPlacementCellPick(assigneeUserId, workDate)
      }}
      style={{
        position: 'relative',
        isolation: 'isolate',
        verticalAlign: 'top',
        minWidth: 132,
        maxWidth: 200,
        padding: 6,
        border: '1px solid var(--border)',
        background: cellBg,
        cursor: placementPickingTargetable ? 'pointer' : undefined,
      }}
    >
      <div style={{ minHeight: 48, position: 'relative' }}>
        {timeOffInfo && blocks.length === 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
                    ? () => onRequestUndoNotComingIn(assigneeUserId, workDate)
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
                  ? () => onRequestUndoNotComingIn(assigneeUserId, workDate)
                  : undefined
              }
              interactiveTitle="Click to mark as coming in"
            />
          </div>
        ) : null}
        {blocks.map((b) => {
          const g = b.shared_block_group_id
          const linkPeerCount = g ? groupMemberCountByGroupId.get(g) ?? 0 : 0
          return (
            <ScheduleDispatchBlockCard
              key={b.id}
              block={b}
              scheduleTodayYmd={scheduleTodayYmd}
              canEdit={canEdit}
              cardPlacementMode={cardPlacementMode}
              plusMenuOpen={plusMenuBlockId === b.id}
              onPlusMenuBlockIdChange={onPlusMenuBlockIdChange}
              onStartCardPlacement={onStartCardPlacement}
              onEditBlock={onEditBlock}
              linkPeerCount={linkPeerCount}
              onDelete={onDeleteBlock}
              onRequestEditBlockNote={onRequestEditBlockNote}
            />
          )
        })}
      </div>
      {canEdit && !cellHasTimeOff ? (
        <div
          style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onAddClick}
            style={{
              width: '100%',
              padding: '0.25rem',
              fontSize: '0.7rem',
              background: 'var(--surface)',
              border: '1px dashed #93c5fd',
              borderRadius: 4,
              color: 'var(--text-link)',
              cursor: 'pointer',
            }}
          >
            Add block
          </button>
        </div>
      ) : null}
    </td>
  )
}

export type ScheduleDispatchGridProps = {
  weekStart: string
  visibleDayKeys: string[]
  hideWeekend: boolean
  onHideWeekendChange: (hide: boolean) => void
  weekNavDateRangeOverride?: string
  /** URL `day` when in the visible week; column tint + scroll. */
  columnFocusDayYmd?: string
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  placementSourceWorkDate: string | null
  plusMenuBlockId: string | null
  onPlusMenuBlockIdChange: (blockId: string | null) => void
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: 'linked' | 'unlinked') => void
  onCardPlacementCellPick: (assigneeUserId: string, workDate: string) => void
  groupMemberCountByGroupId: ReadonlyMap<string, number>
  salariedUserIds: ReadonlySet<string>
  teamMembers: ScheduleTeamMember[]
  blocksByCell: Map<string, JobScheduleBlockRow[]>
  loading: boolean
  canEdit: boolean
  onWeekShift: (deltaWeeks: number) => void
  onThisWeek: () => void
  onAddClick: (assigneeUserId: string, workDate: string) => void
  onEditBlock: (b: JobScheduleBlockRow) => void
  onDeleteBlock: (id: string) => void
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  /** Company-calendar today YMD (`denverCalendarDayKey`); column highlight when in `visibleDayKeys`. */
  scheduleTodayYmd: string
  /** Job-week only: people in this set are on `jobs_ledger_team_members`. Omit while loading. */
  officialJobTeamUserIds?: ReadonlySet<string>
  canAddUserToJobRoster?: boolean
  onAddUserToJobRoster?: (userId: string) => void
  addToJobBusyUserId?: string | null
  /** Map keyed by `userTimeOffCellKey(userId, workDate)` → time-off info to render as a chip on the cell. */
  userTimeOffByCell?: ReadonlyMap<string, UserTimeOffCellInfo>
  /** Optional click handler for the "Not coming in" chip — opens the undo confirm modal. */
  onRequestUndoNotComingIn?: (personUserId: string, workDate: string) => void
}

export function ScheduleDispatchGrid({
  weekStart,
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  weekNavDateRangeOverride,
  columnFocusDayYmd = '',
  cardPlacementMode,
  placementSourceWorkDate,
  plusMenuBlockId,
  onPlusMenuBlockIdChange,
  onStartCardPlacement,
  onCardPlacementCellPick,
  groupMemberCountByGroupId,
  salariedUserIds,
  teamMembers,
  blocksByCell,
  loading,
  canEdit,
  onWeekShift,
  onThisWeek,
  onAddClick,
  onEditBlock,
  onDeleteBlock,
  onRequestEditBlockNote,
  scheduleTodayYmd,
  officialJobTeamUserIds,
  canAddUserToJobRoster = false,
  onAddUserToJobRoster,
  addToJobBusyUserId = null,
  userTimeOffByCell,
  onRequestUndoNotComingIn,
}: ScheduleDispatchGridProps) {
  const isMobile = useIsMobile()
  const scrollRootRef = useRef<HTMLDivElement>(null)
  useScrollScheduleDispatchColumnIntoView({
    columnFocusDayYmd,
    loading,
    scrollRootRef,
    scrollKey: `${weekStart}-${columnFocusDayYmd}`,
  })

  const sortedMembers = [...teamMembers].sort((a, b) => {
    const an = (a.name ?? '').trim().toLowerCase()
    const bn = (b.name ?? '').trim().toLowerCase()
    return an.localeCompare(bn)
  })

  return (
    <>
      <ScheduleDispatchWeekNav
        weekStart={weekStart}
        onWeekShift={onWeekShift}
        onThisWeek={onThisWeek}
        dateRangeOverride={weekNavDateRangeOverride}
        hideWeekend={hideWeekend}
        onHideWeekendChange={onHideWeekendChange}
      />

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : null}

      <div
        ref={scrollRootRef}
        style={{
          width: 'auto',
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
                position: 'sticky',
                left: 0,
                zIndex: 2,
                background: isMobile ? 'transparent' : 'var(--bg-muted)',
                borderTop: '1px solid var(--border)',
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                padding: '0.5rem',
                textAlign: 'left',
                width: '1%',
                minWidth: 0,
                whiteSpace: 'nowrap',
                boxShadow: isMobile
                  ? undefined
                  : 'inset 1px 0 0 var(--border), inset -1px 0 0 var(--border)',
              }}
            >
              {isMobile ? <span style={scheduleDispatchMobileNamePill}>Team member</span> : 'Team member'}
            </th>
            {visibleDayKeys.map((dk) => {
              const { dow, md } = formatDayHeader(dk)
              return (
                <th
                  key={dk}
                  title={dk}
                  data-schedule-column-day={dk}
                  style={{
                    ...scheduleDispatchDayColumnHeaderStyle(dk, {
                      scheduleTodayYmd,
                      columnFocusDayYmd,
                    }, 'var(--bg-muted)'),
                    border: '1px solid var(--border)',
                    padding: '0.5rem',
                    textAlign: 'center',
                    minWidth: 132,
                  }}
                >
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {dow} {md}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>{dk}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedMembers.length === 0 ? (
            <tr>
              <td
                colSpan={1 + visibleDayKeys.length}
                style={{ padding: '1rem', border: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'center' }}
              >
                No roster or scheduled assignees for this week.
              </td>
            </tr>
          ) : (
            sortedMembers.map((m) => (
              <tr key={m.user_id}>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: isMobile ? 'transparent' : 'var(--surface)',
                    borderTop: '1px solid var(--border)',
                    borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    padding: '0.5rem',
                    fontWeight: 500,
                    verticalAlign: 'top',
                    width: '1%',
                    minWidth: 0,
                    boxShadow: isMobile
                      ? undefined
                      : 'inset 1px 0 0 var(--border), inset -1px 0 0 var(--border)',
                  }}
                >
                  <div style={{ lineHeight: 1.25 }}>
                    {isMobile ? (
                      <span style={{ ...scheduleDispatchMobileNamePill, whiteSpace: 'nowrap' }}>
                        {(m.name ?? '').trim() || '—'}
                        {salariedUserIds.has(m.user_id) ? (
                          <span
                            title="Salaried (Pay settings)"
                            aria-label="Salaried (Pay settings)"
                            style={scheduleGridSalarySuffix}
                          >
                            (s)
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span style={{ whiteSpace: 'nowrap' }}>
                        {(m.name ?? '').trim() || '—'}
                        {salariedUserIds.has(m.user_id) ? (
                          <span
                            title="Salaried (Pay settings)"
                            aria-label="Salaried (Pay settings)"
                            style={scheduleGridSalarySuffix}
                          >
                            (s)
                          </span>
                        ) : null}
                      </span>
                    )}
                  </div>
                  {officialJobTeamUserIds != null && !officialJobTeamUserIds.has(m.user_id) ? (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.25 }}>Not on job</div>
                      {canAddUserToJobRoster && onAddUserToJobRoster ? (
                        <button
                          type="button"
                          onClick={() => onAddUserToJobRoster(m.user_id)}
                          disabled={addToJobBusyUserId === m.user_id}
                          aria-label={`Add ${(m.name ?? '').trim() || 'team member'} to job`}
                          style={{
                            marginTop: 4,
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            fontSize: '0.7rem',
                            color: addToJobBusyUserId === m.user_id ? 'var(--text-faint)' : 'var(--text-link)',
                            cursor: addToJobBusyUserId === m.user_id ? 'not-allowed' : 'pointer',
                            textDecoration: 'underline',
                            textUnderlineOffset: 2,
                          }}
                        >
                          {addToJobBusyUserId === m.user_id ? 'Adding…' : 'Add to job'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </td>
                {visibleDayKeys.map((dk) => (
                  <ScheduleDispatchCell
                    key={`${m.user_id}-${dk}`}
                    assigneeUserId={m.user_id}
                    workDate={dk}
                    scheduleTodayYmd={scheduleTodayYmd}
                    columnFocusDayYmd={columnFocusDayYmd}
                    blocks={blocksByCell.get(cellKey(m.user_id, dk)) ?? []}
                    cardPlacementMode={cardPlacementMode}
                    placementSourceWorkDate={placementSourceWorkDate}
                    plusMenuBlockId={plusMenuBlockId}
                    onPlusMenuBlockIdChange={onPlusMenuBlockIdChange}
                    onStartCardPlacement={onStartCardPlacement}
                    onCardPlacementCellPick={onCardPlacementCellPick}
                    groupMemberCountByGroupId={groupMemberCountByGroupId}
                    canEdit={canEdit}
                    onAddClick={() => onAddClick(m.user_id, dk)}
                    onEditBlock={onEditBlock}
                    onDeleteBlock={onDeleteBlock}
                    onRequestEditBlockNote={onRequestEditBlockNote}
                    timeOffInfo={
                      userTimeOffByCell?.get(userTimeOffCellKey(m.user_id, dk)) ?? null
                    }
                    onRequestUndoNotComingIn={onRequestUndoNotComingIn}
                  />
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </>
  )
}

export { cellKey }
