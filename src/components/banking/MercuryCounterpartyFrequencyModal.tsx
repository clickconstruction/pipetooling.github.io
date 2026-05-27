import { useEffect, useId, useState, type ReactNode } from 'react'
import type { CounterpartyFrequencyListEntry } from '../../lib/bankingMercuryCounterpartyFrequency'

export type MercuryCounterpartyFrequencyModalProps = {
  open: boolean
  onClose: () => void
  rows: CounterpartyFrequencyListEntry[]
  /** Shown under the title (explain which slice of the ledger is counted). */
  scopeDescription: ReactNode
  /**
   * When provided, rows become clickable buttons. The parent decides what to do
   * with the selection (e.g. seed a search input) and is responsible for closing
   * the modal afterwards. Without this prop rows render as plain table cells.
   */
  onRowClick?: (row: CounterpartyFrequencyListEntry) => void
  /** Backdrop + shell z-index */
  zIndex?: number
}

export function MercuryCounterpartyFrequencyModal({
  open,
  onClose,
  rows,
  scopeDescription,
  onRowClick,
  zIndex = 1200,
}: MercuryCounterpartyFrequencyModalProps) {
  const reactId = useId()
  const titleId = `${reactId}-counterparty-frequency-title`
  const dialogId = `${reactId}-counterparty-frequency-dialog`

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 520,
          width: '100%',
          maxHeight: 'min(80vh, 32rem)',
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
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '1rem',
            flexShrink: 0,
          }}
        >
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
            Counterparty frequency
          </h2>
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
            }}
          >
            Close
          </button>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280', flexShrink: 0 }}>{scopeDescription}</p>
        <div style={{ overflow: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 6 }}>
          {rows.length === 0 ? (
            <div style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              No counterparty appears more than twice in this view.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '0.5rem 0.75rem',
                      borderBottom: '1px solid #e5e7eb',
                      fontWeight: 600,
                    }}
                  >
                    Counterparty
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '0.5rem 0.75rem',
                      borderBottom: '1px solid #e5e7eb',
                      fontWeight: 600,
                      width: '5rem',
                    }}
                  >
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <CounterpartyFrequencyRow
                    key={row.label}
                    row={row}
                    onRowClick={onRowClick}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function CounterpartyFrequencyRow({
  row,
  onRowClick,
}: {
  row: CounterpartyFrequencyListEntry
  onRowClick?: (row: CounterpartyFrequencyListEntry) => void
}) {
  const [hovered, setHovered] = useState(false)
  const interactive = typeof onRowClick === 'function'
  const baseCellStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid #f3f4f6',
  }
  const trStyle: React.CSSProperties = interactive
    ? { cursor: 'pointer', background: hovered ? '#f3f4f6' : 'transparent' }
    : {}
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (!onRowClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick(row)
    }
  }
  return (
    <tr
      style={trStyle}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      onMouseEnter={interactive ? () => setHovered(true) : undefined}
      onMouseLeave={interactive ? () => setHovered(false) : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? `Search transactions for ${row.label}` : undefined}
    >
      <td style={baseCellStyle}>{row.label}</td>
      <td
        style={{
          ...baseCellStyle,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {row.count}
      </td>
    </tr>
  )
}
