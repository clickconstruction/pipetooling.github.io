/**
 * Bill Customer's shared field styles: the label, the control, the text box, the disclosure press and the gray
 * Invoice Modifications card. One home, read by the window (`SendRecordInvoiceModal`) and by the pieces cut out of it.
 */
import type { CSSProperties } from 'react'

/** Match Edit Job / JobFormModal field styling */
export const BILL_CUSTOMER_FIELD_LABEL_STYLE: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontWeight: 500,
  fontSize: '0.875rem',
  color: 'var(--text-700)',
}

export const BILL_CUSTOMER_CONTROL_STYLE: CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
  background: 'var(--surface)',
}

/** A date box: the control, kept light so the browser's own date picker reads in dark mode. */
export const BILL_CUSTOMER_DATE_INPUT_STYLE: CSSProperties = {
  ...BILL_CUSTOMER_CONTROL_STYLE,
  colorScheme: 'light',
}

export const BILL_CUSTOMER_TEXTAREA_STYLE: CSSProperties = {
  ...BILL_CUSTOMER_CONTROL_STYLE,
  resize: 'vertical',
  lineHeight: 1.4,
  minHeight: '4.25rem',
}

export const BILL_CUSTOMER_LINE_ON_BILL_PLACEHOLDER = 'Custom service.'

export const BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  width: '100%',
  padding: '0.4rem 0.25rem',
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  boxSizing: 'border-box',
}

/** Line item override + Memo + Footer: tighter vertical rhythm than standalone disclosures. */
export const BILL_CUSTOMER_MODIFICATIONS_STACK_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
}

/** Stripe + Physical: gray card around invoice modification disclosures. */
export const BILL_CUSTOMER_INVOICE_MODIFICATIONS_SHELL_STYLE: CSSProperties = {
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.75rem 1rem',
  marginBottom: '0.75rem',
}

export const BILL_CUSTOMER_INVOICE_MODIFICATIONS_TITLE_STYLE: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text-strong)',
  marginBottom: '0.35rem',
  textAlign: 'center',
}

export const BILL_CUSTOMER_PHYSICAL_DATE_LINK_BUTTON_STYLE: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-link)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  font: 'inherit',
  textAlign: 'left',
}
