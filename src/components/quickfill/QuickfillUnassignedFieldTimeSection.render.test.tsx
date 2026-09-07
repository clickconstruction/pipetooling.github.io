// @vitest-environment jsdom
/**
 * Render smoke for Quickfill → Unassigned field time as a count card (v2.3051):
 * the station counts person-days per company week and links each week to the
 * Team board with the exceptions filter on; the day list and day audit are gone.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { QuickfillUnassignedFieldTimeSection } from './QuickfillUnassignedFieldTimeSection'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { companyWeekStartSundayContaining } from '../../utils/dateUtils'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
// The Match sessions block has its own render test; keep this one about the card.
vi.mock('../people/MatchClockSessionsModal', () => ({ MatchClockSessionsInline: () => null }))

function ymdMinusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const DAY = ymdMinusDays(1)

const TABLE_ROWS: Record<string, unknown[]> = {
  users: [{ role: 'dev' }],
  pay_approved_masters: [],
  people_crew_jobs: [],
  people_crew_bids: [],
  app_settings: [],
  clock_sessions: [
    { id: 's1', user_id: 'u1', work_date: DAY, clocked_in_at: `${DAY}T13:00:00Z`, clocked_out_at: `${DAY}T21:00:00Z`, job_ledger_id: null, bid_id: null, approved_at: `${DAY}T22:00:00Z`, rejected_at: null, revoked_at: null, users: { name: 'Isiah' } },
  ],
}
const RPCS: Record<string, unknown[]> = {
  list_people_pay_flags: [{ person_name: 'Isiah', person_id: 'u1', is_salary: false, record_hours_but_salary: false }],
}

vi.mock('../../lib/supabase', () => {
  function mk(rows: unknown[]): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'or', 'lte', 'gte', 'is', 'not', 'maybeSingle']) b[m] = () => b
    b.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(f, r)
    return b
  }
  return {
    supabase: {
      from: (table: string) => mk(TABLE_ROWS[table] ?? []),
      rpc: (name: string) => mk(RPCS[name] ?? []),
      channel: () => { const c: Record<string, unknown> = {}; c.on = () => c; c.subscribe = () => c; c.unsubscribe = () => Promise.resolve('ok'); return c },
      removeChannel: () => {},
    },
  }
})

describe('QuickfillUnassignedFieldTimeSection', () => {
  it('shows the person-day count and a per-week link into the Team board with the exceptions filter on', async () => {
    renderWithProviders(<QuickfillUnassignedFieldTimeSection />)
    expect(await screen.findByText('1 person-day')).toBeTruthy()
    expect(screen.getByText(/8\.0 h not on a job across 1 person/)).toBeTruthy()
    const week = companyWeekStartSundayContaining(DAY)!
    const link = screen.getByRole('link', { name: /Open the Team board for the week of/ }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe(`/jobs?tab=combined-labor&teamWeek=${DAY}&teamExceptions=1`)
    expect(screen.getByText(/1 person-day · 8\.0 h · 1 person/)).toBeTruthy()
    expect(week <= DAY).toBe(true)
    // The old per-row action is gone.
    expect(screen.queryByText('Open day audit')).toBeNull()
  })
})
