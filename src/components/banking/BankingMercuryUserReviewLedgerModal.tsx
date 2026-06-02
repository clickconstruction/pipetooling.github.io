import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { Database } from '../../types/database'
import {
  buildMercuryTxSearchHaystack,
  mercuryTxMatchesSearchQuery,
  type BankingMercurySearchNicknames,
} from '../../lib/bankingMercurySearch'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'
import { shortUuidPrefix } from '../../lib/shortUuidPrefix'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import { mercurySetTransactionUserAttribution } from '../../lib/mercurySetUserAttribution'
import {
  fetchMercuryUserReviewTxMetaByTxIds,
  type MercuryUserReviewTxMeta,
} from '../../lib/fetchMercuryTransactionRaws'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { useToastContext } from '../../contexts/ToastContext'

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
  /** Assignable users for the per-row + bulk "assign person" tool. */
  userOptions: SearchableSelectOption[]
  /** Current attribution for this cell's row (a user id), or null for person/unassigned rows. */
  currentUserId: string | null
  /** Operator auth user id (for recent quick-picks); null when unknown. */
  recentPersonPicksStorageKey: string | null
  /** Reload attribution data in the parent after a change. */
  onAttributionChanged: () => void | Promise<void>
  /** Open the full TransactionDetail modal for a transaction id. */
  onOpenTransactionDetail?: (txId: string) => void
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

const UNASSIGN_OPTION = { value: '', label: '— Unassign —' } as const

function userOptionLabel(userOptions: SearchableSelectOption[], userId: string): string {
  for (const o of userOptions) {
    if ('value' in o && o.value === userId) return o.label
  }
  return 'this person'
}

export function BankingMercuryUserReviewLedgerModal({
  open,
  onClose,
  rowName,
  columnName,
  rows,
  totalAmount,
  nicknameCtx,
  userOptions,
  currentUserId,
  recentPersonPicksStorageKey,
  onAttributionChanged,
  onOpenTransactionDetail,
  zIndex = 1200,
}: BankingMercuryUserReviewLedgerModalProps) {
  const reactId = useId()
  const titleId = `${reactId}-user-review-ledger-title`
  const searchInputId = `${reactId}-user-review-search`
  const [query, setQuery] = useState('')
  const [savingTxIds, setSavingTxIds] = useState<Set<string>>(() => new Set())
  const [bulkUserId, setBulkUserId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [metaByTxId, setMetaByTxId] = useState<Map<string, MercuryUserReviewTxMeta>>(() => new Map())
  const { showToast } = useToastContext()

  // bankDescription and the debit-card id live in mercury_transactions.raw, which the User
  // Review list does not hydrate; fetch just those projected fields for this cell's
  // transactions when the modal opens.
  useEffect(() => {
    if (!open) {
      setMetaByTxId(new Map())
      return
    }
    const ids = rows.map((r) => r.id)
    if (ids.length === 0) {
      setMetaByTxId(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const map = await fetchMercuryUserReviewTxMetaByTxIds(ids, 'user review tx meta')
        if (!cancelled) setMetaByTxId(map)
      } catch {
        if (!cancelled) setMetaByTxId(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, rows])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setBulkUserId('')
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

  const assignOne = useCallback(
    async (txId: string, userId: string | null) => {
      setSavingTxIds((prev) => new Set(prev).add(txId))
      try {
        await mercurySetTransactionUserAttribution({
          mercuryTransactionId: txId,
          userId,
          operationLabel: 'user review assign',
          recentPersonPicksStorageKey,
        })
        await onAttributionChanged()
        showToast(userId ? 'Person assigned' : 'Attribution cleared', 'success')
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not assign person', 'error')
      } finally {
        setSavingTxIds((prev) => {
          const next = new Set(prev)
          next.delete(txId)
          return next
        })
      }
    },
    [onAttributionChanged, recentPersonPicksStorageKey, showToast],
  )

  const assignAllShown = useCallback(
    async (userId: string | null) => {
      const targets = filteredRows
      if (targets.length === 0) return
      const label = userId ? userOptionLabel(userOptions, userId) : 'Unassigned'
      if (
        targets.length > 1 &&
        !window.confirm(`Assign ${targets.length} transaction(s) to ${label}?`)
      ) {
        return
      }
      setBulkBusy(true)
      let ok = 0
      try {
        for (const r of targets) {
          try {
            await mercurySetTransactionUserAttribution({
              mercuryTransactionId: r.id,
              userId,
              operationLabel: 'user review bulk assign',
              recentPersonPicksStorageKey,
            })
            ok += 1
          } catch {
            /* collected in the summary toast below */
          }
        }
        await onAttributionChanged()
        showToast(
          `${ok} of ${targets.length} updated`,
          ok === targets.length ? 'success' : 'warning',
        )
      } finally {
        setBulkBusy(false)
        setBulkUserId('')
      }
    },
    [filteredRows, userOptions, onAttributionChanged, recentPersonPicksStorageKey, showToast],
  )

  if (!open) return null

  const filteredTotalAmount = filteredRows.reduce(
    (acc, r) => acc + (Number.isFinite(r.amount) ? r.amount : 0),
    0,
  )
  const selectZIndex = zIndex + 60

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
          maxWidth: 980,
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

        {/* Bulk assign: applies to the currently shown (filtered) rows. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '0.65rem',
            padding: '0.5rem 0.65rem',
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>
            Assign all shown
          </span>
          <div style={{ minWidth: 220, flex: '0 1 280px' }}>
            <SearchableSelect
              value={bulkUserId}
              onChange={setBulkUserId}
              options={userOptions}
              placeholder="Choose a person…"
              listAriaLabel="Assign all shown to person"
              portalZIndex={selectZIndex}
              disabled={bulkBusy || filteredRows.length === 0}
            />
          </div>
          <button
            type="button"
            disabled={bulkBusy || bulkUserId === '' || filteredRows.length === 0}
            onClick={() => void assignAllShown(bulkUserId)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 6,
              border: '1px solid #2563eb',
              background: bulkBusy || bulkUserId === '' || filteredRows.length === 0 ? '#93c5fd' : '#2563eb',
              color: '#fff',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: bulkBusy || bulkUserId === '' || filteredRows.length === 0 ? 'default' : 'pointer',
            }}
          >
            {bulkBusy ? 'Assigning…' : `Apply to ${filteredRows.length}`}
          </button>
          <button
            type="button"
            disabled={bulkBusy || filteredRows.length === 0}
            onClick={() => void assignAllShown(null)}
            style={{
              padding: '0.4rem 0.5rem',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#b91c1c',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: bulkBusy || filteredRows.length === 0 ? 'default' : 'pointer',
            }}
          >
            Unassign all shown
          </button>
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
                  <th style={cellHeaderStyle}>Assign to</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const kind = formatMercuryKind(r.kind)
                  const saving = savingTxIds.has(r.id)
                  const meta = metaByTxId.get(r.id)
                  const cardId = meta?.debitCardId ?? null
                  // For debit-card transactions, show the card nickname (fallback to a compact
                  // card id) instead of the meaningless transaction id.
                  const idDisplay = cardId
                    ? nicknameCtx.nicknameByDebitCard[cardId] ?? formatMercuryDebitCardIdCompact(cardId)
                    : shortUuidPrefix(r.id)
                  const bankDescription = meta?.bankDescription ?? null
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={cellStyle}>{formatBankingDate(r.posted_at)}</td>
                      <td style={cellStyle}>
                        {onOpenTransactionDetail ? (
                          <button
                            type="button"
                            onClick={() => onOpenTransactionDetail(r.id)}
                            title="View transaction detail"
                            style={{
                              fontWeight: 500,
                              color: '#1d4ed8',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              textAlign: 'left',
                              cursor: 'pointer',
                              font: 'inherit',
                              textDecoration: 'underline',
                            }}
                          >
                            {r.counterparty_name?.trim() ?? '—'}
                          </button>
                        ) : (
                          <div style={{ fontWeight: 500, color: '#111827' }}>
                            {r.counterparty_name?.trim() ?? '—'}
                          </div>
                        )}
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                          {kind} · {idDisplay}
                        </div>
                        {bankDescription ? (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#6b7280',
                              marginTop: '0.125rem',
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                            }}
                          >
                            {bankDescription}
                          </div>
                        ) : null}
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
                      <td style={{ ...cellStyle, minWidth: 200 }}>
                        <SearchableSelect
                          value={currentUserId ?? ''}
                          onChange={(v) => void assignOne(r.id, v === '' ? null : v)}
                          options={userOptions}
                          emptyOption={UNASSIGN_OPTION}
                          placeholder="Assign person…"
                          listAriaLabel="Assign person"
                          portalZIndex={selectZIndex}
                          disabled={saving || bulkBusy}
                        />
                        {saving ? (
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.2rem' }}>
                            Saving…
                          </div>
                        ) : null}
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
