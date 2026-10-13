// @vitest-environment jsdom
/**
 * Messages, residential R8 · 8's screens: *Line on the estimate* on a customer's message. The press reads the message's
 * Pipeline job and the estimates its messages point at, and draws the kernel's line: its place on the job's open draft
 * or a new one, the message's first sentence, and a name to give. Save hands the line, the draft and the draft as it was
 * read to the database with the message's id. The kernel's words say why a billed job, a line on no Pipeline job or a
 * draft with options cannot take one, and a refused save keeps its own words. Dana and her Helotes job are the
 * mockups' demo people; nothing here is a real row.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LineJobRead, LineSaved, LineThreadContact } from '../../lib/estimates/lineFromMessageIo'
import type { ThreadMessage } from '../../lib/messages/thread'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { StartEstimateLine } from './StartEstimateLine'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const DANA: LineThreadContact = { id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', first: 'Dana', customerId: 'cust-dana' }
const message = (over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 'm-hose-bib',
  contactId: 'c-dana',
  jobId: 'pipeline:j-helotes',
  channel: 'text',
  direction: 'in',
  at: '2026-10-12T21:05:00Z',
  who: 'Dana',
  body: 'While you are here can you also replace the hose bib out front? The old one drips.',
  ...over,
})
const WATER_HEATER = { line_item: 'Water heater swap', description: '50 gallon gas', quantity: 1, unit_price_cents: 185000, amount_cents: 185000 }
const READ: LineJobRead = {
  job: { id: 'j-helotes', name: 'Helotes', status: 'working', customerId: 'cust-dana' },
  estimates: [
    { id: 'e-1044', jobId: 'j-helotes', docKind: 'estimate', status: 'draft', number: 1044, lines: [WATER_HEATER], seenAt: '2026-10-12T20:00:00.123456+00:00', hasOptions: false },
  ],
}

function draw(over: { message?: ThreadMessage; read?: LineJobRead | null; draft?: () => Promise<LineSaved> } = {}) {
  const io = {
    loadJob: vi.fn(async (_id: string) => (over.read === undefined ? READ : over.read)),
    draft: vi.fn(over.draft ?? (async (): Promise<LineSaved> => ({ estimateId: 'e-1044', estimateNumber: 1044, lineNumber: 2 }))),
  }
  const onDrafted = vi.fn()
  renderWithProviders(<StartEstimateLine message={over.message ?? message()} contact={DANA} io={io} onDrafted={onDrafted} />)
  return { io, onDrafted }
}

const press = () => fireEvent.click(screen.getByRole('button', { name: 'Line on the estimate' }))

describe('StartEstimateLine', () => {
  it('puts the message on the job’s open draft as its next line, from its first sentence, read as it was', async () => {
    const { io, onDrafted } = draw()
    press()
    expect(await screen.findByText('Line 2 on estimate 1044 for Helotes')).toBeTruthy()
    expect(io.loadJob).toHaveBeenCalledWith('j-helotes')
    const description = screen.getByLabelText('Description') as HTMLTextAreaElement
    expect(description.value).toBe('While you are here can you also replace the hose bib out front?')
    expect(screen.getByText('It goes on at $0 for Dana Whitfield to approve. The money team prices it and sends it.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Line item'), { target: { value: ' Hose bib ' } })
    fireEvent.change(description, { target: { value: '  Replace the front hose bib ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the line' }))
    await waitFor(() => expect(onDrafted).toHaveBeenCalledWith({ estimateId: 'e-1044', estimateNumber: 1044, lineNumber: 2 }, expect.objectContaining({ jobName: 'Helotes' })))
    expect(io.draft).toHaveBeenCalledWith('m-hose-bib', {
      estimateId: 'e-1044',
      line: { line_item: 'Hose bib', description: 'Replace the front hose bib', quantity: 1, unit_price_cents: 0, amount_cents: 0 },
      replacesLast: false,
      seenAt: '2026-10-12T20:00:00.123456+00:00',
    })
    expect(screen.queryByText('Line 2 on estimate 1044 for Helotes')).toBeNull()
  })

  it('starts a new estimate when the job has no draft open', async () => {
    const { io } = draw({ read: { ...READ, estimates: [{ ...READ.estimates[0]!, status: 'sent' }] } })
    press()
    expect(await screen.findByText('Line 1 on a new estimate for Helotes')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save the line' }))
    await waitFor(() => expect(io.draft).toHaveBeenCalledWith('m-hose-bib', expect.objectContaining({ estimateId: null, seenAt: null })))
  })

  it('says why in the kernel’s words when the job is billed, the line is on no Pipeline job, or the draft has options', async () => {
    draw({ read: { ...READ, job: { ...READ.job, status: 'billed' } } })
    press()
    expect(await screen.findByText('Helotes is billed already. Start the work as a new job.')).toBeTruthy()
    cleanup()

    const { io } = draw({ message: message({ jobId: 'project:fairoaksd' }) })
    press()
    expect(await screen.findByText('Tie the message to a job first. An estimate belongs to one job.')).toBeTruthy()
    expect(io.loadJob).not.toHaveBeenCalled()
    cleanup()

    draw({ read: { ...READ, estimates: [{ ...READ.estimates[0]!, hasOptions: true }] } })
    press()
    expect(await screen.findByText('Estimate 1044 has options. Add the line on the estimate itself.')).toBeTruthy()
  })

  it('keeps a refused save in its own words, with the form still open', async () => {
    const { onDrafted } = draw({ draft: async () => Promise.reject(new Error('Estimate 1044 changed since you opened it. Open the message again.')) })
    press()
    fireEvent.click(await screen.findByRole('button', { name: 'Save the line' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Estimate 1044 changed since you opened it. Open the message again.')
    expect(screen.getByText('Line 2 on estimate 1044 for Helotes')).toBeTruthy()
    expect(onDrafted).not.toHaveBeenCalled()
  })

  it('asks what the line is for before it saves, and Cancel puts the form away', async () => {
    const { io } = draw()
    press()
    fireEvent.change(await screen.findByLabelText('Description'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the line' }))
    expect(screen.getByRole('alert').textContent).toBe('Say what the line is for.')
    expect(io.draft).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Description')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
