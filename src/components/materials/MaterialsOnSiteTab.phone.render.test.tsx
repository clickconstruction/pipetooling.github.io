// @vitest-environment jsdom
/**
 * Materials → On site for a field role on a phone (v2.8291): a superintendent, a primary and an estimator get their
 * jobs with boxes as the office's phone desk draws them, with no money. Two figures, one row a job that opens the
 * job's boxes on the Tally, and a site's heading with Whole site for the roles that read a site. At a computer the
 * table stays. The live walk cannot cover this: the sample accounts are on no job with a box.
 *
 * The search over the list, *Find a part or a box on any job*, draws its hits as rows on a phone for every role: a
 * field role's row opens the box, as the table's Open the box does, and the office's opens the box on the Tally's
 * screen, where the table opens the job.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { makeUseAuthValue, renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, Movement } from '../../lib/materials/onSite'
import { containerLines } from '../../lib/materials/onSite'
import MaterialsOnSiteTab from './MaterialsOnSiteTab'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => makeUseAuthValue({ role: 'superintendent' }),
  useOptionalAuth: () => makeUseAuthValue({ role: 'superintendent' }),
}))
vi.mock('../../contexts/JobDetailModalContext', () => ({ useJobDetailModal: () => null }))

// A made-up site, ZZ Test Ridge, with two jobs the viewer is on, and one job on no site.
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
const box = (id: string, jobId: string, label: string): Container => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: ago(30) })
const move = (id: string, jobId: string, reason: Movement['reason'], quantity: number, boxId: string, days: number): Movement => ({ id, jobId, partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity, reason, fromContainerId: reason === 'counted' ? boxId : null, toContainerId: reason === 'delivered' ? boxId : null, note: '', byUserId: 'u1', byName: 'Sam', at: ago(days) }) as Movement

const data = vi.hoisted(() => ({ containers: {} as Record<string, unknown[]>, movements: {} as Record<string, unknown[]> }))
data.containers = { ja: [box('r12', 'ja', 'R12'), box('r13', 'ja', 'R13')], jb: [box('p1', 'jb', 'P1')], jc: [box('a1', 'jc', 'A1')] }
// R12 and A1 were counted yesterday. R13 and P1 never were, so they are due.
data.movements = {
  ja: [move('m1', 'ja', 'delivered', 9, 'r12', 3), move('m2', 'ja', 'counted', 9, 'r12', 1), move('m3', 'ja', 'delivered', 4, 'r13', 3)],
  jb: [move('m4', 'jb', 'delivered', 2, 'p1', 3)],
  jc: [move('m5', 'jc', 'delivered', 6, 'a1', 3), move('m6', 'jc', 'counted', 6, 'a1', 1)],
}

vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), marksByBox: new Map(), blank: 0, reserved: { count: 0, runs: 0, span: '', names: [], anyNamed: false, printedByName: '', printedAt: '' }, toPrint: [], failed: null, retry: () => {}, refresh: () => {} }) }))
vi.mock('../../lib/materials/onSiteStore', () => ({
  listContainers: (id: string) => data.containers[id] ?? [],
  listPlaces: () => [],
  listMovements: (id: string) => data.movements[id] ?? [],
  serverSummary: () => null,
  priceOf: () => null,
  priceOfJob: () => null,
  priceFor: () => null,
  loadBookPrices: async () => {},
  setScopeTies: () => {},
  subscribe: () => () => {},
  getVersion: () => 0,
  jobLoadState: () => ({ loaded: true, loading: false, error: null, raw: null }),
  loadJob: () => Promise.resolve(),
}))
const NAMES: Record<string, { number: string; name: string }> = { ja: { number: '224', name: 'ZZ Test phase 2' }, jb: { number: '1091', name: 'ZZ Test pump house' }, jc: { number: '972', name: 'ZZ Test gas test' } }
vi.mock('../../hooks/useOnSiteDeskJobs', () => ({
  useOnSiteDeskJobs: () => ({
    jobs: (['ja', 'jb', 'jc'] as const).map((id) => ({ jobId: id, label: `${NAMES[id]!.number} · ${NAMES[id]!.name}`, number: NAMES[id]!.number, name: NAMES[id]!.name, containers: data.containers[id] as Container[], lines: containerLines(data.movements[id] as Movement[]), places: [] })),
    rows: [],
    loading: false,
    loaded: true,
    error: null,
    raw: null,
    retry: () => {},
  }),
}))
vi.mock('../../lib/materials/partTiesIo', () => ({ fetchPartTies: async () => [], insertPartTie: vi.fn(), deletePartTie: vi.fn() }))
vi.mock('../../hooks/useOnSiteSites', () => ({
  useOnSiteSites: () => ({ siteOfJob: new Map([['ja', 'dev1'], ['jb', 'dev1'], ['jc', null]]), siteNames: new Map([['dev1', 'ZZ Test Ridge']]), loaded: true }),
}))
// The office's desk is another test's business. Here the office only searches, and the hits stand in the desk's place.
vi.mock('../jobs/JobsMaterialsTab', () => ({ default: () => <div data-testid="office-desk" /> }))
// The site's own screen is another test's business. Here it only has to be where the press lands.
vi.mock('./SiteMaterialsView', () => ({ default: ({ site, showMoney }: { site: { name: string }; showMoney: boolean }) => <div data-testid="site-view">{site.name}{showMoney ? ' with money' : ' with no money'}</div> }))

function Where() {
  const loc = useLocation()
  return <output data-testid="where">{loc.pathname}{loc.search}</output>
}
const draw = (role: string, phone: boolean) => renderWithProviders(<><MaterialsOnSiteTab active role={role} userId="u1" userName="Sam" onLabels={() => {}} phone={phone} /><Where /></>, { route: '/materials?tab=on-site' })
const rows = () => [...document.querySelectorAll('[data-desk-phone-row]')].map((r) => r.getAttribute('data-desk-phone-row'))
const tiles = () => [...document.querySelectorAll('[data-testid="flow-tiles"] button')] as HTMLButtonElement[]

afterEach(cleanup)

describe('Materials → On site for a field role · a phone and a computer', () => {
  it('a computer keeps the table, with Open the site and Open the boxes', () => {
    draw('superintendent', false)
    expect(document.querySelector('[data-testid="materials-desk-phone"]')).toBeNull()
    expect(screen.getByText('Your jobs with boxes')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open the site' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Open the boxes' })).toHaveLength(3)
  })

  it('a phone gets two figures and a row a job, with no money anywhere', () => {
    draw('superintendent', true)
    expect(document.querySelector('table')).toBeNull()
    expect(tiles().map((t) => t.textContent)).toEqual(['4Boxes on site', '2Due a count'])
    expect(rows()).toEqual(['ja', 'jb', 'jc'])
    expect(document.body.textContent).not.toMatch(/\$\d/)
    expect(document.body.textContent).not.toContain('Missing this week')
    expect(screen.queryByText('Open the boxes')).toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Find a part or a box on any job' })).toBeTruthy()
  })

  it('a row names the boxes due a count, and a job with none says all counted', () => {
    draw('superintendent', true)
    expect(document.querySelector('[data-desk-phone-row="ja"]')!.textContent).toBe('224ZZ Test phase 22 boxesR13 due a count›')
    expect(document.querySelector('[data-desk-phone-row="ja"]')!.hasAttribute('data-marked')).toBe(true)
    expect(document.querySelector('[data-desk-phone-row="jc"]')!.textContent).toBe('972ZZ Test gas test1 box · all counted this fortnight›')
    expect(document.querySelector('[data-desk-phone-row="jc"]')!.hasAttribute('data-marked')).toBe(false)
  })
})

describe('Materials → On site for a field role on a phone · where the presses lead', () => {
  it('a row opens the job’s boxes on the Tally, where Open the boxes leads', () => {
    draw('superintendent', true)
    fireEvent.click(screen.getByRole('button', { name: 'Open 1091 · ZZ Test pump house' }))
    expect(screen.getByTestId('where').textContent).toBe('/tally?tab=on-site&job=jb')
  })

  it('a superintendent’s site heads its jobs, and Whole site opens the site’s screen with no money', () => {
    draw('superintendent', true)
    const site = document.querySelector('[data-desk-phone-section="site:dev1"]')!
    expect(site.querySelector('h3')!.textContent).toBe('ZZ Test Ridge · 3 boxes')
    expect([...site.querySelectorAll('[data-desk-phone-row]')].map((r) => r.getAttribute('data-desk-phone-row'))).toEqual(['ja', 'jb'])
    expect(document.querySelector('[data-desk-phone-section="loose"] h3')!.textContent).toBe('Not on a site')
    fireEvent.click(screen.getByRole('button', { name: 'Whole site: ZZ Test Ridge' }))
    expect(screen.getByTestId('site-view').textContent).toBe('ZZ Test Ridge with no money')
  })

  it('a primary reads the site too', () => {
    draw('primary', true)
    expect(screen.getByRole('button', { name: 'Whole site: ZZ Test Ridge' })).toBeTruthy()
  })

  it('an estimator reads no site: every job is a row under no heading', () => {
    draw('estimator', true)
    expect(rows()).toEqual(['ja', 'jb', 'jc'])
    expect(document.querySelector('[data-desk-phone-section] h3')).toBeNull()
    expect(screen.queryByText('Whole site')).toBeNull()
  })

  it('Due a count narrows the list, and a second press brings every job back', () => {
    draw('superintendent', true)
    fireEvent.click(tiles()[1]!)
    expect(rows()).toEqual(['ja', 'jb'])
    expect(tiles().map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    fireEvent.click(tiles()[1]!)
    expect(rows()).toEqual(['ja', 'jb', 'jc'])
  })
})

describe('Find a part or a box on any job · a phone and a computer', () => {
  const find = (words: string) => fireEvent.change(screen.getByRole('searchbox', { name: 'Find a part or a box on any job' }), { target: { value: words } })
  const hits = () => [...document.querySelectorAll('[data-find-phone-row]')] as HTMLAnchorElement[]

  it('a computer keeps the table of six columns', () => {
    draw('superintendent', false)
    find('elbow')
    expect(document.querySelector('[data-testid="on-site-find-phone"]')).toBeNull()
    expect([...document.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Part', 'Box', 'Job', 'On hand', 'Last counted', ''])
    expect(screen.getAllByRole('link', { name: 'Open the box' })).toHaveLength(4)
  })

  it('a phone draws each hit as one row that reads down, with how many are on hand as a figure', () => {
    draw('superintendent', true)
    find('elbow')
    expect(document.querySelector('table')).toBeNull()
    expect(hits()).toHaveLength(4)
    const first = hits()[0]!
    expect(first.getAttribute('aria-label')).toBe('Open R12 on 224 · ZZ Test phase 2')
    expect(first.textContent).toContain('ZZ test elbow')
    expect(first.textContent).toContain('R12 · cage')
    expect(first.textContent).toContain('224 · ZZ Test phase 2')
    expect(first.querySelector('[data-find-phone-on-hand]')!.textContent).toBe('9on hand')
    // The list of jobs gives way to the hits, and the count of them is still said beside the box.
    expect(document.querySelector('[data-testid="materials-desk-phone"]')).toBeNull()
    expect(screen.getByText('4 lines in 4 boxes on 3 jobs')).toBeTruthy()
  })

  it('a box due a count says so in amber words, and a counted one in quiet words', () => {
    draw('superintendent', true)
    find('elbow')
    const count = (label: string) => hits().find((h) => h.getAttribute('aria-label')!.startsWith(`Open ${label} `))!.querySelector('[data-find-phone-count]')!
    expect(count('R13').hasAttribute('data-due')).toBe(true)
    expect(count('R13').textContent).toBe('never counted')
    expect(count('R12').hasAttribute('data-due')).toBe(false)
    expect(count('R12').textContent).toMatch(/^counted /)
  })

  it('a box that matched by its own name is a row with no figure', () => {
    draw('superintendent', true)
    find('P1')
    expect(hits()).toHaveLength(1)
    expect(hits()[0]!.textContent).toContain('P1')
    expect(hits()[0]!.querySelector('[data-find-phone-on-hand]')).toBeNull()
  })

  it('a field role’s row opens the box, where the table’s Open the box leads', () => {
    draw('superintendent', true)
    find('elbow')
    expect(hits()[0]!.getAttribute('href')).toBe('/tally?tab=on-site&job=ja&container=r12')
  })

  it('the office’s row opens the box on the Tally’s screen, with the way back to Materials', () => {
    draw('master_technician', true)
    expect(screen.getByTestId('office-desk')).toBeTruthy()
    find('elbow')
    expect(screen.queryByTestId('office-desk')).toBeNull()
    expect(hits()[0]!.getAttribute('href')).toBe('/tally?tab=on-site&job=ja&container=r12&from=materials')
  })

  it('words that find nothing say so, with the press that clears them', () => {
    draw('superintendent', true)
    find('zz nothing has this name')
    expect(hits()).toHaveLength(0)
    expect(document.querySelector('table')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(rows()).toEqual(['ja', 'jb', 'jc'])
  })
})
