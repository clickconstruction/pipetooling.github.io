import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { stuckReason, type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import { phoneGiveBack, phoneTall } from '../../lib/phonePressFloor'
import { type LedgerInstance } from '../../lib/checklistHistoryLedger'
import { PASS_MIN_TASKS, PASS_PRESS_LABEL, movedTimesWords, stuckChipWords } from '../../lib/tasks/taskDoerActs'
import { showMoreLabel, stillOpenAge, stillOpenIsLate, stillOpenLabel, stillOpenOrderWords, stillOpenShown, type StillOpenTone } from '../../lib/tasks/todayPage'
import type { LineState } from '../../lib/taskCriteria'
import { useTaskCardSheets } from '../../hooks/useTaskCardSheets'
import type { TaskPhotoView } from '../../hooks/useTaskPhotos'
import type { TaskPhotoRow } from '../../lib/photos/taskPhotosIo'
import { ChecklistItemActivity, type ChecklistItemActivityItem } from './ChecklistItemActivity'
import { TaskLinesList } from './TaskLinesList'
import { TaskPhotoStrip } from './TaskPhotoStrip'
import { TaskPlaceBlock, TaskPlaceLine, TaskSpotPhotoView } from './TaskPlaceBlock'
import { TaskPlaceAddHere } from './TaskPlaceAddHere'
import { TaskMapBlock, TaskMapLine } from './TaskMapBlock'
import { useTaskMapWhole } from '../../hooks/useTaskMapWhole'
import type { TaskPlace } from '../../lib/tasks/taskPlace'
import { TaskRing } from './TaskRing'

/**
 * *Go through them* is a press of words, 20 px tall in the section's title line. On a phone it stands a thumb's 44 px
 * (the phone walk of 2026-11-21), and the margin gives the line back what it grew by, so the list under it stays put.
 */
const GO_THROUGH_THUMB: CSSProperties = { minHeight: phoneTall(20), marginTop: phoneGiveBack(20), marginBottom: phoneGiveBack(20) }

/**
 * The Outstanding section at the bottom of the Today tab (v2.1864): overdue
 * tasks that still need doing — one-offs and show-until-completed items whose
 * date has passed. Rows are actionable: the same complete toggle as Today's
 * cards, plus tap-to-expand activity. Since v2.2017 the expanded panel is the
 * shared ChecklistItemActivity spine (full item history, all occurrences);
 * new notes still land on THIS overdue occurrence via `commentInstanceId`.
 * Renders nothing when the list is empty.
 *
 * Punch list #369, step A2: the list is **Still open** now. The red frame and the red *N need doing* pill are gone,
 * since every row was red and none was late. A row says *given Thu, Aug 20* and wears its age as an amber pill, red is
 * kept for a due day that has passed (`stillOpenAge`), and past three rows the rest fold behind *Show N more*.
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
  mapFor,
  placeNumberFor,
  placeFarFor,
  openInstance,
  spotPhotoUrlFor,
  onPlaceAdded,
  extrasFor,
  onGoThrough,
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
  /** The painted map of a task that has a map and no place (punch list #345): its id. */
  mapFor?: (inst: LedgerInstance) => string | null
  /** The dot's number, once the list has a map over it (PR 4). */
  placeNumberFor?: (inst: LedgerInstance) => number | null
  placeFarFor?: (inst: LedgerInstance) => string | null
  /** Show the task on the map (PR 4): the row with this id opens. `n` changes on every press, so the same row opens twice. */
  openInstance?: { id: string; n: number } | null
  /** The giver's photo of the spot (PR 6), a signed address. */
  spotPhotoUrlFor?: (inst: LedgerInstance) => string | null
  /** The person doing a task may add its missing place from where they stand (PR 8). Called once it has landed. */
  onPlaceAdded?: () => void
  /** Quiet presses for one row, drawn at the top of its open panel: the doer's More (punch list #369, step C3). */
  extrasFor?: (inst: LedgerInstance) => ReactNode
  /** Go through the list one task at a time (punch list #369, step C5). The press shows once the list holds two tasks. */
  onGoThrough?: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
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
  // A row opened from the map, or by a press, is never left behind the fold.
  const { shown, hidden } = stillOpenShown(instances, showAll, expandedId)

  return (
    <section data-still-open style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', margin: '0.9rem 2px 0.4rem' }}>
        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{stillOpenLabel(instances.length)}</h3>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{stillOpenOrderWords(instances.some((i) => stillOpenIsLate(i.checklist_items?.due_date ?? null, todayStr)))}</span>
          {onGoThrough && instances.length >= PASS_MIN_TASKS ? (
            <button type="button" data-go-through onClick={onGoThrough} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, background: 'none', border: 'none', padding: 0, color: 'var(--text-blue-700)', cursor: 'pointer', ...GO_THROUGH_THUMB }}>
              {PASS_PRESS_LABEL}
            </button>
          ) : null}
        </span>
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--surface)',
        }}
      >
        {shown.map((inst) => (
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
            mapId={mapFor?.(inst) ?? null}
            paintedByNameOf={(by) => (by && nameById?.[by] ? nameById[by]! : null)}
            placeNumber={placeNumberFor?.(inst) ?? null}
            placeFar={placeFarFor?.(inst) ?? null}
            spotPhotoUrl={spotPhotoUrlFor?.(inst) ?? null}
            onPlaceAdded={onPlaceAdded}
            extras={extrasFor ? extrasFor(inst) : null}
            placedByName={(() => {
              const by = placeFor?.(inst)?.setBy
              return by && nameById?.[by] ? nameById[by]! : null
            })()}
          />
        ))}
        {hidden > 0 ? (
          <li>
            <button
              type="button"
              data-still-open-more
              aria-expanded={false}
              onClick={() => setShowAll(true)}
              style={{ display: 'block', width: '100%', minHeight: 44, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, background: 'none', border: 'none', color: 'var(--text-blue-700)', cursor: 'pointer' }}
            >
              {showMoreLabel(hidden)}
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  )
}

const AGE_PILL_BASE: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, padding: '2px 9px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }
/** The age at a row's end: red only for a due day that has passed. */
const AGE_PILL: Record<StillOpenTone, CSSProperties> = {
  late: { ...AGE_PILL_BASE, background: 'var(--bg-red-100)', color: 'var(--text-red-700)', border: '1px solid #dc2626' },
  old: { ...AGE_PILL_BASE, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' },
  soft: { ...AGE_PILL_BASE, background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid transparent' },
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
  mapId,
  paintedByNameOf,
  placeNumber,
  placeFar,
  placedByName,
  spotPhotoUrl,
  onPlaceAdded,
  extras = null,
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
  mapId: string | null
  paintedByNameOf: (userId: string | null) => string | null
  placeNumber: number | null
  placeFar: string | null
  placedByName: string | null
  spotPhotoUrl: string | null
  onPlaceAdded?: () => void
  extras?: ReactNode
}) {
  const notes = events.filter((e) => e.event_type === 'comment').length
  const stuck = stuckReason(events)
  const moved = movedTimesWords(events.filter((e) => e.event_type === 'moved').length)
  const age = stillOpenAge(inst.scheduled_date, inst.checklist_items?.due_date ?? null, todayStr)
  const late = stillOpenIsLate(inst.checklist_items?.due_date ?? null, todayStr)
  // A map by itself is read for the row that has no place. With a place, the place's block reads its own way in.
  const taskMap = useTaskMapWhole(place ? null : mapId)
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
          {place ? <TaskPlaceLine place={place} number={placeNumber} overdue={late} old={!late} far={placeFar} /> : null}
          {!place ? <TaskMapLine map={taskMap} /> : null}
          <span style={{ display: 'block', fontSize: '0.78rem', color: age.tone === 'old' && !age.pill ? 'var(--text-amber-800)' : 'var(--text-muted)', marginTop: 2 }}>
            {age.words}
            {lines.length > 0 ? <span> · {lines.filter((l) => l.checked).length} of {lines.length} done when…</span> : null}
            {photos.length > 0 ? <span> · 📷 {photos.length}</span> : null}
            {notes > 0 ? <span> · {notes} {notes === 1 ? 'note' : 'notes'}</span> : null}
            {moved ? <span data-still-open-moved> · {moved}</span> : null}
            {stuck !== null ? <span data-still-open-stuck style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}> · {stuckChipWords(stuck)}</span> : null}
          </span>
        </button>
        {age.pill ? (
          <span data-still-open-age={age.tone} style={AGE_PILL[age.tone]}>
            {age.pill}
          </span>
        ) : null}
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {expanded ? '▾' : '▸'}
        </span>
      </div>
      {expanded ? (
        <div style={{ padding: '0 0.75rem 0.7rem 3.1rem' }}>
          {extras ? (
            <div data-still-open-extras style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
              {extras}
            </div>
          ) : null}
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
              <TaskPlaceBlock place={place} placedByName={placedByName} photoUrl={spotPhotoUrl} />
            </div>
          ) : taskMap.kind === 'read' ? (
            <div style={{ marginBottom: '0.7rem' }}>
              <TaskMapBlock whole={taskMap.whole} paintedByName={paintedByNameOf(taskMap.whole.map.createdBy)} photoUrl={spotPhotoUrl} />
            </div>
          ) : spotPhotoUrl ? (
            <div style={{ marginBottom: '0.7rem' }}>
              <TaskSpotPhotoView url={spotPhotoUrl} />
            </div>
          ) : null}
          {!place && onPlaceAdded ? (
            <div style={{ marginBottom: '0.7rem' }}>
              <TaskPlaceAddHere instanceId={inst.id} onAdded={onPlaceAdded} />
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
