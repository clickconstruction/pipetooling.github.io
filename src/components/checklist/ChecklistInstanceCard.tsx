import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import {
  cardStatus,
  commentCount,
  droppedReason,
  stuckReason,
  stripStamp,
  type ChecklistCardEvent,
} from '../../lib/checklistCardEvents'
import type { LineState } from '../../lib/taskCriteria'
import { linesWords } from '../../lib/taskProgress'
import { TaskLinesList } from './TaskLinesList'
import { TaskRing } from './TaskRing'
import { TaskPhotoStrip } from './TaskPhotoStrip'
import { useTaskCardSheets } from '../../hooks/useTaskCardSheets'
import type { TaskPhotoView } from '../../hooks/useTaskPhotos'
import type { TaskPhotoRow } from '../../lib/photos/taskPhotosIo'
import { ChecklistItemActivity, type ChecklistItemActivityItem } from './ChecklistItemActivity'
import { TaskPlaceBlock, TaskPlaceLine, TaskSpotPhotoView } from './TaskPlaceBlock'
import { TaskPlaceAddHere } from './TaskPlaceAddHere'
import { TaskMapBlock, TaskMapLine } from './TaskMapBlock'
import { TaskDoerMapPress } from './TaskDoerMapPress'
import { useTaskMapWhole } from '../../hooks/useTaskMapWhole'
import type { TaskPlace } from '../../lib/tasks/taskPlace'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { MAP_PRESS_LABEL, MAP_PRESS_TITLE, PHOTO_PRESS_LABEL, beforeStartWords, doneLineWords, justDoneWords, notePressLabel, taskMapIdOf } from '../../lib/tasks/todayPage'
import { openPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { TASK_PILL_LIT_STYLE, TASK_PILL_STYLE, taskPressesUnderWords } from '../../lib/tasks/taskPillStyle'
import { useIsMobile } from '../../hooks/useIsMobile'
import { doerLineWords, droppedLineWords, stuckChipWords } from '../../lib/tasks/taskDoerActs'
import { dayLabel } from '../../lib/checklistDueDates'

export type ChecklistInstanceCardInstance = {
  id: string
  completed_at: string | null
  reviewed_at: string | null
  /** Task cards (#273): the day row's percent; a done row reads 100 whatever is stored. */
  percent_complete?: number | null
}

type ChecklistInstanceCardProps = {
  instance: ChecklistInstanceCardInstance
  /** Rendered title (parent supplies ChecklistTitleWithLinks). */
  title: ReactNode
  /** Oldest-first events for this instance. */
  events: ChecklistCardEvent[]
  nameById: Record<string, string>
  currentUserId: string | null
  onToggleComplete: () => void
  /** Resolves true on success; the card clears its draft only then. */
  onPostComment: (body: string) => Promise<boolean>
  /** Right-side extras (mute, FWD) — parent keeps their behavior. */
  actions?: ReactNode
  /**
   * v2.2336: 'card' is the mobile-first sunlight-pass layout (default, unchanged);
   * 'row' is the desktop ledger — one compact line per item, statuses as chips,
   * quiet actions that brighten on hover. Same state, handlers, and thread.
   */
  variant?: 'card' | 'row' | 'fresh'
  /**
   * Punch list #369: on the `fresh` look, this is the day's Next card. It is drawn larger, a task with a tick box
   * trades the box for a **Mark done** press, and the note press sits in a row above it.
   */
  lead?: boolean
  /** Who hears when this task is done, for the `fresh` look's done line. Left out, the line says only when. */
  hearsName?: string | null
  /**
   * The fresh look: this task was finished in this visit (punch list #369, step B2). Its done line then offers the
   * photo and the note in words, once, in place of a sheet on every Mark done. The parent knows it, since a task that
   * is finished moves from Next to Done today and is mounted anew.
   */
  justDone?: boolean
  /**
   * v2.2017: when set, tapping the title toggles the thread, and the open
   * thread renders the task's FULL history (the shared ChecklistItemActivity
   * spine, all occurrences) instead of just this instance's events. New notes
   * still land on THIS occurrence via `commentInstanceId`.
   */
  fullHistory?: {
    item: ChecklistItemActivityItem
    showInstanceDays: boolean
    setError: (s: string | null) => void
    onPosted?: (instanceId: string, body: string) => void
    /** ✓ Complete / ✓ Post & complete in the thread composer (v2.2039). */
    onComplete?: (inst: { id: string; scheduledDate: string }) => Promise<boolean>
  }
  /**
   * Task cards (#273, PR 2): the card's Done when… lines with their ticks on this day row. The card variant draws
   * them under the title; the row variant folds them behind a *2 of 3 done when…* chip. A done card's boxes are
   * read-only (reopen first), and so are they without `onTickLine`.
   */
  lines?: LineState[]
  onTickLine?: (criterionId: string, ticked: boolean) => void | Promise<void>
  /**
   * Task cards (#273, PR 3): the ring in the tick's seat on a one-off or roadmap card (`takesRing`). A press opens the
   * % sheet; its Set lands through `onSetPercent` and its Done through `onToggleComplete`. A done ring reopens on a press.
   */
  ring?: boolean
  onSetPercent?: (percent: number, words: string) => Promise<boolean>
  /**
   * Task cards (#273, PR 4b): the writer's switch, the card's photos as a strip, and the word that a shot just sent
   * landed. With the switch on, the last line's tick and the sheet's Done open the finishing sheet first.
   */
  asksForPhoto?: boolean
  photos?: TaskPhotoView[]
  onPhotoAdded?: (row: TaskPhotoRow) => void
  /**
   * The task's place (punch list #328, PR 3). The card variant wears its name under the title and, opened, draws the
   * map, Directions and How far am I?. A task with no place passes nothing and draws nothing.
   */
  place?: TaskPlace | null
  /**
   * The painted map of a task that has a map and no place (punch list #345). The card wears the map's name under the
   * title and, opened, draws the line with Open the map, Directions to the start and How far am I?. With a place, the
   * map is that place's way in and rides on `place`.
   */
  mapId?: string | null
  /** The dot's number, once the list has a map over it (PR 4). */
  placeNumber?: number | null
  placeOverdue?: boolean
  /** An older task that is not late (punch list #369). Its dot is the work colour since v2.8045, as any open task's. */
  placeOld?: boolean
  /** How far the place is, once the person asked where they are on the map above: `250 ft north-east`. */
  placeFar?: string | null
  /** Bumped by Show the task on the map (PR 4): the card opens. Zero or absent does nothing. */
  openSignal?: number
  /** The giver's photo of the spot (PR 6), a signed address: beside the place's map when the card is open, or by itself. */
  spotPhotoUrl?: string | null
  /**
   * The person doing the task may add its missing place from where they stand (PR 8). Passed only where that is true:
   * an open card with no place then offers one quiet line. Called once the place has landed.
   */
  onPlaceAdded?: () => void
  /**
   * The fresh look, on a task with no map (punch list #369, step C2): the person doing the task may draw one or leave a
   * point, and it goes on the task. Passed only where that is true. Called once the map is on the task.
   */
  onMapAdded?: () => void
}

/**
 * The mobile-first checklist card (v2.1843, sunlight pass v2.1854): this
 * surface is used one-handed on dim phones outdoors, so the note action is a
 * single 48px right-half button (＋ Add a note → 💬 Notes N) with 2px
 * `--text-600` borders (the app has no dark border token) and near-black
 * text — border weight and type
 * size carry the design, not color tints, because tints are the first thing
 * glare erases. The only saturated elements are the blue note-count badge,
 * the blue "Waiting on review" chip, and the Post button.
 */
export function ChecklistInstanceCard({
  instance,
  title,
  events,
  nameById,
  currentUserId,
  onToggleComplete,
  onPostComment,
  actions,
  variant = 'card',
  lead = false,
  hearsName = null,
  justDone = false,
  fullHistory,
  lines,
  onTickLine,
  ring = false,
  onSetPercent,
  asksForPhoto = false,
  photos,
  onPhotoAdded,
  place = null,
  mapId = null,
  placeNumber = null,
  placeOverdue = false,
  placeOld = false,
  placeFar = null,
  openSignal = 0,
  spotPhotoUrl = null,
  onPlaceAdded,
  onMapAdded,
}: ChecklistInstanceCardProps) {
  const [threadOpen, setThreadOpen] = useState(false)
  useEffect(() => {
    if (openSignal) setThreadOpen(true)
  }, [openSignal])
  // A map by itself is read for the card that has no place. With a place, the place's block reads its own way in.
  const taskMap = useTaskMapWhole(place ? null : mapId)
  const phone = useIsMobile()
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const composerRef = useRef<HTMLInputElement | null>(null)
  const [focusComposerPending, setFocusComposerPending] = useState(false)
  const [linesOpen, setLinesOpen] = useState(false)

  useEffect(() => {
    if (focusComposerPending && threadOpen) {
      composerRef.current?.focus()
      setFocusComposerPending(false)
    }
  }, [focusComposerPending, threadOpen])

  const status = cardStatus(instance, events)
  const comments = commentCount(events)
  const isCompleted = !!instance.completed_at

  const name = (id: string | null | undefined): string => {
    if (!id) return 'Someone'
    if (id === currentUserId) return 'You'
    return nameById[id] ?? 'Someone'
  }

  async function post() {
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true)
    try {
      const ok = await onPostComment(body)
      if (ok) setDraft('')
    } finally {
      setPosting(false)
    }
  }

  const actionBarButtonBase = {
    flex: 1,
    minHeight: 48,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: '0.4rem',
    borderRadius: 10,
    border: '2px solid var(--text-600)',
    background: 'var(--surface)',
    color: 'var(--text-strong)',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0 0.5rem',
  }

  const reopenedCallout =
    status.kind === 'reopened' ? (
      <div
        style={{
          margin: '0.6rem 0 0',
          padding: '0.55rem 0.7rem',
          background: 'var(--bg-amber-tint)',
          border: '2px solid #d97706',
          borderRadius: 10,
          color: 'var(--text-amber-800)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
          Reopened by {name(status.byUserId)} · {stripStamp(status.at)}
        </div>
        {status.reason ? (
          <div style={{ marginTop: 3, fontSize: '0.9375rem', color: 'var(--text-700)', lineHeight: 1.45 }}>
            “{status.reason}”
          </div>
        ) : null}
      </div>
    ) : null

  const statusStrip =
    status.kind === 'waiting_review' ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '0.25rem 0.6rem',
            borderRadius: 8,
            background: '#2563eb',
            color: 'white',
          }}
        >
          Waiting on review
        </span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>Done {stripStamp(status.at)}</span>
      </div>
    ) : status.kind === 'signed_off' ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '0.25rem 0.6rem',
            borderRadius: 8,
            background: '#15803d',
            color: 'white',
          }}
        >
          Signed off
        </span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          by {name(status.byUserId)} {stripStamp(status.at)}
        </span>
      </div>
    ) : null

  const rowChipBase = {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 9px',
    borderRadius: 999,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  }

  // Task cards (#273, PR 2): the Done when… lines; PR 3: the ring in the tick's seat; PR 4b: the sheets and the photos.
  const hasLines = Boolean(lines && lines.length > 0)
  const tickedCount = lines ? lines.filter((l) => l.checked).length : 0
  const titleText = fullHistory?.item.title ?? (typeof title === 'string' ? title : '')
  const lastProgress = (() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]
      if (e && e.event_type === 'progress') return e
    }
    return null
  })()
  const lastMoved = lastProgress && typeof lastProgress.percent === 'number' ? `was ${lastProgress.percent}% ${stripStamp(lastProgress.created_at)}` : null
  const cardSheets = useTaskCardSheets({
    instanceId: instance.id,
    title: titleText,
    lines: lines ?? [],
    asksForPhoto,
    isCompleted,
    percentComplete: instance.percent_complete,
    lastMoved,
    currentUserId,
    onTickLine,
    onToggleComplete,
    onSetPercent,
    onPostComment,
    onPhotoAdded,
  })
  const ringSt = cardSheets.ring
  const ringPress = cardSheets.ringPress
  const linesBlock = hasLines && lines ? <TaskLinesList lines={lines} onTick={onTickLine ? cardSheets.tickLine : undefined} readOnly={!onTickLine || isCompleted} nameOf={name} /> : null
  const photoStrip = photos && photos.length > 0 ? <TaskPhotoStrip photos={photos} compact={variant === 'row'} /> : null
  // The fresh look offers a photo on every card (punch list #369, step B2), so its sheets are always there.
  const ringSheet = ring || asksForPhoto || variant === 'fresh' ? cardSheets.sheets : null
  const linesChip =
    hasLines && lines ? (
      <button
        type="button"
        onClick={() => setLinesOpen((o) => !o)}
        aria-expanded={linesOpen}
        style={{
          ...rowChipBase,
          background: 'var(--bg-muted)',
          color: 'var(--text-700)',
          border: linesOpen ? '1px solid var(--text-600)' : '1px solid var(--border-strong)',
          cursor: 'pointer',
        }}
      >
        {linesWords(tickedCount, lines.length)}
      </button>
    ) : null

  /** Desktop ledger row (v2.2336): one line — checkbox, title, status chips, quiet actions. */
  const rowBody = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minHeight: 36 }}>
      {ring ? (
        <TaskRing state={ringSt} size={30} onPress={ringPress} title={titleText} />
      ) : (
      <button
        type="button"
        onClick={onToggleComplete}
        aria-pressed={isCompleted}
        aria-label={isCompleted ? 'Mark not done' : 'Mark done'}
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: 6,
          border: isCompleted ? 'none' : '2px solid var(--text-600)',
          background: isCompleted ? '#15803d' : 'var(--surface)',
          color: 'white',
          fontSize: '0.8rem',
          lineHeight: 1,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isCompleted ? '✓' : ''}
      </button>
      )}
      <div
        {...(fullHistory
          ? {
              role: 'button' as const,
              tabIndex: 0,
              'aria-expanded': threadOpen,
              'aria-label': `${threadOpen ? 'Hide' : 'Show'} activity for ${fullHistory.item.title}`,
              onClick: (e: MouseEvent<HTMLDivElement>) => {
                if ((e.target as HTMLElement).closest('a')) return
                setThreadOpen((o) => !o)
              },
              onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setThreadOpen((o) => !o)
                }
              },
            }
          : {})}
        style={{
          flex: 1,
          minWidth: 0,
          fontWeight: 500,
          fontSize: '0.9375rem',
          lineHeight: 1.35,
          ...(fullHistory ? { cursor: 'pointer' } : {}),
          ...(isCompleted ? { color: 'var(--text-muted)', textDecoration: 'line-through' } : {}),
        }}
      >
        {title}
      </div>
      {status.kind === 'waiting_review' ? (
        <span style={{ ...rowChipBase, background: '#2563eb', color: 'white' }} title={`Done ${stripStamp(status.at)}`}>
          Waiting on review
        </span>
      ) : null}
      {status.kind === 'signed_off' ? (
        <span style={{ ...rowChipBase, background: '#15803d', color: 'white' }} title={`by ${name(status.byUserId)} ${stripStamp(status.at)}`}>
          Signed off
        </span>
      ) : null}
      {status.kind === 'reopened' ? (
        <span
          style={{
            ...rowChipBase,
            background: 'var(--bg-amber-tint)',
            color: 'var(--text-amber-800)',
            border: '1px solid var(--border-amber)',
          }}
          title={status.reason ? `Reopened by ${name(status.byUserId)}: “${status.reason}”` : `Reopened by ${name(status.byUserId)}`}
        >
          Reopened · {stripStamp(status.at)}
        </span>
      ) : null}
      {linesChip}
      {comments > 0 ? (
        <button
          type="button"
          onClick={() => setThreadOpen((o) => !o)}
          aria-expanded={threadOpen}
          style={{
            ...rowChipBase,
            background: 'var(--bg-blue-tint)',
            color: 'var(--text-blue-700)',
            border: threadOpen ? '1px solid #2563eb' : '1px solid transparent',
            cursor: 'pointer',
          }}
        >
          {comments} note{comments === 1 ? '' : 's'}
        </button>
      ) : (
        <button
          type="button"
          className="myInboxRowActions"
          onClick={() => {
            if (threadOpen) {
              setThreadOpen(false)
              return
            }
            setThreadOpen(true)
            setFocusComposerPending(true)
          }}
          aria-expanded={threadOpen}
          style={{
            ...rowChipBase,
            background: 'var(--surface)',
            color: 'var(--text-600)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ＋ Note
        </button>
      )}
      {actions ? (
        <span className="myInboxRowActions" style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
          {actions}
        </span>
      ) : null}
    </div>
  )

  /**
   * The `fresh` look (punch list #369): Checklist → Today in the New task window's language. Quiet pills carry the
   * note and the parent's extras, a done task is one struck line that says who hears, and the only solid blue is the
   * Next card's Mark done. The tick, the ring and Mark done keep their thick dark edges from the sunlight pass, since
   * glare takes a tint before it takes a border.
   */
  const freshNotePress = (
    <button
      type="button"
      data-fresh-note
      onClick={() => {
        if (threadOpen) {
          setThreadOpen(false)
          return
        }
        setThreadOpen(true)
        if (comments === 0) setFocusComposerPending(true)
      }}
      aria-expanded={threadOpen}
      style={{
        ...TASK_PILL_STYLE,
        ...(comments > 0 ? { fontWeight: 700 } : {}),
        ...(threadOpen ? TASK_PILL_LIT_STYLE : {}),
      }}
    >
      {notePressLabel(comments)}
    </button>
  )
  const freshPhotoPress = onPhotoAdded ? (
    <button type="button" data-fresh-photo onClick={cardSheets.photoPress} style={TASK_PILL_STYLE} title="Add a photo of the work to this task">
      {PHOTO_PRESS_LABEL}
    </button>
  ) : null
  // Step B3: a task that has a map opens it from the card. Whoever reads a task may add a line or a place to its map.
  const freshMapId = taskMapIdOf(place, mapId)
  const freshMapPress = freshMapId ? (
    <button type="button" data-fresh-map onClick={() => void openPaintedMap(freshMapId)} style={{ ...TASK_PILL_STYLE, ...TASK_PILL_LIT_STYLE }} title={MAP_PRESS_TITLE}>
      {MAP_PRESS_LABEL}
    </button>
  ) : onMapAdded ? (
    <TaskDoerMapPress instanceId={instance.id} taskWords={titleText} place={place} onAdded={onMapAdded} />
  ) : null
  const freshBefore = !isCompleted && status.kind !== 'reopened' ? beforeStartWords(hearsName, asksForPhoto) : null
  // Step C6: the person has said something is in the way. The task wears it in amber until it is taken off or done.
  const freshStuck = !isCompleted ? stuckReason(events) : null
  // Step C4: a task closed as no longer applying is a finished task that says so, in place of *Done*.
  const freshDropped = isCompleted ? droppedReason(events) : null
  const freshStatus =
    status.kind === 'waiting_review' ? (
      <div data-fresh-done {...(freshDropped !== null ? { 'data-fresh-dropped': '' } : {})} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
        {freshDropped !== null ? droppedLineWords(stripStamp(status.at), freshDropped) : doneLineWords(stripStamp(status.at), hearsName)}
        {justDone && freshDropped === null ? <span data-fresh-just-done style={{ display: 'block', color: 'var(--text-green-700)' }}>{justDoneWords(hearsName)}</span> : null}
      </div>
    ) : status.kind === 'signed_off' ? (
      <div data-fresh-done style={{ fontSize: '0.78rem', color: 'var(--text-green-700)', marginTop: 2 }}>
        Signed off by {name(status.byUserId)} {stripStamp(status.at)}
      </div>
    ) : null
  const freshLeadPress = lead && !isCompleted
  // On a phone a row's presses go under its words, as the Next card's do at every width (punch list #369).
  const pressesUnder = taskPressesUnderWords(lead, phone)
  const freshBody = (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
        {ring ? (
          <TaskRing state={ringSt} size={lead ? 44 : 34} onPress={ringPress} title={titleText} />
        ) : freshLeadPress ? null : (
          <button
            type="button"
            onClick={onToggleComplete}
            aria-pressed={isCompleted}
            aria-label={isCompleted ? 'Mark not done' : 'Mark done'}
            style={{
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: 8,
              border: isCompleted ? 'none' : '2.5px solid var(--text-600)',
              background: isCompleted ? '#15803d' : 'var(--surface)',
              color: 'white',
              fontSize: '0.95rem',
              lineHeight: 1,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isCompleted ? '✓' : ''}
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            {...(fullHistory
              ? {
                  role: 'button' as const,
                  tabIndex: 0,
                  'aria-expanded': threadOpen,
                  'aria-label': `${threadOpen ? 'Hide' : 'Show'} activity for ${fullHistory.item.title}`,
                  onClick: (e: MouseEvent<HTMLDivElement>) => {
                    if ((e.target as HTMLElement).closest('a')) return
                    setThreadOpen((o) => !o)
                  },
                  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setThreadOpen((o) => !o)
                    }
                  },
                }
              : {})}
            style={{
              fontWeight: lead ? 600 : 500,
              fontSize: lead ? '1.0625rem' : '0.9375rem',
              lineHeight: 1.3,
              marginTop: lead ? 0 : 4,
              ...(fullHistory ? { cursor: 'pointer' } : {}),
              ...(isCompleted ? { color: 'var(--text-muted)', textDecoration: 'line-through' } : {}),
            }}
          >
            {title}
          </div>
          {place ? <TaskPlaceLine place={place} number={placeNumber} overdue={placeOverdue} old={placeOld} far={placeFar} /> : null}
          {!place ? <TaskMapLine map={taskMap} /> : null}
          {freshStuck !== null ? (
            <div style={{ marginTop: 4 }}>
              <span data-fresh-stuck style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' }}>
                {stuckChipWords(freshStuck)}
              </span>
            </div>
          ) : null}
          {freshBefore ? (
            <div data-fresh-before style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {freshBefore}
            </div>
          ) : null}
          {freshStatus}
          {reopenedCallout}
          {linesBlock}
          {photoStrip}
        </div>
        {pressesUnder ? null : (
          <div data-fresh-presses="beside" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', alignItems: 'center', maxWidth: '55%', flexShrink: 0 }}>
            {freshNotePress}
            {freshPhotoPress}
            {freshMapPress}
            {actions}
          </div>
        )}
      </div>
      {pressesUnder ? (
        <div data-fresh-presses="under" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', alignItems: 'center', marginTop: lead ? '0.6rem' : '0.45rem' }}>
          {freshNotePress}
          {freshPhotoPress}
          {freshMapPress}
          {actions}
        </div>
      ) : null}
      {freshLeadPress ? (
        <button
          type="button"
          data-fresh-done-press
          onClick={() => {
            if (ring) void cardSheets.donePress()
            else onToggleComplete()
          }}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '0.65rem',
            minHeight: 46,
            font: 'inherit',
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 10,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Mark done
        </button>
      ) : null}
    </>
  )

  return (
    <li
      data-task-instance={instance.id}
      className={variant === 'row' ? 'myInboxRow' : undefined}
      style={
        variant === 'row'
          ? { borderBottom: '1px solid var(--border-rule)', padding: '0.35rem 0.25rem', listStyle: 'none' }
          : variant === 'fresh'
            ? lead
              ? { border: '2px solid var(--text-600)', borderRadius: 14, padding: '0.8rem', marginBottom: '0.5rem', listStyle: 'none', background: 'var(--surface)' }
              : { border: '1px solid var(--border)', borderRadius: 12, padding: '0.55rem 0.7rem', marginBottom: '0.45rem', listStyle: 'none', background: 'var(--surface)' }
            : { border: '1.5px solid var(--border-strong)', borderRadius: 12, padding: '0.75rem', marginBottom: '0.7rem', listStyle: 'none' }
      }
      {...(variant === 'fresh' && lead ? { 'data-fresh-lead': '' } : {})}
    >
      {variant === 'row' ? (
        rowBody
      ) : variant === 'fresh' ? (
        freshBody
      ) : (
      <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        {ring ? (
          <TaskRing state={ringSt} size={48} onPress={ringPress} title={titleText} />
        ) : (
        <button
          type="button"
          onClick={onToggleComplete}
          aria-pressed={isCompleted}
          aria-label={isCompleted ? 'Mark not done' : 'Mark done'}
          style={{
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: 9,
            border: isCompleted ? 'none' : '2.5px solid var(--text-600)',
            background: isCompleted ? '#15803d' : 'var(--surface)',
            color: 'white',
            fontSize: '1.1rem',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isCompleted ? '✓' : ''}
        </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            {...(fullHistory
              ? {
                  role: 'button' as const,
                  tabIndex: 0,
                  'aria-expanded': threadOpen,
                  'aria-label': `${threadOpen ? 'Hide' : 'Show'} activity for ${fullHistory.item.title}`,
                  onClick: (e: MouseEvent<HTMLDivElement>) => {
                    // Links inside the title stay links — don't toggle on them.
                    if ((e.target as HTMLElement).closest('a')) return
                    setThreadOpen((o) => !o)
                  },
                  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setThreadOpen((o) => !o)
                    }
                  },
                }
              : {})}
            style={{
              fontWeight: 500,
              fontSize: '1rem',
              lineHeight: 1.35,
              marginTop: 2,
              ...(fullHistory ? { cursor: 'pointer' } : {}),
              ...(isCompleted ? { color: 'var(--text-muted)', textDecoration: 'line-through' } : {}),
            }}
          >
            {title}
          </div>
          {place ? <TaskPlaceLine place={place} number={placeNumber} overdue={placeOverdue} old={placeOld} far={placeFar} /> : null}
          {!place ? <TaskMapLine map={taskMap} /> : null}
          {statusStrip}
          {reopenedCallout}
          {linesBlock}
          {photoStrip}
        </div>
        {actions ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'flex-start' }}>{actions}</div>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
        {/* ONE note action, always on the RIGHT half (owner calls, v2.1858 +
            v2.1864): the left half under the complete toggle stays dead space
            so a thumb aiming at notes can't graze the checkbox. Zero notes →
            "＋ Add a note" (opens the thread and focuses the composer); once a
            note exists → "💬 Notes N" (the open thread carries the composer,
            so a separate add button is redundant). */}
        <span aria-hidden="true" style={{ flex: 1 }} />
        {comments > 0 ? (
          <button
            type="button"
            onClick={() => setThreadOpen((o) => !o)}
            aria-expanded={threadOpen}
            style={{
              ...actionBarButtonBase,
              ...(threadOpen ? { background: 'var(--bg-blue-tint)', borderColor: '#2563eb' } : {}),
            }}
          >
            💬 Notes
            <span
              style={{
                background: '#2563eb',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 600,
                minWidth: 24,
                height: 24,
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 0.3rem',
              }}
            >
              {comments}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (threadOpen) {
                setThreadOpen(false)
                return
              }
              setThreadOpen(true)
              setFocusComposerPending(true)
            }}
            aria-expanded={threadOpen}
            style={actionBarButtonBase}
          >
            ＋ Add a note
          </button>
        )}
      </div>
      </>
      )}
      {variant === 'row' && linesOpen ? <div style={{ padding: '0.1rem 0 0.4rem 2.2rem' }}>{linesBlock}{photoStrip}</div> : null}
      {ringSheet}
      {threadOpen && place && variant !== 'row' ? <TaskPlaceBlock place={place} placedByName={place.setBy ? (nameById[place.setBy] ?? null) : null} photoUrl={spotPhotoUrl} /> : null}
      {threadOpen && !place && taskMap.kind === 'read' && variant !== 'row' ? (
        <TaskMapBlock whole={taskMap.whole} paintedByName={taskMap.whole.map.createdBy ? (nameById[taskMap.whole.map.createdBy] ?? null) : null} photoUrl={spotPhotoUrl} />
      ) : null}
      {threadOpen && !place && taskMap.kind !== 'read' && spotPhotoUrl && variant !== 'row' ? (
        <div style={{ marginTop: '0.6rem' }}>
          <TaskSpotPhotoView url={spotPhotoUrl} />
        </div>
      ) : null}
      {threadOpen && !place && !isCompleted && onPlaceAdded && variant !== 'row' ? <TaskPlaceAddHere instanceId={instance.id} onAdded={onPlaceAdded} /> : null}
      {threadOpen && fullHistory ? (
        <div style={{ marginTop: '0.65rem' }}>
          <ChecklistItemActivity
            item={fullHistory.item}
            authUserId={currentUserId}
            showInstanceDays={fullHistory.showInstanceDays}
            setError={fullHistory.setError}
            commentInstanceId={instance.id}
            onPosted={fullHistory.onPosted}
            onComplete={fullHistory.onComplete}
          />
        </div>
      ) : null}
      {threadOpen && !fullHistory ? (
        <div style={{ marginTop: '0.65rem' }}>
          {events.length > 0 ? (
            <div
              style={{
                borderLeft: '3px solid var(--border-strong)',
                paddingLeft: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                marginBottom: '0.6rem',
              }}
            >
              {events.map((e) => {
                if (e.event_type === 'comment') {
                  return (
                    <div key={e.id} style={{ fontSize: '0.9375rem', color: 'var(--text-700)', lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{name(e.actor_user_id)}</span>{' '}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{stripStamp(e.created_at)}</span>{' '}
                      — {e.body}
                    </div>
                  )
                }
                if (e.event_type === 'criterion') {
                  return (
                    <div key={e.id} style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {e.body} · {name(e.actor_user_id)} · {stripStamp(e.created_at)}
                    </div>
                  )
                }
                if (e.event_type === 'progress') {
                  return (
                    <div key={e.id} style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{name(e.actor_user_id)}</span> ·{' '}
                      {typeof e.percent === 'number' ? `${e.percent}%` : 'moved it'} · {stripStamp(e.created_at)}
                      {e.body ? <> · “{e.body}”</> : null}
                    </div>
                  )
                }
                const doerWords = doerLineWords(e.event_type, e.event_type === 'moved' && /^\d{4}-\d{2}-\d{2}$/.test(e.body) ? dayLabel(e.body) : e.body)
                if (doerWords) {
                  return (
                    <div key={e.id} data-doer-line={e.event_type} style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{name(e.actor_user_id)}</span> {doerWords} · {stripStamp(e.created_at)}
                    </div>
                  )
                }
                const label =
                  e.event_type === 'completed'
                    ? 'completed'
                    : e.event_type === 'reopened'
                      ? 'reopened'
                      : e.event_type === 'accepted'
                        ? 'signed off'
                        : e.event_type
                return (
                  <div key={e.id} style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {name(e.actor_user_id)} {label} · {stripStamp(e.created_at)}
                    {e.event_type === 'completed' && e.body ? <> — “{e.body}”</> : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.9375rem', color: 'var(--text-muted)' }}>No activity yet.</p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              ref={composerRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void post()
              }}
              placeholder="Add a note…"
              disabled={posting}
              style={{
                flex: 1,
                minWidth: 0,
                height: 48,
                boxSizing: 'border-box',
                padding: '0 0.75rem',
                fontSize: '1rem',
                border: '2px solid var(--text-600)',
                borderRadius: 10,
              }}
            />
            <button
              type="button"
              onClick={() => void post()}
              disabled={posting || !draft.trim()}
              style={{
                height: 48,
                padding: '0 1.25rem',
                borderRadius: 10,
                border: 'none',
                background: posting || !draft.trim() ? DEAD_PRESS_FILL : '#2563eb',
                color: posting || !draft.trim() ? DEAD_PRESS_TEXT : 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: posting || !draft.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {posting ? '…' : 'Post'}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
