import { useId, useMemo, useState } from 'react'
import {
  filterSearchableSelectOptionsByQuery,
  isSeparatorOption,
  type SearchableSelectOption,
} from '../SearchableSelect'

const LIST_MAX_HEIGHT_PX = 220

type Props = {
  id?: string
  options: SearchableSelectOption[]
  value: string[]
  onChange: (userIds: string[]) => void
  disabled?: boolean
  listAriaLabel?: string
}

function toggleId(selected: string[], id: string, checked: boolean): string[] {
  if (checked) {
    if (selected.includes(id)) return selected
    return [...selected, id]
  }
  return selected.filter((x) => x !== id)
}

export function ScheduleAssigneeMultiPicker({
  id: idProp,
  options,
  value,
  onChange,
  disabled = false,
  listAriaLabel = 'Team members',
}: Props) {
  const reactId = useId()
  const baseId = idProp ?? reactId
  const searchId = `${baseId}-search`
  const listId = `${baseId}-list`

  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => filterSearchableSelectOptionsByQuery(options, query),
    [options, query],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        id={searchId}
        type="search"
        autoComplete="off"
        placeholder="Search…"
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
          borderRadius: 4,
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
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: 'white',
        }}
      >
        {filtered.length === 0 ? (
          <li style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af' }}>No matches</li>
        ) : (
          filtered.map((row, idx) => {
            if (isSeparatorOption(row)) {
              return (
                <li
                  key={`sep-${row.id}-${idx}`}
                  role="separator"
                  aria-hidden
                  style={{
                    margin: 0,
                    padding: '0.35rem 0.5rem 0',
                    background: '#f9fafb',
                  }}
                >
                  <div style={{ borderTop: '1px solid #d1d5db', margin: 0 }} />
                </li>
              )
            }
            const checked = value.includes(row.value)
            const rowId = `${listId}-opt-${row.value}`
            const nextRow = idx + 1 < filtered.length ? filtered[idx + 1] : undefined
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
