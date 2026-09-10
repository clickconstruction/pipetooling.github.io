// @vitest-environment jsdom
/**
 * Render smokes for the Bid Board "Bids on a map" card (v2.3162): nothing with
 * no bids; pins from the geocode cache with the section legend and the office
 * anchor; a cold address lands in the "no map location yet" line whose sheet
 * focuses the row; legend chips toggle pins only; a pin click focuses its row;
 * Hide map collapses to the header and persists per device, and the Map pill's
 * reveal signal brings it back; the phone bar's buttons; Play tours the
 * sections two seconds apiece and Pause holds the view (v2.3208).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BidBoardMapCard } from './BidBoardMapCard'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { PinsMapCanvasProps } from '../map/PinsMapCanvas'

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
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: vi.fn() }) }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (u: string) => openExternal(u) }))
vi.mock('../map/PinsMapGoogleCanvas', () => ({
  default: (p: PinsMapCanvasProps & { apiKey: string; onUnavailable: (r: string) => void }) => (
    <div data-testid="google-canvas" data-key={p.apiKey}>
      <button type="button" onClick={() => p.onUnavailable('load: test')}>
        google failed
      </button>
    </div>
  ),
}))
// The Leaflet canvas is lazy + heavy; stand in with a list of pin buttons that drive the same callbacks.
vi.mock('../map/PinsMapCanvas', () => ({
  default: (p: PinsMapCanvasProps) => (
    <div data-testid="canvas" data-anchor={p.anchor ? `${p.anchor.label}:${(p.anchor.ringMiles ?? []).join('/')}` : ''}>
      {p.pins.map((pin) => (
        <button key={pin.id} type="button" onClick={() => p.onSelect(pin.id)} data-color={pin.color} data-ring={pin.ringColor ?? ''}>
          pin {pin.title}
        </button>
      ))}
    </div>
  ),
}))

function bid(p: Partial<BidWithBuilder> & { id: string }): BidWithBuilder {
  return {
    bid_number: '385',
    project_name: 'Galloway Park',
    address: '1400 Oak Hollow Rd',
    outcome: null,
    bid_date_sent: null,
    bid_due_date: null,
    service_type_id: 'st',
    distance_from_office: '96',
    bid_value: null,
    working_board_archived_at: null,
    customers: null,
    bids_gc_builders: null,
    estimator: null,
    ...p,
  } as unknown as BidWithBuilder
}

const onOpenBid = vi.fn()
const onEditBid = vi.fn()
const onFocusRow = vi.fn()

function renderCard(bids: BidWithBuilder[], opts: { isMobile?: boolean; revealSignal?: number } = {}) {
  return render(
    <BidBoardMapCard
      bids={bids}
      ledgerPrefixMap={{}}
      isMobile={opts.isMobile ?? false}
      loading={false}
      onOpenBid={onOpenBid}
      onEditBid={onEditBid}
      onFocusRow={onFocusRow}
      revealSignal={opts.revealSignal ?? 0}
      onReloadBids={vi.fn()}
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
  onOpenBid.mockReset()
  onEditBid.mockReset()
  onFocusRow.mockReset()
  openExternal.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BidBoardMapCard', () => {
  it('renders nothing when the board has no bids', () => {
    const { container } = renderCard([])
    expect(container.innerHTML).toBe('')
  })

  it('pins cached addresses in section colors with the office anchor, and lists a bid the geocoder could not place', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.76, lng: -98.23 }])
    renderCard([bid({ id: 'a', bid_due_date: '2000-01-01' }), bid({ id: 'b', bid_number: '401', project_name: 'Pine Ridge', address: '5100 Pine Ridge Blvd', outcome: 'lost' })])
    expect(screen.getByText('Bids on a map')).toBeTruthy()
    const pinButton = await screen.findByText(/^pin .*385 · Galloway Park$/)
    expect(pinButton.getAttribute('data-color')).toBe('#6b7280')
    // an unsent bid past its due date wears the red ring
    expect(pinButton.getAttribute('data-ring')).toBe('#dc2626')
    expect(screen.getByTestId('canvas').getAttribute('data-anchor')).toBe('Office:25/50')
    expect(screen.getByTitle(/Hide Unsent pins/).textContent).toContain('1')
    // the cold address went to the geocoder once, and its miss lands in the footer line
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1))
    expect((invokeMock.mock.calls[0]![1] as { body: { addresses: string[] } }).body.addresses).toEqual(['5100 Pine Ridge Blvd'])
    await waitFor(() => expect(screen.getByText(/1 bid has no map location yet/)).toBeTruthy())
    // v2.3205: the line is a door — the sheet lists the bid with its address ready to fix,
    // says why it's there, and the bid number still lights the row.
    fireEvent.click(screen.getByText(/1 bid has no map location yet/))
    const sheet = screen.getByRole('dialog', { name: /Bids the map can/ })
    expect(sheet.textContent).toContain('1 the map couldn’t place')
    // v2.3214: the row names its Bid Board stage in words — this one is lost.
    expect(sheet.querySelector('[data-testid="bid-map-stage"]')?.textContent).toBe('Lost')
    expect((screen.getByLabelText(/Address for b401/i) as HTMLInputElement).value).toBe('5100 Pine Ridge Blvd')
    expect(sheet.textContent).toMatch(/couldn’t find this address/)
    fireEvent.click(screen.getByRole('button', { name: /^b401$/i }))
    expect(onFocusRow).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('dialog', { name: /Bids the map can/ })).toBeNull()
  })

  it('legend chips toggle pins on the map only; Lost starts off', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.76, lng: -98.23 }])
    renderCard([bid({ id: 'u' }), bid({ id: 'l', bid_number: '300', project_name: 'Lost One', outcome: 'lost' })])
    await screen.findByText(/^pin .*385 · Galloway Park$/)
    expect(screen.queryByText(/^pin .*300 · Lost One$/)).toBeNull()
    const lostChip = screen.getByTitle(/Show Lost pins/)
    expect(lostChip.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(lostChip)
    expect(screen.getByText(/^pin .*300 · Lost One$/)).toBeTruthy()
    fireEvent.click(screen.getByTitle(/Hide Unsent pins/))
    expect(screen.queryByText(/^pin .*385 · Galloway Park$/)).toBeNull()
  })

  it('a pin click focuses the row on the board', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.76, lng: -98.23 }])
    renderCard([bid({ id: 'a' })])
    fireEvent.click(await screen.findByText(/^pin .*385 · Galloway Park$/))
    expect(onFocusRow).toHaveBeenCalledWith('a')
  })

  it('Hide map collapses to the header, persists per device, and the Map pill reveals it again', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.76, lng: -98.23 }])
    const view = renderCard([bid({ id: 'a' })])
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    fireEvent.click(screen.getByText('Hide map'))
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(screen.getByText('Bids on a map')).toBeTruthy()
    expect(screen.getByText('Show map')).toBeTruthy()
    expect(localStorage.getItem('pipetooling_bid_board_map_hidden')).toBe('1')
    // a fresh mount on this device stays hidden
    view.unmount()
    const again = renderCard([bid({ id: 'a' })])
    expect(screen.queryByTestId('canvas')).toBeNull()
    again.unmount()
    // the Map pill's reveal signal un-hides and clears the preference
    renderCard([bid({ id: 'a' })], { revealSignal: 1 })
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    expect(localStorage.getItem('pipetooling_bid_board_map_hidden')).toBeNull()
  })


  it('the title is the same toggle — tapping Bids on a map hides and shows the card (v2.3205)', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.76, lng: -98.23 }])
    renderCard([bid({ id: 'a' })])
    await screen.findByText('Hide map')
    const title = screen.getByRole('button', { name: 'Bids on a map' })
    expect(title.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(title)
    expect(screen.getByText('Show map')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bids on a map' }).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Bids on a map' }))
    expect(await screen.findByText('Hide map')).toBeTruthy()
  })
  it('phone form: the tapped pin becomes a bar with Open bid, Edit and Directions', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.76, lng: -98.23 }])
    renderCard([bid({ id: 'a' })], { isMobile: true })
    fireEvent.click(await screen.findByText(/^pin .*385 · Galloway Park$/))
    expect(screen.getByText(/96 mi from the office/)).toBeTruthy()
    fireEvent.click(screen.getByText('Open bid'))
    expect(onOpenBid).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    fireEvent.click(screen.getByText('Edit'))
    expect(onEditBid).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    fireEvent.click(screen.getByText('Directions'))
    expect(openExternal).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=1400%20Oak%20Hollow%20Rd')
  })

  it('draws with Google when a browser key is set and falls back to OpenStreetMap when it fails', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.76, lng: -98.23 }])
    renderCard([bid({ id: 'a' })])
    const google = await screen.findByTestId('google-canvas')
    expect(google.getAttribute('data-key')).toBe('test-key')
    fireEvent.click(screen.getByText('google failed'))
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    expect(screen.queryByTestId('google-canvas')).toBeNull()
  })

  it('Play tours the sections that have pins, two seconds each, lighting the chip; a chip click or Pause holds the view', async () => {
    cacheRows.mockReturnValue([
      { address_normalized: '1400 oak hollow rd', lat: 30.76, lng: -98.23 },
      { address_normalized: '5100 pine ridge blvd', lat: 30.2, lng: -97.7 },
      { address_normalized: '77 lost ln', lat: 29.9, lng: -97.9 },
    ])
    renderCard([
      bid({ id: 'u' }),
      bid({ id: 'p', bid_number: '401', project_name: 'Pine Ridge', address: '5100 Pine Ridge Blvd', bid_date_sent: '2026-09-01' }),
      bid({ id: 'l', bid_number: '300', project_name: 'Lost One', address: '77 Lost Ln', outcome: 'lost' }),
    ])
    await screen.findByText(/^pin .*385 · Galloway Park$/)
    await screen.findByText(/^pin .*401 · Pine Ridge$/)
    vi.useFakeTimers()
    const chip = (name: string) => screen.getByTitle(new RegExp(`(Hide|Show) ${name} pins`))
    // Play: the first stop is Unsent, alone on the map, its chip lit
    fireEvent.click(screen.getByText('Play'))
    expect(screen.getByText('Pause')).toBeTruthy()
    expect(chip('Unsent').getAttribute('data-tour-lit')).toBe('true')
    expect(screen.getByText(/^pin .*385 · Galloway Park$/)).toBeTruthy()
    expect(screen.queryByText(/^pin .*401 · Pine Ridge$/)).toBeNull()
    // two seconds later: Pending (Won and Started have no pins and are skipped)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(chip('Pending').getAttribute('data-tour-lit')).toBe('true')
    expect(chip('Unsent').getAttribute('data-tour-lit')).toBeNull()
    expect(screen.getByText(/^pin .*401 · Pine Ridge$/)).toBeTruthy()
    expect(screen.queryByText(/^pin .*385 · Galloway Park$/)).toBeNull()
    // then Lost — a section that starts hidden still gets its turn — then back around to Unsent
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(chip('Lost').getAttribute('data-tour-lit')).toBe('true')
    expect(screen.getByText(/^pin .*300 · Lost One$/)).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(chip('Unsent').getAttribute('data-tour-lit')).toBe('true')
    // Pause holds the view: Unsent stays alone, nothing lit, no more steps
    fireEvent.click(screen.getByText('Pause'))
    expect(screen.getByText('Play')).toBeTruthy()
    expect(chip('Unsent').getAttribute('data-tour-lit')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText(/^pin .*385 · Galloway Park$/)).toBeTruthy()
    expect(screen.queryByText(/^pin .*401 · Pine Ridge$/)).toBeNull()
    // Play again, then a chip click pauses the tour and toggles that chip as usual
    fireEvent.click(screen.getByText('Play'))
    fireEvent.click(chip('Pending'))
    expect(screen.getByText('Play')).toBeTruthy()
    expect(screen.getByText(/^pin .*401 · Pine Ridge$/)).toBeTruthy()
    expect(screen.getByText(/^pin .*385 · Galloway Park$/)).toBeTruthy()
  })

  it('offers no Play with fewer than two sections on the map', async () => {
    cacheRows.mockReturnValue([{ address_normalized: '1400 oak hollow rd', lat: 30.76, lng: -98.23 }])
    renderCard([bid({ id: 'a' })])
    await screen.findByText(/^pin .*385 · Galloway Park$/)
    expect(screen.queryByText('Play')).toBeNull()
  })
})
