// @vitest-environment jsdom
/**
 * Hours & approvals on the desk in its two shapes (punch list #217, people-docs-6): the four lines
 * as they are; **Show the strip** draws the last fourteen days with the header's one chip and the
 * presses under it, remembered per person; `?sbs=1` draws both for a dev. The reads are stubbed:
 * one session waiting, two approved, a review a few days back, nobody on the clock.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../../contexts/ToastContext'
import { ConfirmDialogProvider } from '../../../contexts/ConfirmDialogContext'
import { installDomShims, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../../test/renderSmokeMocks'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { PERSON_DESK_HOURS_STRIP_KEY, shortDayWords } from '../../../lib/people/hoursDayStrip'
import { shiftWorkDateYmd } from '../../../lib/peopleHoursClockStripSelectedDay'
import { denverCalendarDayKey } from '../../../utils/dateUtils'
import { shapeViewStorageKey } from '../../prototypes/SideBySide'
import { PersonDeskHoursSection } from './PersonDeskHoursSection'

const today = denverCalendarDayKey(Date.now())
const day = (back: number) => shiftWorkDateYmd(today, -back)
const at = (ymd: string, hour: number) => `${ymd}T${String(hour).padStart(2, '0')}:00:00.000Z`

const waiting = { id: 's-wait', user_id: 'u-hal', work_date: day(1), clocked_in_at: at(day(1), 12), clocked_out_at: at(day(1), 20.5 - 0.5).replace(':00:00.000Z', ':30:00.000Z'), approved_at: null }
const dayRows = [
  { work_date: day(1), clocked_in_at: at(day(1), 12), clocked_out_at: `${day(1)}T20:30:00.000Z`, approved_at: null },
  { work_date: day(2), clocked_in_at: at(day(2), 12), clocked_out_at: at(day(2), 20), approved_at: at(day(2), 22) },
  { work_date: day(3), clocked_in_at: at(day(3), 12), clocked_out_at: `${day(3)}T19:30:00.000Z`, approved_at: at(day(3), 22) },
]
const reviewed = day(5)

vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../jobs/HoursStatementsSection', () => ({ HoursStatementsSection: () => null }))
vi.mock('../../../lib/people/fetchAllPendingClockSessions', () => ({
  fetchAllPendingClockSessions: async () => [
    { ...waiting, clocked_out_at: `${waiting.work_date}T20:30:00.000Z`, notes: '', job_ledger_id: null, bid_id: null, clock_in_lat: null, clock_in_lng: null, clock_out_lat: null, clock_out_lng: null, clock_in_location_source: null, clock_out_location_source: null, approved_by: null, rejected_at: null, rejected_by: null, revoked_at: null, revoked_by: null, users: { name: 'Hal Sample' }, approved_by_user: null, rejected_by_user: null, jobs_ledger: null, bids: null },
  ],
}))
vi.mock('../../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    let select = ''
    for (const op of ['eq', 'is', 'not', 'gte', 'lte', 'limit', 'order', 'in', 'update']) b[op] = () => b
    b.select = (cols: string) => {
      select = cols
      return b
    }
    b.then = (ok: (v: unknown) => unknown) => {
      let data: unknown[] = []
      if (table === 'hours_reviewed') data = [{ end_date: reviewed }]
      else if (table === 'clock_sessions' && select.includes('approved_at')) data = dayRows
      return Promise.resolve({ data, error: null }).then(ok)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  window.localStorage.removeItem(shapeViewStorageKey(PERSON_DESK_HOURS_STRIP_KEY, SMOKE_AUTH_USER_ID))
})

const VIEWER: PersonDeskViewer = { role: 'controller', isDev: false, canAccessPay: true, canAccessHours: true, canAccessVehicles: false, canAccessLicenses: false, canAccessContracts: false, readOnly: false }

function section() {
  return <PersonDeskHoursSection userId="u-hal" payName="Hal Sample" displayName="Hal Sample" viewer={VIEWER} viewerUserId="u-me" changeKey={0} onChanged={() => {}} />
}

describe('PersonDeskHoursSection · the strip behind the switch', () => {
  it('opens on the four lines and offers Show the strip', async () => {
    renderWithProviders(section())
    await screen.findByText('1 session · 8.5h')
    expect(document.querySelector('[data-desk-hours-today]')).toBeTruthy()
    expect(screen.getByText('Not clocked in')).toBeTruthy()
    expect(screen.getByText(/h closed$/)).toBeTruthy()
    expect(screen.getByText('Reviewed through')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open approvals' })).toBeTruthy()
    expect(document.querySelector('[data-person-hours-strip]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show the strip' })).toBeTruthy()
  })

  it('the press draws fourteen days, the one chip, the legend and the presses, and is remembered', async () => {
    renderWithProviders(section())
    await screen.findByText('1 session · 8.5h')
    fireEvent.click(screen.getByRole('button', { name: 'Show the strip' }))
    expect(document.querySelector('[data-desk-hours-today]')).toBeNull()
    const strip = document.querySelector('[data-person-hours-strip]')
    expect(strip).toBeTruthy()
    expect(strip!.querySelectorAll('[data-hours-day]')).toHaveLength(14)
    expect(strip!.querySelectorAll('[data-hours-day="waiting"]')).toHaveLength(1)
    expect(strip!.querySelectorAll('[data-hours-day="approved"]')).toHaveLength(2)
    expect(strip!.querySelector('[data-hours-rule="1"]')).toBeTruthy()
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(`14 days · 2 approved · 1 waiting · reviewed through ${shortDayWords(reviewed)}`)
    expect(screen.getByText('1 waiting · 8.5 h')).toBeTruthy()
    expect(screen.getByText('not clocked in')).toBeTruthy()
    expect(screen.getByText(`reviewed through ${shortDayWords(reviewed)}`)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open approvals · 1' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Hours grid' })).toBeTruthy()
    expect(window.localStorage.getItem(shapeViewStorageKey(PERSON_DESK_HOURS_STRIP_KEY, SMOKE_AUTH_USER_ID))).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: "Show today's look" }))
    expect(document.querySelector('[data-desk-hours-today]')).toBeTruthy()
  })

  it('with ?sbs=1 a dev sees the lines above the strip, captioned, with no switch', async () => {
    render(
      <ToastProvider>
        <ConfirmDialogProvider>
          <MemoryRouter initialEntries={['/people?tab=person&id=u:u-hal&sbs=1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {section()}
          </MemoryRouter>
        </ConfirmDialogProvider>
      </ToastProvider>,
    )
    await screen.findByText('1 session · 8.5h')
    const sbs = screen.getByTestId('person-desk-hours-sbs')
    expect(sbs.querySelector('[data-side-by-side-today] p')?.textContent).toBe('Today')
    expect(sbs.querySelector('[data-side-by-side-shape] p')?.textContent).toBe('With the strip')
    expect(sbs.querySelector('[data-side-by-side-today] [data-desk-hours-today]')).toBeTruthy()
    expect(sbs.querySelector('[data-side-by-side-shape] [data-person-hours-strip]')).toBeTruthy()
    expect(document.querySelector('[data-shape-switch]')).toBeNull()
  })
})
