import type { CSSProperties } from 'react'

/**
 * Bill Customer preview only: visual emphasis for invoice line copy that matches
 * the lowercase-leading-line hint (not applied to customer-facing PDFs).
 */
export function mergeBillCustomerInvoiceDescriptionIssueChrome(
  base: CSSProperties,
  flagged: boolean
): CSSProperties {
  if (!flagged) return base
  return {
    ...base,
    background: '#fef2f2',
    borderTop: '1px solid #fca5a5',
    borderBottom: '1px solid #fca5a5',
    borderLeft: '3px solid #dc2626',
    borderRight: '1px solid #fca5a5',
  }
}
