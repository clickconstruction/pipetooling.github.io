// @vitest-environment jsdom
/**
 * The bill share's doors through the company (punch list #125 PR 6, v2.6710): with the job and its customer, **Email**
 * shows the draft and **Send the email** sends it from the office through `messages-email` with the draft's subject and
 * words, and **Text** opens the customer's box with the bill's words and pay link filled, nothing sent in the press; a
 * caller that hands no job keeps the copy-only drafts and no `mailto:` is opened anywhere. Sam and the Oak Street job
 * are made up; nothing is a real row.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { ReplyIo } from '../../lib/messages/replyIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { StripeInvoiceSharePanel, type StripeInvoiceSharePanelProps } from './StripeInvoiceSharePanel'

vi.mock('../gc/messages/reply/useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const SAM: Contact = {
  id: 'c-sam',
  kind: 'customer',
  name: 'Sam Sample',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-sam' },
  channels: [
    { id: 'ch-home', kind: 'phone', value: '(512) 555-0100', optedOutAt: null },
    { id: 'ch-email', kind: 'email', value: 'sam@example.com', optedOutAt: null },
  ],
  jobIds: ['pipeline:j1'],
  defaultJobId: null,
  customerId: 'cust-sam',
  gcCompanyId: null,
}
const PAY = 'https://pay.example/inv_1'
const SMS_WORDS = `Your invoice for Oak Street ($2,200.00): ${PAY}`

function fakeIo(over: Partial<ReplyIo> = {}): ReplyIo {
  return {
    loadSender: vi.fn(() => Promise.resolve({ name: 'Rosa', title: 'Office' })),
    addNote: vi.fn(() => Promise.resolve('m-note')),
    sendEmail: vi.fn(() => Promise.resolve('m-email')),
    sendText: vi.fn(() => Promise.resolve('m-text')),
    logCall: vi.fn(() => Promise.resolve('m-call')),
    ...over,
  }
}

function draw(over: Partial<StripeInvoiceSharePanelProps> & { contact?: Contact; ioOver?: Partial<ReplyIo> } = {}) {
  const { contact, ioOver, ...rest } = over
  /** No code unless a test hands one: the link is the bill id's. */
  const mintPayCode = over.mintPayCode ?? (async () => null)
  const io = fakeIo(ioOver)
  const load = vi.fn(async (_id: string) => contact ?? SAM)
  const onSent = vi.fn()
  renderWithProviders(
    <StripeInvoiceSharePanel
      hostedInvoiceUrl={PAY}
      stripeInvoiceId="in_1"
      customerEmail="sam@example.com"
      customerName="Sam Sample"
      jobName="Oak Street"
      hcpNumber="1053"
      amountLabel="$2,200.00"
      labeledCluster
      invoiceId="inv-1"
      jobId="j1"
      customerId="cust-sam"
      jobStatus="billed"
      onSent={onSent}
      load={load}
      io={io}
      mintPayCode={mintPayCode}
      {...rest}
    />,
  )
  return { io, load, onSent }
}

describe('StripeInvoiceSharePanel — the customer’s link is the short pay page (#290)', () => {
  const BILL_ID = '8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44'
  const SHORT = `https://my.clickplumbing.com/pay/${BILL_ID}`

  it('Text fills the box with the short link when the bill’s id is at hand, and Copy link copies the same', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    draw({ invoiceId: BILL_ID })
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SHORT))
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    const door = await screen.findByTestId('contract-text-door')
    await waitFor(() => expect((within(door).getByRole('textbox') as HTMLTextAreaElement).value).toBe(`Your invoice for Oak Street ($2,200.00): ${SHORT}`))
  })

  it('the bill’s ten-letter code comes first once it answers (v2.6769): Text and Copy link carry /pay/<code>', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    const mintPayCode = vi.fn(async () => 'abc2def3gh')
    draw({ invoiceId: BILL_ID, mintPayCode })
    await waitFor(() => expect(mintPayCode).toHaveBeenCalledWith(BILL_ID))
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    const door = await screen.findByTestId('contract-text-door')
    await waitFor(() => expect((within(door).getByRole('textbox') as HTMLTextAreaElement).value).toBe('Your invoice for Oak Street ($2,200.00): https://my.clickplumbing.com/pay/abc2def3gh'))
    fireEvent.click(within(door).getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://my.clickplumbing.com/pay/abc2def3gh'))
  })

  it('falls back to Stripe’s own link when the caller hands no bill id', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    draw({ invoiceId: undefined })
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PAY))
  })
})

describe('StripeInvoiceSharePanel — the doors through the company (#125 PR 6)', () => {
  it('Email shows the draft, and Send the email sends it from the office with the draft’s subject and words, no mailto', async () => {
    const before = window.location.href
    const { io, load, onSent } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Email' }))
    const win = await screen.findByRole('dialog', { name: 'Email Bill Draft' })
    expect(win.textContent).toContain('Invoice — Oak Street')
    expect(win.textContent).toContain(PAY)
    expect(within(win).queryByRole('button', { name: 'Open in email app' })).toBeNull()
    fireEvent.click(within(win).getByRole('button', { name: 'Send the email' }))
    await waitFor(() => expect(io.sendEmail).toHaveBeenCalledTimes(1))
    expect(load).toHaveBeenCalledWith('cust-sam')
    expect(io.sendEmail).toHaveBeenCalledWith({
      contactId: 'c-sam',
      channelId: 'ch-email',
      jobKey: 'pipeline:j1',
      draft: { subject: 'Invoice — Oak Street', body: expect.stringContaining(`Please view and pay your invoice here:\n${PAY}`), signature: expect.arrayContaining(['Rosa']) },
    })
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Email Bill Draft' })).toBeNull())
    expect(document.body.textContent).toContain('The bill went to sam@example.com from the office.')
    expect(window.location.href).toBe(before)
  })

  it('a contact with no email: the press says so and nothing is sent', async () => {
    const { io, onSent } = draw({ contact: { ...SAM, channels: SAM.channels.filter((ch) => ch.kind === 'phone') } })
    fireEvent.click(screen.getByRole('button', { name: 'Email' }))
    const win = await screen.findByRole('dialog', { name: 'Email Bill Draft' })
    fireEvent.click(within(win).getByRole('button', { name: 'Send the email' }))
    await waitFor(() => expect(document.body.textContent).toContain('Sam’s contact has no email yet, so the office cannot email the bill.'))
    expect(io.sendEmail).not.toHaveBeenCalled()
    expect(onSent).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Email Bill Draft' })).toBeTruthy()
  })

  it('a refused send reads its reason and keeps the draft open', async () => {
    const { onSent } = draw({ ioOver: { sendEmail: vi.fn(() => Promise.reject(new Error('Sending is paused while the balance is settled.'))) } })
    fireEvent.click(screen.getByRole('button', { name: 'Email' }))
    const win = await screen.findByRole('dialog', { name: 'Email Bill Draft' })
    fireEvent.click(within(win).getByRole('button', { name: 'Send the email' }))
    await waitFor(() => expect(document.body.textContent).toContain('Sending is paused while the balance is settled.'))
    expect(onSent).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Email Bill Draft' })).toBeTruthy()
  })

  it('Text opens the customer’s box with the bill’s words and pay link filled, and sends nothing in the press', async () => {
    const { io, load } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    const door = await screen.findByTestId('contract-text-door')
    expect(door.textContent).toContain('Text the pay link')
    await waitFor(() => expect(door.querySelector('[data-reply-box]')).toBeTruthy())
    const words = within(door).getByRole('textbox') as HTMLTextAreaElement
    await waitFor(() => expect(words.value).toBe(SMS_WORDS))
    expect(within(door).getByRole('button', { name: 'Send text…' })).toBeTruthy()
    expect(load).toHaveBeenCalledWith('cust-sam')
    expect(io.sendText).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'SMS Bill Draft' })).toBeNull()
    fireEvent.click(within(door).getByRole('button', { name: 'Close the text' }))
    expect(screen.queryByTestId('contract-text-door')).toBeNull()
  })

  it('the text goes through the box’s send window, and the panel reports the send', async () => {
    const { io, onSent } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    const door = await screen.findByTestId('contract-text-door')
    await waitFor(() => expect((within(door).getByRole('textbox') as HTMLTextAreaElement).value).toBe(SMS_WORDS))
    fireEvent.click(within(door).getByRole('button', { name: 'Send text…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    const send = within(win).getByRole('button', { name: 'Send as text' }) as HTMLButtonElement
    await waitFor(() => expect(send.disabled).toBe(false))
    fireEvent.click(send)
    await waitFor(() => expect(io.sendText).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'c-sam', channelId: 'ch-home', jobKey: 'pipeline:j1', body: SMS_WORDS })))
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByTestId('contract-text-door')).toBeNull())
  })

  it('no job at hand: Text and Email keep the copy-only drafts, with no Send the email and no mailto', async () => {
    const before = window.location.href
    const { io, load } = draw({ jobId: undefined, customerId: undefined })
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    const sms = await screen.findByRole('dialog', { name: 'SMS Bill Draft' })
    expect(sms.textContent).toContain(SMS_WORDS)
    expect(within(sms).getByRole('button', { name: 'Copy' })).toBeTruthy()
    expect(screen.queryByTestId('contract-text-door')).toBeNull()
    fireEvent.click(within(sms).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Email' }))
    const win = await screen.findByRole('dialog', { name: 'Email Bill Draft' })
    expect(within(win).getByRole('button', { name: 'Copy' })).toBeTruthy()
    expect(within(win).queryByRole('button', { name: 'Send the email' })).toBeNull()
    expect(within(win).queryByRole('button', { name: 'Open in email app' })).toBeNull()
    expect(load).not.toHaveBeenCalled()
    expect(io.sendEmail).not.toHaveBeenCalled()
    expect(window.location.href).toBe(before)
  })
})
