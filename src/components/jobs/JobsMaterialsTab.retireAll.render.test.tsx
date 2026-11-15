// @vitest-environment jsdom
/**
 * Retire every box on this job (v2.7303, the owner's ask of 2026-11-14): the press under a job's boxes counts the empty
 * ones and names the box with parts beside it, the confirm window lists what goes and what stays with the verb on its
 * button, the writes go one box at a time through `retireContainer`, and the toast carries Undo for a minute that
 * brings every retired box back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

type Box = { id: string; jobId: string; label: string; kind: string; where: string; locationId: null; lat: null; lng: null; retiredAt: string | null; createdAt: string }
const box = (id: string, label: string, kind = 'cage'): Box => ({ id, jobId: 'ja', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const data = vi.hoisted(() => ({
  boxes: [] as Box[],
  retired: [] as string[],
  unretired: [] as string[],
}))
const movements = [
  { id: 'm1', jobId: 'ja', partId: null, partName: 'Test elbow', manufacturer: null, quantity: 8, reason: 'delivered', fromContainerId: null, toContainerId: 'zz1', note: '', byUserId: 'u1', byName: 'Robert', at: '2026-11-08T15:00:00Z', source: null, itemId: null },
]

vi.mock('../../lib/materials/onSiteStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/materials/onSiteStore')>()),
  jobIdsWithData: () => ['ja'],
  listContainers: () => data.boxes,
  listMovements: () => movements,
  listPlaces: () => [],
  listPhotos: () => [],
  serverSummary: () => null,
  jobLedgerCapped: () => false,
  loadJob: () => Promise.resolve(),
  loadBookPrices: async () => {},
  jobLoadState: () => ({ loaded: true, loading: false, error: null, raw: null }),
  retireContainer: (id: string) => {
    if (id === 'bad') throw new Error('The office said no.')
    data.retired.push(id)
    data.boxes = data.boxes.map((b) => (b.id === id ? { ...b, retiredAt: '2026-11-14T20:00:00Z' } : b))
  },
  unretireContainer: (id: string) => {
    data.unretired.push(id)
    data.boxes = data.boxes.map((b) => (b.id === id ? { ...b, retiredAt: null } : b))
  },
}))
vi.mock('../../hooks/useOnSiteStore', () => ({
  useOnSiteDesk: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteJob: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteStoreVersion: () => 0,
}))
vi.mock('../../hooks/useOnSiteSites', () => ({ useOnSiteSites: () => ({ siteOfJob: new Map(), siteNames: new Map(), loaded: true, failed: null, retry: () => {} }) }))
vi.mock('../../hooks/useSiteBoxNames', () => ({ useSiteBoxNames: () => ({ rows: [], siteId: null, loaded: true }) }))
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), blank: 0, loaded: true, refresh: () => {} }) }))
vi.mock('../../hooks/usePartTies', () => ({ usePartTies: () => ({ ties: [], available: false, failed: null, retry: () => {}, answer: async () => {}, undo: async () => {} }) }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant', user: { id: 'u1', email: 'office@example.com' }, profileName: 'Sam' })
})

import JobsMaterialsTab from './JobsMaterialsTab'

const jobs = [{ id: 'ja', hcp_number: '', click_number: '1111', job_name: 'ZZ Test bio walk', job_address: null, google_drive_link: null }]

const open = () => renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} />, { route: '/materials?tab=on-site&job=ja' })

afterEach(() => {
  cleanup()
  data.retired.length = 0
  data.unretired.length = 0
})

describe('Retire every box on this job', () => {
  it('counts the empty boxes, names the held one, lists both in the window, retires one box at a time and brings them back on Undo', async () => {
    data.boxes = [box('zz1', 'ZZ1'), box('zz2', 'ZZ2', 'box'), box('zz4', 'ZZ4'), box('un', 'Unsorted', 'unsorted')]
    open()
    const press = screen.getByTestId('retire-all') as HTMLButtonElement
    expect(press.textContent).toBe('Retire 2 empty boxes · 1 holds parts ▸')
    expect(press.disabled).toBe(false)
    expect(screen.getByTestId('retire-all-foot').textContent).toBe('1 is held. It stays here with the reason. The 2 ready ones retire now.')
    fireEvent.click(press)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('Retire every box on this job?')
    expect(dialog.textContent).toContain('ZZ2 box')
    expect(dialog.textContent).toContain('ZZ4 cage')
    expect(dialog.textContent).toContain('ZZ1 holds 8 Test elbow.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retire 2 empty boxes' }))
    await waitFor(() => expect(data.retired).toEqual(['zz2', 'zz4']))
    expect(await screen.findByText('Retired 2 boxes. ZZ1 stays with its parts.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(data.unretired).toEqual(['zz2', 'zz4'])
    expect(await screen.findByText('2 boxes are back on the job. Their labels work again.')).toBeTruthy()
  })

  it('is dead with its reason when every box holds parts', () => {
    data.boxes = [box('zz1', 'ZZ1'), box('un', 'Unsorted', 'unsorted')]
    open()
    const press = screen.getByTestId('retire-all') as HTMLButtonElement
    expect(press.textContent).toBe('Retire ▸')
    expect(press.disabled).toBe(true)
    expect(screen.getByTestId('retire-all-foot').textContent).toBe('ZZ1 still holds parts. Move them or mark them used first.')
  })

  it('keeps going past a box that fails and names it with its reason', async () => {
    data.boxes = [box('zz2', 'ZZ2', 'box'), box('bad', 'ZZ9')]
    open()
    fireEvent.click(screen.getByTestId('retire-all'))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Retire 2 empty boxes' }))
    await waitFor(() => expect(data.retired).toEqual(['zz2']))
    expect(await screen.findByText('Retired 1 box. 1 did not retire. ZZ9 did not retire: The office said no.')).toBeTruthy()
  })

  it('draws no row when the job has no live box', () => {
    data.boxes = [box('un', 'Unsorted', 'unsorted')]
    open()
    expect(screen.queryByTestId('retire-all-row')).toBeNull()
  })
})
