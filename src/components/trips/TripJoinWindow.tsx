/**
 * Join a trip with the next (v2.7963, punch list #379): the small window behind **Join with the next** on an open
 * trip.
 *
 * Nothing to pick: the next trip is the one that went out next on the same site. The window draws both trips as
 * they stand and the one trip they become, before anything is written. Under them it says what stays, what the
 * joined trip takes from the next one, and where the next trip goes. A day both trips give one person is named,
 * with the kind that stays. Two different billings, or a line on each trip, stop the press and say why.
 *
 * The rules and the words are `lib/trips/tripJoin.ts`; this file draws them. The write is the page's (`onJoin`),
 * one call to `trip_join`. Drawn through a portal on the body, as the trip sheet and the split window.
 */
import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import type { TripRecord } from '../../lib/trips/tripRecord'
import {
  TRIP_JOIN_BACK_NOTE,
  TRIP_JOIN_BUSY_LABEL,
  TRIP_JOIN_CONFIRM_LABEL,
  TRIP_JOIN_KEEPS_NOTE,
  tripJoinNotes,
  tripJoinParts,
  tripJoinProblem,
  tripJoinSharedCap,
  tripJoinSharedDayWords,
  tripJoinSharedDays,
  tripJoinTitle,
  type TripJoinLines,
  type TripJoinPart,
} from '../../lib/trips/tripJoin'
import { capStyle, SmallButton } from '../developments/developmentPageBits'

export function TripJoinWindow({
  record,
  next,
  todayYmd,
  lines,
  busy,
  zIndex = 760,
  onJoin,
  onClose,
}: {
  /** The open trip: it keeps its number and its words. */
  record: TripRecord
  /** The trip that went out next on the same site: it goes. */
  next: TripRecord
  todayYmd: string
  /** Whether a job's line carries each trip. One line moves or stays; two stop the join. */
  lines: TripJoinLines
  busy: boolean
  zIndex?: number
  onJoin: () => void
  onClose: () => void
}) {
  useModalStackEntry(true)
  useEffect(() => {
    // Taken in the capture phase and marked handled, so a window under this one keeps its own Escape for the next press.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const title = tripJoinTitle(record, next)
  const parts = useMemo(() => tripJoinParts(record, next, todayYmd), [record, next, todayYmd])
  const shared = useMemo(() => tripJoinSharedDays(record, next), [record, next])
  const problem = tripJoinProblem(record, next, lines)
  const notes = tripJoinNotes(record, next, lines)
  const dead = busy || !!problem
  const quiet = { fontSize: '0.76rem', color: 'var(--text-muted)' } as const

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="trip-join-window"
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 16px' }}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="developmentHistoryBox" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, boxShadow: '0 20px 50px rgba(17, 24, 39, 0.3)', width: 460, maxWidth: '100%', maxHeight: 'calc(100vh - 32px - env(safe-area-inset-top, 0px))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <strong style={{ fontSize: '1rem' }} data-testid="trip-join-title">
            {title}
          </strong>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1.2rem', lineHeight: 1, padding: '0 2px' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '12px 16px', overflowY: 'auto', display: 'grid', gap: 12 }}>
          <div>
            <div style={{ ...capStyle, marginBottom: 5 }}>The two trips</div>
            <div style={{ display: 'grid', gap: 6 }} data-testid="trip-join-parts">
              <Part part={parts.first} testId="trip-join-first" />
              <Part part={parts.second} testId="trip-join-second" />
            </div>
          </div>
          <div>
            <div style={{ ...capStyle, marginBottom: 5 }}>The one trip they become</div>
            <Part part={parts.joined} testId="trip-join-joined" strong />
          </div>
          {shared.length > 0 ? (
            <div data-testid="trip-join-shared">
              <div style={{ ...capStyle, marginBottom: 5 }}>{tripJoinSharedCap(record)}</div>
              <div style={{ display: 'grid', gap: 2 }}>
                {shared.map((d) => {
                  const w = tripJoinSharedDayWords(d)
                  return (
                    <div key={`${d.name}|${d.ymd}`} data-testid="trip-join-shared-day" style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '3px 8px', fontSize: '0.84rem' }}>
                      <strong style={{ whiteSpace: 'nowrap' }}>{w.day}</strong>
                      <span style={{ color: 'var(--text-muted)', minWidth: 0, overflowWrap: 'anywhere' }}>
                        {w.who} · {w.stays}
                      </span>
                      {w.was ? <span style={{ marginLeft: 'auto', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>{w.was}</span> : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: 4 }}>
            {problem ? (
              <div role="alert" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-amber-800)' }} data-testid="trip-join-problem">
                {problem}
              </div>
            ) : (
              notes.map((n) => (
                <div key={n} style={{ fontSize: '0.8rem', color: 'var(--text-700)' }} data-testid="trip-join-note">
                  {n}
                </div>
              ))
            )}
            <div style={quiet}>{TRIP_JOIN_KEEPS_NOTE}</div>
            <div style={quiet}>{TRIP_JOIN_BACK_NOTE}</div>
          </div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SmallButton onClick={onClose}>Cancel</SmallButton>
          <span data-testid="trip-join-confirm">
            <SmallButton onClick={() => (dead ? undefined : onJoin())} primary disabled={dead} title={problem ?? 'Make these two trips the one trip shown.'}>
              {busy ? TRIP_JOIN_BUSY_LABEL : TRIP_JOIN_CONFIRM_LABEL}
            </SmallButton>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Part({ part, testId, strong = false }: { part: TripJoinPart; testId: string; strong?: boolean }) {
  return (
    <div style={{ border: strong ? '1px solid var(--border-strong)' : '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--bg-subtle)' }} data-testid={testId}>
      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{part.name}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {part.who} · {part.days}
      </div>
    </div>
  )
}
