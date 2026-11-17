// @vitest-environment jsdom
/**
 * Retainage nobody recorded (fix A of the retainage clock check, 2026-11-16): the list draws a
 * job whose bills were paid at 90% with the figure they left behind and a job with a note alone,
 * Record writes the figure after the window's yes and tells the desk to read again, the office's
 * presses are not offered outside the office, the job a To do row opened it for is ringed, and nothing
 * is drawn when no job is in this state. The rows are the desk's own read (PR 2).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { RetainageUnrecordedRow } from '../../lib/ar/retainageSuggested'
import { LienRetainageUnrecorded } from './LienRetainageUnrecorded'

const io = vi.hoisted(() => ({
  writes: [] as Array<{ jobId: string; amount: number }>,
  fail: null as Error | null,
}))

vi.mock('../../lib/ar/retainageHeldIo', () => ({
  recordRetainageHeld: vi.fn(async (jobId: string, amount: number) => {
    if (io.fail) throw io.fail
    io.writes.push({ jobId, amount })
  }),
}))

const fromBills: RetainageUnrecordedRow = { jobId: 'j1', label: 'C2041', name: 'Cedar Hollow Clinic', heldBy: 'Bluebonnet Commercial Builders', status: 'billed', suggestion: { held: 2460, percent: 10, billCount: 3, billIds: ['a', 'b', 'c'] }, noteDay: '2026-09-08' }
const fromNote: RetainageUnrecordedRow = { jobId: 'j2', label: 'C2077', name: 'Pecan Row Offices', heldBy: 'Bluebonnet Commercial Builders', status: 'billed', suggestion: null, noteDay: '2026-09-21' }

afterEach(() => {
  cleanup()
  io.writes = []
  io.fail = null
})

describe('LienRetainageUnrecorded', () => {
  it('lists each job with why, records the figure the bills show after the yes, and tells the desk to read again', async () => {
    const onRecorded = vi.fn()
    const onOpenLienContract = vi.fn()
    renderWithProviders(<LienRetainageUnrecorded rows={[fromBills, fromNote]} office onOpenLienContract={onOpenLienContract} onRecorded={onRecorded} />)
    const section = screen.getByTestId('lien-retainage-unrecorded')
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
    // The answered job leaves at once, before the desk's next read brings the rows again.
    expect(screen.getAllByTestId('lien-retainage-unrecorded-row').map((n) => n.getAttribute('data-job-id'))).toEqual(['j2'])
    expect(section.textContent).toContain('Looks held · not on the job · 1')
  })

  it('records a job as having none, writes nothing when the window is cancelled, and keeps the row when the write is refused', async () => {
    const onRecorded = vi.fn()
    renderWithProviders(<LienRetainageUnrecorded rows={[fromNote]} office onOpenLienContract={vi.fn()} onRecorded={onRecorded} />)
    fireEvent.click(screen.getByTestId('lien-retainage-unrecorded-none'))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await settle()
    expect(io.writes).toEqual([])

    io.fail = new Error('new row violates row-level security policy')
    fireEvent.click(screen.getByTestId('lien-retainage-unrecorded-none'))
    fireEvent.click(await screen.findByRole('button', { name: 'Record no retainage' }))
    await settle()
    expect(onRecorded).not.toHaveBeenCalled()
    expect(screen.getByTestId('lien-retainage-unrecorded-row')).toBeTruthy()

    io.fail = null
    fireEvent.click(screen.getByTestId('lien-retainage-unrecorded-none'))
    fireEvent.click(await screen.findByRole('button', { name: 'Record no retainage' }))
    await waitFor(() => expect(io.writes).toEqual([{ jobId: 'j2', amount: 0 }]))
    await settle()
    expect(screen.queryByTestId('lien-retainage-unrecorded')).toBeNull()
  })

  it('shows a viewer outside the office the rows and the door to the job, without the office presses, and rings the job a To do row opened it for', () => {
    renderWithProviders(<LienRetainageUnrecorded rows={[fromBills, fromNote]} office={false} focusJobId="j2" onOpenLienContract={vi.fn()} onRecorded={vi.fn()} />)
    expect(screen.queryByTestId('lien-retainage-unrecorded-record')).toBeNull()
    expect(screen.queryByTestId('lien-retainage-unrecorded-none')).toBeNull()
    expect(screen.getAllByTestId('lien-retainage-unrecorded-open')).toHaveLength(2)
    expect(screen.getAllByTestId('lien-retainage-unrecorded-row').map((n) => n.getAttribute('data-focused'))).toEqual(['no', 'yes'])
  })

  it('draws nothing when no job is in this state, and says why when the desk could not read them', () => {
    const first = renderWithProviders(<LienRetainageUnrecorded rows={[]} office onOpenLienContract={vi.fn()} onRecorded={vi.fn()} />)
    expect(screen.queryByTestId('lien-retainage-unrecorded')).toBeNull()
    expect(screen.queryByTestId('lien-retainage-unrecorded-failure')).toBeNull()
    first.unmount()

    renderWithProviders(<LienRetainageUnrecorded rows={[]} failure="The check for retainage nobody recorded could not be read. The database refused it." office onOpenLienContract={vi.fn()} onRecorded={vi.fn()} />)
    expect(screen.getByTestId('lien-retainage-unrecorded-failure').textContent).toBe('The check for retainage nobody recorded could not be read. The database refused it.')
  })
})
