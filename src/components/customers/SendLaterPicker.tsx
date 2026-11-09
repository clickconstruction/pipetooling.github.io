/**
 * When it goes (v2.6774, punch list #291 PR 4): the picker Send later opens over the Tell the customer sheet, the sheet
 * still open under it. Chips Now / Tomorrow 9:00 AM / Today 6:00 PM, a Day and a Time (8 AM to 9 PM in quarter hours),
 * the sentence *Goes Tuesday, Nov 10 at 9:00 AM Central, in about 17 hours.*, the fence and where the text waits, and
 * the press *Send Tuesday 9:00 AM*. Now hands back to the sheet's own send. The rules are `lib/offers/sendLater.ts`.
 * Escape closes this window alone, taken in the capture phase as Preview does.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { defaultSendAt, fenceHm, fieldsOf, isPast, SEND_LATER_WORDS, sendAtFrom, sendLaterChips, TIME_FIELD } from '../../lib/offers/sendLater'

export interface SendLaterPickerProps {
  first: string | null
  /** The instant the sheet's press named; the picker opens on it. */
  initialMs: number
  now: () => number
  busy?: boolean
  /** Send at the picked time. */
  onPick: (sendAtMs: number) => void
  /** The Now chip: the sheet's own send, now. */
  onNow: () => void
  onClose: () => void
  zIndex?: number
}

const chips: CSSProperties = { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.25rem 0 0.75rem' }
const chip: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.4rem 0.85rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', minHeight: 36 }
/** The chip that is on: a blue press under white words keeps its literal fill (`check:press-blue`). */
const chipOn: CSSProperties = { ...chip, background: '#2563eb', borderColor: '#2563eb', color: '#fff', fontWeight: 600 }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }
const field: CSSProperties = { display: 'grid', gap: '0.3rem' }
const fieldLabel: CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }
const input: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.75rem', font: 'inherit', fontSize: '0.9375rem', minHeight: 44, boxSizing: 'border-box', color: 'var(--text-strong)', background: 'var(--surface)' }
const note: CSSProperties = { background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.7rem 0.85rem', color: 'var(--text-700)', lineHeight: 1.5, display: 'grid', gap: '0.35rem', margin: '0.85rem 0 0', fontSize: '0.875rem' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }
const primaryBtn: CSSProperties = { minHeight: 46, padding: '0 1rem', borderRadius: 10, border: 'none', background: '#16a34a', color: 'white', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const secondaryBtn: CSSProperties = { minHeight: 46, padding: '0 0.9rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, cursor: 'pointer' }
const dead: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }
const warn: CSSProperties = { ...muted, color: 'var(--text-amber-800)', fontWeight: 600 }

export function SendLaterPicker({ first, initialMs, now, busy = false, onPick, onNow, onClose, zIndex = 1250 }: SendLaterPickerProps) {
  const start = useMemo(() => fieldsOf(initialMs), [initialMs])
  const [ymd, setYmd] = useState(start.ymd)
  const [time, setTime] = useState<string>(start.time)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const nowMs = now()
  const picked = sendAtFrom(ymd, time)
  const past = picked !== null && isPast(picked, nowMs)
  const canPick = picked !== null && !past && !busy
  const chipList = sendLaterChips(nowMs)
  const onChip = chipList.find((c) => c.atMs !== null && picked !== null && Math.abs(c.atMs - picked) < 60_000)?.key ?? null

  const footer = (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
      <button type="button" style={canPick ? primaryBtn : { ...primaryBtn, ...dead }} disabled={!canPick} onClick={() => picked !== null && onPick(picked)} data-testid="send-later-go">
        {busy ? 'Sending…' : picked !== null ? SEND_LATER_WORDS.send(picked, nowMs) : SEND_LATER_WORDS.send(defaultSendAt(nowMs), nowMs)}
      </button>
      <button type="button" style={secondaryBtn} disabled={busy} onClick={onClose} data-testid="send-later-back">
        {SEND_LATER_WORDS.back}
      </button>
    </div>
  )

  return (
    <ResponsiveModalShell title={SEND_LATER_WORDS.title} onRequestClose={onClose} footer={footer} zIndex={zIndex} maxWidthDesktop={480}>
      <div data-testid="send-later">
        <p style={{ ...muted, margin: 0 }}>{SEND_LATER_WORDS.subtitle(first)}</p>
        <div style={chips} role="group" aria-label={SEND_LATER_WORDS.title}>
          {chipList.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={c.key === onChip}
              style={c.key === onChip ? chipOn : chip}
              disabled={busy}
              onClick={() => {
                if (c.atMs === null) onNow()
                else {
                  const f = fieldsOf(c.atMs)
                  setYmd(f.ymd)
                  setTime(f.time)
                }
              }}
              data-testid={`send-later-chip-${c.key}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div style={grid}>
          <label style={field}>
            <span style={fieldLabel}>{SEND_LATER_WORDS.day}</span>
            <input type="date" style={input} value={ymd} disabled={busy} onChange={(e) => setYmd(e.target.value)} data-testid="send-later-day" />
          </label>
          <label style={field}>
            <span style={fieldLabel}>{SEND_LATER_WORDS.time}</span>
            <input type="time" style={input} value={time} min={TIME_FIELD.min} max={TIME_FIELD.max} step={TIME_FIELD.step} disabled={busy} onChange={(e) => setTime(e.target.value)} onBlur={(e) => setTime(fenceHm(e.target.value))} data-testid="send-later-time" />
          </label>
        </div>
        <div style={note}>
          <div data-testid="send-later-goes">{picked !== null ? SEND_LATER_WORDS.goes(picked, nowMs) : SEND_LATER_WORDS.fence}</div>
          <div>{SEND_LATER_WORDS.fence}</div>
          <div>{SEND_LATER_WORDS.where}</div>
        </div>
        {past ? (
          <p role="alert" style={warn} data-testid="send-later-past">
            {SEND_LATER_WORDS.past}
          </p>
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}
