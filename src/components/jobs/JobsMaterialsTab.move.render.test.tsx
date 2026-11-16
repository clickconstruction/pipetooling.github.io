// @vitest-environment jsdom
/**
 * Move everything on site to another job (punch list #209, v2.7305): the quiet press under a job's boxes and on the
 * desk's site row when two of its jobs hold boxes, live for the roles that may combine two jobs and dead with its
 * reason for the rest.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const box = (id: string, jobId: string, label: string) => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const containers: Record<string, unknown[]> = { ja: [box('r12', 'ja', 'R12')], jb: [box('p1', 'jb', 'P1')], jc: [box('z1', 'jc', 'ZZ1')] }

vi.mock('../../lib/materials/onSiteStore', () => ({
  MOVEMENTS_LIMIT: 5000,
  jobIdsWithData: () => ['ja', 'jb', 'jc'],
  listContainers: (id: string) => containers[id] ?? [],
  listMovements: () => [],
  listPlaces: () => [],
  listPhotos: () => [],
  serverSummary: () => null,
  jobLedgerCapped: () => false,
  priceOf: () => null,
  priceOfJob: () => null,
  priceFor: () => null,
  priceForJob: () => null,
  bookPricesState: () => ({ error: null, loading: false }),
  retryBookPrices: async () => {},
  loadBookPrices: async () => {},
  setOnSiteErrorHandler: () => {},
  subscribe: () => () => {},
  getVersion: () => 0,
  jobLoadState: () => ({ loaded: true, loading: false, error: null, raw: null }),
  loadJob: async () => {},
  loadDesk: async () => [],
  unsortedContainer: () => box('u', 'ja', 'Unsorted'),
}))
vi.mock('../../hooks/useOnSiteStore', () => ({
  useOnSiteDesk: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteJob: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteStoreVersion: () => 0,
}))
vi.mock('../../hooks/useOnSiteSites', () => ({
  useOnSiteSites: () => ({ siteOfJob: new Map([['ja', 'dev1'], ['jb', 'dev1'], ['jc', null]]), siteNames: new Map([['dev1', 'ZZ Test Ridge']]), loaded: true, failed: null, retry: () => {} }),
}))
vi.mock('../../hooks/useSiteBoxNames', () => ({ useSiteBoxNames: () => ({ rows: [], siteId: null, loaded: true }) }))
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), marksByBox: new Map(), blank: 0, reserved: { count: 0, runs: 0, span: '', names: [], anyNamed: false, printedByName: '', printedAt: '' }, loaded: true, refresh: () => {} }) }))
vi.mock('../../hooks/usePartTies', () => ({ usePartTies: () => ({ ties: [], available: false, failed: null, retry: () => {}, answer: async () => {}, undo: async () => {} }) }))
vi.mock('../../lib/materials/boxPhotoRefileIo', () => ({
  subscribeRefile: () => () => {},
  refileVersion: () => 0,
  refileJobState: () => ({ marks: [], seenMost: 0, asking: false }),
  refreshRefileMarks: async () => [],
  runBoxPhotoRefile: async () => {},
  afterCombineBoxPhotos: async () => '',
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant', user: { id: 'u1', email: 'office@example.com' }, profileName: 'Sam' })
})

import JobsMaterialsTab from './JobsMaterialsTab'

const jobs = [
  { id: 'ja', hcp_number: '', click_number: '224', job_name: 'ZZ Test phase 2', job_address: null, google_drive_link: null },
  { id: 'jb', hcp_number: '', click_number: '1091', job_name: 'ZZ Test pump house', job_address: null, google_drive_link: null },
  { id: 'jc', hcp_number: '', click_number: '1111', job_name: 'ZZ Test bio walk', job_address: null, google_drive_link: null },
]

afterEach(cleanup)

describe('the whole-job move’s press', () => {
  it('sits on the desk’s site row when two of its jobs hold boxes, and opens the window on the site’s jobs', () => {
    renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} role="assistant" />, { route: '/materials?tab=on-site' })
    const press = screen.getByTestId('materials-site-move-job') as HTMLButtonElement
    expect(press.textContent).toBe('Move everything on site to another job…')
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    const pick = screen.getByTestId('move-job-source-pick')
    expect(pick.textContent).toContain('224')
    expect(pick.textContent).toContain('1091')
    expect(pick.textContent).not.toContain('1111')
  })

  it('is dead with its reason for a role that may not combine', () => {
    renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} role="estimator" />, { route: '/materials?tab=on-site' })
    const press = screen.getByTestId('materials-site-move-job') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.getAttribute('aria-label')).toContain('Only a dev, a master technician, an assistant or a controller')
  })

  it('sits under a job’s boxes and opens the window on that job, the same site’s job offered first', () => {
    renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} role="controller" />, { route: '/materials?tab=on-site&job=ja' })
    const press = screen.getByTestId('materials-move-job') as HTMLButtonElement
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    expect(screen.getByTestId('move-job-source').textContent).toContain('224')
    expect(screen.getByTestId('move-job-same-site').textContent).toContain('1091')
    expect(screen.getByTestId('move-job-same-site').textContent).not.toContain('1111')
  })

  it('is dead under the boxes for a primary, with the reason beside it', () => {
    renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} role="primary" />, { route: '/materials?tab=on-site&job=ja' })
    const press = screen.getByTestId('materials-move-job') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.parentElement?.textContent).toContain('Only a dev, a master technician, an assistant or a controller moves a job’s material to another job.')
  })
})
