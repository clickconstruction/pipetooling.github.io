import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Json } from '../../types/database'
import { useToastContext } from '../../contexts/ToastContext'
import { elementToLikelyCsv, sanitizeFilenameSegment } from '../../lib/domTableToCsv'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10060,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
}

const panel: CSSProperties = {
  background: 'white',
  borderRadius: 8,
  maxWidth: 800,
  width: '100%',
  maxHeight: 'min(78vh, 700px)',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
}

type MercuryDrillRow = {
  id: string
  mercury_transaction_id: string
  amount: number
  note: string | null
  attributionDisplayName: string | null
  mercury_transactions: {
    posted_at: string | null
    counterparty_name: string | null
    amount: number
    note: string | null
    external_memo: string | null
    raw: Json | null
  } | null
}

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function JobSummaryCostCellDrilldownModal({ open, onClose, title, children }: Props) {
  const { showToast } = useToastContext()
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  const handlePrint = useCallback(() => {
    const el = bodyRef.current
    if (!el) {
      showToast('Content not ready to print', 'warning')
      return
    }
    const safeTitle = escapeHtml(title)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  tfoot td { font-weight: 600; }
  p { margin: 0.35rem 0; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${safeTitle}</h1>
  ${el.innerHTML}
</body></html>`
    const win = window.open('', '_blank')
    if (!win) {
      showToast('Allow pop-ups to print this breakdown', 'warning')
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }, [title, showToast])

  const handleExportCsv = useCallback(() => {
    const el = bodyRef.current
    if (!el) {
      showToast('Content not ready to export', 'warning')
      return
    }
    const csv = elementToLikelyCsv(el, { title })
    const ymd = new Date().toISOString().slice(0, 10)
    const name = `job-summary-drilldown_${sanitizeFilenameSegment(title)}_${ymd}.csv`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    showToast('CSV downloaded', 'success')
  }, [title, showToast])

  if (!open) return null

  const actionBtn: CSSProperties = {
    padding: '0.35rem 0.6rem',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-summary-drilldown-title"
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'wrap',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}
        >
          <h2
            id="job-summary-drilldown-title"
            style={{ margin: 0, fontSize: '1.05rem', color: '#111827', flex: '1 1 auto', minWidth: 0 }}
          >
            {title}
          </h2>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0 }}>
            <button type="button" onClick={handlePrint} style={actionBtn} aria-label="Print this breakdown">
              Print
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              style={actionBtn}
              aria-label="Export this breakdown to CSV"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ ...actionBtn, background: '#f9fafb' }}
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>
        <div
          ref={bodyRef}
          style={{ padding: '0.75rem 1rem', overflow: 'auto', flex: 1, minHeight: 0, fontSize: '0.875rem' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

type MercuryTableProps = {
  rows: MercuryDrillRow[]
  formatPosted: (iso: string) => string
  formatCurrency: (n: number) => string
  nicknameByDebitCard: Record<string, string>
  /** When true with onReassignJob, shows an action to open Mercury job splits (same roles as Parts Assign). */
  canEditAllocations?: boolean
  onReassignJob?: (mercuryTransactionId: string) => void
}

export function JobSummaryDrilldownMercuryTable({
  rows,
  formatPosted,
  formatCurrency,
  nicknameByDebitCard,
  canEditAllocations = false,
  onReassignJob,
}: MercuryTableProps) {
  const showActions = Boolean(canEditAllocations && onReassignJob)
  if (rows.length === 0) {
    return <p style={{ margin: 0, color: '#6b7280' }}>No card allocation lines for this selection.</p>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
      <thead>
        <tr style={{ background: '#f3f4f6' }}>
          <th style={{ padding: '0.3rem 0.45rem', textAlign: 'left' }}>Posted</th>
          <th style={{ padding: '0.3rem 0.45rem', textAlign: 'left' }}>Counterparty</th>
          <th style={{ padding: '0.3rem 0.45rem', textAlign: 'left' }}>User</th>
          <th style={{ padding: '0.3rem 0.45rem', textAlign: 'left' }}>Debit card</th>
          <th style={{ padding: '0.3rem 0.45rem', textAlign: 'right' }}>Allocated</th>
          <th style={{ padding: '0.3rem 0.45rem', textAlign: 'left' }}>Note</th>
          {showActions ? (
            <th style={{ padding: '0.3rem 0.45rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Actions</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const tx = row.mercury_transactions
          const posted = tx?.posted_at ? formatPosted(tx.posted_at) : '—'
          const allocAbs = Math.abs(Number(row.amount ?? 0))
          const debitCardId = mercuryDebitCardIdFromRaw(tx?.raw ?? null)
          const debitCardLabel =
            debitCardId != null ? nicknameByDebitCard[debitCardId] ?? formatMercuryDebitCardIdCompact(debitCardId) : '—'
          return (
            <tr key={row.id} style={{ borderTop: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.3rem 0.45rem' }}>{posted}</td>
              <td style={{ padding: '0.3rem 0.45rem' }}>{tx?.counterparty_name ?? '—'}</td>
              <td style={{ padding: '0.3rem 0.45rem' }}>{row.attributionDisplayName ?? '—'}</td>
              <td style={{ padding: '0.3rem 0.45rem' }}>{debitCardLabel}</td>
              <td style={{ padding: '0.3rem 0.45rem', textAlign: 'right' }}>${formatCurrency(allocAbs)}</td>
              <td style={{ padding: '0.3rem 0.45rem', color: '#4b5563' }}>
                {[row.note, tx?.note, tx?.external_memo].filter(Boolean).join(' · ') || '—'}
              </td>
              {showActions ? (
                <td style={{ padding: '0.3rem 0.45rem', verticalAlign: 'top' }}>
                  <button
                    type="button"
                    onClick={() => onReassignJob?.(row.mercury_transaction_id)}
                    aria-label="Reassign this card charge to another job"
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.45rem',
                      borderRadius: 4,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Reassign
                  </button>
                </td>
              ) : null}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

type ByWorkDate = { workDate: string; hours: number; cost: number }

export function JobSummaryDrilldownTeamLaborByWorkDate({
  personName,
  byWorkDate,
  formatWorkDate: fmt,
  formatCurrency: fc,
  formatHhMm: fh,
  totalCost,
  totalHours,
}: {
  personName: string
  byWorkDate: ByWorkDate[]
  formatWorkDate: (ymd: string) => string
  formatCurrency: (n: number) => string
  formatHhMm: (hours: number) => string
  totalCost: number
  totalHours: number
}) {
  if (byWorkDate.length === 0) {
    return (
      <p style={{ margin: 0, color: '#6b7280' }}>
        No per-work-date breakdown for {personName} (labor is allocated at job level only, or no rows).
      </p>
    )
  }
  return (
    <div>
      <p style={{ margin: '0 0 0.5rem', color: '#374151' }}>Team labor for {personName}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ padding: '0.3rem 0.45rem', textAlign: 'left' }}>Work date</th>
            <th style={{ padding: '0.3rem 0.45rem', textAlign: 'right' }}>Hours</th>
            <th style={{ padding: '0.3rem 0.45rem', textAlign: 'right' }}>Cost</th>
          </tr>
        </thead>
        <tbody>
          {byWorkDate.map((b) => (
            <tr key={b.workDate} style={{ borderTop: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.3rem 0.45rem' }}>{fmt(b.workDate)}</td>
              <td style={{ padding: '0.3rem 0.45rem', textAlign: 'right' }}>{fh(b.hours)}</td>
              <td style={{ padding: '0.3rem 0.45rem', textAlign: 'right' }}>${fc(b.cost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 600, borderTop: '1px solid #d1d5db' }}>
            <td style={{ padding: '0.3rem 0.45rem' }}>Total</td>
            <td style={{ padding: '0.3rem 0.45rem', textAlign: 'right' }}>{fh(totalHours)}</td>
            <td style={{ padding: '0.3rem 0.45rem', textAlign: 'right' }}>${fc(totalCost)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
