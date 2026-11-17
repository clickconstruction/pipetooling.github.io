/**
 * A bid's schedule, set from where it is seen (punch list #367): the Development page's By date view opens
 * this small window from a bid's card. Two dates a person types, a start and an end, and a tick for a
 * schedule with no end date. The rules and the words are `lib/bids/bidSchedule.ts`; Edit Bid has the same row.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { EMPTY_SCHEDULE, SCHEDULE_NO_END_LABEL, sameSchedule, scheduleColumns, scheduleDraftProblem, scheduleDraftWords, type BidScheduleColumns, type BidScheduleDraft } from '../../lib/bids/bidSchedule'

const inputStyle: CSSProperties = { width: '100%', minWidth: 0, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 5, font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }
const pressStyle = (primary: boolean, dead: boolean): CSSProperties => ({
  border: `1px solid ${primary && !dead ? '#2563eb' : 'var(--border-strong)'}`,
  borderRadius: 6,
  padding: '6px 12px',
  font: 'inherit',
  fontSize: '0.84rem',
  fontWeight: 600,
  background: primary ? (dead ? DEAD_PRESS_FILL : '#2563eb') : 'var(--surface)',
  color: primary ? (dead ? DEAD_PRESS_TEXT : '#ffffff') : dead ? 'var(--text-muted)' : 'var(--text-strong)',
  cursor: dead ? 'default' : 'pointer',
})

/** The Start and End boxes and the tick, as Edit Bid and the sheet both draw them. */
export function BidScheduleFields({ draft, onChange, today, showProblem, idPrefix }: { draft: BidScheduleDraft; onChange: (next: BidScheduleDraft) => void; today: string; /** Say what is missing; off until the person has touched the row. */ showProblem: boolean; idPrefix: string }) {
  const problem = scheduleDraftProblem(draft)
  const words = scheduleDraftWords(draft, today)
  return (
    <div data-testid="bid-schedule-fields">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <label htmlFor={`${idPrefix}-start`} style={{ display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Start
          <input id={`${idPrefix}-start`} type="date" style={inputStyle} value={draft.start} onChange={(e) => onChange({ ...draft, start: e.target.value })} aria-label="The day the schedule starts" />
        </label>
        <label htmlFor={`${idPrefix}-end`} style={{ display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          End
          <input id={`${idPrefix}-end`} type="date" style={{ ...inputStyle, opacity: draft.noEnd ? 0.5 : 1 }} value={draft.noEnd ? '' : draft.end} disabled={draft.noEnd} min={draft.start || undefined} onChange={(e) => onChange({ ...draft, end: e.target.value })} aria-label="The day the schedule ends" />
        </label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', marginTop: 8, fontSize: '0.8rem' }}>
        <label htmlFor={`${idPrefix}-noend`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-700)', cursor: 'pointer' }}>
          <input id={`${idPrefix}-noend`} type="checkbox" checked={draft.noEnd} onChange={(e) => onChange({ ...draft, noEnd: e.target.checked })} />
          {SCHEDULE_NO_END_LABEL}
        </label>
        {words ? (
          <span style={{ color: 'var(--text-muted)' }} data-testid="bid-schedule-words">
            {words}
          </span>
        ) : null}
      </div>
      {showProblem && problem ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', marginTop: 6 }} data-testid="bid-schedule-problem">
          {problem}
        </div>
      ) : null}
    </div>
  )
}

export function BidScheduleSheet({ bidLabel, current, today, busy, onSave, onClose }: { bidLabel: string; /** The schedule the bid has now. */ current: BidScheduleDraft; today: string; busy: boolean; onSave: (columns: BidScheduleColumns) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<BidScheduleDraft>(current)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const problem = scheduleDraftProblem(draft)
  const has = current.start.trim() !== ''
  const unchanged = sameSchedule(draft, current)
  const dead = busy || !!problem || unchanged || !draft.start.trim()
  return (
    <div role="dialog" aria-modal="true" aria-label={`${bidLabel}’s schedule`} data-testid="bid-schedule-sheet" style={{ position: 'fixed', inset: 0, zIndex: 760, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + var(--app-top-chrome, 0px)) 16px 16px' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 'min(420px, 100%)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.14)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <strong style={{ fontSize: '0.98rem', color: 'var(--text-strong)' }}>{bidLabel}’s schedule</strong>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Type the day the promised schedule starts and the day it ends.</div>
        </div>
        <div style={{ padding: '12px 14px' }}>
          <BidScheduleFields
            draft={draft}
            onChange={(next) => {
              setTouched(true)
              setDraft(next)
            }}
            today={today}
            showProblem={touched}
            idPrefix="bid-schedule-sheet"
          />
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" disabled={dead} onClick={() => onSave(scheduleColumns(draft))} style={pressStyle(true, dead)} data-testid="bid-schedule-save">
            {busy ? 'Saving…' : 'Save the schedule'}
          </button>
          {has ? (
            <button type="button" disabled={busy} onClick={() => onSave(scheduleColumns(EMPTY_SCHEDULE))} style={pressStyle(false, busy)} data-testid="bid-schedule-remove">
              Remove the schedule
            </button>
          ) : null}
          <button type="button" onClick={onClose} style={pressStyle(false, false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
