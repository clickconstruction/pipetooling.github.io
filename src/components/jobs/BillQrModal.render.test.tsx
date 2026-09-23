// @vitest-environment jsdom
/**
 * Render smokes for the pay-code modal (punch list #35, v2.3757): the code carries the
 * bill's `/pay/<id>` address with the mark carved in, the bill and the balance are named,
 * and the four doors are there. The clipboard, the download and the print window are
 * browser plumbing the smoke does not drive.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BillQrModal } from './BillQrModal'

vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: vi.fn() }) }))

const ID = '8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44'

describe('BillQrModal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<BillQrModal open={false} onClose={() => {}} invoiceId={ID} billLabel="Invoice #1025-2609180905" jobName="Lago Vista St" amountLabel="$4,660.00" />)
    expect(container.innerHTML).toBe('')
  })

  it('draws the pay address as a level-Q code with the mark, and names the bill, the job and the balance', () => {
    render(<BillQrModal open onClose={() => {}} invoiceId={ID} billLabel="Invoice #1025-2609180905" jobName="Lago Vista St" amountLabel="$4,660.00" />)
    const code = screen.getByTestId('bill-qr-code')
    expect(code.tagName.toLowerCase()).toBe('svg')
    expect(code.getAttribute('viewBox')).toBe('0 0 45 45')
    expect(code.querySelector('image')?.getAttribute('href')).toBe('/brand/click-mark.png')
    expect(screen.getByTestId('bill-qr-address').textContent).toBe(`clicktooling.com/pay/${ID}`)
    expect(screen.getByText('Invoice #1025-2609180905')).toBeTruthy()
    expect(screen.getByText('Lago Vista St')).toBeTruthy()
    expect(screen.getByText('$4,660.00')).toBeTruthy()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Copy image', 'Download PNG', 'Print', 'Close'])
  })

  it('closes on Close, on the scrim and on Escape', () => {
    const onClose = vi.fn()
    render(<BillQrModal open onClose={onClose} invoiceId={ID} billLabel="Bill" jobName={null} amountLabel="" />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('presentation'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(screen.queryByText(/Still owed/)).toBeNull()
  })
})
