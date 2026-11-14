// @vitest-environment jsdom
/**
 * The address of an open box (punch list #209, v2.6904). A label's scan lands on
 * `/tally?tab=on-site&job=<id>&container=<id>`. The page used to read both once and take them off, so
 * the reload a new build makes a few seconds after a scan came back to the box list. Here the real On
 * site tab runs over `useOnSiteAddress`, wired as `JobTally` wires it: the address keeps the job and
 * the box while the box is open, a second load of that address opens the same box, and leaving the
 * box takes them off.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { ToastProvider } from '../../contexts/ToastContext'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import { installDomShims } from '../../test/renderSmokeMocks'

const store = vi.hoisted(() => ({ containers: [] as Array<{ jobId: string }> }))
vi.mock('../../lib/materials/onSiteStore', () => ({
  addContainer: vi.fn(),
  addMovement: vi.fn(),
  addPlace: vi.fn(),
  addPhoto: vi.fn(),
  newId: () => 'id',
  updatePhoto: vi.fn(),
  listContainers: (jobId: string) => store.containers.filter((c) => c.jobId === jobId),
  listMovements: () => [],
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
vi.mock('../../hooks/useOnSiteDeskJobs', () => ({ useOnSiteDeskJobs: () => ({ jobs: [], rows: [], loading: false, loaded: false, error: null, raw: null, retry: () => {} }) }))
vi.mock('../../lib/materials/shortRequestIo', () => ({ sendShortRequest: vi.fn() }))

import TallyOnSiteTab from './TallyOnSiteTab'
import { useOnSiteAddress } from '../../hooks/useOnSiteAddress'

const box = (id: string, jobId: string, label: string) => ({ id, jobId, label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z' })
const jobs = [{ id: 'j1', hcp_number: '972', job_name: 'ZZ Test', job_address: '1 Test St' }, { id: 'j2', hcp_number: '973', job_name: 'ZZ Test Two', job_address: '2 Test St' }]
const SCAN = '/tally?tab=on-site&job=j2&container=zz1'

/** The Tally page's part in it: the jobs land after the first paint, on the list's first job, as `JobTally` loads them. */
function TallyStandIn() {
  const [loaded, setLoaded] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const list = useMemo(() => (loaded ? jobs : []), [loaded])
  const jobIds = useMemo(() => list.map((j) => j.id), [list])
  const address = useOnSiteAddress({ jobIds, onTab: true, selectedJobId, selectJob: setSelectedJobId })
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (loaded) setSelectedJobId((id) => id ?? 'j1')
  }, [loaded])
  return (
    <>
      <output data-testid="address">{location.pathname + location.search}</output>
      <button type="button" onClick={() => setLoaded(true)}>jobs load</button>
      <button type="button" onClick={() => address.pickJob('j1')}>choose the first job</button>
      <button type="button" onClick={() => navigate(SCAN)}>a door to the scanned box</button>
      <TallyOnSiteTab jobs={list} jobsLoading={!loaded} selectedJobId={selectedJobId} onPickJob={address.pickJob} byUserId="u1" byName="Mateo" searchParts={async () => []} initialContainerId={address.asked.containerId} askSeq={address.asked.seq} onOpenContainer={address.reportOpen} />
    </>
  )
}

function load(at: string) {
  installDomShims()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ToastProvider>
      <ConfirmDialogProvider>
        <MemoryRouter initialEntries={[at]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter>
      </ConfirmDialogProvider>
    </ToastProvider>
  )
  return render(<TallyStandIn />, { wrapper })
}
const address = () => screen.getByTestId('address').textContent
const boxOpen = () => screen.findByRole('button', { name: 'Back to the containers' })

beforeEach(() => {
  store.containers = [box('a2', 'j1', 'A2'), box('zz1', 'j2', 'ZZ1')]
})
afterEach(() => cleanup())

describe('TallyOnSiteTab · the address of an open box', () => {
  it('a scan keeps its job and box on the address while the box is open, so a reload opens it again', async () => {
    const first = load(SCAN)
    // Nothing is read, and nothing taken off, before the jobs load.
    expect(address()).toBe(SCAN)
    fireEvent.click(screen.getByRole('button', { name: 'jobs load' }))
    await boxOpen()
    expect(screen.getByText('ZZ1 · cage')).toBeTruthy()
    await waitFor(() => expect(address()).toBe(SCAN))
    // The reload: a new page at the address the first one left.
    const left = address() ?? ''
    first.unmount()
    load(left)
    fireEvent.click(screen.getByRole('button', { name: 'jobs load' }))
    await boxOpen()
    expect(screen.getByText('ZZ1 · cage')).toBeTruthy()
    expect(address()).toBe(SCAN)
  })

  it('leaving the box takes the job and the box off the address', async () => {
    load(SCAN)
    fireEvent.click(screen.getByRole('button', { name: 'jobs load' }))
    fireEvent.click(await boxOpen())
    await waitFor(() => expect(address()).toBe('/tally?tab=on-site'))
    expect(screen.getByRole('searchbox', { name: 'Find a part on this job' })).toBeTruthy()
  })

  it('a box opened by a press goes on the address with its job', async () => {
    load('/tally?tab=on-site')
    fireEvent.click(screen.getByRole('button', { name: 'jobs load' }))
    fireEvent.click(await screen.findByRole('button', { name: /A2/ }))
    await boxOpen()
    await waitFor(() => expect(address()).toBe('/tally?tab=on-site&job=j1&container=a2'))
  })

  it('after a scan, choosing another job opens that job’s boxes, not the scanned box on the wrong job', async () => {
    load(SCAN)
    fireEvent.click(screen.getByRole('button', { name: 'jobs load' }))
    fireEvent.click(await boxOpen())
    fireEvent.click(screen.getByRole('button', { name: 'choose the first job' }))
    expect(await screen.findByRole('button', { name: /A2/ })).toBeTruthy()
    expect(screen.queryByText('That container is not on this job any more.')).toBeNull()
    expect(address()).toBe('/tally?tab=on-site')
  })

  it('a link that names only a job is read and taken off, whether the job was already chosen, another one or unknown', async () => {
    for (const [job, opens] of [['j1', /A2/], ['j2', /ZZ1/], ['nope', /A2/]] as const) {
      const page = load(`/tally?tab=on-site&job=${job}`)
      fireEvent.click(screen.getByRole('button', { name: 'jobs load' }))
      expect(await screen.findByRole('button', { name: opens })).toBeTruthy()
      await waitFor(() => expect(address()).toBe('/tally?tab=on-site'))
      page.unmount()
    }
  })

  it('a door to the box that was scanned and left opens it again', async () => {
    load(SCAN)
    fireEvent.click(screen.getByRole('button', { name: 'jobs load' }))
    fireEvent.click(await boxOpen())
    await waitFor(() => expect(address()).toBe('/tally?tab=on-site'))
    fireEvent.click(screen.getByRole('button', { name: 'a door to the scanned box' }))
    await boxOpen()
    expect(screen.getByText('ZZ1 · cage')).toBeTruthy()
    await waitFor(() => expect(address()).toBe(SCAN))
  })
})
