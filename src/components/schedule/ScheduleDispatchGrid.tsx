import type { CSSProperties } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { JobScheduleBlockRow, ScheduleTeamMember } from '../../lib/jobScheduleBlocks'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { scheduleDispatchCellDroppableId } from '../../lib/scheduleDispatchDnd'
import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
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
  marginLeft: '0.15rem',
  fontSize: '0.68rem',
  color: '#9ca3af',
  fontWeight: 400,
}

type ScheduleDispatchMirrorMode = { targetAssigneeUserId: string; workDate: string }

function ScheduleDispatchBlockCard({
  block,
  jobId,
  canEdit,
  mirrorMode,
  onEditBlock,
  onMirrorPickSource,
  linkPeerCount,
  onDelete,
}: {
  block: JobScheduleBlockRow
  jobId: string
  canEdit: boolean
  mirrorMode: ScheduleDispatchMirrorMode | null
  onEditBlock: (b: JobScheduleBlockRow) => void
  onMirrorPickSource: (b: JobScheduleBlockRow) => void
  linkPeerCount: number
  onDelete: (id: string) => void
}) {
  const dragDisabled = !canEdit || block.shared_block_group_id != null
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    disabled: dragDisabled,
  })
  const mirrorPicking =
    mirrorMode != null &&
    canEdit &&
    block.work_date === mirrorMode.workDate &&
    block.job_id === jobId
  const mirrorSourceEligible =
    mirrorPicking && block.assignee_user_id !== mirrorMode.targetAssigneeUserId
  const style: CSSProperties = {
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
    opacity: isDragging ? 0.5 : 1,
    ...(mirrorSourceEligible
      ? { outline: '2px solid #d97706', outlineOffset: 1, boxShadow: '0 0 0 1px rgba(217, 119, 6, 0.25)' }
      : {}),
  }
  const openEdit = () => {
    if (!canEdit) return
    if (mirrorSourceEligible) {
      onMirrorPickSource(block)
      return
    }
    onEditBlock(block)
  }
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        marginBottom: 4,
        background: '#eff6ff',
        border: '1px solid #93c5fd',
        borderRadius: 4,
        fontSize: '0.75rem',
        overflow: 'hidden',
      }}
    >
      {canEdit ? (
        <div
          {...(dragDisabled ? {} : { ...listeners, ...attributes })}
          style={{
            flexShrink: 0,
            width: 14,
            minHeight: 40,
            touchAction: dragDisabled ? undefined : 'none',
            cursor: dragDisabled ? 'not-allowed' : 'grab',
            background: dragDisabled
              ? 'linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 100%)'
              : 'linear-gradient(90deg, #dbeafe 0%, #eff6ff 100%)',
            borderRight: `1px solid ${dragDisabled ? '#d1d5db' : '#bfdbfe'}`,
          }}
          aria-label={dragDisabled ? 'Linked blocks cannot be dragged' : 'Drag to move block to another team row'}
        />
      ) : null}
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
        <div style={{ fontWeight: 600, color: '#1e3a8a', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <span>{scheduleFormatWindow(block.time_start, block.time_end)}</span>
          {linkPeerCount > 1 ? (
            <span
              title="Linked: time and note stay in sync for this crew block"
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
              }}
            >
              Linked
            </span>
          ) : null}
        </div>
        {block.note ? (
          <div style={{ color: '#4b5563', marginTop: 2, wordBreak: 'break-word' }}>{block.note}</div>
        ) : null}
        {canEdit ? (
          <div style={{ marginTop: 4, textAlign: 'right' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(block.id)
              }}
              style={{
                padding: '0.15rem 0.4rem',
                fontSize: '0.65rem',
                background: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ScheduleDispatchCell({
  jobId,
  assigneeUserId,
  workDate,
  blocks,
  dayHasJobBlock,
  mirrorMode,
  groupMemberCountByGroupId,
  canEdit,
  onAddClick,
  onStartMirror,
  onEditBlock,
  onMirrorPickSource,
  onDeleteBlock,
}: {
  jobId: string
  assigneeUserId: string
  workDate: string
  blocks: JobScheduleBlockRow[]
  dayHasJobBlock: boolean
  mirrorMode: ScheduleDispatchMirrorMode | null
  groupMemberCountByGroupId: ReadonlyMap<string, number>
  canEdit: boolean
  onAddClick: () => void
  onStartMirror: (assigneeUserId: string, workDate: string) => void
  onEditBlock: (b: JobScheduleBlockRow) => void
  onMirrorPickSource: (b: JobScheduleBlockRow) => void
  onDeleteBlock: (id: string) => void
}) {
  const droppableId = scheduleDispatchCellDroppableId(workDate, assigneeUserId)
  const { isOver, setNodeRef } = useDroppable({ id: droppableId })
  return (
    <td
      ref={setNodeRef}
      style={{
        verticalAlign: 'top',
        minWidth: 132,
        maxWidth: 200,
        padding: 6,
        border: '1px solid #e5e7eb',
        background: isOver ? '#dbeafe' : '#fafafa',
      }}
    >
      <div style={{ minHeight: 48 }}>
        {blocks.map((b) => {
          const g = b.shared_block_group_id
          const linkPeerCount = g ? groupMemberCountByGroupId.get(g) ?? 0 : 0
          return (
            <ScheduleDispatchBlockCard
              key={b.id}
              block={b}
              jobId={jobId}
              canEdit={canEdit}
              mirrorMode={mirrorMode}
              onEditBlock={onEditBlock}
              onMirrorPickSource={onMirrorPickSource}
              linkPeerCount={linkPeerCount}
              onDelete={onDeleteBlock}
            />
          )
        })}
      </div>
      {canEdit ? (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            type="button"
            onClick={onAddClick}
            style={{
              width: '100%',
              padding: '0.25rem',
              fontSize: '0.7rem',
              background: '#fff',
              border: '1px dashed #93c5fd',
              borderRadius: 4,
              color: '#2563eb',
              cursor: 'pointer',
            }}
          >
            Add block
          </button>
          {dayHasJobBlock ? (
            <button
              type="button"
              onClick={() => onStartMirror(assigneeUserId, workDate)}
              style={{
                width: '100%',
                padding: '0.25rem',
                fontSize: '0.7rem',
                background: '#fffbeb',
                border: '1px dashed #fbbf24',
                borderRadius: 4,
                color: '#b45309',
                cursor: 'pointer',
              }}
            >
              Mirror block
            </button>
          ) : null}
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
  jobId: string
  jobWeekDatesWithBlocks: ReadonlySet<string>
  mirrorMode: ScheduleDispatchMirrorMode | null
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
  onStartMirror: (assigneeUserId: string, workDate: string) => void
  onMirrorPickSource: (b: JobScheduleBlockRow) => void
  onDeleteBlock: (id: string) => void
}

export function ScheduleDispatchGrid({
  weekStart,
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  weekNavDateRangeOverride,
  jobId,
  jobWeekDatesWithBlocks,
  mirrorMode,
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
  onStartMirror,
  onMirrorPickSource,
  onDeleteBlock,
}: ScheduleDispatchGridProps) {
  const sortedMembers = [...teamMembers].sort((a, b) => {
    const an = (a.name ?? '').trim().toLowerCase()
    const bn = (b.name ?? '').trim().toLowerCase()
    return an.localeCompare(bn)
  })

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <ScheduleDispatchWeekNav
        weekStart={weekStart}
        onWeekShift={onWeekShift}
        onThisWeek={onThisWeek}
        dateRangeOverride={weekNavDateRangeOverride}
        hideWeekend={hideWeekend}
        onHideWeekendChange={onHideWeekendChange}
      />

      {loading ? <p style={{ color: '#6b7280' }}>Loading…</p> : null}

      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
        <thead>
          <tr>
            <th
              style={{
                position: 'sticky',
                left: 0,
                zIndex: 2,
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                padding: '0.5rem',
                textAlign: 'left',
                minWidth: 120,
              }}
            >
              Team member
            </th>
            {visibleDayKeys.map((dk) => {
              const { dow, md } = formatDayHeader(dk)
              return (
                <th
                  key={dk}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    padding: '0.5rem',
                    textAlign: 'center',
                    minWidth: 132,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{dow}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{md}</div>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{dk}</div>
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
                style={{ padding: '1rem', border: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'center' }}
              >
                No team members on this job.
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
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    padding: '0.5rem',
                    fontWeight: 500,
                    verticalAlign: 'top',
                  }}
                >
                  {(m.name ?? '').trim() || '—'}
                  {salariedUserIds.has(m.user_id) ? (
                    <span
                      title="Salaried (Pay settings)"
                      aria-label="Salaried (Pay settings)"
                      style={scheduleGridSalarySuffix}
                    >
                      {' '}(s)
                    </span>
                  ) : null}
                </td>
                {visibleDayKeys.map((dk) => (
                  <ScheduleDispatchCell
                    key={`${m.user_id}-${dk}`}
                    jobId={jobId}
                    assigneeUserId={m.user_id}
                    workDate={dk}
                    blocks={blocksByCell.get(cellKey(m.user_id, dk)) ?? []}
                    dayHasJobBlock={jobWeekDatesWithBlocks.has(dk)}
                    mirrorMode={mirrorMode}
                    groupMemberCountByGroupId={groupMemberCountByGroupId}
                    canEdit={canEdit}
                    onAddClick={() => onAddClick(m.user_id, dk)}
                    onStartMirror={onStartMirror}
                    onEditBlock={onEditBlock}
                    onMirrorPickSource={onMirrorPickSource}
                    onDeleteBlock={onDeleteBlock}
                  />
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export { cellKey }
