// @vitest-environment jsdom
/**
 * Render smoke for the box window (v2.7199): two tabs. Cage holds the Edit form, the code and the box's own history
 * with a rename read from the database; Contents lists each part with when it came in and its history under a fold.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, ContainerLine, ContainerMove, Movement, Place } from '../../lib/materials/onSite'

const C1 = '7d759246-8476-4a37-884f-ed1562d5663f'
const moves: ContainerMove[] = [{ id: 'm1', jobId: 'j1', containerId: C1, fromLocationId: 'p1', toLocationId: 'p2', byName: 'Priya', at: '2026-11-05T12:00:00Z' }]
const row = (id: string, reason: Movement['reason'], quantity: number, at: string): Movement => ({ id, jobId: 'j1', partId: null, partName: 'Pex rolls', manufacturer: null, quantity, reason, fromContainerId: reason === 'delivered' ? null : C1, toContainerId: reason === 'delivered' ? C1 : null, note: '', byUserId: null, byName: 'Marcus', at, source: null, itemId: null })
const ledger = [row('a', 'delivered', 16, '2026-11-01T10:00:00Z'), row('b', 'counted', 16, '2026-11-01T10:01:00Z'), row('c', 'used', 6, '2026-11-06T08:00:00Z')]

const loadJob = vi.fn(async (..._a: unknown[]) => {})
vi.mock('../../lib/materials/onSiteStore', () => ({
  editContainer: vi.fn(),
  moveContainer: vi.fn(),
  addPlace: vi.fn(),
  listContainerMoves: () => moves,
  listMovements: () => ledger,
  jobLedgerCapped: () => false,
  loadJob: (...a: unknown[]) => loadJob(...a),
}))
const renamePart = vi.fn()
const undoPartRename = vi.fn()
vi.mock('../../lib/materials/partRenameIo', () => ({ renamePart: (...a: unknown[]) => renamePart(...a), undoPartRename: (...a: unknown[]) => undoPartRename(...a) }))
vi.mock('../../hooks/useAuth', async () => (await import('../../test/renderSmokeMocks')).useAuthModuleMock())
const fetchBoxNames = vi.fn()
vi.mock('../../lib/materials/boxHistoryIo', () => ({ fetchBoxNames: (id: string) => fetchBoxNames(id) }))

import BoxTabs, { BoxWindow } from './BoxTabs'

afterEach(() => { cleanup(); fetchBoxNames.mockReset(); renamePart.mockReset(); undoPartRename.mockReset(); loadJob.mockClear() })

const box: Container = { id: C1, jobId: 'j1', label: 'R70', kind: 'loose', where: '', locationId: 'p2', lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T09:59:00Z' }
const places: Place[] = [{ id: 'p1', jobId: 'j1', name: 'Arena', createdAt: '' }, { id: 'p2', jobId: 'j1', name: 'Yard', createdAt: '' }]
const lines: ContainerLine[] = [{ containerId: C1, partKey: 'text:pex rolls', partId: null, partName: 'Pex rolls', manufacturer: null, onHand: 10, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0 }]
const props = { container: box, containers: [box], places, lines, byName: 'Dana', byUserId: 'u1', onSaved: () => {} }

describe('BoxTabs', () => {
  it('opens on Cage with the form, the code and the box’s history, a rename among it', async () => {
    fetchBoxNames.mockResolvedValue([{ id: 'n1', containerId: C1, oldLabel: 'R70 NO CONTAINER', newLabel: 'R70', byName: 'Dana', at: '2026-11-13T15:00:00Z' }])
    renderWithProviders(<BoxTabs {...props} />)
    expect(screen.getByRole('tab', { name: 'Cage' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('edit-box-form')).toBeTruthy()
    expect(screen.getByTestId('box-tabs-code').textContent).toBe('7D75-9246')
    const history = screen.getByTestId('box-tabs-history')
    expect(history.textContent).toContain('Moved from Arena to Yard')
    await waitFor(() => expect(history.textContent).toContain('Renamed from R70 NO CONTAINER to R70'))
    expect(history.textContent).toContain('Added as R70 NO CONTAINER')
    expect(fetchBoxNames).toHaveBeenCalledWith(C1)
  })

  it('Contents lists each part with when it came in, where the box stood then, and its history', async () => {
    fetchBoxNames.mockResolvedValue([])
    renderWithProviders(<BoxTabs {...props} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Contents · 1' }))
    const line = screen.getByTestId('box-tabs-line')
    expect(line.textContent).toContain('Pex rolls')
    expect(line.textContent).toContain('10')
    expect(line.textContent).toMatch(/Added Nov 1 by Marcus, at Arena/)
    expect(line.textContent).toContain('3 events')
    expect(line.textContent).toContain('Used 6')
    expect(line.textContent).toContain('Counted 16, as expected')
    expect(screen.queryByTestId('edit-box-form')).toBeNull()
    await waitFor(() => expect(fetchBoxNames).toHaveBeenCalled())
  })

  it('an empty box says so, and old names that did not load say why', async () => {
    fetchBoxNames.mockRejectedValue({ message: 'permission denied for table job_container_names', code: '42501' })
    renderWithProviders(<BoxTabs {...props} lines={[]} />)
    await waitFor(() => expect(screen.getByTestId('box-tabs-history').textContent).toMatch(/did not load|permission denied/))
    fireEvent.click(screen.getByRole('tab', { name: 'Contents' }))
    expect(document.querySelector('[data-empty-state]')?.textContent).toContain('Nothing in R70 yet.')
  })
})

describe('Fix the name', () => {
  const book: ContainerLine = { ...lines[0]!, partKey: 'id:p9', partId: 'p9', partName: 'Wax ring' }

  it('renames a typed part, reads the job again and offers its undo; a book part has no such press', async () => {
    fetchBoxNames.mockResolvedValue([])
    renamePart.mockResolvedValue({ id: 'r1', rows: 3 })
    undoPartRename.mockResolvedValue({ id: 'r2', rows: 3 })
    renderWithProviders(<BoxTabs {...props} lines={[...lines, book]} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Contents · 2' }))
    expect(screen.getAllByRole('button', { name: /^Fix the name of / })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Fix the name of Pex rolls' }))
    const press = () => screen.getByTestId('box-tabs-fix-name').querySelector('button[type=submit]') as HTMLButtonElement
    expect(press().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('The name of Pex rolls'), { target: { value: ' Pex  rolls, red ' } })
    expect(press().textContent).toBe('Rename to Pex rolls, red')
    fireEvent.click(press())
    await waitFor(() => expect(renamePart).toHaveBeenCalledWith('j1', 'Pex rolls', 'Pex rolls, red'))
    await waitFor(() => expect(screen.getByTestId('box-tabs-renamed').textContent).toContain('Pex rolls is now Pex rolls, red.'))
    expect(loadJob).toHaveBeenCalledWith('j1', { force: true })
    fireEvent.click(screen.getByRole('button', { name: 'Undo the rename' }))
    await waitFor(() => expect(undoPartRename).toHaveBeenCalledWith('j1', 'r1'))
    await waitFor(() => expect(screen.queryByTestId('box-tabs-renamed')).toBeNull())
  })

  it('says why when the database refuses', async () => {
    fetchBoxNames.mockResolvedValue([])
    renamePart.mockRejectedValue({ message: 'No typed part named Pex rolls is on this job.', code: 'P0PRN' })
    renderWithProviders(<BoxTabs {...props} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Contents · 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fix the name of Pex rolls' }))
    fireEvent.change(screen.getByLabelText('The name of Pex rolls'), { target: { value: 'Pex' } })
    fireEvent.submit(screen.getByTestId('box-tabs-fix-name'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The name did not change: No typed part named Pex rolls is on this job.'))
    expect(screen.queryByTestId('box-tabs-renamed')).toBeNull()
  })
})

describe('BoxWindow', () => {
  it('is a window named for the box and closes on its ×', async () => {
    fetchBoxNames.mockResolvedValue([])
    const onClose = vi.fn()
    renderWithProviders(<BoxWindow {...props} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'Edit R70' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(fetchBoxNames).toHaveBeenCalled())
  })
})
