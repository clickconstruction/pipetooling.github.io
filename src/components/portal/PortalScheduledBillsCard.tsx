/**
 * Scheduled in kind (v2.8314, punch list #301; the owner's call of 2026-11-22): the card under the
 * ledger for this viewer's bills an in kind arrangement pays. The bill stays on the page so it does
 * not read as lost: where the work was, when it was billed, what the credits have paid and what is
 * still to come. No Pay button and never in the balance, so nobody pays with money a bill a credit
 * pays down. The words are the office's own, *scheduled in kind*, so a call about the bill uses one
 * name for it. Customer-facing, so single-theme light with the statement's own palette.
 */
import { CARD, COPPER, FAINT, HAIR, INK, MUTED } from '../../lib/portal/portalTheme'
import { formatPortalDate, formatPortalUsd, splitPortalAddress, type PortalScheduledBill } from '../../lib/portal/portalPayload'
import { SCHEDULED_BILLS_WORDS, scheduledBillsSummary, scheduledBillsTotal } from '../../lib/portal/portalScheduledWords'

export function PortalScheduledBillsCard({ bills }: { bills: PortalScheduledBill[] }) {
  if (bills.length === 0) return null
  const total = scheduledBillsTotal(bills)
  const summary = scheduledBillsSummary(bills, formatPortalUsd)
  return (
    <div data-portal-scheduled-bills data-print-page style={{ margin: '14px 0 4px', border: `1px solid ${HAIR}`, background: CARD, padding: '12px 14px 6px', fontSize: 12.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER }}>{SCHEDULED_BILLS_WORDS.eyebrow}</span>
        <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{summary}</span>
      </div>
      <div style={{ color: MUTED, margin: '4px 0 6px', fontSize: 12 }}>{SCHEDULED_BILLS_WORDS.why}</div>
      {bills.map((b, i) => {
        const addr = splitPortalAddress(b.jobAddress)
        const where = [addr?.street ?? b.jobName ?? b.jobLabel, addr?.rest ?? null].filter(Boolean).join(', ')
        const meta = [b.billedOn ? `Billed ${formatPortalDate(b.billedOn) ?? b.billedOn}` : 'Billed', b.totalPaid > 0 ? `${formatPortalUsd(b.totalPaid)} paid in kind` : null].filter(Boolean)
        return (
          <div key={b.invoiceId ?? `${b.jobNumber}-${i}`} data-portal-scheduled-bill style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 14px', padding: '9px 0', borderTop: `1px solid ${HAIR}`, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: INK }}>{where}</div>
              <div style={{ color: MUTED }}>
                {[b.jobNumber ? `Job ${b.jobNumber}` : null, b.jobName && addr ? b.jobName : null].filter(Boolean).join(' · ')}
              </div>
              <div style={{ fontSize: 11.5, color: FAINT, marginTop: 2 }}>{meta.join(' · ')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 14, color: INK }}>{formatPortalUsd(b.amount)}</div>
              {b.totalPaid > 0 ? <div style={{ fontSize: 11, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>of {formatPortalUsd(b.billedAmount)}</div> : null}
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderTop: `1.5px solid ${INK}`, padding: '8px 0 4px', fontSize: 12, color: MUTED }}>
        <span>{SCHEDULED_BILLS_WORDS.foot}</span>
        <span style={{ fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>{formatPortalUsd(total)}</span>
      </div>
    </div>
  )
}
