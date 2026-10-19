// @vitest-environment jsdom
/**
 * The customer's door on the Pipeline (v2.5626, punch list #123): the sheet behind the speech bubble names the job and
 * the customer, says whose word came last, offers Call · Text · Email · Open their thread · Their record, greys what the
 * customer has no channel for, and draws the job window's own box when Text or Email is pressed. Dana and her Helotes
 * job are the mockups' demo people; nothing is a real row.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { JobActivityMessage } from '../../lib/jobs/jobActivityMessages'
import type { ReplyIo } from '../../lib/messages/replyIo'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { JobCustomerSheet, type JobCustomerSheetJob } from './JobCustomerSheet'

vi.mock('../gc/messages/reply/useTextsOn', () => ({ useTextsOn: () => true }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
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

const JOB: JobCustomerSheetJob = {
  id: 'j-helotes',
  job_name: 'Helotes re-pipe',
  hcp_number: '2148',
  click_number: '',
  status: 'working',
  created_at: '2026-10-01T12:00:00.000Z',
  customer_id: 'cust-dana',
  customer_name: 'Dana Whitfield',
  customer_phone: '(210) 555-0188',
  customer_email: 'dana@whitfield.example',
}

const HER_LINE: JobActivityMessage = {
  id: 'm-1',
  contactId: 'c-dana',
  contact: { name: 'Dana Whitfield', goesBy: 'Dana', kind: 'customer' },
  channel: 'text',
  direction: 'in',
  at: '2026-10-17T21:31:00.000Z',
  who: '',
  body: 'Great, I will leave the side gate open.',
  tied: true,
}

function fakeIo(): ReplyIo {
  return {
    loadSender: vi.fn(() => Promise.resolve({ name: 'Rosa', title: 'Office', cell: '(210) 555-0142' })),
    addNote: vi.fn(() => Promise.resolve('m-note-new')),
    sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
    sendText: vi.fn(() => Promise.resolve('m-text-new')),
  }
}

function draw(over: Partial<JobCustomerSheetJob> = {}, lines: JobActivityMessage[] = [HER_LINE], onOpenRecord?: (id: string) => void) {
  const onClose = vi.fn()
  const onSent = vi.fn()
  const openThread = vi.fn(() => Promise.resolve())
  renderWithProviders(
    <JobCustomerSheet
      job={{ ...JOB, ...over }}
      onClose={onClose}
      onOpenRecord={onOpenRecord}
      onSent={onSent}
      nowIso="2026-10-18T15:00:00.000Z"
      loadLines={() => Promise.resolve(lines)}
      load={async () => DANA}
      io={fakeIo()}
      openThread={openThread}
    />,
  )
  return { onClose, onSent, openThread }
}

describe('JobCustomerSheet', () => {
  it('names the customer and the job, says whose word came last, and offers every door', async () => {
    draw({}, [HER_LINE], vi.fn())
    expect(screen.getByRole('dialog', { name: 'Dana Whitfield' })).toBeTruthy()
    expect(screen.getByText('#2148 · Helotes re-pipe')).toBeTruthy()
    await waitFor(() => expect(document.querySelector('[data-customer-door-last]')?.textContent).toBe('Waiting on us: Dana wrote last, yesterday.'))
    const list = screen.getByRole('list', { name: 'Reach Dana Whitfield' })
    expect(within(list).getAllByRole('listitem').map((el) => el.getAttribute('data-customer-door-row'))).toEqual(['call', 'text', 'email', 'thread', 'record'])
    expect((within(list).getByRole('link', { name: /^Call/ }) as HTMLAnchorElement).getAttribute('href')).toMatch(/^tel:/)
  })

  it('greys Text with no mobile and says why, and offers no record row without the window', async () => {
    draw({ customer_phone: null }, [])
    const list = screen.getByRole('list', { name: 'Reach Dana Whitfield' })
    const text = within(list).getByRole('button', { name: /^Text/ })
    expect(text.getAttribute('aria-disabled')).toBe('true')
    expect(text.textContent).toContain('No mobile on file. Email instead.')
    expect(within(list).queryByRole('button', { name: /Their record/ })).toBeNull()
    await waitFor(() => expect(document.querySelector('[data-customer-door-last]')).toBeNull())
  })

  it('draws the job window’s own box on Text, tied to the job, with Back to the rows', async () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: /^Text/ }))
    await waitFor(() => expect(document.querySelector('[data-reply-box]')).toBeTruthy())
    const el = document.querySelector('[data-reply-box]') as HTMLElement
    expect(el.querySelector('[data-reply-tie]')?.textContent).toBe('Helotes re-pipe')
    expect(within(el).getByRole('button', { name: 'Send text…' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Text' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '‹ Back' }))
    expect(screen.getByRole('list', { name: 'Reach Dana Whitfield' })).toBeTruthy()
  })

  it('opens their thread through the opener, and their record through the page’s window after closing', () => {
    const onOpenRecord = vi.fn()
    const { onClose, openThread } = draw({}, [], onOpenRecord)
    fireEvent.click(screen.getByRole('button', { name: /Open their thread/ }))
    expect(openThread).toHaveBeenCalledWith('cust-dana')
    fireEvent.click(screen.getByRole('button', { name: /Their record/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpenRecord).toHaveBeenCalledWith('cust-dana')
  })
})

describe('the thread’s last lines (v2.5632)', () => {
  it('shows the newest three words between us and them, oldest first, theirs marked, and leaves the notes out', async () => {
    const ours: JobActivityMessage = { ...HER_LINE, id: 'm-us', direction: 'out', who: 'Tanya', at: '2026-10-17T22:00:00.000Z', body: 'We will be there at 8.' }
    const older: JobActivityMessage = { ...HER_LINE, id: 'm-older', at: '2026-10-16T15:00:00.000Z', body: 'Is Friday still on?' }
    const oldest: JobActivityMessage = { ...HER_LINE, id: 'm-oldest', at: '2026-10-15T15:00:00.000Z', body: 'Hi, this is Dana.' }
    const note: JobActivityMessage = { ...HER_LINE, id: 'm-note', channel: 'note', direction: 'team', who: 'Rosa', at: '2026-10-18T09:00:00.000Z', body: 'Call her about the gate.' }
    draw({}, [note, oldest, HER_LINE, older, ours])
    await waitFor(() => expect(document.querySelectorAll('[data-customer-door-line]')).toHaveLength(3))
    const lines = [...document.querySelectorAll<HTMLElement>('[data-customer-door-line]')]
    expect(lines.map((l) => l.dataset.customerDoorLine)).toEqual(['them', 'them', 'us'])
    expect(lines.map((l) => l.textContent)).toEqual([
      'Dana · text · last FridayIs Friday still on?',
      'Dana · text · yesterdayGreat, I will leave the side gate open.',
      'Tanya · text · yesterdayWe will be there at 8.',
    ])
    expect(screen.queryByText('Call her about the gate.')).toBeNull()
    // The line under the job still says whose word came last, ours here.
    expect(document.querySelector('[data-customer-door-last]')?.textContent).toBe('You wrote last, yesterday.')
  })

  it('draws no list with no word between us', async () => {
    draw({}, [])
    await waitFor(() => expect(screen.getByText('Open their thread')).toBeTruthy())
    expect(document.querySelector('[data-customer-door-lines]')).toBeNull()
  })
})
