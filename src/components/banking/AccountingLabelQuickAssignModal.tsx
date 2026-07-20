import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  buildSortedAccountingLabelRows,
  filterAccountingLabelsByQuery,
  type AccountingDragLabelRow,
} from '../../lib/accountingLabelSelectOptions'

export type AccountingLabelQuickAssignModalProps = {
  open: boolean
  txId: string | null
  transactionSummary?: string
  labels: AccountingDragLabelRow[]
  labelAssignmentCountById: Record<string, number>
  busy?: boolean
  onAssign: (labelId: string) => void
  onClose: () => void
}

export function AccountingLabelQuickAssignModal({
  open,
  txId,
  transactionSummary,
  labels,
  labelAssignmentCountById,
  busy = false,
  onAssign,
  onClose,
}: AccountingLabelQuickAssignModalProps) {
  const titleId = useId()
  const searchId = useId()
  const listboxId = useId()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const sortedLabels = useMemo(
    () => buildSortedAccountingLabelRows(labels, labelAssignmentCountById),
    [labels, labelAssignmentCountById],
  )

  const filteredLabels = useMemo(
    () => filterAccountingLabelsByQuery(sortedLabels, query),
    [sortedLabels, query],
  )

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [open, txId])

  useEffect(() => {
    if (activeIndex >= filteredLabels.length) {
      setActiveIndex(filteredLabels.length > 0 ? 0 : -1)
    }
  }, [filteredLabels.length, activeIndex])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const el = optionRefs.current.get(activeIndex)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, filteredLabels])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const assignAt = useCallback(
    (index: number) => {
      if (busy) return
      const row = filteredLabels[index]
      if (!row) return
      onAssign(row.id)
    },
    [busy, filteredLabels, onAssign],
  )

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (filteredLabels.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => {
        if (i < 0) return 0
        return Math.min(i + 1, filteredLabels.length - 1)
      })
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => {
        if (i < 0) return filteredLabels.length - 1
        return Math.max(i - 1, 0)
      })
      return
    }
    if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      assignAt(activeIndex)
    }
  }

  if (!open || !txId) return null

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
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          maxWidth: 420,
          width: '100%',
          maxHeight: 'min(90vh, 560px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: '1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <h2 id={titleId} style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
          Assign accounting label
        </h2>
        {transactionSummary ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-slate-500)' }}>{transactionSummary}</p>
        ) : null}
        <label htmlFor={searchId} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
          Search labels
        </label>
        <input
          ref={searchInputRef}
          id={searchId}
          type="search"
          value={query}
          disabled={busy || labels.length === 0}
          autoComplete="off"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && filteredLabels[activeIndex]
              ? `accounting-quick-assign-opt-${filteredLabels[activeIndex].id}`
              : undefined
          }
          placeholder={labels.length === 0 ? 'No labels available' : 'Type to filter…'}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={onSearchKeyDown}
          style={{
            width: '100%',
            padding: '0.5rem 0.65rem',
            fontSize: '0.875rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            boxSizing: 'border-box',
            marginBottom: '0.75rem',
          }}
        />
        <div
          id={listboxId}
          role="listbox"
          aria-label="Accounting labels"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 6,
            maxHeight: 320,
          }}
        >
          {filteredLabels.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-slate-500)' }}>
              {labels.length === 0 ? 'No accounting labels configured.' : 'No labels match this search.'}
            </div>
          ) : (
            filteredLabels.map((L, idx) => {
              const highlighted = idx === activeIndex
              return (
                <button
                  key={L.id}
                  id={`accounting-quick-assign-opt-${L.id}`}
                  type="button"
                  role="option"
                  aria-selected={highlighted}
                  ref={(el) => {
                    if (el) optionRefs.current.set(idx, el)
                    else optionRefs.current.delete(idx)
                  }}
                  disabled={busy}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => assignAt(idx)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    border: 'none',
                    borderBottom: idx < filteredLabels.length - 1 ? '1px solid var(--border)' : 'none',
                    background: highlighted ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: 'var(--text-slate-900)',
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  {L.name}
                </button>
              )
            })
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
