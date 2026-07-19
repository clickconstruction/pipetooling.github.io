import { useMemo, useState } from 'react'
import type { Database } from '../../types/database'
import type { AccountingRuleOverlapReport } from '../../lib/accountingRuleOverlap'
import { formatBankingDate, formatUsd } from './bankingMercuryDragSortLedger'

type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']
type RuleRow = Database['public']['Tables']['mercury_accounting_label_rules']['Row']
type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

export type BankingMercuryAccountingOverlapsModalProps = {
  open: boolean
  onClose: () => void
  report: AccountingRuleOverlapReport | null
  labelById: ReadonlyMap<string, DragLabelRow>
  ruleById: ReadonlyMap<string, RuleRow>
  txById: ReadonlyMap<string, MercuryTxRow>
  onEditRule: (ruleId: string) => void
}

type Tab = 'pairs' | 'transactions'

function ruleLabel(ruleById: ReadonlyMap<string, RuleRow>, ruleId: string): string {
  return ruleById.get(ruleId)?.name ?? ruleId.slice(0, 8)
}

function labelLabel(labelById: ReadonlyMap<string, DragLabelRow>, labelId: string): string {
  return labelById.get(labelId)?.name ?? labelId.slice(0, 8)
}

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.4rem 0.85rem',
  fontWeight: 600,
  background: active ? '#0f172a' : 'var(--bg-slate-100)',
  color: active ? 'white' : 'var(--text-slate-900)',
  border: active ? '1px solid #0f172a' : '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
})

const ruleLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--text-link)',
  textDecoration: 'underline',
  cursor: 'pointer',
}

export function BankingMercuryAccountingOverlapsModal({
  open,
  onClose,
  report,
  labelById,
  ruleById,
  txById,
  onEditRule,
}: BankingMercuryAccountingOverlapsModalProps) {
  const [tab, setTab] = useState<Tab>('pairs')

  const pairCounts = report?.pairCounts ?? []
  const txRows = report?.txRows ?? []
  const overlappingTxCount = report?.overlappingTxCount ?? 0
  const conflictTxCount = report?.conflictTxCount ?? 0

  const txRowsSorted = useMemo(() => {
    const copy = [...txRows]
    copy.sort((a, b) => {
      const ta = txById.get(a.txId)
      const tb = txById.get(b.txId)
      const da = ta?.posted_at ?? ''
      const db = tb?.posted_at ?? ''
      if (db !== da) return db > da ? 1 : -1
      return a.txId.localeCompare(b.txId)
    })
    return copy
  }, [txRows, txById])

  if (!open) return null

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
        zIndex: 1250,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Audit overlaps"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 720,
          width: '100%',
          padding: '1.25rem',
          maxHeight: '85vh',
          overflowY: 'auto',
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem' }}>Audit overlaps</h3>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem', color: 'var(--text-slate-900)' }}>
          {overlappingTxCount} transaction{overlappingTxCount === 1 ? '' : 's'} match 2 or more rules
          {conflictTxCount > 0
            ? ` · ${conflictTxCount} disagree${conflictTxCount === 1 ? 's' : ''} with the existing label`
            : ''}
          .
        </p>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-slate-500)' }}>
          Scope: currently filtered Banking transactions, including already-labeled ones.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button type="button" onClick={() => setTab('pairs')} style={tabButtonStyle(tab === 'pairs')}>
            By rule pair {pairCounts.length > 0 ? `(${pairCounts.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setTab('transactions')}
            style={tabButtonStyle(tab === 'transactions')}
          >
            By transaction {txRowsSorted.length > 0 ? `(${txRowsSorted.length})` : ''}
          </button>
        </div>

        {tab === 'pairs' ? (
          pairCounts.length === 0 ? (
            <div style={{ color: 'var(--text-slate-500)', fontSize: '0.875rem' }}>No overlapping rule pairs.</div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                      Winner rule
                    </th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                      Shadowed rule
                    </th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                      Transactions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pairCounts.map((p) => (
                    <tr
                      key={`${p.winnerRuleId}::${p.shadowedRuleId}`}
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                    >
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <button
                          type="button"
                          style={ruleLinkStyle}
                          onClick={() => onEditRule(p.winnerRuleId)}
                        >
                          {ruleLabel(ruleById, p.winnerRuleId)}
                        </button>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <button
                          type="button"
                          style={ruleLinkStyle}
                          onClick={() => onEditRule(p.shadowedRuleId)}
                        >
                          {ruleLabel(ruleById, p.shadowedRuleId)}
                        </button>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {p.txCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === 'transactions' ? (
          txRowsSorted.length === 0 ? (
            <div style={{ color: 'var(--text-slate-500)', fontSize: '0.875rem' }}>No overlapping transactions.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {txRowsSorted.map((row) => {
                const tx = txById.get(row.txId)
                const winner = row.matches[0]
                if (!winner) return null
                const shadowed = row.matches.slice(1)
                return (
                  <li
                    key={row.txId}
                    style={{
                      padding: '0.6rem 0',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div>
                      {tx
                        ? `${formatUsd(Number(tx.amount))} · ${tx.counterparty_name ?? '—'} · ${formatBankingDate(tx.posted_at)}`
                        : row.txId.slice(0, 8)}
                    </div>
                    <div style={{ marginTop: 2, color: 'var(--text-slate-600)' }}>
                      Matched by:{' '}
                      <button type="button" style={{ ...ruleLinkStyle, fontWeight: 600 }} onClick={() => onEditRule(winner.ruleId)}>
                        {ruleLabel(ruleById, winner.ruleId)}
                      </button>
                      <span style={{ color: 'var(--text-slate-500)' }}> (winner)</span>
                      {shadowed.length > 0 ? (
                        <>
                          {', '}
                          {shadowed.map((m, i) => (
                            <span key={m.ruleId}>
                              <button type="button" style={ruleLinkStyle} onClick={() => onEditRule(m.ruleId)}>
                                {ruleLabel(ruleById, m.ruleId)}
                              </button>
                              {i < shadowed.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </>
                      ) : null}
                    </div>
                    {row.conflictWithAssignedLabelId != null ? (
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: '0.8rem',
                          color: 'var(--text-amber-700)',
                          fontWeight: 500,
                        }}
                      >
                        Currently labeled {labelLabel(labelById, row.conflictWithAssignedLabelId)} · winning rule labels{' '}
                        {labelLabel(labelById, winner.labelId)}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )
        ) : null}

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.4rem 0.85rem', borderRadius: 6, border: '1px solid var(--border)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
