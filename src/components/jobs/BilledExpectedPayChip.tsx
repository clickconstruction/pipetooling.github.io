import type { ExpectedPayModel } from '../../lib/jobs/billedExpectedPay'

/**
 * "Expect pay ~Sep 8 · pays in ~35d" pill for Billed Awaiting Payment rows.
 * Blue = on track for the customer's usual speed; red = past their own norm
 * (the follow-up trigger); muted outline = company-average fallback while the
 * customer has too little payment history to have a norm of their own.
 */
export default function BilledExpectedPayChip({ model }: { model: ExpectedPayModel }) {
  const late = model.state === 'late'
  const fallback = !late && model.source === 'company'
  return (
    <span
      title={model.title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: '100%',
        padding: '2px 9px',
        borderRadius: 9999,
        fontSize: '0.72rem',
        fontWeight: 600,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        background: late ? 'var(--bg-red-tint)' : fallback ? 'transparent' : 'var(--bg-blue-tint)',
        color: late ? 'var(--text-red-600)' : fallback ? 'var(--text-muted)' : 'var(--text-blue-800)',
        border: fallback ? '1px solid var(--border)' : '1px solid transparent',
      }}
    >
      {model.label}
    </span>
  )
}
