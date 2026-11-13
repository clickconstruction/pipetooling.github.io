import { useEffect, useState, type ReactNode } from 'react'
import { type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import { dueChipLabel } from '../../lib/checklistDueDates'
import { overdueAgeLabel, type LedgerInstance } from '../../lib/checklistHistoryLedger'
import type { LineState } from '../../lib/taskCriteria'
import { useTaskCardSheets } from '../../hooks/useTaskCardSheets'
import type { TaskPhotoView } from '../../hooks/useTaskPhotos'
import type { TaskPhotoRow } from '../../lib/photos/taskPhotosIo'
import { ChecklistItemActivity, type ChecklistItemActivityItem } from './ChecklistItemActivity'
import { TaskLinesList } from './TaskLinesList'
import { TaskPhotoStrip } from './TaskPhotoStrip'
import { TaskPlaceBlock, TaskPlaceLine } from './TaskPlaceBlock'
import type { TaskPlace } from '../../lib/tasks/taskPlace'
import { TaskRing } from './TaskRing'

/**
 * The Outstanding section at the bottom of the Today tab (v2.1864): overdue
 * tasks that still need doing — one-offs and show-until-completed items whose
 * date has passed. Rows are actionable: the same complete toggle as Today's
 * cards, plus tap-to-expand activity. Since v2.2017 the expanded panel is the
 * shared ChecklistItemActivity spine (full item history, all occurrences);
 * new notes still land on THIS overdue occurrence via `commentInstanceId`.
 * Renders nothing when the list is empty.
 *
 * Task cards (#273, PR 3): a one-off's box gives way to the ring (`takesRingFor`), whose press opens the % sheet; the
 * open panel draws the card's Done when… lines above the activity (`linesFor`, `onTickLine`). PR 4b: each row is its own
 * component so the shared sheets (`useTaskCardSheets`) can hold the photo flow, and the photos draw as a strip.
 */
export function ChecklistOutstandingSection({
  instances,
  eventsByInstance,
  currentUserId,
  todayStr,
  titleFor,
  activityFor,
  onToggleComplete,
  onPosted,
  onCompleteForActivity,
  setError,
  nameById,
  takesRingFor,
  linesFor,
  onTickLine,
  onSetPercent,
  asksForPhotoFor,
  photosFor,
  onPhotoAdded,
  onPostComment,
  placeFor,
  placeNumberFor,
  placeFarFor,
  openInstance,
}: {
  instances: LedgerInstance[]
  eventsByInstance: Map<string, ChecklistCardEvent[]>
  currentUserId: string | null
  todayStr: string
  titleFor: (inst: LedgerInstance) => ReactNode
  activityFor: (inst: LedgerInstance) => { item: ChecklistItemActivityItem; showInstanceDays: boolean }
  onToggleComplete: (inst: LedgerInstance) => void
  onPosted?: (instanceId: string, body: string) => void
  /** ✓ Complete / ✓ Post & complete in the row's activity panel (v2.2039). */
  onCompleteForActivity?: (inst: LedgerInstance) => Promise<boolean>
  setError: (s: string | null) => void
  nameById?: Record<string, string>
  /** True for a row that takes the ring (a one-off or a roadmap card); a row that keeps the box answers false. */
  takesRingFor?: (inst: LedgerInstance) => boolean
  linesFor?: (inst: LedgerInstance) => LineState[]
  onTickLine?: (inst: LedgerInstance, criterionId: string, ticked: boolean) => void | Promise<void>
  onSetPercent?: (inst: LedgerInstance, percent: number, words: string) => Promise<boolean>
  asksForPhotoFor?: (inst: LedgerInstance) => boolean
  photosFor?: (inst: LedgerInstance) => TaskPhotoView[]
  onPhotoAdded?: (row: TaskPhotoRow) => void
  onPostComment?: (inst: LedgerInstance, body: string) => Promise<boolean>
  /** The task's place (punch list #328, PR 3): its name on the row and, opened, the map, Directions and How far am I?. */
  placeFor?: (inst: LedgerInstance) => TaskPlace | null
  /** The dot's number, once the list has a map over it (PR 4). */
  placeNumberFor?: (inst: LedgerInstance) => number | null
  placeFarFor?: (inst: LedgerInstance) => string | null
  /** Show the task on the map (PR 4): the row with this id opens. `n` changes on every press, so the same row opens twice. */
  openInstance?: { id: string; n: number } | null
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const openId = openInstance?.id ?? null
  const openN = openInstance?.n ?? 0
  useEffect(() => {
    if (openId && openN && instances.some((i) => i.id === openId)) setExpandedId(openId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, openN])

  if (instances.length === 0) return null

  const nameOf = (id: string | null | undefined): string => {
    if (!id) return 'Someone'
    if (id === currentUserId) return 'You'
    return nameById?.[id] ?? 'Someone'
  }

  return (
    <section style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Outstanding</h2>
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '0.15rem 0.6rem',
            borderRadius: 999,
            background: 'var(--bg-red-100)',
            border: '1px solid #dc2626',
            color: 'var(--text-red-700)',
          }}
        >
          {instances.length} need{instances.length === 1 ? 's' : ''} doing
        </span>
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          border: '1.5px solid #dc2626',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {instances.map((inst) => (
          <OutstandingRow
            key={inst.id}
            inst={inst}
            events={eventsByInstance.get(inst.id) ?? []}
            expanded={expandedId === inst.id}
            onExpand={() => setExpandedId(expandedId === inst.id ? null : inst.id)}
            currentUserId={currentUserId}
            todayStr={todayStr}
            title={titleFor(inst)}
            activity={activityFor(inst)}
            onToggleComplete={() => onToggleComplete(inst)}
            onPosted={onPosted}
            onCompleteForActivity={onCompleteForActivity ? () => onCompleteForActivity(inst) : undefined}
            setError={setError}
            nameOf={nameOf}
            ring={takesRingFor?.(inst) ?? false}
            lines={linesFor?.(inst) ?? []}
            onTickLine={onTickLine ? (criterionId, ticked) => onTickLine(inst, criterionId, ticked) : undefined}
            onSetPercent={onSetPercent ? (percent, words) => onSetPercent(inst, percent, words) : undefined}
            asksForPhoto={asksForPhotoFor?.(inst) ?? false}
            photos={photosFor?.(inst) ?? []}
            onPhotoAdded={onPhotoAdded}
            onPostComment={onPostComment ? (body) => onPostComment(inst, body) : undefined}
            place={placeFor?.(inst) ?? null}
            placeNumber={placeNumberFor?.(inst) ?? null}
            placeFar={placeFarFor?.(inst) ?? null}
            placedByName={(() => {
              const by = placeFor?.(inst)?.setBy
              return by && nameById?.[by] ? nameById[by]! : null
            })()}
          />
        ))}
      </ul>
    </section>
  )
}

function OutstandingRow({
  inst,
  events,
  expanded,
  onExpand,
  currentUserId,
  todayStr,
  title,
  activity,
  onToggleComplete,
  onPosted,
  onCompleteForActivity,
  setError,
  nameOf,
  ring,
  lines,
  onTickLine,
  onSetPercent,
  asksForPhoto,
  photos,
  onPhotoAdded,
  onPostComment,
  place,
  placeNumber,
  placeFar,
  placedByName,
}: {
  inst: LedgerInstance
  events: ChecklistCardEvent[]
  expanded: boolean
  onExpand: () => void
  currentUserId: string | null
  todayStr: string
  title: ReactNode
  activity: { item: ChecklistItemActivityItem; showInstanceDays: boolean }
  onToggleComplete: () => void
  onPosted?: (instanceId: string, body: string) => void
  onCompleteForActivity?: () => Promise<boolean>
  setError: (s: string | null) => void
  nameOf: (id: string | null | undefined) => string
  ring: boolean
  lines: LineState[]
  onTickLine?: (criterionId: string, ticked: boolean) => void | Promise<void>
  onSetPercent?: (percent: number, words: string) => Promise<boolean>
  asksForPhoto: boolean
  photos: TaskPhotoView[]
  onPhotoAdded?: (row: TaskPhotoRow) => void
  onPostComment?: (body: string) => Promise<boolean>
  place: TaskPlace | null
  placeNumber: number | null
  placeFar: string | null
  placedByName: string | null
}) {
  const notes = events.filter((e) => e.event_type === 'comment').length
  const sheets = useTaskCardSheets({
    instanceId: inst.id,
    title: inst.checklist_items?.title ?? '',
    lines,
    asksForPhoto,
    isCompleted: Boolean(inst.completed_at),
    percentComplete: inst.percent_complete,
    currentUserId,
    onTickLine,
    onToggleComplete,
    onSetPercent,
    onPostComment,
    onPhotoAdded,
  })
  return (
    <li data-task-instance={inst.id} style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem' }}>
        {ring ? (
          <TaskRing state={sheets.ring} size={36} title={inst.checklist_items?.title ?? ''} onPress={sheets.ringPress} />
        ) : (
          <button
            type="button"
            onClick={onToggleComplete}
            aria-label="Mark done"
            style={{
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: 8,
              border: '2.5px solid var(--text-600)',
              background: 'var(--surface)',
              cursor: 'pointer',
            }}
          />
        )}
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'var(--text-strong)',
          }}
        >
          <span style={{ display: 'block', fontSize: '0.9375rem' }}>{title}</span>
          {place ? <TaskPlaceLine place={place} number={placeNumber} overdue far={placeFar} /> : null}
          {(() => {
            // Due-aware line (v2.2351): red means LATE — a task inside
            // its start→due window is calm, amber on the due day.
            const due = inst.checklist_items?.due_date ?? null
            const label = due ? dueChipLabel(due, todayStr) : overdueAgeLabel(inst.scheduled_date, todayStr)
            const color = !due || label.includes('late')
              ? 'var(--text-red-700)'
              : label === 'due today'
                ? 'var(--text-amber-800)'
                : 'var(--text-muted)'
            return (
              <span style={{ display: 'block', fontSize: '0.78rem', color, marginTop: 2 }}>
                {label}
                {lines.length > 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}> · {lines.filter((l) => l.checked).length} of {lines.length} done when…</span>
                ) : null}
                {photos.length > 0 ? <span style={{ color: 'var(--text-muted)' }}> · 📷 {photos.length}</span> : null}
                {notes > 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}> · 💬 {notes} {notes === 1 ? 'note' : 'notes'}</span>
                ) : null}
              </span>
            )
          })()}
        </button>
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {expanded ? '▾' : '▸'}
        </span>
      </div>
      {expanded ? (
        <div style={{ padding: '0 0.75rem 0.7rem 3.1rem' }}>
          {lines.length > 0 ? (
            <div style={{ marginBottom: '0.6rem' }}>
              <TaskLinesList lines={lines} onTick={onTickLine ? sheets.tickLine : undefined} readOnly={Boolean(inst.completed_at)} nameOf={nameOf} />
            </div>
          ) : null}
          {photos.length > 0 ? (
            <div style={{ marginBottom: '0.6rem' }}>
              <TaskPhotoStrip photos={photos} />
            </div>
          ) : null}
          {place ? (
            <div style={{ marginBottom: '0.7rem' }}>
              <TaskPlaceBlock place={place} placedByName={placedByName} />
            </div>
          ) : null}
          <ChecklistItemActivity
            item={activity.item}
            authUserId={currentUserId}
            showInstanceDays={activity.showInstanceDays}
            setError={setError}
            commentInstanceId={inst.id}
            onPosted={onPosted}
            onComplete={onCompleteForActivity}
          />
        </div>
      ) : null}
      {ring || asksForPhoto ? sheets.sheets : null}
    </li>
  )
}
