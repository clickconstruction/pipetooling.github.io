// @vitest-environment jsdom
/**
 * Render smoke for the customer page's "Scheduled in kind" card (v2.8314, punch list #301): the
 * bills an in kind arrangement pays, with what was billed, what the credits paid and what is still
 * to come. No pay press, and nothing drawn when there are none.
 */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { PortalScheduledBillsCard } from './PortalScheduledBillsCard'
import { SCHEDULED_BILLS_WORDS, scheduledBillsTotal } from '../../lib/portal/portalScheduledWords'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { PortalScheduledBill } from '../../lib/portal/portalPayload'

const bills: PortalScheduledBill[] = [
  { invoiceId: 'i2', jobLabel: 'Shop restroom · Job 1104', jobNumber: '1104', jobName: 'Shop restroom', serviceTag: 'plum', jobAddress: '40 Mill Rd, Kyle, TX 78640', amount: 700, billedAmount: 900, totalPaid: 200, billedOn: '2026-05-01' },
  { invoiceId: null, jobLabel: 'Hose bibs · Job 1109', jobNumber: '1109', jobName: 'Hose bibs', serviceTag: null, jobAddress: null, amount: 500, billedAmount: 500, totalPaid: 0, billedOn: null },
]

describe('PortalScheduledBillsCard', () => {
  it('lists each bill with what is to come, and says it is not in the balance', () => {
    const { container } = renderWithProviders(<PortalScheduledBillsCard bills={bills} />)
    expect(screen.getByText(SCHEDULED_BILLS_WORDS.eyebrow)).toBeTruthy()
    expect(screen.getByText(SCHEDULED_BILLS_WORDS.why)).toBeTruthy()
    expect(screen.getByText(SCHEDULED_BILLS_WORDS.foot)).toBeTruthy()
    expect(container.querySelectorAll('[data-portal-scheduled-bill]')).toHaveLength(2)
    expect(screen.getByText('2 bills · $1,200.00 to come')).toBeTruthy()
    expect(screen.getByText('40 Mill Rd, Kyle, TX 78640')).toBeTruthy()
    expect(screen.getByText('Job 1104 · Shop restroom')).toBeTruthy()
    expect(screen.getByText('Billed May 1, 2026 · $200.00 paid in kind')).toBeTruthy()
    expect(screen.getByText('of $900.00')).toBeTruthy()
    // A job with no address leads with its name, and says it once.
    expect(screen.getAllByText('Hose bibs')).toHaveLength(1)
    expect(scheduledBillsTotal(bills)).toBe(1200)
  })

  it('offers no press and no link: there is nothing to pay here', () => {
    const { container } = renderWithProviders(<PortalScheduledBillsCard bills={bills} />)
    expect(container.querySelectorAll('button, a')).toHaveLength(0)
  })

  it('draws nothing with no bill on a deal', () => {
    const { container } = renderWithProviders(<PortalScheduledBillsCard bills={[]} />)
    expect(container.querySelector('[data-portal-scheduled-bills]')).toBeNull()
  })
})
