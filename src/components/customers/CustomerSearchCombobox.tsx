import { useMemo, useRef, useState } from 'react'
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

export type CustomerSearchComboboxProps = {
  customers: CustomerRow[]
  loading?: boolean
  valueId: string | null
  searchText: string
  onSearchTextChange: (text: string) => void
  onSelect: (customer: CustomerRow) => void
  onClear?: () => void
  /** Shown left of Clear when a row is selected (e.g. open global Edit customer modal). */
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
  const [open, setOpen] = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered = useMemo(() => {
    return customers.filter((c) => customerMatchesSearch(c, searchText)).slice(0, MAX_ROWS)
  }, [customers, searchText])

  function clearBlurTimeout() {
    if (blurTimeout.current) {
      clearTimeout(blurTimeout.current)
      blurTimeout.current = null
    }
  }

  function handleFocus() {
    clearBlurTimeout()
    setOpen(true)
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => {
      setOpen(false)
      blurTimeout.current = null
    }, 200)
  }

  return (
    <div style={{ position: 'relative', maxWidth: 480 }}>
      <input
        type="text"
        value={searchText}
        onChange={(e) => onSearchTextChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={loading ? 'Loading customers…' : placeholder}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls="customer-search-combobox-list"
        autoComplete="off"
        style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 4 }}
      />
      {onClear && valueId && !onRequestEditSelected && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onClear()
            setOpen(false)
          }}
          style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          Clear customer
        </button>
      )}
      {onClear && valueId && onRequestEditSelected && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.35rem',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onRequestEditSelected()}
            style={{
              fontSize: '0.85rem',
              color: '#2563eb',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            Edit customer
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClear()
              setOpen(false)
            }}
            style={{ fontSize: '0.85rem', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            Clear customer
          </button>
        </div>
      )}
      {open && !loading && (
        <div
          id="customer-search-combobox-list"
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 2,
            maxHeight: 280,
            overflowY: 'auto',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            zIndex: 40,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.9rem' }}>No matching customers.</div>
          ) : (
            filtered.map((c) => {
              const selected = valueId === c.id
              const rowBg = selected ? '#f0fdf4' : c.customer_type === 'commercial' ? COMMERCIAL_ROW_BG : 'white'
              const chip = customerTypeChipLabel(c)
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(c)
                    setOpen(false)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    background: rowBg,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
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
                          background: '#f3f4f6',
                          color: '#4b5563',
                          flexShrink: 0,
                        }}
                      >
                        {chip}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{formatCustomerSecondaryLine(c)}</div>
                </button>
              )
            })
          )}
          {onRequestCreateNew && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onRequestCreateNew()
                setOpen(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.65rem 0.75rem',
                border: 'none',
                borderTop: '2px solid #e5e7eb',
                background: '#f9fafb',
                fontWeight: 600,
                color: '#ea580c',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Create new customer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
