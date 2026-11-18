import type { Dispatch, SetStateAction } from 'react'
import type { JobBillingContext } from '../../lib/jobBillingContext'
import { defaultStripeLineDescriptionFromJob, STRIPE_INVOICE_LINE_DESCRIPTION_MAX } from '../../lib/stripeInvoiceLineDescription'
import {
  BILL_CUSTOMER_MEMO_MAX_CHARS,
  billCustomerLineOnBillSummaryLine,
  billCustomerMemoSummaryLine,
  type BillCustomerMemoPreset,
} from '../../lib/billCustomerMemoPresets'
import {
  getStripeInvoiceFooterPresetElectrical,
  getStripeInvoiceFooterPresetPlumbing,
  STRIPE_INVOICE_FOOTER_MAX_CHARS,
  stripeInvoiceFooterActivePreset,
  stripeInvoiceFooterSummaryLine,
} from '../../lib/stripeInvoiceFooter'
import { BillCustomerMemoPresetRow } from './BillCustomerMemoPresetRow'
import {
  BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
  BILL_CUSTOMER_FIELD_LABEL_STYLE,
  BILL_CUSTOMER_INVOICE_MODIFICATIONS_SHELL_STYLE,
  BILL_CUSTOMER_INVOICE_MODIFICATIONS_TITLE_STYLE,
  BILL_CUSTOMER_LINE_ON_BILL_PLACEHOLDER,
  BILL_CUSTOMER_MODIFICATIONS_STACK_STYLE,
  BILL_CUSTOMER_TEXTAREA_STYLE,
} from './billCustomerStyles'

/**
 * Every value is the window's own state under the window's own name (SEND_RECORD_INVOICE_MODAL map, structural fact
 * "Several stripe-named states are cross-channel"): the line is shared with the physical invoice, the memo is written
 * by the other channels' preset rows, the footer by the hazmat and preset loads, and the two shared disclosures' open
 * state carries across tabs, so nothing here is owned by the card.
 */
export type BillCustomerStripeModificationsProps = {
  job: JobBillingContext
  lineOnBillSectionOpen: boolean
  setLineOnBillSectionOpen: Dispatch<SetStateAction<boolean>>
  /** The line item override, which is also the physical invoice's line on the bill. */
  stripeLineDescription: string
  setStripeLineDescription: (value: string) => void
  memoSectionOpen: boolean
  setMemoSectionOpen: Dispatch<SetStateAction<boolean>>
  stripeMemo: string
  setStripeMemo: (value: string) => void
  memoPresets: BillCustomerMemoPreset[]
  /** A memo preset writes the Stripe memo and the physical memo together. */
  applyMemoPresetToBoth: (body: string) => void
  stripeFooterSectionOpen: boolean
  setStripeFooterSectionOpen: Dispatch<SetStateAction<boolean>>
  stripeInvoiceFooter: string
  setStripeInvoiceFooter: (value: string) => void
}

/** Bill Customer, Stripe bill: the gray Invoice Modifications card with its three disclosures (line item override, memo, footer). */
export function BillCustomerStripeModifications({
  job,
  lineOnBillSectionOpen,
  setLineOnBillSectionOpen,
  stripeLineDescription,
  setStripeLineDescription,
  memoSectionOpen,
  setMemoSectionOpen,
  stripeMemo,
  setStripeMemo,
  memoPresets,
  applyMemoPresetToBoth,
  stripeFooterSectionOpen,
  setStripeFooterSectionOpen,
  stripeInvoiceFooter,
  setStripeInvoiceFooter,
}: BillCustomerStripeModificationsProps) {
  const activeStripeFooterPreset = stripeInvoiceFooterActivePreset(stripeInvoiceFooter)

  return (
    <div style={BILL_CUSTOMER_INVOICE_MODIFICATIONS_SHELL_STYLE}>
      <div style={BILL_CUSTOMER_INVOICE_MODIFICATIONS_TITLE_STYLE}>
        Invoice Modifications (optional)
      </div>
      <div style={BILL_CUSTOMER_MODIFICATIONS_STACK_STYLE}>
      <button
        type="button"
        aria-expanded={lineOnBillSectionOpen}
        aria-controls="bill-customer-stripe-line-on-bill-section-panel"
        onClick={() => setLineOnBillSectionOpen((v) => !v)}
        style={{
          ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
          marginBottom: 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
          <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
            {lineOnBillSectionOpen ? '▼' : '\u25b6'}
          </span>
          <span
            id="bill-customer-stripe-line-on-bill-disclosure-heading"
            style={{
              fontWeight: 500,
              fontSize: '0.875rem',
              color: 'var(--text-700)',
            }}
          >
            Line item override
          </span>
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {billCustomerLineOnBillSummaryLine(stripeLineDescription)}
        </span>
      </button>
      <div
        id="bill-customer-stripe-line-on-bill-section-panel"
        role="region"
        aria-labelledby="bill-customer-stripe-line-on-bill-disclosure-heading"
        hidden={!lineOnBillSectionOpen}
        style={{ marginBottom: 0 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: 4,
            flexWrap: 'wrap',
          }}
        >
          <span
            id="bill-customer-stripe-line-on-bill-count"
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontWeight: 400,
              flex: '1 1 auto',
              minWidth: 0,
            }}
          >
            ({stripeLineDescription.length} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
          </span>
          <button
            type="button"
            onClick={() => job && setStripeLineDescription(defaultStripeLineDescriptionFromJob(job))}
            disabled={!job}
            title="Reset line item override to default"
            aria-label="Reset line item override to default"
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              color: 'var(--text-link)',
              cursor: job ? 'pointer' : 'not-allowed',
              fontSize: '0.8125rem',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              flexShrink: 0,
            }}
          >
            default
          </button>
        </div>
        <textarea
          id="bill-customer-stripe-line-description"
          aria-describedby="bill-customer-stripe-line-on-bill-count"
          placeholder={BILL_CUSTOMER_LINE_ON_BILL_PLACEHOLDER}
          value={stripeLineDescription}
          onChange={(e) =>
            setStripeLineDescription(
              e.target.value.slice(0, STRIPE_INVOICE_LINE_DESCRIPTION_MAX),
            )
          }
          rows={2}
          style={{
            ...BILL_CUSTOMER_TEXTAREA_STYLE,
            marginBottom: 0,
            minHeight: '3.5rem',
          }}
        />
      </div>
      <button
        type="button"
        aria-expanded={memoSectionOpen}
        aria-controls="bill-customer-stripe-memo-section-panel"
        onClick={() => setMemoSectionOpen((v) => !v)}
        style={{
          ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
          marginBottom: 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
          <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
            {memoSectionOpen ? '▼' : '\u25b6'}
          </span>
          <span
            id="bill-customer-stripe-memo-disclosure-heading"
            style={{
              fontWeight: 500,
              fontSize: '0.875rem',
              color: 'var(--text-700)',
            }}
          >
            Memo
          </span>
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {billCustomerMemoSummaryLine(stripeMemo)}
        </span>
      </button>
      <div
        id="bill-customer-stripe-memo-section-panel"
        role="region"
        aria-labelledby="bill-customer-stripe-memo-disclosure-heading"
        hidden={!memoSectionOpen}
        style={{ marginBottom: 0 }}
      >
        <span style={{ ...BILL_CUSTOMER_FIELD_LABEL_STYLE, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
          ({stripeMemo.length} / {BILL_CUSTOMER_MEMO_MAX_CHARS})
        </span>
        <BillCustomerMemoPresetRow
          presets={memoPresets}
          valueForHighlight={stripeMemo}
          onApplyBoth={applyMemoPresetToBoth}
        />
        <textarea
          value={stripeMemo}
          onChange={(e) => setStripeMemo(e.target.value.slice(0, BILL_CUSTOMER_MEMO_MAX_CHARS))}
          rows={2}
          style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: 0, minHeight: '3.5rem' }}
        />
      </div>
      <button
        type="button"
        aria-expanded={stripeFooterSectionOpen}
        aria-controls="bill-customer-footer-section-panel"
        onClick={() => setStripeFooterSectionOpen((v) => !v)}
        style={{
          ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
          marginBottom: 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
          <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
            {stripeFooterSectionOpen ? '▼' : '\u25b6'}
          </span>
          <span
            id="bill-customer-footer-disclosure-heading"
            style={{
              fontWeight: 500,
              fontSize: '0.875rem',
              color: 'var(--text-700)',
            }}
          >
            Footer
          </span>
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {stripeInvoiceFooterSummaryLine(stripeInvoiceFooter, activeStripeFooterPreset)}
        </span>
      </button>
      <div
        id="bill-customer-footer-section-panel"
        role="region"
        aria-labelledby="bill-customer-footer-disclosure-heading"
        hidden={!stripeFooterSectionOpen}
        style={{ marginBottom: 0 }}
      >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              marginBottom: '0.35rem',
            }}
          >
            <span
              id="bill-customer-stripe-invoice-footer-count"
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                fontWeight: 400,
                flex: '1 1 auto',
                minWidth: 0,
              }}
            >
              ({stripeInvoiceFooter.length} / {STRIPE_INVOICE_FOOTER_MAX_CHARS})
            </span>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.35rem',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                aria-pressed={activeStripeFooterPreset === 'plumbing'}
                onClick={() => {
                  if (activeStripeFooterPreset === 'plumbing') {
                    setStripeInvoiceFooter('')
                    return
                  }
                  setStripeInvoiceFooter(
                    getStripeInvoiceFooterPresetPlumbing().slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS),
                  )
                }}
                title="Plumbing footer (click again to clear and use Stripe default)"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  border:
                    activeStripeFooterPreset === 'plumbing'
                      ? '2px solid #2563eb'
                      : '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: activeStripeFooterPreset === 'plumbing' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                  color: 'var(--text-700)',
                  cursor: 'pointer',
                  fontWeight: activeStripeFooterPreset === 'plumbing' ? 600 : 500,
                }}
              >
                Plumbing
              </button>
              <button
                type="button"
                aria-pressed={activeStripeFooterPreset === 'electrical'}
                onClick={() => {
                  if (activeStripeFooterPreset === 'electrical') {
                    setStripeInvoiceFooter('')
                    return
                  }
                  setStripeInvoiceFooter(
                    getStripeInvoiceFooterPresetElectrical().slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS),
                  )
                }}
                title="Electrical footer (click again to clear and use Stripe default)"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  border:
                    activeStripeFooterPreset === 'electrical'
                      ? '2px solid #2563eb'
                      : '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: activeStripeFooterPreset === 'electrical' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                  color: 'var(--text-700)',
                  cursor: 'pointer',
                  fontWeight: activeStripeFooterPreset === 'electrical' ? 600 : 500,
                }}
              >
                Electrical
              </button>
            </div>
          </div>
          <textarea
            id="bill-customer-stripe-invoice-footer"
            aria-labelledby="bill-customer-footer-disclosure-heading"
            aria-describedby="bill-customer-stripe-invoice-footer-count"
            value={stripeInvoiceFooter}
            onChange={(e) =>
              setStripeInvoiceFooter(e.target.value.slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS))
            }
            rows={3}
            style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: 0, minHeight: '4.5rem' }}
          />
      </div>
      </div>
    </div>
  )
}
