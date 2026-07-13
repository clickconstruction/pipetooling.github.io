import { useEffect, useMemo } from 'react'
import { parseTallyJobSplitsJson } from '../../lib/tallyJobSplits'
import type { TallyLinkedMercuryRow } from '../../lib/mercuryTxRowFromTally'

function rowHasJobSplit(row: TallyLinkedMercuryRow, jobId: string): boolean {
  const raw = row.job_splits
  if (!Array.isArray(raw)) return false
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (typeof o.job_id === 'string' && o.job_id === jobId) return true
  }
  return false
}

function splitAmountForJob(row: TallyLinkedMercuryRow, jobId: string): number | null {
  const splits = parseTallyJobSplitsJson(row.job_splits)
  const match = splits.find((s) => s.job_id === jobId)
  return match ? match.amount : null
}

function formatTallyCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatTallyPostedParts(iso: string | null): { date: string; weekday: string } | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    }
  } catch {
    return null
  }
}

export type TallyJobTransactionsModalProps = {
  open: boolean
  onClose: () => void
  jobId: string | null
  jobLabel: string
  rows: TallyLinkedMercuryRow[]
}

export function TallyJobTransactionsModal({ open, onClose, jobId, jobLabel, rows }: TallyJobTransactionsModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filteredSorted = useMemo(() => {
    if (!jobId) return []
    return [...rows].filter((row) => rowHasJobSplit(row, jobId))
      .sort((a, b) => {
        const ta = a.posted_at ? new Date(a.posted_at).getTime() : 0
        const tb = b.posted_at ? new Date(b.posted_at).getTime() : 0
        if (tb !== ta) return tb - ta
        return a.mercury_transaction_id.localeCompare(b.mercury_transaction_id)
      })
  }, [rows, jobId])

  if (!open || !jobId) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1160,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="tally-job-tx-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 640,
          width: '100%',
          maxHeight: '88vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem 1rem 0.5rem' }}>
          <h2 id="tally-job-tx-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            Transactions for {jobLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              padding: '0.35rem 0.5rem',
              minWidth: 36,
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-700)',
              fontSize: '1.25rem',
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 1rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Your linked card purchases allocated to this job ({filteredSorted.length} transaction{filteredSorted.length === 1 ? '' : 's'}).
        </p>
        {filteredSorted.length === 0 ? (
          <p style={{ margin: '0 1rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No transactions found.</p>
        ) : (
          <div style={{ padding: '0 1rem 1rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-700)', fontSize: '0.75rem' }}>
                    Posted
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-700)', fontSize: '0.75rem' }}>
                    Total
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-700)', fontSize: '0.75rem' }}>
                    On job
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-700)', fontSize: '0.75rem' }}>
                    Counterparty
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((row) => {
                  const jobAmt = splitAmountForJob(row, jobId)
                  return (
                    <tr key={row.mercury_transaction_id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'top' }}>
                        {(() => {
                          const posted = formatTallyPostedParts(row.posted_at)
                          if (!posted) return '—'
                          return (
                            <>
                              <div style={{ color: 'var(--text-strong)' }}>{posted.date}</div>
                              <div style={{ color: 'var(--text-slate-500)', fontSize: '0.75rem', marginTop: 2 }}>{posted.weekday}</div>
                            </>
                          )
                        })()}
                      </td>
                      <td
                        style={{
                          padding: '0.45rem 0.5rem',
                          verticalAlign: 'top',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatTallyCurrency(Number(row.amount))}
                      </td>
                      <td
                        style={{
                          padding: '0.45rem 0.5rem',
                          verticalAlign: 'top',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {jobAmt != null ? formatTallyCurrency(jobAmt) : '—'}
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', verticalAlign: 'top', maxWidth: 220 }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-strong)' }}>{row.counterparty_name?.trim() || '—'}</div>
                        {row.note?.trim() ? (
                          <div style={{ color: 'var(--text-slate-500)', fontSize: '0.75rem', marginTop: 2 }}>{row.note.trim()}</div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
