import { billCustomerMissingEmailLead } from '../../lib/billing/billCustomerMissingEmail'
import type { EffectiveBillParty, PayerRecipient } from '../../lib/jobs/billToParty'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

/**
 * The draft, its save and its error are the window's (the save writes the job or the GC's customer row and overlays
 * the address on the composed job), so the banner owns nothing. The window draws it while the billed party has no email.
 */
export type BillCustomerMissingEmailBannerProps = {
  payerParty: EffectiveBillParty
  payerRecipient: PayerRecipient | null
  /** The job row's own customer id, before any payer or bill-to overlay: with none, there is no customer record to add the email to. */
  rawCustomerId: string | null | undefined
  /** The composed job's customer name, for the also-add tick. */
  customerName: string | null
  emailFixDraft: string
  setEmailFixDraft: (value: string) => void
  emailFixAlsoCustomer: boolean
  setEmailFixAlsoCustomer: (value: boolean) => void
  emailFixSaving: boolean
  emailFixError: string | null
  saveMissingCustomerEmail: () => Promise<void>
}

/** Bill Customer's yellow box for a billed party with no email (v2.936; a GC payer since v2.3345): type one and save it without leaving the window. */
export function BillCustomerMissingEmailBanner({
  payerParty,
  payerRecipient,
  rawCustomerId,
  customerName,
  emailFixDraft,
  setEmailFixDraft,
  emailFixAlsoCustomer,
  setEmailFixAlsoCustomer,
  emailFixSaving,
  emailFixError,
  saveMissingCustomerEmail,
}: BillCustomerMissingEmailBannerProps) {
  return (
    <div
      role="group"
      aria-label="Customer email missing"
      style={{
        border: '1px solid #d97706',
        background: 'var(--bg-amber-tint)',
        borderRadius: 8,
        padding: '0.6rem 0.75rem',
        marginBottom: '1rem',
      }}
    >
      <p style={{ margin: '0 0 0.4rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-amber-700)' }}>
        {billCustomerMissingEmailLead(payerParty, payerRecipient?.name)}
      </p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <input
          type="email"
          value={emailFixDraft}
          onChange={(e) => setEmailFixDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void saveMissingCustomerEmail()
            }
          }}
          placeholder={payerParty === 'gc' ? 'ap@builder.com' : 'customer@email.com'}
          aria-label={payerParty === 'gc' ? 'GC billing email' : 'Customer email'}
          style={{ flex: '1 1 200px', padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6 }}
        />
        <button
          type="button"
          onClick={() => void saveMissingCustomerEmail()}
          disabled={emailFixSaving || !emailFixDraft.trim()}
          style={{ padding: '0.4rem 0.9rem', background: emailFixSaving || !emailFixDraft.trim() ? DEAD_PRESS_FILL : '#2563eb', color: emailFixSaving || !emailFixDraft.trim() ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 6, cursor: emailFixSaving || !emailFixDraft.trim() ? 'not-allowed' : 'pointer', fontWeight: 600 }}
        >
          {emailFixSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {payerParty === 'gc' ? (
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Saved on {payerRecipient?.name || 'the GC'}&rsquo;s customer record — every job billed to them uses it.
        </p>
      ) : rawCustomerId ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={emailFixAlsoCustomer}
            onChange={(e) => setEmailFixAlsoCustomer(e.target.checked)}
          />
          Also add to {customerName ?? 'the customer'}&rsquo;s record if it has no email
        </label>
      ) : null}
      {emailFixError ? (
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{emailFixError}</p>
      ) : null}
    </div>
  )
}
