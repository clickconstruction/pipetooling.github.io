/**
 * Bids → Pricing: the New / Edit price-book entry form (Pricing decomposition PR 5, region
 * P5 of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`). Moved verbatim out of
 * `BidsPricingTab`.
 *
 * Renders and reports only: `savePricingEntry` (fixture types auto-created through
 * `getOrCreateFixtureTypeId`, `sequence_order = max + 1` on insert), `deletePricingEntry` and
 * the auto-total effect stay in the tab. The one piece of arithmetic that lives here is the
 * v2.2644 rule for the Combined box: the raw string stays in the field, and Rough In absorbs
 * the change so the total matches — it reads only the three stage strings this form already
 * holds, so it moved with the JSX.
 *
 * Sits above the Price book drawer (z 80 over 70): the drawer's ✎ and *Add entry* open this
 * form, and on narrow screens a lower z put it behind the drawer (v2.2445).
 */
import type { FormEvent } from 'react'
import type { PriceBookEntryWithFixture } from '../../lib/bids/bidPricingEngineTypes'

export type PricingEntryFormProps = {
  editing: PriceBookEntryWithFixture | null
  /** The tab's page-level error line, shown inside this dialog while it is open. */
  error: string | null
  fixtureName: string
  onFixtureNameChange: (value: string) => void
  fixtureTypes: Array<{ id: string; name: string }>
  /** The drawer's price column mode: one Combined box, or the three stage boxes + total. */
  priceMode: 'combined' | 'stage'
  combinedPrice: string
  onCombinedPriceChange: (value: string) => void
  roughIn: string
  onRoughInChange: (value: string) => void
  topOut: string
  onTopOutChange: (value: string) => void
  trimSet: string
  onTrimSetChange: (value: string) => void
  /** Auto-calculated by the tab from the three stages; read-only here. */
  total: string
  saving: boolean
  onSubmit: (e: FormEvent) => void | Promise<void>
  onClose: () => void
  /** Resolves true when the delete went through, so the form closes itself. */
  onDelete: (entry: PriceBookEntryWithFixture) => Promise<boolean>
}

export function PricingEntryFormModal(props: PricingEntryFormProps) {
  const { editing, error, fixtureName, fixtureTypes, priceMode, combinedPrice, roughIn, topOut, trimSet, total, saving } = props
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Above the book drawer (70): its ✎/Add entry open this form, and on narrow
        // screens a lower z put the form behind the drawer (v2.2445).
        zIndex: 80,
      }}
      onClick={props.onClose}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem' }}>{editing ? 'Edit entry' : 'New entry'}</h3>
        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        <form onSubmit={props.onSubmit}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture / Tie-in *</label>
          <input
            type="text"
            list="pricing-fixture-types"
            value={fixtureName}
            onChange={(e) => props.onFixtureNameChange(e.target.value)}
            required
            placeholder="Type or select fixture type..."
            autoComplete="off"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.75rem', boxSizing: 'border-box' }}
          />
          <datalist id="pricing-fixture-types">
            {fixtureTypes.map(ft => (
              <option key={ft.id} value={ft.name} />
            ))}
          </datalist>
          {priceMode === 'combined' ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Price</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={combinedPrice}
                onChange={(e) => {
                  // Keep the raw string in the field — reformatting mid-typing moved the
                  // cursor and mangled entries like 21.00 → 2.01 (Wendi, v2.2644).
                  props.onCombinedPriceChange(e.target.value)
                  // Combined edits land in Rough In: RI absorbs the change so the total matches.
                  const v = parseFloat(e.target.value) || 0
                  const top = parseFloat(topOut) || 0
                  const trim = parseFloat(trimSet) || 0
                  props.onRoughInChange(String(Math.max(0, Math.round((v - top - trim) * 100) / 100)))
                }}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
              />
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Lands in Rough In — switch the book to Stage price to split it across stages.
              </p>
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Rough In</label>
              <input type="number" inputMode="decimal" min={0} step={0.01} value={roughIn} onChange={(e) => props.onRoughInChange(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Top Out</label>
              <input type="number" inputMode="decimal" min={0} step={0.01} value={topOut} onChange={(e) => props.onTopOutChange(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Trim Set</label>
              <input type="number" inputMode="decimal" min={0} step={0.01} value={trimSet} onChange={(e) => props.onTrimSetChange(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Total (auto-calculated)</label>
              <input type="number" min={0} step={0.01} value={total} readOnly style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--bg-subtle)', cursor: 'not-allowed' }} />
            </div>
          </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {editing && (
                <button
                  type="button"
                  onClick={async () => {
                    if (await props.onDelete(editing)) props.onClose()
                  }}
                  style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                >
                  Delete
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={props.onClose} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
