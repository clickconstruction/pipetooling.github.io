import type { RefObject } from 'react'
import { ModalShell } from './ModalShell'

/**
 * Confirmation dialog for clearing all count rows on a bid.
 *
 * Presentational only: the parent (`Bids.tsx`) owns the open/confirm/busy state, the input ref
 * (and its focus effect), and the delete handler. Behavior mirrors the previous inline block:
 * the confirm button is disabled while busy, when the typed value does not exactly match the
 * confirm label, or when there are no rows to delete.
 */
export function ClearAllCountsModal({
  open,
  confirmLabel,
  rowCount,
  value,
  busy,
  inputRef,
  onChange,
  onCancel,
  onConfirm,
}: {
  open: boolean
  confirmLabel: string
  rowCount: number
  value: string
  busy: boolean
  inputRef: RefObject<HTMLInputElement>
  onChange: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  const confirmDisabled = busy || value.trim() !== confirmLabel || rowCount === 0

  return (
    <ModalShell cardStyle={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 520, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
      <h2 style={{ margin: '0 0 1rem 0', color: 'var(--text-red-700)' }}>Clear all counts</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', marginBottom: '0.5rem' }}>
        This will permanently delete <strong>{rowCount}</strong> count row{rowCount === 1 ? '' : 's'} for this bid.
      </p>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        Related takeoff template mappings, pricing assignments, and custom fixture prices for those rows will also be removed.
      </p>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', marginBottom: '0.35rem' }}>
        Type <strong style={{ color: 'var(--text-red-700)' }}>{confirmLabel}</strong> exactly to confirm.
      </p>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        disabled={busy}
        style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '1rem' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          style={{
            padding: '0.5rem 1rem',
            background: confirmDisabled ? '#d1d5db' : '#b91c1c',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: confirmDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Clearing…' : 'Delete all count rows'}
        </button>
      </div>
    </ModalShell>
  )
}
