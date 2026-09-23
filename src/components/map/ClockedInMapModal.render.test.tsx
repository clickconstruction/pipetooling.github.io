// @vitest-environment jsdom
/**
 * Render smokes for "Where everyone is" (v2.3756): the stops rail from the
 * strip's sessions with head counts; pins from the geocode cache carry the
 * count badge and the office anchor; an unplaced address lands in the
 * "no map location yet" line; a stop click selects its pin and a pin click
 * selects its row; Open job goes through the strip's opener and closes;
 * Directions opens Google Maps; the office and the Not-on-a-job list read
 * from the same sessions; Esc closes; the phone form shows the selected bar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ClockedInMapModal from './ClockedInMapModal'
import type { PinsMapCanvasProps } from './PinsMapCanvas'
import type { ClockSessionRow } from '../../types/clockSessions'

const cacheRows = vi.fn<() => { address_normalized: string; lat: number; lng: number }[]>(() => [])
const invokeMock = vi.fn(async () => ({ data: { results: [] }, error: null }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: async () => ({ data: cacheRows(), error: null }),
      }),
    }),
    functions: { invoke: (...args: unknown[]) => invokeMock(...(args as [])) },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async <T,>(op: () => PromiseLike<{ data: T; error: null }>) => (await op()).data,
}))
vi.mock('../../hooks/useOfficeAnchor', () => ({
  useOfficeAnchor: () => ({ lat: 29.653, lng: -97.797, source: 'office_address', label: '12921 FM 20, Kingsbury, TX 78638' }),
}))
vi.mock('../../hooks/useOverheadOfficeJobId', () => ({ useOverheadOfficeJobId: () => 'office-job' }))
let mobile = false
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => mobile }))
const openExternal = vi.fn()
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (u: string) => openExternal(u) }))
vi.mock('../clock-sessions/AssignSessionJobPopover', async () => {
  const { useState } = await import('react')
  // Stand-in with the real popover's shape: a trigger, then its own dialog while open.
  const AssignSessionJobPopover = (p: { session: { id: string } }) => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Assign {p.session.id}
        </button>
        {open ? (
          <div role="dialog" aria-label="Assign job or bid">
            <button type="button" onClick={() => setOpen(false)}>
              close assign
            </button>
          </div>
        ) : null}
      </>
    )
  }
  return { AssignSessionJobPopover }
})
vi.mock('./PinsMapGoogleCanvas', () => ({ default: () => <div data-testid="google-canvas" /> }))
vi.mock('./PinsMapCanvas', () => ({
  default: (p: PinsMapCanvasProps) => (
    <div data-testid="canvas" data-anchor={p.anchor ? `${p.anchor.label}:${(p.anchor.ringMiles ?? []).join('/')}` : ''} data-selected={p.selectedId ?? ''}>
      {p.pins.map((pin) => (
        <button key={pin.id} type="button" onClick={() => p.onSelect(pin.id)} data-color={pin.color} data-label={pin.label ?? ''}>
          pin {pin.title}
        </button>
      ))}
      {!p.isMobile && p.selectedId && p.renderPopup ? <div data-testid="popup">{p.renderPopup(p.selectedId)}</div> : null}
    </div>
  ),
}))

const VECCHIO = '1160 Lago Vista Dr, San Marcos, TX 78666'
const NOW = new Date('2026-09-22T16:45:00Z').getTime()

function s(p: Partial<ClockSessionRow> & { id: string; user_id: string }): ClockSessionRow {
  return {
    clocked_in_at: '2026-09-22T13:00:00Z',
    clocked_out_at: null,
    work_date: '2026-09-22',
    notes: '',
    job_ledger_id: null,
    bid_id: null,
    clock_in_lat: null,
    clock_in_lng: null,
    clock_out_lat: null,
    clock_out_lng: null,
    clock_in_location_source: null,
    clock_out_location_source: null,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    revoked_at: null,
    revoked_by: null,
    users: { name: p.user_id },
    approved_by_user: null,
    rejected_by_user: null,
    revoked_by_user: null,
    jobs_ledger: null,
    bids: null,
    ...p,
  }
}
const vecchio = (id: string, who: string, at = '2026-09-22T13:00:00Z') =>
  s({ id, user_id: who, job_ledger_id: 'j1', clocked_in_at: at, jobs_ledger: { hcp_number: '1021', click_number: null, job_name: 'Vecchio Pinpoint', job_address: VECCHIO } })
const echols = s({ id: 'e', user_id: 'Malachi', job_ledger_id: 'j2', jobs_ledger: { hcp_number: '1039', click_number: null, job_name: 'Echols', job_address: '1 Echols Rd, Kingsbury, TX' } })
const office = s({ id: 'o', user_id: 'Grace', job_ledger_id: 'office-job', notes: 'New bid', jobs_ledger: { hcp_number: '000', click_number: null, job_name: 'Office', job_address: null } })
const isiah = s({ id: 'i', user_id: 'Isiah', notes: 'Working with micheal' })

const onClose = vi.fn()
const onOpenJob = vi.fn()

function mount(sessions: ClockSessionRow[]) {
  return render(
    <MemoryRouter>
      <ClockedInMapModal sessions={sessions} prefixMap={{}} nowMs={NOW} onClose={onClose} onOpenJob={onOpenJob} workDateYmd="2026-09-22" />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mobile = false
  cacheRows.mockReturnValue([{ address_normalized: '1160 lago vista dr, san marcos, tx 78666', lat: 29.88, lng: -97.94 }])
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
})
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('ClockedInMapModal', () => {
  it('lists the stops most people first with counts, the office and the not-on-a-job people; the placed stop is a badged pin; the cold one is in the unmapped line', async () => {
    mount([vecchio('a', 'Abraham'), echols, vecchio('p', 'Paige', '2026-09-22T12:18:00Z'), office, isiah])
    const dialog = screen.getByRole('dialog', { name: 'Where everyone is' })
    expect(dialog).toBeTruthy()
    const rows = screen.getAllByRole('button', { pressed: false }).filter((b) => /Vecchio|Echols/.test(b.textContent ?? ''))
    expect(rows.map((r) => r.textContent?.slice(0, 22))).toEqual(['2J1021 · Vecchio Pinpo', '1J1039 · Echols1 Echol'])
    expect(rows[0]?.textContent).toContain('Paige 4h 27m · Abraham 3h 45m')
    expect(screen.getByText('Office').parentElement?.textContent).toContain('Grace 3h 45m')
    expect(screen.getByText('Not on a job').parentElement?.textContent).toContain('Isiah 3h 45m · Working with micheal')
    expect(screen.getByRole('button', { name: 'Assign i' })).toBeTruthy()
    expect(screen.getByText('2 stops · 5 people')).toBeTruthy()
    expect(screen.getByText(/Sep 22 · .* · live/)).toBeTruthy()

    const pin = await screen.findByRole('button', { name: 'pin J1021 · Vecchio Pinpoint · 2' })
    expect(pin.getAttribute('data-label')).toBe('2')
    expect(pin.getAttribute('data-color')).toBe('#3b82f6')
    expect(screen.getByTestId('canvas').getAttribute('data-anchor')).toBe('Office:25')
    await waitFor(() => expect(screen.getByText(/1 job has no map location yet/)).toBeTruthy())
    expect(screen.getByText(/1 job has no map location yet/).textContent).toContain('J1039 · Echols')
    // The legend counts stops by kind and people at the office.
    expect(dialog.textContent).toContain('2 jobs')
    expect(dialog.textContent).toContain('0 bids')
    expect(dialog.textContent).toContain('office 1')
  })

  it('a stop row selects its pin (the popup shows the people with since · elapsed); Open job goes through the strip opener and closes; Directions opens Google Maps', async () => {
    mount([vecchio('a', 'Abraham'), vecchio('p', 'Paige', '2026-09-22T12:18:00Z')])
    await screen.findByRole('button', { name: 'pin J1021 · Vecchio Pinpoint · 2' })
    fireEvent.click(screen.getByRole('button', { name: /J1021 · Vecchio Pinpoint.*Paige/ }))
    expect(screen.getByTestId('canvas').getAttribute('data-selected')).toBe('job:j1')
    const popup = screen.getByTestId('popup')
    expect(popup.textContent).toContain('Paige')
    expect(popup.textContent).toMatch(/since \d{1,2}:\d{2} [AP]M · 4h 27m/)
    expect(popup.textContent).toContain('18 mi')
    fireEvent.click(screen.getAllByRole('button', { name: 'Directions' })[0]!)
    expect(openExternal).toHaveBeenCalledWith(expect.stringContaining('google.com/maps/search/?api=1&query=1160%20Lago%20Vista'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Open job' })[0]!)
    expect(onOpenJob).toHaveBeenCalledWith('j1', expect.objectContaining({ job_name: 'Vecchio Pinpoint' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('a pin click selects its row; Esc and × close; the Fit all button shows with a pin and the anchor', async () => {
    mount([vecchio('a', 'Abraham')])
    fireEvent.click(await screen.findByRole('button', { name: 'pin J1021 · Vecchio Pinpoint · 1' }))
    expect(screen.getByRole('button', { name: /J1021 · Vecchio Pinpoint.*Abraham/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Fit all' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('on a phone: the summary line, the selected stop as a bar under the map with two big buttons, the rest listed beneath', async () => {
    mobile = true
    mount([vecchio('a', 'Abraham'), echols, isiah])
    expect(screen.getByText('3 in · 2 stops · 1 not on a job')).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'pin J1021 · Vecchio Pinpoint · 1' }))
    const openJob = screen.getByRole('button', { name: 'Open job' })
    expect(openJob.style.minHeight).toBe('44px')
    // The selected stop left the list below — it is the bar now.
    expect(screen.queryByRole('button', { name: /J1021 · Vecchio Pinpoint.*Abraham/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: /J1039 · Echols/ }).some((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Fit all' })).toBeNull()
  })

  it('Escape while the Assign door is open leaves the map up; once it is closed, Escape closes the map', () => {
    mount([isiah])
    fireEvent.click(screen.getByRole('button', { name: 'Assign i' }))
    expect(screen.getByRole('dialog', { name: 'Assign job or bid' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'close assign' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('with nobody on a job the map says so and the anchor still draws', () => {
    cacheRows.mockReturnValue([])
    mount([isiah])
    expect(screen.getAllByText('Nobody is clocked on a job right now.').length).toBeGreaterThan(0)
    expect(screen.getByTestId('canvas').getAttribute('data-anchor')).toBe('Office:25')
  })
})
