// @vitest-environment jsdom
/**
 * Render smoke for the On site tab's Short press (punch list #209, v2.6742): a box open shows Short
 * on a line, the sheet asks how many more, its button carries the count, and the save files the
 * Tally's request in the presser's name through `sendShortRequest` and says where the office reads it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
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
const io = vi.hoisted(() => ({ send: vi.fn(async () => ({ kind: 'request' as const })) }))
vi.mock('../../lib/materials/shortRequestIo', () => ({ sendShortRequest: io.send }))

import TallyOnSiteTab from './TallyOnSiteTab'

const box = { id: 'a2', jobId: 'j1', label: 'A2', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z' }
const mv = (over: Record<string, unknown>) => ({ id: String(Math.random()), jobId: 'j1', partId: null, partName: 'ZZ test elbow', manufacturer: null, fromContainerId: null, toContainerId: null, note: '', byUserId: null, byName: 'Mateo', source: null, itemId: null, ...over })
const jobs = [{ id: 'j1', hcp_number: '972', job_name: 'ZZ Test', job_address: '1 Test St' }]

beforeEach(() => {
  store.containers = [box]
  store.movements = [mv({ reason: 'delivered', quantity: 10, at: '2026-11-01T10:00:00Z', toContainerId: 'a2' }), mv({ reason: 'counted', quantity: 8, at: '2026-11-08T10:00:00Z', fromContainerId: 'a2' })]
  io.send.mockClear()
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
