import { useState } from 'react'
import { HISTORY_RANGE_PRESETS, presetRange, rangeCaption, rangeDateParts, rangePreset } from '../../lib/jobs/historyRangeBar'

/**
 * The History tab's range on a phone (v2.3237): one bar instead of the job
 * search box, the From / To inputs, the preset chips and the summary line.
 * Top line: the dates as "Mar 14–Sep 10" (wraps only after the dash), the
 * 90d / 180d / 365d presets as a segmented control, Edit. Bottom line: the
 * caption, centered. Edit reveals the same two native date inputs under the
 * bar; picking a preset hides them again.
 */
type Props = {
  start: string
  end: string
  todayYmd: string
  daysWorked: number
  maxPeople: number
  onChange: (start: string, end: string) => void
}

export function HistoryRangeBar({ start, end, todayYmd, daysWorked, maxPeople, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const preset = rangePreset(start, end, todayYmd)
  const dates = rangeDateParts(start, end, todayYmd)
  const invalid = !start || !end || start > end
  return (
    <div data-testid="history-range-bar" style={{ marginBottom: '0.5rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto auto',
          gridTemplateAreas: '"when seg edit" "cap cap cap"',
          alignItems: 'center',
          columnGap: '0.5rem',
          rowGap: '0.35rem',
          border: `1px solid ${editing ? 'var(--text-blue-500, #3b82f6)' : 'var(--border)'}`,
          borderRadius: 12,
          padding: '0.5rem 0.6rem 0.5rem 0.75rem',
          background: 'var(--bg-subtle)',
        }}
      >
        <span style={{ gridArea: 'when', minWidth: 0, color: 'var(--text-strong)', fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.2 }}>
          <span style={{ whiteSpace: 'nowrap' }}>{dates.from}–</span>
          <wbr />
          <span style={{ whiteSpace: 'nowrap' }}>{dates.to}</span>
        </span>
        <span role="group" aria-label="Range presets" style={{ gridArea: 'seg', display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden', background: 'var(--surface)' }}>
          {HISTORY_RANGE_PRESETS.map((n, i) => {
            const on = preset === n
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const r = presetRange(n, todayYmd)
                  onChange(r.start, r.end)
                  setEditing(false)
                }}
                style={{
                  font: 'inherit',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.3rem 0.5rem',
                  border: 0,
                  borderRight: i < HISTORY_RANGE_PRESETS.length - 1 ? '1px solid var(--border)' : 0,
                  background: on ? 'var(--text-blue-500, #3b82f6)' : 'transparent',
                  color: on ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {n}d
              </button>
            )
          })}
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          style={{ gridArea: 'edit', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 0, padding: '0.2rem 0.1rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {editing ? 'Done' : 'Edit'}
        </button>
        <span style={{ gridArea: 'cap', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', borderTop: '1px solid var(--border)', paddingTop: '0.35rem' }}>
          {invalid ? 'Pick both dates to set the range.' : rangeCaption({ start, end, todayYmd, daysWorked, maxPeople })}
        </span>
      </div>
      {editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '0.5rem 0 0.1rem' }}>
          <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }}>
            From
            <input
              type="date"
              value={start}
              max={end || undefined}
              onChange={(e) => onChange(e.target.value, end)}
              style={{ display: 'block', width: '100%', marginTop: '0.2rem', font: 'inherit', fontSize: '0.95rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }}
            />
          </label>
          <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }}>
            To
            <input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => onChange(start, e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '0.2rem', font: 'inherit', fontSize: '0.95rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
