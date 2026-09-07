// @vitest-environment jsdom
/**
 * Render test for Jobs → Team (v2.2974): the week loads through the four
 * reads, the board classifies a real-shaped week, and Board / Ledger / rows-by
 * people all render from the same record set.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', () => {
  const SESSIONS = [
    { id: 's1', user_id: 'u-isiah', work_date: '2026-09-03', clocked_in_at: '2026-09-03T13:10:00Z', clocked_out_at: '2026-09-03T20:09:00Z', approved_at: '2026-09-03T22:00:00Z', job_ledger_id: 'j878', bid_id: null, users: { name: 'Isiah' }, jobs_ledger: { hcp_number: '878', job_name: 'Take 5- Seguin', job_address: '380 TX-123', service_type_id: null, click_number: null }, bids: null },
    { id: 's2', user_id: 'u-isiah', work_date: '2026-09-05', clocked_in_at: '2026-09-05T13:33:00Z', clocked_out_at: '2026-09-05T14:16:00Z', approved_at: '2026-09-05T20:00:00Z', job_ledger_id: null, bid_id: null, users: { name: 'Isiah' }, jobs_ledger: null, bids: null },
  ]
  const BLOCKS = [
    { id: 'b1', assignee_user_id: 'u-isiah', work_date: '2026-09-03', time_start: '08:00:00', time_end: '12:00:00', job_id: 'j878', bid_id: null, note: null, users: { name: 'Isiah' }, jobs_ledger: { hcp_number: '878', job_name: 'Take 5- Seguin', job_address: '380 TX-123', service_type_id: null, click_number: null }, bids: null },
    { id: 'b2', assignee_user_id: 'u-isiah', work_date: '2026-09-05', time_start: '08:00:00', time_end: '16:00:00', job_id: 'j650', bid_id: null, note: null, users: { name: 'Isiah' }, jobs_ledger: { hcp_number: '650', job_name: 'ATI Schertz', job_address: '5498 Cibolo Valley Dr', service_type_id: null, click_number: null }, bids: null },
  ]
  const TABLES: Record<string, unknown[]> = { clock_sessions: SESSIONS, job_schedule_blocks: BLOCKS, people_labor_jobs: [], app_settings: [] }
  const RPCS: Record<string, unknown[]> = { list_people_pay_flags: [{ person_name: 'Isiah', person_id: null, is_salary: false, record_hours_but_salary: false, show_in_hours: true }] }
  function mk(list: unknown[]) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'in', 'or', 'not', 'gte', 'lte', 'order', 'limit']) b[m] = () => b
    b.single = () => Promise.resolve({ data: null, error: null })
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve({ data: list, error: null }).then(f, r)
    return b
  }
  return {
    supabase: {
      from: (table: string) => mk(TABLES[table] ?? []),
      rpc: (name: string) => mk(RPCS[name] ?? []),
      channel: () => { const c: Record<string, unknown> = {}; c.on = () => c; c.subscribe = () => c; c.unsubscribe = () => Promise.resolve('ok'); return c },
      removeChannel: () => {},
    },
  }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

// Pin "today" inside the sample week so the default week is Aug 30 – Sep 5, 2026.
vi.mock('../../utils/dateUtils', async () => {
  const real = await vi.importActual<typeof import('../../utils/dateUtils')>('../../utils/dateUtils')
  return { ...real, todayYmdInAppTz: () => '2026-09-03' }
})

import { JobsTeamTab } from './JobsTeamTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

afterEach(() => cleanup())

describe('JobsTeamTab', () => {
  it('renders the week board: on-plan chip with ran-long marker, unlinked row with the dispatch suggestion, and a planned-no-clock chip', async () => {
    renderWithProviders(<JobsTeamTab />)
    expect(await screen.findByText(/Sun 8\/30 – Sat 9\/5/)).toBeTruthy()
    // rows: unlinked first, then the job, no office
    const rows = [...document.querySelectorAll('tr[data-team-row]')].map((tr) => tr.getAttribute('data-team-row'))
    expect(rows).toEqual(['none', 'job:j878', 'job:j650'])
    // Thu: 6.98 h against a 4 h block → ran long
    const thu = document.querySelector('[data-team-cell="job:j878|2026-09-03|Isiah"]') as HTMLElement
    expect(thu.getAttribute('title')).toMatch(/ran long/)
    expect(thu.textContent).toMatch(/6\.98 h/)
    // Sat: unlinked 0.72 h with the dispatch suggestion; ATI Schertz planned, no clock
    const sat = document.querySelector('[data-team-cell="none|2026-09-05|Isiah"]') as HTMLElement
    expect(sat.textContent).toMatch(/dispatch: .*ATI Schertz 8a–4p/)
    const miss = document.querySelector('[data-team-cell="job:j650|2026-09-05|Isiah"]') as HTMLElement
    expect(miss.textContent).toMatch(/plan 8\.0 h/)
    // summary + exceptions
    expect(screen.getAllByText('Planned, no clock').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/1 item · newest day first|3 items · newest day first/)).toBeTruthy()
  })

  it('switches to the ledger and to rows by people from the same data', async () => {
    renderWithProviders(<JobsTeamTab />)
    await screen.findByText(/Sun 8\/30 – Sat 9\/5/)
    fireEvent.click(screen.getByRole('button', { name: 'Ledger' }))
    expect(screen.getByText('Where it stands')).toBeTruthy()
    expect(screen.getAllByText('Ran long').length).toBeGreaterThan(0)
    expect(screen.getByText('No clock')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows' }), { target: { value: 'person' } })
    const rows = [...document.querySelectorAll('tr[data-team-row]')].map((tr) => tr.getAttribute('data-team-row'))
    expect(rows).toEqual(['Isiah'])
    // person lens: the chip names the job
    const thu = document.querySelector('[data-team-cell="job:j878|2026-09-03|Isiah"]') as HTMLElement
    expect(thu.textContent).toMatch(/Take 5- Seguin/)
  })
})

describe('JobsTeamTab actions (v2.2978)', () => {
  it('shows the fix for each chip kind to a dev', async () => {
    renderWithProviders(<JobsTeamTab />)
    await screen.findByText(/Sun 8\/30 – Sat 9\/5/)
    const unlinked = document.querySelector('[data-team-cell="none|2026-09-05|Isiah"]') as HTMLElement
    const names = (el: HTMLElement) => [...el.querySelectorAll('button')].map((b) => b.textContent?.trim())
    expect(names(unlinked)).toEqual(['Link to J650', 'Pick job…', 'Split day…'])
    const miss = document.querySelector('[data-team-cell="job:j650|2026-09-05|Isiah"]') as HTMLElement
    expect(names(miss)).toEqual(['Add session', 'Not coming in', 'Adjust plan'])
    const ranLong = document.querySelector('[data-team-cell="job:j878|2026-09-03|Isiah"]') as HTMLElement
    expect(names(ranLong)).toEqual(['Looks right', 'Split day…'])
    // the picker opens with the session ids of the unlinked chip
    fireEvent.click(screen.getAllByRole('button', { name: 'Pick job…' })[0]!)
    expect(await screen.findByText(/Isiah · Sat 9\/5 · 0\.72 h/)).toBeTruthy()
  })
})
