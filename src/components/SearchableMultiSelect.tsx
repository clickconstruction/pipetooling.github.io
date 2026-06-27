import { useId, useMemo, useState } from 'react'
import {
  filterSearchableSelectOptionsByQuery,
  isSelectableOption,
  isSeparatorOption,
  SearchableSelectSeparatorListRow,
  type SearchableSelectOption,
} from './SearchableSelect'

const LIST_MAX_HEIGHT_PX = 140

export type SearchableMultiSelectProps = {
  id?: string
  options: SearchableSelectOption[]
  value: string[]
  onChange: (selectedIds: string[]) => void
  disabled?: boolean
  listAriaLabel?: string
  /** Placeholder for the search input (default "Search…"). */
  searchPlaceholder?: string
  /**
   * When true, move selected options to the top of the list (in `value` order) for flat option lists.
   * Skipped when the filtered list contains separator rows.
   */
  pinSelectedToTop?: boolean
}

function toggleId(selected: string[], id: string, checked: boolean): string[] {
  if (checked) {
    if (selected.includes(id)) return selected
    return [...selected, id]
  }
  return selected.filter((x) => x !== id)
}

/** Search field + scrollable checkbox list; supports optional separator options in `options`. */
export function SearchableMultiSelect({
  id: idProp,
  options,
  value,
  onChange,
  disabled = false,
  listAriaLabel = 'Options',
  searchPlaceholder = 'Search…',
  pinSelectedToTop = false,
}: SearchableMultiSelectProps) {
  const reactId = useId()
  const baseId = idProp ?? reactId
  const searchId = `${baseId}-search`
  const listId = `${baseId}-list`

  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => filterSearchableSelectOptionsByQuery(options, query),
    [options, query],
  )

  const rowsToRender = useMemo(() => {
    if (!pinSelectedToTop || value.length === 0) return filtered
    if (filtered.some(isSeparatorOption)) return filtered
    const selectedById = new Map(
      filtered.filter(isSelectableOption).filter((o) => value.includes(o.value)).map((o) => [o.value, o] as const),
    )
    const top: SearchableSelectOption[] = []
    const used = new Set<string>()
    for (const id of value) {
      const row = selectedById.get(id)
      if (row && !used.has(id)) {
        top.push(row)
        used.add(id)
      }
    }
    const rest: SearchableSelectOption[] = []
    for (const row of filtered) {
      if (!isSelectableOption(row)) continue
      if (!value.includes(row.value)) rest.push(row)
    }
    return [...top, ...rest]
  }, [filtered, value, pinSelectedToTop])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <input
        id={searchId}
        type="search"
        autoComplete="off"
        placeholder={searchPlaceholder}
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        aria-controls={listId}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '0.5rem 0.65rem',
          fontSize: '0.875rem',
          border: '1px solid #d1d5db',
          borderRadius: '6px 6px 0 0',
          background: disabled ? '#f3f4f6' : 'white',
        }}
      />
      <ul
        id={listId}
        aria-label={listAriaLabel}
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          maxHeight: LIST_MAX_HEIGHT_PX,
          overflow: 'auto',
          border: '1px solid #d1d5db',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          background: 'white',
        }}
      >
        {rowsToRender.length === 0 ? (
          <li style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af' }}>No matches</li>
        ) : (
          rowsToRender.map((row, idx) => {
            if (isSeparatorOption(row)) {
              return <SearchableSelectSeparatorListRow key={`sep-${row.id}-${idx}`} separator={row} />
            }
            const checked = value.includes(row.value)
            const rowId = `${listId}-opt-${row.value}`
            const nextRow = idx + 1 < rowsToRender.length ? rowsToRender[idx + 1] : undefined
            const nextIsSep = nextRow ? isSeparatorOption(nextRow) : false
            return (
              <li
                key={row.value}
                style={{
                  borderBottom: nextIsSep ? 'none' : '1px solid #f3f4f6',
                }}
              >
                <label
                  htmlFor={rowId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.65rem',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    color: '#111827',
                  }}
                >
                  <input
                    id={rowId}
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onChange(toggleId(value, row.value, e.target.checked))}
                  />
                  <span>{row.label}</span>
                </label>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
