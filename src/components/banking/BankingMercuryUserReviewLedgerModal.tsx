import { useEffect, useId, useMemo, useState } from 'react'
import type { Database } from '../../types/database'
import {
  buildMercuryTxSearchHaystack,
  mercuryTxMatchesSearchQuery,
  type BankingMercurySearchNicknames,
} from '../../lib/bankingMercurySearch'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'
import { shortUuidPrefix } from '../../lib/shortUuidPrefix'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

export type BankingMercuryUserReviewLedgerModalProps = {
  open: boolean
  onClose: () => void
  /** Row + column display names — shown in the header. */
  rowName: string
  columnName: string
  /** The transactions in the cell slice. */
  rows: MercuryTxRow[]
  /** Aggregate $ for the slice, in dollars (display only). */
  totalAmount: number
  /** Nicknames passed to the search haystack builder. */
  nicknameCtx: BankingMercurySearchNicknames
  /** Backdrop + shell z-index */
  zIndex?: number
}

function formatBankingDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function amountColor(amount: number): string {
  if (amount > 0) return '#047857' // emerald-700 (credit)
  if (amount < 0) return '#b91c1c' // red-700 (debit)
  return '#374151'
}

export function BankingMercuryUserReviewLedgerModal({
  open,
  onClose,
  rowName,
  columnName,
  rows,
  totalAmount,
  nicknameCtx,
  zIndex = 1200,
}: BankingMercuryUserReviewLedgerModalProps) {
  const reactId = useId()
  const titleId = `${reactId}-user-review-ledger-title`
  const searchInputId = `${reactId}-user-review-search`
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const haystackByTxId = useMemo(() => {
    if (!open) return new Map<string, string>()
    const out = new Map<string, string>()
    for (const r of rows) {
      out.set(r.id, buildMercuryTxSearchHaystack(r, nicknameCtx).toLowerCase())
    }
    return out
  }, [open, rows, nicknameCtx])

  const sortedRows = useMemo(() => {
    if (!open) return [] as MercuryTxRow[]
    const copy = [...rows]
    copy.sort((a, b) => {
      const aIso = a.posted_at ?? ''
      const bIso = b.posted_at ?? ''
      if (aIso === bIso) return 0
      return bIso.localeCompare(aIso)
    })
    return copy
  }, [open, rows])

  const filteredRows = useMemo(() => {
    if (!open) return [] as MercuryTxRow[]
    if (query.trim() === '') return sortedRows
    return sortedRows.filter((r) =>
      mercuryTxMatchesSearchQuery(haystackByTxId.get(r.id) ?? '', query),
    )
  }, [open, sortedRows, query, haystackByTxId])

  if (!open) return null

  const filteredTotalAmount = filteredRows.reduce(
    (acc, r) => acc + (Number.isFinite(r.amount) ? r.amount : 0),
    0,
  )

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
        zIndex,
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
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 880,
          width: '100%',
          maxHeight: 'min(86vh, 48rem)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
          border: '1px solid #e5e7eb',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.75rem',
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              id={titleId}
              style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}
            >
              {rowName} <span style={{ color: '#6b7280', fontWeight: 400 }}>·</span> {columnName}
            </h2>
            <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: '#6b7280' }}>
              {rows.length.toLocaleString()} transaction{rows.length === 1 ? '' : 's'}
              {' · '}
              <span style={{ color: amountColor(totalAmount), fontWeight: 500 }}>
                {formatUsd(totalAmount)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ marginBottom: '0.65rem', flexShrink: 0 }}>
          <label htmlFor={searchInputId} style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
            Search transactions
          </label>
          <input
            id={searchInputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Counterparty, memo, card, amount…"
            style={{
              width: '100%',
              padding: '0.45rem 0.65rem',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: '0.875rem',
              color: '#111827',
              boxSizing: 'border-box',
            }}
          />
          {query.trim() !== '' ? (
            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#6b7280' }}>
              Filtered: {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()}
              {' · '}
              <span style={{ color: amountColor(filteredTotalAmount), fontWeight: 500 }}>
                {formatUsd(filteredTotalAmount)}
              </span>
            </div>
          ) : null}
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
          }}
        >
          {filteredRows.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
              {rows.length === 0 ? 'No transactions in this cell.' : 'No transactions match this search.'}
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8125rem',
              }}
            >
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  background: '#f9fafb',
                  zIndex: 1,
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <tr>
                  <th style={cellHeaderStyle}>Posted</th>
                  <th style={cellHeaderStyle}>Counterparty</th>
                  <th style={{ ...cellHeaderStyle, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const kind = formatMercuryKind(r.kind)
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={cellStyle}>{formatBankingDate(r.posted_at)}</td>
                      <td style={cellStyle}>
                        <div style={{ fontWeight: 500, color: '#111827' }}>
                          {r.counterparty_name?.trim() ?? '—'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                          {kind} · {shortUuidPrefix(r.id)}
                        </div>
                      </td>
                      <td
                        style={{
                          ...cellStyle,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: amountColor(r.amount ?? 0),
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatUsd(r.amount ?? 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const cellHeaderStyle = {
  padding: '0.5rem 0.65rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.75rem',
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
} as const

const cellStyle = {
  padding: '0.5rem 0.65rem',
  verticalAlign: 'top',
} as const
