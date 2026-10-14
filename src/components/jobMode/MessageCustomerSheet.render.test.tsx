// @vitest-environment jsdom
/**
 * Job Mode's Message the customer (residential R5), at a phone's 375 px: the sheet lists the phone's lines with
 * Something else last, shows their waiting answer, fills a line for Dana and holds Send until the tech types the
 * minutes, sends the tied line, and leaves a note for the office. Made-up people: Luis on the job, Dana Whitfield.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { phoneLinesFromRows, type PhoneLineRow } from '../../lib/jobModeMessageCustomer'
import type { JobModeCustomer, JobModeMessageIo } from '../../lib/jobModeMessageCustomerIo'
import { MessageCustomerDoor } from './MessageCustomerDoor'
import { MessageCustomerSheet } from './MessageCustomerSheet'

const JOB = 'job-whitfield'
const row = (id: string, text: string, extra: Partial<PhoneLineRow>): PhoneLineRow => ({
  id, text, for_kind: 'customer', step_key: null, scope: 'team', added_by: 'rosa', added_at: '2026-10-12T14:00:00Z', removed_at: null,
  phone_order: null, phone_name: null, text_es: null, ...extra,
})
const LINES = phoneLinesFromRows([
  row('q1', '{first}, this is {me} with Click Plumbing. I am on my way, about {minutes} minutes out.', { phone_order: 1, phone_name: 'On my way' }),
  row('q2', '{first}, I am running late. The new window is {window}.', { phone_order: 2 }),
  row('q4', '{first}, your bill is {amount}.', { phone_order: 3 }),
])
const DANA: JobModeCustomer = {
  customerId: 'cust-dana',
  customerName: 'Dana Whitfield',
  contactId: 'contact-dana',
  tail: [
    { direction: 'in', at: '2026-10-13T14:05:00Z', body: 'Thanks, the gate code is 4412.' },
    { direction: 'out', at: '2026-10-13T14:02:00Z', body: 'Dana, I am on my way.' },
  ],
}

function fakeIo(): JobModeMessageIo & { send: ReturnType<typeof vi.fn>; noteToOffice: ReturnType<typeof vi.fn> } {
  return {
    loadCustomer: vi.fn(() => Promise.resolve(DANA)),
    loadLines: vi.fn(() => Promise.resolve(LINES)),
    loadBlocks: vi.fn(() => Promise.resolve([{ workDate: '2026-10-13', timeStart: '09:30:00', timeEnd: '11:00:00' }])),
    send: vi.fn(() => Promise.resolve()),
    noteToOffice: vi.fn(() => Promise.resolve()),
  }
}

function mount(io: JobModeMessageIo, customer: JobModeCustomer = DANA) {
  const onDone = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(
    <MessageCustomerSheet jobId={JOB} jobName="Whitfield water heater" jobAddress="1208 Mesquite Ln" userId="luis" me="Luis Ortega" customer={customer} io={io} onDone={onDone} onClose={onClose} today="2026-10-13" />,
  )
  return { onDone, onClose }
}

beforeEach(() => {
  // A phone: 375 px wide, so the shell is its full-screen sheet.
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
  window.matchMedia = ((q: string) => ({ matches: /max-width:\s*640px/.test(q), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia
})
afterEach(cleanup)

describe('MessageCustomerSheet at 375 px', () => {
  it('shows their answer, the lines that can go from the phone with big buttons, and Something else last', async () => {
    mount(fakeIo())
    expect(screen.getByRole('dialog', { name: 'Message Dana' })).toBeTruthy()
    expect(within(screen.getByTestId('job-mode-message-answer')).getByText('Thanks, the gate code is 4412.')).toBeTruthy()
    const lines = await screen.findAllByTestId('job-mode-message-line')
    expect(lines.map((b) => b.querySelector('span')!.textContent)).toEqual(['On my way', 'I am running late'])
    expect(lines[1]!.textContent).toContain('the new window 9:30 AM to 11:00 AM, from the schedule')
    for (const b of [...lines, screen.getByTestId('job-mode-message-else')]) expect(parseInt((b as HTMLElement).style.minHeight, 10)).toBeGreaterThanOrEqual(48)
    const all = screen.getAllByRole('button').map((b) => b.getAttribute('data-testid'))
    expect(all.indexOf('job-mode-message-else')).toBeGreaterThan(all.lastIndexOf('job-mode-message-line'))
    expect(screen.queryByText(/your bill/)).toBeNull()
  })

  it('fills the line for Dana, holds Send until the minutes are typed, then sends it tied to the job', async () => {
    const io = fakeIo()
    const { onDone, onClose } = mount(io)
    fireEvent.click((await screen.findAllByTestId('job-mode-message-line'))[0]!)
    expect(screen.getByTestId('job-mode-message-preview').textContent).toBe('Dana, this is Luis with Click Plumbing. I am on my way, about {minutes} minutes out.')
    const send = screen.getByTestId('job-mode-message-send') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    expect(screen.getByText('Fill {minutes} first. The app does not know it.')).toBeTruthy()
    fireEvent.change(screen.getByTestId('job-mode-message-fill-minutes'), { target: { value: '15' } })
    expect(send.disabled).toBe(false)
    expect(send.textContent).toBe('Send to Dana')
    fireEvent.click(send)
    await waitFor(() => expect(io.send).toHaveBeenCalledTimes(1))
    expect(io.send.mock.calls[0]![0]).toEqual({
      from: 'job_mode',
      customerId: 'cust-dana',
      contactId: 'contact-dana',
      jobId: JOB,
      quickReplyId: 'q1',
      // Only the typed blank travels; quo-send makes the words from the line and the record.
      fills: { minutes: '15' },
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onDone).toHaveBeenCalled()
  })

  it('leaves a note on the job for the office from Something else', async () => {
    const io = fakeIo()
    const { onClose } = mount(io)
    fireEvent.click(screen.getByTestId('job-mode-message-else'))
    expect(screen.getByText(/The customer never sees it\./)).toBeTruthy()
    const save = screen.getByTestId('job-mode-message-note-send') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('job-mode-message-note'), { target: { value: 'the part comes Thursday.' } })
    fireEvent.click(save)
    await waitFor(() => expect(io.noteToOffice).toHaveBeenCalledWith(JOB, 'luis', 'Please tell Dana: the part comes Thursday.'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(io.send).not.toHaveBeenCalled()
  })

  it('says a job with no customer has none, and still offers Something else', async () => {
    mount(fakeIo(), { customerId: null, customerName: null, contactId: null, tail: [] })
    expect(screen.getByTestId('job-mode-message-no-customer').textContent).toBe('This job has no customer yet. Ask the office to add one.')
    expect(screen.queryAllByTestId('job-mode-message-line')).toHaveLength(0)
    expect(screen.getByTestId('job-mode-message-else')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Message the customer' })).toBeTruthy()
  })
})

describe('MessageCustomerDoor', () => {
  it('tells the card once the note went, so Job updates reads it without a reload, and reads their thread again', async () => {
    const io = fakeIo()
    const onDone = vi.fn()
    renderWithProviders(<MessageCustomerDoor jobId={JOB} jobName="Whitfield water heater" jobAddress="1208 Mesquite Ln" userId="luis" me="Luis Ortega" io={io} today="2026-10-13" onDone={onDone} />)
    const door = (await screen.findByTestId('job-mode-message-door')) as HTMLButtonElement
    await waitFor(() => expect(door.disabled).toBe(false))
    fireEvent.click(door)
    fireEvent.click(await screen.findByTestId('job-mode-message-else'))
    fireEvent.change(screen.getByTestId('job-mode-message-note'), { target: { value: 'the part comes Thursday.' } })
    fireEvent.click(screen.getByTestId('job-mode-message-note-send'))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(io.loadCustomer).toHaveBeenCalledTimes(2))
  })
})
