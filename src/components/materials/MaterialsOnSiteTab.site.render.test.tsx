// @vitest-environment jsdom
/**
 * Render smoke for the site row on Materials → On site (punch list #330), the field roles' door:
 * a superintendent gets a row for the whole site over their jobs and **Open the site** draws the
 * site's screen with no money and the phone screen as each box's door; an estimator gets no site
 * row. The live walk could not cover these: the sample accounts are on no job with a box.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { makeUseAuthValue, renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, Movement } from '../../lib/materials/onSite'
import { containerLines } from '../../lib/materials/onSite'
import MaterialsOnSiteTab from './MaterialsOnSiteTab'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => makeUseAuthValue({ role: 'superintendent' }),
  useOptionalAuth: () => makeUseAuthValue({ role: 'superintendent' }),
}))
vi.mock('../../contexts/JobDetailModalContext', () => ({ useJobDetailModal: () => null }))

// A made-up site, Juniper Ridge, with two jobs the viewer is on, and one job on no site.
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
const box = (id: string, jobId: string, label: string): Container => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: ago(30) })
const delivered = (id: string, jobId: string, name: string, quantity: number, to: string): Movement => ({ id, jobId, partId: null, partName: name, manufacturer: null, quantity, reason: 'delivered', fromContainerId: null, toContainerId: to, note: '', byUserId: null, byName: 'Priya', at: ago(2), source: null, itemId: null })

const data = vi.hoisted(() => ({ containers: {} as Record<string, unknown[]>, movements: {} as Record<string, unknown[]>, failed: {} as Record<string, string>, reread: [] as string[] }))
data.containers = { ja: [box('r12', 'ja', 'R12')], jb: [box('p1', 'jb', 'P1')], jc: [box('a1', 'jc', 'A1')] }
data.movements = { ja: [delivered('m1', 'ja', '2" 90 pvc', 94, 'r12')], jb: [delivered('m2', 'jb', '2 inch 90 PVC', 28, 'p1')], jc: [delivered('m3', 'jc', 'Wax ring', 6, 'a1')] }

vi.mock('../../lib/materials/onSiteStore', () => ({
  listContainers: (id: string) => data.containers[id] ?? [],
  listPlaces: () => [],
  listMovements: (id: string) => data.movements[id] ?? [],
  serverSummary: () => null,
  priceOf: () => null,
  priceFor: () => null,
  loadBookPrices: async () => {},
  setScopeTies: () => {},
  // How each job's own read stands (v2.7175): a job whose read failed is said over the site's screen.
  subscribe: () => () => {},
  getVersion: () => 0,
  jobLoadState: (id: string) => ({ loaded: !data.failed[id], loading: false, error: data.failed[id] ?? null, raw: data.failed[id] ? new TypeError('Failed to fetch') : null }),
  loadJob: (id: string, opts?: { force?: boolean }) => {
    data.reread.push(`${id}${opts?.force ? ' again' : ''}`)
    return Promise.resolve()
  },
}))
vi.mock('../../hooks/useOnSiteDeskJobs', () => ({
  useOnSiteDeskJobs: () => ({
    jobs: (['ja', 'jb', 'jc'] as const).map((id) => ({ jobId: id, label: { ja: 'J1042 · Juniper Ridge, phase 2', jb: 'J1057 · Juniper Ridge pump house', jc: 'J0988 · Alder Court remodel' }[id], containers: data.containers[id] as Container[], lines: containerLines(data.movements[id] as Movement[]), places: [] })),
    rows: [],
    loading: false,
    loaded: true,
    error: null,
    raw: null,
    retry: () => {},
  }),
}))
// The answers table (PR 3): a field role reads the joins and is asked nothing.
vi.mock('../../lib/materials/partTiesIo', () => ({ fetchPartTies: async () => [], insertPartTie: vi.fn(), deletePartTie: vi.fn() }))
vi.mock('../../hooks/useOnSiteSites', () => ({
  useOnSiteSites: () => ({ siteOfJob: new Map([['ja', 'dev1'], ['jb', 'dev1'], ['jc', null]]), siteNames: new Map([['dev1', 'Juniper Ridge']]), loaded: true }),
}))

function setup(role: string) {
  renderWithProviders(<MaterialsOnSiteTab active role={role} userId="u1" userName="Sam" onLabels={() => {}} />, { route: '/materials?tab=on-site' })
}

describe('MaterialsOnSiteTab, the site row for a field role', () => {
  it('a superintendent gets the whole site as a row over their jobs, and Open the site draws its screen with no money', () => {
    setup('superintendent')
    const siteRow = document.querySelector('[data-site-row="dev1"]')!
    expect(siteRow.textContent).toContain('Juniper Ridge')
    expect(siteRow.textContent).toContain('the whole site, 2 jobs')
    expect(screen.getAllByRole('link', { name: 'Open the boxes' })).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Open the site' }))
    expect(screen.getByTestId('site-materials-view')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Juniper Ridge' })).toBeTruthy()
    // The same words across the two jobs are one row; the job on no site is not on it.
    expect(document.querySelectorAll('[data-site-part-row]')).toHaveLength(1)
    expect(screen.queryByText('Wax ring')).toBeNull()
    expect(screen.queryByText(/\$\d/)).toBeNull()
    expect(screen.queryByRole('searchbox', { name: 'Find a part or a box on any job' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /2" 90 pvc/ }))
    expect(screen.getByRole('link', { name: 'R12' }).getAttribute('href')).toBe('/tally?tab=on-site&job=ja&container=r12')
    fireEvent.click(screen.getByRole('button', { name: 'Back to On site' }))
    expect(screen.queryByTestId('site-materials-view')).toBeNull()
  })

  it('a job whose read failed is said over the site’s screen, and Retry reads that job again', () => {
    data.failed = { jb: 'No connection. Check your signal.' }
    data.reread.length = 0
    try {
      setup('superintendent')
      fireEvent.click(screen.getByRole('button', { name: 'Open the site' }))
      expect(screen.getByText('1 of this site’s 2 jobs did not load. Its boxes are not on this screen, and the figures leave them out.')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
      expect(data.reread).toContain('jb again')
      expect(data.reread).not.toContain('ja again')
    } finally {
      data.failed = {}
    }
  })

  it('an estimator gets their jobs and no site row', () => {
    setup('estimator')
    expect(document.querySelector('[data-site-row]')).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Open the boxes' })).toHaveLength(3)
  })
})
