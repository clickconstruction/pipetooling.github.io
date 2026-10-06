/**
 * GC mode design spike: the schedule as a list, the Gantt's Phase 5 (G-19, G-20). On a phone the
 * chart has no room for its weeks, so it opens as this: the stages of the job, the one running
 * today first, each a table of its bars with the dates, where each stands and a small bar in the
 * stage's span. It is a real table, so a screen reader reads it; anyone can switch to it.
 */
import { useState } from 'react'
import { daysBetween, shortDate, weekdayDate } from '../../lib/gcMode/gcModel'
import type { GanttBar, GanttGroup } from '../../lib/gcMode/gcGantt'
import { Chip } from './gcUi'

/** Saturated on purpose: the chart's status colors, the same in both themes. */
const C = { blue: '#3b82f6', green: '#16a34a', red: '#dc2626', amber: '#d97706', grey: '#9ca3af' }

const srOnly = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

export function GcGanttList({ groups, today, building, picked, onPick }: { groups: { group: GanttGroup; open: boolean; now: boolean }[]; today: string; building: boolean; picked: string | null; onPick: (lineId: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.filter((g) => g.open).map((g) => g.group.key)))
  const toggle = (key: string) =>
    setOpen((was) => {
      const next = new Set(was)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const bar = (b: GanttBar, g: GanttGroup) => {
    const span = Math.max(1, daysBetween(g.start, g.finish) + 1)
    const a = b.item.activity
    const left = (daysBetween(g.start, a.start) / span) * 100
    const width = Math.max(2, ((daysBetween(a.start, a.finish) + 1) / span) * 100)
    const todayAt = today >= g.start && today <= g.finish ? ((daysBetween(g.start, today) + 0.5) / span) * 100 : null
    return (
      <div aria-hidden style={{ position: 'relative', height: 8, background: 'var(--bg-muted)', borderRadius: 4 }}>
        <span style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 0, bottom: 0, borderRadius: 4, background: C[b.tone], opacity: b.status === 'done' ? 0.6 : 0.9 }} />
        {todayAt !== null && <span style={{ position: 'absolute', left: `${todayAt}%`, top: -2, bottom: -2, width: 2, background: C.blue }} />}
      </div>
    )
  }
  return (
    <div role="region" aria-label="The schedule as a list, by stage, the stage running today first" style={{ display: 'grid' }}>
      {groups.length === 0 && <div style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing on the schedule passes these filters.</div>}
      {groups.map(({ group: g, now }) => {
        const isOpen = open.has(g.key)
        return (
          <section key={g.key} style={{ borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(g.key)}
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', width: '100%', textAlign: 'left', background: 'var(--bg-subtle)', border: 'none', padding: '0.5rem 0.75rem', font: 'inherit', color: 'var(--text-base)', cursor: 'pointer' }}
            >
              <span aria-hidden style={{ width: '0.8rem', color: 'var(--text-muted)' }}>{isOpen ? '▾' : '▸'}</span>
              <strong>{g.title}</strong>
              {now && <Chip tone="blue">now</Chip>}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                {shortDate(g.start)} to {shortDate(g.finish)}
                {building ? ` · ${Math.round(g.pct)}%` : ''}
              </span>
              {g.late > 0 ? <Chip tone="amber">{g.late} behind</Chip> : g.held > 0 ? <Chip tone="amber">{g.held} held</Chip> : null}
            </button>
            {isOpen && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={srOnly}>Work</th>
                    <th style={srOnly}>Dates</th>
                    <th style={srOnly}>Where it stands</th>
                    <th style={srOnly}>Its place in the stage</th>
                  </tr>
                </thead>
                <tbody>
                  {g.bars.map((b) => {
                    const a = b.item.activity
                    const isPicked = picked === b.id
                    return (
                      <tr key={b.id} aria-selected={isPicked} style={{ borderTop: '1px solid var(--border)', background: isPicked ? 'var(--bg-blue-tint)' : undefined }}>
                        <td style={{ padding: '0.4rem 0.5rem 0.4rem 0.75rem', minWidth: 0 }}>
                          <button type="button" onClick={() => onPick(b.id)} aria-label={`${b.item.label}, ${b.item.company}. ${weekdayDate(a.start)} to ${weekdayDate(a.finish)}. ${b.statusWords}. Opens it.`} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }}>
                            {b.item.label}
                          </button>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{b.item.company}</div>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                          {shortDate(a.start)} to {shortDate(a.finish)}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <Chip tone={b.tone}>{b.statusWords}</Chip>
                        </td>
                        <td style={{ padding: '0.4rem 0.75rem 0.4rem 0.5rem', width: 88 }}>{bar(b, g)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )
      })}
    </div>
  )
}
