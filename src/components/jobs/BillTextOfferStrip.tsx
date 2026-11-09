/**
 * The green strip after the bill goes (v2.6772, punch list #291 PR 2): what just happened on its first line, then the
 * one question *Text Dana the pay link too? A text is read in minutes. Email waits for the evening.* with **Text Dana
 * the bill…** (the Tell the customer sheet on the bill) and **Not now**; a customer who asked for email only reads
 * *Dana asked for email only.* in the question's place. Drawn by the share row (`StripeInvoiceSharePanel`) after its own
 * Email door, after Send Email invoice, after Bill Customer made the Stripe bill and after Make Stripe bill converted
 * one. The words are `lib/jobs/billTextOffer.ts`.
 */
import type { CSSProperties } from 'react'
import { BILL_TEXT_OFFER_WORDS, billTextOffer } from '../../lib/jobs/billTextOffer'
import type { TellPrefers } from '../../lib/tellCustomer/tellCustomer'

export interface BillTextOfferStripProps {
  /** What just happened: *The bill went to dana@example.com from the office. …* */
  lead: string
  first: string | null
  prefers: TellPrefers
  onText: () => void
  onNotNow: () => void
  compact?: boolean
}

const strip: CSSProperties = { background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.5rem', margin: '0.5rem 0' }
const leadRow: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--text-green-800)', lineHeight: 1.45, fontSize: '0.875rem' }
const askRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', paddingLeft: '1.6rem' }
const askWords: CSSProperties = { color: 'var(--text-strong)', flex: '1 1 14rem', minWidth: 0, fontSize: '0.875rem', lineHeight: 1.45 }
/** A blue press under white words keeps its literal fill (`check:press-blue`). */
const textBtn: CSSProperties = { background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.875rem', fontWeight: 600, minHeight: 40, cursor: 'pointer' }
const notNowBtn: CSSProperties = { background: 'transparent', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.875rem', minHeight: 40, cursor: 'pointer' }

export function BillTextOfferStrip({ lead, first, prefers, onText, onNotNow, compact = false }: BillTextOfferStripProps) {
  const offer = billTextOffer(first, prefers)
  return (
    <div role="status" style={compact ? { ...strip, padding: '0.5rem 0.6rem' } : strip} data-testid="bill-text-offer">
      <div style={leadRow}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', marginTop: 1 }}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span data-testid="bill-text-offer-lead">{lead}</span>
      </div>
      <div style={askRow}>
        {offer.kind === 'ask' ? (
          <>
            <span style={askWords} data-testid="bill-text-offer-ask">
              {offer.ask}
            </span>
            <button type="button" style={textBtn} onClick={onText} data-testid="bill-text-offer-text">
              {offer.press}
            </button>
            <button type="button" style={notNowBtn} onClick={onNotNow} data-testid="bill-text-offer-not-now">
              {BILL_TEXT_OFFER_WORDS.notNow}
            </button>
          </>
        ) : (
          <>
            <span style={{ ...askWords, color: 'var(--text-muted)' }} data-testid="bill-text-offer-email-only">
              {offer.words}
            </span>
            <button type="button" style={notNowBtn} onClick={onNotNow} data-testid="bill-text-offer-not-now">
              {BILL_TEXT_OFFER_WORDS.notNow}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
