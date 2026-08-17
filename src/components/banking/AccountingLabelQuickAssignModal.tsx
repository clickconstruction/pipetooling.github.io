import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  buildSortedAccountingLabelRows,
  filterAccountingLabelsByQuery,
  type AccountingDragLabelRow,
} from '../../lib/accountingLabelSelectOptions'
import {
  SearchableSelect,
  type SearchableSelectOption,
  type SearchableSelectSelectableOption,
} from '../SearchableSelect'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'

export type AccountingLabelQuickAssignModalProps = {
  open: boolean
  txId: string | null
  transactionSummary?: string
  labels: AccountingDragLabelRow[]
  labelAssignmentCountById: Record<string, number>
  busy?: boolean
  /**
   * 'assign' (default): pick a label, optionally a person. 'person-only':
   * opened from a labeled row's "| add person" — just the person picker.
   */
  mode?: 'assign' | 'person-only'
  /** u:/p: attribution options (buildBankingAttributionOptions shape). */
  personOptions?: SearchableSelectOption[]
  /** "Add … as a sub" mint from the person picker (v2.1727 pattern). */
  onCreatePerson?: (name: string) => Promise<SearchableSelectSelectableOption | null>
  /** personValue: '' = no person, else 'p:<id>' / 'u:<id>'. */
  onAssign: (labelId: string, personValue: string) => void
  /** person-only mode commit. */
  onAssignPerson?: (personValue: string) => void
  onClose: () => void
}

/**
 * Quick assign from the Sorting Ledger's "+" (and "| add person"). Responsive
 * per the owner's pick (v2.1742): desktop = option C, side-by-side label list +
 * person select with an explicit Save; narrow screens = option A, the person
 * select rides above the label list and clicking a label commits both in one
 * tap (leave the person on "no person" and it behaves exactly like the old
 * one-click assign).
 */
export function AccountingLabelQuickAssignModal({
  open,
  txId,
  transactionSummary,
  labels,
  labelAssignmentCountById,
  busy = false,
  mode = 'assign',
  personOptions,
  onCreatePerson,
  onAssign,
  onAssignPerson,
  onClose,
}: AccountingLabelQuickAssignModalProps) {
  const titleId = useId()
  const searchId = useId()
  const listboxId = useId()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [personValue, setPersonValue] = useState('')
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [createdPersonOptions, setCreatedPersonOptions] = useState<SearchableSelectSelectableOption[]>([])
  const isNarrow = useIsNarrowScreen()
  const personOnly = mode === 'person-only'
  const wide = !isNarrow && !personOnly

  const allPersonOptions = useMemo(
    () => (personOptions ? [...personOptions, ...createdPersonOptions] : createdPersonOptions),
    [personOptions, createdPersonOptions],
  )

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
    setPersonValue('')
    setSelectedLabelId(null)
    if (!personOnly) requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [open, txId, personOnly])

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

  const handleCreatePersonFromPicker = (q: string) => {
    if (!onCreatePerson) return
    void (async () => {
      const created = await onCreatePerson(q.trim())
      if (!created) return
      setCreatedPersonOptions((prev) => (prev.some((o) => o.value === created.value) ? prev : [...prev, created]))
      setPersonValue(created.value)
    })()
  }

  // Narrow (option A): clicking a label commits label + whatever person is set.
  // Wide (option C): clicking selects; Save commits.
  const pickAt = useCallback(
    (index: number) => {
      if (busy) return
      const row = filteredLabels[index]
      if (!row) return
      if (wide) {
        setSelectedLabelId(row.id)
        return
      }
      onAssign(row.id, personValue)
    },
    [busy, filteredLabels, onAssign, personValue, wide],
  )

  const saveWide = useCallback(() => {
    if (busy || !selectedLabelId) return
    onAssign(selectedLabelId, personValue)
  }, [busy, onAssign, personValue, selectedLabelId])

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
      const row = filteredLabels[activeIndex]
      // Wide: first Enter selects, Enter again on the same row saves.
      if (wide && row && selectedLabelId === row.id) {
        saveWide()
        return
      }
      pickAt(activeIndex)
    }
  }

  if (!open || !txId) return null

  const personPicker = (
    <SearchableSelect
      value={personValue}
      onChange={setPersonValue}
      options={allPersonOptions}
      noMatchesAction={
        onCreatePerson
          ? { label: (q) => `Add “${q.trim()}” to People as a sub`, onSelect: handleCreatePersonFromPicker }
          : undefined
      }
      emptyOption={{ value: '', label: ' - no person - ' }}
      hideEmptyOptionInListWhenUnset={false}
      searchReplacesTrigger
      listMaxHeightPx={280}
      listOptionPadding="0.35rem 0.5rem"
      listOptionFontSize="0.8125rem"
      disabled={busy}
      listAriaLabel="People to attribute"
      portalZIndex={1300}
    />
  )

  const labelList = (
    <>
      <label htmlFor={searchId} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
        {wide ? 'Accounting label' : 'Search labels'}
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
            const selected = wide && selectedLabelId === L.id
            return (
              <button
                key={L.id}
                id={`accounting-quick-assign-opt-${L.id}`}
                type="button"
                role="option"
                aria-selected={selected || highlighted}
                ref={(el) => {
                  if (el) optionRefs.current.set(idx, el)
                  else optionRefs.current.delete(idx)
                }}
                disabled={busy}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => pickAt(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: selected ? 600 : 400,
                  border: 'none',
                  borderBottom: idx < filteredLabels.length - 1 ? '1px solid var(--border)' : 'none',
                  background: selected || highlighted ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: 'var(--text-slate-900)',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{L.name}</span>
                {selected ? <span aria-hidden style={{ color: 'var(--text-link)', flexShrink: 0 }}>✓</span> : null}
              </button>
            )
          })
        )}
      </div>
    </>
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
          maxWidth: personOnly ? 400 : wide ? 640 : 420,
          width: '100%',
          maxHeight: 'min(90vh, 620px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: '1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <h2 id={titleId} style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
          {personOnly ? 'Tag person' : 'Label this transaction'}
        </h2>
        {transactionSummary ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-slate-500)' }}>{transactionSummary}</p>
        ) : null}

        {personOnly ? (
          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>Person</span>
            {personPicker}
          </div>
        ) : wide ? (
          <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
            <div style={{ flex: '1.4 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>{labelList}</div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
                Person <span style={{ fontWeight: 400, color: 'var(--text-slate-500)' }}>(optional)</span>
              </span>
              {personPicker}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
              Person <span style={{ fontWeight: 400, color: 'var(--text-slate-500)' }}>(optional — saved with the label)</span>
            </span>
            <div style={{ marginBottom: '0.75rem' }}>{personPicker}</div>
            {labelList}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.85rem' }}>
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
          {personOnly ? (
            <button
              type="button"
              disabled={busy || personValue === ''}
              onClick={() => onAssignPerson?.(personValue)}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 6,
                background: busy || personValue === '' ? 'var(--bg-200)' : '#2563eb',
                color: busy || personValue === '' ? 'var(--text-slate-500)' : '#fff',
                cursor: busy || personValue === '' ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          ) : wide ? (
            <button
              type="button"
              disabled={busy || !selectedLabelId}
              onClick={saveWide}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 6,
                background: busy || !selectedLabelId ? 'var(--bg-200)' : '#2563eb',
                color: busy || !selectedLabelId ? 'var(--text-slate-500)' : '#fff',
                cursor: busy || !selectedLabelId ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
