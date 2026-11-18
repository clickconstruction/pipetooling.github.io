// @vitest-environment jsdom
/**
 * Render smokes for the Dashboard "Your jobs on a map" card (v2.3131): hides
 * with no jobs, pins from the geocode cache with legend counts, cold addresses
 * go to the geocoder and land in the "no map location yet" line when it fails,
 * Hide map persists per device, and the phone form's selected-job bar opens
 * the job and Directions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DashboardJobsMapCard } from './DashboardJobsMapCard'
import type { DashboardTeamAssignedJobRow } from '../../lib/dashboardTeamAssignedJobRow'
import type { PinsMapCanvasProps } from '../map/PinsMapCanvas'
import { settle } from '../../test/renderSmokeMocks'

const cacheRows = vi.fn<() => { address_normalized: string; lat: number; lng: number }[]>(() => [])
const invokeMock = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: async () => ({ data: cacheRows(), error: null }),
      }),
    }),
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async <T,>(op: () => PromiseLike<{ data: T; error: null }>) => (await op()).data,
}))
const openExternal = vi.fn()
vi.mock('../../lib/map/olderPhotosIo', () => ({ walkOlderPhotos: async () => [] }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (u: string) => openExternal(u) }))
// The card draws in the shared frame (punch list #395), which loads the two canvases. Both stand in here.
// The Google canvas (v2.3145) carries a button that reports the API as unavailable.
vi.mock('../map/PinsMapGoogleCanvas', () => ({
  default: (p: PinsMapCanvasProps & { apiKey: string; onUnavailable: (r: string) => void }) => (
    <div data-testid="google-canvas" data-key={p.apiKey} data-scroll-gate={String(p.scrollZoomAfterClick ?? false)}>
      <button type="button" onClick={() => p.onUnavailable('load: test')}>
        google failed
      </button>
    </div>
  ),
}))
// The Leaflet canvas is lazy + heavy; stand in with a list of pin buttons that drive the same callbacks.
vi.mock('../map/PinsMapImageryCanvas', () => ({
  default: (p: PinsMapCanvasProps & { layer: string }) => (
    <div data-testid="canvas" data-layer={p.layer} data-scroll-gate={String(p.scrollZoomAfterClick ?? false)}>
      {p.pins.map((pin) => (
        <button key={pin.id} type="button" onClick={() => p.onSelect(pin.id)}>
          pin {pin.title}
        </button>
      ))}
      {/* A phone gets no popup: the card draws the selected job as a bar under the map. */}
      {!p.isMobile && p.selectedId && p.renderPopup ? <div data-testid="popup">{p.renderPopup(p.selectedId)}</div> : null}
    </div>
  ),
}))

function row(p: Partial<DashboardTeamAssignedJobRow> & { id: string }): DashboardTeamAssignedJobRow {
  return {
    hcp_number: 'J1021',
    job_name: 'Bexley Park Bldg C',
    job_address: '1400 Oak Hollow Rd',
    google_drive_link: null,
    job_plans_link: null,
    revenue: null,
    created_at: null,
    status: 'working',
    ...p,
  }
}

const openJob = vi.fn()

beforeEach(() => {
  vi.unstubAllEnvs()
  // Blank the key a developer's .env.local may set, so the OpenStreetMap path is the default here as in CI.
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
  localStorage.clear()
  cacheRows.mockReset()
  cacheRows.mockReturnValue([])
  invokeMock.mockReset()
  invokeMock.mockResolvedValue({ data: { results: [], failures: [] }, error: null })
  openJob.mockReset()
  openExternal.mockReset()
})

describe('DashboardJobsMapCard', () => {
  it('renders nothing when there are no jobs', () => {
    const { container } = render(
      <DashboardJobsMapCard role="subcontractor" assignedJobs={[]} superintendentJobs={[]} loading={false} isMobile={false} openJobDetailFromDashboardJobRow={openJob} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('pins cached addresses, counts the legend, and lists a job the geocoder could not place', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 }])
    render(
      <DashboardJobsMapCard
        role="superintendent"
        assignedJobs={[row({ id: 'a' })]}
        superintendentJobs={[row({ id: 'b', hcp_number: 'J1031', job_name: 'Pine Ridge', job_address: '5100 Pine Ridge Blvd', status: undefined })]}
        loading={false}
        isMobile={false}
        openJobDetailFromDashboardJobRow={openJob}
      />,
    )
    await settle()
    expect(screen.getByText('Your jobs on a map')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('pin J1021 · Bexley Park Bldg C')).toBeTruthy())
    expect(screen.getByText('1 working')).toBeTruthy()
    // the cold address went to the geocoder once, and its miss lands in the footer line
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1))
    expect(invokeMock.mock.calls[0]![0]).toBe('geocode-address-batch')
    expect((invokeMock.mock.calls[0]![1] as { body: { addresses: string[] } }).body.addresses).toEqual(['5100 Pine Ridge Blvd'])
    await waitFor(() => expect(screen.getByText(/1 job has no map location yet/)).toBeTruthy())
    fireEvent.click(screen.getByText('J1031 · Pine Ridge'))
    expect(openJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }))
  })

  it('Hide map collapses the card and persists per device', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 }])
    render(<DashboardJobsMapCard role="dev" assignedJobs={[row({ id: 'a' })]} superintendentJobs={[]} loading={false} isMobile={false} openJobDetailFromDashboardJobRow={openJob} />)
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    fireEvent.click(screen.getByText('Hide map'))
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(screen.getByText('Show map')).toBeTruthy()
    expect(localStorage.getItem('pipetooling_dashboard_jobs_map_hidden')).toBe('1')
  })

  it('phone form: tapping a pin shows the selected bar with Open job and Directions', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 }])
    render(<DashboardJobsMapCard role="helpers" assignedJobs={[row({ id: 'a' })]} superintendentJobs={[]} loading={false} isMobile={true} openJobDetailFromDashboardJobRow={openJob} />)
    await waitFor(() => expect(screen.getByText('pin J1021 · Bexley Park Bldg C')).toBeTruthy())
    fireEvent.click(screen.getByText('pin J1021 · Bexley Park Bldg C'))
    expect(screen.getByText('Working')).toBeTruthy()
    fireEvent.click(screen.getByText('Directions'))
    expect(openExternal).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=1400%20Oak%20Hollow%20Rd')
    fireEvent.click(screen.getByText('Open job'))
    expect(openJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
  })

  it('on a computer a pin opens its popup, with Open job and Directions', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 }])
    render(<DashboardJobsMapCard role="dev" assignedJobs={[row({ id: 'a' })]} superintendentJobs={[]} loading={false} isMobile={false} openJobDetailFromDashboardJobRow={openJob} />)
    fireEvent.click(await screen.findByText('pin J1021 · Bexley Park Bldg C'))
    const popup = screen.getByTestId('popup')
    expect(popup.textContent).toContain('1400 Oak Hollow Rd')
    fireEvent.click(screen.getByText('Open job'))
    expect(openJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    fireEvent.click(screen.getByText('Directions'))
    expect(openExternal).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=1400%20Oak%20Hollow%20Rd')
  })

  it('opens on Streets as it always has, with Satellite and Time beside it (punch list #395)', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 }])
    render(<DashboardJobsMapCard role="dev" assignedJobs={[row({ id: 'a' })]} superintendentJobs={[]} loading={false} isMobile={false} openJobDetailFromDashboardJobRow={openJob} />)
    const canvas = await screen.findByTestId('canvas')
    expect(canvas.getAttribute('data-layer')).toBe('streets')
    expect(screen.getByRole('button', { name: 'Streets' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Satellite' }))
    expect(canvas.getAttribute('data-layer')).toBe('satellite')
    // One job is one dot, so Time needs no press on it: the row opens on that job.
    fireEvent.click(document.querySelector('[data-map-time-press]') as HTMLButtonElement)
    await waitFor(() => expect(document.querySelector('[data-map-time-caption]')?.textContent).toContain('Today’s photo of J1021 · Bexley Park Bldg C'))
    expect(document.querySelector('[data-map-provider]')?.getAttribute('data-map-provider')).toBe('archive')
  })

  it('draws with OpenStreetMap when no Google browser key is configured', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 }])
    render(<DashboardJobsMapCard role="dev" assignedJobs={[row({ id: 'a' })]} superintendentJobs={[]} loading={false} isMobile={false} openJobDetailFromDashboardJobRow={openJob} />)
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    expect(screen.queryByTestId('google-canvas')).toBeNull()
  })

  it('draws with Google Maps when a key is set, and falls back to OpenStreetMap once the API reports it cannot load', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'AIza-test')
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 }])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<DashboardJobsMapCard role="dev" assignedJobs={[row({ id: 'a' })]} superintendentJobs={[]} loading={false} isMobile={false} openJobDetailFromDashboardJobRow={openJob} />)
    await waitFor(() => expect(screen.getByTestId('google-canvas')).toBeTruthy())
    expect(screen.getByTestId('google-canvas').getAttribute('data-key')).toBe('AIza-test')
    expect(screen.queryByTestId('canvas')).toBeNull()
    fireEvent.click(screen.getByText('google failed'))
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    expect(screen.queryByTestId('google-canvas')).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('load: test'))
    warn.mockRestore()
  })

  it('v2.3963: asks both canvases to keep the wheel for the page until the map is clicked', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'AIza-test')
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 }])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<DashboardJobsMapCard role="dev" assignedJobs={[row({ id: 'a' })]} superintendentJobs={[]} loading={false} isMobile={false} openJobDetailFromDashboardJobRow={openJob} />)
    expect((await screen.findByTestId('google-canvas')).getAttribute('data-scroll-gate')).toBe('true')
    fireEvent.click(screen.getByText('google failed'))
    expect((await screen.findByTestId('canvas')).getAttribute('data-scroll-gate')).toBe('true')
    warn.mockRestore()
  })
})
