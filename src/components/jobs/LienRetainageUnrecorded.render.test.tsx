// @vitest-environment jsdom
/**
 * Retainage nobody recorded (fix A of the retainage clock check, 2026-11-16): the list draws a
 * job whose bills were paid at 90% with the figure they left behind and a job with a note alone,
 * Record writes the figure after the window's yes and the desk reads again, the office's presses
 * are not offered to a leader, and nothing is drawn when no job is in this state.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { RetainageUnrecordedRow } from '../../lib/ar/retainageSuggested'
import { LienRetainageUnrecorded } from './LienRetainageUnrecorded'

const io = vi.hoisted(() => ({
  rows: [] as RetainageUnrecordedRow[],
  fail: null as Error | null,
  loads: 0,
  writes: [] as Array<{ jobId: string; amount: number }>,
}))

vi.mock('../../lib/ar/retainageHeldIo', () => ({
  loadRetainageUnrecorded: vi.fn(async () => {
    io.loads += 1
    if (io.fail) throw io.fail
    return io.rows
  }),
  recordRetainageHeld: vi.fn(async (jobId: string, amount: number) => {
    io.writes.push({ jobId, amount })
  }),
}))

const fromBills: RetainageUnrecordedRow = { jobId: 'j1', label: 'C2041', name: 'Cedar Hollow Clinic', heldBy: 'Bluebonnet Commercial Builders', status: 'billed', suggestion: { held: 2460, percent: 10, billCount: 3, billIds: ['a', 'b', 'c'] }, noteDay: '2026-09-08' }
const fromNote: RetainageUnrecordedRow = { jobId: 'j2', label: 'C2077', name: 'Pecan Row Offices', heldBy: 'Bluebonnet Commercial Builders', status: 'billed', suggestion: null, noteDay: '2026-09-21' }

afterEach(() => {
  cleanup()
  io.rows = []
  io.fail = null
  io.loads = 0
  io.writes = []
})

describe('LienRetainageUnrecorded', () => {
  it('lists each job with why, records the figure the bills show after the yes, and tells the desk to read again', async () => {
    io.rows = [fromBills, fromNote]
    const onRecorded = vi.fn()
    const onOpenLienContract = vi.fn()
    renderWithProviders(<LienRetainageUnrecorded office onOpenLienContract={onOpenLienContract} onRecorded={onRecorded} />)
    const section = await screen.findByTestId('lien-retainage-unrecorded')
    expect(section.textContent).toContain('Looks held · not on the job · 2')
    const why = screen.getAllByTestId('lien-retainage-unrecorded-why').map((n) => n.textContent)
    expect(why).toEqual(['$2,460.00 looks held · 3 bills paid at 90% · a note of Sep 8 says retainage', 'a note of Sep 21 says retainage · no figure yet'])
    // A job with a note alone has no figure to record: its press opens the job.
    expect(screen.getAllByTestId('lien-retainage-unrecorded-record')).toHaveLength(1)
    expect(screen.getAllByTestId('lien-retainage-unrecorded-open').map((n) => n.textContent)).toEqual(['Type another figure ›', 'Type the figure on the job ›'])
    fireEvent.click(screen.getAllByTestId('lien-retainage-unrecorded-open')[1]!)
    expect(onOpenLienContract).toHaveBeenCalledWith('j2')

    fireEvent.click(screen.getByTestId('lien-retainage-unrecorded-record'))
    fireEvent.click(await screen.findByRole('button', { name: 'Record $2,460.00' }))
    await waitFor(() => expect(io.writes).toEqual([{ jobId: 'j1', amount: 2460 }]))
    await settle()
    expect(onRecorded).toHaveBeenCalledTimes(1)
    expect(io.loads).toBe(2)
  })

  it('records a job as having none, and nothing is written when the window is cancelled', async () => {
    io.rows = [fromNote]
    renderWithProviders(<LienRetainageUnrecorded office onOpenLienContract={vi.fn()} onRecorded={vi.fn()} />)
    fireEvent.click(await screen.findByTestId('lien-retainage-unrecorded-none'))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await settle()
    expect(io.writes).toEqual([])
    fireEvent.click(screen.getByTestId('lien-retainage-unrecorded-none'))
    fireEvent.click(await screen.findByRole('button', { name: 'Record no retainage' }))
    await waitFor(() => expect(io.writes).toEqual([{ jobId: 'j2', amount: 0 }]))
  })

  it('shows a leader the rows and the door to the job, without the office presses', async () => {
    io.rows = [fromBills]
    renderWithProviders(<LienRetainageUnrecorded office={false} onOpenLienContract={vi.fn()} onRecorded={vi.fn()} />)
    await screen.findByTestId('lien-retainage-unrecorded')
    expect(screen.queryByTestId('lien-retainage-unrecorded-record')).toBeNull()
    expect(screen.queryByTestId('lien-retainage-unrecorded-none')).toBeNull()
    expect(screen.getByTestId('lien-retainage-unrecorded-open')).toBeTruthy()
  })

  it('draws nothing when no job is in this state, and says why when the read is refused', async () => {
    const first = renderWithProviders(<LienRetainageUnrecorded office onOpenLienContract={vi.fn()} onRecorded={vi.fn()} />)
    await settle()
    expect(screen.queryByTestId('lien-retainage-unrecorded')).toBeNull()
    expect(screen.queryByTestId('lien-retainage-unrecorded-failure')).toBeNull()
    first.unmount()

    io.fail = new Error('permission denied for table jobs_ledger_thread_notes')
    renderWithProviders(<LienRetainageUnrecorded office onOpenLienContract={vi.fn()} onRecorded={vi.fn()} />)
    const failure = await screen.findByTestId('lien-retainage-unrecorded-failure')
    expect((failure.textContent ?? '').length).toBeGreaterThan(0)
  })
})
