import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

export type ChipsWithSearchPickerOption = {
  value: string
  label: string
}

export type ChipsWithSearchPickerProps = {
  id?: string
  value: string[]
  onChange: (next: string[]) => void
  /** Resolves the display label for an id currently in `value`. */
  getLabelForId: (id: string) => string
  /**
   * Returns matching options for the typed query. The picker filters already-selected ids out of
   * the returned list, so callers may include them. Must abort early when `signal.aborted` is
   * true (Supabase JS supports `.abortSignal(signal)` for RPC calls).
   */
  search: (query: string, signal: AbortSignal) => Promise<ChipsWithSearchPickerOption[]>
  /** When the picked option is added to `value`, also bubble the label up so the caller can
   *  cache it for chip rendering on subsequent searches. */
  onOptionPicked?: (option: ChipsWithSearchPickerOption) => void
  /** Recommended ~250ms for async server search; 0 is fine for sync client-side filtering. */
  debounceMs?: number
  /** How many characters required before the dropdown shows results. Default 2. */
  searchMinLength?: number
  /** Max rows rendered in the dropdown. Default 20. */
  maxResults?: number
  placeholder?: string
  disabled?: boolean
  searchInputAriaLabel?: string
  resultsListAriaLabel?: string
  /** Override the under-min-length hint. Default: `Type at least 2 letters to search.` */
  belowMinLengthHint?: string
}

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginBottom: 6,
}

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '0.2rem 0.55rem',
  fontSize: '0.8125rem',
  background: '#eef2ff',
  border: '1px solid #c7d2fe',
  borderRadius: 999,
  color: '#1e3a8a',
  maxWidth: '100%',
}

const chipRemoveBtnStyle: CSSProperties = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  color: '#1e3a8a',
  cursor: 'pointer',
  fontSize: '0.85rem',
  lineHeight: 1,
  padding: 0,
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.5rem 0.65rem',
  fontSize: '0.875rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
}

const dropdownStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  maxHeight: 200,
  overflow: 'auto',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
}

const dropdownRowButtonStyle: CSSProperties = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  width: '100%',
  textAlign: 'left',
  padding: '0.5rem 0.65rem',
  fontSize: '0.875rem',
  color: 'var(--text-strong)',
  cursor: 'pointer',
}

const statusRowStyle: CSSProperties = {
  padding: '0.5rem 0.65rem',
  fontSize: '0.8125rem',
  color: 'var(--text-muted)',
}

const DEFAULT_BELOW_MIN_HINT = 'Type at least 2 letters to search.'

/**
 * Compact "chips + on-demand search" picker.
 *
 * - Selected ids render as removable chips above the input.
 * - The result dropdown is hidden until the user has typed at least `searchMinLength` chars,
 *   keeping the modal compact and avoiding accidental scanning of large rosters.
 * - `search` may be sync (client-side filter wrapped in `Promise.resolve(...)`) or async (live RPC);
 *   in both cases the picker debounces by `debounceMs` and cancels in-flight calls via the signal.
 */
export function ChipsWithSearchPicker({
  id: idProp,
  value,
  onChange,
  getLabelForId,
  search,
  onOptionPicked,
  debounceMs = 0,
  searchMinLength = 2,
  maxResults = 20,
  placeholder = 'Search…',
  disabled = false,
  searchInputAriaLabel,
  resultsListAriaLabel = 'Search results',
  belowMinLengthHint = DEFAULT_BELOW_MIN_HINT,
}: ChipsWithSearchPickerProps) {
  const reactId = useId()
  const baseId = idProp ?? reactId
  const searchInputId = `${baseId}-search`
  const resultsId = `${baseId}-results`

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ChipsWithSearchPickerOption[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement | null>(null)

  const trimmed = query.trim()
  const meetsMin = trimmed.length >= searchMinLength

  useEffect(() => {
    if (!meetsMin) {
      setResults([])
      setLoading(false)
      setErrorMessage(null)
      return
    }
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setErrorMessage(null)
    const timer = window.setTimeout(() => {
      Promise.resolve()
        .then(() => search(trimmed, controller.signal))
        .then((rows) => {
          if (cancelled || controller.signal.aborted) return
          const valueSet = new Set(value)
          const filtered = rows.filter((r) => !valueSet.has(r.value)).slice(0, maxResults)
          setResults(filtered)
          setLoading(false)
        })
        .catch((err: unknown) => {
          if (cancelled || controller.signal.aborted) return
          // AbortError is expected when the next keystroke supersedes the call.
          const message =
            err instanceof Error && err.name !== 'AbortError'
              ? err.message
              : err instanceof Error
                ? null
                : 'Search failed.'
          if (message != null) setErrorMessage(message)
          setLoading(false)
        })
    }, debounceMs)
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [trimmed, meetsMin, debounceMs, search, value, maxResults])

  const handlePick = (opt: ChipsWithSearchPickerOption) => {
    if (disabled) return
    if (value.includes(opt.value)) return
    onChange([...value, opt.value])
    onOptionPicked?.(opt)
    setQuery('')
    setResults([])
    // Restore focus on the input so the user can keep adding without re-tabbing.
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const handleRemove = (id: string) => {
    if (disabled) return
    onChange(value.filter((v) => v !== id))
  }

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // First result is the implicit pick on Enter when there's one visible row.
      const first = results[0]
      if (first) {
        e.preventDefault()
        handlePick(first)
      }
    } else if (e.key === 'Backspace' && query === '' && value.length > 0) {
      // Quick keyboard removal: backspace with an empty query drops the last chip.
      const last = value[value.length - 1]
      if (last !== undefined) {
        e.preventDefault()
        handleRemove(last)
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {value.length > 0 ? (
        <ul style={chipRowStyle} aria-label="Selected">
          {value.map((id) => (
            <li key={id} style={chipStyle}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getLabelForId(id)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${getLabelForId(id)}`}
                title="Remove"
                onClick={() => handleRemove(id)}
                disabled={disabled}
                style={chipRemoveBtnStyle}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        id={searchInputId}
        type="search"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        aria-label={searchInputAriaLabel}
        aria-controls={resultsId}
        aria-expanded={meetsMin}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleInputKeyDown}
        style={{ ...inputStyle, background: disabled ? 'var(--bg-muted)' : 'var(--surface)' }}
      />

      {trimmed.length === 0 ? (
        <p style={{ ...statusRowStyle, margin: 0 }}>{belowMinLengthHint}</p>
      ) : !meetsMin ? (
        <p style={{ ...statusRowStyle, margin: 0 }}>{belowMinLengthHint}</p>
      ) : (
        <ul id={resultsId} aria-label={resultsListAriaLabel} style={dropdownStyle}>
          {loading ? (
            <li style={statusRowStyle}>Searching…</li>
          ) : errorMessage ? (
            <li style={{ ...statusRowStyle, color: 'var(--text-red-700)' }}>{errorMessage}</li>
          ) : results.length === 0 ? (
            <li style={statusRowStyle}>No matches.</li>
          ) : (
            results.map((r, idx) => (
              <li
                key={r.value}
                style={{ borderBottom: idx + 1 < results.length ? '1px solid var(--border)' : 'none' }}
              >
                <button
                  type="button"
                  onClick={() => handlePick(r)}
                  disabled={disabled}
                  style={dropdownRowButtonStyle}
                >
                  {r.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
