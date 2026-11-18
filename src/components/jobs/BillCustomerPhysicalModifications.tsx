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
  PHYSICAL_INVOICE_FOOTER_MAX_CHARS,
  physicalInvoiceFooterActivePresetId,
  physicalInvoiceFooterSummaryLine,
  type PhysicalInvoiceFooterPreset,
} from '../../lib/physicalInvoiceFooter'
import { BillCustomerDisclosure } from './BillCustomerDisclosure'
import { BillCustomerMemoPresetRow } from './BillCustomerMemoPresetRow'
import {
  BILL_CUSTOMER_FIELD_LABEL_STYLE,
  BILL_CUSTOMER_INVOICE_MODIFICATIONS_SHELL_STYLE,
  BILL_CUSTOMER_INVOICE_MODIFICATIONS_TITLE_STYLE,
  BILL_CUSTOMER_LINE_ON_BILL_PLACEHOLDER,
  BILL_CUSTOMER_MODIFICATIONS_STACK_STYLE,
  BILL_CUSTOMER_TEXTAREA_STYLE,
} from './billCustomerStyles'

/**
 * Every value is the window's own state under the window's own name (SEND_RECORD_INVOICE_MODAL map, structural fact
 * "Several stripe-named states are cross-channel"): the line and the memo are shared with the other channels, and the
 * two disclosures' open state carries across tabs, so nothing here is owned by the card.
 */
export type BillCustomerPhysicalModificationsProps = {
  job: JobBillingContext
  lineOnBillSectionOpen: boolean
  setLineOnBillSectionOpen: Dispatch<SetStateAction<boolean>>
  /** The line item override. Stripe-named, and also the physical invoice's line on the bill. */
  stripeLineDescription: string
  setStripeLineDescription: (value: string) => void
  memoSectionOpen: boolean
  setMemoSectionOpen: Dispatch<SetStateAction<boolean>>
  /** The physical invoice's memo, which is also HouseCall Pro's. */
  externalNote: string
  setExternalNote: (value: string) => void
  memoPresets: BillCustomerMemoPreset[]
  /** A memo preset writes the physical memo and the Stripe memo together. */
  applyMemoPresetToBoth: (body: string) => void
  physicalFooterSectionOpen: boolean
  setPhysicalFooterSectionOpen: Dispatch<SetStateAction<boolean>>
  physicalInvoiceFooter: string
  setPhysicalInvoiceFooter: (value: string) => void
  physicalFooterPresets: PhysicalInvoiceFooterPreset[]
}

/** Bill Customer, Physical invoice: the gray Invoice Modifications card with its three disclosures (line item override, memo, footer). */
export function BillCustomerPhysicalModifications({
  job,
  lineOnBillSectionOpen,
  setLineOnBillSectionOpen,
  stripeLineDescription,
  setStripeLineDescription,
  memoSectionOpen,
  setMemoSectionOpen,
  externalNote,
  setExternalNote,
  memoPresets,
  applyMemoPresetToBoth,
  physicalFooterSectionOpen,
  setPhysicalFooterSectionOpen,
  physicalInvoiceFooter,
  setPhysicalInvoiceFooter,
  physicalFooterPresets,
}: BillCustomerPhysicalModificationsProps) {
  const physicalFooterActiveId = physicalInvoiceFooterActivePresetId(physicalInvoiceFooter)

  return (
    <div style={BILL_CUSTOMER_INVOICE_MODIFICATIONS_SHELL_STYLE}>
      <div style={BILL_CUSTOMER_INVOICE_MODIFICATIONS_TITLE_STYLE}>
        Invoice Modifications (optional)
      </div>
      <div style={BILL_CUSTOMER_MODIFICATIONS_STACK_STYLE}>
    <BillCustomerDisclosure
      panelId="bill-customer-physical-line-on-bill-section-panel"
      headingId="bill-customer-physical-line-on-bill-disclosure-heading"
      title="Line item override"
      summary={billCustomerLineOnBillSummaryLine(stripeLineDescription)}
      open={lineOnBillSectionOpen}
      onToggle={() => setLineOnBillSectionOpen((v) => !v)}
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
          id="bill-customer-physical-line-on-bill-count"
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
        id="bill-customer-physical-line-description"
        aria-describedby="bill-customer-physical-line-on-bill-count"
        placeholder={BILL_CUSTOMER_LINE_ON_BILL_PLACEHOLDER}
        value={stripeLineDescription}
        onChange={(e) =>
          setStripeLineDescription(e.target.value.slice(0, STRIPE_INVOICE_LINE_DESCRIPTION_MAX))
        }
        rows={2}
        style={{
          ...BILL_CUSTOMER_TEXTAREA_STYLE,
          marginBottom: 0,
          minHeight: '3.5rem',
        }}
      />
    </BillCustomerDisclosure>
    <BillCustomerDisclosure
      panelId="bill-customer-physical-memo-section-panel"
      headingId="bill-customer-physical-memo-disclosure-heading"
      title="Memo"
      summary={billCustomerMemoSummaryLine(externalNote)}
      open={memoSectionOpen}
      onToggle={() => setMemoSectionOpen((v) => !v)}
    >
      <span style={{ ...BILL_CUSTOMER_FIELD_LABEL_STYLE, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
        ({externalNote.length} / {BILL_CUSTOMER_MEMO_MAX_CHARS})
      </span>
      <BillCustomerMemoPresetRow
        presets={memoPresets}
        valueForHighlight={externalNote}
        onApplyBoth={applyMemoPresetToBoth}
      />
      <textarea
        value={externalNote}
        onChange={(e) => setExternalNote(e.target.value.slice(0, BILL_CUSTOMER_MEMO_MAX_CHARS))}
        rows={2}
        style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: 0, minHeight: '3.5rem' }}
      />
    </BillCustomerDisclosure>
    <BillCustomerDisclosure
      panelId="bill-customer-physical-footer-section-panel"
      headingId="bill-customer-physical-footer-disclosure-heading"
      title="Footer"
      summary={physicalInvoiceFooterSummaryLine(physicalInvoiceFooter)}
      open={physicalFooterSectionOpen}
      onToggle={() => setPhysicalFooterSectionOpen((v) => !v)}
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
          id="bill-customer-physical-invoice-footer-count"
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontWeight: 400,
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          ({physicalInvoiceFooter.length} / {PHYSICAL_INVOICE_FOOTER_MAX_CHARS})
        </span>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.35rem',
            alignItems: 'center',
            flexShrink: 0,
            justifyContent: 'flex-end',
          }}
        >
          {physicalFooterPresets.map((p) => {
            const pressed = physicalFooterActiveId === p.id
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                  if (pressed) {
                    setPhysicalInvoiceFooter('')
                    return
                  }
                  setPhysicalInvoiceFooter(p.body.slice(0, PHYSICAL_INVOICE_FOOTER_MAX_CHARS))
                }}
                title={`${p.label} physical footer (click again to clear)`}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  border: pressed ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: pressed ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                  color: 'var(--text-700)',
                  cursor: 'pointer',
                  fontWeight: pressed ? 600 : 500,
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>
      <textarea
        id="bill-customer-physical-invoice-footer"
        aria-labelledby="bill-customer-physical-footer-disclosure-heading"
        aria-describedby="bill-customer-physical-invoice-footer-count"
        value={physicalInvoiceFooter}
        onChange={(e) =>
          setPhysicalInvoiceFooter(e.target.value.slice(0, PHYSICAL_INVOICE_FOOTER_MAX_CHARS))
        }
        rows={3}
        style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: 0, minHeight: '4.5rem' }}
      />
    </BillCustomerDisclosure>
      </div>
    </div>
  )
}
