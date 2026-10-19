// @vitest-environment jsdom
/**
 * v2.5635: a job's customer lines are live. With the Job activity and the customer's sheet open, a text that lands on
 * `messages` reads the job's lines again on the page's one Messages channel: the new line takes the next number and
 * the lines on screen keep theirs, the feed never empties while the read is out, a read again that fails keeps what
 * is shown, and the sheet's last lines and last word follow. Dana Whitfield's made-up job from the customer prototype.
 */
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  const listeners: Array<{ table: string; fn: () => void }> = []
  let made = 0
  const channel = () => {
    made += 1
    const ch: Record<string, unknown> = {}
    ch.on = (_kind: string, spec: { table: string }, fn: () => void) => {
      listeners.push({ table: spec.table, fn })
      return ch
    }
    ch.subscribe = () => ch
    return ch
  }
  return { listeners, channel, count: () => made }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: { ...makeSupabaseStub(), channel: fake.channel, removeChannel: () => {} } }
})
vi.mock('../../lib/messages/messagesIo', () => ({ loadJobMessages: vi.fn(), contactForCustomer: vi.fn() }))
vi.mock('../gc/messages/reply/useTextsOn', () => ({ useTextsOn: () => true }))

import { loadJobMessages } from '../../lib/messages/messagesIo'
import type { JobActivityMessage } from '../../lib/jobs/jobActivityMessages'
import { DANA_JOB_MESSAGES } from '../../test/fixtures/jobActivityMessagesDemo'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobThreadActivityItem } from '../JobThreadNotesPanel'
import { JobActivityView } from './JobActivityView'
import { JobCustomerSheet } from './JobCustomerSheet'

afterEach(() => {
  cleanup()
  vi.mocked(loadJobMessages).mockReset()
})

const NOTE = { kind: 'note' as const, note: { id: 'n-1', created_at: '2026-10-06T21:12:00Z', body: 'Called Dana back. Thursday works for her.', author: { name: 'Rosa' } } } as unknown as JobThreadActivityItem
const HER_NEW_LINE: JobActivityMessage = {
  id: 'm-dana-12',
  contactId: 'c-dana',
  contact: { name: 'Dana Whitfield', goesBy: null, kind: 'customer' },
  channel: 'text',
  direction: 'in',
  at: '2026-10-08T14:10:00Z',
  who: '',
  body: 'Running ten minutes late to let you in.',
  tied: true,
}

/** A text lands: the channel hears `messages`, and the bus settles before it reads. */
const aLineLands = () => fake.listeners.find((l) => l.table === 'messages')!.fn()
const SETTLED = { timeout: 3000 }

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const entryOf = (text: string) => within(screen.getByText(text).closest('[role="button"]') as HTMLElement).getByLabelText(/^Entry \d+$/).getAttribute('aria-label')

function showFeed() {
  const job = makeJob({ id: 'jl-1312', status: 'working', created_at: '2026-10-01T12:00:00Z' } as never)
  renderWithProviders(<JobActivityView job={job} activity={[NOTE]} upcoming={null} viewerRole="assistant" narrow={false} />)
}

describe('the job’s customer lines are live (v2.5635)', () => {
  it('shows a line that lands with the next number, keeps the others’, and keeps the feed while it reads', async () => {
    vi.mocked(loadJobMessages).mockResolvedValue(DANA_JOB_MESSAGES)
    showFeed()
    expect(await screen.findByText('Great. Gate code is 4471.')).toBeTruthy()
    expect(screen.getAllByLabelText(/^Entry \d+$/)).toHaveLength(13)
    const before = { note: entryOf('Called Dana back. Thursday works for her.'), gate: entryOf('Great. Gate code is 4471.') }
    expect(fake.count()).toBe(1)

    const read = deferred<JobActivityMessage[]>()
    vi.mocked(loadJobMessages).mockReturnValueOnce(read.promise)
    aLineLands()
    await waitFor(() => expect(loadJobMessages).toHaveBeenCalledTimes(2), SETTLED)
    // The read is out: the lines on screen stay, numbered as they were.
    expect(screen.getAllByLabelText(/^Entry \d+$/)).toHaveLength(13)
    read.resolve([...DANA_JOB_MESSAGES, HER_NEW_LINE])

    expect(await screen.findByText('Running ten minutes late to let you in.')).toBeTruthy()
    expect(entryOf('Running ten minutes late to let you in.')).toBe('Entry 14')
    expect(entryOf('Called Dana back. Thursday works for her.')).toBe(before.note)
    expect(entryOf('Great. Gate code is 4471.')).toBe(before.gate)
    expect(fake.count()).toBe(1)
  })

  it('keeps the lines it shows when a read again fails', async () => {
    vi.mocked(loadJobMessages).mockResolvedValue(DANA_JOB_MESSAGES)
    showFeed()
    expect(await screen.findByText('Great. Gate code is 4471.')).toBeTruthy()
    vi.mocked(loadJobMessages).mockRejectedValueOnce(new Error('down'))
    aLineLands()
    await waitFor(() => expect(loadJobMessages).toHaveBeenCalledTimes(2), SETTLED)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getAllByLabelText(/^Entry \d+$/)).toHaveLength(13)
    expect(screen.getByText('Great. Gate code is 4471.')).toBeTruthy()
  })

  it('brings the line into the customer’s sheet, its last lines and its last word, on the same channel', async () => {
    const ours: JobActivityMessage = { ...HER_NEW_LINE, id: 'm-us', direction: 'out', who: 'Rosa', at: '2026-10-17T22:00:00.000Z', body: 'We will be there at 8.' }
    const hers: JobActivityMessage = { ...HER_NEW_LINE, at: '2026-10-18T14:00:00.000Z' }
    const lines = vi.fn(() => Promise.resolve([ours]))
    renderWithProviders(
      <JobCustomerSheet
        job={{ id: 'jl-1312', job_name: 'Oakridge sewer line', hcp_number: '1312', click_number: '', status: 'working', created_at: '2026-10-01T12:00:00Z', customer_id: 'cust-dana', customer_name: 'Dana Whitfield', customer_phone: '(210) 555-0188', customer_email: null }}
        onClose={() => {}}
        nowIso="2026-10-18T15:00:00.000Z"
        loadLines={lines}
        load={async () => {
          throw new Error('not needed')
        }}
      />,
    )
    await waitFor(() => expect(document.querySelector('[data-customer-door-last]')?.textContent).toBe('You wrote last, yesterday.'))
    lines.mockImplementation(() => Promise.resolve([ours, hers]))
    aLineLands()
    await waitFor(() => expect(document.querySelectorAll('[data-customer-door-line]')).toHaveLength(2), SETTLED)
    expect(screen.getByText('Running ten minutes late to let you in.')).toBeTruthy()
    expect(document.querySelector('[data-customer-door-last]')?.textContent).toMatch(/^Waiting on us/)
  })
})
