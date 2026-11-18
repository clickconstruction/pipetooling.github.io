// @vitest-environment jsdom
/**
 * Render smoke for Bill Customer's Send to block, cut out of `SendRecordInvoiceModal` as a pure move
 * (`BillCustomerSendTo`). The block owns nothing: the ticks and the one-off address are the window's state, read by
 * both email channels. Each test holds that state in a small harness and reads what the block draws and writes back.
 */
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { theyWillGet, type BillSendChannel } from '../../lib/billing/billCustomerTheyWillGet'
import type { BillCopyContact } from '../../lib/jobs/billCopyRecipients'
import type { InvoiceBillTo } from '../../lib/jobs/invoiceBillTo'
import type { JobBillingContext } from '../../lib/jobBillingContext'
import { BillCustomerSendTo, type BillCustomerSendToProps } from './BillCustomerSendTo'

// The three lines under the block read the database themselves and have their own smokes; here only what they are handed.
vi.mock('./BillCustomerOwnerLine', () => ({
  default: ({ jobId, userId }: { jobId: string; userId: string | null }) => <div data-testid="owner-line" data-job={jobId} data-user={String(userId)} />,
}))
vi.mock('./BillCustomerReturnedChecksLine', () => ({
  BillCustomerReturnedChecksLine: ({ payerCustomerId }: { payerCustomerId: string | null }) => <div data-testid="returned-checks" data-payer={String(payerCustomerId)} />,
}))
vi.mock('./BillCustomerPayCutoffLine', () => ({
  BillCustomerPayCutoffLine: ({ payerCustomerId, jobId }: { payerCustomerId: string | null; jobId: string }) => <div data-testid="pay-cutoff" data-payer={String(payerCustomerId)} data-job={jobId} />,
}))

const JOB: JobBillingContext = {
  id: 'job-978',
  master_user_id: 'user-1',
  hcp_number: '978',
  job_name: 'Penmoor demo',
  customer_id: 'cust-1',
  customer_name: 'Kestrin Contracting',
  customer_email: 'ap@kestrin.test',
  customer_phone: '5125550142',
}

const CONTACTS: BillCopyContact[] = [
  { id: 'c-1', name: 'Dana Park', email: 'dana@kestrin.test', getsBillCopies: true },
  { id: 'c-2', name: 'Lee Ortiz', email: 'lee@kestrin.test', getsBillCopies: false },
]

const GC_OTHER = { name: 'Hollis Builders', email: 'ap@hollis.test', role: 'gc' as const }

type Over = Partial<Pick<BillCustomerSendToProps, 'job' | 'customerContacts' | 'billToOverride' | 'payerParty' | 'payerRecipient' | 'otherParty' | 'shareParty' | 'jobShowMemory' | 'contactsCustomerId' | 'userId'>> & {
  channel?: BillSendChannel
  ticked?: string[]
  copy?: boolean
  show?: boolean
}

function Harness({ over = {} }: { over?: Over }) {
  const job = over.job ?? JOB
  const channel = over.channel ?? 'stripe'
  const [extraRecipientIds, setExtraRecipientIds] = useState<Set<string>>(() => new Set(over.ticked ?? []))
  const [copyOtherParty, setCopyOtherParty] = useState(over.copy ?? false)
  const [showOtherParty, setShowOtherParty] = useState(over.show ?? false)
  const [oneOffEmail, setOneOffEmail] = useState('')
  return (
    <>
      <BillCustomerSendTo
        job={job}
        channel={channel}
        words={theyWillGet({ channel, name: job.customer_name, email: job.customer_email, ...(channel === 'stripe' ? { phone: job.customer_phone ?? null } : {}), copyEmails: [] })}
        customerContacts={over.customerContacts ?? []}
        extraRecipientIds={extraRecipientIds}
        setExtraRecipientIds={setExtraRecipientIds}
        billToOverride={over.billToOverride ?? null}
        payerParty={over.payerParty ?? 'customer'}
        payerRecipient={over.payerRecipient ?? null}
        otherParty={over.otherParty ?? null}
        copyOtherParty={copyOtherParty}
        setCopyOtherParty={setCopyOtherParty}
        shareParty={over.shareParty ?? null}
        showOtherParty={showOtherParty}
        setShowOtherParty={setShowOtherParty}
        jobShowMemory={over.jobShowMemory ?? false}
        oneOffEmail={oneOffEmail}
        setOneOffEmail={setOneOffEmail}
        userId={over.userId === undefined ? 'user-1' : over.userId}
        contactsCustomerId={over.contactsCustomerId === undefined ? 'cust-1' : over.contactsCustomerId}
      />
      <output data-testid="state">{JSON.stringify({ ticked: [...extraRecipientIds].sort(), copyOtherParty, showOtherParty, oneOffEmail })}</output>
    </>
  )
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}') as { ticked: string[]; copyOtherParty: boolean; showOtherParty: boolean; oneOffEmail: string }

describe('BillCustomerSendTo', () => {
  it('names who is billed, their address as the primary one, and the phone a text could follow on', () => {
    render(<Harness />)
    expect(screen.getByText('Send to')).toBeTruthy()
    expect(screen.getByTestId('bill-customer-send-to-name').textContent?.trim()).toBe('Kestrin Contracting')
    expect(screen.getByText('(primary)')).toBeTruthy()
    expect(screen.getByTestId('bill-customer-send-to-phone').textContent).toBe('Phone (512) 555-0142. A text can follow on the next screen.')
  })

  it('the physical channel shows no phone line, and no copy help until there is someone to copy', () => {
    const view = render(<Harness over={{ channel: 'physical' }} />)
    expect(screen.queryByTestId('bill-customer-send-to-phone')).toBeNull()
    const helpless = view.container.innerHTML
    view.unmount()
    const withContacts = render(<Harness over={{ channel: 'physical', customerContacts: CONTACTS }} />)
    // With contacts the block is longer by the help line and the two ticks.
    expect(withContacts.container.innerHTML.length).toBeGreaterThan(helpless.length)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('a contact’s tick adds and removes that contact through the window’s setter', () => {
    render(<Harness over={{ customerContacts: CONTACTS, ticked: ['c-1'] }} />)
    const [dana, lee] = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(dana!.checked).toBe(true)
    expect(lee!.checked).toBe(false)
    fireEvent.click(lee!)
    expect(state().ticked).toEqual(['c-1', 'c-2'])
    fireEvent.click(dana!)
    expect(state().ticked).toEqual(['c-2'])
  })

  it('offers to copy the other party and to show the bill on their statement, and says what the job will remember', () => {
    render(<Harness over={{ otherParty: GC_OTHER, shareParty: { name: 'Hollis Builders', role: 'gc' } }} />)
    const copy = screen.getByRole('checkbox', { name: /Copy Hollis Builders/ }) as HTMLInputElement
    expect(screen.getByText(/the GC, not billed/)).toBeTruthy()
    fireEvent.click(copy)
    expect(state().copyOtherParty).toBe(true)
    const share = screen.getByTestId('bill-customer-share-tick').querySelector('input') as HTMLInputElement
    expect(screen.getByTestId('bill-customer-share-tick').textContent).not.toContain('next bills')
    fireEvent.click(share)
    expect(state().showOtherParty).toBe(true)
    expect(screen.getByTestId('bill-customer-share-tick').textContent).toContain('This job’s next bills will start ticked.')
  })

  it('a job that already shows its bills says unticking will be remembered', () => {
    render(<Harness over={{ otherParty: GC_OTHER, shareParty: { name: 'Hollis Builders', role: 'gc' }, jobShowMemory: true, show: true }} />)
    const tick = screen.getByTestId('bill-customer-share-tick')
    expect(tick.textContent).not.toContain('next bills')
    fireEvent.click(tick.querySelector('input') as HTMLInputElement)
    expect(tick.textContent).toContain('This job’s next bills will start unticked.')
  })

  it('no copy tick when the other party’s address is the billing address', () => {
    render(<Harness over={{ otherParty: { ...GC_OTHER, email: ' AP@Kestrin.test ' }, shareParty: { name: 'Hollis Builders', role: 'gc' } }} />)
    expect(screen.queryByRole('checkbox', { name: /Copy Hollis Builders/ })).toBeNull()
    expect(screen.getByTestId('bill-customer-share-tick')).toBeTruthy()
  })

  it('a typed bill-to recipient hides the customer’s people and both ticks, and keeps the one-off box', () => {
    const billTo: InvoiceBillTo = { name: 'Tenant Tom', email: 'tom@tenant.test', phone: null }
    render(<Harness over={{ customerContacts: CONTACTS, otherParty: GC_OTHER, shareParty: { name: 'Hollis Builders', role: 'gc' }, billToOverride: billTo }} />)
    expect(screen.getByText('(bill-to recipient)')).toBeTruthy()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    fireEvent.change(screen.getByRole('textbox', { name: 'Additional one-off email recipient' }), { target: { value: 'extra@one.test' } })
    expect(state().oneOffEmail).toBe('extra@one.test')
  })

  it('a GC payer reads as the GC’s billing email', () => {
    render(<Harness over={{ payerParty: 'gc', payerRecipient: { customerId: 'gc-1', name: 'Hollis Builders', email: 'ap@hollis.test', phone: '' } }} />)
    expect(screen.getByText('(Hollis Builders · billing email)')).toBeTruthy()
  })

  it('with no email and no contacts the Send to block is not drawn, and the three lines under it still are', () => {
    render(<Harness over={{ job: { ...JOB, customer_email: null }, contactsCustomerId: 'gc-1', userId: null }} />)
    expect(screen.queryByText('Send to')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByTestId('owner-line').getAttribute('data-job')).toBe('job-978')
    expect(screen.getByTestId('owner-line').getAttribute('data-user')).toBe('null')
    expect(screen.getByTestId('returned-checks').getAttribute('data-payer')).toBe('gc-1')
    expect(screen.getByTestId('pay-cutoff').getAttribute('data-payer')).toBe('gc-1')
    expect(screen.getByTestId('pay-cutoff').getAttribute('data-job')).toBe('job-978')
  })
})
