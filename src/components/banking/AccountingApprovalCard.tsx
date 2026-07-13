import { memo } from 'react'
import type { Database } from '../../types/database'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { mercuryBankDescriptionFromRaw } from '../../lib/mercuryBankDescriptionFromRaw'
import { formatBankingDate, formatUsd } from './bankingMercuryDragSortLedger'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']

/**
 * Shape of one pending approval as rendered in a card.
 *
 * Mirrors the inline `PendingApproval` type used by
 * `BankingMercuryAccountingTab` so the parent can pass entries straight in.
 */
export type AccountingApprovalCardData = {
  suggestionId: string
  txId: string
  tx: MercuryTxRow | null
  ruleId: string
  ruleName: string
  suggestedLabelId: string
  suggestedLabelName: string
}

export type AccountingApprovalCardProps = {
  approval: AccountingApprovalCardData
  labels: ReadonlyArray<DragLabelRow>
  nicknameByDebitCard: Record<string, string>
  approveAllBusy: boolean
  rulesLoading: boolean
  onApprove: (suggestionId: string, txId: string, labelId: string) => void
  onReject: (suggestionId: string) => void
  onLabelChange: (suggestionId: string, nextLabelId: string) => void
  onOpenEditRule: (ruleId: string) => void
}

export const AccountingApprovalCard = memo(function AccountingApprovalCard({
  approval: p,
  labels,
  nicknameByDebitCard,
  approveAllBusy,
  rulesLoading,
  onApprove,
  onReject,
  onLabelChange,
  onOpenEditRule,
}: AccountingApprovalCardProps) {
  const debitCardId = p.tx ? mercuryDebitCardIdFromRaw(p.tx.raw) : null
  const debitCardLabel = debitCardId
    ? nicknameByDebitCard[debitCardId] ?? formatMercuryDebitCardIdCompact(debitCardId)
    : null

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span>
              {p.tx
                ? `${formatUsd(Number(p.tx.amount))} · ${p.tx.counterparty_name ?? '—'}`
                : `Transaction ${p.txId.slice(0, 8)}… (not in current list)`}
            </span>
            {p.tx ? (
              p.tx.source === 'manual' ? (
                <span
                  title="Manually-entered transaction (not synced from Mercury)"
                  style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', borderRadius: 999, padding: '1px 6px' }}
                >
                  ✎ Manual
                </span>
              ) : (
                <span
                  title="Synced from Mercury"
                  style={{ fontSize: '0.62rem', fontWeight: 700, color: '#075985', background: '#e0f2fe', borderRadius: 999, padding: '1px 6px' }}
                >
                  Synced
                </span>
              )
            ) : null}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-slate-500)', marginTop: 4 }}>
            Rule:{' '}
            <button
              type="button"
              disabled={approveAllBusy || rulesLoading}
              onClick={() => onOpenEditRule(p.ruleId)}
              aria-label={`Edit rule ${p.ruleName}`}
              title="Edit rule"
              style={{
                padding: 0,
                border: 'none',
                background: 'none',
                color: 'var(--text-link)',
                cursor: approveAllBusy || rulesLoading ? 'not-allowed' : 'pointer',
                textDecoration: 'underline',
                font: 'inherit',
                fontSize: 'inherit',
              }}
            >
              {p.ruleName}
            </button>
            {' · Suggested: '}
            {p.suggestedLabelName}
          </div>
          {debitCardLabel ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-slate-500)', marginTop: 2 }}>
              Card: {debitCardLabel}
            </div>
          ) : null}
          {p.tx ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)', marginTop: 2 }}>
              Posted {formatBankingDate(p.tx.posted_at)} · Bank: {mercuryBankDescriptionFromRaw(p.tx.raw) ?? '—'}
            </div>
          ) : null}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem' }}>
          <select
            value={p.suggestedLabelId}
            disabled={approveAllBusy}
            onChange={(e) => onLabelChange(p.suggestionId, e.target.value)}
            style={{ minWidth: 200, padding: '0.35rem 0.5rem' }}
          >
            {labels.map((L) => (
              <option key={L.id} value={L.id}>
                {L.name}
              </option>
            ))}
          </select>
          <span>Accounting Label</span>
        </label>
        <button
          type="button"
          disabled={approveAllBusy}
          onClick={() => onApprove(p.suggestionId, p.txId, p.suggestedLabelId)}
          style={{
            padding: '0.45rem 0.9rem',
            fontWeight: 600,
            background: approveAllBusy ? '#94a3b8' : '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: approveAllBusy ? 'not-allowed' : 'pointer',
          }}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={approveAllBusy}
          onClick={() => onReject(p.suggestionId)}
          style={{
            padding: '0.45rem 0.9rem',
            fontWeight: 600,
            background: 'var(--surface)',
            color: 'var(--text-red-700)',
            border: '1px solid #fecaca',
            borderRadius: 6,
            cursor: approveAllBusy ? 'not-allowed' : 'pointer',
          }}
        >
          Reject
        </button>
      </div>
    </div>
  )
})
