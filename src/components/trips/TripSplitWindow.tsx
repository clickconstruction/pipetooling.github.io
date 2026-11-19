/**
 * Split a trip in two (v2.7891, punch list #379): the small window behind **Split in two** on an open trip.
 *
 * One thing to pick: the day the second trip starts. Every day of the trip but its first is offered, each with who
 * was on it, and a day that follows days at home says so. The day after the longest stretch at home is picked
 * already, since that is where a trip that was really two came apart. Under the days the window draws both trips
 * as they will be, before anything is written.
 *
 * The rules and the words are `lib/trips/tripSplit.ts`; this file draws them. The write is the page's (`onSplit`),
 * one call to `trip_split`. Drawn through a portal on the body, as the trip sheet and the bill window.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import type { TripRecord } from '../../lib/trips/tripRecord'
import {
  TRIP_SPLIT_BUSY_LABEL,
  TRIP_SPLIT_CONFIRM_LABEL,
  TRIP_SPLIT_KEEPS_NOTE,
  TRIP_SPLIT_NO_UNDO_NOTE,
  TRIP_SPLIT_PICK_CAP,
  TRIP_SPLIT_PICK_FIRST,
  tripSplitBillNote,
  tripSplitChoiceWords,
  tripSplitChoices,
  tripSplitHalves,
  tripSplitSuggested,
  tripSplitTitle,
  type TripSplitHalf,
} from '../../lib/trips/tripSplit'
import { capStyle, SmallButton } from '../developments/developmentPageBits'

export function TripSplitWindow({
  record,
  todayYmd,
  onBill,
  busy,
  zIndex = 760,
  onSplit,
  onClose,
}: {
  /** The trip being split. */
  record: TripRecord
  todayYmd: string
  /** Whether a job's line carries this trip: the line stays with the first trip. */
  onBill: boolean
  busy: boolean
  zIndex?: number
  /** Split at this day: the second trip starts on it. */
  onSplit: (ymd: string) => void
  onClose: () => void
}) {
  const choices = useMemo(() => tripSplitChoices(record), [record])
  const [day, setDay] = useState<string | null>(() => tripSplitSuggested(record))
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

  const title = tripSplitTitle(record)
  const halves = day ? tripSplitHalves(record, day, todayYmd) : null
  const billNote = tripSplitBillNote(record, onBill)
  const dead = busy || !halves
  const quiet = { fontSize: '0.76rem', color: 'var(--text-muted)' } as const

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="trip-split-window"
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 16px' }}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="developmentHistoryBox" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, boxShadow: '0 20px 50px rgba(17, 24, 39, 0.3)', width: 460, maxWidth: '100%', maxHeight: 'calc(100vh - 32px - env(safe-area-inset-top, 0px))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <strong style={{ fontSize: '1rem' }} data-testid="trip-split-title">
            {title}
          </strong>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', fontSize: '1.2rem', lineHeight: 1, padding: '0 2px' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '12px 16px', overflowY: 'auto', display: 'grid', gap: 12 }}>
          <div role="radiogroup" aria-label={TRIP_SPLIT_PICK_CAP}>
            <div style={{ ...capStyle, marginBottom: 5 }}>{TRIP_SPLIT_PICK_CAP}</div>
            <div style={{ display: 'grid', gap: 2 }}>
              {choices.map((c) => {
                const w = tripSplitChoiceWords(c)
                const picked = c.ymd === day
                return (
                  <label
                    key={c.ymd}
                    data-testid="trip-split-day"
                    data-day={c.ymd}
                    data-picked={picked ? 'yes' : 'no'}
                    style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.86rem', background: picked ? 'var(--bg-subtle)' : 'transparent', borderTop: c.gap > 1 ? '1px dashed var(--border-strong)' : '1px solid transparent' }}
                  >
                    <input type="radio" name="trip-split-day" value={c.ymd} checked={picked} onChange={() => setDay(c.ymd)} style={{ margin: 0, alignSelf: 'center' }} />
                    <strong style={{ whiteSpace: 'nowrap' }}>{w.day}</strong>
                    <span style={{ color: 'var(--text-muted)', minWidth: 0, overflowWrap: 'anywhere' }}>{w.who}</span>
                    {w.home ? <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>{w.home}</span> : null}
                  </label>
                )
              })}
            </div>
          </div>
          <div>
            <div style={{ ...capStyle, marginBottom: 5 }}>The two trips</div>
            {halves ? (
              <div style={{ display: 'grid', gap: 6 }} data-testid="trip-split-halves">
                <Half half={halves.first} testId="trip-split-first" />
                <Half half={halves.second} testId="trip-split-second" />
              </div>
            ) : (
              <span style={quiet} data-testid="trip-split-pick-first">
                {TRIP_SPLIT_PICK_FIRST}
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {billNote ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)' }} data-testid="trip-split-bill-note">
                {billNote}
              </div>
            ) : null}
            <div style={quiet}>{TRIP_SPLIT_KEEPS_NOTE}</div>
            <div style={quiet}>{TRIP_SPLIT_NO_UNDO_NOTE}</div>
          </div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SmallButton onClick={onClose}>Cancel</SmallButton>
          <span data-testid="trip-split-confirm">
            <SmallButton onClick={() => (day && halves ? onSplit(day) : undefined)} primary disabled={dead} title={halves ? 'Cut this trip into the two trips shown.' : TRIP_SPLIT_PICK_FIRST}>
              {busy ? TRIP_SPLIT_BUSY_LABEL : TRIP_SPLIT_CONFIRM_LABEL}
            </SmallButton>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Half({ half, testId }: { half: TripSplitHalf; testId: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--bg-subtle)' }} data-testid={testId}>
      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{half.name}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {half.who} · {half.days}
      </div>
    </div>
  )
}
