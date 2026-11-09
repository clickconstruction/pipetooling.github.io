// @vitest-environment jsdom
/**
 * The Job tab's customer block (v2.3262): the customer's portal globe renders
 * beside the name when the job carries a customer id — the same globe the
 * Edit tab and the Pipeline rows use — and stays away when it doesn't. Beside
 * it, the Messages speech bubble (residential R2) closes the window before it
 * opens the customer's thread. Since punch list #125 PR 7 (v2.6717) the ✉️ chip
 * opens the customer's sheet on Email instead of a `mailto:`, and a copy press
 * beside it copies the address.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
const io = vi.hoisted(() => ({ contactForCustomer: vi.fn<(id: string) => Promise<string>>(), opened: [] as string[] }))
vi.mock('../../lib/messages/messagesIo', () => ({ contactForCustomer: io.contactForCustomer }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => io.opened.push(url) }))
vi.mock('../customers/CustomerPortalGlobeButton', () => ({
  default: ({ customerId, customerName }: { customerId: string; customerName: string }) => (
    <span data-testid="portal-globe" data-customer-id={customerId}>
      🌐 {customerName}
    </span>
  ),
}))

import { DetailJobModalCustomerPanel } from './DetailJobModal'

afterEach(() => {
  cleanup()
  io.opened.length = 0
})

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

  it('with the customer’s door given (v2.5629), the bubble opens it and neither leaves the window nor reads the thread', () => {
    const onLeave = vi.fn()
    const onOpenCustomerDoor = vi.fn()
    io.contactForCustomer.mockClear()
    renderWithProviders(
      <DetailJobModalCustomerPanel customerName="Done Right Foundation" customerId="cust-1" customerPhone={null} customerEmail={null} onLeave={onLeave} onOpenCustomerDoor={onOpenCustomerDoor} />,
    )
    fireEvent.click(screen.getByLabelText('Open Done Right Foundation’s messages'))
    expect(onOpenCustomerDoor).toHaveBeenCalledTimes(1)
    expect(onOpenCustomerDoor).toHaveBeenCalledWith()
    expect(onLeave).not.toHaveBeenCalled()
    expect(io.contactForCustomer).not.toHaveBeenCalled()
  })
})

describe('DetailJobModalCustomerPanel — the email chip through the office (#125 PR 7)', () => {
  it('the ✉️ chip opens the customer’s sheet on Email, and no mailto: is opened', () => {
    const onOpenCustomerDoor = vi.fn()
    renderWithProviders(
      <DetailJobModalCustomerPanel customerName="Done Right Foundation" customerId="cust-1" customerPhone={null} customerEmail="donerightfoundation@outlook.com" onOpenCustomerDoor={onOpenCustomerDoor} />,
    )
    const chip = screen.getByRole('button', { name: 'Customer email — email them from the office' })
    expect(chip.textContent).toContain('donerightfoundation@outlook.com')
    fireEvent.click(chip)
    expect(onOpenCustomerDoor).toHaveBeenCalledWith('email')
    fireEvent.keyDown(chip, { key: 'Enter' })
    expect(onOpenCustomerDoor).toHaveBeenCalledTimes(2)
    expect(io.opened).toEqual([])
  })

  it('the copy press copies the address and says so', async () => {
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t: string) => { written.push(t); return Promise.resolve() } }, configurable: true })
    renderWithProviders(
      <DetailJobModalCustomerPanel customerName="Done Right Foundation" customerId="cust-1" customerPhone={null} customerEmail="donerightfoundation@outlook.com" onOpenCustomerDoor={() => undefined} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy the email address' }))
    await waitFor(() => expect(written).toEqual(['donerightfoundation@outlook.com']))
    await waitFor(() => expect(document.body.textContent).toContain('Email address copied'))
    expect(io.opened).toEqual([])
  })

  it('with no door, the chip copies the address instead of opening a mailto:', async () => {
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t: string) => { written.push(t); return Promise.resolve() } }, configurable: true })
    renderWithProviders(<DetailJobModalCustomerPanel customerName="Done Right Foundation" customerId={null} customerPhone={null} customerEmail="donerightfoundation@outlook.com" />)
    fireEvent.click(screen.getByRole('button', { name: 'Customer email — copy the address' }))
    await waitFor(() => expect(written).toEqual(['donerightfoundation@outlook.com']))
    expect(io.opened).toEqual([])
  })

  it('the ☎ chip still dials from the person’s own phone', () => {
    renderWithProviders(<DetailJobModalCustomerPanel customerName="Done Right Foundation" customerId={null} customerPhone="(210) 590-5150" customerEmail={null} />)
    fireEvent.click(screen.getByLabelText('Customer phone — call number'))
    expect(io.opened).toEqual(['tel:(210) 590-5150'])
  })
})
