import type { ReliabilityLine } from '../../lib/jobs/paymentReliability'

/**
 * The reliability line under a Billed Awaiting Payment row's chip ("Their
 * Word" PR 3): a six-bar sparkline of the customer's last measurable bills
 * (days from bill to money — green at or under their median, amber to 1.5×,
 * red beyond) and "Pays in 9–41d · keeps 3 of 7 · slips ~9d". Renders
 * nothing when nothing is known, so a brand-new customer's row stays clean.
 *
 * v2.7013: with `onOpenPaySpeeds`, the "Pays in 9–41d" words are a press that opens the Pay speeds
 * window on this payer. The promise record and the returned checks after it stay plain words: the
 * window does not hold them. A line with no "Pays in" has nothing to open and stays plain.
 */
export default function BilledReliabilityLine({
  line,
  showBars = true,
  onOpenPaySpeeds,
  payerName,
  opens = 'pay speeds',
}: {
  line: ReliabilityLine
  /** v2.4193: the dates block prints the words alone, in the legend's grey. */
  showBars?: boolean
  /** Opens the Pay speeds window on this row's payer. Absent, the line is plain words. */
  onOpenPaySpeeds?: () => void
  /** The payer, for the press's name: "Open pay speeds for …". */
  payerName?: string | null
  /** What the press opens, for its name. A payer on a Pay calendar (punch list #323) opens that window, since the words are the calendar's. */
  opens?: 'pay speeds' | 'the pay calendar'
}) {
  if (!line.text && line.bars.length === 0) return null
  const press = onOpenPaySpeeds != null && line.paysIn != null
  const rest = press ? [line.kept, line.slip, line.bounced ?? null].filter((x): x is string => x != null).join(' · ') : ''
  const who = (payerName ?? '').trim() || 'this customer'
  return (
    <span
      data-testid="billed-reliability-line"
      title={line.title || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {showBars && line.bars.length > 0 ? (
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
      {press ? (
        <>
          <button
            type="button"
            className="billedPaysInPress"
            data-testid="billed-pays-in-press"
            aria-label={`${line.paysIn}. Open ${opens} for ${who}`}
            title={`${line.title ? `${line.title} ` : ''}Click to open ${opens} for ${who}.`}
            onClick={(e) => {
              e.stopPropagation()
              onOpenPaySpeeds()
            }}
          >
            {line.paysIn}
          </button>
          {rest ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', marginLeft: -2 }}>{`· ${rest}`}</span> : null}
        </>
      ) : line.text ? (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{line.text}</span>
      ) : null}
    </span>
  )
}
