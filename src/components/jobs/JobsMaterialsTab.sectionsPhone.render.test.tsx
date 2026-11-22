// @vitest-environment jsdom
/**
 * A job's Materials page on a phone (v2.8292): the sections under the **Missing**, **Used** and **Came in** tiles
 * draw rows where their tables stood. The rows' words are held by `jobSectionsPhone.test.ts`. Here: that a phone
 * gets rows and a computer its tables, that Missing leads with the parts that have a gap and folds the rest, that a
 * report's row keeps the press to the takes before it, that History is drawn a page at a time and still obeys its
 * filters, and that a delivery is a row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

type Box = { id: string; jobId: string; label: string; kind: string; where: string; locationId: null; lat: null; lng: null; retiredAt: string | null; createdAt: string }
const box = (id: string, label: string): Box => ({ id, jobId: 'ja', label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const data = vi.hoisted(() => ({ movements: [] as unknown[] }))
const boxes = [box('g1', 'G1'), box('g2', 'G2')]
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()
let seq = 0
const mv = (over: Record<string, unknown>) => ({ id: `m${++seq}`, jobId: 'ja', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 1, reason: 'delivered', fromContainerId: null, toContainerId: null, note: '', byUserId: 'u1', byName: 'Sam', at: ago(1), source: null, itemId: null, ...over })

vi.mock('../../lib/materials/onSiteStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/materials/onSiteStore')>()),
  jobIdsWithData: () => ['ja'],
  listContainers: () => boxes,
  listMovements: () => data.movements,
  listPlaces: () => [],
  listPhotos: () => [],
  serverSummary: () => null,
  jobLedgerCapped: () => false,
  loadJob: () => Promise.resolve(),
  loadBookPrices: async () => {},
  priceOf: () => null,
  priceOfJob: () => null,
  priceFor: () => null,
  priceForJob: () => null,
  bookPricesState: () => ({ error: null, loading: false }),
  jobLoadState: () => ({ loaded: true, loading: false, error: null, raw: null }),
}))
vi.mock('../../hooks/useOnSiteStore', () => ({
  useOnSiteDesk: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteJob: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteStoreVersion: () => 0,
}))
vi.mock('../../hooks/useOnSiteSites', () => ({ useOnSiteSites: () => ({ siteOfJob: new Map(), siteNames: new Map(), loaded: true, failed: null, retry: () => {} }) }))
vi.mock('../../hooks/useSiteBoxNames', () => ({ useSiteBoxNames: () => ({ rows: [], siteId: null, loaded: true }) }))
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), marksByBox: new Map(), blank: 0, reserved: { count: 0, runs: 0, span: '', names: [], anyNamed: false, printedByName: '', printedAt: '', mark: { printed: 0, waiting: 0, unknown: 0 } }, toPrint: [], loaded: true, failed: null, retry: () => {}, refresh: () => {} }) }))
vi.mock('../../lib/materials/stickerRunsIo', () => ({ fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: [] })), fetchStickerRuns: vi.fn(async () => []), mintStickerRun: vi.fn() }))
vi.mock('../../hooks/usePartTies', () => ({ usePartTies: () => ({ ties: [], available: false, failed: null, retry: () => {}, answer: async () => {}, undo: async () => {} }) }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician', user: { id: 'u1', email: 'leader@example.com' }, profileName: 'Sam' })
})

import JobsMaterialsTab from './JobsMaterialsTab'

const jobs = [{ id: 'ja', hcp_number: '', click_number: '224', job_name: 'ZZ Test phase 2', job_address: null, google_drive_link: null }]
const open = (phone: boolean) => renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} role="master_technician" phone={phone} />, { route: '/materials?tab=on-site&job=ja' })
/** A tile on a phone, a pill at a computer: both are tabs named by their sentence. */
const section = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }))
const rowsIn = (testId: string) => [...document.querySelectorAll(`[data-testid="${testId}"] [data-section-phone-row]`)] as HTMLElement[]

afterEach(() => {
  cleanup()
  data.movements = []
  seq = 0
})

// Elbows: 10 delivered into G1 two days ago, counted at 7 yesterday. Tees: 5 delivered into G2 and counted at 5.
// Then a third part that someone could not find, and a return.
const ledger = () => [
  mv({ partName: 'ZZ test elbow', quantity: 10, reason: 'delivered', toContainerId: 'g1', at: ago(48), source: 'INV-ZZ-1' }),
  mv({ partName: 'ZZ test elbow', quantity: 7, reason: 'counted', fromContainerId: 'g1', at: ago(24) }),
  mv({ partName: 'ZZ test tee', quantity: 5, reason: 'delivered', toContainerId: 'g2', at: ago(47), source: 'INV-ZZ-1' }),
  mv({ partName: 'ZZ test tee', quantity: 5, reason: 'counted', fromContainerId: 'g2', at: ago(23) }),
  mv({ partName: 'ZZ test valve', quantity: 2, reason: 'delivered', toContainerId: 'g2', at: ago(46) }),
  mv({ partName: 'ZZ test valve', quantity: 1, reason: 'cannot_find', fromContainerId: 'g2', at: ago(20), note: 'not in the cage' }),
  mv({ partName: 'ZZ test tee', quantity: 1, reason: 'returned', fromContainerId: 'g2', at: ago(10) }),
]

describe('a job’s Missing section · a phone and a computer', () => {
  it('a computer keeps both tables', () => {
    data.movements = ledger()
    open(false)
    section(/missing/i)
    expect(document.querySelector('[data-section-phone-row]')).toBeNull()
    expect([...document.querySelectorAll('th')].map((th) => th.textContent)).toContain('Walked away')
    expect([...document.querySelectorAll('th')].map((th) => th.textContent)).toContain('Expected')
  })

  it('a phone leads with the parts that have a gap and keeps the rest behind one press that counts them', () => {
    data.movements = ledger()
    open(true)
    section(/missing/i)
    expect(document.querySelector('table')).toBeNull()
    const parts = rowsIn('materials-phone-comparison')
    expect(parts.map((r) => r.getAttribute('data-edge'))).toEqual(parts.map(() => 'amber'))
    expect(parts.length).toBeGreaterThan(0)
    expect(parts.every((r) => r.querySelector('[data-section-phone-figure]')!.textContent!.endsWith('walked away'))).toBe(true)
    const more = document.querySelector('[data-testid="materials-phone-comparison"] [data-section-phone-more]') as HTMLButtonElement
    const quiet = 3 - parts.length
    expect(more.textContent).toBe(quiet === 1 ? 'Show 1 part with nothing walked away' : `Show ${quiet} parts with nothing walked away`)
    fireEvent.click(more)
    expect(rowsIn('materials-phone-comparison')).toHaveLength(3)
    expect(document.querySelector('[data-testid="materials-phone-comparison"] [data-section-phone-more]')).toBeNull()
    expect(document.querySelector('[data-testid="materials-phone-comparison"] [data-section-phone-foot]')!.textContent).toMatch(/^Walked away, priced\$/)
  })

  it('a part’s row says what the table’s bold columns say, and what was reported', () => {
    data.movements = ledger()
    open(true)
    section(/missing/i)
    fireEvent.click(document.querySelector('[data-testid="materials-phone-comparison"] [data-section-phone-more]')!)
    const elbow = rowsIn('materials-phone-comparison').find((r) => r.textContent!.startsWith('ZZ test elbow'))!
    expect(elbow.textContent).toContain('bought 10 · left 7')
    const tee = rowsIn('materials-phone-comparison').find((r) => r.textContent!.startsWith('ZZ test tee'))!
    expect(tee.textContent).toContain('returned 1')
    const valve = rowsIn('materials-phone-comparison').find((r) => r.textContent!.startsWith('ZZ test valve'))!
    expect(valve.textContent).toContain('added on site 2')
    expect(valve.textContent).toContain('can’t find 1')
  })

  it('a job where nothing walked away says so, with every part one press away', () => {
    data.movements = [mv({ quantity: 5, reason: 'delivered', toContainerId: 'g1', at: ago(48), source: 'INV-ZZ-1' }), mv({ quantity: 5, reason: 'counted', fromContainerId: 'g1', at: ago(24) })]
    open(true)
    section(/missing/i)
    expect(rowsIn('materials-phone-comparison')).toHaveLength(0)
    expect(screen.getByText('Nothing has walked away on this job.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 part with nothing walked away' }))
    expect(rowsIn('materials-phone-comparison')).toHaveLength(1)
  })
})

describe('a job’s Missing section on a phone · what was reported', () => {
  it('a short count is amber with what is missing, a Can’t find is red with its count, and the total stands under them', () => {
    data.movements = ledger()
    open(true)
    section(/missing/i)
    const rows = rowsIn('materials-phone-reported')
    expect(rows.map((r) => `${r.getAttribute('data-edge')}:${r.querySelector('[data-section-phone-figure]')!.textContent}`)).toEqual(['amber:3missing', 'red:1can’t find'])
    expect(rows[0]!.textContent).toContain('G1 · expected 10 · counted 7')
    expect(rows[0]!.textContent).toContain('no price')
    expect(rows[0]!.textContent).toContain('Sam')
    expect(rows[1]!.textContent).toContain('G2')
    expect(rows[1]!.textContent).toContain('not in the cage')
    expect(document.querySelector('[data-testid="materials-phone-reported"] [data-section-phone-foot]')!.textContent).toBe('In the last 7 days$0.00')
  })

  it('the day presses still narrow it, and are a thumb tall', () => {
    data.movements = [...ledger(), mv({ partName: 'ZZ test old part', quantity: 4, reason: 'delivered', toContainerId: 'g1', at: ago(24 * 20) }), mv({ partName: 'ZZ test old part', quantity: 1, reason: 'counted', fromContainerId: 'g1', at: ago(24 * 15) })]
    open(true)
    section(/missing/i)
    expect(rowsIn('materials-phone-reported')).toHaveLength(2)
    const thirty = screen.getByRole('button', { name: '30 days' })
    expect(thirty.style.minHeight).toBe('36px')
    fireEvent.click(thirty)
    expect(rowsIn('materials-phone-reported')).toHaveLength(3)
    expect(document.querySelector('[data-testid="materials-phone-reported"] [data-section-phone-foot]')!.textContent).toMatch(/^In the last 30 days/)
  })

  it('nothing reported says so', () => {
    data.movements = [mv({ quantity: 5, reason: 'delivered', toContainerId: 'g1', at: ago(48) })]
    open(true)
    section(/missing/i)
    expect(screen.getByText('Nothing missing in the last 7 days.')).toBeTruthy()
  })
})

describe('a job’s Used section on a phone · every press', () => {
  it('a computer keeps the table of seven columns', () => {
    data.movements = ledger()
    open(false)
    section(/used/i)
    expect([...document.querySelectorAll('th')].map((th) => th.textContent)).toEqual(expect.arrayContaining(['When', 'What', 'Part', 'Qty', 'Where', 'Who', 'Note']))
  })

  it('a phone draws a row a press, newest first, with a signed figure', () => {
    data.movements = ledger()
    open(true)
    section(/used/i)
    const rows = rowsIn('materials-phone-history')
    expect(rows).toHaveLength(7)
    expect(rows[0]!.textContent).toContain('ZZ test tee')
    expect(rows[0]!.textContent).toContain('Returned')
    expect(rows[0]!.textContent).toContain('credit due')
    expect(rows[0]!.textContent).toContain('G2 → the supply house')
    expect(rows[0]!.querySelector('[data-section-phone-figure]')!.textContent).toBe('−1')
    // A delivery reads Delivered → G1, with its invoice, and adds.
    const landed = rows[rows.length - 1]!
    expect(landed.textContent).toContain('Delivered → G1 · INV-ZZ-1')
    expect(landed.querySelector('[data-section-phone-figure]')!.textContent).toBe('+10')
    expect(document.querySelector('[data-testid="materials-phone-history"] [data-section-phone-more]')).toBeNull()
  })

  it('a long history is drawn sixty at a time, and the press says how many it will add', () => {
    data.movements = Array.from({ length: 150 }, (_, i) => mv({ quantity: 1, reason: 'used', fromContainerId: 'g1', at: ago(i + 1) }))
    open(true)
    section(/used/i)
    expect(rowsIn('materials-phone-history')).toHaveLength(60)
    fireEvent.click(screen.getByRole('button', { name: 'Show 60 more' }))
    expect(rowsIn('materials-phone-history')).toHaveLength(120)
    fireEvent.click(screen.getByRole('button', { name: 'Show the last 30' }))
    expect(rowsIn('materials-phone-history')).toHaveLength(150)
    expect(document.querySelector('[data-testid="materials-phone-history"] [data-section-phone-more]')).toBeNull()
  })

  it('the two filters still narrow it, and are a thumb tall', () => {
    data.movements = ledger()
    open(true)
    section(/used/i)
    const reason = screen.getByRole('combobox', { name: 'Filter by reason' }) as HTMLSelectElement
    expect(reason.style.minHeight).toBe('40px')
    fireEvent.change(reason, { target: { value: 'counted' } })
    expect(rowsIn('materials-phone-history')).toHaveLength(2)
    expect(rowsIn('materials-phone-history').every((r) => r.textContent!.includes('Count'))).toBe(true)
  })
})

describe('a job’s Came in section on a phone · deliveries so far', () => {
  it('an invoice that landed is a row with its pieces as the figure', () => {
    data.movements = ledger()
    open(true)
    section(/came in/i)
    const rows = rowsIn('materials-phone-deliveries')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toContain('INV-ZZ-1')
    expect(rows[0]!.textContent).toContain('Sam · 2 lines')
    expect(rows[0]!.querySelector('[data-section-phone-figure]')!.textContent).toBe('15pieces')
  })

  it('with none it says so, in the table’s words', () => {
    data.movements = []
    open(true)
    section(/came in/i)
    expect(screen.getByText('No delivery has landed yet. Paste an invoice above, or add a part on the phone from the box it went in.')).toBeTruthy()
  })

  it('a computer keeps the table', () => {
    data.movements = ledger()
    open(false)
    section(/came in/i)
    expect([...document.querySelectorAll('th')].map((th) => th.textContent)).toEqual(expect.arrayContaining(['Source', 'When', 'By', 'Lines', 'Pieces']))
  })
})
