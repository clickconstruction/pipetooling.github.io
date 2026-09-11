// @vitest-environment jsdom
/**
 * The Job tab's customer block (v2.3262): the customer's portal globe renders
 * beside the name when the job carries a customer id — the same globe the
 * Edit tab and the Pipeline rows use — and stays away when it doesn't.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../customers/CustomerPortalGlobeButton', () => ({
  default: ({ customerId, customerName }: { customerId: string; customerName: string }) => (
    <span data-testid="portal-globe" data-customer-id={customerId}>
      🌐 {customerName}
    </span>
  ),
}))

import { DetailJobModalCustomerPanel } from './DetailJobModal'

afterEach(() => cleanup())

describe('DetailJobModalCustomerPanel — the portal globe', () => {
  it('renders the globe beside the customer name when the job has a customer id', () => {
    renderWithProviders(
      <DetailJobModalCustomerPanel customerName="Done Right Foundation" customerId="cust-1" customerPhone="(210) 590-5150" customerEmail="donerightfoundation@outlook.com" />,
    )
    const globe = screen.getByTestId('portal-globe')
    expect(globe.getAttribute('data-customer-id')).toBe('cust-1')
    expect(globe.textContent).toContain('Done Right Foundation')
    expect(screen.getByText('Done Right Foundation', { selector: 'span:not([data-testid])' })).toBeTruthy()
  })
  it('no customer id, or no name — no globe', () => {
    renderWithProviders(<DetailJobModalCustomerPanel customerName="Done Right Foundation" customerId={null} customerPhone={null} customerEmail={null} />)
    expect(screen.queryByTestId('portal-globe')).toBeNull()
    cleanup()
    renderWithProviders(<DetailJobModalCustomerPanel customerName="" customerId="cust-1" customerPhone={null} customerEmail={null} />)
    expect(screen.queryByTestId('portal-globe')).toBeNull()
    expect(screen.getByText('[missing customer name]')).toBeTruthy()
  })
})
