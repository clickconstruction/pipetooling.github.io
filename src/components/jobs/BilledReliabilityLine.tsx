import type { ReliabilityLine } from '../../lib/jobs/paymentReliability'

/**
 * The reliability line under a Billed Awaiting Payment row's chip ("Their
 * Word" PR 3): a six-bar sparkline of the customer's last measurable bills
 * (days from bill to money — green at or under their median, amber to 1.5×,
 * red beyond) and "Pays in 9–41d · keeps 3 of 7 · slips ~9d". Renders
 * nothing when nothing is known, so a brand-new customer's row stays clean.
 */
export default function BilledReliabilityLine({ line }: { line: ReliabilityLine }) {
  if (!line.text && line.bars.length === 0) return null
  return (
    <span
      data-testid="billed-reliability-line"
      title={line.title || undefined}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
    >
      {line.bars.length > 0 ? (
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1, height: 11 }}>
          {line.bars.map((b, i) => (
            <i
              key={`${b.paidYmd}-${i}`}
              style={{
                display: 'inline-block',
                width: 3,
                height: Math.max(2, Math.round(b.height * 11)),
                borderRadius: 1,
                background: b.tone === 'fast' ? 'var(--text-green-800)' : b.tone === 'slow' ? 'var(--text-amber-800)' : 'var(--text-red-600)',
                opacity: 0.85,
              }}
            />
          ))}
        </span>
      ) : null}
      {line.text ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{line.text}</span> : null}
    </span>
  )
}
