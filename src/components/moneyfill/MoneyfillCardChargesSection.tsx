import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  cardChargeSortHref,
  fetchUnsplitCardChargesForWeek,
  type UnsplitCardChargeRow,
} from '../../lib/moneyfillWeekClose'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { useAuth } from '../../hooks/useAuth'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/**
 * Moneyfill queue: card purchases posted in the close week with no job
 * allocations (v2.1445 — WEEKLY_MONEY_PLAN.md Phase 3, queue 3b). Fix surface
 * stays where it lives today — Banking → User Sort (Link…) — per the plan's
 * "link, never a second editor" rule. The button opens that tab with the
 * charge's counterparty in the search box (v2.2849; it used to land on
 * Quickfill, where the Banking-sorting section is org-hidden).
 */
export function MoneyfillCardChargesSection({ weekMonday }: { weekMonday: string }) {
  const navigate = useNavigate()
  const { role, user: authUser } = useAuth()
  const [rows, setRows] = useState<UnsplitCardChargeRow[] | null | 'loading'>('loading')

  useEffect(() => {
    let cancelled = false
    setRows('loading')
    void fetchUnsplitCardChargesForWeek(weekMonday).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [weekMonday])

  const dollars =
    rows !== 'loading' && rows != null ? rows.reduce((s, r) => s + Math.abs(r.amount), 0) : 0

  const openInUserSort = (r: UnsplitCardChargeRow) => {
    const href = cardChargeSortHref(r.counterparty)
    recordNavClick(authUser?.id, role, 'moneyfill-card-charges', href)
    navigate(href)
  }

  return (
    <section
      aria-label="Card charges not split to jobs"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1rem' }}
    >
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>Card charges not split to jobs</h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Mercury debit-card purchases posted this week with no job allocations — every dollar lands on some job or the
        office. Split each one in Banking → User Sort (Link…).{' '}
        {rows !== 'loading' && rows != null ? (
          <b style={{ color: 'var(--text-700)' }}>
            ${dollars.toLocaleString('en-US', { minimumFractionDigits: 2 })} · {rows.length} charge{rows.length === 1 ? '' : 's'}
          </b>
        ) : null}
      </p>
      {rows === 'loading' ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
      ) : rows == null ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Couldn’t load Mercury transactions for this account — the queue needs Banking access.
        </div>
      ) : rows.length === 0 ? (
        <div style={{ color: '#15803d', fontSize: '0.875rem', fontWeight: 600 }}>✓ All clear for this week</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 520 }}>
            <thead>
              <tr>
                {['Posted', 'Card', 'Counterparty', 'Amount', ''].map((h, i) => (
                  <th
                    key={h || 'act'}
                    style={{ textAlign: i >= 3 ? 'right' : 'left', fontSize: '0.625rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '0.2rem 0.5rem', borderBottom: '1px solid var(--border)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.txId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {r.postedAt
                      ? new Date(r.postedAt).toLocaleDateString('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short', month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>{formatMercuryDebitCardIdCompact(r.debitCardId)}</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>{r.counterparty ?? '—'}</td>
                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                    ${Math.abs(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => openInUserSort(r)}
                      title={`Opens Banking → User Sort${r.counterparty ? ` searched for “${r.counterparty}”` : ''}; press Link… on the row to split it to jobs`}
                      style={{ padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, border: 'none', borderRadius: 5, background: '#3b82f6', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Sort in Banking → User Sort
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
