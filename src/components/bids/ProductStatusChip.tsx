/**
 * The specified-vs-submitted status as a chip (Submittals stage 1, v2.3460;
 * shared with the Submittals tab since stage 2b). Green for as specified, blue
 * for the estimator's superseded / equal, amber for an alternate, red for a
 * design change or a missing row, muted for an accessory.
 */
import { STATUS_LABELS, type ProductStatus } from '../../lib/submittals/productStatus'

const PRODUCT_STATUS_STYLE: Record<ProductStatus, { color: string; bg: string }> = {
  as_specified: { color: 'var(--text-green-700)', bg: 'var(--bg-green-tint)' },
  superseded: { color: 'var(--text-blue-700)', bg: 'var(--bg-blue-tint)' },
  equal: { color: 'var(--text-blue-700)', bg: 'var(--bg-blue-tint)' },
  alternate: { color: 'var(--text-amber-700)', bg: 'var(--bg-yellow-tint)' },
  design_change: { color: 'var(--text-red-700)', bg: 'var(--bg-red-tint)' },
  missing: { color: 'var(--text-red-700)', bg: 'var(--bg-red-tint)' },
  accessory: { color: 'var(--text-muted)', bg: 'var(--bg-muted)' },
}

export function ProductStatusChip({ status, near, size = 'sm' }: { status: ProductStatus; near?: boolean; size?: 'sm' | 'md' }) {
  const st = PRODUCT_STATUS_STYLE[status]
  return (
    <span
      data-testid="product-status"
      style={{ fontSize: size === 'md' ? '0.72rem' : '0.62rem', fontWeight: 700, color: st.color, background: st.bg, borderRadius: 999, padding: size === 'md' ? '0.1rem 0.5rem' : '0.05rem 0.4rem', whiteSpace: 'nowrap' }}
      title={near ? 'Same unit, suffix only — confirm' : undefined}
    >
      {STATUS_LABELS[status]}
      {near ? ' · confirm' : ''}
    </span>
  )
}
