/**
 * The selected deposit's header (AR refresh PR 2, v2.3380): the payer first,
 * then amount · kind · posted date · note / memo on one line, then the
 * remaining meter — money already applied to jobs plus the lines on screen
 * fill it green; the number on the right is what is left to place. Replaces
 * the "Amount · Remaining to allocate" band and the Posted / Kind rows.
 */
import type { MercuryKindBadge } from '../../../lib/bankPaymentsKindBadges'
import type { ArAllocationProgress } from '../../../lib/jobs/arAllocationProgress'
import { KindBadgePill } from './KindBadgePill'

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ArDepositHeader({
  name,
  amount,
  kind,
  kindBadges,
  postedLabel,
  note,
  memo,
  returned,
  closedLabel = null,
  onReopen,
  reopenBusy = false,
  consumed,
  progress,
}: {
  name: string
  amount: number
  kind: string
  kindBadges: Record<string, MercuryKindBadge>
  /** "Sep 11, 2026" (Chicago day), or null. */
  postedLabel: string | null
  note: string | null
  memo: string | null
  returned: boolean
  /** v2.3529: "Vendor refund · Sep 16, 2026" when the deposit was closed out with a reason. */
  closedLabel?: string | null
  /** Present when the viewer may reopen a closed-out deposit. */
  onReopen?: () => void
  reopenBusy?: boolean
  consumed: number
  progress: ArAllocationProgress
}) {
  const noteText = (note ?? '').trim()
  const memoText = (memo ?? '').trim()
  const leftLabel = progress.allocatedNow > 0 ? `Allocating ${money(progress.allocatedNow)}` : consumed > 0.005 ? `${money(consumed)} applied to jobs` : 'Nothing allocated yet'
  return (
    <div data-testid="ar-deposit-header" style={{ marginBottom: '0.9rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-strong)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {returned ? (
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-red-700)', border: '1px solid var(--border-red)', borderRadius: 999, padding: '1px 8px' }}>Returned</span>
        ) : null}
        {closedLabel ? (
          <span data-testid="ar-closed-out" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-200)', borderRadius: 999, padding: '1px 8px' }}>
            Closed out · {closedLabel}
            {onReopen ? (
              <button
                type="button"
                onClick={onReopen}
                disabled={reopenBusy}
                style={{ border: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, color: 'var(--text-blue-700)', cursor: reopenBusy ? 'default' : 'pointer', textDecoration: 'underline' }}
              >
                {reopenBusy ? 'Reopening…' : 'Reopen'}
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      <div style={{ marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{money(amount)}</span>
        <span aria-hidden>·</span>
        <KindBadgePill kind={kind} kindBadges={kindBadges} />
        {postedLabel ? (
          <>
            <span aria-hidden>·</span>
            <span>posted {postedLabel}</span>
          </>
        ) : null}
      </div>
      {noteText || memoText ? (
        <div style={{ marginTop: 4, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          {noteText ? (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Note</span> “{noteText}”
            </div>
          ) : null}
          {memoText ? (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Memo</span> “{memoText}”
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        data-testid="ar-remaining-meter"
        style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'auto minmax(60px, 1fr) auto', gap: '0 10px', alignItems: 'center', fontSize: '0.78rem' }}
      >
        <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{leftLabel}</span>
        <span aria-hidden style={{ height: 6, borderRadius: 999, background: 'var(--bg-200)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${Math.round(progress.pctFilled * 100)}%`, background: progress.over ? 'var(--text-red-700)' : 'var(--text-green-700)' }} />
        </span>
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: progress.over ? 'var(--text-red-700)' : progress.remainingAfter <= 0.005 ? 'var(--text-green-700)' : 'var(--text-strong)' }}>
          {progress.over ? `Over by ${money(-progress.remainingAfter)}` : progress.remainingAfter <= 0.005 ? 'Fully allocated ✓' : `Remaining ${money(progress.remainingAfter)}`}
        </span>
      </div>
    </div>
  )
}
