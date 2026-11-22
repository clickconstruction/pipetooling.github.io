// @vitest-environment jsdom
/**
 * Render smoke for Take from a box on the On site tab: the press at the bottom of a box's screen opens the camera and
 * the run; a box with one kind of part asks only how many and opens on 1; a mixed box lists its parts, a tap a piece;
 * the save press names its count, writes one Used row a line under the take's id and opens the camera again; a run
 * left on a box is offered again. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const store = vi.hoisted(() => ({
  containers: [] as unknown[],
  movements: [] as unknown[],
  photos: [] as unknown[],
  added: [] as Array<Record<string, unknown>>,
}))
vi.mock('../../lib/materials/onSiteStore', () => ({
  addContainer: vi.fn(),
  loadJob: vi.fn(async () => {}),
  markLabelsPrinted: vi.fn(),
  resolveBoxCode: vi.fn(async () => ({ kind: 'none' })),
  addMovement: (m: Record<string, unknown>) => { store.added.push(m) },
  addPlace: vi.fn(),
  addPhoto: vi.fn(),
  newId: () => 'id',
  sayBoxLine: vi.fn(),
  updatePhoto: vi.fn(),
  listContainers: () => store.containers,
  listMovements: () => store.movements,
  listPhotos: () => store.photos,
  listPlaces: () => [],
  listContainerMoves: () => [],
  moveContainer: vi.fn(),
  pinContainer: vi.fn(),
  retireContainer: vi.fn(),
  unretireContainer: vi.fn(),
  setOnSiteErrorHandler: vi.fn(),
  refreshJob: vi.fn(),
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers', user: { id: 'u1', email: 'mateo@example.com' }, profileName: 'Mateo' })
})
vi.mock('../../hooks/useOnSiteStore', () => ({ useOnSiteJob: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }), useOnSiteStoreVersion: () => 0 }))
vi.mock('../../hooks/useAddressGeocodeCoords', () => ({ useAddressGeocodeCoords: () => ({ coords: new Map() }) }))
// The site's boxes for the name rule (punch list #351): the test hands none, so the job's own boxes are the check.
vi.mock('../../hooks/useSiteBoxNames', () => ({ useSiteBoxNames: () => ({ rows: [], siteId: null, loaded: true }) }))
// The job's stickers (punch list #329, PR 3): none, until a test hands the marks beside a box's name (PR 9).
const stuck = vi.hoisted(() => ({ marks: new Map<string, Array<{ number: number; boxName?: string | null }>>(), blank: 0, reserved: { count: 0, runs: 0, span: '', names: [] as string[], anyNamed: false, printedByName: '', printedAt: '' } }))
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map([...stuck.marks].map(([id, list]) => [id, list.map((m) => m.number)])), marksByBox: stuck.marks, blank: stuck.blank, reserved: stuck.reserved, toPrint: [], loaded: true, refresh: () => {} }) }))
// These are on boxes (PR 10) reads the site's boxes and blank stickers when its sheet opens.
vi.mock('../../lib/materials/stickerRunsIo', () => ({ fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: ['A3', 'A4'] })), fetchStickerRuns: vi.fn(async () => []) }))
// Every job with a box (punch list #304): the tab asks for it only for Every job or an empty job.
const desk = vi.hoisted(() => ({ jobs: [] as unknown[], asked: [] as boolean[] }))
vi.mock('../../hooks/useOnSiteDeskJobs', () => ({
  useOnSiteDeskJobs: (enabled: boolean) => {
    desk.asked.push(enabled)
    return { jobs: enabled ? desk.jobs : [], rows: [], loading: false, loaded: enabled, error: null, raw: null, retry: () => {} }
  },
}))
const io = vi.hoisted(() => ({ send: vi.fn(async () => ({ kind: 'request' as const })) }))
vi.mock('../../lib/materials/shortRequestIo', () => ({ sendShortRequest: io.send }))

const shoot = vi.hoisted(() => ({ fn: vi.fn(async (_f: File, input: Record<string, unknown>) => ({ kind: 'sent' as const, why: '', note: { id: 'ph1', bytes: 400_000, ...input } })) }))
vi.mock('../../lib/materials/boxPhotoShoot', () => ({ shootBoxPhoto: shoot.fn }))
vi.mock('../../lib/materials/boxPhotoBytesIo', () => ({ readBoxPhotoBytes: vi.fn(async () => null) }))

import TallyOnSiteTab from './TallyOnSiteTab'

const box = { id: 'a2', jobId: 'j1', label: 'A2', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z' }
const mv = (over: Record<string, unknown>) => ({ id: String(Math.random()), jobId: 'j1', partId: null, partName: 'ZZ test elbow', manufacturer: null, fromContainerId: null, toContainerId: null, note: '', byUserId: null, byName: 'Mateo', source: null, itemId: null, ...over })
const jobs = [{ id: 'j1', hcp_number: '972', job_name: 'ZZ Test', job_address: '1 Test St' }]
const onePart = [mv({ reason: 'delivered', quantity: 8, at: '2026-11-01T10:00:00Z', toContainerId: 'a2' })]
const twoParts = [...onePart, mv({ reason: 'delivered', quantity: 3, at: '2026-11-01T10:01:00Z', toContainerId: 'a2', partName: 'ZZ test tee' })]

let cameraOpened = 0
const realClick = HTMLInputElement.prototype.click

beforeEach(() => {
  store.containers = [box]
  store.movements = onePart
  store.photos = []
  store.added = []
  shoot.fn.mockClear()
  localStorage.clear()
  cameraOpened = 0
  HTMLInputElement.prototype.click = function (this: HTMLInputElement) { if (this.getAttribute('data-testid') === 'take-camera') cameraOpened++; else realClick.call(this) }
})
afterEach(() => { cleanup(); HTMLInputElement.prototype.click = realClick })

function open() {
  renderWithProviders(<TallyOnSiteTab jobs={jobs} jobsLoading={false} selectedJobId="j1" onPickJob={() => {}} byUserId="u1" byName="Mateo" searchParts={async () => []} initialContainerId="a2" />)
}

describe('TallyOnSiteTab · Take from a box', () => {
  it('a one-part box asks only how many, opens on 1, saves under the take’s id and opens the camera twice', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Take from A2' }))
    expect(cameraOpened).toBe(1)
    expect(screen.getByText('How many are you taking?')).toBeTruthy()
    expect(screen.getByText('ZZ test elbow. A2 has 8.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Take 1 from A2' })).toBeTruthy()
    // No photo came back yet: the run says so and goes on.
    expect(screen.getByRole('group', { name: 'A2 has no photo as found' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByTestId('on-site-take-hint').textContent).toBe('Taking 2. A2 will have 6 left.')
    fireEvent.click(screen.getByRole('button', { name: 'Take 2 from A2' }))
    expect(store.added).toHaveLength(1)
    expect(store.added[0]).toMatchObject({ jobId: 'j1', reason: 'used', quantity: 2, partName: 'ZZ test elbow', fromContainerId: 'a2', toContainerId: null, takeId: 'id', byUserId: 'u1' })
    expect(cameraOpened).toBe(2)
    // The camera was closed with no shot: the take is saved, and the photo after is asked for once more.
    expect(screen.getByText('2 taken from A2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Finish without it' }))
    expect(await screen.findByRole('button', { name: 'Take from A2' })).toBeTruthy()
    expect(localStorage.getItem('pt.onSite.take.j1.a2')).toBeNull()
  })

  it('names each photo for the take it belongs to', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Take from A2' }))
    const camera = document.querySelector('[data-testid="take-camera"]') as HTMLInputElement
    const file = new File(['x'], 'shot.jpg', { type: 'image/jpeg' })
    Object.defineProperty(camera, 'files', { configurable: true, value: [file] })
    fireEvent.change(camera)
    await waitFor(() => expect(shoot.fn).toHaveBeenCalledTimes(1))
    expect(shoot.fn.mock.calls[0]![1]).toMatchObject({ jobId: 'j1', containerId: 'a2', words: 'A2 as found', kind: 'before', takeId: 'id' })
    fireEvent.click(screen.getByRole('button', { name: 'Take 1 from A2' }))
    Object.defineProperty(camera, 'files', { configurable: true, value: [file] })
    fireEvent.change(camera)
    await waitFor(() => expect(shoot.fn).toHaveBeenCalledTimes(2))
    expect(shoot.fn.mock.calls[1]![1]).toMatchObject({ words: 'A2 after a take', kind: 'after', takeId: 'id' })
    // The photo after ends the run: the box's own screen is back.
    expect(await screen.findByRole('button', { name: 'Take from A2' })).toBeTruthy()
  })

  it('a mixed box lists its parts: a tap takes one and the quick numbers sit in the row', async () => {
    store.movements = twoParts
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Take from A2' }))
    expect(screen.queryByText('How many are you taking?')).toBeNull()
    const dead = screen.getByRole('button', { name: 'Tap what you take' }) as HTMLButtonElement
    expect(dead.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Take one ZZ test elbow' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take one ZZ test elbow' }))
    expect(screen.getByRole('button', { name: 'Take 2 from A2' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Take 5 ZZ test elbow' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take one ZZ test tee' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take 6 from A2' }))
    expect(store.added.map((m) => [m.reason, m.partName, m.quantity, m.takeId])).toEqual([['used', 'ZZ test elbow', 5, 'id'], ['used', 'ZZ test tee', 1, 'id']])
  })

  it('a run left on a box is offered again, and Nothing taken puts it away', async () => {
    localStorage.setItem('pt.onSite.take.j1.a2', JSON.stringify({ id: 'take-9', jobId: 'j1', containerId: 'a2', startedAt: new Date().toISOString(), marks: {}, extras: [], savedAt: null, savedCount: 0 }))
    open()
    const strip = await screen.findByTestId('on-site-take-left')
    expect(strip.textContent).toContain('You started a take from A2 at ')
    // The run is in hand: the press that would start a second one is not drawn.
    expect(screen.queryByRole('button', { name: 'Take from A2' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Nothing taken' }))
    expect(await screen.findByRole('button', { name: 'Take from A2' })).toBeTruthy()
    expect(localStorage.getItem('pt.onSite.take.j1.a2')).toBeNull()
    expect(cameraOpened).toBe(0)
  })

  it('a box with nothing on hand offers the take as a quiet link, 48 px tall, and it opens the same run', async () => {
    store.movements = []
    open()
    const link = await screen.findByRole('button', { name: 'Took something out of A2? Say what ›' })
    expect(screen.queryByTestId('on-site-take-bar')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Take from A2' })).toBeNull()
    expect(link.style.minHeight).toBe('48px')
    // Not pinned to the screen: the box is short and Add a part is its loud press.
    expect(screen.getByTestId('on-site-take-quiet').style.position).toBe('')
    fireEvent.click(link)
    expect(cameraOpened).toBe(1)
    expect(await screen.findByTestId('on-site-take')).toBeTruthy()
    expect(screen.getByText('Nothing is listed in A2.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Something not on the list…' })).toBeTruthy()
  })

  it('a box whose only part reads none has the quiet link too', async () => {
    store.movements = [...onePart, mv({ reason: 'used', quantity: 8, at: '2026-11-02T10:00:00Z', fromContainerId: 'a2' })]
    open()
    expect(await screen.findByRole('button', { name: 'Took something out of A2? Say what ›' })).toBeTruthy()
    expect(screen.queryByTestId('on-site-take-bar')).toBeNull()
  })

  it('Unsorted has no take: its parts are put away, not taken', async () => {
    store.containers = [{ ...box, kind: 'unsorted', label: 'Unsorted' }]
    open()
    expect(await screen.findByRole('button', { name: 'Put in…' })).toBeTruthy()
    expect(screen.queryByTestId('on-site-take-bar')).toBeNull()
    expect(screen.queryByTestId('on-site-take-quiet')).toBeNull()
  })
})
