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
