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
  loadJob: vi.fn(async () => {}),
  markLabelsPrinted: vi.fn(),
  resolveBoxCode: vi.fn(async () => ({ kind: 'none' })),
  addMovement: vi.fn(),
  addPlace: vi.fn(),
  addPhoto: vi.fn(),
  newId: () => 'id',
  sayBoxLine: vi.fn(),
  updatePhoto: vi.fn(),
  listContainers: () => store.containers,
  listMovements: () => store.movements,
  listPhotos: () => [],
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
const NONE_RESERVED = vi.hoisted(() => ({ count: 0, runs: 0, span: '', names: [] as string[], anyNamed: false, printedByName: '', printedAt: '' }))
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
  stuck.marks = new Map()
  stuck.blank = 0
  stuck.reserved = NONE_RESERVED
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

describe('TallyOnSiteTab · Where is it? (punch list #372)', () => {
  it('the box screen’s middle chip opens the sheet, which says what the app knows', async () => {
    open()
    // One chip, pinned or not: the old Pin on map press is gone from the box screen.
    expect(screen.queryByRole('button', { name: /Pin on map|On the map/ })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Where is A2?' }))
    const sheet = screen.getByRole('dialog', { name: 'Where is A2?' })
    expect(sheet.textContent).toContain('Nobody has pinned A2.')
    expect(sheet.textContent).toContain('It has no place yet.')
    expect(screen.getByRole('button', { name: 'I found it' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Move the pin by hand' })).toBeTruthy()
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

describe('what is in a box, on a line of its own (punch list #351, PR 2)', () => {
  it('the list row and the box’s screen read the app’s line from the parts, and Say it better sends a person’s words', async () => {
    const storeMock = await import('../../lib/materials/onSiteStore')
    vi.mocked(storeMock.sayBoxLine).mockClear()
    renderWithProviders(<TallyOnSiteTab jobs={jobs} jobsLoading={false} selectedJobId="j1" onPickJob={() => {}} byUserId="u1" byName="Mateo" searchParts={async () => []} initialContainerId={null} />)
    // One kind of part: its name and count, and the row no longer repeats "1 part".
    const row = screen.getByTestId('on-site-box-row-line')
    expect(row.textContent).toBe('ZZ test elbow · 8')
    expect(row.getAttribute('data-by')).toBe('app')
    fireEvent.click(row)
    const line = await screen.findByTestId('on-site-box-line')
    expect(line.textContent).toContain('ZZ test elbow · 8')
    expect(line.textContent).toContain('from its parts')
    fireEvent.click(within(line).getByRole('button', { name: 'Say it better: What is in A2' }))
    const sheet = screen.getByRole('dialog', { name: 'What is in A2' })
    const press = within(sheet).getByRole('button', { name: 'Save the line' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.change(within(sheet).getByLabelText('What is in it'), { target: { value: '  Elbows for   level 2 ' } })
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    expect(vi.mocked(storeMock.sayBoxLine)).toHaveBeenCalledWith('j1', 'a2', 'A2', 'Elbows for level 2')
    expect(await screen.findByText('A2 reads “Elbows for level 2” now.')).toBeTruthy()
  })

  it('a person’s words show in place of the app’s line, and clearing them hands it back', async () => {
    const storeMock = await import('../../lib/materials/onSiteStore')
    vi.mocked(storeMock.sayBoxLine).mockClear()
    store.containers = [{ ...box, said: 'PVC fittings, mixed' }]
    open()
    const line = await screen.findByTestId('on-site-box-line')
    expect(line.getAttribute('data-by')).toBe('person')
    expect(line.textContent).toContain('PVC fittings, mixed')
    expect(line.textContent).toContain('In a person’s words. The parts under it still count.')
    fireEvent.click(within(line).getByRole('button', { name: /Say it better/ }))
    const sheet = screen.getByRole('dialog', { name: 'What is in A2' })
    // The empty field shows what the box reads once the words are gone: the app's own line.
    expect((within(sheet).getByLabelText('What is in it') as HTMLInputElement).placeholder).toBe('ZZ test elbow · 8')
    fireEvent.change(within(sheet).getByLabelText('What is in it'), { target: { value: '' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Use the app’s line' }))
    expect(vi.mocked(storeMock.sayBoxLine)).toHaveBeenCalledWith('j1', 'a2', 'A2', null)
  })

  it('the search lists a box by a person’s words', async () => {
    store.containers = [{ ...box, said: 'Kohler toilets' }]
    renderWithProviders(<TallyOnSiteTab jobs={jobs} jobsLoading={false} selectedJobId="j1" onPickJob={() => {}} byUserId="u1" byName="Mateo" searchParts={async () => []} initialContainerId={null} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'toilet' } })
    expect((await screen.findByTestId('on-site-hit-line')).textContent).toBe('Kohler toilets')
  })
})

describe('Add a container under the name rule (punch list #351)', () => {
  const list = () => renderWithProviders(<TallyOnSiteTab jobs={jobs} jobsLoading={false} selectedJobId="j1" onPickJob={() => {}} byUserId="u1" byName="Mateo" searchParts={async () => []} initialContainerId={null} />)
  it('opens on the site’s next free name, moves words typed after a name to What is in it, and remembers the kind', async () => {
    const storeMock = await import('../../lib/materials/onSiteStore')
    vi.mocked(storeMock.addContainer).mockReset()
    vi.mocked(storeMock.addContainer).mockImplementation(((input: { label: string }) => ({ ...box, id: 'new', label: input.label })) as never)
    try { localStorage.removeItem('pt.box.lastKind') } catch { /* no storage */ }
    list()
    fireEvent.click(screen.getByRole('button', { name: 'Add a container' }))
    const name = screen.getByLabelText('Its name') as HTMLInputElement
    expect(name.value).toBe('A3')
    expect(screen.getByTestId('add-box-say').textContent).toBe('A3 is the next free name on this site.')
    expect(screen.getByRole('button', { name: 'Add A3' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cage' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(name, { target: { value: 'a5 toilets' } })
    expect(screen.getByTestId('add-box-say').textContent).toBe('The name is A5. “Toilets” moved to What is in it.')
    expect((screen.getByTestId('add-box-line') as HTMLInputElement).value).toBe('Toilets')
    fireEvent.click(screen.getByRole('button', { name: 'Loose pile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add A5' }))
    expect(vi.mocked(storeMock.addContainer)).toHaveBeenCalledWith({ jobId: 'j1', label: 'A5', kind: 'loose', where: '', said: 'Toilets', locationId: null })
    expect(localStorage.getItem('pt.box.lastKind')).toBe('loose')
  })

  it('refuses a taken name and a number off the rule with the reason, and gives words alone the next free name', () => {
    list()
    fireEvent.click(screen.getByRole('button', { name: 'Add a container' }))
    const name = screen.getByLabelText('Its name')
    fireEvent.change(name, { target: { value: 'a2' } })
    expect(screen.getByRole('alert').textContent).toBe('A2 is already on this site. Pick another name, or take A3.')
    expect((screen.getByRole('button', { name: 'Add it' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(name, { target: { value: 'T8678' } })
    expect(screen.getByRole('alert').textContent).toBe('A number runs from 1 to 999. T8678 cannot be a name.')
    fireEvent.change(name, { target: { value: 'concrete mix' } })
    expect(screen.getByTestId('add-box-say').textContent).toBe('No letter and number in that. The next free name is A3. “Concrete mix” moved to What is in it.')
    expect((screen.getByRole('button', { name: 'Add A3' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('TallyOnSiteTab · the stickers beside a box’s name (punch list #329, section 10, PR 9)', () => {
  it('a sticker printed with the box’s own name says nothing beside it', async () => {
    stuck.marks = new Map([['a2', [{ number: 159, boxName: 'A2' }]]])
    open()
    await screen.findByRole('button', { name: 'Short' })
    expect(screen.queryByTestId('on-site-box-header-stickers')).toBeNull()
  })

  it('a sticker printed with another name says so, and one with no name says nothing (v2.7438: no running number)', async () => {
    stuck.marks = new Map([['a2', [{ number: 159, boxName: 'A1' }, { number: 147 }]]])
    open()
    await screen.findByRole('button', { name: 'Short' })
    expect(screen.getByTestId('on-site-box-header-stickers').textContent).toBe(' · sticker reads A1')
    cleanup()
    stuck.marks = new Map([['a2', [{ number: 147 }]]])
    open()
    await screen.findByRole('button', { name: 'Short' })
    expect(screen.queryByTestId('on-site-box-header-stickers')).toBeNull()
  })
})

describe('TallyOnSiteTab · These are on boxes (punch list #329, section 10, PR 10)', () => {
  function list() {
    renderWithProviders(<TallyOnSiteTab jobs={jobs} jobsLoading={false} selectedJobId="j1" onPickJob={() => {}} byUserId="u1" byName="Mateo" searchParts={async () => []} initialContainerId={null} />)
  }

  it('a job with stickers not yet on a box offers the press, which opens the form as a sheet', async () => {
    stuck.blank = 2
    list()
    const press = await screen.findByTestId('on-site-on-boxes')
    expect(press.textContent).toBe('These are on boxes')
    fireEvent.click(press)
    expect(screen.getByRole('dialog', { name: 'These are on boxes' })).toBeTruthy()
    fireEvent.change(screen.getByTestId('on-boxes-names'), { target: { value: 'a3-4' } })
    await waitFor(() => expect(screen.getByTestId('on-boxes-press').textContent).toBe('Put 2 stickers on their boxes'))
    expect(screen.getByTestId('on-boxes-goes-on').textContent).toContain('New boxes go on 972 · ZZ Test')
  })

  it('the line says the reserved stickers by name when one run holds them (v2.7487)', async () => {
    stuck.blank = 2
    stuck.reserved = { count: 2, runs: 1, span: 'A3 and A4', names: ['A3', 'A4'], anyNamed: true, printedByName: 'Dana', printedAt: '2026-11-16T18:00:00Z' }
    list()
    expect((await screen.findByTestId('on-site-stickers-blank')).textContent).toBe('2 stickers reserved and not on a box yet, A3 and A4. Scan one to say which box it is on.')
  })

  it('a job with no blank sticker has no such press', async () => {
    list()
    await screen.findByText('A2')
    expect(screen.queryByTestId('on-site-on-boxes')).toBeNull()
  })
})

describe('TallyOnSiteTab · Pin A2 where you stand? (punch list #372, step 3)', () => {
  const countA2 = async () => {
    const { addMovement } = await import('../../lib/materials/onSiteStore')
    vi.mocked(addMovement).mockImplementation(((input: { partName: string; quantity: number; reason: string; fromContainerId: string | null; toContainerId: string | null }) => {
      const row = mv({ partName: input.partName, quantity: input.quantity, reason: input.reason, fromContainerId: input.fromContainerId, toContainerId: input.toContainerId, at: '2026-11-12T10:00:00Z' })
      store.movements = [...store.movements, row]
      return row
    }) as never)
    store.movements = [mv({ partName: 'ZZ part a', reason: 'delivered', quantity: 5, at: '2026-11-01T10:00:00Z', toContainerId: 'a2' })]
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Count this box' }))
    fireEvent.click(screen.getByRole('button', { name: '5 is right' }))
  }

  it('after a count the box screen asks once, and one press pins the box where the counter stands', async () => {
    localStorage.clear()
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 29.5, longitude: -98.4, accuracy: 6 } }) } })
    const { pinContainer } = await import('../../lib/materials/onSiteStore')
    vi.mocked(pinContainer).mockClear()
    await countA2()
    const ask = await screen.findByTestId('pin-ask')
    expect(ask.textContent).toContain('Pin A2 where you stand?')
    fireEvent.click(screen.getByRole('button', { name: 'Pin it here' }))
    await waitFor(() => expect(pinContainer).toHaveBeenCalledWith('a2', { lat: 29.5, lng: -98.4 }, { accuracyM: 6, byName: 'Mateo' }))
    await waitFor(() => expect(screen.queryByTestId('pin-ask')).toBeNull())
  })

  it('Not now puts the ask away, and a second count the same day does not ask again', async () => {
    localStorage.clear()
    await countA2()
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))
    expect(screen.queryByTestId('pin-ask')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Count this box' }))
    fireEvent.click(screen.getByRole('button', { name: '5 is right' }))
    expect(screen.queryByTestId('pin-ask')).toBeNull()
  })
})
