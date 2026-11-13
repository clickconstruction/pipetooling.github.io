// @vitest-environment jsdom
/**
 * Bill Customer's three faces (punch list #343, PR 2): the pills switch the face, the bill stays mounted behind the
 * others, the email draws in a frame that takes no clicks, and the text draws as a bubble or as the reason none goes.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BillCustomerFaces, { type BillCustomerFacesProps } from './BillCustomerFaces'

afterEach(cleanup)

const email = { from: 'Click Plumbing and Electrical <team@example.com>', to: 'dana@example.com', subject: 'Invoice #1042 from Click Plumbing and Electrical', html: '<p>Hello Dana</p>' }

function draw(over: Partial<BillCustomerFacesProps> = {}) {
  const onFace = vi.fn()
  render(<BillCustomerFaces who="Dana Whitfield" face="bill" onFace={onFace} bill={<div data-testid="the-bill">the bill box</div>} email={null} text={{ state: 'idle' }} {...over} />)
  return onFace
}

describe('BillCustomerFaces', () => {
  it('heads the box with who is billed and offers the three faces', () => {
    const onFace = draw()
    expect(screen.getByText('What Dana Whitfield will get')).toBeTruthy()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['The bill', 'The email', 'The text'])
    expect(screen.getByRole('tab', { name: 'The bill' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'The email' }))
    expect(onFace).toHaveBeenCalledWith('email')
  })

  it('reads the customer when the job names nobody', () => {
    draw({ who: null })
    expect(screen.getByText('What the customer will get')).toBeTruthy()
  })

  it('the email face: From, To, Subject and the message in a frame with no powers; the bill stays mounted, hidden', () => {
    draw({ face: 'email', email })
    expect(screen.getByTestId('bill-customer-face-email-subject').textContent).toBe('Subject: Invoice #1042 from Click Plumbing and Electrical')
    const frame = screen.getByTestId('bill-customer-face-email-frame') as HTMLIFrameElement
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.getAttribute('srcdoc')).toBe('<p>Hello Dana</p>')
    expect(screen.getByText(/The Pay now button works once the bill is made/)).toBeTruthy()
    expect((screen.getByTestId('the-bill').parentElement as HTMLElement).style.display).toBe('none')
  })

  it('the email face with no amount yet says what it waits on', () => {
    draw({ face: 'email', email: null })
    expect(screen.getByText('The email shows once the bill has an amount and a due day.')).toBeTruthy()
  })

  it('the text face: the bubble, the number, and that this press does not send it', () => {
    draw({ face: 'text', text: { state: 'ready', face: { kind: 'text', to: '(512) 555-0142', words: 'Hi Dana, your bill is ready. Pay it here: https://my.clickplumbing.com/pay/sample', note: 'The app’s own Billed line, filled for this bill.' } } })
    expect(screen.getByText('Text to (512) 555-0142')).toBeTruthy()
    expect(screen.getByTestId('bill-customer-face-text-words').textContent).toBe('Hi Dana, your bill is ready. Pay it here: https://my.clickplumbing.com/pay/sample')
    expect(screen.getByText(/This press does not send it/)).toBeTruthy()
  })

  it('the text face with no number reads the reason; while reading and on a failed read it says so', () => {
    draw({ face: 'text', text: { state: 'ready', face: { kind: 'hold', words: 'No text: Dana has no phone number on file. Add one on the customer.' } } })
    expect(screen.getByTestId('bill-customer-face-text-hold').textContent).toBe('No text: Dana has no phone number on file. Add one on the customer.')
    cleanup()
    draw({ face: 'text', text: { state: 'loading' } })
    expect(screen.getByRole('status').textContent).toBe('Reading the text…')
    cleanup()
    draw({ face: 'text', text: { state: 'failed' } })
    expect(screen.getByRole('status').textContent).toBe('The text could not be read. The next screen still shows it before it goes.')
  })
})
