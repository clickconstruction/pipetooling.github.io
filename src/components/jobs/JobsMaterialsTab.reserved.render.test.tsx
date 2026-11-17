// @vitest-environment jsdom
/**
 * The job's reserved stickers on its page (v2.7487, the owner's word of 2026-11-16 that printing a sticker reserves a
 * place to be filled in later): the line over the boxes says how many are reserved and not on a box yet, which names,
 * who printed them and when, and **These are on boxes** beside **Runs** opens the form on those names. More than one
 * run is said by how many runs, and a run with no names offers no such press, since only a scan places it.
 *
 * Since v2.7523 (the owner: *I don't see any tools to print them*) the line carries the press that prints the
 * reserved stickers, one for each run that holds some: it opens the stickers window on that run and mints nothing,
 * and a role that may not print a run sees it dead with the reason.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { reservedRunsToPrint, type ReservedRunPrint } from '../../lib/materials/reservedPrint'

type Box = { id: string; jobId: string; label: string; kind: string; where: string; said?: string; locationId: null; lat: null; lng: null; retiredAt: string | null; createdAt: string }
const box = (id: string, label: string, kind = 'cage'): Box => ({ id, jobId: 'ja', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const NONE = { count: 0, runs: 0, span: '', names: [] as string[], anyNamed: false, printedByName: '', printedAt: '' }
const data = vi.hoisted(() => ({ boxes: [] as Box[], retired: [] as string[], unretired: [] as string[] }))
const held = vi.hoisted(() => ({ reserved: { count: 0, runs: 0, span: '', names: [] as string[], anyNamed: false, printedByName: '', printedAt: '' }, toPrint: [] as ReservedRunPrint[], mint: vi.fn() }))
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
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), marksByBox: new Map(), blank: held.reserved.count, reserved: held.reserved, toPrint: held.toPrint, loaded: true, refresh: () => {} }) }))
// The Runs fold and These are on boxes read the job's runs and the site's names.
vi.mock('../../lib/materials/stickerRunsIo', () => ({ fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: held.reserved.names })), fetchStickerRuns: vi.fn(async () => []), mintStickerRun: held.mint }))
vi.mock('../../hooks/usePartTies', () => ({ usePartTies: () => ({ ties: [], available: false, failed: null, retry: () => {}, answer: async () => {}, undo: async () => {} }) }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant', user: { id: 'u1', email: 'office@example.com' }, profileName: 'Sam' })
})

import JobsMaterialsTab from './JobsMaterialsTab'

const jobs = [{ id: 'ja', hcp_number: '', click_number: '1111', job_name: 'ZZ Test bio walk', job_address: null, google_drive_link: null }]

const open = (role: string | null = null) => renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} role={role} />, { route: '/materials?tab=on-site&job=ja' })

/** A made-up run of the ZZ Test job: named ZZ<first> on, the first `onBoxes` of them on boxes already. */
const runOf = (id: string, first: number, count: number, onBoxes = 0, printedByName = 'Dana', printedAt = '2026-11-16T18:00:00Z') => {
  const names = Array.from({ length: count }, (_, i) => `ZZ${first + i}`)
  return {
    run: { id, jobId: 'ja', count, firstNumber: first, lastNumber: first + count - 1, copies: 1, printedByName, printedAt, names },
    stickers: names.map((boxName, i) => ({ id: `${id}-${i}`, number: first + i, code: `9C1E${String(first + i).padStart(4, '0')}`, boxName, containerId: i < onBoxes ? `box-${i}` : null, lostAt: null })),
  }
}

afterEach(() => {
  cleanup()
  held.reserved = NONE
  held.toPrint = []
  held.mint.mockReset()
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

  it('the line carries the press that prints the reserved stickers, and it opens the stickers window on their run (v2.7523)', async () => {
    data.boxes = [box('zz1', 'ZZ1')]
    const names = Array.from({ length: 9 }, (_, i) => `ZZ${2 + i}`)
    held.reserved = { count: 9, runs: 1, span: 'ZZ2 to ZZ10', names, anyNamed: true, printedByName: 'Dana', printedAt: '2026-11-16T18:00:00Z' }
    held.toPrint = reservedRunsToPrint([runOf('r1', 2, 9)])
    open('assistant')
    const line = screen.getByTestId('materials-stickers-blank')
    expect([...line.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['These are on boxes', 'Runs', 'Print the 9 reserved stickers, ZZ2 to ZZ10'])
    expect(screen.getByTestId('materials-stickers-print-note').textContent).toBe('This prints the same stickers with the same links. It reserves nothing new.')
    fireEvent.click(screen.getByTestId('materials-stickers-print-press'))
    const dialog = await screen.findByRole('dialog', { name: 'Reserved stickers, ZZ2 to ZZ10' })
    expect(dialog.querySelector('h2')!.textContent).toBe('Reserved stickers, ZZ2 to ZZ10 · 1111 · ZZ Test bio walk')
    expect(dialog.querySelector('[data-testid="stickers-ask"]')).toBeNull()
    expect(screen.getByTestId('stickers-print').textContent).toBe('Print 9 stickers, ZZ2 to ZZ10')
    expect(screen.getByTestId('stickers-again-words').textContent).toBe('Printing them again reserves nothing new. Each sticker keeps the link it has.')
    expect(held.mint).not.toHaveBeenCalled()
  })

  it('more than one run offers each its own press, and a run with some on boxes prints only the rest', () => {
    data.boxes = [box('zz1', 'ZZ1')]
    held.reserved = { ...NONE, count: 7, runs: 2, anyNamed: true }
    held.toPrint = reservedRunsToPrint([runOf('r2', 11, 3, 0, 'Marcus', '2026-11-15T18:00:00Z'), runOf('r1', 1, 6, 2)])
    open('assistant')
    expect(screen.getAllByTestId('materials-stickers-print-press').map((b) => b.textContent)).toEqual(['Print the 4 reserved stickers, ZZ3 to ZZ6', 'Print the 3 reserved stickers, ZZ11 to ZZ13'])
    expect(screen.getAllByTestId('materials-stickers-print-by').map((b) => b.textContent)).toEqual(['Printed Nov 16 by Dana', 'Printed Nov 15 by Marcus'])
  })

  it('a role that may not print a run sees the press dead with its reason, never missing', () => {
    data.boxes = [box('zz1', 'ZZ1')]
    held.reserved = { ...NONE, count: 3, runs: 1, span: 'ZZ2 to ZZ4', names: ['ZZ2', 'ZZ3', 'ZZ4'], anyNamed: true }
    held.toPrint = reservedRunsToPrint([runOf('r1', 2, 3)])
    open('subcontractor')
    const press = screen.getByTestId('materials-stickers-print-press') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.getAttribute('aria-label')).toBe('Print the 3 reserved stickers, ZZ2 to ZZ4. Only the office, a primary or a superintendent prints a run of stickers.')
    expect(screen.getByTestId('materials-stickers-print-note').textContent).toBe('Only the office, a primary or a superintendent prints a run of stickers.')
    fireEvent.click(press)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a job with none says nothing', () => {
    data.boxes = [box('zz1', 'ZZ1')]
    open()
    expect(screen.queryByTestId('materials-stickers-blank')).toBeNull()
  })
})
