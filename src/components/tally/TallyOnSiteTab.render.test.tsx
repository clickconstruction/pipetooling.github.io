// @vitest-environment jsdom
/**
 * Render smoke for the On site tab's Short press (punch list #209, v2.6742): a box open shows Short
 * on a line, the sheet asks how many more, its button carries the count, and the save files the
 * Tally's request in the presser's name through `sendShortRequest` and says where the office reads it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const store = vi.hoisted(() => ({
  containers: [] as unknown[],
  movements: [] as unknown[],
}))
vi.mock('../../lib/materials/onSiteStore', () => ({
  addContainer: vi.fn(),
  addMovement: vi.fn(),
  addPlace: vi.fn(),
  addPhoto: vi.fn(),
  newId: () => 'id',
  updatePhoto: vi.fn(),
  listContainers: () => store.containers,
  listMovements: () => store.movements,
  listPhotos: () => [],
  listPlaces: () => [],
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

import TallyOnSiteTab from './TallyOnSiteTab'

const box = { id: 'a2', jobId: 'j1', label: 'A2', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z' }
const mv = (over: Record<string, unknown>) => ({ id: String(Math.random()), jobId: 'j1', partId: null, partName: 'ZZ test elbow', manufacturer: null, fromContainerId: null, toContainerId: null, note: '', byUserId: null, byName: 'Mateo', source: null, itemId: null, ...over })
const jobs = [{ id: 'j1', hcp_number: '972', job_name: 'ZZ Test', job_address: '1 Test St' }, { id: 'j2', hcp_number: '973', job_name: 'ZZ Test Two', job_address: '2 Test St' }]
const otherBox = { ...box, id: 'b1', jobId: 'j2', label: 'B1', kind: 'box' }
const otherLine = { containerId: 'b1', partKey: 'text:zz test tee', partId: null, partName: 'ZZ test tee', manufacturer: null, onHand: 6, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0 }
const otherJob = { jobId: 'j2', label: '973 · ZZ Test Two', containers: [otherBox], lines: [otherLine], places: [] }

beforeEach(() => {
  store.containers = [box]
  store.movements = [mv({ reason: 'delivered', quantity: 10, at: '2026-11-01T10:00:00Z', toContainerId: 'a2' }), mv({ reason: 'counted', quantity: 8, at: '2026-11-08T10:00:00Z', fromContainerId: 'a2' })]
  io.send.mockClear()
  desk.jobs = [otherJob]
  desk.asked = []
})
afterEach(() => cleanup())

function open() {
  renderWithProviders(<TallyOnSiteTab jobs={jobs} jobsLoading={false} selectedJobId="j1" onPickJob={() => {}} byUserId="u1" byName="Mateo" searchParts={async () => []} initialContainerId="a2" />)
}

describe('TallyOnSiteTab · the Short press', () => {
  it('files the Tally’s request for more from the line, in the presser’s name, and says where the office reads it', async () => {
    open()
    const short = await screen.findByRole('button', { name: 'Short' })
    fireEvent.click(short)
    expect(screen.getByText('How many more do you need?')).toBeTruthy()
    expect(screen.getByText('A2 has 8. The office gets a request for 1 more.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    expect(screen.getByText('A2 has 8. The office gets a request for 5 more.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ask the office for 5' }))
    expect(io.send).toHaveBeenCalledWith({ job_id: 'j1', fixture_name: 'ZZ test elbow', part_id: null, quantity: 5, sequence_order: 0, created_by_user_id: 'u1' })
    await waitFor(() => expect(screen.getByText("Asked the office for 5 more ZZ test elbow. The request is on the job's Parts tab.")).toBeTruthy())
  })

  it('a line with none left keeps Short beside its words', async () => {
    // Two delivered and none found at the count: the line stays listed for its shortfall, with nothing on hand.
    store.movements = [mv({ reason: 'delivered', quantity: 2, at: '2026-11-01T10:00:00Z', toContainerId: 'a2' }), mv({ reason: 'counted', quantity: 0, at: '2026-11-08T10:00:00Z', fromContainerId: 'a2' })]
    open()
    expect(await screen.findByText('A2 has none left.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Short' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Used' })).toBeNull()
  })

  it('a refusal by the table names what to tell the office instead', async () => {
    io.send.mockRejectedValueOnce(new Error('new row violates row-level security policy for table "jobs_tally_parts"'))
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Short' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ask the office for 1' }))
    await waitFor(() => expect(screen.getByText('Only the office can file a parts request on this job. Tell them: 1 more ZZ test elbow.')).toBeTruthy())
  })
})

describe('TallyOnSiteTab · past one job (punch list #304)', () => {
  function list(onPickJob: (id: string) => void = () => {}) {
    renderWithProviders(<TallyOnSiteTab jobs={jobs} jobsLoading={false} selectedJobId="j1" onPickJob={onPickJob} byUserId="u1" byName="Mateo" searchParts={async () => []} initialContainerId={null} />)
  }

  it('searches this job until asked, then finds the part on another job and opens that job on its box', async () => {
    const onPickJob = vi.fn()
    list(onPickJob)
    const search = screen.getByRole('searchbox', { name: 'Find a part on this job' })
    expect(desk.asked.every((a) => a === false)).toBe(true)
    fireEvent.change(search, { target: { value: 'tee' } })
    expect(screen.queryByTestId('on-site-other-job')).toBeNull()
    fireEvent.click(screen.getByTestId('on-site-look-everywhere'))
    expect(screen.getByRole('searchbox', { name: 'Find a part on any job' })).toBeTruthy()
    const other = await screen.findByTestId('on-site-other-job')
    expect(other.textContent).toContain('973 · ZZ Test Two · another job')
    expect(other.textContent).toContain('ZZ test tee')
    fireEvent.click(within(other).getByRole('button'))
    expect(onPickJob).toHaveBeenCalledWith('j2')
  })

  it('Every job is a press beside the search, and Scan a label opens its window', () => {
    list()
    const reach = screen.getByRole('group', { name: 'Where to look' })
    expect(within(reach).getByRole('button', { name: 'This job' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(reach).getByRole('button', { name: 'Every job' }))
    expect(within(reach).getByRole('button', { name: 'Every job' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('on-site-scan-label'))
    expect(screen.getByRole('dialog', { name: 'Scan a label' })).toBeTruthy()
  })

  it('a job with no box names the other jobs that hold one, and a press opens that job', () => {
    store.containers = []
    store.movements = []
    const onPickJob = vi.fn()
    list(onPickJob)
    const others = screen.getByTestId('on-site-other-jobs')
    expect(document.querySelector('[data-empty-state]')?.textContent).toContain('No containers on this job yet.')
    expect(others.textContent).toContain('Your boxes are on 1 other job.')
    expect(others.textContent).toContain('973 · ZZ Test Two')
    fireEvent.click(within(others).getByRole('button'))
    expect(onPickJob).toHaveBeenCalledWith('j2')
    expect(screen.getByRole('button', { name: 'Add a container' })).toBeTruthy()
  })

  it('a job with no box and no other job with one reads as before', () => {
    store.containers = []
    store.movements = []
    desk.jobs = []
    list()
    expect(screen.queryByTestId('on-site-other-jobs')).toBeNull()
    expect(document.querySelector('[data-empty-state]')?.textContent).toContain('No containers on this site yet.')
  })

  it('a box prints its label and its manifest here, with no link to the office page', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Print the label for A2' }))
    expect(screen.getAllByTestId('labels-sheet')).toHaveLength(1)
    expect(screen.getByTestId('labels-print').textContent).toBe('Print 1 label')
    expect(document.querySelector('a[href*="/jobs?tab=materials"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Print the manifest for A2' }))
    expect(screen.getByRole('dialog', { name: /manifest/i })).toBeTruthy()
  })
})

describe('TallyOnSiteTab · Add a part offers the names the job already has (punch list #330)', () => {
  it('a name already on this job comes first as the person types, and a pick adds to that same line', async () => {
    const storeMock = await import('../../lib/materials/onSiteStore')
    vi.mocked(storeMock.addMovement).mockClear()
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Add a part to A2' }))
    expect(screen.queryByTestId('add-part-already')).toBeNull()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the parts book' }), { target: { value: 'zz elbows' } })
    const already = screen.getByTestId('add-part-already')
    expect(already.textContent).toContain('Already on this job')
    expect(already.textContent).toContain('ZZ test elbow')
    expect(already.textContent).toContain('8 in A2')
    fireEvent.click(within(already).getByRole('button', { name: /ZZ test elbow/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 to A2' }))
    expect(vi.mocked(storeMock.addMovement)).toHaveBeenCalledWith(expect.objectContaining({ reason: 'delivered', partName: 'ZZ test elbow', partId: null, quantity: 1, toContainerId: 'a2' }))
  })

  it('words no name holds offer nothing, and the typed name is still a press', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Add a part to A2' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the parts book' }), { target: { value: 'wax ring' } })
    expect(screen.queryByTestId('add-part-already')).toBeNull()
    expect(screen.getByRole('button', { name: 'Use “wax ring” as typed' })).toBeTruthy()
  })
})

describe('TallyOnSiteTab · Count this box walks every line (v2.7161)', () => {
  it('a line counted to none does not make the walk step over the next one', async () => {
    const { addMovement } = await import('../../lib/materials/onSiteStore')
    // The store's write, stood in: the press lands in the ledger the tab reads, as the cache-first write does.
    vi.mocked(addMovement).mockImplementation(((input: { partName: string; quantity: number; reason: string; fromContainerId: string | null; toContainerId: string | null }) => {
      const row = mv({ partName: input.partName, quantity: input.quantity, reason: input.reason, fromContainerId: input.fromContainerId, toContainerId: input.toContainerId, at: '2026-11-12T10:00:00Z' })
      store.movements = [...store.movements, row]
      return row
    }) as never)
    store.movements = ['ZZ part a', 'ZZ part b', 'ZZ part c'].map((partName, i) => mv({ partName, reason: 'delivered', quantity: 5 + i, at: `2026-11-01T10:0${i}:00Z`, toContainerId: 'a2' }))
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Count this box' }))
    expect(screen.getByText('ZZ part a')).toBeTruthy()
    expect(screen.getByText('1 of 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Not in A2 any more' }))
    // The second line is next. Before the fix the walk showed the third and never counted this one.
    expect(screen.getByText('ZZ part b')).toBeTruthy()
    expect(screen.getByText('2 of 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '6 is right' }))
    expect(screen.getByText('ZZ part c')).toBeTruthy()
    expect(screen.getByText('3 of 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Not in A2 any more' }))
    // Three lines, three count rows, and the toast says so.
    expect(vi.mocked(addMovement).mock.calls.filter((c) => (c[0] as { reason: string }).reason === 'counted')).toHaveLength(3)
    expect(await screen.findByText('A2 counted. 3 lines, 2 corrected.')).toBeTruthy()
    vi.mocked(addMovement).mockReset()
  })
})

describe('TallyOnSiteTab · small things on the phone (v2.7252)', () => {
  it('a line pressed Can’t find down to none is in the walk, and the count clears its mark', async () => {
    const { addMovement } = await import('../../lib/materials/onSiteStore')
    vi.mocked(addMovement).mockImplementation(((input: { partName: string; quantity: number; reason: string; fromContainerId: string | null; toContainerId: string | null }) => {
      const row = mv({ partName: input.partName, quantity: input.quantity, reason: input.reason, fromContainerId: input.fromContainerId, toContainerId: input.toContainerId, at: '2026-11-12T10:00:00Z' })
      store.movements = [...store.movements, row]
      return row
    }) as never)
    // Three came in and all three could not be found: none on hand, and the mark on the line.
    store.movements = [mv({ reason: 'delivered', quantity: 3, at: '2026-11-01T10:00:00Z', toContainerId: 'a2' }), mv({ reason: 'cannot_find', quantity: 3, at: '2026-11-05T10:00:00Z', fromContainerId: 'a2' })]
    open()
    // The box's only line has none on hand. Before, the box had no Count this box at all.
    fireEvent.click(await screen.findByRole('button', { name: 'Count this box' }))
    expect(screen.getByText('1 of 1')).toBeTruthy()
    expect(screen.getByTestId('count-walk-cant-find').textContent).toBe("3 marked can't find. Your count clears the mark.")
    fireEvent.click(screen.getByRole('button', { name: '0 is right' }))
    expect(vi.mocked(addMovement).mock.calls.map((c) => [(c[0] as { reason: string }).reason, (c[0] as { quantity: number }).quantity])).toEqual([['counted', 0]])
    expect(await screen.findByText('A2 counted. 1 line, 0 corrected.')).toBeTruthy()
    vi.mocked(addMovement).mockReset()
  })

  it('the number field can be cleared and typed over, where it snapped back to 1', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Used' }))
    const field = screen.getByLabelText('How many') as HTMLInputElement
    expect(field.value).toBe('1')
    // Cleared, it stays empty: the 1 used to come back at once, so the next key made 12.
    fireEvent.change(field, { target: { value: '' } })
    expect(field.value).toBe('')
    fireEvent.change(field, { target: { value: '5' } })
    expect(field.value).toBe('5')
    // Past what the box has, it shows the most there is.
    fireEvent.change(field, { target: { value: '50' } })
    expect(field.value).toBe('8')
    // Left empty, it shows the number the press will use.
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.blur(field)
    expect(field.value).toBe('8')
    fireEvent.click(screen.getByRole('button', { name: 'One fewer' }))
    expect(field.value).toBe('7')
  })
})
