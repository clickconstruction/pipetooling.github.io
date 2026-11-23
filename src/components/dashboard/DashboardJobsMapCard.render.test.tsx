// @vitest-environment jsdom
/**
 * Render smokes for the Dashboard "Your jobs on a map" card (v2.3131): hides
 * with no jobs, pins from the geocode cache with legend counts, cold addresses
 * go to the geocoder and land in the "no map location yet" line when it fails,
 * the head folds the card and the fold persists per device, and the phone form's
 * selected-job bar opens the job and Directions. Since v2.8330 the map opens on
 * the office view, names a job the view leaves out, and Fit all shows every pin.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
// The office the card centres on: none on record unless a case sets one, as before v2.8330.
const officeState: { anchor: { lat: number; lng: number; source: 'office_address'; label: string } | null; settled: boolean } = { anchor: null, settled: true }
vi.mock('../../hooks/useOfficeAnchor', () => ({ useOfficeAnchorState: () => officeState }))
vi.mock('../../lib/map/olderPhotosIo', () => ({ walkOlderPhotos: async () => [] }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (u: string) => openExternal(u) }))
// The card draws in the shared frame (punch list #395), which loads the two canvases. Both stand in here.
// The Google canvas (v2.3145) carries a button that reports the API as unavailable.
vi.mock('../map/PinsMapGoogleCanvas', () => ({
  default: (p: PinsMapCanvasProps & { apiKey: string; onUnavailable: (r: string) => void }) => (
    <div data-testid="google-canvas" data-key={p.apiKey} data-scroll-gate={String(p.scrollZoomAfterClick ?? false)} data-fit={JSON.stringify(p.fitPoints ?? null)}>
      <button type="button" onClick={() => p.onUnavailable('load: test')}>
        google failed
      </button>
    </div>
  ),
}))
// The Leaflet canvas is lazy + heavy; stand in with a list of pin buttons that drive the same callbacks.
vi.mock('../map/PinsMapImageryCanvas', () => ({
  default: (p: PinsMapCanvasProps & { layer: string }) => (
    <div data-testid="canvas" data-layer={p.layer} data-scroll-gate={String(p.scrollZoomAfterClick ?? false)} data-fit={JSON.stringify(p.fitPoints ?? null)} data-fit-signal={p.fitSignal} data-anchor={p.anchor?.label ?? ''}>
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
  cleanup()
  officeState.anchor = null
  officeState.settled = true
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

  it('at a desk the head folds the card, as Assigned Jobs folds, and the fold persists per device', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 }])
    const { unmount } = render(<DashboardJobsMapCard role="dev" assignedJobs={[row({ id: 'a' })]} superintendentJobs={[]} loading={false} isMobile={false} openJobDetailFromDashboardJobRow={openJob} />)
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    const fold = document.querySelector('[data-jobs-map-fold]') as HTMLElement
    expect(fold.tagName).toBe('BUTTON')
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    expect(fold.textContent).toBe('▼Your jobs on a map')
    // The text link is gone: the head is the press.
    expect(screen.queryByText('Hide map')).toBeNull()
    fireEvent.click(fold)
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(fold.textContent).toBe('▶Your jobs on a map')
    expect(screen.queryByText('Show map')).toBeNull()
    // The key Hide map wrote, so a map somebody hid before this version stays hidden.
    expect(localStorage.getItem('pipetooling_dashboard_jobs_map_hidden')).toBe('1')
    unmount()
    // A reload: still folded, and no map is drawn.
    render(<DashboardJobsMapCard role="dev" assignedJobs={[row({ id: 'a' })]} superintendentJobs={[]} loading={false} isMobile={false} openJobDetailFromDashboardJobRow={openJob} />)
    const again = document.querySelector('[data-jobs-map-fold]') as HTMLElement
    expect(again.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('canvas')).toBeNull()
    fireEvent.click(again)
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    expect(localStorage.getItem('pipetooling_dashboard_jobs_map_hidden')).toBeNull()
  })

  it('on a phone the whole head is the fold press: no Hide link, a thumb tall, the triangle and the title inside it', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 }])
    render(<DashboardJobsMapCard role="helpers" assignedJobs={[row({ id: 'a' })]} superintendentJobs={[]} loading={false} isMobile={true} openJobDetailFromDashboardJobRow={openJob} />)
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    const fold = document.querySelector('[data-jobs-map-fold]') as HTMLElement
    const head = fold.closest('[data-dashboard-card-head]') as HTMLElement
    // The press is the only thing in the head and fills its line. One job is one pin: no Fit all to offer.
    expect(head.querySelectorAll('button').length).toBe(1)
    expect(screen.queryByText('Fit all')).toBeNull()
    expect(fold.style.flex).toBe('1 1 100%')
    expect(fold.style.minHeight).toBe('44px')
    expect(fold.querySelector('h2')!.textContent).toBe('Your jobs on a map')
    expect(screen.queryByText('Hide')).toBeNull()
    fireEvent.click(fold)
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(localStorage.getItem('pipetooling_dashboard_jobs_map_hidden')).toBe('1')
  })

  it('a press on Fit all, beside the fold in the head, leaves the card open', async () => {
    cacheRows.mockReturnValue([
      { address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 },
      { address_normalized: '5100 pine ridge blvd', lat: 30.3, lng: -97.9 },
    ])
    render(<DashboardJobsMapCard role="dev" assignedJobs={[row({ id: 'a' }), row({ id: 'b', hcp_number: 'J1031', job_name: 'Pine Ridge', job_address: '5100 Pine Ridge Blvd' })]} superintendentJobs={[]} loading={false} isMobile={false} openJobDetailFromDashboardJobRow={openJob} />)
    const canvas = await screen.findByTestId('canvas')
    const fold = document.querySelector('[data-jobs-map-fold]') as HTMLElement
    const fitAll = screen.getByText('Fit all')
    expect(fold.contains(fitAll)).toBe(false)
    const before = Number(canvas.getAttribute('data-fit-signal'))
    fireEvent.click(fitAll)
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    expect(Number(screen.getByTestId('canvas').getAttribute('data-fit-signal'))).toBe(before + 1)
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

describe('DashboardJobsMapCard: the map opens on the office view (v2.8330)', () => {
  // An invented office and three invented jobs: two near it, one a long way east.
  const OFFICE = { lat: 30.4, lng: -97.8, source: 'office_address' as const, label: '100 Sample Office Pkwy' }
  const jobs = [
    row({ id: 'a' }),
    row({ id: 'b', hcp_number: 'J1031', job_name: 'Pine Ridge', job_address: '5100 Pine Ridge Blvd', status: 'waiting' }),
    row({ id: 'c', hcp_number: 'J1042', job_name: 'Harbor Row', job_address: '77 Harbor Row' }),
  ]
  const cache = [
    { address_normalized: '1400 oak hollow rd', lat: 30.5, lng: -97.7 },
    { address_normalized: '5100 pine ridge blvd', lat: 30.3, lng: -97.9 },
    { address_normalized: '77 harbor row', lat: 33.9, lng: -81.0 },
  ]
  const fit = () => JSON.parse(screen.getByTestId('canvas').getAttribute('data-fit') ?? 'null') as { lat: number; lng: number }[] | null
  const draw = (isMobile: boolean, list = jobs) => render(<DashboardJobsMapCard role="dev" assignedJobs={list} superintendentJobs={[]} loading={false} isMobile={isMobile} openJobDetailFromDashboardJobRow={openJob} />)

  it('on a phone: centred on the office, the far job named under the map, and Fit all shows every pin', async () => {
    officeState.anchor = OFFICE
    cacheRows.mockReturnValue(cache)
    draw(true)
    await waitFor(() => expect(screen.getByText('pin J1042 · Harbor Row')).toBeTruthy())
    // The canvases are asked to fit a box around the office, not the pins.
    const box = fit()!
    expect(box.length).toBe(4)
    expect((Math.min(...box.map((p) => p.lng)) + Math.max(...box.map((p) => p.lng))) / 2).toBeCloseTo(OFFICE.lng, 6)
    expect(Math.max(...box.map((p) => p.lat))).toBeGreaterThan(OFFICE.lat)
    expect(Math.min(...box.map((p) => p.lat))).toBeLessThan(OFFICE.lat)
    // About a hundred miles: well inside two degrees of latitude either way, well short of the far job.
    expect(Math.max(...box.map((p) => p.lat)) - OFFICE.lat).toBeLessThan(2)
    expect(Math.max(...box.map((p) => p.lng))).toBeLessThan(-95)
    // No office mark is drawn: its label would sit on the jobs nearest the office.
    expect(screen.getByTestId('canvas').getAttribute('data-anchor')).toBe('')
    expect(document.querySelector('[data-jobs-map-view]')!.getAttribute('data-jobs-map-view')).toBe('office')
    // Every pin still draws, and the legend counts every job, the far one too.
    expect(screen.getByText('2 working')).toBeTruthy()
    expect(screen.getByText('1 waiting')).toBeTruthy()
    // The job the view leaves out is not lost: the line under the map names it and the press that shows it.
    const line = document.querySelector('[data-jobs-map-view-line]') as HTMLElement
    expect(line.textContent).toBe('1 job is outside the office view. Fit all shows every job.')
    // On a phone the press sits beside the counts, under the head, never inside the fold.
    const press = document.querySelector('[data-jobs-map-view-press]') as HTMLElement
    expect(press.textContent).toBe('Fit all')
    expect(press.style.minHeight).toBe('44px')
    expect(press.closest('[data-dashboard-card-head]')).toBeNull()
    expect(press.parentElement!.textContent).toContain('2 working')
    fireEvent.click(press)
    expect(fit()).toBeNull()
    expect(document.querySelector('[data-jobs-map-view]')!.getAttribute('data-jobs-map-view')).toBe('all')
    expect(document.querySelector('[data-jobs-map-view-line]')!.textContent).toBe('Showing every job on the map.')
    // And a way back, on the same press.
    expect(press.textContent).toBe('Office view')
    fireEvent.click(press)
    expect(fit()!.length).toBe(4)
    expect(document.querySelector('[data-jobs-map-view-line]')!.textContent).toBe('1 job is outside the office view. Fit all shows every job.')
  })

  it('at a desk: the press is in the head beside the fold, and the line under the map names it', async () => {
    officeState.anchor = OFFICE
    cacheRows.mockReturnValue(cache)
    draw(false)
    await waitFor(() => expect(screen.getByText('pin J1042 · Harbor Row')).toBeTruthy())
    expect(fit()!.length).toBe(4)
    const line = document.querySelector('[data-jobs-map-view-line]') as HTMLElement
    expect(line.textContent).toBe('1 job is outside the office view. Fit all shows every job.')
    expect(line.querySelector('button')).toBeNull()
    const head = document.querySelector('[data-dashboard-card-head]') as HTMLElement
    const press = head.querySelector('[data-jobs-map-view-press]') as HTMLElement
    expect(press.textContent).toBe('Fit all')
    fireEvent.click(press)
    expect(fit()).toBeNull()
    expect(press.textContent).toBe('Office view')
    expect((document.querySelector('[data-jobs-map-fold]') as HTMLElement).getAttribute('aria-expanded')).toBe('true')
  })

  it('every job in view: no line about jobs outside, and Fit all is still there to zoom to them', async () => {
    officeState.anchor = OFFICE
    cacheRows.mockReturnValue(cache.slice(0, 2))
    draw(true, jobs.slice(0, 2))
    await waitFor(() => expect(screen.getByText('pin J1031 · Pine Ridge')).toBeTruthy())
    expect(fit()!.length).toBe(4)
    expect(document.querySelector('[data-jobs-map-view-line]')).toBeNull()
    expect(screen.getByText('Fit all')).toBeTruthy()
  })

  it('a folded card opened again opens on the office view', async () => {
    officeState.anchor = OFFICE
    cacheRows.mockReturnValue(cache)
    draw(true)
    await waitFor(() => expect(screen.getByText('pin J1042 · Harbor Row')).toBeTruthy())
    fireEvent.click(screen.getByText('Fit all'))
    expect(fit()).toBeNull()
    const fold = document.querySelector('[data-jobs-map-fold]') as HTMLElement
    fireEvent.click(fold)
    fireEvent.click(fold)
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    expect(fit()!.length).toBe(4)
  })

  it('with no office on record the map fits its pins as it did, and says nothing about an office view', async () => {
    cacheRows.mockReturnValue(cache)
    draw(true)
    await waitFor(() => expect(screen.getByText('pin J1042 · Harbor Row')).toBeTruthy())
    expect(fit()).toBeNull()
    expect(screen.queryByText(/outside the office view/)).toBeNull()
    expect(screen.queryByText('Office view')).toBeNull()
  })

  it('waits for the office before it draws the map, so the map opens on one view', async () => {
    officeState.anchor = null
    officeState.settled = false
    cacheRows.mockReturnValue(cache)
    const { rerender } = draw(true)
    await settle()
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(screen.getByText('2 working')).toBeTruthy()
    officeState.anchor = OFFICE
    officeState.settled = true
    rerender(<DashboardJobsMapCard role="dev" assignedJobs={[...jobs]} superintendentJobs={[]} loading={false} isMobile={true} openJobDetailFromDashboardJobRow={openJob} />)
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    expect(fit()!.length).toBe(4)
  })
})
