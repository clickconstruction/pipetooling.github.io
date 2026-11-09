/**
 * Draw your week (design spike): seven columns, Sunday to Saturday, half-hour cells from 5 AM to
 * 8 PM. Press and sweep to paint the hours you can work; sweep over painted cells to erase them.
 * A day's name toggles the whole day. A day's chip under the grid opens two time boxes for an
 * exact start and end. Presets fill the usual weeks. The total and the week in words follow
 * every stroke, so the drawing is never a guess. Pure drawing over `WeekDays`; the kernel is
 * `lib/people/weekAvailability.ts`.
 */
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import {
  DEFAULT_WEEK,
  describeSegments,
  describeWeek,
  emptyWeek,
  formatClockShort,
  PAINT_SLOTS,
  PAINT_START_HOUR,
  paintRect,
  setDayRange,
  SLOT_MINUTES,
  slotsFromSegments,
  toggleDay,
  weekHours,
  WEEKDAY_SHORT,
  type Cell,
  type WeekDays,
} from '../../lib/people/weekAvailability'

const LABEL_W = 40
const MUTED: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const PRESS: CSSProperties = { padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const PAINT = '#2563eb'

type Preset = { label: string; days: () => WeekDays }
const PRESETS: Preset[] = [
  { label: 'Mon–Fri 7a–3p', days: () => DEFAULT_WEEK.map((d) => d.map(([s, e]) => [s, e])) },
  { label: 'Mon–Fri 7a–3:30p', days: () => [[], ...[1, 2, 3, 4, 5].map(() => [[7 * 60, 15 * 60 + 30]] as [number, number][]), []] },
  { label: 'Mon–Thu 7a–5p', days: () => [[], ...[1, 2, 3, 4].map(() => [[7 * 60, 17 * 60]] as [number, number][]), [], []] },
  { label: 'Clear', days: () => emptyWeek() },
]

function minutesToTimeValue(min: number): string {
  const h = Math.floor(min / 60) % 24
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
function timeValueToMinutes(v: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function WeekAvailabilityPainter({ value, onChange, rowHeight = 14 }: { value: WeekDays; onChange: (days: WeekDays) => void; rowHeight?: number }) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<{ anchor: Cell; current: Cell; on: boolean } | null>(null)
  const [editDay, setEditDay] = useState<number | null>(null)
  const shown = useMemo(() => (drag ? paintRect(value, drag.anchor, drag.current, drag.on) : value), [value, drag])
  const slotsByDay = useMemo(() => shown.map((segs) => slotsFromSegments(segs)), [shown])
  const total = weekHours(shown)

  const cellAt = (e: ReactPointerEvent): Cell | null => {
    const el = gridRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left - LABEL_W
    const y = e.clientY - r.top
    const colW = (r.width - LABEL_W) / 7
    if (x < 0 || y < 0) return null
    const day = Math.min(6, Math.max(0, Math.floor(x / colW)))
    const slot = Math.min(PAINT_SLOTS - 1, Math.max(0, Math.floor(y / rowHeight)))
    return { day, slot }
  }
  const onDown = (e: ReactPointerEvent) => {
    const cell = cellAt(e)
    if (!cell) return
    e.preventDefault()
    gridRef.current?.setPointerCapture(e.pointerId)
    const on = !(slotsByDay[cell.day]?.[cell.slot] ?? false)
    setDrag({ anchor: cell, current: cell, on })
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return
    const cell = cellAt(e)
    if (!cell || (cell.day === drag.current.day && cell.slot === drag.current.slot)) return
    setDrag({ ...drag, current: cell })
  }
  const onUp = () => {
    if (!drag) return
    onChange(paintRect(value, drag.anchor, drag.current, drag.on))
    setDrag(null)
  }

  const hourRows = Array.from({ length: PAINT_SLOTS / (60 / SLOT_MINUTES) }, (_, i) => PAINT_START_HOUR + i)

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={MUTED}>Start from</span>
        {PRESETS.map((p) => (
          <button key={p.label} type="button" style={PRESS} onClick={() => onChange(p.days())}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `${LABEL_W}px repeat(7, minmax(0, 1fr))`, gap: 0, alignItems: 'end' }}>
        <span />
        {WEEKDAY_SHORT.map((name, d) => {
          const hours = weekHours([shown[d] ?? []])
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(toggleDay(value, d))}
              title={shown[d]?.length ? `Turn ${name} off` : `Give ${name} the usual day`}
              style={{ border: 'none', background: 'none', padding: '0 0 4px', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 1, color: 'var(--text-strong)', font: 'inherit' }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{name}</span>
              <span style={{ ...MUTED, fontSize: '0.68rem', fontVariantNumeric: 'tabular-nums' }}>{hours ? `${hours} h` : 'off'}</span>
            </button>
          )
        })}
      </div>

      <div
        ref={gridRef}
        role="img"
        aria-label={`Hours you can work, ${describeWeek(shown)}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
        style={{ position: 'relative', display: 'grid', gridTemplateColumns: `${LABEL_W}px repeat(7, minmax(0, 1fr))`, gridTemplateRows: `repeat(${PAINT_SLOTS}, ${rowHeight}px)`, touchAction: 'none', userSelect: 'none', cursor: 'crosshair', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}
      >
        {hourRows.map((hour, i) => (
          <span key={hour} style={{ gridColumn: 1, gridRow: `${i * 2 + 1} / span 2`, ...MUTED, fontSize: '0.68rem', paddingLeft: 4, lineHeight: 1, alignSelf: 'start', marginTop: -1, fontVariantNumeric: 'tabular-nums' }}>
            {formatClockShort(hour * 60)}
          </span>
        ))}
        {Array.from({ length: PAINT_SLOTS }, (_, slot) =>
          WEEKDAY_SHORT.map((_, day) => {
            const on = slotsByDay[day]?.[slot] ?? false
            const hourLine = slot % 2 === 0
            return (
              <div
                key={`${day}-${slot}`}
                aria-hidden
                style={{
                  gridColumn: day + 2,
                  gridRow: slot + 1,
                  background: on ? PAINT : 'var(--bg-subtle)',
                  opacity: on && drag ? 0.85 : 1,
                  borderTop: `1px solid ${hourLine ? 'var(--border)' : 'transparent'}`,
                  borderLeft: '1px solid var(--surface)',
                  boxSizing: 'border-box',
                }}
              />
            )
          }),
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {WEEKDAY_SHORT.map((name, d) => {
          const open = editDay === d
          return (
            <button key={name} type="button" onClick={() => setEditDay(open ? null : d)} aria-expanded={open} style={{ ...PRESS, background: open ? 'var(--bg-subtle)' : 'var(--surface)', fontWeight: 500 }}>
              {name} {describeSegments(shown[d] ?? [])}
            </button>
          )
        })}
      </div>
      {editDay != null ? (
        <DayTimes
          name={WEEKDAY_SHORT[editDay]!}
          start={shown[editDay]?.[0]?.[0] ?? 7 * 60}
          end={shown[editDay]?.[shown[editDay]!.length - 1]?.[1] ?? 15 * 60}
          onSet={(s, e) => onChange(setDayRange(value, editDay, s, e))}
          onOff={() => onChange(setDayRange(value, editDay, 0, 0))}
        />
      ) : null}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{total} h a week</span>
        <span style={MUTED}>{describeWeek(shown)}</span>
      </div>
      <span style={{ ...MUTED, fontSize: '0.7rem' }}>Press and sweep to paint the hours you can work. Sweep over blue to erase. A day&apos;s name turns the whole day on or off.</span>
    </div>
  )
}

function DayTimes({ name, start, end, onSet, onOff }: { name: string; start: number; end: number; onSet: (start: number, end: number) => void; onOff: () => void }) {
  const [s, setS] = useState(minutesToTimeValue(start))
  const [e, setE] = useState(minutesToTimeValue(end))
  const sm = timeValueToMinutes(s)
  const em = timeValueToMinutes(e)
  const ok = sm != null && em != null && em > sm
  const input: CSSProperties = { padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.875rem' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.5rem 0.7rem' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>{name}</span>
      <label style={MUTED}>
        from{' '}
        <input type="time" step={1800} value={s} onChange={(ev) => setS(ev.target.value)} style={input} aria-label={`${name} start`} />
      </label>
      <label style={MUTED}>
        to{' '}
        <input type="time" step={1800} value={e} onChange={(ev) => setE(ev.target.value)} style={input} aria-label={`${name} end`} />
      </label>
      <button type="button" disabled={!ok} onClick={() => ok && onSet(sm, em)} style={{ ...PRESS, background: ok ? PAINT : 'var(--bg-subtle)', color: ok ? '#fff' : 'var(--text-muted)', borderColor: ok ? PAINT : 'var(--border-strong)' }}>
        Set {name}
      </button>
      <button type="button" onClick={onOff} style={PRESS}>
        {name} off
      </button>
    </div>
  )
}
