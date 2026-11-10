// @vitest-environment jsdom
/**
 * Photo of a ticket (punch list #295, PR 2): the press draws, a shot opens the sheet with the clocked job picked, the
 * save button names what it will do, and Save hands the ticket and its page to the io.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => (await import('../../test/renderSmokeMocks')).useAuthModuleMock({ role: 'helpers', profileName: 'Jordan' }))

import { TicketPress } from './TicketPress'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { TicketScreensIo } from '../../lib/tickets/ticketScreensIo'
import type { TicketDraft, TicketPageDraft } from '../../lib/tickets/ticketsIo'

if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = () => 'blob:ticket'
if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = () => undefined

const oak = { jobId: 'oak', label: 'JP1042', name: 'Oak Hollow Bldg C' }
const cedar = { jobId: 'cedar', label: 'JP1038', name: 'Cedar Bend water heater' }

function makeIo(over: Partial<TicketScreensIo> = {}): TicketScreensIo {
  return {
    sheetFacts: () => Promise.resolve({ facts: { poEntries: [], clockedJob: oak, dayJobs: [cedar] }, fresh: true }),
    allJobs: () => Promise.resolve([]),
    list: () => Promise.resolve([]),
    jobFacts: () => Promise.resolve(new Map()),
    pageUrl: () => Promise.resolve(null),
    changeJob: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    addPage: () => Promise.resolve(),
    ...over,
  }
}

const shrink = async () => ({ blob: new Blob(['shrunk'], { type: 'image/jpeg' }), width: 2400, height: 1800, shrunk: true })

async function takeShot() {
  const input = screen.getByTestId('ticket-camera-input') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(['raw'], 'IMG_0001.jpg', { type: 'image/jpeg' })] } })
  await screen.findByText('Which job is this ticket for?')
}

/**
 * The sheet draws its chips on its first paint and picks the first job in an effect, one paint later; the day's jobs
 * may land later still. So a test waits for the pick itself, which Save names, before it reads a chip or taps one. A
 * read on the line after `takeShot()` raced that effect, and lost on a loaded runner (the CI flake of 2026-11-10).
 */
const pickedFirst = (saveWords: string) => screen.findByText(saveWords)

describe('TicketPress', () => {
  it('draws the press and the link for a file already on the phone', async () => {
    renderWithProviders(<TicketPress userId="u1" byName="Jordan" io={makeIo()} captureIo={{ shrink }} />)
    await settle()
    expect(screen.getByText('Photo of a ticket')).toBeTruthy()
    expect(screen.getByText('or choose a photo or a PDF you already have')).toBeTruthy()
    expect(screen.queryByText('Which job is this ticket for?')).toBeNull()
  })

  it('opens the sheet after the shot with the clocked job picked, and Save names it', async () => {
    renderWithProviders(<TicketPress userId="u1" byName="Jordan" io={makeIo()} captureIo={{ shrink }} />)
    await settle()
    await takeShot()
    expect(await pickedFirst('Save the ticket to JP1042')).toBeTruthy()
    const clocked = screen.getByText('JP1042, Oak Hollow Bldg C').closest('button')!
    expect(clocked.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Clocked in now')).toBeTruthy()
    expect(screen.getByText('For two jobs? Tap the second one too.')).toBeTruthy()
  })

  it('adds a second job on a tap, and says so on Save', async () => {
    renderWithProviders(<TicketPress userId="u1" byName="Jordan" io={makeIo()} captureIo={{ shrink }} />)
    await settle()
    await takeShot()
    // A tap before the first pick lands would be the only job picked: the sheet stops picking once a person taps.
    await pickedFirst('Save the ticket to JP1042')
    fireEvent.click(screen.getByText('JP1038, Cedar Bend water heater'))
    expect(screen.getByText('Save the ticket to JP1042 and JP1038')).toBeTruthy()
    fireEvent.click(screen.getByText('Not for one job'))
    expect(screen.getByText('Save the ticket for no one job')).toBeTruthy()
  })

  it('offers no job as picked when the person is not clocked in, and Save is dead until one is', async () => {
    const io = makeIo({ sheetFacts: () => Promise.resolve({ facts: { poEntries: [], clockedJob: null, dayJobs: [cedar] }, fresh: true }) })
    renderWithProviders(<TicketPress userId="u1" byName="Jordan" io={io} captureIo={{ shrink }} />)
    await settle()
    await takeShot()
    // Nothing is picked here, so the day's job on the sheet is the sign that the read landed.
    const dayJob = (await screen.findByText('JP1038, Cedar Bend water heater')).closest('button')!
    await settle()
    expect(dayJob.getAttribute('aria-pressed')).toBe('false')
    const save = screen.getByText('Pick a job to save the ticket').closest('button') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(screen.getByText('Pick the job later'))
    expect(screen.getByText('Save the ticket and pick the job later')).toBeTruthy()
  })

  it('puts today’s PO code first and picks it', async () => {
    const io = makeIo({ sheetFacts: () => Promise.resolve({ facts: { poEntries: [{ ...cedar, poEntryId: 'po1', poCode: '41207', houseName: 'Ridgeway Supply' }], clockedJob: oak, dayJobs: [] }, fresh: true }) })
    renderWithProviders(<TicketPress userId="u1" byName="Jordan" io={io} captureIo={{ shrink }} />)
    await settle()
    await takeShot()
    expect(await pickedFirst('Save the ticket to JP1038')).toBeTruthy()
    expect(screen.getByText('PO 41207, JP1038, Cedar Bend water heater')).toBeTruthy()
    expect(screen.getByText('Your PO code at Ridgeway Supply')).toBeTruthy()
  })

  it('saves the ticket with its job and its page, closes the sheet and says where it went', async () => {
    const sent: { draft: TicketDraft; pages: readonly TicketPageDraft[] }[] = []
    const send = vi.fn(async (draft: TicketDraft, pages: readonly TicketPageDraft[]) => void sent.push({ draft, pages }))
    renderWithProviders(<TicketPress userId="u1" byName="Jordan" io={makeIo()} captureIo={{ shrink, send, now: () => Date.parse('2026-11-04T16:02:00Z') }} />)
    await settle()
    await takeShot()
    fireEvent.click(await pickedFirst('Save the ticket to JP1042'))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(sent[0]!.draft).toMatchObject({ takenBy: 'u1', takenByName: 'Jordan', takenAt: '2026-11-04T16:02:00.000Z', takenAtFrom: 'press', source: 'camera', jobId: 'oak', alsoJobIds: [], noOneJob: false, poEntryId: null, total: null, note: '' })
    expect(sent[0]!.pages.map((p) => `${p.pageNo}/${p.mime}/${p.width}`)).toEqual(['1/image/jpeg/2400'])
    await waitFor(() => expect(screen.queryByText('Which job is this ticket for?')).toBeNull())
    expect(screen.getAllByText('Ticket saved to JP1042.').length).toBeGreaterThan(0)
  })

  it('keeps the sheet and shows the reason when the save is refused', async () => {
    const send = vi.fn(async () => Promise.reject(new Error('Your account is in training mode.')))
    renderWithProviders(<TicketPress userId="u1" byName="Jordan" io={makeIo()} captureIo={{ shrink, send }} />)
    await settle()
    await takeShot()
    fireEvent.click(await pickedFirst('Save the ticket to JP1042'))
    expect(await screen.findByText('Your account is in training mode.')).toBeTruthy()
    expect(screen.getByText('Which job is this ticket for?')).toBeTruthy()
  })

  it('draws as a one-line door on the Job Mode card, with the card’s job picked first (PR 4)', async () => {
    const io = makeIo({
      jobFacts: () => Promise.resolve(new Map([['elm', { jobId: 'elm', label: 'JP1050', name: 'Elm Street repipe' }]])),
      sheetFacts: () => Promise.resolve({ facts: { poEntries: [], clockedJob: oak, dayJobs: [cedar] }, fresh: true }),
    })
    renderWithProviders(<TicketPress variant="line" jobId="elm" userId="u1" byName="Jordan" io={io} captureIo={{ shrink }} />)
    await settle()
    expect(screen.getByText('Ticket · take its photo ▸')).toBeTruthy()
    expect(screen.queryByText('Photo of a ticket')).toBeNull()
    // The line reads the day's jobs on the press, not as it is drawn.
    fireEvent.click(screen.getByText('Ticket · take its photo ▸'))
    await settle()
    await takeShot()
    expect(await pickedFirst('Save the ticket to JP1050')).toBeTruthy()
    // The clock's guess comes with the day's jobs, a read of its own: it may land after the card's job is picked.
    expect(await screen.findByText('JP1042, Oak Hollow Bldg C')).toBeTruthy()
  })
})
