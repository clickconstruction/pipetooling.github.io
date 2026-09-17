/**
 * Bids → Pricing: the New / Edit price-version form (Pricing decomposition PR 5, region P5
 * of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`). Moved verbatim out of `BidsPricingTab`.
 *
 * Renders and reports only: `savePricingVersion` (its four branches — rename, new template,
 * new blank pricing, clone via RPC) and the open / close state stay in the tab. Delete is a
 * door to the type-the-name dialog (`DeletePricingVersionModal`), offered only on a book that
 * is not *Default* — the same guard the inline JSX had.
 */
import type { FormEvent } from 'react'
import type { PriceBookVersion } from '../../lib/bids/bidPricingEngineTypes'

export type PricingVersionFormMode = 'template' | 'pricing-blank' | 'pricing-clone'

export function PricingVersionFormModal({
  editing,
  templatesMode,
  formMode,
  nameInput,
  onNameChange,
  saving,
  onSubmit,
  onClose,
  onDelete,
}: {
  /** The version being renamed, or null for a new one. */
  editing: PriceBookVersion | null
  /** The tab's Templates-vs-Bid-pricings switch — names the rename title. */
  templatesMode: boolean
  formMode: PricingVersionFormMode
  nameInput: string
  onNameChange: (value: string) => void
  saving: boolean
  onSubmit: (e: FormEvent) => void | Promise<void>
  onClose: () => void
  /** Opens the delete confirmation for the version being edited. */
  onDelete: (version: PriceBookVersion) => void
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
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem' }}>{
          editing
            ? (templatesMode ? 'Edit template name' : 'Edit pricing name')
            : formMode === 'template' ? 'New template'
            : formMode === 'pricing-clone' ? 'New pricing (copy)'
            : 'New pricing'
        }</h3>
        <form onSubmit={onSubmit}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => onNameChange(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
            placeholder="e.g. 2025 Standard"
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            {editing && editing.name !== 'Default' ? (
              <button
                type="button"
                onClick={() => onDelete(editing)}
                style={{ padding: '0.5rem 1rem', background: 'var(--surface)', color: 'var(--text-red-700)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
              >
                Delete version
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
