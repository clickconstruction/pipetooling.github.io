import { useRef, useState } from 'react'
import type { RoughTakeoffMaterialPart } from './SortableRoughPartLineRow'
import type { MaterialTemplateWithAssemblyType } from '../../lib/bids/bidPricingEngineTypes'

export type TakeoffItemSearchPick =
  | { kind: 'part'; id: string }
  | { kind: 'template'; id: string }

/** Flattened dropdown row: group headers are skipped by keyboard navigation. */
type ComboRow =
  | { rowType: 'header'; label: string }
  | { rowType: 'part'; part: RoughTakeoffMaterialPart }
  | { rowType: 'template'; template: MaterialTemplateWithAssemblyType }
  | { rowType: 'create'; query: string }

const PART_RESULT_LIMIT = 30
const TEMPLATE_RESULT_LIMIT = 20

/**
 * Unified pick-and-stay-open search over parts AND assemblies for the Add
 * Assembly modal (v2.1326): picking a result fires `onPick` immediately (no
 * staged type/qty/"Add item" controls), the query clears, and focus stays in
 * the input so the next search starts at once. When nothing matches (or as the
 * last row of any result list), an optional "Add … as a new part" action row
 * routes into the Add Part modal. Enter never submits the surrounding form.
 */
export function TakeoffItemSearchCombobox({
  parts,
  templates,
  filterPartsByQuery,
  filterTemplatesByQuery,
  onPick,
  onCreateNew,
  partsLoading = false,
  placeholder = 'Search parts and assemblies…',
}: {
  parts: RoughTakeoffMaterialPart[]
  /** Pass [] to search parts only (no Assemblies group). */
  templates: MaterialTemplateWithAssemblyType[]
  filterPartsByQuery: (parts: RoughTakeoffMaterialPart[], query: string, limit?: number) => RoughTakeoffMaterialPart[]
  filterTemplatesByQuery: (templates: MaterialTemplateWithAssemblyType[], query: string, limit?: number) => MaterialTemplateWithAssemblyType[]
  onPick: (pick: TakeoffItemSearchPick) => void
  onCreateNew?: (query: string) => void
  partsLoading?: boolean
  placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const matchedParts = filterPartsByQuery(parts, query, PART_RESULT_LIMIT)
  const matchedTemplates = filterTemplatesByQuery(templates, query, TEMPLATE_RESULT_LIMIT)

  const rows: ComboRow[] = []
  if (matchedParts.length > 0) {
    rows.push({ rowType: 'header', label: 'Parts' })
    for (const part of matchedParts) rows.push({ rowType: 'part', part })
  }
  if (matchedTemplates.length > 0) {
    rows.push({ rowType: 'header', label: 'Assemblies' })
    for (const template of matchedTemplates) rows.push({ rowType: 'template', template })
  }
  if (onCreateNew && query.trim()) {
    rows.push({ rowType: 'create', query: query.trim() })
  }

  const selectableIndexes = rows
    .map((row, idx) => (row.rowType === 'header' ? -1 : idx))
    .filter((idx) => idx >= 0)

  function applyRow(row: ComboRow) {
    if (row.rowType === 'part') {
      onPick({ kind: 'part', id: row.part.id })
    } else if (row.rowType === 'template') {
      onPick({ kind: 'template', id: row.template.id })
    } else if (row.rowType === 'create') {
      onCreateNew?.(row.query)
      setOpen(false)
    } else {
      return
    }
    setQuery('')
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  function moveActive(direction: 1 | -1) {
    if (selectableIndexes.length === 0) return
    const currentPos = selectableIndexes.indexOf(activeIndex)
    const nextPos =
      currentPos < 0
        ? direction === 1
          ? 0
          : selectableIndexes.length - 1
        : (currentPos + direction + selectableIndexes.length) % selectableIndexes.length
    setActiveIndex(selectableIndexes[nextPos]!)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      moveActive(e.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (e.key === 'Enter') {
      // Never let Enter submit the surrounding form from the search box.
      e.preventDefault()
      const active = activeIndex >= 0 ? rows[activeIndex] : undefined
      if (active && active.rowType !== 'header') {
        applyRow(active)
        return
      }
      // No highlighted row: a lone result (plus at most the create row) picks itself;
      // otherwise fall through to create-new when it's the only row.
      const lone = selectableIndexes.length === 1 ? rows[selectableIndexes[0]!] : undefined
      const loneNonCreate =
        selectableIndexes.length === 2 &&
        rows[selectableIndexes[1]!]?.rowType === 'create'
          ? rows[selectableIndexes[0]!]
          : undefined
      const target = lone ?? loneNonCreate
      if (target && target.rowType !== 'header') applyRow(target)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIndex(-1)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '0.5rem',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
        }}
      />
      {open && (
        <ul
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            margin: 0,
            marginTop: 2,
            padding: 0,
            listStyle: 'none',
            maxHeight: 240,
            overflowY: 'auto',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: 'var(--surface)',
            zIndex: 60,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        >
          {partsLoading && parts.length === 0 ? (
            <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>Loading parts…</li>
          ) : rows.length === 0 ? (
            <li style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {query.trim() ? 'No matches.' : 'Type to search.'}
            </li>
          ) : (
            rows.map((row, idx) => {
              if (row.rowType === 'header') {
                return (
                  <li
                    key={`h-${row.label}`}
                    aria-hidden
                    style={{
                      padding: '0.3rem 0.75rem 0.15rem',
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-subtle)',
                    }}
                  >
                    {row.label}
                  </li>
                )
              }
              const isActive = idx === activeIndex
              const rowStyle = {
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                background: isActive ? 'var(--bg-blue-tint)' : undefined,
              }
              if (row.rowType === 'create') {
                return (
                  <li
                    key="create-new"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => applyRow(row)}
                    style={{ ...rowStyle, color: 'var(--text-blue-700)', fontWeight: 500, fontSize: '0.875rem' }}
                  >
                    + Add “{row.query}” as a new part…
                  </li>
                )
              }
              const title = row.rowType === 'part' ? row.part.name : row.template.name
              const subtitle =
                row.rowType === 'part'
                  ? [row.part.manufacturer, row.part.part_types?.name].filter(Boolean).join(' · ')
                  : (row.template.description ?? '')
              return (
                <li
                  key={`${row.rowType}-${row.rowType === 'part' ? row.part.id : row.template.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => applyRow(row)}
                  style={rowStyle}
                >
                  <div style={{ fontWeight: 500 }}>{title}</div>
                  {subtitle && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{subtitle}</div>
                  )}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
