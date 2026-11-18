/**
 * Bids → Pricing: the two small windows the Workbench's price cards open, moved out of
 * `BidsPricingTab` as they were drawn (decomposition queue row 1). Both draw and report: the tab
 * keeps what is open, what is typed, and every write.
 *
 * - `PricingEditWindow`: a price card's ✎. Rename the price, or go on to delete it. A price a
 *   GC's letter is built on cannot be deleted from here; `deleteBlocked` says why
 *   (`priceDeleteBlock` in `lib/bids/starredScenarioGuard.ts`).
 * - `AddPriceOptionWindow`: ＋ Add price, then Another price for this GC. Its name, the price it
 *   starts from, and whether the GC is offered it at once (`lib/bids/addPriceOption.ts`).
 */
import type { AddPriceOptionChoice, AddPriceOptionValue } from '../../lib/bids/addPriceOption'

export function PricingEditWindow({
  name,
  deleteBlocked,
  onNameChange,
  onDelete,
  onClose,
  onSave,
}: {
  /** The name as it is typed. */
  name: string
  /** Why Delete is dead (a GC's letter is built on this price); null when the price can go. */
  deleteBlocked: string | null
  onNameChange: (name: string) => void
  /** Delete was pressed: the tab closes this window and opens the delete window on the price. */
  onDelete: () => void
  onClose: () => void
  onSave: () => void
}) {
  const isBase = deleteBlocked != null
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 750, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-label="Price" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }} style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.25rem 1.4rem', minWidth: 360, maxWidth: '90vw', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Price</h3>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }} htmlFor="pricing-edit-name">Name</label>
        <input
          id="pricing-edit-name"
          autoFocus
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSave() } }}
          style={{ width: '100%', padding: '0.5rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.1rem' }}>
          <button
            type="button"
            disabled={isBase}
            title={deleteBlocked ?? 'Delete this price'}
            onClick={onDelete}
            style={{ font: 'inherit', fontSize: '0.9rem', padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-red)', background: 'var(--surface)', color: isBase ? 'var(--text-faint)' : 'var(--text-red-700)', cursor: isBase ? 'not-allowed' : 'pointer' }}
          >
            Delete
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={{ font: 'inherit', fontSize: '0.9rem', padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={onSave} style={{ font: 'inherit', fontSize: '0.9rem', padding: '0.45rem 1.1rem', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  )
}

export function AddPriceOptionWindow({
  gc,
  gcShort,
  options,
  value,
  defaultName,
  busy,
  onChange,
  onClose,
  onCreate,
}: {
  /** The GC's name in the title, or "this GC" on an unversioned bid. */
  gc: string
  /** The GC as the checkbox line names it. */
  gcShort: string
  /** The prices on this version the new one can start from. */
  options: ReadonlyArray<AddPriceOptionChoice>
  value: AddPriceOptionValue
  /** The name used when the box is left empty. */
  defaultName: string
  /** A price is being created: the window holds still. */
  busy: boolean
  onChange: (patch: Partial<AddPriceOptionValue>) => void
  onClose: () => void
  onCreate: (name: string, fromId: string | null, offer: boolean) => void
}) {
  const create = () => onCreate(value.name.trim() || defaultName, value.fromId, value.offer)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={() => !busy && onClose()}>
      <div role="dialog" aria-label={`Another price for ${gc}`} style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '1rem 1.1rem', maxWidth: 460, width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.02rem' }}>Another price for {gc}</h3>
        <p style={{ margin: '0 0 0.7rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Same counts, same takeoff — a second price this GC can pick. Different materials? use “+ version” in the picker instead.</p>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Name this price option</label>
        <input type="text" autoFocus value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={defaultName} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create() } }} style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-strong)', font: 'inherit', boxSizing: 'border-box' }} />
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, margin: '0.6rem 0 0.2rem' }}>Start from</label>
        <select value={value.fromId ?? ''} onChange={(e) => onChange({ fromId: e.target.value || null })} style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-strong)', font: 'inherit' }}>
          {options.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isBase ? ' · ★ base' : ''}</option>)}
        </select>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.82rem', marginTop: '0.6rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={value.offer} onChange={(e) => onChange({ offer: e.target.checked })} /> Offer it to {gcShort} as an alternate right away
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.8rem' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={create} disabled={busy || options.length === 0} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.9rem', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </div>
  )
}
