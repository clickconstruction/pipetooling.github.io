// @vitest-environment jsdom
/**
 * The Materials desk on a phone (v2.8291): three figures and one row a job, where the desk at a computer is a table
 * of seven columns. The figures and the words are held by `deskPhone.test.ts`. Here: that a phone gets the list and a
 * computer the table, that a figure narrows the list, that a row opens its job and a site's press its site, that a
 * job which did not load keeps its reason and its press, and that the row's presses the phone leaves out are still
 * on the desk at a computer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const data = vi.hoisted(() => ({ failed: {} as Record<string, string>, reread: [] as string[], movements: {} as Record<string, unknown[]>, prices: {} as Record<string, number>, siteOf: new Map<string, string | null>([['ja', 'dev1'], ['jb', 'dev1'], ['jc', null]]) }))
const box = (id: string, jobId: string, label: string) => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const containers: Record<string, unknown[]> = { ja: [box('r12', 'ja', 'R12'), box('r13', 'ja', 'R13')], jb: [box('p1', 'jb', 'P1')], jc: [box('t1', 'jc', 'T1')] }

vi.mock('../../lib/materials/onSiteStore', () => ({
  MOVEMENTS_LIMIT: 5000,
  jobIdsWithData: () => ['ja', 'jb', 'jc'],
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
  useOnSiteSites: () => ({ siteOfJob: data.siteOf, siteNames: new Map([['dev1', 'ZZ Test Ridge']]), loaded: true, failed: null, retry: () => {} }),
}))
// The site's own screen reads far more of the store than the desk does. Here it only has to be where the press lands.
vi.mock('../materials/SiteMaterialsView', () => ({ default: ({ site }: { site: { name: string } }) => <div data-testid="site-view">{site.name}</div> }))
vi.mock('../../hooks/useSiteBoxNames', () => ({ useSiteBoxNames: () => ({ rows: [], siteId: null, loaded: true }) }))
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), marksByBox: new Map(), blank: 0, reserved: { count: 0, runs: 0, span: '', names: [], anyNamed: false, printedByName: '', printedAt: '' }, toPrint: [], failed: null, retry: () => {}, refresh: () => {} }) }))
vi.mock('../../hooks/usePartTies', () => ({ usePartTies: () => ({ ties: [], available: false, failed: null, retry: () => {}, answer: async () => {}, undo: async () => {} }) }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician', user: { id: 'u1', email: 'leader@example.com' }, profileName: 'Sam' })
})

import JobsMaterialsTab from './JobsMaterialsTab'

const jobs = [
  { id: 'ja', hcp_number: '', click_number: '224', job_name: 'ZZ Test phase 2', job_address: null, google_drive_link: null },
  { id: 'jb', hcp_number: '', click_number: '1091', job_name: 'ZZ Test pump house', job_address: null, google_drive_link: null },
  { id: 'jc', hcp_number: '', click_number: '972', job_name: 'ZZ Test gas test', job_address: null, google_drive_link: null },
]

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()
const mv = (jobId: string, over: Record<string, unknown>) => ({ id: String(Math.random()), jobId, partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 0, reason: 'delivered', fromContainerId: null, toContainerId: null, note: '', byUserId: 'u1', byName: 'Sam', at: ago(1), ...over })
/** Every box counted yesterday, so no job is due a count unless a test leaves one out. */
const countedAll = (): Record<string, unknown[]> => ({
  ja: [mv('ja', { quantity: 4, reason: 'counted', fromContainerId: 'r12', at: ago(24) }), mv('ja', { quantity: 4, reason: 'counted', fromContainerId: 'r13', at: ago(24) })],
  jb: [mv('jb', { quantity: 2, reason: 'counted', fromContainerId: 'p1', at: ago(24) })],
  jc: [mv('jc', { quantity: 1, reason: 'counted', fromContainerId: 't1', at: ago(24) })],
})

/** Where the page stands, read off the router: a row's press and a site's press both write the address. */
function Where() {
  const loc = useLocation()
  return <output data-testid="where">{loc.search}</output>
}
const draw = (phone: boolean) => renderWithProviders(<><JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} rowDoors={{ onLabels: () => {} }} role="master_technician" phone={phone} /><Where /></>, { route: '/materials?tab=on-site' })
const rows = () => [...document.querySelectorAll('[data-desk-phone-row]')].map((r) => r.getAttribute('data-desk-phone-row'))
const tiles = () => [...document.querySelectorAll('[data-testid="flow-tiles"] button')] as HTMLButtonElement[]

afterEach(() => {
  cleanup()
  data.failed = {}
  data.reread.length = 0
  data.movements = {}
  data.prices = {}
})

describe('the Materials desk · a phone and a computer', () => {
  it('a computer keeps the table, with each row’s Labels and Open on the phone screen', () => {
    data.movements = countedAll()
    draw(false)
    expect(document.querySelector('[data-testid="materials-desk-phone"]')).toBeNull()
    expect(document.querySelector('table')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Materials desk' })).toBeTruthy()
    expect(screen.getAllByText('Open on the phone screen').length).toBe(3)
    expect(screen.getByText('Move everything on site to another job…')).toBeTruthy()
  })

  it('a phone gets three figures and a row a job, and no table', () => {
    data.movements = countedAll()
    draw(true)
    expect(document.querySelector('[data-testid="materials-desk-phone"]')).toBeTruthy()
    expect(document.querySelector('table')).toBeNull()
    expect(tiles().map((t) => t.textContent)).toEqual(['4Boxes on site', '0Due a count', '$0Missing this week'])
    expect(rows()).toEqual(['ja', 'jb', 'jc'])
    // The desk's own words for a row's doors are not drawn: the row is the press, and Labels is in the job's Print sheet.
    expect(screen.queryByText('Open on the phone screen')).toBeNull()
    expect(screen.queryByText('Labels')).toBeNull()
    expect(screen.queryByText('Move everything on site to another job…')).toBeNull()
  })

  it('a site heads its jobs with its boxes and Whole site, and the job on no site sits under Not on a site', () => {
    data.movements = countedAll()
    draw(true)
    const site = document.querySelector('[data-desk-phone-section="site:dev1"]')!
    expect(site.querySelector('h3')!.textContent).toBe('ZZ Test Ridge · 3 boxes')
    expect([...site.querySelectorAll('[data-desk-phone-row]')].map((r) => r.textContent)).toEqual([
      '224ZZ Test phase 22 boxes · all counted this fortnight›',
      '1091ZZ Test pump house1 box · all counted this fortnight›',
    ])
    const loose = document.querySelector('[data-desk-phone-section="loose"]')!
    expect(loose.querySelector('h3')!.textContent).toBe('Not on a site')
    expect(loose.querySelector('[data-site-row]')).toBeNull()
  })
})

describe('the Materials desk on a phone · what a row says and does', () => {
  it('a job with a box due a count is marked and names the box, in the desk’s words', () => {
    // R13 holds a part and was never counted: it is due. (An empty box is due nowhere since #398, so the part is what makes it due.)
    data.movements = { ...countedAll(), ja: [mv('ja', { quantity: 4, reason: 'counted', fromContainerId: 'r12', at: ago(24) }), mv('ja', { quantity: 6, reason: 'delivered', toContainerId: 'r13', at: ago(48) })] }
    draw(true)
    const row = document.querySelector('[data-desk-phone-row="ja"]')!
    expect(row.hasAttribute('data-marked')).toBe(true)
    expect(row.querySelector('[data-desk-phone-need]')!.textContent).toBe('R13 due a count')
    expect(row.textContent).toContain('2 boxes')
    expect(row.textContent).not.toContain('all counted this fortnight')
    expect(document.querySelector('[data-desk-phone-row="jb"]')!.hasAttribute('data-marked')).toBe(false)
    expect(tiles()[1]!.textContent).toBe('1Due a count')
  })

  it('a short count is on the row and in the third figure', () => {
    // Ten came in two days ago and yesterday's count found seven: three short, at four dollars each.
    data.prices = { 'zz test elbow': 4 }
    data.movements = { ...countedAll(), jc: [mv('jc', { quantity: 10, reason: 'delivered', toContainerId: 't1', at: ago(48) }), mv('jc', { quantity: 7, reason: 'counted', fromContainerId: 't1', at: ago(24) })] }
    draw(true)
    const need = document.querySelector('[data-desk-phone-row="jc"] [data-desk-phone-need]')!
    expect(need.textContent).toMatch(/missing this week · 1 line/i)
    expect(tiles()[2]!.textContent).toMatch(/(Missing|Short) this week$/)
    expect(tiles()[2]!.getAttribute('aria-disabled')).toBeNull()
  })

  it('the whole row opens its job', () => {
    data.movements = countedAll()
    draw(true)
    fireEvent.click(screen.getByRole('button', { name: 'Open 1091 · ZZ Test pump house' }))
    expect(screen.getByTestId('where').textContent).toContain('job=jb')
  })

  it('Whole site opens the site’s screen', () => {
    data.movements = countedAll()
    draw(true)
    fireEvent.click(screen.getByRole('button', { name: 'Whole site: ZZ Test Ridge' }))
    expect(screen.getByTestId('where').textContent).toContain('site=dev1')
    expect(screen.getByTestId('site-view').textContent).toBe('ZZ Test Ridge')
  })

  it('a job that did not load is no press: it says why and offers Read again', () => {
    data.movements = countedAll()
    data.failed = { jb: 'No connection. Check your signal.' }
    draw(true)
    const row = document.querySelector('[data-job-not-loaded="jb"]')!
    expect(row.tagName).toBe('DIV')
    expect(row.textContent).toContain('Did not load. No connection. Check your signal.')
    expect(row.textContent).not.toContain('boxes')
    expect(document.querySelector('[data-desk-phone-section="site:dev1"] h3')!.textContent).toContain('1 job did not load')
    fireEvent.click(screen.getByRole('button', { name: 'Read 1091 · ZZ Test pump house again' }))
    expect(data.reread).toEqual(['jb again'])
  })
})

describe('the Materials desk on a phone · the figures narrow the list', () => {
  it('Due a count keeps the jobs with a box due, and a second press brings every job back', () => {
    // R13 holds a part and was never counted (#398: an empty box would be due nowhere).
    data.movements = { ...countedAll(), ja: [mv('ja', { quantity: 4, reason: 'counted', fromContainerId: 'r12', at: ago(24) }), mv('ja', { quantity: 6, reason: 'delivered', toContainerId: 'r13', at: ago(48) })] }
    draw(true)
    expect(tiles().map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    fireEvent.click(tiles()[1]!)
    expect(rows()).toEqual(['ja'])
    expect(tiles().map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    expect(document.querySelector('[data-desk-phone-section="loose"]')).toBeNull()
    fireEvent.click(tiles()[1]!)
    expect(rows()).toEqual(['ja', 'jb', 'jc'])
  })

  it('Boxes on site brings every job back too', () => {
    data.movements = { ...countedAll(), ja: [mv('ja', { quantity: 4, reason: 'counted', fromContainerId: 'r12', at: ago(24) })] }
    draw(true)
    fireEvent.click(tiles()[1]!)
    fireEvent.click(tiles()[0]!)
    expect(rows()).toEqual(['ja', 'jb', 'jc'])
  })

  it('a figure with nothing behind it is dead', () => {
    data.movements = countedAll()
    draw(true)
    expect(tiles()[1]!.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(tiles()[1]!)
    expect(rows()).toEqual(['ja', 'jb', 'jc'])
    expect(tiles().map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
  })
})

describe('the Materials desk on a phone · Open a job', () => {
  it('is one press that says its own name, under the list', () => {
    data.movements = countedAll()
    draw(true)
    const pick = document.querySelector('[data-testid="materials-open-job"] button')!
    expect(pick.textContent).toContain('Open a job')
    const list = document.querySelector('[data-testid="materials-desk-phone"]')!
    expect(list.compareDocumentPosition(pick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
