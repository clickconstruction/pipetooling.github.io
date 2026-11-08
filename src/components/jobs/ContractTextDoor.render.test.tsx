// @vitest-environment jsdom
/**
 * The Contract window's text door (punch list #125 PR 5, v2.6700): the customer's box on Text with the agreement's
 * words and the link filled, the window's number leading, nothing sent in the press. A typed number not on the
 * contact draws the owner's chip, one tap adds it as a text channel and the box opens on it; the numbers on file are
 * offered beside the chip. Sam and the Oak Street job are made up; nothing is a real row.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Contact, ContactChannel } from '../../lib/contacts/kernel'
import type { ReplyIo } from '../../lib/messages/replyIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ContractTextDoor } from './ContractTextDoor'

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
    { id: 'ch-cell', kind: 'phone', value: '512-555-0199', optedOutAt: null },
  ],
  jobIds: ['pipeline:j-oak'],
  defaultJobId: null,
  customerId: 'cust-sam',
  gcCompanyId: null,
}
const LINK = 'https://app.example/contract/sign?t=tok'
const WORDS = `Here is your service agreement for 12 Oak St — review and sign here: ${LINK}`

function fakeIo(): ReplyIo {
  return {
    loadSender: vi.fn(() => Promise.resolve({ name: 'Rosa' })),
    addNote: vi.fn(() => Promise.resolve('m-note')),
    sendEmail: vi.fn(() => Promise.resolve('m-email')),
    sendText: vi.fn(() => Promise.resolve('m-text')),
    logCall: vi.fn(() => Promise.resolve('m-call')),
  }
}

function draw(over: { typedPhone?: string; customerId?: string | null; contact?: Contact; addNumber?: (contactId: string, value: string) => Promise<ContactChannel> } = {}) {
  const io = fakeIo()
  const load = vi.fn(async (_id: string) => over.contact ?? SAM)
  const addNumber = vi.fn(over.addNumber ?? (async (_contactId: string, value: string): Promise<ContactChannel> => ({ id: 'ch-new', kind: 'phone', value, optedOutAt: null })))
  const onSent = vi.fn()
  const onClose = vi.fn()
  const onCopyLink = vi.fn()
  renderWithProviders(
    <ContractTextDoor
      title="Text the signing link"
      jobId="j-oak"
      jobName="Oak Street"
      jobStatus="working"
      customerId={over.customerId === undefined ? 'cust-sam' : over.customerId}
      typedPhone={over.typedPhone ?? '512-555-0199'}
      words={WORDS}
      onClose={onClose}
      onSent={onSent}
      onCopyLink={onCopyLink}
      load={load}
      addNumber={addNumber}
      io={io}
    />,
  )
  return { io, load, addNumber, onSent, onClose, onCopyLink }
}

/** The box, once the start words are in it: the words go in by an effect after the box draws, so a press before them finds it blank. */
const box = async () => {
  await waitFor(() => expect(document.querySelector('[data-reply-box]')).toBeTruthy())
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  await waitFor(() => expect((within(el).getByRole('textbox') as HTMLTextAreaElement).value).toBe(WORDS))
  return el
}

describe('ContractTextDoor', () => {
  it('opens the customer’s box on Text with the words and the link filled, under the head, and sends nothing in the press', async () => {
    const { io, load, onCopyLink, onClose } = draw()
    const el = await box()
    expect(load).toHaveBeenCalledWith('cust-sam')
    expect(screen.getByTestId('contract-text-door').textContent).toContain('Text the signing link')
    expect((within(el).getByRole('textbox') as HTMLTextAreaElement).value).toBe(WORDS)
    expect(within(el).getByRole('button', { name: 'Send text…' })).toBeTruthy()
    expect(io.sendText).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('contract-text-door-copy'))
    expect(onCopyLink).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close the text' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('the text goes to the window’s number, not the first on the contact, through the box’s send window', async () => {
    const { io, onSent } = draw({ typedPhone: '(512) 555-0199' })
    const el = await box()
    fireEvent.click(within(el).getByRole('button', { name: 'Send text…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(win.textContent).toContain('512-555-0199')
    const send = within(win).getByRole('button', { name: 'Send as text' }) as HTMLButtonElement
    await waitFor(() => expect(send.disabled).toBe(false))
    fireEvent.click(send)
    await waitFor(() => expect(io.sendText).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'c-sam', channelId: 'ch-cell', jobKey: 'pipeline:j-oak', body: WORDS })))
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
  })

  it('a typed number not on the contact draws the chip and the numbers on file; one tap adds it and the box opens on it', async () => {
    const { addNumber, io } = draw({ typedPhone: '512-555-0123' })
    const add = await screen.findByTestId('contract-text-door-add')
    expect(add.textContent).toContain('512-555-0123 is not on Sam’s contact yet, so the company number cannot text it.')
    expect(within(add).getByRole('button', { name: 'Text (512) 555-0100 instead' })).toBeTruthy()
    expect(within(add).getByRole('button', { name: 'Text 512-555-0199 instead' })).toBeTruthy()
    expect(document.querySelector('[data-reply-box]')).toBeNull()
    fireEvent.click(within(add).getByRole('button', { name: 'Add 512-555-0123 to Sam’s contact' }))
    await waitFor(() => expect(addNumber).toHaveBeenCalledWith('c-sam', '512-555-0123'))
    const el = await box()
    expect(screen.queryByTestId('contract-text-door-add')).toBeNull()
    fireEvent.click(within(el).getByRole('button', { name: 'Send text…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(win.textContent).toContain('512-555-0123')
    const send = within(win).getByRole('button', { name: 'Send as text' }) as HTMLButtonElement
    await waitFor(() => expect(send.disabled).toBe(false))
    fireEvent.click(send)
    await waitFor(() => expect(io.sendText).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'ch-new' })))
  })

  it('a number on file instead: the box opens on that one and nothing is added', async () => {
    const { addNumber, io } = draw({ typedPhone: '512-555-0123' })
    const add = await screen.findByTestId('contract-text-door-add')
    fireEvent.click(within(add).getByRole('button', { name: 'Text (512) 555-0100 instead' }))
    const el = await box()
    expect(addNumber).not.toHaveBeenCalled()
    fireEvent.click(within(el).getByRole('button', { name: 'Send text…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    const send = within(win).getByRole('button', { name: 'Send as text' }) as HTMLButtonElement
    await waitFor(() => expect(send.disabled).toBe(false))
    fireEvent.click(send)
    await waitFor(() => expect(io.sendText).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'ch-home' })))
  })

  it('an add that is refused says why and keeps the chip', async () => {
    draw({ typedPhone: '512-555-0123', addNumber: async () => Promise.reject(new Error('Only the office changes a contact.')) })
    const add = await screen.findByTestId('contract-text-door-add')
    fireEvent.click(within(add).getByRole('button', { name: 'Add 512-555-0123 to Sam’s contact' }))
    await waitFor(() => expect(document.body.textContent).toContain('Only the office changes a contact.'))
    expect(screen.getByTestId('contract-text-door-add')).toBeTruthy()
  })

  it('a job with no customer says so and reads nothing', () => {
    const { load } = draw({ customerId: null })
    expect(screen.getByRole('status').textContent).toBe('This job has no customer yet. Add one in Edit Job to text or email them.')
    expect(load).not.toHaveBeenCalled()
  })
})
