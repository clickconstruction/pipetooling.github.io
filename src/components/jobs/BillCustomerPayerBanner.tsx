import { billToDisplayLabel, type InvoiceBillTo } from '../../lib/jobs/invoiceBillTo'
import type { EffectiveBillParty, PayerRecipient } from '../../lib/jobs/billToParty'

export type BillCustomerPayerBannerProps = {
  billToOverride: InvoiceBillTo | null
  payerParty: EffectiveBillParty
  payerRecipient: PayerRecipient | null
  /** The job row's own customer name, before any payer or bill-to overlay: the party that is not being billed. */
  rawCustomerName: string | null | undefined
}

/**
 * Bill Customer's note that someone other than the job's customer is billed: a typed bill-to recipient (v2.1086), else
 * the GC as payer (v2.3345). Nothing when the customer themself is billed.
 */
export function BillCustomerPayerBanner({ billToOverride, payerParty, payerRecipient, rawCustomerName }: BillCustomerPayerBannerProps) {
  return billToOverride ? (
    <div
      style={{
        marginBottom: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderRadius: 6,
        background: 'var(--bg-amber-tint)',
        border: '1px solid var(--border-strong)',
        fontSize: '0.8125rem',
        color: 'var(--text-amber-800)',
        lineHeight: 1.4,
      }}
    >
      <strong>Billing to {billToDisplayLabel(billToOverride)}</strong> — not the job customer
      {(rawCustomerName ?? '').trim() ? ` (${(rawCustomerName ?? '').trim()})` : ''}. Change or
      remove this on the job’s Bill tab → Bill to ▾
    </div>
  ) : payerParty === 'gc' ? (
    <div
      data-testid="bill-customer-gc-payer-banner"
      style={{
        marginBottom: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderRadius: 6,
        background: 'var(--bg-amber-tint)',
        border: '1px solid var(--border-strong)',
        fontSize: '0.8125rem',
        color: 'var(--text-amber-800)',
        lineHeight: 1.4,
      }}
    >
      <strong>Billing {payerRecipient?.name || 'the GC'}</strong>, the GC on this job
      {(rawCustomerName ?? '').trim() ? ` — not ${(rawCustomerName ?? '').trim()}` : ''}.
      {payerRecipient?.email ? '' : ' They have no billing email yet.'} Change this on the job’s Edit tab → Bills go to, or per
      bill with Bill to ▾ on the Bill tab.
    </div>
  ) : null
}
