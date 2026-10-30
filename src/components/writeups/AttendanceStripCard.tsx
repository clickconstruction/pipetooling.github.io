import { useState, type CSSProperties } from 'react'
import {
  ATTENDANCE_RECENT_DAYS,
  ATTENDANCE_STRIP_DAYS,
  type AttendanceCountChip,
  type AttendanceStrip,
  type AttendanceStripDay,
} from '../../lib/people/attendanceStrip'

/**
 * The Write-ups attendance card (v2.6140, punch list #217, people-docs-3): the kernel's ninety days
 * drawn as columns, the counts as chips at the head with their words on hover, a press on a day
 * opening its receipt under the strip, and the tardiness write-up's door when the recent run
 * holds enough unexcused lates. Reads `attendanceStrip` only; theme tokens, so it follows light
 * and dark. Saturated status colours stay literal through the tokens the app already names.
 */

type Props = {
  personName: string
  strip: AttendanceStrip
  /** Opens the tardiness write-up prefilled with the strip's context lines. */
  onStartWriteup?: () => void
}

const AMBER = 'var(--text-amber-800)'
const RED = 'var(--text-red-700)'

function dotStyle(d: AttendanceStripDay): CSSProperties | null {
  const base: CSSProperties = { display: 'block', boxSizing: 'border-box', flex: 'none', borderRadius: '50%' }
  switch (d.kind) {
    case 'onTime':
      return { ...base, width: 7, height: 7, background: 'var(--surface)', border: '1.5px solid var(--border-strong)' }
    case 'noClockIn':
      return { ...base, width: 7, height: 7, background: 'transparent', border: '1.5px dotted var(--text-faint)' }
    case 'late': {
      const px = d.size === 'big' ? 11 : d.size === 'mid' ? 9 : 7
      return { ...base, width: px, height: px, background: AMBER }
    }
    case 'excused':
      return { ...base, width: 9, height: 2, borderRadius: 0, background: 'var(--text-faint)', transform: 'rotate(-45deg)' }
    case 'ncns':
      return { ...base, width: 9, height: 9, borderRadius: 1, background: RED, transform: 'rotate(45deg)' }
    case 'none':
      return null
  }
}

function chipColor(c: AttendanceCountChip): string {
  if (c.tone === 'warn') return AMBER
  if (c.tone === 'stop') return RED
  if (c.tone === 'ok') return 'var(--text-green-700)'
  return 'var(--text-muted)'
}

const chipStyle: CSSProperties = { fontSize: '0.72rem', fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: 'var(--bg-muted)', whiteSpace: 'nowrap' }

export function AttendanceStripCard({ personName, strip, onStartWriteup }: Props) {
  const [pressedYmd, setPressedYmd] = useState<string | null>(null)
  const pressed = pressedYmd ? strip.days.find((d) => d.ymd === pressedYmd) ?? null : null
  const n = strip.days.length

  return (
    <div data-attendance-strip-card style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
          Attendance — {personName}, last {ATTENDANCE_STRIP_DAYS} days
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>derived from clock records</span>
        <span data-attendance-strip-chips style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
          {strip.chips.map((c) => (
            <span key={c.key} data-attendance-strip-chip={c.key} title={c.words} aria-label={c.words} style={{ ...chipStyle, color: chipColor(c) }}>
              {c.text}
            </span>
          ))}
        </span>
      </div>

      {strip.salaried ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Salaried. Clock sessions are made at schedule time, so no day is marked late or on time.
        </p>
      ) : null}

      <div data-attendance-strip title={strip.words} style={{ marginTop: '0.6rem', minWidth: 0 }}>
        <div role="group" aria-label={strip.words} style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: 1, alignItems: 'end', height: 40 }}>
          {strip.days.map((d) => {
            const dot = dotStyle(d)
            const isPressed = d.ymd === pressedYmd
            return (
              <button
                key={d.ymd}
                type="button"
                data-attendance-strip-day={d.ymd}
                data-kind={d.kind}
                data-size={d.size ?? undefined}
                data-today={d.today ? 'yes' : undefined}
                data-recent={d.recent ? 'yes' : undefined}
                aria-label={d.words}
                aria-pressed={d.receipt ? isPressed : undefined}
                title={d.words}
                onClick={d.receipt ? () => setPressedYmd(isPressed ? null : d.ymd) : undefined}
                style={{
                  display: 'grid',
                  alignContent: 'center',
                  justifyItems: 'center',
                  height: '100%',
                  padding: 0,
                  border: 0,
                  borderRadius: 3,
                  background: d.today ? 'var(--bg-blue-tint)' : d.recent ? 'var(--bg-amber-100)' : d.weekend ? 'var(--bg-subtle)' : 'transparent',
                  outline: isPressed ? '2px solid var(--text-blue-800)' : d.today ? '1px solid var(--text-blue-800)' : undefined,
                  outlineOffset: isPressed ? -1 : undefined,
                  cursor: d.receipt ? 'pointer' : 'default',
                  minWidth: 0,
                }}
              >
                {dot ? <span aria-hidden style={dot} /> : null}
              </button>
            )
          })}
        </div>
        <div aria-hidden data-attendance-strip-labels style={{ position: 'relative', height: 14, marginTop: 3, fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {strip.labels.map((l) => {
            const left = l.align === 'left' ? (l.index / n) * 100 : l.align === 'right' ? ((l.index + 1) / n) * 100 : ((l.index + 0.5) / n) * 100
            return (
              <span
                key={`${l.index}-${l.text}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${left}%`,
                  transform: l.align === 'left' ? undefined : l.align === 'right' ? 'translateX(-100%)' : 'translateX(-50%)',
                  color: l.tone === 'hot' ? AMBER : l.tone === 'today' ? 'var(--text-blue-800)' : undefined,
                  fontWeight: l.tone === 'muted' ? undefined : 700,
                }}
              >
                {l.text}
              </span>
            )
          })}
        </div>
      </div>

      {pressed?.receipt ? (
        <div data-attendance-strip-receipt role="region" aria-label={`Receipt for ${pressed.receipt.heading}`} style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', padding: '0.45rem 0.7rem', fontSize: '0.8125rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{pressed.receipt.heading}</div>
            {pressed.receipt.lines.map((line, i) => (
              <div key={i} style={{ color: 'var(--text-muted)' }}>{line}</div>
            ))}
          </div>
          <button
            type="button"
            aria-label="Close the receipt"
            onClick={() => setPressedYmd(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      ) : null}

      <div aria-hidden style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.68rem', color: 'var(--text-muted)', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', border: '1.5px solid var(--border-strong)', background: 'var(--surface)' }} /> scheduled, on time</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: AMBER }} /> late, sized by minutes</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ display: 'inline-block', width: 8, height: 8, background: RED, transform: 'rotate(45deg)' }} /> no call, no show</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ display: 'inline-block', width: 9, height: 2, background: 'var(--text-faint)', transform: 'rotate(-45deg)' }} /> excused</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', border: '1.5px dotted var(--text-faint)' }} /> scheduled, no clock-in</span>
      </div>

      {strip.warn ? (
        <div style={{ marginTop: '0.6rem', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.45rem 0.7rem', fontSize: '0.8125rem', color: AMBER, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span><strong>{strip.counts.recentLate} unexcused lates in the last {ATTENDANCE_RECENT_DAYS} days.</strong></span>
          {onStartWriteup ? (
            <button
              type="button"
              onClick={onStartWriteup}
              style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem', padding: 0 }}
            >
              Start a tardiness write-up →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
