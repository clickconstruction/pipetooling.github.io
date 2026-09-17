/**
 * Bids → Pricing: the type-the-name delete confirmation for a price option (Pricing
 * decomposition PR 5, region P5 of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`). Moved
 * verbatim out of `BidsPricingTab`.
 *
 * Renders and reports only: `confirmDeletePricingVersion` (the delete, then re-activating a
 * surviving pricing via `pickActivePricing` when the active one died) stays in the tab, and
 * so does the four-way state reset behind `onClose`. The name check itself is the tab's —
 * this dialog only enables Delete once something is typed.
 */
import type { PriceBookVersion } from '../../lib/bids/bidPricingEngineTypes'

export function DeletePricingVersionModal({
  version,
  nameInput,
  onNameChange,
  error,
  onConfirm,
  onClose,
}: {
  version: PriceBookVersion
  nameInput: string
  onNameChange: (value: string) => void
  /** The tab's mismatch message after a refused confirm; cleared by the tab on the next keystroke. */
  error: string | null
  onConfirm: () => void | Promise<void>
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 360, maxWidth: '90vw', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 0.75rem', color: 'var(--text-red-700)' }}>Delete price option</h3>
        <p style={{ margin: '0 0 0.75rem', color: 'var(--text-700)', fontSize: '0.9rem' }}>
          This will delete the price option <strong>{version.name}</strong> and all entries
          it contains. A dev can put it back for 90 days from <strong>Settings → Data &amp; migration → Recently
          deleted</strong>.
        </p>
        <p style={{ margin: '0 0 0.5rem', color: 'var(--text-600)', fontSize: '0.875rem' }}>
          Type the name of this price to confirm:
        </p>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => onNameChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            marginBottom: '0.5rem',
            boxSizing: 'border-box',
          }}
          placeholder={version.name}
        />
        {error && (
          <p style={{ margin: '0 0 0.5rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={!nameInput.trim()}
            style={{
              padding: '0.5rem 1rem',
              background: nameInput.trim() ? '#b91c1c' : 'var(--bg-200)',
              color: nameInput.trim() ? 'white' : 'var(--text-faint)',
              border: 'none',
              borderRadius: 4,
              cursor: nameInput.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
