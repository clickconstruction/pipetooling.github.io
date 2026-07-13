import { type Dispatch, type SetStateAction, useState } from 'react'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import {
  HOURS_TAB_SECTION_CHEVRON,
  HOURS_TAB_SECTION_SHELL,
  HOURS_TAB_SECTION_TOGGLE_BTN,
  hoursTabSectionHeaderGap,
  textColorForBackground,
} from './peopleHoursTabShared'

export type MatrixSortBy = 'cost' | 'tag' | 'name'

export interface PeopleCostMatrixProps {
  open: boolean
  onToggle: () => void
  canAccessPay: boolean
  canAccessHours: boolean
  showMaxHours: boolean
  setShowMaxHours: (value: boolean) => void
  matrixSortBy: MatrixSortBy
  setMatrixSortBy: (value: MatrixSortBy) => void
  matrixDays: string[]
  pendingUnapprovedCountByWorkDate: Record<string, number>
  showPeopleForMatrix: string[]
  payConfig: Record<string, PayConfigRow>
  getCostForPersonDateMatrix: (personName: string, workDate: string) => number
  hoursReviewedSet: Set<string>
  moveMatrixRow: (personName: string, direction: 'up' | 'down') => void
  setPersonTimeDetailModalPerson: (personName: string | null) => void
  costMatrixTags: Record<string, string>
  setCostMatrixTags: Dispatch<SetStateAction<Record<string, string>>>
  saveCostMatrixTags: (personName: string, tags: string) => void
  costMatrixTagColors: Record<string, string>
}

/** Cost matrix grid: per-person daily cost table with sort/arrangement/tag controls. Owns the local edit-arrangement/edit-tags toggles; reads shared matrix data via props. */
export function PeopleCostMatrix({
  open,
  onToggle,
  canAccessPay,
  canAccessHours,
  showMaxHours,
  setShowMaxHours,
  matrixSortBy,
  setMatrixSortBy,
  matrixDays,
  pendingUnapprovedCountByWorkDate,
  showPeopleForMatrix,
  payConfig,
  getCostForPersonDateMatrix,
  hoursReviewedSet,
  moveMatrixRow,
  setPersonTimeDetailModalPerson,
  costMatrixTags,
  setCostMatrixTags,
  saveCostMatrixTags,
  costMatrixTagColors,
}: PeopleCostMatrixProps) {
  const [payEditArrangement, setPayEditArrangement] = useState(false)
  const [payEditTags, setPayEditTags] = useState(false)

  return (
    <section id="cost-matrix" style={HOURS_TAB_SECTION_SHELL}>
      <div style={hoursTabSectionHeaderGap(open)}>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          style={HOURS_TAB_SECTION_TOGGLE_BTN}
        >
          <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{open ? '▼' : '▶'}</span>
          Cost matrix
        </button>
      </div>
      {open ? (
      <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showMaxHours}
            onChange={(e) => setShowMaxHours(e.target.checked)}
          />
          show max hours
        </label>
        {canAccessPay && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={payEditArrangement}
                onChange={(e) => setPayEditArrangement(e.target.checked)}
              />
              edit arrangement
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={payEditTags}
                onChange={(e) => setPayEditTags(e.target.checked)}
              />
              edit tags
            </label>
          </>
        )}
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead style={{ background: 'var(--bg-subtle)' }}>
            <tr>
              {canAccessPay && (
                <th style={{ padding: '0.5rem 0.35rem', textAlign: 'center', borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, top: 0, zIndex: 6, background: 'var(--bg-subtle)', minWidth: 36 }} title="Hours reviewed (use Review Hours to mark)">
                  ✓
                </th>
              )}
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', position: 'sticky', left: canAccessPay ? 36 : 0, top: 0, zIndex: 6, background: 'var(--bg-subtle)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  Person
                  <button
                    type="button"
                    onClick={() => setMatrixSortBy('cost')}
                    title="Sort by cost (most expensive first)"
                    style={{
                      padding: '0.15rem 0.35rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: matrixSortBy === 'cost' ? 'var(--bg-200)' : 'var(--surface)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: matrixSortBy === 'cost' ? 600 : 400,
                    }}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixSortBy('tag')}
                    title="Sort by first tag (A-Z)"
                    style={{
                      padding: '0.15rem 0.35rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: matrixSortBy === 'tag' ? 'var(--bg-200)' : 'var(--surface)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: matrixSortBy === 'tag' ? 600 : 400,
                    }}
                  >
                    tag
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixSortBy('name')}
                    title="Sort by name (A-Z)"
                    style={{
                      padding: '0.15rem 0.35rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: matrixSortBy === 'name' ? 'var(--bg-200)' : 'var(--surface)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: matrixSortBy === 'name' ? 600 : 400,
                    }}
                  >
                    name
                  </button>
                </span>
              </th>
              {matrixDays.map((d) => {
                const dt = new Date(d + 'T12:00:00')
                const weekday = dt.toLocaleDateString(undefined, { weekday: 'short' })
                const monthDay = dt.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
                return (
                  <th key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right', borderBottom: '1px solid var(--border)', minWidth: 70, position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-subtle)' }}>
                    <span className="cost-matrix-date-header">
                      <span>{weekday}</span>
                      <span> {monthDay}</span>
                    </span>
                  </th>
                )
              })}
            </tr>
            {canAccessHours ? (
              <tr>
                {canAccessPay ? (
                  <th
                    scope="col"
                    style={{
                      padding: '0.25rem 0.35rem',
                      textAlign: 'center',
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky',
                      left: 0,
                      top: '2.875rem',
                      zIndex: 6,
                      background: 'var(--bg-subtle)',
                      minWidth: 36,
                    }}
                  />
                ) : null}
                <th
                  scope="col"
                  style={{
                    padding: '0.25rem 0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky',
                    left: canAccessPay ? 36 : 0,
                    top: '2.875rem',
                    zIndex: 6,
                    background: 'var(--bg-subtle)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                  }}
                >
                  Unapproved
                </th>
                {matrixDays.map((d) => {
                  const n = pendingUnapprovedCountByWorkDate[d] ?? 0
                  const dt = new Date(d + 'T12:00:00')
                  const longDate = dt.toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                  return (
                    <th
                      key={`matrix-unapproved-${d}`}
                      scope="col"
                      style={{
                        padding: '0.25rem 0.35rem',
                        textAlign: 'right',
                        borderBottom: '1px solid var(--border)',
                        minWidth: 70,
                        fontSize: '0.75rem',
                        fontWeight: n > 0 ? 600 : 400,
                        color: n > 0 ? 'var(--text-amber-700)' : 'var(--text-faint)',
                        whiteSpace: 'nowrap',
                        position: 'sticky',
                        top: '2.875rem',
                        zIndex: 4,
                        background: 'var(--bg-subtle)',
                      }}
                      aria-label={`Unapproved sessions on ${longDate}: ${n}`}
                    >
                      {n}
                    </th>
                  )
                })}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {showPeopleForMatrix.map((personName, idx) => {
              const cfg = payConfig[personName]
              const wage = cfg?.hourly_wage ?? 0
              const periodTotal = matrixDays.reduce((s, d) => s + getCostForPersonDateMatrix(personName, d), 0)
              return (
                <tr key={personName} style={{ borderBottom: '1px solid var(--border)' }}>
                  {canAccessPay && (
                    <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', position: 'sticky', left: 0, background: 'var(--surface)', minWidth: 36 }}>
                      {hoursReviewedSet.has(personName) ? (
                        <span style={{ color: 'var(--text-green-600)' }}>✓</span>
                      ) : (
                        <span style={{ color: 'var(--text-faint-300)' }}>—</span>
                      )}
                    </td>
                  )}
                  <td style={{ padding: '0.5rem 0.75rem', position: 'sticky', left: canAccessPay ? 36 : 0, background: 'var(--surface)', minWidth: 200 }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.2rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        {payEditArrangement && canAccessPay ? (
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 0, marginRight: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => moveMatrixRow(personName, 'up')}
                              disabled={idx === 0}
                              title="Move up"
                              style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'var(--text-faint-300)' : 'var(--text-muted)', lineHeight: 1 }}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveMatrixRow(personName, 'down')}
                              disabled={idx === showPeopleForMatrix.length - 1}
                              title="Move down"
                              style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: idx === showPeopleForMatrix.length - 1 ? 'not-allowed' : 'pointer', color: idx === showPeopleForMatrix.length - 1 ? 'var(--text-faint-300)' : 'var(--text-muted)', lineHeight: 1 }}
                            >
                              ▼
                            </button>
                          </span>
                        ) : null}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => setPersonTimeDetailModalPerson(personName)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPersonTimeDetailModalPerson(personName) } }}
                          title="View hours detail"
                          style={{ cursor: 'pointer' }}
                        >
                          {wage > 0 ? `$${Math.round(periodTotal).toLocaleString('en-US')}` : '—'} | {personName}{cfg?.is_salary && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>(salary)</span>}
                        </span>
                      </span>
                      {payEditTags && canAccessPay ? (
                        <input
                          type="text"
                          value={costMatrixTags[personName] ?? ''}
                          onChange={(e) => setCostMatrixTags((prev) => ({ ...prev, [personName]: e.target.value }))}
                          onBlur={(e) => saveCostMatrixTags(personName, e.target.value)}
                          placeholder="Tags (comma-separated)"
                          style={{ padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.75rem', minWidth: 120, marginLeft: 'auto' }}
                        />
                      ) : (costMatrixTags[personName] ?? '').trim() ? (
                        <span style={{ display: 'flex', gap: '0.15rem', flexWrap: 'wrap', marginLeft: 'auto', justifyContent: 'flex-end' }}>
                          {(costMatrixTags[personName] ?? '')
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean)
                            .map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  padding: '0.1rem 0.35rem',
                                  background: costMatrixTagColors[tag] ?? '#e5e7eb',
                                  borderRadius: 4,
                                  fontSize: '0.7rem',
                                  color: textColorForBackground(costMatrixTagColors[tag] ?? '#e5e7eb'),
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  {matrixDays.map((d) => {
                    const cost = getCostForPersonDateMatrix(personName, d)
                    return (
                      <td key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right' }}>
                        {wage > 0 ? `$${Math.round(cost).toLocaleString('en-US')}` : '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
              {canAccessPay && (
                <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', position: 'sticky', left: 0, background: 'var(--bg-subtle)', minWidth: 36 }}>
                  {hoursReviewedSet.size} of {showPeopleForMatrix.length}
                </td>
              )}
              <td style={{ padding: '0.5rem 0.75rem', position: 'sticky', left: canAccessPay ? 36 : 0, background: 'var(--bg-subtle)' }}>
                Internal Team: ${Math.round(
                  matrixDays.reduce(
                    (daySum, d) => daySum + showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0),
                    0
                  )
                ).toLocaleString('en-US')}
              </td>
              {matrixDays.map((d) => {
                const dayTotal = showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0)
                return (
                  <td key={d} style={{ padding: '0.5rem 0.35rem', textAlign: 'right' }}>
                    ${Math.round(dayTotal).toLocaleString('en-US')}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
      </>
      ) : null}
    </section>
  )
}
