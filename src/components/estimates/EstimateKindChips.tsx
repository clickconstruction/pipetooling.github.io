/**
 * The two kind chips an estimate wears — Change order, and the legacy title-only change order —
 * on the list rows and the detail title row. Out of `src/pages/Estimates.tsx` with the list
 * move (step 2 of the Estimates map, v2.3869).
 */
import { LEGACY_CHANGE_ORDER_TITLE_HINT, LEGACY_CHANGE_ORDER_TITLE_LABEL } from '../../lib/estimateChangeOrder'

export function EstimateChangeOrderChip({ compact }: { compact?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'var(--bg-orange-tint)',
        color: 'var(--text-amber-800)',
        border: '1px solid #f59e0b',
        borderRadius: 999,
        padding: compact ? '0 0.4rem' : '0.05rem 0.5rem',
        fontSize: compact ? '0.625rem' : '0.6875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      Change order
    </span>
  )
}

/**
 * v2.2911 (journey-map J16-F4): a plain estimate titled "change order" (the
 * pre-`doc_kind` specimen, estimate #1) wears the word without the machinery.
 * A quiet neutral tag says so wherever the amber chip would otherwise be
 * expected, so nobody hunts for an Apply-to-job button that isn't coming.
 */
export function EstimateLegacyChangeOrderTitleChip({ compact }: { compact?: boolean }) {
  return (
    <span
      title={LEGACY_CHANGE_ORDER_TITLE_HINT}
      style={{
        display: 'inline-block',
        background: 'var(--bg-muted)',
        color: 'var(--text-muted)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 999,
        padding: compact ? '0 0.4rem' : '0.05rem 0.5rem',
        fontSize: compact ? '0.625rem' : '0.6875rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      {LEGACY_CHANGE_ORDER_TITLE_LABEL}
    </span>
  )
}

/** Violet "Bid ✍" pill (v2.2470): a signed bid-room proposal riding the estimates rails. */
