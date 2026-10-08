/**
 * GC mode, the real build, the schedule's PR 7a: the chart's lane of too many trades in one place
 * (G-83). The places card and the opened bar's place line come with the schedule's PR 9. Moved word
 * for word from the GC mode prototype (branch spike/gc-mode, `GcPlaces.tsx`); the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on that branch.
 */
import { useState, type CSSProperties } from 'react'
import { daysBetween } from '../../lib/gc/schedule/schedule'
import { PLACE_RULE, crowdedPlaces, crowdedSpells, type CrowdedWeek } from '../../lib/gc/schedule/places'
import { twoLines } from './gcBuildingCss'

/** Saturated on purpose, as the chart's own amber: the same in both themes. */
const AMBER = '#d97706'

/**
 * The chart's lane (G-83): a row for each place with a flagged week, under the dates the job must
 * meet. An amber band over each week's crowded days, the most at once after each run, and a hover
 * card with where, when, who, the people and the rule. The whole job, whatever is filtered or folded.
 */
export function GcCrowdedLane({ weeks, first, px, labelW, width, phone, rowH }: { weeks: CrowdedWeek[]; first: string; px: number; labelW: number; width: number; phone: boolean; rowH: number }) {
  const [hover, setHover] = useState<{ week: CrowdedWeek; x: number; y: number } | null>(null)
  const spells = crowdedSpells(weeks)
  const label: CSSProperties = { position: 'sticky', left: 0, zIndex: 3, width: labelW, minWidth: labelW, boxSizing: 'border-box', borderRight: '1px solid var(--border)', padding: '0 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', background: 'var(--surface)' }
  const x = (on: string) => daysBetween(first, on) * px
  return (
    <div data-crowded-lane="yes">
      {crowdedPlaces(weeks).map((place) => (
        <div key={place} data-crowded-place={place} style={{ display: 'flex', height: rowH, borderTop: '1px solid var(--border)' }}>
          <div style={label} title={PLACE_RULE}>
            <strong style={{ whiteSpace: 'nowrap' }}>{phone ? 'Crowded' : 'Too many in one place'}</strong>
            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(phone ? twoLines('0.8rem') : {}) }}>· {place}</span>
          </div>
          <div style={{ position: 'relative', width }}>
            {weeks
              .filter((w) => w.place === place)
              .map((w) => (
                <span
                  key={w.weekOf}
                  data-crowded-week={w.weekOf}
                  aria-label={w.words}
                  onMouseEnter={(e) => setHover({ week: w, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setHover({ week: w, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}
                  style={{ position: 'absolute', left: x(w.from), width: Math.max(px, (daysBetween(w.from, w.to) + 1) * px), top: (rowH - 10) / 2, height: 10, borderRadius: 5, boxSizing: 'border-box', border: `1.5px solid ${AMBER}`, background: 'var(--bg-amber-100)' }}
                />
              ))}
            {spells
              .filter((s) => s.place === place)
              .map((s) => (
                <span key={s.from} aria-hidden style={{ position: 'absolute', left: x(s.to) + px + 6, top: 0, height: rowH, display: 'flex', alignItems: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }}>
                  {s.most} trades
                </span>
              ))}
          </div>
        </div>
      ))}
      {hover && <CrowdedCard week={hover.week} at={hover} />}
    </div>
  )
}

/** One place and week, beside the pointer, in G-84's look: a label, then its lines. */
function CrowdedCard({ week, at }: { week: CrowdedWeek; at: { x: number; y: number } }) {
  const W = 320
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: Math.max(8, Math.min(at.x + 14, vw - W - 12)),
        top: at.y + 18 + 220 > vh ? Math.max(8, at.y - 230) : at.y + 18,
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
      <strong style={{ fontSize: '0.86rem', color: 'var(--text-amber-800)' }}>Too many in one place</strong>
      {week.rows.map((r) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '4.2rem minmax(0, 1fr)', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
          <span style={{ display: 'grid' }}>
            {r.lines.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}
