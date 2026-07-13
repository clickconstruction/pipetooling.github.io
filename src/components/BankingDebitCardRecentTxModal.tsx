import { useEffect, useMemo } from 'react'
import type { Database } from '../types/database'
import { formatMercuryKind } from '../lib/mercuryKindLabels'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../lib/mercuryRawDebitCard'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

export type BankingDebitCardRecentTxModalProps = {
  open: boolean
  onClose: () => void
  debitCardId: string | null
  rows: MercuryTxRow[]
  cap?: number
}

function comparePostedAtDescId(a: MercuryTxRow, b: MercuryTxRow): number {
  const ta = a.posted_at ? new Date(a.posted_at).getTime() : NaN
  const tb = b.posted_at ? new Date(b.posted_at).getTime() : NaN
  const aOk = !Number.isNaN(ta)
  const bOk = !Number.isNaN(tb)
  if (!aOk && !bOk) return 0
  if (!aOk) return 1
  if (!bOk) return -1
  const c = tb - ta
  if (c !== 0) return c
  return a.id.localeCompare(b.id)
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function BankingDebitCardRecentTxModal({
  open,
  onClose,
  debitCardId,
  rows,
  cap = 50,
}: BankingDebitCardRecentTxModalProps) {
  const matchingSorted = useMemo(() => {
    if (!debitCardId) return []
    const idNorm = debitCardId.toLowerCase()
    return rows.filter((r) => mercuryDebitCardIdFromRaw(r.raw) === idNorm).sort(comparePostedAtDescId)
  }, [rows, debitCardId])

  const displayRows = useMemo(() => matchingSorted.slice(0, cap), [matchingSorted, cap])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || !debitCardId) return null

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="banking-debit-card-recent-tx-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          width: 'min(720px, calc(100vw - 2rem))',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.5rem',
            flexShrink: 0,
          }}
        >
          <h2 id="banking-debit-card-recent-tx-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Recent transactions — {formatMercuryDebitCardIdCompact(debitCardId)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', wordBreak: 'break-all', flexShrink: 0 }}>
          <code style={{ fontSize: '0.75rem' }}>{debitCardId}</code>
          {' — '}
          Showing {displayRows.length} of {matchingSorted.length} matching (from loaded rows, newest first).
        </p>
        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0, border: '1px solid var(--border)', borderRadius: 4 }}>
          {displayRows.length === 0 ? (
            <p style={{ margin: 0, padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              No loaded transactions for this card. Reload the Banking table or sync from Mercury (developers).
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Posted</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Amount</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Kind</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Counterparty</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Note</th>
                  <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }} />
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.45rem 0.75rem', whiteSpace: 'nowrap' }}>{formatDate(r.posted_at)}</td>
                    <td style={{ padding: '0.45rem 0.75rem' }}>{formatCurrency(Number(r.amount))}</td>
                    <td style={{ padding: '0.45rem 0.75rem' }}>{formatMercuryKind(r.kind)}</td>
                    <td style={{ padding: '0.45rem 0.75rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.counterparty_name ?? '—'}
                    </td>
                    <td style={{ padding: '0.45rem 0.75rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.note ?? '—'}
                    </td>
                    <td style={{ padding: '0.45rem 0.75rem', whiteSpace: 'nowrap' }}>
                      {r.dashboard_link ? (
                        <a href={r.dashboard_link} target="_blank" rel="noopener noreferrer">
                          Mercury
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
