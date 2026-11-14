// @vitest-environment jsdom
/**
 * The materials desk when a job's own read failed (punch list #344, PR 3, v2.7175): its row says so with the reason
 * and a press that reads it again, in place of figures that would read as a job with nothing on site, and its site's
 * row counts it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const data = vi.hoisted(() => ({ failed: {} as Record<string, string>, reread: [] as string[], raw: null as unknown, movements: {} as Record<string, unknown[]>, prices: {} as Record<string, number> }))
const box = (id: string, jobId: string, label: string) => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const containers: Record<string, unknown[]> = { ja: [box('r12', 'ja', 'R12')], jb: [box('p1', 'jb', 'P1')] }

vi.mock('../../lib/materials/onSiteStore', () => ({
  MOVEMENTS_LIMIT: 5000,
  jobIdsWithData: () => ['ja', 'jb'],
  // A job whose read failed holds nothing in the cache, which is what used to draw as zeros.
  listContainers: (id: string) => (data.failed[id] ? [] : containers[id] ?? []),
  listMovements: (id: string) => data.movements[id] ?? [],
  listPlaces: () => [],
  listPhotos: () => [],
  serverSummary: () => null,
  jobLedgerCapped: () => false,
  priceOf: () => null,
  priceOfJob: (_jobId: string, key: string) => data.prices[key] ?? null,
  priceFor: () => null,
  bookPricesState: () => ({ error: null, loading: false }),
  retryBookPrices: async () => {},
  loadBookPrices: async () => {},
  setOnSiteErrorHandler: () => {},
  subscribe: () => () => {},
  getVersion: () => 0,
  jobLoadState: (id: string) => ({ loaded: !data.failed[id], loading: false, error: data.failed[id] ?? null, raw: data.failed[id] ? data.raw : null }),
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
  data.raw = null
  data.movements = {}
  data.prices = {}
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

  it('a lost signal reads the read’s own sentence, never that nothing was saved', () => {
    data.failed = { jb: 'No connection — the app couldn’t reach the server, so nothing was saved.' }
    data.raw = new TypeError('Failed to fetch')
    renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} />, { route: '/materials?tab=on-site' })
    const row = document.querySelector('[data-job-not-loaded="jb"]')!
    expect(row.textContent).toContain('Did not load. No connection, so this could not load. Nothing was lost. It loads again when the signal is back.')
    expect(row.textContent).not.toContain('nothing was saved')
  })
})

describe('the materials desk, a short count of a part with no price (v2.7246)', () => {
  const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()
  const mv = (over: Record<string, unknown>) => ({ id: String(Math.random()), jobId: 'ja', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 0, reason: 'delivered', fromContainerId: null, toContainerId: null, note: '', byUserId: null, byName: 'Sam', at: ago(1), source: null, itemId: null, ...over })
  // Ten came in two days ago, and yesterday's count found seven: three short, of a typed name.
  const short = [mv({ quantity: 10, reason: 'delivered', toContainerId: 'r12', at: ago(48) }), mv({ quantity: 7, reason: 'counted', fromContainerId: 'r12', at: ago(24) })]
  const render = () => renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} />, { route: '/materials?tab=on-site' })
  const rowOf = (label: string) => [...document.querySelectorAll('tr')].find((tr) => tr.textContent?.includes(label))!

  it('says the line came up short and has no price, beside a $0.00 that would read as nothing missing', () => {
    data.movements = { ja: short }
    render()
    const row = rowOf('224 · ZZ Test phase 2')
    expect(row.textContent).toContain('$0.00')
    expect(row.querySelector('[data-missing-note]')!.textContent).toBe('1 line, with no price')
    // The job is amber and its site's row carries the same note, though no money moved.
    expect(row.getAttribute('style') ?? '').toContain('--bg-amber-100')
    expect(document.querySelector('[data-site-row="dev1"] [data-missing-note]')!.textContent).toBe('1 line, with no price')
    // The other job has nothing short, and says nothing.
    expect(rowOf('1091 · ZZ Test pump house').querySelector('[data-missing-note]')).toBeNull()
  })

  it('counts the line plainly when it has a price, with the money beside it', () => {
    data.movements = { ja: short }
    data.prices = { 'text:zz test elbow': 2.5 }
    render()
    const row = rowOf('224 · ZZ Test phase 2')
    expect(row.textContent).toContain('$7.50')
    expect(row.querySelector('[data-missing-note]')!.textContent).toBe('1 line')
  })
})
