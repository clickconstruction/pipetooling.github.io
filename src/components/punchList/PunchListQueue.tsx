import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { paceAsOfWords, paceFreshness, queueBucketsWords, queueMoreWords, type ShipPacePicture } from '../../../supabase/functions/_shared/shipPace'
import type { UserRole } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { emptyWords } from '../../lib/emptyWords'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { PHONE_PRESS_MIN_HEIGHT, thumbInLine } from '../../lib/phonePress'
import { type ShipPaceIo, shipPaceIo } from '../../lib/settings/shipPaceIo'
import { SHIP_PACE_WORDS } from '../../lib/settings/shipPaceWords'
import { canSeeShipPace } from '../../lib/settingsGroups'
import {
  PUNCH_QUEUE_WORDS,
  dayHourTitle,
  dayHours,
  dayHoursLabel,
  dayHoursMax,
  inLineCount,
  inLineWords,
  mergesAnHourFigure,
  queueFoldedWords,
  queueRows,
  recentStretchWords,
  rowsHaveState,
  shouldReadOnOpen,
  type DayHour,
} from '../../lib/todos/punchListQueue'
import type { PaceQueueStateTone } from '../../../supabase/functions/_shared/shipPace'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

type Props = {
  /** The viewer's role: a dev's opening asks for a fresh read, and a dev sees Read GitHub now. */
  role?: UserRole | null
  io?: ShipPaceIo
  /** The clock, for the smoke: the waits and the as-of words are read against it. */
  now?: () => number
}

/**
 * In the merge queue, above the Burndown on /punch-list (punch list #444): each change in line with its place, how
 * long it has waited and what is left, then the day's merges and the merges an hour. It draws the `ship-pace` row
 * Settings → How fast a change ships draws, through the same `io`; the rules are `punchListQueue.ts`'s and
 * `shipPace.ts`'s. `/punch-list#queue` lands on it. Hide folds it to one line and the device remembers.
 */
export function PunchListQueue({ role = null, io = shipPaceIo, now = Date.now }: Props) {
  const [open, setOpen] = useState<boolean>(() => readOpen())
  // On a phone the fold and the dev's press stand a fingertip tall (the walk of 2026-11-25 measured 24 and 29 px).
  const isMobile = useIsMobile()
  // undefined while the first read runs; null when there is no row yet.
  const [picture, setPicture] = useState<ShipPacePicture | null | undefined>(undefined)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [readLine, setReadLine] = useState<{ ok: boolean; line: string } | null>(null)
  // One fresh read an opening, however many times the row is read after it.
  const asked = useRef(false)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async () => {
    setFailure(null)
    try {
      const next = await io.load()
      if (mounted.current) setPicture(next)
    } catch (e) {
      if (!mounted.current) return
      setPicture(null)
      setFailure(recoveryFailureFromError(e, 'The read failed.'))
    }
  }, [io])

  useEffect(() => {
    void load()
  }, [load])

  // A dev's opening on an old row: one read of GitHub, then the row again. A refusal stays quiet, since the as-of
  // words already say how old the line is.
  useEffect(() => {
    if (asked.current || picture === undefined || failure) return
    if (!shouldReadOnOpen({ role, picture, nowMs: now() })) return
    asked.current = true
    // The read takes some twenty seconds: the old line stays, and the press says it is reading.
    setReading(true)
    void (async () => {
      try {
        const answer = await io.readNow().catch(() => null)
        if (mounted.current && answer?.ok) await load()
      } finally {
        if (mounted.current) setReading(false)
      }
    })()
  }, [picture, failure, role, io, load, now])

  const readNow = useCallback(async () => {
    setReading(true)
    setReadLine(null)
    try {
      const answer = await io.readNow()
      if (!mounted.current) return
      setReadLine(answer)
      if (answer.ok) await load()
    } finally {
      if (mounted.current) setReading(false)
    }
  }, [io, load])

  const toggle = () => {
    const next = !open
    setOpen(next)
    writeOpen(next)
  }

  const nowMs = now()
  const folded = picture ? queueFoldedWords(picture) : ''

  return (
    <section id="queue" data-testid="punch-queue" style={{ marginTop: '2rem' }}>
      {/* A line of the queue is five columns at a desk and two rows on a phone; inline styles cannot carry a media query. */}
      <style>{`
        .punch-queue-row { display: grid; grid-template-columns: 3.2rem minmax(0, 1fr) 8rem 9rem; column-gap: 0.75rem; align-items: baseline; }
        .punch-queue-row[data-with-state] { grid-template-columns: 3.2rem minmax(0, 1fr) 9.5rem 8rem 9rem; }
        .punch-queue-when::before { content: none; }
        @media (max-width: 720px) {
          .punch-queue-row, .punch-queue-row[data-with-state] { grid-template-columns: 2.8rem minmax(0, 1fr); row-gap: 0.1rem; }
          .punch-queue-row > .punch-queue-state { grid-column: 2; }
          .punch-queue-head { display: none; }
          .punch-queue-row > .punch-queue-when { grid-column: 2; }
          .punch-queue-when::before { content: attr(data-label) ' '; font-weight: 400; color: var(--text-muted); }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{PUNCH_QUEUE_WORDS.title}</h2>
        <span data-testid="queue-count" style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {picture ? inLineWords(picture) : ''}
          {!open && folded ? (
            <span data-testid="queue-folded">
              {' · '}
              <ValueSentence text={folded} />
            </span>
          ) : null}
        </span>
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls="queue-body" style={{ ...pill, marginLeft: 'auto', ...(isMobile ? PHONE_TALL : null) }}>
          {open ? PUNCH_QUEUE_WORDS.hide : PUNCH_QUEUE_WORDS.show}
        </button>
      </div>
      {!open ? null : (
        <div id="queue-body" style={{ minWidth: 0 }}>
          {failure ? (
            <OfflineRetryPanel failure={failure} onRetry={load} surface="punch-list-queue" idempotent />
          ) : picture === undefined ? (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{PUNCH_QUEUE_WORDS.loading}</p>
          ) : picture === null ? (
            <EmptyState main={SHIP_PACE_WORDS.emptyMain} tail={SHIP_PACE_WORDS.emptyTail} compact />
          ) : (
            <Body picture={picture} nowMs={nowMs} role={role} />
          )}
          {role === 'dev' && picture !== undefined ? (
            <div data-testid="queue-dev" style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void readNow()}
                disabled={reading}
                style={{ fontFamily: 'inherit', fontSize: '0.85rem', padding: '0.3rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', cursor: reading ? 'default' : 'pointer', opacity: reading ? 0.7 : 1, ...(isMobile ? PHONE_TALL : null) }}
              >
                {reading ? SHIP_PACE_WORDS.reading : SHIP_PACE_WORDS.readNow}
              </button>
              {readLine ? (
                <span data-testid="queue-read-line" style={{ fontSize: '0.85rem', color: readLine.ok ? 'var(--text-muted)' : 'var(--text-red-700)' }}>
                  {readLine.line}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

function Body({ picture, nowMs, role }: { picture: ShipPacePicture; nowMs: number; role: UserRole | null }) {
  const isMobile = useIsMobile()
  const stale = paceFreshness(picture.asOf, nowMs).stale
  const queue = picture.queue
  const rows = queue ? queueRows(queue.entries, nowMs) : []
  const more = queue ? queueMoreWords(inLineCount(picture) ?? rows.length, rows.length) : ''
  // A row written before the function read the state has none: the column then stays away.
  const withState = rowsHaveState(rows) ? '' : undefined
  const hours = dayHours(picture)
  return (
    <>
      <p data-testid="queue-as-of" style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: stale ? 'var(--text-amber-700)' : 'var(--text-muted)' }}>
        {paceAsOfWords(picture.asOf, nowMs)}
        {rows.length > 0 ? ` ${PUNCH_QUEUE_WORDS.order}` : ''}
      </p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
        {queue == null ? (
          <p data-testid="queue-unread" style={{ margin: 0, padding: '0.75rem 0.9rem', fontSize: '0.9rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            {SHIP_PACE_WORDS.queueUnread}
          </p>
        ) : rows.length === 0 ? (
          <div data-testid="queue-empty" style={{ padding: '0.75rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
            <EmptyState main={emptyWords({ kind: 'waiting', who: PUNCH_QUEUE_WORDS.who }).main} compact />
          </div>
        ) : (
          <>
            <div className="punch-queue-row punch-queue-head" data-with-state={withState} style={{ ...cell, ...eyebrow, background: 'var(--bg-subtle)' }}>
              <span>{PUNCH_QUEUE_WORDS.place}</span>
              <span>{PUNCH_QUEUE_WORDS.change}</span>
              {withState === '' ? <span>{PUNCH_QUEUE_WORDS.state}</span> : null}
              <span>{PUNCH_QUEUE_WORDS.waited}</span>
              <span>{PUNCH_QUEUE_WORDS.toGo}</span>
            </div>
            <ol data-testid="queue-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {rows.map((r) => (
                <li key={r.number} data-testid="queue-row" className="punch-queue-row" data-with-state={withState} style={cell}>
                  <WorkedOutValue>{r.place}</WorkedOutValue>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{r.title}</span>
                  {withState === '' ? (
                    <span className="punch-queue-state">
                      {r.tone ? (
                        <span data-testid="queue-state" data-tone={r.tone} style={{ ...chip, ...CHIP_TONE[r.tone] }}>
                          <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                          {r.state}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <span className="punch-queue-when" data-label={PUNCH_QUEUE_WORDS.waited} style={when}>
                    <WorkedOutValue>{r.waited}</WorkedOutValue>
                  </span>
                  <span className="punch-queue-when" data-label={PUNCH_QUEUE_WORDS.toGo} style={when}>
                    {r.toGo ? <WorkedOutValue>{r.toGo}</WorkedOutValue> : <span style={{ color: 'var(--text-muted)' }}>{PUNCH_QUEUE_WORDS.noEstimate}</span>}
                  </span>
                </li>
              ))}
            </ol>
            {more ? (
              <div data-testid="queue-more" style={{ ...cell, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {more}
              </div>
            ) : null}
          </>
        )}
        <div data-testid="queue-today" style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-end', flexWrap: 'wrap', padding: '0.65rem 0.9rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
          <Fact label={PUNCH_QUEUE_WORDS.mergedToday} value={picture.today.merged.toLocaleString('en-US')} sub={PUNCH_QUEUE_WORDS.sinceMidnight} />
          <Fact label={PUNCH_QUEUE_WORDS.anHour} value={mergesAnHourFigure(picture.recent)} sub={recentStretchWords(picture.recent.hours)} />
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={eyebrow}>{PUNCH_QUEUE_WORDS.hourByHour}</div>
            <DayColumns hours={hours} mergedToday={picture.today.merged} />
          </div>
        </div>
        <p data-testid="queue-buckets" style={{ margin: 0, padding: '0.6rem 0.9rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {queue ? `${queueBucketsWords(queue)} ` : ''}
          {canSeeShipPace(role) ? (
            <Link to="/settings?tab=settings-ship-pace" style={{ color: 'var(--text-link)', ...(isMobile ? DOOR_PHONE : null) }}>
              {PUNCH_QUEUE_WORDS.door}
            </Link>
          ) : null}
        </p>
      </div>
    </>
  )
}

function Fact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ display: 'grid' }}>
      <span style={eyebrow}>{label}</span>
      <span style={{ fontSize: '1.4rem', lineHeight: 1.2 }}>
        <WorkedOutValue>{value}</WorkedOutValue>
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</span>
    </div>
  )
}

/** Today's merges, a column an hour from midnight: an hour not yet come is an empty slot, so the row is a whole day wide. */
function DayColumns({ hours, mergedToday }: { hours: DayHour[]; mergedToday: number }) {
  const max = dayHoursMax(hours)
  return (
    <div data-testid="queue-day" role="img" aria-label={dayHoursLabel(hours, mergedToday)}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40, borderBottom: '1px solid var(--border-strong)' }}>
        {hours.map((h) => (
          <span
            key={h.hour}
            title={dayHourTitle(h)}
            data-merged={h.merged ?? ''}
            style={{ flex: '1 1 0', minWidth: 0, height: h.merged ? `${Math.max(8, (h.merged / max) * 100)}%` : 0, background: BAR, borderRadius: '2px 2px 0 0' }}
          />
        ))}
      </div>
      <div aria-hidden style={{ display: 'flex', gap: 2, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        {hours.map((h) => (
          <span key={h.hour} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}>
            {h.hour % 6 === 0 ? h.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/** The columns' blue: the app's link blue, lighter on the dark surface, as the Settings chart's line. */
const BAR = 'var(--text-link)'

const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, padding: '0.05rem 0.55rem', borderRadius: 999, border: '1px solid var(--border)', whiteSpace: 'nowrap' }
/** Checks running is the usual state, so it is blue and never a warning's amber; red is kept for a change that will not merge. */
const CHIP_TONE: Record<PaceQueueStateTone, CSSProperties> = {
  running: { background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' },
  ready: { background: 'var(--bg-green-tint)', borderColor: 'var(--border-green)', color: 'var(--text-green-700)' },
  waiting: { background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-base)' },
  stopped: { background: 'var(--bg-red-tint)', borderColor: 'var(--border-red)', color: 'var(--text-red-700)' },
}

const mono: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const eyebrow: CSSProperties = { fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const cell: CSSProperties = { padding: '0.5rem 0.9rem', borderBottom: '1px solid var(--border)' }
const when: CSSProperties = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const pill: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 500,
  padding: '0.2rem 0.6rem',
  borderRadius: 999,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-base)',
  cursor: 'pointer',
}
/** A button of the block on a phone: a fingertip tall, its words still centred. */
const PHONE_TALL: CSSProperties = { minHeight: PHONE_PRESS_MIN_HEIGHT }
/** The line the door sits in: 0.85rem words at the page's 1.5 line height. */
const DOOR_LINE = 20
/** The door on a phone: a fingertip tall inside its line of words, and the line stays as tall as it was drawn. */
const DOOR_PHONE: CSSProperties = { display: 'inline-flex', alignItems: 'center', ...thumbInLine(DOOR_LINE) }

const OPEN_KEY = 'punchListQueueOpen'

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) !== '0'
  } catch {
    return true
  }
}

function writeOpen(open: boolean): void {
  try {
    window.localStorage.setItem(OPEN_KEY, open ? '1' : '0')
  } catch {
    // A private window keeps the choice for this visit only.
  }
}
