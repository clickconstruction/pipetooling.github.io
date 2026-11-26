// @vitest-environment jsdom
/**
 * A job's On site section on the Materials page's phone screen (v2.8282, the owner's approved design of 2026-11-22):
 * the four figures as equal tiles, the view switch and **+ Container** on one row, no print press in the section, the
 * reserved stickers as one line that opens a sheet, and the page's Print sheet drawn on the job as a door to the
 * windows the section already had. With no `phone` the desk's section is as it was.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { reservedRunsToPrint, type ReservedRunPrint } from '../../lib/materials/reservedPrint'

type Box = { id: string; jobId: string; label: string; kind: string; where: string; said?: string; locationId: null; lat: null; lng: null; retiredAt: string | null; createdAt: string }
const box = (id: string, label: string, kind = 'cage'): Box => ({ id, jobId: 'ja', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const NONE = { count: 0, runs: 0, span: '', names: [] as string[], anyNamed: false, printedByName: '', printedAt: '', mark: { printed: 0, waiting: 0, unknown: 0 } }
const data = vi.hoisted(() => ({ boxes: [] as Box[] }))
const held = vi.hoisted(() => ({ reserved: { count: 0, runs: 0, span: '', names: [] as string[], anyNamed: false, printedByName: '', printedAt: '', mark: { printed: 0, waiting: 0, unknown: 0 } }, toPrint: [] as ReservedRunPrint[], mint: vi.fn() }))
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
}))
vi.mock('../../hooks/useOnSiteStore', () => ({
  useOnSiteDesk: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteJob: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteStoreVersion: () => 0,
}))
vi.mock('../../hooks/useOnSiteSites', () => ({ useOnSiteSites: () => ({ siteOfJob: new Map(), siteNames: new Map(), loaded: true, failed: null, retry: () => {} }) }))
vi.mock('../../hooks/useSiteBoxNames', () => ({ useSiteBoxNames: () => ({ rows: [], siteId: null, loaded: true }) }))
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), marksByBox: new Map(), blank: held.reserved.count, reserved: held.reserved, toPrint: held.toPrint, loaded: true, refresh: () => {} }) }))
vi.mock('../../lib/materials/stickerRunsIo', () => ({ fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: held.reserved.names })), fetchStickerRuns: vi.fn(async () => []), mintStickerRun: held.mint }))
vi.mock('../../hooks/usePartTies', () => ({ usePartTies: () => ({ ties: [], available: false, failed: null, retry: () => {}, answer: async () => {}, undo: async () => {} }) }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant', user: { id: 'u1', email: 'office@example.com' }, profileName: 'Sam' })
})

import JobsMaterialsTab, { type MaterialsPrintSheetDoor } from './JobsMaterialsTab'

const jobs = [{ id: 'ja', hcp_number: '', click_number: '1111', job_name: 'ZZ Test bio walk', job_address: null, google_drive_link: null }]

const open = (over: { phone?: boolean; role?: string | null; printSheet?: MaterialsPrintSheetDoor } = {}) =>
  renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} role={over.role ?? 'assistant'} phone={over.phone ?? true} printSheet={over.printSheet} />, { route: '/materials?tab=on-site&job=ja' })

const runOf = (id: string, first: number, count: number) => {
  const names = Array.from({ length: count }, (_, i) => `ZZ${first + i}`)
  return {
    run: { id, jobId: 'ja', count, firstNumber: first, lastNumber: first + count - 1, copies: 1, printedByName: 'Dana', printedAt: '2026-11-16T18:00:00Z', names },
    stickers: names.map((boxName, i) => ({ id: `${id}-${i}`, number: first + i, code: `9C1E${String(first + i).padStart(4, '0')}`, boxName, containerId: null, lostAt: null })),
  }
}
const reserveNine = () => {
  const names = Array.from({ length: 9 }, (_, i) => `ZZ${2 + i}`)
  held.reserved = { count: 9, runs: 1, span: 'ZZ2 to ZZ10', names, anyNamed: true, printedByName: 'Dana', printedAt: '2026-11-16T18:00:00Z', mark: { printed: 0, waiting: 0, unknown: 9 } }
  held.toPrint = reservedRunsToPrint([runOf('r1', 2, 9)])
}

afterEach(() => {
  cleanup()
  held.reserved = NONE
  held.toPrint = []
  held.mint.mockReset()
})

describe('A job’s On site section on a phone', () => {
  it('draws the four figures as tiles, the view switch and + Container on one row, and no print press', () => {
    data.boxes = [box('zz1', 'ZZ1'), box('un', 'Unsorted', 'unsorted')]
    open()
    const tiles = screen.getByTestId('flow-tiles')
    // ZZ1 is empty, so it is due no count and On site carries no badge (#398).
    expect(within(tiles).getAllByRole('tab').map((t) => t.textContent)).toEqual(['0Came in', '0On site', '0Used', '0Missing'])
    expect(tiles.querySelector('svg')).toBeNull()
    expect(within(tiles).getAllByRole('tab').map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false'])
    expect(within(tiles).getAllByRole('tab')[1]!.getAttribute('title')).toBe('0 pieces on site in 1 box')

    const row = screen.getByTestId('materials-phone-view-row')
    expect(within(row).getAllByRole('button').map((b) => b.textContent)).toEqual(['List', 'By part', 'Map', '+ Container'])
    expect(within(within(row).getByRole('group')).getAllByRole('button').map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    const add = screen.getByTestId('materials-add-container')
    expect(add.getAttribute('aria-label')).toBe('Add a container')
    expect(screen.queryByTestId('materials-add-line')).toBeNull()
    fireEvent.click(add)
    expect(screen.getByTestId('materials-add-line')).toBeTruthy()

    // the job's print presses are in the page's Print sheet, not here
    expect(screen.queryByTestId('materials-print-labels')).toBeNull()
    expect(screen.queryByTestId('materials-print-stickers')).toBeNull()
    expect(screen.queryByTestId('materials-print-manifest')).toBeNull()

    // a tile is still the section's press, and the view row leaves with On site
    fireEvent.click(within(tiles).getAllByRole('tab')[3]!)
    expect(within(tiles).getAllByRole('tab')[3]!.getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('materials-phone-view-row')).toBeNull()
  })

  it('the desk keeps its pills, its arrows and its four presses', () => {
    data.boxes = [box('zz1', 'ZZ1')]
    open({ phone: false })
    expect(screen.queryByTestId('flow-tiles')).toBeNull()
    expect(screen.queryByTestId('materials-phone-view-row')).toBeNull()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['0came in', '0on site', '0used', '0missing'])
    expect(within(screen.getByRole('group', { name: 'This site\'s boxes' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Add a container', 'Print labels', 'Print future stickers', 'Print the manifest'])
  })

  it('the reserved stickers are one line that opens a sheet with the whole of it', async () => {
    data.boxes = [box('zz1', 'ZZ1')]
    reserveNine()
    open()
    expect(screen.queryByTestId('materials-stickers-blank')).toBeNull()
    const line = screen.getByTestId('materials-stickers-reserved-line')
    expect(line.textContent).toBe('9 stickers reserved, ZZ2 to ZZ10')
    fireEvent.click(line)
    const sheet = screen.getByRole('dialog', { name: 'Reserved stickers' })
    expect(within(sheet).getByTestId('materials-stickers-blank').querySelector('span')!.textContent).toBe('9 stickers reserved and not on a box yet, ZZ2 to ZZ10. Reserved Nov 16 by Dana. Scan one on the phone to say which box it is on.')
    expect([...within(sheet).getByTestId('materials-stickers-blank').querySelectorAll('button')].map((b) => b.textContent)).toEqual(['These are on boxes', 'Runs', 'Print the 9 reserved stickers, ZZ2 to ZZ10'])
    // a press in the sheet closes it and opens its own window
    fireEvent.click(within(sheet).getByTestId('materials-stickers-print-press'))
    expect(screen.queryByRole('dialog', { name: 'Reserved stickers' })).toBeNull()
    expect(await screen.findByRole('dialog', { name: 'Reserved stickers, ZZ2 to ZZ10' })).toBeTruthy()
    expect(held.mint).not.toHaveBeenCalled()
  })

  it('the page’s Print sheet is drawn on the job, and each row is a door to a window the job already had', async () => {
    data.boxes = [box('zz1', 'ZZ1')]
    reserveNine()
    const door = { open: true, onClose: vi.fn(), onAnotherJob: vi.fn() }
    open({ printSheet: door })
    const sheet = screen.getByRole('dialog', { name: 'Print for job 1111' })
    expect(sheet.querySelector('p')!.textContent).toBe('ZZ Test bio walk')
    const rows = within(sheet).getByTestId('materials-print-sheet')
    expect([...rows.querySelectorAll('button')].map((b) => b.firstElementChild!.textContent)).toEqual(['Labels for its boxes', 'The manifest', 'Print the 9 reserved stickers, ZZ2 to ZZ10', 'Future stickers', 'Print for another job'])
    expect(([...rows.querySelectorAll('button')] as HTMLButtonElement[]).map((b) => b.disabled)).toEqual([false, false, false, false, false])
    expect(screen.getByTestId('materials-print-sheet-reserved:r1').lastElementChild!.textContent).toBe('This prints the same stickers with the same links. It reserves nothing new.')

    fireEvent.click(screen.getByTestId('materials-print-sheet-reserved:r1'))
    expect(door.onClose).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('dialog', { name: 'Reserved stickers, ZZ2 to ZZ10' })).toBeTruthy()
    expect(held.mint).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('materials-print-sheet-another-job'))
    expect(door.onAnotherJob).toHaveBeenCalledTimes(1)
    expect(door.onClose).toHaveBeenCalledTimes(1)
  })

  it('on a job with no box the labels and the manifest are dead with the reason, and a role that prints no run sees who may', () => {
    data.boxes = []
    open({ role: 'estimator', printSheet: { open: true, onClose: () => {}, onAnotherJob: () => {} } })
    const labels = screen.getByTestId('materials-print-sheet-labels') as HTMLButtonElement
    expect(labels.disabled).toBe(true)
    expect(labels.getAttribute('aria-label')).toBe('Labels for its boxes. This job has no box yet.')
    expect((screen.getByTestId('materials-print-sheet-manifest') as HTMLButtonElement).disabled).toBe(true)
    const stickers = screen.getByTestId('materials-print-sheet-stickers') as HTMLButtonElement
    expect(stickers.disabled).toBe(true)
    expect(stickers.lastElementChild!.textContent).toBe('Only the office, a primary or a superintendent prints a run of stickers.')
    expect((screen.getByTestId('materials-print-sheet-another-job') as HTMLButtonElement).disabled).toBe(false)
  })

  it('the sheet’s labels row opens the job’s labels window', async () => {
    data.boxes = [box('zz1', 'ZZ1')]
    const door = { open: true, onClose: vi.fn(), onAnotherJob: vi.fn() }
    open({ printSheet: door })
    fireEvent.click(screen.getByTestId('materials-print-sheet-labels'))
    expect(door.onClose).toHaveBeenCalledTimes(1)
    const dialogs = await screen.findAllByRole('dialog')
    // the Print sheet is the page's to close; the labels window is open beside it
    expect(dialogs.some((d) => d.getAttribute('aria-label') !== 'Print for job 1111')).toBe(true)
  })
})
