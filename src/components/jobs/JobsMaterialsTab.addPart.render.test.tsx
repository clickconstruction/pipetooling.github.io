// @vitest-environment jsdom
/**
 * Add a part on the office's Materials desk (v2.8282). A master technician counts as office, so the app sends him to
 * this desk on his phone, and it had no way to put a part into a box. Each live box's card has **Add a part**, the
 * Edit window's empty Contents tab has the same press, and both open the sheet the Tally's On site tab opens and
 * write the row the Tally writes. A box just added is brought into view.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

type Box = { id: string; jobId: string; label: string; kind: string; where: string; said?: string; locationId: null; lat: null; lng: null; retiredAt: string | null; createdAt: string }
const box = (id: string, label: string, kind = 'cage'): Box => ({ id, jobId: 'ja', label, kind, where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' })
const data = vi.hoisted(() => ({ boxes: [] as Box[], addMovement: vi.fn(), search: vi.fn(async () => [] as Array<{ id: string; name: string; manufacturer: string | null }>) }))
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
  addMovement: data.addMovement,
  addContainer: (input: { label: string; kind: string; where: string }) => {
    const made = { id: `new-${input.label}`, jobId: 'ja', label: input.label, kind: input.kind, where: input.where, locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-22T00:00:00Z' } as Box
    data.boxes = [...data.boxes, made]
    return made
  },
}))
vi.mock('../../lib/materials/addPartIo', () => ({ searchPartsBook: data.search }))
vi.mock('../../hooks/useOnSiteStore', () => ({
  useOnSiteDesk: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteJob: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteStoreVersion: () => 0,
}))
vi.mock('../../hooks/useOnSiteSites', () => ({ useOnSiteSites: () => ({ siteOfJob: new Map(), siteNames: new Map(), loaded: true, failed: null, retry: () => {} }) }))
vi.mock('../../hooks/useSiteBoxNames', () => ({ useSiteBoxNames: () => ({ rows: [], siteId: null, loaded: true }) }))
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), marksByBox: new Map(), blank: 0, reserved: { count: 0, runs: 0, span: '', names: [], anyNamed: false, printedByName: '', printedAt: '', mark: { printed: 0, waiting: 0, unknown: 0 } }, toPrint: [], loaded: true, refresh: () => {} }) }))
vi.mock('../../lib/materials/stickerRunsIo', () => ({ fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: [] })), fetchStickerRuns: vi.fn(async () => []), mintStickerRun: vi.fn() }))
vi.mock('../../lib/materials/boxNamesIo', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/materials/boxNamesIo')>()), fetchBoxNames: vi.fn(async () => []) }))
vi.mock('../../hooks/usePartTies', () => ({ usePartTies: () => ({ ties: [], available: false, failed: null, retry: () => {}, answer: async () => {}, undo: async () => {} }) }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician', user: { id: 'u1', email: 'lead@example.com' }, profileName: 'Sam' })
})

import JobsMaterialsTab from './JobsMaterialsTab'

const jobs = [{ id: 'ja', hcp_number: '', click_number: '1111', job_name: 'ZZ Test bio walk', job_address: null, google_drive_link: null }]
const open = (phone = false) => renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} role="master_technician" phone={phone} />, { route: '/materials?tab=on-site&job=ja' })

/** Picks the words as typed and presses the sheet's Add. */
const addTyped = (words: string, boxLabel: string) => {
  const sheet = screen.getByRole('dialog', { name: `Add a part to ${boxLabel}` })
  fireEvent.change(within(sheet).getByLabelText('Search the parts book'), { target: { value: words } })
  fireEvent.click(within(sheet).getByRole('button', { name: `Use “${words}” as typed` }))
  fireEvent.click(within(sheet).getByRole('button', { name: `Add 1 to ${boxLabel}` }))
}

beforeEach(() => {
  data.addMovement.mockReset()
  data.search.mockClear()
})
afterEach(cleanup)

describe('Add a part on the office’s desk', () => {
  it('every live box’s card has the press, on a desk and on a phone, and Unsorted has none', () => {
    data.boxes = [box('zz1', 'ZZ1'), box('zz2', 'ZZ2', 'box'), box('un', 'Unsorted', 'unsorted')]
    open()
    expect(screen.getAllByTestId('materials-box-add-part').map((b) => [b.textContent, b.getAttribute('aria-label')])).toEqual([['Add a part', 'Add a part to ZZ1'], ['Add a part', 'Add a part to ZZ2']])
    cleanup()
    open(true)
    expect(screen.getAllByTestId('materials-box-add-part')).toHaveLength(2)
  })

  it('the press opens the Tally’s sheet on that box, and its Add writes the Tally’s row as the signed-in person', async () => {
    data.boxes = [box('zz1', 'ZZ1'), box('zz2', 'ZZ2')]
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Add a part to ZZ2' }))
    addTyped('ZZ test elbow', 'ZZ2')
    expect(data.addMovement).toHaveBeenCalledTimes(1)
    expect(data.addMovement).toHaveBeenCalledWith({ jobId: 'ja', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 1, reason: 'delivered', fromContainerId: null, toContainerId: 'zz2', note: 'added on site', byUserId: 'u1', byName: 'Sam' })
    // the sheet closes and the toast says what went where
    expect(screen.queryByRole('dialog', { name: 'Add a part to ZZ2' })).toBeNull()
    expect(await screen.findByText('1 ZZ test elbow added to ZZ2.')).toBeTruthy()
  })

  it('a write that fails says its reason, and the sheet stays to try again', async () => {
    data.boxes = [box('zz1', 'ZZ1')]
    data.addMovement.mockImplementation(() => { throw new Error('The office said no.') })
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Add a part to ZZ1' }))
    addTyped('ZZ test elbow', 'ZZ1')
    expect(await screen.findByText('The office said no.')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Add a part to ZZ1' })).toBeTruthy()
  })

  it('the Edit window’s empty Contents tab has the press: it closes the window and opens the sheet for that box', async () => {
    data.boxes = [box('zz1', 'ZZ1')]
    open()
    fireEvent.click(screen.getByTestId('materials-box-name'))
    const edit = await screen.findByRole('dialog', { name: 'Edit ZZ1' })
    fireEvent.click(within(edit).getByRole('tab', { name: 'Contents' }))
    expect(edit.querySelector('[data-empty-state]')!.textContent).toBe('Nothing in ZZ1 yet. Add a part puts the first one in.')
    fireEvent.click(within(edit).getByRole('button', { name: 'Add a part' }))
    expect(screen.queryByRole('dialog', { name: 'Edit ZZ1' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Add a part to ZZ1' })).toBeTruthy()
    expect(data.addMovement).not.toHaveBeenCalled()
  })

  it('a box just added is brought into view, and every box is listed again', async () => {
    data.boxes = [box('zz1', 'ZZ1')]
    const seen: string[] = []
    const was = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element) { seen.push(this.getAttribute('data-box-card') ?? '') }
    try {
      open()
      fireEvent.click(screen.getByRole('button', { name: /Can't find/ }))
      fireEvent.click(screen.getByTestId('materials-add-container'))
      fireEvent.change(screen.getByLabelText('Its name'), { target: { value: 'ZZ9' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add ZZ9' }))
      expect(await screen.findByText('ZZ9 added.')).toBeTruthy()
      await waitFor(() => expect(seen).toEqual(['new-ZZ9']))
      expect(document.querySelectorAll('[data-box-card]')).toHaveLength(2)
    } finally {
      Element.prototype.scrollIntoView = was
    }
  })
})
