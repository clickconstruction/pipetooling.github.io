/**
 * Bids → Pricing: the price cards row (v2.2404; region P2, the Pricing / Labor map's step 9,
 * part 2) — the one-line band of a solo bid, or the tray of price cards with same-GC
 * own-takeoff alternates beside them, plus the "Add a price or GC" door and the own-takeoff
 * alternate's name window. The JSX moved out of `BidsPricingTab` as it was; it renders and
 * reports. The layout, each card's figures and the copy source are decided by
 * `lib/bids/pricingCardsRow`; the writes stay in the tab.
 */
import type { CSSProperties } from 'react'
import { formatCurrency } from '../../lib/format'
import { alternateCardNumbers } from '../../lib/bids/ownTakeoffAlternates'
import { cardFigures, type CardsRowMode } from '../../lib/bids/pricingCardsRow'
import type { AlternateVersionCardData } from '../../hooks/usePricingCardsData'
import type { BidVersion, PriceBookVersion } from '../../lib/bids/bidPricingEngineTypes'

/** The ＋ Add price door (v2.2104): one creation door for both variant kinds. The tab also draws it at the solver line's end. */
export function AddPriceDoorButton({ cloning, onOpenDoor }: { cloning: boolean; onOpenDoor: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenDoor}
      disabled={cloning}
      style={{ font: 'inherit', fontSize: '0.82rem', fontWeight: 600, padding: '0.42rem 0.85rem', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--bg-blue-tint)', color: 'var(--text-link)', cursor: cloning ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
    >
      {cloning ? 'Duplicating…' : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <span aria-hidden style={{ fontSize: '1.05rem', lineHeight: 1 }}>＋</span>
          <span style={{ textAlign: 'left', lineHeight: 1.25 }}>Add<br />price</span>
        </span>
      )}
    </button>
  )
}

export type PricingCardsRowProps = {
  mode: Exclude<CardsRowMode, 'none'>
  scenarios: PriceBookVersion[]
  /** Same-GC alternate versions with their own takeoff. */
  altVersions: BidVersion[]
  selectedPricingVersionId: string | null
  customerFacingPricingId: string | null
  revenueOf: (id: string) => number | null
  totalCost: number
  baseMaterials: number
  altVersionData: Readonly<Record<string, AlternateVersionCardData>>
  marginColor: (m: number | null) => string
  /** Where an empty open price copies from (`copySourceFor`). */
  copySource: { id: string; name: string } | null
  cloning: boolean
  copyingPrices: boolean
  /** The "Add a price or GC" door. */
  doorOpen: boolean
  /** "Another price for …" — the GC's name, or "this GC" on an unversioned bid. */
  doorGcLabel: string
  onOpenDoor: () => void
  onCloseDoor: () => void
  onAnotherPrice: () => void
  onOwnTakeoff: () => void
  onAdopt: () => void
  /** The own-takeoff alternate's name window; null while closed. */
  ownTakeoff: { name: string } | null
  creatingOwnTakeoff: boolean
  ownTakeoffGcLabel: string
  onOwnTakeoffName: (name: string) => void
  onCancelOwnTakeoff: () => void
  onCreateOwnTakeoff: (name: string) => void
  onView: (pricingId: string) => void
  onEdit: (pricing: { id: string; name: string }) => void
  onMakeBase: (pricing: PriceBookVersion, revenue: number | null) => void
  onSetOffered: (pricing: PriceBookVersion, offered: boolean) => void
  onCopyPrices: (sourcePricingId: string) => void
  onOpenAlternate: (bidVersionId: string) => void
  onOpenAlternateTakeoff: (bidVersionId: string) => void
}

export function PricingCardsRow(props: PricingCardsRowProps) {
  const {
    mode, scenarios, altVersions, selectedPricingVersionId, customerFacingPricingId, revenueOf, totalCost, baseMaterials, altVersionData, marginColor, copySource,
    cloning, copyingPrices, doorOpen, doorGcLabel, onOpenDoor, onCloseDoor, onAnotherPrice, onOwnTakeoff, onAdopt,
    ownTakeoff, creatingOwnTakeoff, ownTakeoffGcLabel, onOwnTakeoffName, onCancelOwnTakeoff, onCreateOwnTakeoff,
    onView, onEdit, onMakeBase, onSetOffered, onCopyPrices, onOpenAlternate, onOpenAlternateTakeoff,
  } = props
  const fmtM = (n: number) => `$${formatCurrency(n)}`
  const cardBtnStyle: CSSProperties = { font: 'inherit', fontSize: '0.72rem', padding: '0.18rem 0.5rem', borderRadius: 5, border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-700)', cursor: 'pointer' }
  const doorBtn = <AddPriceDoorButton cloning={cloning} onOpenDoor={onOpenDoor} />
  const doorOptStyle: CSSProperties = { display: 'flex', gap: '0.7rem', alignItems: 'flex-start', width: '100%', textAlign: 'left', font: 'inherit', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.8rem', background: 'var(--surface)', cursor: 'pointer', marginBottom: '0.55rem' }
  const doorModal = doorOpen ? (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      onClick={onCloseDoor}
    >
      <div
        role="dialog"
        aria-label="Add a price or GC"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '1rem 1.1rem', maxWidth: 440, width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.02rem' }}>Add a price or GC</h3>
        <p style={{ margin: '0 0 0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>What do you want?</p>
        <button
          type="button"
          style={doorOptStyle}
          onClick={() => {
            onCloseDoor()
            onAnotherPrice()
          }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>💲</span>
          <span>
            <b style={{ display: 'block', fontSize: '0.92rem' }}>Another price for {doorGcLabel}</b>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Offer it as an alternate on their letter, or keep it to compare. The GC sees the ★ and what you offer — nothing else. Same takeoff, different numbers.
            </span>
          </span>
        </button>
        {/* v2.2404 (Wendi): an alternate that CHANGES MATERIALS gets its own takeoff —
            a same-GC version marked Alternate, so its margin costs against its parts. */}
        <button
          type="button"
          style={{ ...doorOptStyle, border: '1.5px solid #0d9488' }}
          onClick={() => {
            onCloseDoor()
            onOwnTakeoff()
          }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>📐</span>
          <span>
            <b style={{ display: 'block', fontSize: '0.92rem' }}>Alternate with its own takeoff</b>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              For "in lieu of" work that changes materials — PEX for copper, cast iron for PVC. Starts as a copy of this bid's counts, takeoff and prices; swap the materials and the margin follows. Lands on their letter as an alternate.
            </span>
          </span>
        </button>
        <button
          type="button"
          style={doorOptStyle}
          onClick={() => {
            onCloseDoor()
            window.dispatchEvent(new Event('bid-version-picker-open-add-gc'))
          }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>📦</span>
          <span>
            <b style={{ display: 'block', fontSize: '0.92rem' }}>Another GC</b>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Send this bid to another GC — its own packet, starting as a copy of this one's counts, takeoff and prices.
            </span>
          </span>
        </button>
        <button
          type="button"
          style={doorOptStyle}
          onClick={() => {
            onCloseDoor()
            onAdopt()
          }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>⤵</span>
          <span>
            <b style={{ display: 'block', fontSize: '0.92rem' }}>Adopt an existing bid</b>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Pull a bid already on the board in as one of this bid's packets. Its counts, prices and sent history come with it; its old row retires.
            </span>
          </span>
        </button>
        <div style={{ textAlign: 'right' }}>
          <button
            type="button"
            onClick={onCloseDoor}
            style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.35rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null
  // v2.2404: name the own-takeoff alternate — the door's teal choice lands here.
  const ownTakeoffModal = ownTakeoff ? (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      onClick={() => !creatingOwnTakeoff && onCancelOwnTakeoff()}
    >
      <div
        role="dialog"
        aria-label="Alternate with its own takeoff"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '1rem 1.1rem', maxWidth: 460, width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.02rem' }}>📐 Alternate with its own takeoff</h3>
        <p style={{ margin: '0 0 0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Starts as a copy of this bid's counts, takeoff and prices for {ownTakeoffGcLabel}. Swap the materials in Takeoffs and the margin follows. It lands on their letter as an alternate.
        </p>
        <label style={{ display: 'block', marginBottom: '0.8rem' }}>
          <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.85rem' }}>Name</span>
          <input
            autoFocus
            value={ownTakeoff.name}
            onChange={(e) => onOwnTakeoffName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCreateOwnTakeoff(ownTakeoff.name)
              else if (e.key === 'Escape') onCancelOwnTakeoff()
            }}
            placeholder="e.g. PEX in lieu of copper"
            style={{ width: '100%', padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box', font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)' }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onCancelOwnTakeoff}
            disabled={creatingOwnTakeoff}
            style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.35rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCreateOwnTakeoff(ownTakeoff.name)}
            disabled={creatingOwnTakeoff || !ownTakeoff.name.trim()}
            style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.9rem', border: 'none', borderRadius: 6, background: '#0d9488', color: '#fff', cursor: creatingOwnTakeoff ? 'wait' : 'pointer', opacity: !ownTakeoff.name.trim() ? 0.6 : 1 }}
          >
            {creatingOwnTakeoff ? 'Creating…' : 'Create the alternate'}
          </button>
        </div>
      </div>
    </div>
  ) : null
  // Nothing priced yet on a solo bid: skip the status band entirely — the solver is the next
  // move and sits first; ＋ Add price rides at the solver line's end (artifact 0a627c7c), which
  // the tab draws from the same `mode`.
  if (mode === 'soloUnpriced') return <>{doorModal}{ownTakeoffModal}</>
  if (mode === 'solo') {
    const v = scenarios[0]!
    const rev = revenueOf(v.id)
    const { margin: m, unpriced } = cardFigures(rev, totalCost)
    const isCustomerFacing = v.id === customerFacingPricingId
    return (
      <>
        <div
          data-tour="workbench-scenarios"
          style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.9rem', marginBottom: '0.9rem' }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>One GC · one price</span>
          {isCustomerFacing ? (
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-green-600)' }}>★ base · the GC sees this</span>
          ) : null}
          <b style={{ fontSize: '0.85rem' }}>{v.name}</b>
          {unpriced ? (
            <>
              <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-amber-700)', border: '1px solid var(--border)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0.1rem 0.5rem' }}>
                No prices yet
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>— price below or use the solver</span>
            </>
          ) : (
            <>
              <b style={{ fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>{rev != null ? fmtM(rev) : '…'}</b>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {m == null ? '' : `${Math.round(m * 100)}% margin · profit ${fmtM((rev ?? 0) - totalCost)}`}
              </span>
            </>
          )}
          {!isCustomerFacing && !unpriced ? (
            <button type="button" onClick={() => onMakeBase(v, rev)} style={cardBtnStyle}>
              ☆ Make base…
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          {doorBtn}
        </div>
        {doorModal}
        {ownTakeoffModal}
      </>
    )
  }
  return (
    <>
      {/* v2.2204: the whole set of price options sits in one quiet gray tray. */}
      <div data-tour="workbench-scenarios" style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', margin: '0.85rem 0 0.9rem', flexWrap: 'wrap', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.6rem' }}>
        {scenarios.map((v) => {
          const viewing = v.id === selectedPricingVersionId
          const isCustomerFacing = v.id === customerFacingPricingId
          const rev = revenueOf(v.id)
          const { margin: m, unpriced } = cardFigures(rev, totalCost)
          const offered = !isCustomerFacing && !unpriced && (v as { include_in_submission?: boolean }).include_in_submission === true
          return (
            <div
              key={v.id}
              onClick={() => { if (!viewing) onView(v.id) }}
              title={viewing ? 'The price open on this Workbench' : 'View this price (doesn’t change what the GC sees)'}
              style={{
                flex: '1 1 215px', minWidth: 215, maxWidth: 300, textAlign: 'left', font: 'inherit',
                background: isCustomerFacing ? 'var(--bg-green-tint)' : 'var(--surface)',
                border: viewing ? '1px solid #3b82f6' : isCustomerFacing ? '1px solid var(--border-green)' : '1px solid var(--border)',
                boxShadow: viewing ? '0 0 0 1px #3b82f6' : 'none',
                borderRadius: 10, padding: '0.5rem 0.75rem 0', cursor: viewing ? 'default' : 'pointer', position: 'relative',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* v2.2203: state tabs sit on the card's top edge — blue Viewing, green ★ Submittal; side by side when both. */}
              {(viewing || isCustomerFacing) ? (
                <span style={{ position: 'absolute', top: '-0.72rem', left: '0.6rem', display: 'inline-flex', gap: '0.3rem' }}>
                  {viewing ? (
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, whiteSpace: 'nowrap', color: '#fff', background: '#3b82f6', borderRadius: 999, padding: '0.14rem 0.55rem', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)' }}>Viewing</span>
                  ) : null}
                  {isCustomerFacing ? (
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, whiteSpace: 'nowrap', color: '#fff', background: '#16a34a', borderRadius: 999, padding: '0.14rem 0.55rem', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)' }}>★ Submittal</span>
                  ) : null}
                </span>
              ) : null}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{v.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEdit({ id: v.id, name: v.name }) }}
                    title="Rename or delete this price"
                    aria-label={`Edit ${v.name}`}
                    style={{ padding: '0 0.1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)', flex: '0 0 auto' }}
                  >
                    ✎
                  </button>
                </div>
                {unpriced ? (
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text-amber-700)', border: '1px solid var(--border)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0.05rem 0.45rem' }}>No prices yet</span>
                ) : null}
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: unpriced ? 'var(--text-muted)' : undefined }}>{rev != null ? fmtM(rev) : '…'}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', marginBottom: '0.4rem' }}>
                {m == null ? '—' : `${Math.round(m * 100)}% margin · profit ${fmtM((rev ?? 0) - totalCost)}`}
              </div>
              {unpriced && viewing && copySource ? (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-amber-700)', marginTop: '0.25rem' }}>
                  Start pricing:{' '}
                  <button
                    type="button"
                    disabled={copyingPrices}
                    onClick={(e) => { e.stopPropagation(); onCopyPrices(copySource.id) }}
                    style={{ font: 'inherit', fontSize: '0.7rem', padding: 0, border: 'none', background: 'none', color: 'var(--text-amber-700)', textDecoration: 'underline', cursor: copyingPrices ? 'wait' : 'pointer' }}
                  >
                    {copyingPrices ? 'copying…' : `copy prices from ${copySource.name}`}
                  </button>{' '}
                  or use the solver below.
                </div>
              ) : null}
              {/* v2.2203 (option 1): the footer answers "who sees this price?" and carries the actions. */}
              {(() => {
                const linkStyle: CSSProperties = { font: 'inherit', fontSize: '0.66rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline', color: 'inherit', whiteSpace: 'nowrap' }
                const footBase: CSSProperties = { margin: 'auto -0.75rem 0', padding: '0.26rem 0.7rem', borderTop: '1px solid var(--border)', borderRadius: '0 0 9px 9px', fontSize: '0.66rem', display: 'flex', alignItems: 'center', gap: '0.3rem 0.55rem', flexWrap: 'wrap', marginTop: 'auto' }
                if (isCustomerFacing) {
                  return (
                    <div style={{ ...footBase, background: 'var(--bg-green-100)', color: 'var(--text-emerald-800)', fontWeight: 700 }}>
                      ★ The price on their letter
                    </div>
                  )
                }
                if (unpriced) {
                  return (
                    <div style={{ ...footBase, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                      Only you see this
                    </div>
                  )
                }
                return (
                  <div style={{ ...footBase, ...(offered ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', fontWeight: 600 } : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }) }}>
                    <span style={{ whiteSpace: 'nowrap' }}>{offered ? 'On their letter · alternate' : 'Only you see this'}</span>
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.55rem', whiteSpace: 'nowrap' }}>
                      <button type="button" style={linkStyle} title={offered ? 'Take this price off their letter' : 'Add this price to their letter as an alternate — same counts, no new version'} onClick={(e) => { e.stopPropagation(); onSetOffered(v, !offered); window.dispatchEvent(new Event('bid-version-picker-reload')) }}>
                        {offered ? 'stop offering' : 'offer as alternate'}
                      </button>
                      <button type="button" style={linkStyle} title="Make this the ★ price their letter is built on" onClick={(e) => { e.stopPropagation(); onMakeBase(v, rev); window.dispatchEvent(new Event('bid-version-picker-reload')) }}>
                        ☆ make base
                      </button>
                    </span>
                  </div>
                )
              })()}
            </div>
          )
        })}
        {/* v2.2404 (Wendi): same-GC alternates with their OWN takeoff ride the row as
            version cards — margin costed from THEIR materials, not the base's. */}
        {altVersions.map((av) => {
          const d = altVersionData[av.id]
          const nums = alternateCardNumbers({
            revenue: d?.revenue ?? null,
            altMaterials: d?.materials ?? null,
            baseMaterials,
            baseTotalCost: totalCost,
          })
          const inLetter = (av as { include_in_submission?: boolean | null }).include_in_submission === true
          const unpricedAlt = d != null && (d.revenue == null || d.revenue === 0)
          return (
            <div
              key={av.id}
              onClick={() => onOpenAlternate(av.id)}
              title="Open this alternate — its own counts and takeoff; the Workbench costs against ITS materials"
              style={{
                flex: '1 1 215px', minWidth: 215, maxWidth: 300, textAlign: 'left', font: 'inherit',
                background: 'var(--surface)', border: '1px solid #0d9488',
                borderRadius: 10, padding: '0.5rem 0.75rem 0', cursor: 'pointer', position: 'relative',
                display: 'flex', flexDirection: 'column',
              }}
            >
              <span style={{ position: 'absolute', top: '-0.72rem', left: '0.6rem', display: 'inline-flex', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.64rem', fontWeight: 700, whiteSpace: 'nowrap', color: '#fff', background: '#0d9488', borderRadius: 999, padding: '0.14rem 0.55rem', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)' }}>📐 own takeoff</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{av.name}</span>
                {unpricedAlt ? (
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text-amber-700)', border: '1px solid var(--border)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0.05rem 0.45rem' }}>No prices yet</span>
                ) : null}
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: unpricedAlt ? 'var(--text-muted)' : undefined }}>
                {d == null ? '…' : d.revenue != null ? fmtM(d.revenue) : '—'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {nums.margin != null ? (
                  <>
                    <span style={{ fontWeight: 700, color: marginColor(nums.margin) }}>{Math.round(nums.margin * 100)}% margin</span>
                    {` · profit ${fmtM(nums.profit ?? 0)}`}
                  </>
                ) : (
                  '—'
                )}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', margin: '0.2rem 0 0.4rem' }}>
                {d == null
                  ? ''
                  : d.materials != null
                    ? (
                      <>
                        Materials {fmtM(d.materials)}
                        {nums.materialsDelta != null && nums.materialsDelta !== 0 ? (
                          <span style={{ fontWeight: 600, color: nums.materialsDelta < 0 ? 'var(--text-green-600)' : 'var(--text-amber-700)' }}>
                            {` · ${nums.materialsDelta < 0 ? '−' : '+'}${fmtM(Math.abs(nums.materialsDelta))} vs base`}
                          </span>
                        ) : null}
                        {' · '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenAlternateTakeoff(av.id)
                          }}
                          style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline', color: 'var(--text-link)' }}
                        >
                          open its takeoff →
                        </button>
                      </>
                    )
                    : 'Materials · shared POs (exact model)'}
              </div>
              <div style={{ margin: 'auto -0.75rem 0', padding: '0.26rem 0.7rem', borderTop: '1px solid var(--border)', borderRadius: '0 0 9px 9px', fontSize: '0.66rem', display: 'flex', alignItems: 'center', gap: '0.3rem 0.55rem', flexWrap: 'wrap', ...(inLetter ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', fontWeight: 600 } : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }) }}>
                {inLetter ? 'On their letter · alternate' : 'Only you see this'}
              </div>
            </div>
          )
        })}
        <div style={{ flex: '0 0 auto', alignSelf: 'center' }}>{doorBtn}</div>
      </div>
      {doorModal}
      {ownTakeoffModal}
    </>
  )
}
