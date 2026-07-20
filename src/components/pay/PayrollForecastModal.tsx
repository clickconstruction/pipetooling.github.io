import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../../lib/format'

/**
 * One unpaid pay-stub row surfaced into the forecast UI. The parent
 * (People → Payroll) computes these from `payStubs` + the paid/less/
 * additional maps so the modal stays a pure presentational component
 * with no Supabase coupling.
 */
export type PayrollForecastUnpaidRow = {
  /** `pay_stubs.id` — used as the stable key for checkbox state. */
  stubId: string
  personName: string
  /** YMD (en-CA) for the date the balance "came into existence" — we
   *  use `period_end` from the pay stub since that's when the obligation
   *  crystallizes; created_at would also be reasonable but period_end
   *  reads more naturally as "balance from {date}". */
  balanceCreatedYmd: string
  /** Net pay − paid-to-date. Always > 0 here (caller filters fully-paid rows). */
  remaining: number
}

/** A forecast "bar" — i.e. an upcoming allowance the user has set aside
 *  for a deadline. Bars are local to the modal session (not persisted)
 *  so they're identified by a transient string id. */
type ForecastBar = {
  id: string
  /** YMD for the bar label. May be empty while the user is editing. */
  dateYmd: string
  /** Dollar allowance the user expects to spend by `dateYmd`. */
  allowance: number
}

function nextBarId(existing: ForecastBar[]): string {
  // Cheap, collision-free for a single modal session — we just want
  // a stable React key, not a globally unique id.
  let i = 1
  while (existing.some((b) => b.id === `b${i}`)) i += 1
  return `b${i}`
}

/** "May 17" — used for the table's "Balance created" column and the
 *  bar's date label. Day + month only per spec ("not year"). */
function formatShortDayMonth(ymd: string): string {
  if (!ymd) return '—'
  const d = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Sort bars chronologically; bars without a date sink to the end so
 *  in-progress "Add bar" drafts don't shuffle around as the user types. */
function sortBarsForDisplay(bars: ForecastBar[]): ForecastBar[] {
  return [...bars].sort((a, b) => {
    if (!a.dateYmd && !b.dateYmd) return a.id.localeCompare(b.id)
    if (!a.dateYmd) return 1
    if (!b.dateYmd) return -1
    return a.dateYmd < b.dateYmd ? -1 : a.dateYmd > b.dateYmd ? 1 : 0
  })
}

export function PayrollForecastModal(props: {
  open: boolean
  onClose: () => void
  unpaidRows: PayrollForecastUnpaidRow[]
  zIndex: number
}) {
  const { open, onClose, unpaidRows, zIndex } = props

  const [bars, setBars] = useState<ForecastBar[]>([])
  /** Per-row Set<barId> — i.e. each row may be checked under several
   *  bars (true multi-select per the spec's "checkbox" wording). The
   *  bar fill is the sum of `remaining` for all rows checked under it,
   *  which gives the user a fast over-/under-commit signal. */
  const [checkedByRow, setCheckedByRow] = useState<Record<string, Set<string>>>({})

  // Reset the working state every time the modal opens so the user
  // never sees stale bars from a prior planning session. (We could
  // persist later, but ephemeral state is the right v1 for a "what if"
  // tool — see also the modal subtitle.)
  useEffect(() => {
    if (!open) return
    setBars([])
    setCheckedByRow({})
  }, [open])

  // Close on Escape — mirrors the rest of the People pay modals.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const sortedBars = useMemo(() => sortBarsForDisplay(bars), [bars])

  /** Map<barId, filledAmount> — recomputed cheaply from the row map. */
  const filledByBar = useMemo(() => {
    const out: Record<string, number> = {}
    for (const bar of bars) out[bar.id] = 0
    for (const row of unpaidRows) {
      const set = checkedByRow[row.stubId]
      if (!set) continue
      for (const barId of set) {
        if (!(barId in out)) continue
        out[barId] = (out[barId] ?? 0) + row.remaining
      }
    }
    return out
  }, [bars, unpaidRows, checkedByRow])

  const totalUnpaid = useMemo(
    () => unpaidRows.reduce((sum, r) => sum + r.remaining, 0),
    [unpaidRows],
  )
  const totalAllocated = useMemo(
    () => Object.values(filledByBar).reduce((s, v) => s + v, 0),
    [filledByBar],
  )

  function handleAddBar() {
    setBars((prev) => {
      const id = nextBarId(prev)
      return [...prev, { id, dateYmd: '', allowance: 0 }]
    })
  }

  function handleRemoveBar(id: string) {
    setBars((prev) => prev.filter((b) => b.id !== id))
    // Drop checked references to this bar so the rows don't keep
    // counting it in their hidden Set.
    setCheckedByRow((prev) => {
      const next: Record<string, Set<string>> = {}
      for (const [stubId, set] of Object.entries(prev)) {
        if (!set.has(id)) {
          next[stubId] = set
          continue
        }
        const copy = new Set(set)
        copy.delete(id)
        if (copy.size > 0) next[stubId] = copy
      }
      return next
    })
  }

  function handleBarDateChange(id: string, dateYmd: string) {
    setBars((prev) => prev.map((b) => (b.id === id ? { ...b, dateYmd } : b)))
  }

  function handleBarAllowanceChange(id: string, raw: string) {
    const n = raw.trim() === '' ? 0 : Number(raw)
    const safe = Number.isFinite(n) && n >= 0 ? n : 0
    setBars((prev) => prev.map((b) => (b.id === id ? { ...b, allowance: safe } : b)))
  }

  function handleToggleCheck(stubId: string, barId: string) {
    setCheckedByRow((prev) => {
      const existing = prev[stubId] ?? new Set<string>()
      const copy = new Set(existing)
      if (copy.has(barId)) copy.delete(barId)
      else copy.add(barId)
      const next = { ...prev }
      if (copy.size > 0) next[stubId] = copy
      else delete next[stubId]
      return next
    })
  }

  function handleClearChecks() {
    setCheckedByRow({})
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
      }}
      onClick={(e) => {
        // Click-outside dismiss, matching DraftPayrollModal behavior.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.25rem 1.5rem',
          borderRadius: 8,
          width: 'min(960px, 95vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Payroll forecast</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Add bars for upcoming allowances, then check the unpaid balances you plan to pay from each bar.
              Bars fill as you check rows.
              <span style={{ display: 'inline-block', marginLeft: '0.4rem', fontStyle: 'italic' }}>
                (Planning only — nothing here changes pay stubs.)
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              color: 'var(--text-muted)',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Bar chart section */}
        <section
          aria-label="Forecast bars"
          style={{
            position: 'sticky',
            top: 0,
            background: 'var(--surface)',
            padding: '0.75rem 0',
            borderBottom: '1px solid var(--border)',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button
              type="button"
              onClick={handleAddBar}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Add a forecast bar (date + allowance)"
            >
              <span aria-hidden style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
              Add bar
            </button>
            {bars.length > 0 && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Allocated ${formatCurrency(totalAllocated)} of $
                {formatCurrency(bars.reduce((s, b) => s + b.allowance, 0))} across {bars.length} bar
                {bars.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {sortedBars.length === 0 ? (
            <p style={{ margin: 0, padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem', background: 'var(--bg-subtle)', borderRadius: 6, textAlign: 'center' }}>
              No bars yet — click <strong>+ Add bar</strong> to start forecasting.
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                overflowX: 'auto',
                paddingBottom: '0.25rem',
              }}
            >
              {sortedBars.map((bar) => {
                const filled = filledByBar[bar.id] ?? 0
                const allowance = bar.allowance > 0 ? bar.allowance : 0
                const pct = allowance > 0 ? Math.min(100, (filled / allowance) * 100) : 0
                const over = allowance > 0 && filled > allowance
                const exact = allowance > 0 && Math.abs(filled - allowance) < 0.005
                const fillColor = over ? '#dc2626' : exact ? '#059669' : '#22c55e'
                return (
                  <div
                    key={bar.id}
                    style={{
                      flex: '0 0 auto',
                      width: 120,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    {/* The bar itself — fills bottom-up. */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: 140,
                        background: 'var(--bg-muted)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 6,
                        overflow: 'hidden',
                      }}
                      role="img"
                      aria-label={
                        allowance > 0
                          ? `${formatCurrency(filled)} of ${formatCurrency(allowance)} allocated${over ? ' — over allowance' : ''}`
                          : 'Allowance not set yet'
                      }
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: `${pct}%`,
                          background: fillColor,
                          transition: 'height 0.18s ease',
                        }}
                      />
                      {over && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            left: 0,
                            right: 0,
                            textAlign: 'center',
                            fontSize: '0.7rem',
                            color: 'white',
                            fontWeight: 600,
                            textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                          }}
                        >
                          OVER
                        </div>
                      )}
                    </div>
                    {/* Editable date */}
                    <input
                      type="date"
                      value={bar.dateYmd}
                      onChange={(e) => handleBarDateChange(bar.id, e.target.value)}
                      aria-label="Bar date"
                      style={{
                        width: '100%',
                        padding: '0.25rem 0.35rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                      }}
                    />
                    {/* Editable allowance */}
                    <div style={{ position: 'relative', width: '100%' }}>
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          left: 6,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                          pointerEvents: 'none',
                        }}
                      >
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={bar.allowance === 0 ? '' : bar.allowance}
                        onChange={(e) => handleBarAllowanceChange(bar.id, e.target.value)}
                        placeholder="Allowance"
                        aria-label="Bar allowance amount"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '0.25rem 0.35rem 0.25rem 16px',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                        }}
                      />
                    </div>
                    {/* Filled-to-date summary + remove */}
                    <div style={{ fontSize: '0.72rem', color: over ? 'var(--text-red-700)' : 'var(--text-700)', textAlign: 'center', lineHeight: 1.25 }}>
                      <div>
                        <strong>${formatCurrency(filled)}</strong>
                        {allowance > 0 && (
                          <span style={{ color: 'var(--text-muted)' }}> / ${formatCurrency(allowance)}</span>
                        )}
                      </div>
                      {bar.dateYmd ? (
                        <div style={{ color: 'var(--text-muted)' }}>{formatShortDayMonth(bar.dateYmd)}</div>
                      ) : (
                        <div style={{ color: 'var(--text-faint)' }}>pick a date</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveBar(bar.id)}
                      aria-label="Remove bar"
                      title="Remove bar"
                      style={{
                        marginTop: '0.1rem',
                        padding: '0.15rem 0.5rem',
                        fontSize: '0.7rem',
                        background: 'none',
                        color: 'var(--text-red-700)',
                        border: '1px solid #fecaca',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Unpaid balances table */}
        <section aria-label="Unpaid balances">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              Unpaid balances
              <span style={{ marginLeft: '0.4rem', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                ({unpaidRows.length} row{unpaidRows.length === 1 ? '' : 's'} · ${formatCurrency(totalUnpaid)} owed)
              </span>
            </h3>
            {bars.length > 0 && Object.keys(checkedByRow).length > 0 && (
              <button
                type="button"
                onClick={handleClearChecks}
                style={{
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.8125rem',
                  background: 'var(--surface)',
                  color: 'var(--text-700)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                title="Uncheck every row in the table below"
              >
                Clear all checks
              </button>
            )}
          </div>
          {unpaidRows.length === 0 ? (
            <p style={{ margin: 0, padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem', background: 'var(--bg-subtle)', borderRadius: 6 }}>
              No unpaid balances — everyone's caught up.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Person</th>
                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }} title="Pay period end — when the balance came into existence">
                      Balance created
                    </th>
                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Remaining</th>
                    {sortedBars.map((bar) => (
                      <th
                        key={bar.id}
                        style={{ padding: '0.4rem 0.6rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-700)' }}
                      >
                        <div>{bar.dateYmd ? formatShortDayMonth(bar.dateYmd) : '—'}</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                          {bar.allowance > 0 ? `$${formatCurrency(bar.allowance)}` : '—'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unpaidRows.map((row) => {
                    const checked = checkedByRow[row.stubId]
                    return (
                      <tr key={row.stubId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.4rem 0.6rem' }}>{row.personName}</td>
                        <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-700)' }}>
                          {formatShortDayMonth(row.balanceCreatedYmd)}
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>
                          ${formatCurrency(row.remaining)}
                        </td>
                        {sortedBars.map((bar) => {
                          const isOn = checked?.has(bar.id) ?? false
                          return (
                            <td key={bar.id} style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isOn}
                                onChange={() => handleToggleCheck(row.stubId, bar.id)}
                                aria-label={`Apply ${row.personName}'s $${formatCurrency(row.remaining)} balance to the ${bar.dateYmd ? formatShortDayMonth(bar.dateYmd) : 'unscheduled'} bar`}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
                {sortedBars.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }} colSpan={2}>
                        Filled
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 600 }}>
                        ${formatCurrency(totalAllocated)}
                      </td>
                      {sortedBars.map((bar) => {
                        const filled = filledByBar[bar.id] ?? 0
                        const allowance = bar.allowance
                        const over = allowance > 0 && filled > allowance
                        return (
                          <td
                            key={bar.id}
                            style={{
                              padding: '0.4rem 0.6rem',
                              textAlign: 'center',
                              fontWeight: 600,
                              color: over ? 'var(--text-red-700)' : 'var(--text-700)',
                            }}
                          >
                            ${formatCurrency(filled)}
                          </td>
                        )
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
