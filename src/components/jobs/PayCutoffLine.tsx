import type { PayCutoffLineWords } from '../../lib/jobs/payCalendar'

/**
 * The cutoff on a bill not yet sent (punch list #323, PR 3): *Send by Nov 30 to be due Dec 10. After that,
 * Jan 10.* For a payer on a Pay calendar, a bill in one day past the cutoff waits a whole month, and nothing
 * on a Ready to Bill row said so. Blue while the cutoff is far, amber in its last week. With `onOpen` the
 * first sentence is a press that opens the payer's calendar.
 */
export default function PayCutoffLine({ line, onOpen, payerName }: { line: PayCutoffLineWords; onOpen?: () => void; payerName?: string | null }) {
  const who = (payerName ?? '').trim() || 'this customer'
  return (
    <div
      data-testid="pay-cutoff-line"
      data-soon={line.soon ? 'true' : 'false'}
      title={`${who}: ${line.title}`}
      style={{
        marginTop: 6,
        padding: '4px 8px',
        borderRadius: 6,
        fontSize: '0.72rem',
        lineHeight: 1.35,
        textAlign: 'left',
        background: line.soon ? 'var(--bg-amber-tint)' : 'var(--bg-blue-tint)',
        color: line.soon ? 'var(--text-amber-800)' : 'var(--text-blue-800)',
      }}
    >
      {onOpen ? (
        <button
          type="button"
          className="payCalendarPress"
          aria-label={`${line.sendBy} Open the pay calendar for ${who}`}
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          style={{ fontWeight: 700 }}
        >
          {line.sendBy}
        </button>
      ) : (
        <strong>{line.sendBy}</strong>
      )}{' '}
      {line.after}
    </div>
  )
}
