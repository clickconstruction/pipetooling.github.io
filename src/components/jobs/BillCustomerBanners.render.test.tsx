// @vitest-environment jsdom
/**
 * Render smoke for Bill Customer's two banners, cut out of `SendRecordInvoiceModal` as a pure move: the yellow box for
 * a billed party with no email (`BillCustomerMissingEmailBanner`) and the note that someone other than the job's
 * customer is billed (`BillCustomerPayerBanner`). Both draw what they are handed. The save itself stays in the window.
 */
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { PayerRecipient } from '../../lib/jobs/billToParty'
import { BillCustomerMissingEmailBanner, type BillCustomerMissingEmailBannerProps } from './BillCustomerMissingEmailBanner'
import { BillCustomerPayerBanner } from './BillCustomerPayerBanner'

const GC: PayerRecipient = { customerId: 'gc-1', name: 'Hollis Builders', email: '', phone: '' }

type Over = Partial<Pick<BillCustomerMissingEmailBannerProps, 'payerParty' | 'payerRecipient' | 'rawCustomerId' | 'customerName' | 'emailFixSaving' | 'emailFixError'>>

function Harness({ over = {}, save }: { over?: Over; save: () => Promise<void> }) {
  const [draft, setDraft] = useState('')
  const [also, setAlso] = useState(true)
  return (
    <>
      <BillCustomerMissingEmailBanner
        payerParty={over.payerParty ?? 'customer'}
        payerRecipient={over.payerRecipient ?? null}
        rawCustomerId={over.rawCustomerId === undefined ? 'cust-1' : over.rawCustomerId}
        customerName={over.customerName === undefined ? 'Kestrin Contracting' : over.customerName}
        emailFixDraft={draft}
        setEmailFixDraft={setDraft}
        emailFixAlsoCustomer={also}
        setEmailFixAlsoCustomer={setAlso}
        emailFixSaving={over.emailFixSaving ?? false}
        emailFixError={over.emailFixError ?? null}
        saveMissingCustomerEmail={save}
      />
      <output data-testid="state">{JSON.stringify({ draft, also })}</output>
    </>
  )
}
const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}') as { draft: string; also: boolean }

describe('BillCustomerMissingEmailBanner', () => {
  it('a customer with no email: the box says so, Save is dead until an address is typed, and the tick offers the customer’s record', () => {
    const save = vi.fn(async () => {})
    render(<Harness save={save} />)
    const box = screen.getByRole('group', { name: 'Customer email missing' })
    expect(box.textContent).toContain('No customer email on this job — Stripe and emailed invoices need one.')
    const save_ = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save_.disabled).toBe(true)
    const input = screen.getByRole('textbox', { name: 'Customer email' }) as HTMLInputElement
    expect(input.placeholder).toBe('customer@email.com')
    fireEvent.change(input, { target: { value: '   ' } })
    expect(save_.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'ap@kestrin.test' } })
    expect(state().draft).toBe('ap@kestrin.test')
    expect(save_.disabled).toBe(false)
    const tick = screen.getByRole('checkbox', { name: /Also add to Kestrin Contracting’s record if it has no email/ }) as HTMLInputElement
    expect(tick.checked).toBe(true)
    fireEvent.click(tick)
    expect(state().also).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })

  it('Save and Enter both run the window’s save, once each', () => {
    const save = vi.fn(async () => {})
    render(<Harness save={save} />)
    const input = screen.getByRole('textbox', { name: 'Customer email' })
    fireEvent.change(input, { target: { value: 'ap@kestrin.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(save).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(save).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(input, { key: 'a' })
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('a job with no customer row offers no tick, and a customer with no name reads the customer', () => {
    const view = render(<Harness over={{ rawCustomerId: null }} save={async () => {}} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    view.unmount()
    render(<Harness over={{ customerName: null }} save={async () => {}} />)
    expect(screen.getByRole('checkbox', { name: /Also add to the customer’s record/ })).toBeTruthy()
  })

  it('a GC payer: the GC is named, the box asks for its billing email, and says where it is saved in place of the tick', () => {
    render(<Harness over={{ payerParty: 'gc', payerRecipient: GC }} save={async () => {}} />)
    const box = screen.getByRole('group', { name: 'Customer email missing' })
    expect(box.textContent).toContain('Hollis Builders pays this job and has no billing email yet — Stripe and emailed invoices need one.')
    expect((screen.getByRole('textbox', { name: 'GC billing email' }) as HTMLInputElement).placeholder).toBe('ap@builder.com')
    expect(box.textContent).toContain('Saved on Hollis Builders’s customer record — every job billed to them uses it.')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('a GC payer whose row did not load reads The GC', () => {
    render(<Harness over={{ payerParty: 'gc', payerRecipient: null }} save={async () => {}} />)
    const box = screen.getByRole('group', { name: 'Customer email missing' })
    expect(box.textContent).toContain('The GC pays this job and has no billing email yet')
    expect(box.textContent).toContain('Saved on the GC’s customer record')
  })

  it('while saving the press is dead and reads Saving…, and a refused save shows its reason', () => {
    const view = render(<Harness over={{ emailFixSaving: true }} save={async () => {}} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Customer email' }), { target: { value: 'ap@kestrin.test' } })
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true)
    view.unmount()
    render(<Harness over={{ emailFixError: 'Enter a valid email address' }} save={async () => {}} />)
    expect(screen.getByText('Enter a valid email address')).toBeTruthy()
  })
})

describe('BillCustomerPayerBanner', () => {
  it('draws nothing when the job’s own customer is billed', () => {
    const view = render(<BillCustomerPayerBanner billToOverride={null} payerParty="customer" payerRecipient={null} rawCustomerName="Kestrin Contracting" />)
    expect(view.container.innerHTML).toBe('')
  })

  it('a typed bill-to recipient: names them, says the job customer is not billed, and where to change it', () => {
    const view = render(
      <BillCustomerPayerBanner billToOverride={{ name: 'Tenant Tom', email: 'tom@tenant.test', phone: null }} payerParty="other" payerRecipient={null} rawCustomerName=" Kestrin Contracting " />,
    )
    expect(view.container.textContent).toContain('Billing to ')
    expect(view.container.textContent).toContain('tom@tenant.test')
    expect(view.container.textContent).toContain('— not the job customer (Kestrin Contracting). Change or remove this on the job’s Bill tab → Bill to ▾')
    expect(screen.queryByTestId('bill-customer-gc-payer-banner')).toBeNull()
  })

  it('a typed bill-to recipient wins over a GC payer', () => {
    render(<BillCustomerPayerBanner billToOverride={{ name: null, email: 'tom@tenant.test', phone: null }} payerParty="gc" payerRecipient={GC} rawCustomerName={null} />)
    expect(screen.queryByTestId('bill-customer-gc-payer-banner')).toBeNull()
    expect(screen.getByText(/Billing to/)).toBeTruthy()
  })

  it('a GC payer: names the GC and the customer who is not billed, and says when the GC has no billing email', () => {
    const view = render(<BillCustomerPayerBanner billToOverride={null} payerParty="gc" payerRecipient={GC} rawCustomerName="Kestrin Contracting" />)
    const banner = screen.getByTestId('bill-customer-gc-payer-banner')
    expect(banner.textContent).toBe(
      'Billing Hollis Builders, the GC on this job — not Kestrin Contracting. They have no billing email yet. Change this on the job’s Edit tab → Bills go to, or per bill with Bill to ▾ on the Bill tab.',
    )
    view.unmount()
    render(<BillCustomerPayerBanner billToOverride={null} payerParty="gc" payerRecipient={{ ...GC, email: 'ap@hollis.test' }} rawCustomerName="" />)
    expect(screen.getByTestId('bill-customer-gc-payer-banner').textContent).toBe(
      'Billing Hollis Builders, the GC on this job. Change this on the job’s Edit tab → Bills go to, or per bill with Bill to ▾ on the Bill tab.',
    )
  })
})
