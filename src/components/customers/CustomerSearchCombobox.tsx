import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import {
  customerMatchesSearch,
  customerTypeChipLabel,
  formatCustomerSecondaryLine,
  getCustomerDisplay,
  type CustomerRow,
} from '../../lib/customerContactDisplay'

/** Light yellow row tint for commercial (non-selected); selected rows use green instead. */
const COMMERCIAL_ROW_BG = '#fffbeb'

const MAX_ROWS = 50

const ROOT_CLASS = 'customer-search-combobox'

const focusVisibleCss = `
  .${ROOT_CLASS} input:focus-visible,
  .${ROOT_CLASS} button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`

const inputStyle = (inputDisabled: boolean, withTrailingClear?: boolean): CSSProperties => ({
  width: '100%',
  padding: '0.5rem',
  paddingRight: withTrailingClear ? '2.35rem' : '0.5rem',
  boxSizing: 'border-box',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  fontSize: '0.875rem',
  opacity: inputDisabled ? 0.65 : 1,
  cursor: inputDisabled ? 'not-allowed' : 'text',
})

/** Font Awesome Free v7.2.0 rectangle-xmark — used as clear control. */
function ClearCustomerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden style={{ width: 18, height: 18, display: 'block' }}>
      <path
        fill="currentColor"
        d="M128 176C119.2 176 112 183.2 112 192L112 448C112 456.8 119.2 464 128 464L512 464C520.8 464 528 456.8 528 448L528 192C528 183.2 520.8 176 512 176L128 176zM64 192C64 156.7 92.7 128 128 128L512 128C547.3 128 576 156.7 576 192L576 448C576 483.3 547.3 512 512 512L128 512C92.7 512 64 483.3 64 448L64 192zM398.1 241.9C407.5 251.3 407.5 266.5 398.1 275.8L354 319.9L398.1 364C407.5 373.4 407.5 388.6 398.1 397.9C388.7 407.2 373.5 407.3 364.2 397.9L320.1 353.8L276 397.9C266.6 407.3 251.4 407.3 242.1 397.9C232.8 388.5 232.7 373.3 242.1 364L286.2 319.9L242.1 275.8C232.7 266.4 232.7 251.2 242.1 241.9C251.5 232.6 266.7 232.5 276 241.9L320.1 286L364.2 241.9C373.6 232.5 388.8 232.5 398.1 241.9z"
      />
    </svg>
  )
}

const panelStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '100%',
  marginTop: 2,
  maxHeight: 280,
  overflowY: 'auto',
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  zIndex: 40,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.08)',
}

const smallSecondaryButtonStyle: CSSProperties = {
  padding: '0.35rem 0.65rem',
  fontSize: '0.8125rem',
  fontWeight: 500,
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--bg-muted)',
  color: 'var(--text-700)',
  cursor: 'pointer',
}

const footerCreateStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0.65rem 0.75rem',
  border: 'none',
  borderTop: '2px solid var(--border)',
  background: 'var(--bg-orange-tint)',
  fontWeight: 600,
  color: 'var(--text-orange-700)',
  cursor: 'pointer',
  fontSize: '0.875rem',
}

export type CustomerSearchComboboxProps = {
  customers: CustomerRow[]
  loading?: boolean
  valueId: string | null
  searchText: string
  onSearchTextChange: (text: string) => void
  onSelect: (customer: CustomerRow) => void
  onClear?: () => void
  /** Optional secondary action below the field when a row is selected (e.g. open Edit customer modal). Clear is the trailing icon on the input. */
  onRequestEditSelected?: () => void
  onRequestCreateNew?: () => void
  disabled?: boolean
  placeholder?: string
  'aria-label'?: string
}

export default function CustomerSearchCombobox({
  customers,
  loading = false,
  valueId,
  searchText,
  onSearchTextChange,
  onSelect,
  onClear,
  onRequestEditSelected,
  onRequestCreateNew,
  disabled = false,
  placeholder = 'Search customers…',
  'aria-label': ariaLabel = 'Search customers',
}: CustomerSearchComboboxProps) {
  const reactId = useId()
  const listboxId = `${reactId}-list`
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered = useMemo(() => {
    return customers.filter((c) => customerMatchesSearch(c, searchText)).slice(0, MAX_ROWS)
  }, [customers, searchText])

  const optionCount = filtered.length
  const hasCreateFooter = Boolean(onRequestCreateNew)
  const totalSlots = optionCount + (hasCreateFooter ? 1 : 0)

  function optionIdForCustomer(customerId: string): string {
    return `${listboxId}-opt-${customerId}`
  }

  const createFooterId = `${listboxId}-create`

  function clearBlurTimeout() {
    if (blurTimeout.current) {
      clearTimeout(blurTimeout.current)
      blurTimeout.current = null
    }
  }

  function closePanel() {
    setOpen(false)
    setHighlightIndex(null)
  }

  function handleFocus() {
    clearBlurTimeout()
    setOpen(true)
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => {
      closePanel()
      blurTimeout.current = null
    }, 200)
  }

  /** Reset keyboard highlight when the query or list changes while open. */
  useEffect(() => {
    if (!open || loading) return
    if (totalSlots === 0) {
      setHighlightIndex(null)
      return
    }
    const selIdx = valueId ? filtered.findIndex((c) => c.id === valueId) : -1
    setHighlightIndex(selIdx >= 0 ? selIdx : 0)
  }, [searchText, customers, open, loading, valueId, filtered, totalSlots])

  function moveHighlight(delta: number) {
    if (totalSlots === 0) return
    setHighlightIndex((prev) => {
      const cur = prev ?? 0
      return (cur + delta + totalSlots) % totalSlots
    })
  }

  function applySelectionFromHighlight() {
    if (totalSlots === 0) return
    const hi = highlightIndex
    if (hi === null) {
      if (optionCount === 1) {
        onSelect(filtered[0]!)
        closePanel()
      }
      return
    }
    if (hi < optionCount) {
      onSelect(filtered[hi]!)
      closePanel()
      return
    }
    if (hasCreateFooter && hi === optionCount) {
      onRequestCreateNew?.()
      closePanel()
    }
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled || loading) return

    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        closePanel()
      }
      return
    }

    if (!open || !totalSlots) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveHighlight(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveHighlight(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      applySelectionFromHighlight()
    }
  }

  const activeDescendantId =
    open && !loading && highlightIndex != null && totalSlots > 0
      ? highlightIndex < optionCount
        ? optionIdForCustomer(filtered[highlightIndex]!.id)
        : hasCreateFooter
          ? createFooterId
          : undefined
      : undefined

  const inputDisabled = disabled || loading
  const showTrailingClear = Boolean(onClear && valueId && !inputDisabled)

  return (
    <div className={ROOT_CLASS} style={{ maxWidth: 480 }}>
      <style>{focusVisibleCss}</style>
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchTextChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={loading ? 'Loading customers…' : placeholder}
          disabled={inputDisabled}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          style={inputStyle(inputDisabled, showTrailingClear)}
        />
        {showTrailingClear ? (
          <button
            type="button"
            aria-label="Clear customer"
            title="Clear customer"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClear?.()
              closePanel()
            }}
            style={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              padding: 0,
              border: 'none',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <ClearCustomerIcon />
          </button>
        ) : null}
        {open && !loading && (
          <div id={listboxId} role="listbox" style={panelStyle}>
          {filtered.length === 0 ? (
            <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No matching customers.</div>
          ) : (
            filtered.map((c, index) => {
              const selected = valueId === c.id
              const highlighted = highlightIndex === index
              const rowBg = selected ? '#f0fdf4' : c.customer_type === 'commercial' ? COMMERCIAL_ROW_BG : 'white'
              const rowBackground = highlighted && !selected ? '#eff6ff' : rowBg
              const chip = customerTypeChipLabel(c)
              return (
                <button
                  key={c.id}
                  id={optionIdForCustomer(c.id)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => {
                    onSelect(c)
                    closePanel()
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    background: rowBackground,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 500,
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {getCustomerDisplay(c)}
                    </span>
                    {chip != null && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          background: 'var(--bg-muted)',
                          color: 'var(--text-600)',
                          flexShrink: 0,
                        }}
                      >
                        {chip}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{formatCustomerSecondaryLine(c)}</div>
                </button>
              )
            })
          )}
          {onRequestCreateNew && (
            <button
              id={createFooterId}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => hasCreateFooter && setHighlightIndex(optionCount)}
              onClick={() => {
                onRequestCreateNew()
                closePanel()
              }}
              style={{
                ...footerCreateStyle,
                ...(highlightIndex === optionCount && optionCount >= 0 ?
                  { background: '#ffedd5' }
                : {}),
              }}
            >
              Create new customer
            </button>
          )}
        </div>
        )}
      </div>
      {onRequestEditSelected && valueId ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onRequestEditSelected()}
          style={{ ...smallSecondaryButtonStyle, marginTop: '0.35rem' }}
        >
          Edit customer
        </button>
      ) : null}
    </div>
  )
}
