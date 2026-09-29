// @vitest-environment jsdom
/**
 * Render smoke for the portal's Your payments: the newest payments show, a
 * number finds one with its trail, Show all lists the rest, and nothing
 * renders when there is nothing on record.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PortalPaymentsSection, { PORTAL_CHECKS_VIEWER, type PortalChecks } from './PortalPaymentsSection'

const usd = (n: number) => `$${n.toFixed(2)}`
const job = (id: string, n: number, ref: string, paidOn: string): PortalChecks['jobs'][number] => ({
  id,
  click_number: String(n),
  job_name: `Job ${n}`,
  job_address: `${n} Main St`,
  customer_id: PORTAL_CHECKS_VIEWER,
  gc_customer_id: null,
  bill_to_party: null,
  lien_retainage_held: null,
  invoices: [{ id: `${id}-1`, job_id: id, sequence_order: 1, amount: 100, status: 'paid', billed_at: '2026-01-01' }],
  payments: [{ id: `${id}-p`, job_id: id, invoice_id: `${id}-1`, amount: 100, paid_on: paidOn, payment_type: 'check', reference_number: ref }],
})
const checks: PortalChecks = {
  jobs: [1, 2, 3, 4, 5, 6, 7].map((n) => job(`j${n}`, n, `${1000 + n}`, `2026-09-${String(n).padStart(2, '0')}`)),
  events: [{ id: 'e1', kind: 'moved', payment_id: 'j7-p', from_job_id: 'j1', to_job_id: 'j7', amount: 100, created_at: '2026-09-26T00:00:00Z' }],
}

describe('PortalPaymentsSection', () => {
  it('shows the newest five, finds one by number with its move, and lists all on request', () => {
    render(<PortalPaymentsSection checks={checks} formatUsd={usd} />)
    expect(screen.getByText('7 on record · $700.00')).toBeTruthy()
    expect(document.querySelectorAll('[data-portal-payment]')).toHaveLength(5)
    fireEvent.change(screen.getByLabelText('Find a payment by check number, amount or date'), { target: { value: '1007' } })
    expect(document.querySelectorAll('[data-portal-payment]')).toHaveLength(1)
    expect(screen.getByText(/Check #1007 · \$100\.00 · received Sep 7, 2026/)).toBeTruthy()
    expect(screen.getByText('$100.00 moved from 1 Main St · 1 Job 1 to 7 Main St · 7 Job 7 on Sep 26')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Find a payment by check number, amount or date'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7 payments' }))
    expect(document.querySelectorAll('[data-portal-payment]')).toHaveLength(7)
  })
  it('renders nothing with no payments on record', () => {
    const { container } = render(<PortalPaymentsSection checks={{ jobs: [], events: [] }} formatUsd={usd} />)
    expect(container.innerHTML).toBe('')
  })
})
