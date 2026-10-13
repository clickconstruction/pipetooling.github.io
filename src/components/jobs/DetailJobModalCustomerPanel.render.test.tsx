// @vitest-environment jsdom
/**
 * The Job tab's customer block (v2.3262): the customer's portal globe renders
 * beside the name when the job carries a customer id — the same globe the
 * Edit tab and the Pipeline rows use — and stays away when it doesn't. Beside
 * it, the Messages speech bubble (residential R2) closes the window before it
 * opens the customer's thread.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
const io = vi.hoisted(() => ({ contactForCustomer: vi.fn<(id: string) => Promise<string>>() }))
vi.mock('../../lib/messages/messagesIo', () => ({ contactForCustomer: io.contactForCustomer }))
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

  it('puts the Messages bubble beside the name, and its press closes the window before Messages opens', async () => {
    io.contactForCustomer.mockResolvedValue('c-1')
    const onLeave = vi.fn()
    renderWithProviders(
      <DetailJobModalCustomerPanel customerName="Done Right Foundation" customerId="cust-1" customerPhone={null} customerEmail={null} onLeave={onLeave} />,
    )
    fireEvent.click(screen.getByLabelText('Open Done Right Foundation’s messages'))
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1))
    expect(io.contactForCustomer).toHaveBeenCalledWith('cust-1')
  })
})
