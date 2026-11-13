// @vitest-environment jsdom
/**
 * The materials desk when a job's own read failed (punch list #344, PR 3, v2.7175): its row says so with the reason
 * and a press that reads it again, in place of figures that would read as a job with nothing on site, and its site's
 * row counts it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const data = vi.hoisted(() => ({ failed: {} as Record<string, string>, reread: [] as string[] }))
const box = (id: string, jobId: string, label: string) => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const containers: Record<string, unknown[]> = { ja: [box('r12', 'ja', 'R12')], jb: [box('p1', 'jb', 'P1')] }

vi.mock('../../lib/materials/onSiteStore', () => ({
  MOVEMENTS_LIMIT: 5000,
  jobIdsWithData: () => ['ja', 'jb'],
  // A job whose read failed holds nothing in the cache, which is what used to draw as zeros.
  listContainers: (id: string) => (data.failed[id] ? [] : containers[id] ?? []),
  listMovements: () => [],
  listPlaces: () => [],
  listPhotos: () => [],
  serverSummary: () => null,
  jobLedgerCapped: () => false,
  priceOf: () => null,
  priceFor: () => null,
  bookPricesState: () => ({ error: null, loading: false }),
  retryBookPrices: async () => {},
  loadBookPrices: async () => {},
  setOnSiteErrorHandler: () => {},
  subscribe: () => () => {},
  getVersion: () => 0,
  jobLoadState: (id: string) => ({ loaded: !data.failed[id], loading: false, error: data.failed[id] ?? null, raw: null }),
  loadJob: (id: string, opts?: { force?: boolean }) => {
    data.reread.push(`${id}${opts?.force ? ' again' : ''}`)
    return Promise.resolve()
  },
}))
vi.mock('../../hooks/useOnSiteStore', () => ({
  useOnSiteDesk: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteJob: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteStoreVersion: () => 0,
}))
vi.mock('../../hooks/useOnSiteSites', () => ({
  useOnSiteSites: () => ({ siteOfJob: new Map([['ja', 'dev1'], ['jb', 'dev1']]), siteNames: new Map([['dev1', 'ZZ Test Ridge']]), loaded: true, failed: null, retry: () => {} }),
}))
vi.mock('../../hooks/usePartTies', () => ({ usePartTies: () => ({ ties: [], available: false, failed: null, retry: () => {}, answer: async () => {}, undo: async () => {} }) }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant', user: { id: 'u1', email: 'office@example.com' }, profileName: 'Sam' })
})

import JobsMaterialsTab from './JobsMaterialsTab'

const jobs = [
  { id: 'ja', hcp_number: '', click_number: '224', job_name: 'ZZ Test phase 2', job_address: null, google_drive_link: null },
  { id: 'jb', hcp_number: '', click_number: '1091', job_name: 'ZZ Test pump house', job_address: null, google_drive_link: null },
]

afterEach(() => {
  cleanup()
  data.failed = {}
  data.reread.length = 0
})

describe('the materials desk, a job whose read failed', () => {
  it('draws every job’s figures when every read went through', () => {
    renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} />, { route: '/materials?tab=on-site' })
    expect(document.querySelector('[data-job-not-loaded]')).toBeNull()
    expect(document.querySelector('[data-site-row="dev1"]')!.textContent).not.toContain('did not load')
  })

  it('says the job did not load, with its reason and a press that reads it again, and the site row counts it', () => {
    data.failed = { jb: 'No connection. Check your signal.' }
    renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} />, { route: '/materials?tab=on-site' })
    const row = document.querySelector('[data-job-not-loaded="jb"]')!
    expect(row.textContent).toContain('1091 · ZZ Test pump house')
    expect(row.textContent).toContain('Did not load. No connection. Check your signal.')
    // No figure stands in for it: a zero would read as a job with nothing on site.
    expect(row.textContent).not.toContain('$0.00')
    expect(row.textContent).not.toContain('all this fortnight')
    expect(document.querySelector('[data-site-row="dev1"]')!.textContent).toContain('1 job did not load')
    fireEvent.click(screen.getByRole('button', { name: 'Read 1091 · ZZ Test pump house again' }))
    expect(data.reread).toEqual(['jb again'])
    // The job that did load keeps its row.
    expect(document.querySelector('[data-job-not-loaded="ja"]')).toBeNull()
  })
})
