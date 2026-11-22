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
const data = vi.hoisted(() => ({ boxes: [] as Box[], movements: [] as Array<Record<string, unknown>>, addMovement: vi.fn(), search: vi.fn(async () => [] as Array<{ id: string; name: string; manufacturer: string | null }>) }))

vi.mock('../../lib/materials/onSiteStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/materials/onSiteStore')>()),
  jobIdsWithData: () => ['ja'],
  listContainers: () => data.boxes,
  listMovements: () => data.movements,
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
vi.mock('../../lib/materials/boxHistoryIo', () => ({ fetchBoxNames: vi.fn(async () => []) }))
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
  data.movements = []
  data.search.mockClear()
})
afterEach(cleanup)

describe('Add a part on the office’s desk', () => {
  it('every live box’s card has the press on a desk, and Unsorted has none', () => {
    data.boxes = [box('zz1', 'ZZ1'), box('zz2', 'ZZ2', 'box'), box('un', 'Unsorted', 'unsorted')]
    open()
    expect(screen.getAllByTestId('materials-box-add-part').map((b) => [b.textContent, b.getAttribute('aria-label')])).toEqual([['Add a part', 'Add a part to ZZ1'], ['Add a part', 'Add a part to ZZ2']])
  })

  it('on a phone each box is one row: a box with parts opens the Tally’s box screen, an empty one is pressed to add its first part (v2.8284)', () => {
    data.boxes = [box('zz1', 'ZZ1'), box('zz2', 'ZZ2', 'box'), box('un', 'Unsorted', 'unsorted')]
    data.movements = [{ id: 'm1', jobId: 'ja', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 8, reason: 'delivered', fromContainerId: null, toContainerId: 'zz1', note: 'added on site', source: null, byUserId: 'u1', byName: 'Sam', at: '2026-11-10T15:00:00Z' }]
    open(true)
    const rows = screen.getAllByTestId('materials-box-row')
    expect(rows).toHaveLength(3)
    // no card, no table of parts, no photo
    expect(document.querySelector('[data-box-card] table')).toBeNull()
    expect(screen.queryByTestId('materials-box-add-part')).toBeNull()
    const zz1 = document.querySelector('[data-box-card="zz1"]') as HTMLElement
    const zz2 = document.querySelector('[data-box-card="zz2"]') as HTMLElement
    expect(zz1.tagName).toBe('A')
    expect(zz1.getAttribute('href')).toBe('/tally?tab=on-site&job=ja&container=zz1&from=materials')
    expect(zz1.textContent).toContain('ZZ test elbow · 8')
    // the empty box reads Empty in plain words, and its press adds a part in place
    expect(zz2.tagName).toBe('BUTTON')
    expect(within(zz2).getByTestId('on-site-box-row-state').textContent).toBe('Empty')
    expect(zz2.textContent).toContain('Add a part')
    fireEvent.click(zz2)
    expect(screen.getByRole('dialog', { name: 'Add a part to ZZ2' })).toBeTruthy()
  })

  it('the press opens the Tally’s sheet on that box, and its Add writes the Tally’s row as the signed-in person', async () => {
    data.boxes = [box('zz1', 'ZZ1'), box('zz2', 'ZZ2')]
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Add a part to ZZ2' }))
    addTyped('ZZ test elbow', 'ZZ2')
    // ZZ2 held none of it, so the add is also that line's count (v2.8284): the delivery, then the count
    expect(data.addMovement.mock.calls.map((c) => c[0])).toEqual([
      expect.objectContaining({ jobId: 'ja', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 1, reason: 'delivered', fromContainerId: null, toContainerId: 'zz2', note: 'added on site', byUserId: 'u1', byName: 'Sam' }),
      expect.objectContaining({ partName: 'ZZ test elbow', quantity: 1, reason: 'counted', fromContainerId: 'zz2', toContainerId: null, byUserId: 'u1', byName: 'Sam' }),
    ])
    // the sheet closes and the toast says what went where
    expect(screen.queryByRole('dialog', { name: 'Add a part to ZZ2' })).toBeNull()
    expect(await screen.findByText('1 ZZ test elbow added to ZZ2.')).toBeTruthy()
  })

  it('into a box that already holds the part the add writes no count, and “and another part” keeps the sheet (v2.8284)', async () => {
    data.boxes = [box('zz1', 'ZZ1')]
    data.movements = [{ id: 'm1', jobId: 'ja', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 8, reason: 'delivered', fromContainerId: null, toContainerId: 'zz1', note: 'added on site', source: null, byUserId: 'u1', byName: 'Sam', at: '2026-11-10T15:00:00Z' }]
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Add a part to ZZ1' }))
    const sheet = screen.getByRole('dialog', { name: 'Add a part to ZZ1' })
    // the sheet opens on the job's names
    fireEvent.click(within(within(sheet).getByTestId('add-part-already')).getByRole('button', { name: /ZZ test elbow/ }))
    fireEvent.click(within(sheet).getByRole('button', { name: '+10' }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add 10 and another part' }))
    expect(data.addMovement.mock.calls.map((c) => [c[0].reason, c[0].quantity])).toEqual([['delivered', 10]])
    expect(screen.getByRole('dialog', { name: 'Add a part to ZZ1' })).toBeTruthy()
    expect(screen.getByTestId('add-part-note').textContent).toBe('10 ZZ test elbow added to ZZ1.')
  })

  it('a new box takes its first part in the same press, and the part is counted as it goes in (v2.8284)', async () => {
    data.boxes = [box('zz1', 'ZZ1')]
    open()
    fireEvent.click(screen.getByTestId('materials-add-container'))
    fireEvent.change(screen.getByLabelText('Its name'), { target: { value: 'ZZ9' } })
    // a count with nothing said has no part to go on
    fireEvent.change(screen.getByTestId('materials-add-how-many'), { target: { value: '40' } })
    expect((screen.getByTestId('materials-add-press') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('materials-add-say').textContent).toContain('Say what is in it, so the count has a part to go on.')
    fireEvent.change(screen.getByTestId('materials-add-line'), { target: { value: 'Hangers' } })
    const press = screen.getByTestId('materials-add-press') as HTMLButtonElement
    expect(press.textContent).toBe('Add ZZ9 with 40 Hangers')
    fireEvent.click(press)
    expect(data.addMovement.mock.calls.map((c) => [c[0].reason, c[0].partName, c[0].quantity, c[0].toContainerId ?? c[0].fromContainerId])).toEqual([['delivered', 'Hangers', 40, 'new-ZZ9'], ['counted', 'Hangers', 40, 'new-ZZ9']])
    expect(await screen.findByText('ZZ9 added, with 40 Hangers in it.')).toBeTruthy()
  })

  it('when the box lands and its part does not, the box is kept and the reason is said (v2.8284)', async () => {
    data.boxes = [box('zz1', 'ZZ1')]
    data.addMovement.mockImplementation(() => { throw new Error('The office said no.') })
    open()
    fireEvent.click(screen.getByTestId('materials-add-container'))
    fireEvent.change(screen.getByLabelText('Its name'), { target: { value: 'ZZ9' } })
    fireEvent.change(screen.getByTestId('materials-add-line'), { target: { value: 'Hangers' } })
    fireEvent.change(screen.getByTestId('materials-add-how-many'), { target: { value: '40' } })
    fireEvent.click(screen.getByTestId('materials-add-press'))
    expect(await screen.findByText('ZZ9 was added. Its 40 Hangers were not: The office said no. Add them from the box.')).toBeTruthy()
    expect(document.querySelector('[data-box-card="new-ZZ9"]')).toBeTruthy()
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
