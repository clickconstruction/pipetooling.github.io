/**
 * Messages, cut 2's screens, PR C2: a day as the prototype picks one (its `daychips` row): a chip for tomorrow and each
 * of the five days after, *A week* and *Two weeks* (`dayChips`), and a typed day with its read-back. Words that are not
 * a day are kept as words (`dayKept`), never refused. The owed strip's *when* and a note's day to come back pick with it.
 */
import { useState, type CSSProperties } from 'react'
import { dayChips, dayKept, readDay, readDayEcho, type DayKept } from '../../lib/messages/owed'
import { clauseInputStyle } from '../contracts/clauseStyles'

const chipStyle = (on: boolean): CSSProperties => ({
  display: 'inline-grid',
  justifyItems: 'center',
  padding: '0.25rem 0.5rem',
  borderRadius: 8,
  border: `1px solid ${on ? '#2563eb' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: 'var(--text-base)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.78rem',
  lineHeight: 1.2,
})

export function DayPicker({ todayYmd, chosen, onPick, typedLabel }: { todayYmd: string; chosen: DayKept | null; onPick: (day: DayKept) => void; typedLabel: string }) {
  const [typed, setTyped] = useState('')
  const echo = readDayEcho(typed, todayYmd)
  return (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {dayChips(todayYmd).map((d) => {
        const on = chosen?.ymd === d.ymd
        return (
          <button key={d.ymd} type="button" aria-pressed={on} aria-label={d.label} onClick={() => onPick({ ymd: d.ymd, words: null })} style={chipStyle(on)}>
            <b>{d.top}</b>
            <span style={{ color: 'var(--text-muted)' }}>{d.sub}</span>
          </button>
        )
      })}
      <span style={{ display: 'inline-grid', gap: 2, flex: '1 1 14rem' }}>
        <input
          aria-label={typedLabel}
          value={typed}
          placeholder="or type a day: Fri, Oct 16, in two weeks"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !typed.trim()) return
            e.preventDefault()
            onPick(dayKept(readDay(typed, todayYmd)))
            setTyped('')
          }}
          style={{ ...clauseInputStyle, padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
        />
        {echo && (
          <span aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            {echo}
          </span>
        )}
      </span>
    </div>
  )
}
