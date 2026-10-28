/**
 * GC mode, the real build, the schedule's PR 7a: the schedule as a list, which a phone opens with
 * (G-19, G-20). Moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `GcGanttList.tsx`); the plan is to-dos/gc-mode/mockups/schedule-pr7.md on that branch.
 */
import { useState } from 'react'
import { daysBetween } from '../../lib/gc/schedule/schedule'
import { shortDate, weekdayDate } from '../../lib/gc/words'
import { Link, useInRouterContext } from 'react-router-dom'
import { noCompanyYet, type GanttBar, type GanttGroup } from '../../lib/gc/schedule/gantt'
import { tradePartnersHref } from '../../lib/prospects/gcNeeds'
import { customerBarWords } from '../../lib/gc/schedule/customerSchedule'
import { Chip } from './gcUi'
import { EmptyState, type EmptyStateWords } from '../EmptyState'

/** Saturated on purpose: the chart's status colors, the same in both themes. */
const C = { blue: '#3b82f6', green: '#16a34a', red: '#dc2626', amber: '#d97706', grey: '#9ca3af' }

const srOnly = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/** What the list says when nothing passes: the chart's own words, with its Show all (punch list #184). */
const NOTHING_PASSES: EmptyStateWords = { main: 'Nothing on the schedule passes these filters.' }


export function GcGanttList({ groups, today, building, picked, onPick, plain, empty = NOTHING_PASSES }: { groups: { group: GanttGroup; open: boolean; now: boolean }[]; today: string; building: boolean; picked: string | null; onPick: (lineId: string) => void; /** For a customer: no company, no spare days, and a row opens nothing. */ plain?: boolean; /** The empty list's words and press, the chart's own. Unset: the filter sentence alone. */ empty?: EmptyStateWords }) {
  // The door to Trade partners is the router's link where there is one, else a plain anchor (the window's tests render with none).
  const inRouter = useInRouterContext()
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
    <div role="region" aria-label="The schedule as a list, by stage or phase, the one running today first" style={{ display: 'grid' }}>
      {groups.length === 0 && <EmptyState compact {...empty} />}
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
                    {!plain && <th style={srOnly}>Days</th>}
                    {!plain && <th style={srOnly}>Spare days</th>}
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
                          {plain ? (
                            <span>{b.item.label}</span>
                          ) : (
                            <button type="button" onClick={() => onPick(b.id)} aria-label={`${b.item.label}, ${b.item.company}. ${weekdayDate(a.start)} to ${weekdayDate(a.finish)}. ${b.statusWords}. Opens it.`} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }}>
                              {b.item.label}
                            </button>
                          )}
                          {!plain && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              {noCompanyYet(b) ? (
                                // A template's row for a trade the job has no company for yet (#204, call 7): the door to Trade partners at that trade.
                                inRouter ? (
                                  <Link to={tradePartnersHref(noCompanyYet(b) ?? '')} style={{ color: 'var(--text-link)' }}>
                                    No company yet. Open Trade partners.
                                  </Link>
                                ) : (
                                  <a href={tradePartnersHref(noCompanyYet(b) ?? '')} style={{ color: 'var(--text-link)' }}>
                                    No company yet. Open Trade partners.
                                  </a>
                                )
                              ) : (
                                b.item.company
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                          {shortDate(a.start)} to {shortDate(a.finish)}
                        </td>
                        {!plain && (
                          <td title="Days, both ends counted" style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {daysBetween(a.start, a.finish) + 1}d
                          </td>
                        )}
                        {!plain && (
                          <td title="Spare days before it holds up the finish" style={{ padding: '0.4rem 0.5rem', color: b.spare === 0 && b.status !== 'done' ? 'var(--text-red-700)' : 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {b.status === 'done' ? '' : `${b.spare} spare`}
                          </td>
                        )}
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <Chip tone={plain ? customerBarWords(b).tone : b.tone}>{plain ? customerBarWords(b).words : b.statusWords}</Chip>
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
