// @vitest-environment jsdom
/**
 * Render smoke for two small pieces cut out of `SendRecordInvoiceModal` as a pure move: the *When you press* box above
 * each send (`BillCustomerPressBox`) and the made-bill screen's line about how the bill email went
 * (`BillCustomerMadeEmailLine`). Both draw what they are handed; the words come from the tested `theyWillGet`.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { billSampleHref, theyWillGet } from '../../lib/billing/billCustomerTheyWillGet'
import { BillCustomerMadeEmailLine } from './BillCustomerMadeEmailLine'
import { BillCustomerPressBox } from './BillCustomerPressBox'

const stripeWords = theyWillGet({ channel: 'stripe', name: 'Kestrin Contracting', email: 'ap@kestrin.test', phone: '5125550142', copyEmails: [] })
const physicalWords = theyWillGet({ channel: 'physical', name: 'Kestrin Contracting', email: 'ap@kestrin.test', copyEmails: ['dana@kestrin.test'] })

describe('BillCustomerPressBox', () => {
  it('says what the press does as a numbered list under the press’s own name, and what the quiet press does', () => {
    render(<BillCustomerPressBox channel="stripe" words={stripeWords} paidJobBlocked={false} canSeeSample={false} />)
    const box = screen.getByTestId('bill-customer-press-box')
    expect(within(box).getByText(stripeWords.pressTitle)).toBeTruthy()
    const lines = within(box).getAllByRole('listitem').map((li) => li.textContent)
    expect(lines).toEqual(stripeWords.pressLines)
    expect(lines.length).toBeGreaterThan(0)
    expect(stripeWords.later).toBeTruthy()
    expect(within(box).getByText(stripeWords.later!.line)).toBeTruthy()
    expect(within(box).queryByRole('link')).toBeNull()
  })

  it('the physical channel has no quiet press, so no line for it', () => {
    render(<BillCustomerPressBox channel="physical" words={physicalWords} paidJobBlocked={false} canSeeSample={false} />)
    const box = screen.getByTestId('bill-customer-press-box')
    expect(physicalWords.later).toBeFalsy()
    expect(within(box).getAllByRole('listitem').map((li) => li.textContent)).toEqual(physicalWords.pressLines)
    // The title, the list, and nothing after them.
    expect(box.children).toHaveLength(2)
  })

  it('offers the sample of this channel’s email, in a new tab, only to a role that may open What customers see', () => {
    render(<BillCustomerPressBox channel="physical" words={physicalWords} paidJobBlocked={false} canSeeSample />)
    const link = screen.getByRole('link', { name: 'See a sample of this email' })
    expect(link.getAttribute('href')).toBe(billSampleHref('physical'))
    expect(link.getAttribute('href')).not.toBe(billSampleHref('stripe'))
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  it('draws nothing while a paid job holds the presses: the box would promise a send', () => {
    const view = render(<BillCustomerPressBox channel="stripe" words={stripeWords} paidJobBlocked canSeeSample />)
    expect(view.container.innerHTML).toBe('')
  })
})

describe('BillCustomerMadeEmailLine', () => {
  it('draws nothing when the bill was made to send later', () => {
    const view = render(<BillCustomerMadeEmailLine made={null} />)
    expect(view.container.innerHTML).toBe('')
  })

  it('a sent email reads as a status, in the send’s own words', () => {
    render(<BillCustomerMadeEmailLine made={{ kind: 'sent', line: 'Bill email sent to ap@kestrin.test.' }} />)
    const line = screen.getByRole('status')
    expect(line.getAttribute('data-testid')).toBe('bill-customer-made-email')
    expect(line.getAttribute('data-kind')).toBe('sent')
    expect(line.textContent).toBe('Bill email sent to ap@kestrin.test.')
  })

  it('a failed email reads as an alert: the bill is made, the reason, and the press that sends it', () => {
    render(<BillCustomerMadeEmailLine made={{ kind: 'failed', error: 'The mail server said no.' }} />)
    const line = screen.getByRole('alert')
    expect(line.getAttribute('data-kind')).toBe('failed')
    expect(line.textContent).toBe('The bill is made. The bill email did not go: The mail server said no. Press Send Email invoice below to send it.')
  })
})
