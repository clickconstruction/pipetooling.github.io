/**
 * GC mode design spike: people on site per week, the strip under the office's chart (G-84; the kernel
 * is `gcPeopleOnSite.ts`, the mock-up `to-dos/gc-mode/mockups/G-84.md`). Each week, the plan's busiest
 * day as an outlined bar and the daily log's busiest day as a filled one, their numbers above them
 * where the week is wide enough, and a card on hover with who made up the plan and where each count
 * came from. A week the log fell short of the plan by SHORT_BY or more reads amber. It draws inside
 * the chart's scroller, so it moves with the weeks; its name stays put like every row's.
 */
import { useState, type CSSProperties } from 'react'
import { daysBetween, weekdayDate } from '../../lib/gcMode/gcModel'
import type { PeopleWeek } from '../../lib/gcMode/gcPeopleOnSite'

/** Saturated on purpose, as the chart's own: the log in blue, a short week in amber, the same in both themes. */
const BLUE = '#3b82f6'
const AMBER = '#d97706'
const STRIP_H = 48
const BAR_MAX = 22

export function GcPeopleStrip({ weeks, first, px, labelW, width, phone }: { weeks: PeopleWeek[]; first: string; px: number; labelW: number; width: number; phone: boolean }) {
  const [hover, setHover] = useState<{ week: PeopleWeek; x: number; y: number } | null>(null)
  const most = Math.max(1, ...weeks.map((w) => Math.max(w.planned.count, w.logged?.count ?? 0)))
  const cellW = 7 * px
  const label: CSSProperties = { position: 'sticky', left: 0, zIndex: 3, width: labelW, minWidth: labelW, boxSizing: 'border-box', borderRight: '1px solid var(--border)', padding: '0 0.6rem', display: 'grid', alignContent: 'center', fontSize: '0.8rem', background: 'var(--bg-subtle)' }
  const height = (n: number) => Math.max(n > 0 ? 2 : 0, Math.round((n / most) * BAR_MAX))
  return (
    <div data-people-strip="yes" style={{ display: 'flex', height: STRIP_H, borderTop: '1px solid var(--border-strong)' }}>
      <div style={label} title="The whole job, whatever is filtered or folded.">
        <strong>{phone ? 'People' : 'People on site'}</strong>
        {!phone && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>the plan, then the daily log</span>}
      </div>
      <div style={{ position: 'relative', width, background: 'var(--bg-subtle)' }}>
        {weeks.map((w) => {
          const left = daysBetween(first, w.weekOf) * px
          const tone = w.short ? AMBER : BLUE
          const said = `Week of ${weekdayDate(w.weekOf)}: the plan has ${w.planned.count} at its busiest${w.logged ? `, the daily log ${w.logged.count}` : ''}.`
          return (
            <div
              key={w.weekOf}
              data-people-week={w.weekOf}
              data-planned={w.planned.count}
              data-logged={w.logged?.count ?? ''}
              aria-label={said}
              onMouseEnter={(e) => setHover({ week: w, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setHover({ week: w, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              style={{ position: 'absolute', left, width: cellW, top: 0, bottom: 0, borderLeft: '1px solid var(--border)', boxSizing: 'border-box' }}
            >
              {cellW >= 40 && (
                <span style={{ position: 'absolute', left: cellW * 0.12, width: cellW * 0.34, top: 3, textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{w.planned.count}</span>
              )}
              {cellW >= 40 && w.logged && (
                <span style={{ position: 'absolute', left: cellW * 0.54, width: cellW * 0.34, top: 3, textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, color: w.short ? 'var(--text-amber-800)' : 'var(--text-blue-800)', fontVariantNumeric: 'tabular-nums' }}>{w.logged.count}</span>
              )}
              <span aria-hidden style={{ position: 'absolute', left: cellW * 0.18, width: Math.max(2, cellW * 0.22), bottom: 4, height: height(w.planned.count), boxSizing: 'border-box', border: '1.5px solid var(--text-muted)', borderRadius: 2, background: 'var(--surface)' }} />
              {w.logged && <span aria-hidden style={{ position: 'absolute', left: cellW * 0.6, width: Math.max(2, cellW * 0.22), bottom: 4, height: height(w.logged.count), borderRadius: 2, background: tone, opacity: 0.85 }} />}
            </div>
          )
        })}
      </div>
      {hover && <PeopleCard week={hover.week} at={hover} />}
    </div>
  )
}

/** One week, beside the pointer: the plan's busiest day and who made it up, a company a line, the log's, and where the counts came from. */
function PeopleCard({ week, at }: { week: PeopleWeek; at: { x: number; y: number } }) {
  const W = 320
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: Math.max(8, Math.min(at.x + 14, vw - W - 12)),
        top: at.y + 18 + 200 > vh ? Math.max(8, at.y - 210) : at.y + 18,
        width: W,
        zIndex: 1300,
        pointerEvents: 'none',
        background: 'var(--surface)',
        color: 'var(--text-base)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        boxShadow: '0 10px 26px rgba(0,0,0,0.18)',
        padding: '0.6rem 0.7rem',
        fontSize: '0.78rem',
        display: 'grid',
        gap: '0.25rem',
      }}
    >
      <strong style={{ fontSize: '0.86rem' }}>Week of {weekdayDate(week.weekOf)}</strong>
      {week.rows.map((r) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '4.2rem minmax(0, 1fr)', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
          <div style={r.label === 'Short' ? { color: 'var(--text-amber-800)' } : undefined}>
            {r.lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
