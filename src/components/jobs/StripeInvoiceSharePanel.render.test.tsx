// @vitest-environment jsdom
/**
 * The bill share's doors through the company (punch list #125 PR 6, v2.6710): with the job and its customer, **Email**
 * shows the draft and **Send the email** sends it from the office through `messages-email` with the draft's subject and
 * words, and **Text** opens the Tell the customer sheet on the bill (v2.6771, punch list #291) with the Billed line, the
 * bill's amount and its pay page filled, nothing sent in the press; a caller that hands no job keeps the copy-only
 * drafts and no `mailto:` is opened anywhere. Sam and the Oak Street job are made up; nothing is a real row.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { ReplyIo } from '../../lib/messages/replyIo'
import type { TellCustomerIo } from '../../lib/tellCustomer/tellCustomerIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { StripeInvoiceSharePanel, type StripeInvoiceSharePanelProps } from './StripeInvoiceSharePanel'

vi.mock('../gc/messages/reply/useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
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
/** Not a UUID, so the link stays Stripe's in these cases; the #290 describe below hands a real id for the short link. */
const INVOICE_ID = 'inv-1'
/** The copy-only text (v2.6771): the Billed line without its opening, Stripe's link when no bill id is at hand. */
const SMS_WORDS = `Your bill for Oak Street is ready, $2,200.00. Pay it here: ${PAY}`
/** The sheet's line (v2.6771): the bill's link as `billTextLink` gives it (#290), the signed-in person's name. */
const SHEET_WORDS = `Hi Sam, this is Rosa with Click Plumbing. Your bill for Oak Street is ready, $2,200.00. Text me here with any question. Pay it here: ${PAY}`

type FakeTell = TellCustomerIo & { send: ReturnType<typeof vi.fn> }
function fakeTellIo(): FakeTell {
  return {
    loadJob: vi.fn(async () => ({ customerId: 'cust-sam', customerName: 'Sam Sample', jobName: 'Oak Street', jobAddress: null, lang: 'en' as const })),
    loadCustomer: vi.fn(async () => ({ name: 'Sam Sample', lang: 'en' as const })),
    loadContact: vi.fn(async () => ({ contactId: 'c-sam', numbers: [{ channelId: 'ch-home', value: '(512) 555-0100', stopped: false }], lines: [], prefers: null })),
    loadLines: vi.fn(async () => []),
    loadTextsOn: vi.fn(async () => true),
    loadMyName: vi.fn(async () => 'Rosa Perez'),
    isFirstVisit: vi.fn(async () => false),
    send: vi.fn(async () => 'msg-1'),
    shareEstimateLink: vi.fn(async () => 'https://clicktooling.com/e/x'),
    makeOffer: vi.fn(async () => 'offer-1'),
    loadCallScript: vi.fn(async () => null),
    addCall: vi.fn(async () => 'call-1'),
    loadMyWay: vi.fn(async () => ({ booked: 'ask' as const, estimate: 'ask' as const })),
    saveOfficeLine: vi.fn(async () => undefined),
    loadFromNumber: vi.fn(async () => '(512) 555-0199'),
  } as FakeTell
}

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
  const io = fakeIo(ioOver)
  const tellIo = fakeTellIo()
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
      invoiceId={INVOICE_ID}
      jobId="j1"
      customerId="cust-sam"
      jobStatus="billed"
      onSent={onSent}
      load={load}
      io={io}
      tellIo={tellIo}
      {...rest}
    />,
  )
  return { io, tellIo, load, onSent }
}

describe('StripeInvoiceSharePanel — the customer’s link is the short pay page (#290)', () => {
  const BILL_ID = '8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44'
  const SHORT = `https://my.clickplumbing.com/pay/${BILL_ID}`

  it('Text opens the sheet with the short link in the Billed line when the bill’s id is at hand, and Copy link copies the same', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    draw({ invoiceId: BILL_ID })
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SHORT))
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    const words = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(words.value).toBe(`Hi Sam, this is Rosa with Click Plumbing. Your bill for Oak Street is ready, $2,200.00. Text me here with any question. Pay it here: ${SHORT}`)
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

  it('Text opens the Tell the customer sheet on the bill, the Billed line filled with the amount and the pay page, and sends nothing in the press (v2.6771)', async () => {
    const { io, tellIo } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    const sheet = await screen.findByRole('dialog', { name: 'Tell Sam' })
    expect(sheet.textContent).toContain('Bill · Oak Street')
    expect(sheet.textContent).toContain('The bill for Oak Street · $2,200.00')
    const words = (await screen.findByTestId('tell-body')) as HTMLTextAreaElement
    expect(words.value).toBe(SHEET_WORDS)
    expect(screen.getByTestId('tell-from-number').textContent).toBe('from the company number (512) 555-0199')
    expect(screen.getByTestId('tell-first-text')).toBeTruthy()
    expect(screen.getByTestId('tell-primary').textContent).toBe('Send text to Sam')
    expect(tellIo.loadJob).toHaveBeenCalledWith('j1')
    expect(tellIo.send).not.toHaveBeenCalled()
    expect(io.sendText).not.toHaveBeenCalled()
    expect(screen.queryByTestId('contract-text-door')).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'SMS Bill Draft' })).toBeNull()
    fireEvent.click(screen.getByTestId('tell-skip'))
    expect(screen.queryByRole('dialog', { name: 'Tell Sam' })).toBeNull()
  })

  it('the text goes through the sheet’s own send, tied to the job, and the panel reports the send', async () => {
    const { tellIo, onSent } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    await screen.findByTestId('tell-body')
    fireEvent.click(screen.getByTestId('tell-primary'))
    await waitFor(() => expect(tellIo.send).toHaveBeenCalledWith({ contactId: 'c-sam', channelId: 'ch-home', jobId: 'j1', body: SHEET_WORDS }))
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
    expect(await screen.findByTestId('tell-receipt')).toBeTruthy()
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
