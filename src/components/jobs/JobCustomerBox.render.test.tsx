// @vitest-environment jsdom
/**
 * Messages, residential R2 PR 2: Text and Email to the job's customer from the job's window. The box opens the
 * customer's own thread and draws cut 3's reply box tied to the job, offering only the kind the panel's row chose, in
 * the customer's orange, and keeps the words typed when the row moves from Text to Email. An email goes through the
 * send window with the job's key, then the job's window reads its activity again. A job with no customer says so, and a
 * thread that cannot be opened says why. Dana and her Helotes job are the mockups' demo people; nothing is a real row.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { ReplyIo } from '../../lib/messages/replyIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobCustomerBox } from './JobCustomerBox'

// Send texts is on here, so a text writes as it will once the owner turns it on (`ReplyBox.textsOn` holds the off box).
vi.mock('../gc/messages/reply/useTextsOn', () => ({ useTextsOn: () => true }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const DANA: Contact = {
  id: 'c-dana',
  kind: 'customer',
  name: 'Dana Whitfield',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-dana' },
  channels: [
    { id: 'ch-dana-cell', kind: 'phone', value: '(210) 555-0188', optedOutAt: null },
    { id: 'ch-dana-email', kind: 'email', value: 'dana@whitfield.example', optedOutAt: null },
  ],
  jobIds: ['pipeline:j-helotes'],
  defaultJobId: null,
  customerId: 'cust-dana',
  gcCompanyId: null,
}

function fakeIo(): ReplyIo {
  return {
    loadSender: vi.fn(() => Promise.resolve({ name: 'Rosa', title: 'Office', cell: '(210) 555-0142' })),
    addNote: vi.fn(() => Promise.resolve('m-note-new')),
    sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
    sendText: vi.fn(() => Promise.resolve('m-text-new')),
    logCall: vi.fn(() => Promise.resolve('m-call-new')),
  }
}

function draw(over: { kind?: 'text' | 'email'; customerId?: string | null; jobStatus?: string | null; load?: (id: string) => Promise<Contact> } = {}) {
  const io = fakeIo()
  const load = vi.fn(over.load ?? (async (_id: string) => DANA))
  const onSent = vi.fn()
  const loadBill = vi.fn(async (_jobId: string) => 'https://clicktooling.com/pay/8f3k2q')
  const props = { jobId: 'j-helotes', jobName: 'Helotes', customerId: over.customerId === undefined ? 'cust-dana' : over.customerId, jobStatus: over.jobStatus ?? null, onSent, load, loadBill, io }
  const r = renderWithProviders(<JobCustomerBox kind={over.kind ?? 'text'} {...props} />)
  return { io, load, loadBill, onSent, rerender: (kind: 'text' | 'email') => r.rerender(<JobCustomerBox kind={kind} {...props} />) }
}

const box = async () => {
  await waitFor(() => expect(document.querySelector('[data-reply-box]')).toBeTruthy())
  return document.querySelector('[data-reply-box]') as HTMLElement
}

describe('JobCustomerBox', () => {
  it('opens the customer’s thread and draws the box tied to the job, in her orange, with no kinds row of its own', async () => {
    const { load } = draw()
    const el = await box()
    expect(load).toHaveBeenCalledWith('cust-dana')
    expect(within(el).queryByRole('radiogroup', { name: 'Reply as' })).toBeNull()
    expect(el.querySelector('[data-reply-tie]')?.textContent).toBe('Helotes')
    const words = within(el).getByRole('textbox', { name: 'Write to Dana Whitfield' })
    expect(words.getAttribute('data-reply-look')).toBe('customer')
    expect((words as HTMLTextAreaElement).style.borderLeft).toContain('var(--border-orange)')
    expect(within(el).getByRole('button', { name: 'Send text…' })).toBeTruthy()
  })

  it('keeps the words typed when the row moves from Text to Email', async () => {
    const { rerender } = draw()
    const el = await box()
    fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'We are on the way. About twenty minutes.' } })
    rerender('email')
    expect((within(el).getByRole('textbox') as HTMLTextAreaElement).value).toBe('We are on the way. About twenty minutes.')
    expect(within(el).getByRole('button', { name: 'Send email…' })).toBeTruthy()
  })

  it('sends an email on the job, then asks the job’s window to read its activity again', async () => {
    const { io, onSent } = draw({ kind: 'email' })
    const el = await box()
    fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'The part came in. We can come Thursday.' } })
    fireEvent.click(within(el).getByRole('button', { name: 'Send email…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(win.textContent).toContain('To: Dana Whitfield <dana@whitfield.example>')
    const send = within(win).getByRole('button', { name: 'Send as email' }) as HTMLButtonElement
    await waitFor(() => expect(send.disabled).toBe(false))
    fireEvent.click(send)
    await waitFor(() =>
      expect(io.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'c-dana', channelId: 'ch-dana-email', jobKey: 'pipeline:j-helotes' })),
    )
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
  })

  it('says so on a job with no customer, and reads nothing', () => {
    const { load } = draw({ customerId: null })
    expect(screen.getByRole('status').textContent).toBe('This job has no customer yet. Add one in Edit Job to text or email them.')
    expect(load).not.toHaveBeenCalled()
  })

  it('says why when their thread cannot be opened', async () => {
    draw({ load: async () => Promise.reject(new Error('Only the office opens a customer’s messages.')) })
    expect((await screen.findByRole('alert')).textContent).toBe('Only the office opens a customer’s messages.')
  })
  it('reads the job’s newest bill’s pay page once, for {bill} (v2.5628)', async () => {
    const { loadBill } = draw()
    await box()
    expect(loadBill).toHaveBeenCalledTimes(1)
    expect(loadBill).toHaveBeenCalledWith('j-helotes')
  })
  it('opens on the stage’s lines: a Ready to Bill job leads with the app’s Done words, and a press fills the box (v2.5629)', async () => {
    draw({ jobStatus: 'ready_to_bill' })
    const el = await box()
    await waitFor(() => expect(document.querySelector('[data-qr-strip="open"]')).toBeTruthy())
    expect(screen.getAllByText(/For this stage/).length).toBeGreaterThan(0)
    const chip = within(el).getByRole('button', { name: /The work on .* is done/ })
    fireEvent.click(chip)
    expect((within(el).getByRole('textbox') as HTMLTextAreaElement).value).toContain('The work on Helotes is done. Your bill follows by email.')
  })

  it('keeps the strip folded on a Waiting job, whose stage has no line of its own', async () => {
    draw({ jobStatus: 'waiting' })
    await box()
    expect(document.querySelector('[data-qr-strip="folded"]')).toBeTruthy()
    expect(screen.queryByText(/For this stage/)).toBeNull()
  })
})
