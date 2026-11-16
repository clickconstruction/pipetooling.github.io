// @vitest-environment jsdom
/**
 * The job's reserved stickers on its page (v2.7487, the owner's word of 2026-11-16 that printing a sticker reserves a
 * place to be filled in later): the line over the boxes says how many are reserved and not on a box yet, which names,
 * who printed them and when, and **These are on boxes** beside **Runs** opens the form on those names. More than one
 * run is said by how many runs, and a run with no names offers no such press, since only a scan places it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

type Box = { id: string; jobId: string; label: string; kind: string; where: string; said?: string; locationId: null; lat: null; lng: null; retiredAt: string | null; createdAt: string }
const box = (id: string, label: string, kind = 'cage'): Box => ({ id, jobId: 'ja', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const NONE = { count: 0, runs: 0, span: '', names: [] as string[], anyNamed: false, printedByName: '', printedAt: '' }
const data = vi.hoisted(() => ({ boxes: [] as Box[], retired: [] as string[], unretired: [] as string[] }))
const held = vi.hoisted(() => ({ reserved: { count: 0, runs: 0, span: '', names: [] as string[], anyNamed: false, printedByName: '', printedAt: '' } }))
const movements: never[] = []

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
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), marksByBox: new Map(), blank: held.reserved.count, reserved: held.reserved, loaded: true, refresh: () => {} }) }))
// The Runs fold and These are on boxes read the job's runs and the site's names.
vi.mock('../../lib/materials/stickerRunsIo', () => ({ fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: held.reserved.names })), fetchStickerRuns: vi.fn(async () => []) }))
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
  held.reserved = NONE
})

describe('The job’s reserved stickers', () => {
  it('one run is said by its names, who printed it and when, and These are on boxes opens on those names', async () => {
    data.boxes = [box('zz1', 'ZZ1'), box('un', 'Unsorted', 'unsorted')]
    const names = Array.from({ length: 9 }, (_, i) => `ZZ${2 + i}`)
    held.reserved = { count: 9, runs: 1, span: 'ZZ2 to ZZ10', names, anyNamed: true, printedByName: 'Dana', printedAt: '2026-11-16T18:00:00Z' }
    open()
    const line = screen.getByTestId('materials-stickers-blank')
    expect(line.querySelector('span')!.textContent).toBe('9 stickers reserved and not on a box yet, ZZ2 to ZZ10. Printed Nov 16 by Dana. Scan one on the phone to say which box it is on.')
    expect(line.textContent).not.toMatch(/blank/i)
    // the press that fills them in sits beside Runs, and opens the form on the reserved names
    expect([...line.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['These are on boxes', 'Runs'])
    fireEvent.click(screen.getByTestId('materials-stickers-on-boxes'))
    expect(await screen.findByRole('dialog', { name: 'These are on boxes' })).toBeTruthy()
    await waitFor(() => expect((screen.getByTestId('on-boxes-names') as HTMLInputElement).value).toBe('ZZ2-ZZ10'))
  })

  it('more than one run says how many runs, and stickers with no name offer only the scan and the fold', () => {
    data.boxes = [box('zz1', 'ZZ1')]
    held.reserved = { ...NONE, count: 40, runs: 2, anyNamed: false }
    open()
    const line = screen.getByTestId('materials-stickers-blank')
    expect(line.querySelector('span')!.textContent).toBe('40 stickers reserved and not on a box yet, in 2 runs. Scan one on the phone to say which box it is on.')
    expect([...line.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Runs'])
  })

  it('a job with none says nothing', () => {
    data.boxes = [box('zz1', 'ZZ1')]
    open()
    expect(screen.queryByTestId('materials-stickers-blank')).toBeNull()
  })
})
