/**
 * Bids → Pricing: two small pieces at the top of the Workbench, moved out of `BidsPricingTab` as
 * they were drawn (decomposition queue row 1). Both draw and report.
 *
 * - `PricingRfqChip`: the one chip on the header. It says where the bid's supply-house quotes,
 *   price requests or robot matrix stand (`derivePricingChip`), in that state's colours, and
 *   opens the window that state belongs to. The tab decides whether to draw it and which window opens.
 * - `PricingResolvePanel`: what stands in for the Workbench while the bid's versions and prices
 *   load (v2.2367), or after the load failed, with Retry. Never the empty state, which would read
 *   as deleted work.
 */
import type { PricingChip } from '../../lib/rfq/priceMatrixRequest'

/** A chip that has something to say. The tab draws nothing for `none`. */
export type PricingRfqChipState = Exclude<PricingChip, { kind: 'none' }>

export function PricingRfqChip({ chip, onOpen }: { chip: PricingRfqChipState; onOpen: () => void }) {
  return (
    <button
      type="button"
      id="pricing-price-requests"
      onClick={onOpen}
      title={chip.kind === 'robot' ? (chip.status === 'ready' ? 'The robot’s matrix is ready — open the compare' : 'Where the robot is on this bid') : chip.kind === 'desk' ? 'Open the price-request desk' : 'Compare supply house quotes on this bid'}
      style={{
        padding: '0.45rem 0.8rem',
        background:
          chip.kind === 'robot'
            ? chip.tone === 'green'
              ? 'var(--bg-green-tint)'
              : chip.tone === 'amber'
                ? 'var(--bg-yellow-tint)'
                : 'var(--bg-blue-tint)'
            : chip.kind === 'desk' && chip.tone === 'amber'
              ? 'var(--bg-yellow-tint)'
              : 'var(--surface)',
        color:
          chip.kind === 'quotes' || (chip.kind === 'robot' && chip.tone === 'blue')
            ? 'var(--text-blue-500)'
            : chip.tone === 'red'
              ? '#ef4444'
              : chip.tone === 'amber'
                ? 'var(--text-amber-700)'
                : 'var(--text-green-700)',
        border: `1px solid ${chip.kind === 'quotes' || (chip.kind === 'robot' && chip.tone === 'blue') ? '#3b82f6' : chip.tone === 'red' ? '#ef4444' : chip.tone === 'amber' ? '#f59e0b' : '#16a34a'}`,
        borderRadius: 999,
        cursor: 'pointer',
        font: 'inherit',
        fontSize: '0.8125rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {chip.label}
    </button>
  )
}

export function PricingResolvePanel({ panel, onRetry }: { panel: 'skeleton' | 'error'; onRetry: () => void }) {
  if (panel === 'skeleton') {
    return (
      <div role="status" aria-label="Loading this bid's packets and prices" style={{ padding: '0.95rem 1.1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500 }}>
          <span className="bid-resolve-spinner" aria-hidden />
          Loading this bid's packets and prices…
        </div>
        {[['34%', '14%'], ['46%', '20%'], ['40%', '11%']].map(([w1, w2]) => (
          <div key={w1} aria-hidden style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="bid-resolve-shimmer" style={{ width: w1, height: 12, borderRadius: 4 }} />
            <span className="bid-resolve-shimmer" style={{ width: w2, height: 12, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ padding: '0.9rem 1.1rem', border: '1px solid var(--border-red)', borderRadius: 8, background: 'var(--bg-red-tint)', display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem', fontWeight: 500 }}>
        Couldn't load this bid's packets and prices — the connection dropped or the server didn't answer. Your versions are safe.
      </span>
      <button
        type="button"
        onClick={onRetry}
        style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
      >
        Retry
      </button>
    </div>
  )
}
