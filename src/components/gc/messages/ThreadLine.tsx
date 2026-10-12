import { useDroppable } from '@dnd-kit/core'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { LONG_PRESS_MS, useLongPress } from '../../../hooks/useLongPress'

/** How far a finger may travel and still be a hold: `useLongPress`'s own tolerance. */
const HOLD_TRAVEL_PX = 10
import type { JobTile } from '../../../lib/messages/jobTiles'
import { isSentLine } from '../../../lib/messages/sentLines'
import { callLength, channelWord, clockTime, isLong, type ThreadMessage } from '../../../lib/messages/thread'

/**
 * Messages, cut 1's screens: one line of a thread (the prototype's `.msg`, v1.178). Its meta (the channel and a call's
 * length, who, its job), its words (four lines until opened, or all of them), and its time on the last line when there
 * is room, the way a phone's bubbles do (v1.156). Within one day a line tied to the same job as the one above shows the
 * job's number alone (v1.158). A press anywhere but a button opens the message window. On a phone a press and hold
 * opens *Tie this message to* (cut 10, `onHold`): the line darkens once the hold is long enough, and the sheet opens as
 * the finger lifts, so it never opens under the finger; a finger that moves is a scroll.
 */
export function ThreadLine({
  message,
  tile,
  job,
  showAll,
  marked,
  tying,
  body,
  under,
  onOpen,
  onTie,
  onJob,
  onHold,
}: {
  message: ThreadMessage
  tile: JobTile | undefined
  /** How its job reads: the badge and the name, the badge alone, or none. */
  job: 'full' | 'number' | 'none'
  showAll: boolean
  /** The line a link opened the thread at. */
  marked: boolean
  /** A job tile is held (press and hold on a phone): a press on the line ties it there. */
  tying: string | null
  /** A later cut's body in place of the words (cut 2's highlight). Undefined or null keeps the words. */
  body?: ReactNode | null
  /** What a later cut draws under the line (cut 2's offer for a heard day). */
  under?: ReactNode
  onOpen: () => void
  onTie: () => void
  /** A press on the line's job tag: the job's tiles filter, or a line with no job asks for one. */
  onJob: () => void
  /** Press and hold the line: *Tie this message to* (a phone's, cut 10). Absent: a hold does nothing. */
  onHold?: () => void
}) {
  const tieable = !isSentLine(message)
  const { setNodeRef, isOver } = useDroppable({ id: `line:${message.id}`, disabled: !tieable, data: { messageId: message.id } })
  const holds = Boolean(onHold) && tieable
  const hold = useLongPress(() => onHold?.(), { disabled: !holds })
  // The hold's look: dark once it is long enough, so the person knows to lift. It ends with the hold: a lift, a leave,
  // a cancel, or a finger that travels as far as useLongPress calls a scroll.
  const [ready, setReady] = useState(false)
  const readyTimer = useRef<number | null>(null)
  const startAt = useRef<{ x: number; y: number } | null>(null)
  const unready = () => {
    if (readyTimer.current !== null) window.clearTimeout(readyTimer.current)
    readyTimer.current = null
    startAt.current = null
    setReady(false)
  }
  useEffect(
    () => () => {
      if (readyTimer.current !== null) window.clearTimeout(readyTimer.current)
    },
    [],
  )
  const holdHandlers = holds
    ? {
        ...hold.handlers,
        onPointerDown: (e: ReactPointerEvent) => {
          hold.handlers.onPointerDown(e)
          unready()
          if (e.button !== 0) return
          startAt.current = { x: e.clientX, y: e.clientY }
          readyTimer.current = window.setTimeout(() => setReady(true), LONG_PRESS_MS)
        },
        onPointerMove: (e: ReactPointerEvent) => {
          hold.handlers.onPointerMove(e)
          const at = startAt.current
          if (at && (Math.abs(e.clientX - at.x) > HOLD_TRAVEL_PX || Math.abs(e.clientY - at.y) > HOLD_TRAVEL_PX)) unready()
        },
        onPointerUp: () => {
          hold.handlers.onPointerUp()
          unready()
        },
        onPointerLeave: () => {
          hold.handlers.onPointerLeave()
          unready()
        },
        onPointerCancel: () => {
          hold.handlers.onPointerCancel()
          unready()
        },
      }
    : {}
  const folded = !showAll && isLong(message)
  const time = clockTime(message.at)
  const side = message.direction === 'out' ? 'flex-end' : 'flex-start'
  const tone: CSSProperties =
    message.direction === 'team'
      ? { background: 'var(--bg-yellow-tint)', borderColor: 'var(--border-amber-soft)' }
      : message.direction === 'out'
        ? { background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)' }
        : { background: 'var(--surface)', borderColor: 'var(--border)' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: side, gap: '0.25rem' }}>
      <div
        ref={setNodeRef}
        data-thread-line={message.id}
        data-marked={marked || undefined}
        role="button"
        tabIndex={0}
        aria-label={`${channelWord(message)} ${message.direction === 'in' ? 'from' : message.direction === 'out' ? 'to' : 'by'} ${message.who || 'them'}, ${time}. Open it.`}
        data-holding={ready || undefined}
        {...holdHandlers}
        onClick={(e) => {
          if (holds && hold.consumeLongPress()) return
          if ((e.target as HTMLElement).closest('button, a')) return
          if (tying && tieable) onTie()
          else onOpen()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpen()
        }}
        style={{
          ...tone,
          border: '1px solid',
          borderRadius: 10,
          padding: '0.5rem 0.7rem',
          maxWidth: 'min(640px, 92%)',
          cursor: tying && tieable ? 'copy' : 'pointer',
          outline: marked || ready ? '2px solid var(--text-blue-500)' : isOver ? '2px dashed var(--text-blue-500)' : 'none',
          outlineOffset: 2,
          ...(ready ? { filter: 'brightness(0.94)' } : null),
          // A hold is the press here, so the phone's own text menu stays shut.
          ...(holds ? { WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' } : null),
        }}
      >
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-600)' }}>
            {channelWord(message)}
            {message.durationSeconds ? ` · ${callLength(message.durationSeconds)}` : ''}
          </strong>
          <span>{message.who}</span>
          {job !== 'none' && tile ? (
            <button
              type="button"
              onClick={onJob}
              title={job === 'number' ? `${tile.num} ${tile.name}` : 'Show only the lines tied to this job'}
              style={{ marginLeft: 'auto', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', padding: '0 0.45rem', fontSize: '0.72rem', cursor: 'pointer', color: 'var(--text-600)' }}
            >
              <strong>{tile.num}</strong>
              {job === 'full' ? ` ${tile.name}` : ''}
            </button>
          ) : (
            tieable && (
              <button
                type="button"
                onClick={onJob}
                title="Tie this line to a job"
                style={{ marginLeft: 'auto', border: '1px dashed var(--border)', borderRadius: 999, background: 'transparent', padding: '0 0.45rem', fontSize: '0.72rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                no job
              </button>
            )
          )}
        </div>
        {message.subject && <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.15rem' }}>{message.subject}</div>}
        {body != null ? (
          <div style={{ fontSize: '0.875rem', marginTop: '0.15rem' }}>{body}</div>
        ) : folded ? (
          <>
            <div style={{ fontSize: '0.875rem', marginTop: '0.15rem', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{message.body}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>{time}</div>
          </>
        ) : (
          // The time keeps a slot at the end of the last line; when the words reach it, the slot wraps and the time drops.
          <div style={{ position: 'relative', fontSize: '0.875rem', marginTop: '0.15rem', whiteSpace: 'pre-wrap' }}>
            {message.body}
            <span aria-hidden="true" style={{ display: 'inline-block', width: '4.6rem' }} />
            <span style={{ position: 'absolute', right: 0, bottom: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{time}</span>
          </div>
        )}
      </div>
      {under}
    </div>
  )
}

/** An event, gray and small, with its time: "Rosa marked the bid lost · 5:05 PM". */
export function EventLine({ message, time }: { message: ThreadMessage; time: string }) {
  return (
    <div data-thread-event={message.id} style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      {message.body} · {time}
    </div>
  )
}
