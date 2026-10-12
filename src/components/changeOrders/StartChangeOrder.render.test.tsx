// @vitest-environment jsdom
/**
 * Messages, cut 4b's screens: *Start a change order* on a customer's message. The press reads the message's job and
 * draws the kernel's draft: the next number, the job, the message's first line to finish, why, and who signs. Save
 * hands the draft to the database with the message's id. The kernel's words say why a lost job, a job still bidding
 * or a line on no GC job cannot start one, and a refused save keeps its own words. The people are the prototype's demo
 * people; nothing here is a real row.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChangeOrderJob, MessageContact } from '../../lib/changeOrders/fromMessage'
import type { ThreadMessage } from '../../lib/messages/thread'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { StartChangeOrder } from './StartChangeOrder'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const PRIYA: MessageContact = { id: 'c-priya', kind: 'customer', name: 'Dr. Priya Raman', first: 'Dr. Raman' }
const message = (over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 'm-priya-sink',
  contactId: 'c-priya',
  jobId: 'project:fairoaksd',
  channel: 'text',
  direction: 'in',
  at: '2026-10-01T15:00:00Z',
  who: 'Dr. Raman',
  body: 'Can we add a sink in exam 3?\nThe plumber said it is easy.',
  ...over,
})
const JOB: ChangeOrderJob = { id: 'fairoaksd', name: 'Fair Oaks Dental', stage: 'building', lostOn: null, changeOrders: [{ number: 1 }, { number: 2 }] }

function draw(over: { message?: ThreadMessage; job?: ChangeOrderJob | null; draft?: () => Promise<{ id: string; number: number }> } = {}) {
  const io = {
    loadJob: vi.fn(async (_id: string) => (over.job === undefined ? JOB : over.job)),
    draft: vi.fn(over.draft ?? (async () => ({ id: 'co-3', number: 3 }))),
  }
  const onDrafted = vi.fn()
  renderWithProviders(<StartChangeOrder message={over.message ?? message()} contact={PRIYA} io={io} onDrafted={onDrafted} />)
  return { io, onDrafted }
}

const press = () => fireEvent.click(screen.getByRole('button', { name: 'Start a change order' }))

describe('StartChangeOrder', () => {
  it('drafts the next change order on the message’s job, from its first line, signed by the customer', async () => {
    const { io, onDrafted } = draw()
    press()
    expect(await screen.findByText('Change order 3 on Fair Oaks Dental')).toBeTruthy()
    expect(io.loadJob).toHaveBeenCalledWith('fairoaksd')
    const what = screen.getByLabelText('What changes') as HTMLTextAreaElement
    expect(what.value).toBe('Can we add a sink in exam 3?')
    expect(screen.getByText('Dr. Priya Raman signs it. The money team prices it and sends it to sign.')).toBeTruthy()
    fireEvent.change(what, { target: { value: '  Add a sink in exam 3 ' } })
    fireEvent.change(screen.getByLabelText('Why it changes'), { target: { value: 'field' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the draft' }))
    await waitFor(() => expect(onDrafted).toHaveBeenCalledWith({ id: 'co-3', number: 3 }, 'Fair Oaks Dental'))
    expect(io.draft).toHaveBeenCalledWith('m-priya-sink', {
      description: 'Add a sink in exam 3',
      reason: 'field',
      schedule: '',
      packageId: null,
      cost: 0,
      price: 0,
      days: 0,
    })
    expect(screen.queryByText('Change order 3 on Fair Oaks Dental')).toBeNull()
  })

  it('says why in the kernel’s words when the job was lost, is still bidding, or the line sits on no GC job', async () => {
    draw({ job: { ...JOB, lostOn: '2026-09-01' } })
    press()
    expect(await screen.findByText('A change order needs a job we won. Fair Oaks Dental was lost.')).toBeTruthy()
    cleanup()

    draw({ job: { ...JOB, stage: 'pursuing' } })
    press()
    expect(await screen.findByText('A change order needs a job we won. Fair Oaks Dental is still bidding.')).toBeTruthy()
    cleanup()

    // Tied to a bid, not a GC job: no job is read, and the press asks for the job.
    const { io } = draw({ message: message({ jobId: 'bid:b-482' }) })
    press()
    expect(await screen.findByText('Tie the message to a job first. A change order belongs to one job.')).toBeTruthy()
    expect(io.loadJob).not.toHaveBeenCalled()
  })

  it('keeps a refused save in its own words, with the form still open', async () => {
    const { onDrafted } = draw({ draft: async () => Promise.reject(new Error('This message became change order 2 already.')) })
    press()
    fireEvent.click(await screen.findByRole('button', { name: 'Save the draft' }))
    expect((await screen.findByRole('alert')).textContent).toBe('This message became change order 2 already.')
    expect(screen.getByText('Change order 3 on Fair Oaks Dental')).toBeTruthy()
    expect(onDrafted).not.toHaveBeenCalled()
  })

  it('asks for what changes before it saves, and Cancel puts the form away', async () => {
    const { io } = draw()
    press()
    fireEvent.change(await screen.findByLabelText('What changes'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the draft' }))
    expect(screen.getByRole('alert').textContent).toBe('Say what is changing.')
    expect(io.draft).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('What changes')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
