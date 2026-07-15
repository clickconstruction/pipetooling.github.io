import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import {
  fetchDraftPayrollPersonBreakdown,
  type DraftPayrollBreakdownAssignmentRow,
} from '../../lib/draftPayrollPersonBreakdown'
import { formatClockSessionTimestampPartsChicago } from '../../lib/formatClockSessionTimestamp'
import { formatErrorMessage } from '../../utils/errorHandling'

/** Chicago wall-clock time in the compact "8:05am" style. */
function shortClockTime(iso: string): string {
  const parts = formatClockSessionTimestampPartsChicago(iso)
  return parts ? parts.time.replace(/\s+/g, '').toLowerCase() : ''
}

/** "8:05am–5:00pm" (open session → "8:05am–"); null when the day has no sessions. */
function dayClockSpan(firstIn: string | null | undefined, lastOut: string | null | undefined): string | null {
  if (!firstIn) return null
  return `${shortClockTime(firstIn)}–${lastOut ? shortClockTime(lastOut) : ''}`
}

export type DraftPayrollPersonHoursBreakdownModalProps = {
  open: boolean
  personName: string
  periodStart: string
  periodEnd: string
  hourlyWage: number
  isSalary: boolean
  zIndex: number
  onClose: () => void
  /**
   * When provided (and the person is hourly), each Date cell becomes a link that opens the
   * My Time day editor for that day. Salary rows stay plain text (synthetic 8h/weekday —
   * clock-session edits would not change them).
   */
  onOpenDayEditor?: (dateYmd: string) => void
}

// Mirrors the dotted-underline day-link affordance from teamSummary/drilldowns.tsx (module-private there).
const dayLinkButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'var(--text-link)',
  textDecoration: 'underline dotted',
  textUnderlineOffset: '2px',
  cursor: 'pointer',
  textAlign: 'left',
}

export function DraftPayrollPersonHoursBreakdownModal({
  open,
  personName,
  periodStart,
  periodEnd,
  hourlyWage,
  isSalary,
  zIndex,
  onClose,
  onOpenDayEditor,
}: DraftPayrollPersonHoursBreakdownModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<DraftPayrollBreakdownAssignmentRow[]>([])

  useEffect(() => {
    if (!open || !personName.trim()) {
      setLoading(false)
      setRows([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const { rows: nextRows } = await fetchDraftPayrollPersonBreakdown(supabase, {
          personName,
          periodStart,
          periodEnd,
          isSalary,
        })
        if (!cancelled) {
          setRows(nextRows)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatErrorMessage(e, 'Could not load breakdown.'))
          setRows([])
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, personName, periodStart, periodEnd, isSalary])

  if (!open) return null

  const totalHours = rows.reduce((s, r) => s + r.hours, 0)
  const totalGross = totalHours * hourlyWage
  const totalPendingHours = rows.reduce((s, r) => s + r.pendingHours, 0)

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
        padding: '1rem',
      }}
    >
      <div
        role="dialog"
        aria-labelledby="draft-payroll-hours-breakdown-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 id="draft-payroll-hours-breakdown-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Hours breakdown — {personName}
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Period {periodStart} – {periodEnd}
            {isSalary ? ' · Salary (8h weekdays, less unpaid time off, within employment dates)' : ''}
          </p>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          {loading ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : error ? (
            <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{error}</p>
          ) : rows.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No days in this period.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>Date &amp; Time</th>
                    <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Hours</th>
                    <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Cash Due</th>
                    <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>Jobs / bids</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date} style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                      <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>
                        {!isSalary && onOpenDayEditor ? (
                          <button
                            type="button"
                            onClick={() => onOpenDayEditor(r.date)}
                            title={`Open My Time for ${personName} on ${r.date}`}
                            aria-label={`Open My Time for ${personName} on ${r.date}`}
                            style={dayLinkButtonStyle}
                          >
                            {r.date.slice(5)}
                          </button>
                        ) : (
                          <span title={r.date}>{r.date.slice(5)}</span>
                        )}
                        {dayClockSpan(r.firstClockIn, r.lastClockOut) ? (
                          <span style={{ marginLeft: '0.4rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {dayClockSpan(r.firstClockIn, r.lastClockOut)}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.hours.toFixed(2)}
                        {r.salaryNote ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {r.salaryNote}
                          </div>
                        ) : null}
                        {r.pendingHours > 0 ? (
                          <div
                            style={{ fontSize: '0.75rem', color: 'var(--text-amber-700)', whiteSpace: 'nowrap' }}
                            title="Clocked hours awaiting approval — not included in payroll hours or Cash Due until a lead approves the sessions."
                          >
                            +{r.pendingHours.toFixed(2)} pending
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        ${formatCurrency(r.hours * hourlyWage)}
                      </td>
                      <td
                        style={{
                          padding: '0.45rem 0.65rem',
                          color: 'var(--text-700)',
                          wordBreak: 'break-word',
                          maxWidth: 280,
                        }}
                      >
                        {r.jobsText}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                    <td style={{ padding: '0.5rem 0.65rem' }}>Period total</td>
                    <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {totalHours.toFixed(2)}
                      {totalPendingHours > 0 ? (
                        <div
                          style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-amber-700)', whiteSpace: 'nowrap' }}
                          title="Clocked hours awaiting approval — not included in payroll hours or Cash Due until a lead approves the sessions."
                        >
                          +{totalPendingHours.toFixed(2)} pending
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      ${formatCurrency(totalGross)}
                    </td>
                    <td style={{ padding: '0.5rem 0.65rem' }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
