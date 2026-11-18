import type { Dispatch, SetStateAction } from 'react'
import type { JobBillingContext } from '../../lib/jobBillingContext'
import type { BillSendChannel, TheyWillGet } from '../../lib/billing/billCustomerTheyWillGet'
import type { BillCopyContact } from '../../lib/jobs/billCopyRecipients'
import type { EffectiveBillParty, PayerRecipient } from '../../lib/jobs/billToParty'
import type { ShownToParty } from '../../lib/jobs/billVisibility'
import type { InvoiceBillTo } from '../../lib/jobs/invoiceBillTo'
import BillCustomerOwnerLine from './BillCustomerOwnerLine'
import { BillCustomerPayCutoffLine } from './BillCustomerPayCutoffLine'
import { BillCustomerReturnedChecksLine } from './BillCustomerReturnedChecksLine'

/**
 * Every value is the window's own state under the window's own name. The ticks and the one-off address are read by
 * both email channels and by every commit's share stamp (SEND_RECORD_INVOICE_MODAL map, substrate B "Recipients"),
 * so nothing here is owned by the block: it draws what it is handed and writes back through the setters.
 */
export type BillCustomerSendToProps = {
  job: JobBillingContext
  channel: BillSendChannel
  /** The window's words for this channel (`theyWillGet`), read once by the window. */
  words: TheyWillGet
  customerContacts: BillCopyContact[]
  extraRecipientIds: Set<string>
  setExtraRecipientIds: Dispatch<SetStateAction<Set<string>>>
  billToOverride: InvoiceBillTo | null
  payerParty: EffectiveBillParty
  payerRecipient: PayerRecipient | null
  otherParty: { name: string; email: string; role: 'customer' | 'gc' } | null
  copyOtherParty: boolean
  setCopyOtherParty: (value: boolean) => void
  shareParty: { name: string; role: ShownToParty } | null
  showOtherParty: boolean
  setShowOtherParty: (value: boolean) => void
  jobShowMemory: boolean
  oneOffEmail: string
  setOneOffEmail: (value: string) => void
  /** The signed-in user, for the owner-of-record line. */
  userId: string | null
  /** The payer's customers row: the GC's when the GC pays. */
  contactsCustomerId: string | null
}

/** The Send to block (v2.940 physical, v2.3359 both channels): the primary
    address, the payer's contacts (flagged ones start ticked), Copy the other
    party, and a one-off. Both channels read the same ticks; the Stripe copies
    go out from send-stripe-invoice, the physical ones ride the same email. */
export function BillCustomerSendTo({
  job,
  channel,
  words,
  customerContacts,
  extraRecipientIds,
  setExtraRecipientIds,
  billToOverride,
  payerParty,
  payerRecipient,
  otherParty,
  copyOtherParty,
  setCopyOtherParty,
  shareParty,
  showOtherParty,
  setShowOtherParty,
  jobShowMemory,
  oneOffEmail,
  setOneOffEmail,
  userId,
  contactsCustomerId,
}: BillCustomerSendToProps) {
  return (
    <>
      {(customerContacts.length > 0 || (job.customer_email ?? '').trim()) && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Send to</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: customerContacts.length > 0 ? '0.25rem' : 0 }}>
            {words.who ? <strong data-testid="bill-customer-send-to-name" style={{ color: 'var(--text-strong)' }}>{words.who} </strong> : null}
            {(job.customer_email ?? '').trim() || '—'}{' '}
            <span style={{ color: 'var(--text-faint)' }}>
              {billToOverride ? '(bill-to recipient)' : payerParty === 'gc' ? `(${payerRecipient?.name || 'GC'} · billing email)` : '(primary)'}
            </span>
          </div>
          {words.phoneLine ? (
            <div data-testid="bill-customer-send-to-phone" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {words.phoneLine}
            </div>
          ) : null}
          {channel === 'stripe' || customerContacts.length > 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.35rem', lineHeight: 1.4 }}>{words.copyHelp}</div>
          ) : null}
          {/* Bill-to override: the customer's contact persons never ride on an
              invoice that bills someone else. */}
          {(billToOverride ? [] : customerContacts).map((c) => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer', padding: '0.1rem 0' }}>
              <input
                type="checkbox"
                checked={extraRecipientIds.has(c.id)}
                onChange={(e) => {
                  setExtraRecipientIds((prev) => {
                    const next = new Set(prev)
                    if (e.target.checked) next.add(c.id)
                    else next.delete(c.id)
                    return next
                  })
                }}
              />
              <span>
                {c.name} <span style={{ color: 'var(--text-muted)' }}>{c.email}</span>
              </span>
            </label>
          ))}
          {/* No tick when the other party's address IS the billing address (a GC entered under
            its own AP inbox on both rows) — the kernel would drop it anyway. */}
        {otherParty && !billToOverride && otherParty.email.trim().toLowerCase() !== (job.customer_email ?? '').trim().toLowerCase() ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer', padding: '0.1rem 0' }}>
              <input type="checkbox" checked={copyOtherParty} onChange={(e) => setCopyOtherParty(e.target.checked)} />
              <span>
                Copy {otherParty.name} <span style={{ color: 'var(--text-muted)' }}>{otherParty.email} · {otherParty.role === 'gc' ? 'the GC, not billed' : 'the customer, not billed'}</span>
              </span>
            </label>
          ) : null}
          {/* Share this bill (v2.3376): the standing statement, beside the one-time
              copy. Offered whenever the job names a second party; the stamp is
              written on the bill row the channel bills against (stampShareOnInvoice). */}
          {shareParty && !billToOverride ? (
            <label data-testid="bill-customer-share-tick" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer', padding: '0.1rem 0' }}>
              <input type="checkbox" checked={showOtherParty} onChange={(e) => setShowOtherParty(e.target.checked)} style={{ marginTop: 2 }} />
              <span>
                Show it on {shareParty.name}&rsquo;s statement
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Their portal lists this bill as billed to {(job.customer_name ?? '').trim() || 'the payer'} &mdash; no Pay button, not in their balance.
                  {showOtherParty && !jobShowMemory ? ' This job’s next bills will start ticked.' : !showOtherParty && jobShowMemory ? ' This job’s next bills will start unticked.' : ''}
                </span>
              </span>
            </label>
          ) : null}
          <input
            type="email"
            value={oneOffEmail}
            onChange={(e) => setOneOffEmail(e.target.value)}
            placeholder="Also send to… (one-off email)"
            aria-label="Additional one-off email recipient"
            style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginTop: '0.25rem', boxSizing: 'border-box', fontSize: '0.8125rem' }}
          />
        </div>
      )}
      {/* Owner of record (v2.3450): on a GC job with no confirmed owner, what the roll says and Use —
          never a gate, and outside the email-gated Send-to block so a job whose customer row has no
          email still sees it (found in the 2026-09-15 live pass). */}
      <BillCustomerOwnerLine jobId={job.id} userId={userId} />
      {/* v2.4333 (punch list #76): the payer's checks the bank sent back this past year — never a gate. */}
      <BillCustomerReturnedChecksLine payerCustomerId={contactsCustomerId} />
      {/* Punch list #323: a payer on a Pay calendar — what sending today makes the bill, and what waiting costs. Never a gate. */}
      <BillCustomerPayCutoffLine payerCustomerId={contactsCustomerId} jobId={job.id} />
    </>
  )
}
