import { useEffect } from 'react'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  LEDGER_FILTER_EXCLUDE_COUNTERPARTY_PHRASES_MAX,
  normalizeExcludeCounterpartyContainsFromLines,
  type BankingAccountingLedgerFiltersV1,
} from '../../lib/bankingAccountingLedgerFilters'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'

export type BankingMercuryAccountingLedgerFilterModalProps = {
  open: boolean
  draft: BankingAccountingLedgerFiltersV1
  kindOptions: string[]
  onDraftChange: (next: BankingAccountingLedgerFiltersV1) => void
  onApply: () => void
  onCancel: () => void
  onClearAll: () => void
}

export function BankingMercuryAccountingLedgerFilterModal({
  open,
  draft,
  kindOptions,
  onDraftChange,
  onApply,
  onCancel,
  onClearAll,
}: BankingMercuryAccountingLedgerFilterModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const setAmountMinFromInput = (raw: string) => {
    const t = raw.trim()
    if (t === '') {
      onDraftChange({ ...draft, amountMin: null })
      return
    }
    const n = Number(t)
    onDraftChange({ ...draft, amountMin: Number.isFinite(n) ? n : null })
  }

  const setAmountMaxFromInput = (raw: string) => {
    const t = raw.trim()
    if (t === '') {
      onDraftChange({ ...draft, amountMax: null })
      return
    }
    const n = Number(t)
    onDraftChange({ ...draft, amountMax: Number.isFinite(n) ? n : null })
  }

  const toggleTransactionKind = (kind: string, checked: boolean) => {
    const next = new Set(draft.kinds)
    if (checked) next.add(kind)
    else next.delete(kind)
    onDraftChange({ ...draft, kinds: [...next].sort() })
  }

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
        zIndex: 1260,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-labelledby="banking-accounting-ledger-filter-title"
        style={{
          background: '#fff',
          borderRadius: 10,
          maxWidth: 420,
          width: '100%',
          maxHeight: 'min(90vh, 640px)',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: '1.25rem',
          boxSizing: 'border-box',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="banking-accounting-ledger-filter-title"
          style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 700 }}
        >
          Ledger filters
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#64748b' }}>
          Narrow the Accounting ledger (after search). Posted dates use {APP_CALENDAR_TZ} (company calendar).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <fieldset style={{ margin: 0, padding: 0, border: 'none' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Posted date</legend>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem' }}>
                From
                <input
                  type="date"
                  value={draft.postedFromYmd}
                  onChange={(e) => onDraftChange({ ...draft, postedFromYmd: e.target.value })}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #e5e7eb' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem' }}>
                To
                <input
                  type="date"
                  value={draft.postedToYmd}
                  onChange={(e) => onDraftChange({ ...draft, postedToYmd: e.target.value })}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #e5e7eb' }}
                />
              </label>
            </div>
          </fieldset>

          <fieldset style={{ margin: 0, padding: 0, border: 'none' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Amount (USD)</legend>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem' }}>
                Min
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.amountMin == null ? '' : String(draft.amountMin)}
                  onChange={(e) => setAmountMinFromInput(e.target.value)}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #e5e7eb', minWidth: '7rem' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem' }}>
                Max
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.amountMax == null ? '' : String(draft.amountMax)}
                  onChange={(e) => setAmountMaxFromInput(e.target.value)}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #e5e7eb', minWidth: '7rem' }}
                />
              </label>
            </div>
          </fieldset>

          <fieldset style={{ margin: 0, padding: 0, border: 'none' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Transaction type</legend>
            {kindOptions.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No types in the current Banking-filtered list.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {kindOptions.map((k) => (
                  <label
                    key={k}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={draft.kinds.includes(k)}
                      onChange={(e) => toggleTransactionKind(k, e.target.checked)}
                    />
                    {formatMercuryKind(k)}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset style={{ margin: 0, padding: 0, border: 'none' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Exclude counterparty</legend>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35 }}>
              One phrase per line. Rows are hidden when the bank <strong>counterparty</strong> contains a phrase (case-insensitive). Blank counterparties are not excluded. Max{' '}
              {LEDGER_FILTER_EXCLUDE_COUNTERPARTY_PHRASES_MAX} phrases.
            </p>
            <textarea
              value={draft.excludeCounterpartyContains.join('\n')}
              onChange={(e) =>
                onDraftChange({
                  ...draft,
                  excludeCounterpartyContains: normalizeExcludeCounterpartyContainsFromLines(e.target.value),
                })
              }
              rows={4}
              autoComplete="off"
              placeholder="e.g. amazon.com"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.45rem 0.55rem',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: '4.5rem',
              }}
            />
          </fieldset>

          <fieldset style={{ margin: 0, padding: 0, border: 'none' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Job split</legend>
            <select
              value={draft.jobSplit}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'any' || v === 'has' || v === 'none') {
                  onDraftChange({ ...draft, jobSplit: v })
                }
              }}
              style={{ padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.875rem' }}
            >
              <option value="any">Any</option>
              <option value="has">Has job split</option>
              <option value="none">No job split</option>
            </select>
          </fieldset>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draft.personUnassignedOnly}
              onChange={(e) => onDraftChange({ ...draft, personUnassignedOnly: e.target.checked })}
            />
            Person unassigned only
          </label>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: 'flex-end',
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <button
            type="button"
            onClick={onClearAll}
            style={{
              marginRight: 'auto',
              padding: '0.45rem 0.75rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.875rem',
              border: 'none',
              borderRadius: 6,
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
