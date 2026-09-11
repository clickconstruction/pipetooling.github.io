// @vitest-environment jsdom
/**
 * Render smoke for the statement's "Prefer to pay by bank transfer?" card
 * (v2.3308): collapsed by default, opens to the grouped numbers, the memo,
 * the checks line and the guard line; a checks-only record gets the
 * "Paying by check?" title and no transfer grid.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { PortalBankTransferCard } from './PortalBankTransferCard'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BankTransferDetails } from '../../lib/bankTransferDetails'

const details: BankTransferDetails = {
  payeeName: 'Sample Plumbing LLC',
  bankName: 'Sample Bank',
  bankNote: 'Your bank may show this name instead of ours.',
  routingNumber: '000000000',
  accountNumber: '000012345678',
  accountKind: 'Checking',
  beneficiaryAddress: '100 Sample St, Kyle, TX 78640',
  checkMailingAddress: '12925 FM 20, Kingsbury, TX 78638',
  showOnPortal: true,
}

describe('PortalBankTransferCard', () => {
  it('is collapsed until tapped, then shows the numbers, memo, checks and guard lines', () => {
    renderWithProviders(<PortalBankTransferCard details={details} memo="Sam Sample · PLUM 1001, 0994" phone="(512) 360-0599" />)
    const toggle = screen.getByRole('button', { name: /prefer to pay by bank transfer/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    // The print-only copy is always in the DOM (the page's print rules hide it on screen), so the
    // screen copy shows up as a second set of Copy buttons once the card opens.
    expect(screen.getAllByLabelText('Copy 000012345678').length).toBe(1)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByText('0000 1234 5678').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sam Sample · PLUM 1001, 0994').length).toBeGreaterThan(0)
    expect(screen.getAllByText('12925 FM 20').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Kingsbury, TX 78638').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/the bank address is not a mailbox/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/for the wire form — not for mail/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/call \(512\) 360-0599 before sending anything/).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Copy 000012345678').length).toBe(2)
  })

  it('a checks-only record asks "Paying by check?" and shows no transfer grid', () => {
    renderWithProviders(
      <PortalBankTransferCard details={{ ...details, routingNumber: '', accountNumber: '' }} memo="Sam Sample" phone="" />,
    )
    fireEvent.click(screen.getByRole('button', { name: /paying by check/i }))
    expect(screen.queryByText('Routing')).toBeNull()
    expect(screen.getAllByText('Mail to').length).toBeGreaterThan(0)
    expect(screen.queryByText(/By bank transfer/)).toBeNull()
    expect(screen.getAllByText(/call our office before sending anything/).length).toBeGreaterThan(0)
  })
})
