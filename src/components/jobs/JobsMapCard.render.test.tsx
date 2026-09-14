// @vitest-environment jsdom
/**
 * Render smokes for the Pipeline "Jobs on a map" card (v2.3396): nothing with
 * no jobs; pins from the geocode cache in the board's section colors with the
 * office anchor and the Collections ring; a cold address lands in the "no map
 * location yet" line whose number lights the row; legend chips toggle pins
 * only and Paid starts off (its first tap asks the board to load Paid rows);
 * a pin click focuses its row; Hide map collapses to the header and persists
 * per device; the phone bar's buttons. v2.3397: the rail's distance buckets
 * hide pins, an ask row selects its pin, and a Pipeline row hover pulses the
 * pin by delegation on `data-stages-job-id`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JobsMapCard } from './JobsMapCard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PinsMapCanvasProps } from '../map/PinsMapCanvas'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'

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
vi.mock('../../hooks/useOfficeAnchor', () => ({
  useOfficeAnchor: (enabled: boolean) => (enabled ? { lat: 29.653, lng: -97.797, source: 'map_default_view', label: '12921 FM 20, Kingsbury' } : null),
}))
const openExternal = vi.fn()
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (u: string) => openExternal(u) }))
// v2.3398: the As-of history — a small world with one job that did not exist yet on the rewound day.
const historyMock = vi.fn(async () => ({
  jobs: [
    { id: 'a', hcp_number: '1019', click_number: null, job_name: 'Vasquez pretest', job_address: '173 Atlantis, Kyle', status: 'billed', created_ymd: '2026-03-01', collections_ymd: null, customer_id: 'c1', customer_name: 'Maria Vasquez', gc_customer_id: null, gc_name: null, bill_to_party: null },
    { id: 'new', hcp_number: '1030', click_number: null, job_name: 'Born yesterday', job_address: '173 Atlantis, Kyle', status: 'working', created_ymd: ymdAddDays(todayYmdInAppTz(), -5), collections_ymd: null, customer_id: 'c2', customer_name: 'New One', gc_customer_id: null, gc_name: null, bill_to_party: null },
  ],
  moves: [{ job_id: 'a', from_status: 'working', to_status: 'billed', ymd: ymdAddDays(todayYmdInAppTz(), -5) }],
  bills: [],
  payments: [],
  loadedAt: 0,
}))
vi.mock('../../lib/jobs/loadJobsMapHistory', () => ({ loadJobsMapHistory: () => historyMock() }))
// v2.3399: the crew layer — one person on job 'a' on any day asked for.
const crewMock = vi.fn(async (ymd: string) => ({ ymd, peopleByJob: new Map([['a', new Set(['u1', 'u2'])]]), peopleCount: 2 }))
vi.mock('../../lib/jobs/loadJobsMapCrewDay', () => ({ loadJobsMapCrewDay: (ymd: string) => crewMock(ymd) }))
vi.mock('../map/PinsMapGoogleCanvas', () => ({
  default: (p: PinsMapCanvasProps & { apiKey: string; onUnavailable: (r: string) => void }) => <div data-testid="google-canvas" data-key={p.apiKey} />,
}))
// The Leaflet canvas is lazy + heavy; stand in with a list of pin buttons that drive the same callbacks.
vi.mock('../map/PinsMapCanvas', () => ({
  default: (p: PinsMapCanvasProps) => (
    <div data-testid="canvas" data-anchor={p.anchor ? `${p.anchor.label}:${(p.anchor.ringMiles ?? []).join('/')}` : ''} data-pulse={p.pulseId ?? ''}>
      {p.pins.map((pin) => (
        <button key={pin.id} type="button" onClick={() => p.onSelect(pin.id)} data-color={pin.color} data-ring={pin.ringColor ?? ''}>
          pin {pin.title}
        </button>
      ))}
      {!p.isMobile && p.selectedId && p.renderPopup ? <div data-testid="popup">{p.renderPopup(p.selectedId)}</div> : null}
    </div>
  ),
}))

function job(p: Partial<JobWithDetails> & { id: string }): JobWithDetails {
  return {
    hcp_number: '1019',
    click_number: null,
    job_name: 'Vasquez pretest',
    job_address: '173 Atlantis, Kyle',
    status: 'working',
    collections_at: null,
    pct_complete: 60,
    customer_name: 'Maria Vasquez',
    customer_id: 'c1',
    gc_customer_id: null,
    bill_to_party: null,
    invoices: [],
    payments: [],
    materials: [],
    fixtures: [],
    team_members: [],
    ...p,
  } as unknown as JobWithDetails
}

const onOpenJob = vi.fn()
const onEditJob = vi.fn()
const onFocusJob = vi.fn()
const onLoadPaid = vi.fn()
const onNeedLiveRows = vi.fn()

function renderCard(jobs: JobWithDetails[], opts: { isMobile?: boolean; paidLoaded?: boolean } = {}) {
  return render(
    <JobsMapCard
      jobs={jobs}
      isMobile={opts.isMobile ?? false}
      loading={false}
      paidLoaded={opts.paidLoaded ?? false}
      onLoadPaid={onLoadPaid}
      onNeedLiveRows={onNeedLiveRows}
      onOpenJob={onOpenJob}
      onEditJob={onEditJob}
      onFocusJob={onFocusJob}
    />,
  )
}

beforeEach(() => {
  vi.unstubAllEnvs()
  localStorage.clear()
  cacheRows.mockReset()
  cacheRows.mockReturnValue([])
  invokeMock.mockReset()
  invokeMock.mockResolvedValue({ data: { results: [], failures: [] }, error: null })
  onOpenJob.mockReset()
  onEditJob.mockReset()
  onFocusJob.mockReset()
  onLoadPaid.mockReset()
  onNeedLiveRows.mockReset()
  openExternal.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('JobsMapCard', () => {
  it('renders nothing when the board has no jobs', () => {
    const { container } = renderCard([])
    expect(container.innerHTML).toBe('')
  })

  it('asks the board for the live sections’ rows while it is showing, and not while hidden', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    renderCard([job({ id: 'a' })])
    await screen.findByTestId('canvas')
    expect(onNeedLiveRows).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Hide map'))
    fireEvent.click(screen.getByText('Show map'))
    expect(onNeedLiveRows).toHaveBeenCalledTimes(2)
  })

  it('pins cached addresses in section colors with the office anchor and the Collections ring, and lists a job the geocoder could not place', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    renderCard([
      job({ id: 'a', status: 'billed', collections_at: '2026-08-01T00:00:00Z' }),
      job({ id: 'b', hcp_number: '1002', job_name: 'Palmer lot 14', job_address: '5100 Pine Ridge Blvd' }),
    ])
    expect(screen.getByText('Jobs on a map')).toBeTruthy()
    const pinButton = await screen.findByText(/^pin 1019 · Vasquez pretest$/)
    expect(pinButton.getAttribute('data-color')).toBe('#f97316')
    expect(pinButton.getAttribute('data-ring')).toBe('#dc2626')
    expect(screen.getByTestId('canvas').getAttribute('data-anchor')).toBe('Office:25/50')
    expect(screen.getByTitle(/Hide Billed pins/).textContent).toContain('1')
    // the cold address went to the geocoder once, and its miss lands in the footer line as a door to the row
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1))
    expect((invokeMock.mock.calls[0]![1] as { body: { addresses: string[] } }).body.addresses).toEqual(['5100 Pine Ridge Blvd'])
    await waitFor(() => expect(screen.getByText(/1 job has no map location yet/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /^1002$/ }))
    expect(onFocusJob).toHaveBeenCalledWith('b', '1002')
  })

  it('legend chips toggle pins on the map only; Paid starts off and its first tap asks the board to load Paid rows', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    renderCard([job({ id: 'k' }), job({ id: 'p', hcp_number: '900', job_name: 'Paid One', status: 'paid' })])
    await screen.findByText(/^pin 1019 · Vasquez pretest$/)
    expect(screen.queryByText(/^pin 900 · Paid One$/)).toBeNull()
    const paidChip = screen.getByTitle(/Paid jobs load when their section opens/)
    expect(paidChip.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText(/1 pinned · \$0 to collect · Paid 1 off/)).toBeTruthy()
    fireEvent.click(paidChip)
    expect(onLoadPaid).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/^pin 900 · Paid One$/)).toBeTruthy()
    fireEvent.click(screen.getByTitle(/Hide Working pins/))
    expect(screen.queryByText(/^pin 1019 · Vasquez pretest$/)).toBeNull()
  })

  it('a pin click focuses the row and the popup carries the payer, the status, the address and the three doors', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    renderCard([job({ id: 'a', gc_customer_id: 'g1', bill_to_party: 'gc', gcCustomer: { id: 'g1', name: 'Done Right Foundation' } } as Partial<JobWithDetails> & { id: string })])
    fireEvent.click(await screen.findByText(/^pin 1019 · Vasquez pretest$/))
    expect(onFocusJob).toHaveBeenCalledWith('a', '1019')
    const popup = screen.getByTestId('popup')
    expect(popup.textContent).toContain('Bills go to Done Right Foundation')
    expect(popup.textContent).toContain('60% done')
    expect(popup.textContent).toContain('173 Atlantis, Kyle')
    fireEvent.click(screen.getByRole('button', { name: 'Open job' }))
    expect(onOpenJob).toHaveBeenCalledWith('a')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEditJob).toHaveBeenCalledWith('a')
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }))
    expect(openExternal).toHaveBeenCalledWith(expect.stringContaining('173%20Atlantis'))
  })

  it('Hide map collapses to the header and persists per device', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    const view = renderCard([job({ id: 'a' })])
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    fireEvent.click(screen.getByText('Hide map'))
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(screen.getByText('Show map')).toBeTruthy()
    expect(localStorage.getItem('pipetooling_jobs_map_hidden')).toBe('1')
    view.unmount()
    renderCard([job({ id: 'a' })])
    expect(screen.queryByTestId('canvas')).toBeNull()
  })

  it('on a phone a tapped pin becomes a bar with the three buttons', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    renderCard([job({ id: 'a', status: 'billed', invoices: [{ id: 'i1', status: 'billed', amount: 18400 }] as unknown as JobWithDetails['invoices'] })], { isMobile: true })
    fireEvent.click(await screen.findByText(/^pin 1019 · Vasquez pretest$/))
    expect(screen.getByText('$18,400 owed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }))
    expect(openExternal).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Open job' }))
    expect(onOpenJob).toHaveBeenCalledWith('a')
  })

  it('v2.3397: the rail buckets hide pins by distance, and an ask row selects its pin and lights the row', async () => {
    cacheRows.mockReturnValue([
      { address_normalized: '173 atlantis, kyle', lat: 29.7, lng: -97.8 },
      { address_normalized: '9 far rd, dallas', lat: 32.8, lng: -96.8 },
    ])
    renderCard([
      job({ id: 'near', status: 'billed', invoices: [{ id: 'i1', status: 'billed', amount: 18400, billed_at: '2026-07-30T14:00:00Z', estimated_bill_date: null }] as unknown as JobWithDetails['invoices'] }),
      job({ id: 'far', hcp_number: '700', job_name: 'Dallas one', job_address: '9 Far Rd, Dallas' }),
    ])
    await screen.findByText(/^pin 700 · Dallas one$/)
    fireEvent.click(screen.getByTitle(/Hide the 50 mi \+ pins/))
    expect(screen.queryByText(/^pin 700 · Dallas one$/)).toBeNull()
    expect(screen.getByText(/^pin 1019 · Vasquez pretest$/)).toBeTruthy()
    // the ask list names the oldest bill with its age and distance; tapping it selects the pin and lights the row
    const askRow = screen.getByTitle(/1019 · Vasquez pretest — show it on the map/)
    expect(askRow.textContent).toMatch(/Billed \d+ d/)
    fireEvent.click(askRow)
    expect(onFocusJob).toHaveBeenCalledWith('near', '1019')
    expect(screen.getByTestId('popup').textContent).toContain('$18,400 owed')
    expect(screen.getByText(/2 pinned · \$18\.4k to collect/)).toBeTruthy()
  })

  it('v2.3397: hovering a Pipeline row pulses its pin; leaving the rows clears it', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    renderCard([job({ id: 'a' })])
    const canvas = await screen.findByTestId('canvas')
    const row = document.createElement('div')
    row.setAttribute('data-stages-job-id', 'a')
    document.body.appendChild(row)
    act(() => {
      fireEvent.mouseOver(row)
    })
    expect(canvas.getAttribute('data-pulse')).toBe('a')
    act(() => {
      fireEvent.mouseOver(document.body)
    })
    expect(canvas.getAttribute('data-pulse')).toBe('')
    row.remove()
  })

  it('v2.3398: As of rewinds the pins to the day — a job created since is gone, a since-billed job reads Working, the strip says what moved', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    renderCard([job({ id: 'a', status: 'billed' }), job({ id: 'new', hcp_number: '1030', job_name: 'Born yesterday' })])
    await screen.findByText(/^pin 1030 · Born yesterday$/)
    fireEvent.click(screen.getByRole('button', { name: '⏮ As of' }))
    await waitFor(() => expect(historyMock).toHaveBeenCalledTimes(1))
    // today is the slider's right end; nothing changes until it moves
    expect(screen.getByText(/^pin 1030 · Born yesterday$/)).toBeTruthy()
    const slider = screen.getByLabelText(/As-of day/) as HTMLInputElement
    const max = Number(slider.max)
    fireEvent.change(slider, { target: { value: String(max - 30) } })
    await waitFor(() => expect(screen.queryByText(/^pin 1030 · Born yesterday$/)).toBeNull())
    const a = screen.getByText(/^pin 1019 · Vasquez pretest$/)
    expect(a.getAttribute('data-color')).toBe('#3b82f6')
    expect(screen.getByTestId('jobs-map-since-then').textContent).toContain('+1 job started · 1 billed')
    expect(screen.getByText('30 d ago')).toBeTruthy()
    // the jump chip back to today restores the world
    fireEvent.click(screen.getByRole('button', { name: 'today' }))
    await waitFor(() => expect(screen.getByText(/^pin 1030 · Born yesterday$/)).toBeTruthy())
  })

  it('v2.3397: the rail buckets hide pins by distance, and an ask row selects its pin and lights the row', async () => {
    cacheRows.mockReturnValue([
      { address_normalized: '173 atlantis, kyle', lat: 29.7, lng: -97.8 },
      { address_normalized: '9 far rd, dallas', lat: 32.8, lng: -96.8 },
    ])
    renderCard([
      job({ id: 'near', status: 'billed', invoices: [{ id: 'i1', status: 'billed', amount: 18400, billed_at: '2026-07-30T14:00:00Z', estimated_bill_date: null }] as unknown as JobWithDetails['invoices'] }),
      job({ id: 'far', hcp_number: '700', job_name: 'Dallas one', job_address: '9 Far Rd, Dallas' }),
    ])
    await screen.findByText(/^pin 700 · Dallas one$/)
    fireEvent.click(screen.getByTitle(/Hide the 50 mi \+ pins/))
    expect(screen.queryByText(/^pin 700 · Dallas one$/)).toBeNull()
    expect(screen.getByText(/^pin 1019 · Vasquez pretest$/)).toBeTruthy()
    // the ask list names the oldest bill with its age and distance; tapping it selects the pin and lights the row
    const askRow = screen.getByTitle(/1019 · Vasquez pretest — show it on the map/)
    expect(askRow.textContent).toMatch(/Billed \d+ d/)
    fireEvent.click(askRow)
    expect(onFocusJob).toHaveBeenCalledWith('near', '1019')
    expect(screen.getByTestId('popup').textContent).toContain('$18,400 owed')
    expect(screen.getByText(/2 pinned · \$18\.4k to collect/)).toBeTruthy()
  })

  it('v2.3397: hovering a Pipeline row pulses its pin; leaving the rows clears it', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    renderCard([job({ id: 'a' })])
    const canvas = await screen.findByTestId('canvas')
    const row = document.createElement('div')
    row.setAttribute('data-stages-job-id', 'a')
    document.body.appendChild(row)
    act(() => {
      fireEvent.mouseOver(row)
    })
    expect(canvas.getAttribute('data-pulse')).toBe('a')
    act(() => {
      fireEvent.mouseOver(document.body)
    })
    expect(canvas.getAttribute('data-pulse')).toBe('')
    row.remove()
  })

  it('v2.3399: the Crews layer rings the pins with a crew that day, says so in the popup and on the rail, and remembers the choice', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    renderCard([job({ id: 'a', status: 'billed', collections_at: '2026-08-01T00:00:00Z' }), job({ id: 'b', hcp_number: '1002', job_name: 'Quiet one' })])
    const pinA = await screen.findByText(/^pin 1019 · Vasquez pretest$/)
    expect(pinA.getAttribute('data-ring')).toBe('#dc2626')
    expect(crewMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Crews' }))
    await waitFor(() => expect(crewMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText(/^pin 1019 · Vasquez pretest$/).getAttribute('data-ring')).toBe('#8b5cf6'))
    expect(screen.getByText(/^pin 1002 · Quiet one$/).getAttribute('data-ring')).toBe('')
    expect(screen.getByTestId('jobs-map-crew-line').textContent).toContain('Crews today: 2 people on 1 job')
    fireEvent.click(screen.getByText(/^pin 1019 · Vasquez pretest$/))
    expect(screen.getByTestId('popup').textContent).toContain('2 people clocked in here today')
    expect(localStorage.getItem('pipetooling_jobs_map_crews')).toBe('1')
  })

  it('uses the Google canvas when a browser key is configured', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    cacheRows.mockReturnValue([{ address_normalized: '173 atlantis, kyle', lat: 30.0, lng: -97.9 }])
    renderCard([job({ id: 'a' })])
    await waitFor(() => expect(screen.getByTestId('google-canvas').getAttribute('data-key')).toBe('test-key'))
  })
})
