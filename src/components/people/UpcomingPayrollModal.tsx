import { useMemo, useState, type CSSProperties } from 'react'
import { AmountSmallCents } from '../AmountSmallCents'
import type { UpcomingPayrollLine } from '../../lib/upcomingPayrollSummary'
import {
  groupUpcomingPayrollByPerson,
  nextUpcomingSort,
  parseUpcomingSort,
  sortUpcomingGroups,
  toggleExcluded,
  upcomingTotals,
  type UpcomingSort,
  type UpcomingSortKey,
} from '../../lib/upcomingPayrollGroups'

export type UpcomingPayrollModalProps = {
  /** The summary's person-weeks (people A → Z, weeks oldest first). */
  lines: UpcomingPayrollLine[]
  /** Pre-formatted current pay week, e.g. "8/30–9/5 (w36)". */
  currentWeekLabel: string
  /** Period formatter — lives in the Payroll tab (ledger short label). */
  formatPeriod: (startYmd: string, endYmd: string) => string
  zIndex: number
  onClose: () => void
  /** Period click → the per-day session drilldown (nested above this modal). */
  onOpenWeek: (line: UpcomingPayrollLine) => void
}

/** Sort order survives per browser; the exclusion set is a what-if and resets on close. */
const SORT_STORAGE_KEY = 'people_payroll_upcoming_sort_v1'

function readStoredSort(): UpcomingSort {
  try {
    return parseUpcomingSort(typeof window !== 'undefined' ? window.localStorage.getItem(SORT_STORAGE_KEY) : null)
  } catch {
    return parseUpcomingSort(null)
  }
}

function writeStoredSort(sort: UpcomingSort): void {
  try {
    window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort))
  } catch {
    // Private mode / blocked storage — the sort still applies for this open.
  }
}

const SORT_LABEL: Record<UpcomingSortKey, string> = { gross: 'Amount', name: 'Name', hours: 'Hours' }

const cellRight: CSSProperties = { padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const linkButton: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'var(--text-link)',
  textDecoration: 'underline dotted',
  textUnderlineOffset: '2px',
  cursor: 'pointer',
}

/**
 * "Upcoming payroll — not yet reported": a chip rail summarizing each person's estimated gross
 * over a per-person grouped table (subtotal row + that person's weeks, foldable). Tapping a chip
 * or the checkbox on a group row excludes that person from the totals as a what-if — they stay
 * visible, struck through, and the header names how many are out and by how much. Sorting by
 * Amount / Name / Hours reorders chips and groups together; weeks never leave their person.
 */
export function UpcomingPayrollModal({ lines, currentWeekLabel, formatPeriod, zIndex, onClose, onOpenWeek }: UpcomingPayrollModalProps) {
  const [sort, setSort] = useState<UpcomingSort>(readStoredSort)
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set())
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set())

  const groups = useMemo(() => sortUpcomingGroups(groupUpcomingPayrollByPerson(lines), sort), [lines, sort])
  const totals = useMemo(() => upcomingTotals(groups, excluded), [groups, excluded])
  const allFolded = groups.length > 0 && groups.every((g) => folded.has(g.personName))

  const changeSort = (key: UpcomingSortKey) => {
    setSort((prev) => {
      const next = nextUpcomingSort(prev, key)
      writeStoredSort(next)
      return next
    })
  }
  const toggle = (personName: string) => setExcluded((prev) => toggleExcluded(prev, personName))
  const toggleFold = (personName: string) =>
    setFolded((prev) => {
      const next = new Set(prev)
      if (next.has(personName)) next.delete(personName)
      else next.add(personName)
      return next
    })
  const foldAll = () => setFolded(allFolded ? new Set() : new Set(groups.map((g) => g.personName)))
  const openPerson = (personName: string) => {
    setFolded((prev) => {
      if (!prev.has(personName)) return prev
      const next = new Set(prev)
      next.delete(personName)
      return next
    })
    // Next frame: the group row exists once the fold state has rendered.
    window.requestAnimationFrame(() => {
      document.getElementById(groupRowId(personName))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  const sortHeader = (key: UpcomingSortKey, label: string, align: 'left' | 'right') => {
    const active = sort.key === key
    return (
      <th style={{ padding: 0, textAlign: align, whiteSpace: 'nowrap' }} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => changeSort(key)}
          title={`Sort by ${label.toLowerCase()}`}
          style={{
            width: '100%',
            padding: '0.5rem 0.65rem',
            textAlign: align,
            background: 'none',
            border: 'none',
            font: 'inherit',
            fontWeight: 600,
            color: active ? 'var(--text-link)' : 'inherit',
            cursor: 'pointer',
          }}
        >
          {label}
          <span aria-hidden="true" style={{ display: 'inline-block', width: '1em', fontSize: '0.65em', color: active ? 'var(--text-link)' : 'var(--text-faint)', marginLeft: 2 }}>
            {active ? (sort.dir === 1 ? '▲' : '▼') : ''}
          </span>
        </button>
      </th>
    )
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upcoming-payroll-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 640,
          width: '100%',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header: title, current week, the live total line */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="upcoming-payroll-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
              Upcoming payroll — not yet reported
            </h2>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>Current week: {currentWeekLabel}</p>
            <p
              style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}
              title="Clocked time (including pending approval) with no pay report covering the week — estimate is hours × wage. Use Draft Payroll to generate these reports."
              aria-live="polite"
            >
              {totals.personWeeks} person-week{totals.personWeeks === 1 ? '' : 's'} ·{' '}
              <strong style={{ color: 'var(--text-strong)' }}>
                <AmountSmallCents value={totals.estimatedGrossDollars} />
              </strong>{' '}
              estimated
              {totals.excludedPeople > 0 ? (
                <span style={{ color: 'var(--text-amber-700)' }}>
                  {' · '}
                  {totals.excludedPeople} excluded, −<AmountSmallCents value={totals.excludedGrossDollars} />
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{ padding: '0.35rem 0.65rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            ×
          </button>
        </div>

        {/* Chip rail: one chip per person — tap to exclude/include, ▾ opens their weeks */}
        <div
          role="group"
          aria-label="People in this estimate — tap a name to leave them out"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}
        >
          {groups.map((g) => {
            const off = excluded.has(g.personName)
            return (
              <span
                key={g.personName}
                style={{
                  display: 'inline-flex',
                  alignItems: 'stretch',
                  border: `1px ${off ? 'dashed' : 'solid'} var(--border-strong)`,
                  borderRadius: 999,
                  background: off ? 'transparent' : 'var(--surface)',
                  color: off ? 'var(--text-muted)' : 'var(--text-base)',
                  overflow: 'hidden',
                  fontSize: '0.78rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggle(g.personName)}
                  aria-pressed={!off}
                  title={off ? `Include ${g.personName} in the estimate` : `Leave ${g.personName} out of the estimate`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: '0.375rem',
                    padding: '0.25rem 0.5rem 0.25rem 0.6rem',
                    background: 'none',
                    border: 'none',
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <span>{g.personName}</span>
                  <span
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: off ? 400 : 600,
                      textDecorationLine: off ? 'line-through' : 'none',
                      textDecorationColor: 'var(--text-amber-700)',
                    }}
                  >
                    <AmountSmallCents value={g.estimatedGrossDollars} />
                  </span>
                  <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>{g.weekCount}w</span>
                </button>
                <button
                  type="button"
                  onClick={() => openPerson(g.personName)}
                  title={`Open ${g.personName}'s weeks`}
                  aria-label={`Open ${g.personName}'s weeks`}
                  style={{
                    padding: '0 0.45rem',
                    background: off ? 'transparent' : 'var(--bg-subtle)',
                    border: 'none',
                    borderLeft: '1px solid var(--border)',
                    font: 'inherit',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  ▾
                </button>
              </span>
            )
          })}
        </div>

        {/* Tools: sort chooser + fold / include-everyone */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 1.25rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            Sort
            <span role="group" aria-label="Sort people by" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 5, overflow: 'hidden' }}>
              {(['gross', 'name', 'hours'] as const).map((key, i) => {
                const active = sort.key === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeSort(key)}
                    aria-pressed={active}
                    title={active ? 'Click again to reverse' : `Sort by ${SORT_LABEL[key].toLowerCase()}`}
                    style={{
                      font: 'inherit',
                      padding: '0.2rem 0.55rem',
                      background: active ? 'var(--text-link)' : 'var(--surface)',
                      color: active ? 'var(--text-on-bright-solid)' : 'var(--text-700)',
                      border: 'none',
                      borderLeft: i === 0 ? 'none' : '1px solid var(--border-strong)',
                      cursor: 'pointer',
                    }}
                  >
                    {SORT_LABEL[key]}
                    {active ? <span aria-hidden="true" style={{ fontSize: '0.65em', marginLeft: 3 }}>{sort.dir === 1 ? '▲' : '▼'}</span> : null}
                  </button>
                )
              })}
            </span>
          </span>
          <span style={{ display: 'inline-flex', gap: '0.75rem' }}>
            <button type="button" onClick={foldAll} style={{ ...linkButton, textDecoration: 'none', fontSize: 'inherit' }}>
              {allFolded ? 'Expand all' : 'Collapse all'}
            </button>
            {totals.excludedPeople > 0 ? (
              <button type="button" onClick={() => setExcluded(new Set())} style={{ ...linkButton, textDecoration: 'none', fontSize: 'inherit' }}>
                Include everyone
              </button>
            ) : null}
          </span>
        </div>

        {/* Grouped table: subtotal row per person, weeks underneath */}
        <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                {sortHeader('name', 'Person', 'left')}
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Period</th>
                {sortHeader('hours', 'Hours', 'right')}
                {sortHeader('gross', 'Est. Gross', 'right')}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const off = excluded.has(g.personName)
                const isFolded = folded.has(g.personName)
                const muted = off ? { color: 'var(--text-muted)' } : null
                const struck: CSSProperties = off ? { textDecorationLine: 'line-through', textDecorationColor: 'var(--text-amber-700)' } : { textDecorationLine: 'none' }
                return [
                  <tr
                    key={`${g.personName}:group`}
                    id={groupRowId(g.personName)}
                    onClick={() => toggleFold(g.personName)}
                    style={{ background: off ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontWeight: 600, cursor: 'pointer', ...muted }}
                  >
                    <td style={{ padding: '0.5rem 0.65rem', whiteSpace: 'nowrap' }}>
                      <span aria-hidden="true" style={{ display: 'inline-block', width: 12, fontSize: '0.65em', color: 'var(--text-faint)', marginRight: 4 }}>
                        {isFolded ? '▶' : '▼'}
                      </span>
                      <input
                        type="checkbox"
                        checked={!off}
                        onChange={() => toggle(g.personName)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Include ${g.personName} in the estimate`}
                        title={off ? 'Include in the estimate' : 'Leave out of the estimate'}
                        style={{ margin: '0 0.5rem 0 0', verticalAlign: '-2px', cursor: 'pointer' }}
                      />
                      <span style={struck}>{g.personName}</span>
                      <span style={{ marginLeft: 6, fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                        {g.weekCount} wk{g.weekCount === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td />
                    <td style={cellRight}>{g.hours.toFixed(2)}</td>
                    <td style={{ ...cellRight, ...struck }}>
                      <AmountSmallCents value={g.estimatedGrossDollars} />
                    </td>
                  </tr>,
                  ...(isFolded
                    ? []
                    : g.lines.map((l) => (
                        <tr key={`${l.personName}:${l.weekStartYmd}`} style={{ borderBottom: '1px solid var(--border)', ...muted }}>
                          <td />
                          <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => onOpenWeek(l)}
                              title="Show this week's contributing days"
                              aria-label={`Show contributing days for ${l.personName}, ${formatPeriod(l.weekStartYmd, l.weekEndYmd)}`}
                              style={linkButton}
                            >
                              {formatPeriod(l.weekStartYmd, l.weekEndYmd)}
                            </button>
                          </td>
                          <td style={cellRight}>{l.hours.toFixed(2)}</td>
                          <td style={{ ...cellRight, ...struck }}>
                            <AmountSmallCents value={l.estimatedGrossDollars} />
                          </td>
                        </tr>
                      ))),
                ]
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                <td style={{ padding: '0.5rem 0.65rem' }} colSpan={2}>
                  Total
                  {totals.excludedPeople > 0 ? (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                      {' '}
                      ({totals.includedPeople} of {totals.totalPeople} people)
                    </span>
                  ) : null}
                </td>
                <td style={cellRight}>{totals.hours.toFixed(2)}</td>
                <td style={cellRight}>
                  <AmountSmallCents value={totals.estimatedGrossDollars} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function groupRowId(personName: string): string {
  return `upcoming-payroll-group-${personName.replace(/[^A-Za-z0-9_-]+/g, '_')}`
}
