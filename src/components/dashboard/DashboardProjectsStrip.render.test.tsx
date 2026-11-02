// @vitest-environment jsdom
/**
 * Render smoke for the leader's Projects strip on the Dashboard (punch list #242, PR 6): the one
 * closed line in Money in's frame with the counts and the worst project named, pressed open to the
 * board's own cards with the door to the board, the choice remembered per device, and the words
 * while the projects read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

import DashboardProjectsStrip, { PROJECTS_STRIP_OPEN_KEY } from './DashboardProjectsStrip'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { projectPace, type ProjectRow } from '../../lib/jobs/projectsBoard'
import { DEFAULT_LINE_BUDGET_SETTINGS } from '../../lib/jobs/lineBudgets'
import type { JobChargeEvent } from '../../lib/jobChargesTimeline'

const fixtures = [
  { id: 'r', name: 'Rough In', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: 100, sequence_order: 1 },
  { id: 't', name: 'Top Out', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: 50, sequence_order: 2 },
  { id: 's', name: 'Trim Set', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: null, sequence_order: 3 },
]
const row = (id: string, no: string, name: string, pct: number | null): ProjectRow => ({ id, hcp_number: no, click_number: null, job_name: name, job_address: '', status: 'working', pct_complete: pct, revenue: 27000, fixtures })
const days = (hours: number): JobChargeEvent[] => [{ source: 'team_labor', dateKey: '2026-10-20', amount: hours * 45, label: 'a', who: 'Ana', hours }]
const card = (r: ProjectRow, hours: number, loading = false) => {
  const pace = projectPace({ row: r, budgetRow: null, burn: loading ? null : { chargeEvents: days(hours), teamHours: hours, revenue: 27000 }, target: null, checklist: { answered: 0, asked: 0 }, settings: DEFAULT_LINE_BUDGET_SETTINGS, targetMarginPct: null })
  return { row: r, pace, line: pace.line, loading, failed: false, events: loading ? [] : days(hours), valueEvents: [] }
}
// Worst first, as the hook sorts them: 200 h in at 30% is behind; 48 h at 50% is ahead; no percent is early.
let cards = [card(row('b', '1050', 'The Bunker', 30), 200), card(row('a', '1044', 'The Lodge', 50), 48), card(row('c', '1060', 'The Barn', null), 10)]
let rows: ProjectRow[] | null = cards.map((c) => c.row)
let failure: { kind: string; message: string } | null = null

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician' })
})
vi.mock('../../hooks/useProjectsBoard', () => ({
  useProjectsBoard: () => ({ rows, cards, targets: { byJob: new Map(), history: [], undo: null, loading: false, error: null, setTarget: vi.fn(), clearTarget: vi.fn(), undoLatest: vi.fn(), reload: () => {} }, loading: rows == null, failure, reload: () => {} }),
}))

describe('DashboardProjectsStrip', () => {
  beforeEach(() => {
    localStorage.clear()
    rows = cards.map((c) => c.row)
    failure = null
  })
  afterEach(cleanup)

  it('reads one closed line: the counts and the worst project named', () => {
    renderWithProviders(<DashboardProjectsStrip />)
    const strip = screen.getByTestId('dashboard-projects-strip')
    expect(strip.getAttribute('aria-expanded')).toBe('false')
    expect(strip.textContent).toContain('3 working')
    expect(strip.textContent).toContain('1 behind')
    expect(strip.textContent).toContain('1 ahead')
    expect(strip.textContent).toContain('1 no reading yet')
    expect(screen.getByTestId('dashboard-projects-worst').textContent).toContain('J1050 · The Bunker')
    expect(strip.textContent).toContain('Open ▾')
    expect(screen.queryByTestId('project-card')).toBeNull()
  })

  it('opens to the board\'s cards with the door to the board, and remembers the choice', () => {
    renderWithProviders(<DashboardProjectsStrip />)
    fireEvent.click(screen.getByTestId('dashboard-projects-strip'))
    expect(screen.getAllByTestId('project-card')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Open the board →' }).getAttribute('href')).toBe('/projects-board')
    expect(localStorage.getItem(PROJECTS_STRIP_OPEN_KEY)).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Close ▴' }))
    expect(screen.queryByTestId('project-card')).toBeNull()
    expect(localStorage.getItem(PROJECTS_STRIP_OPEN_KEY)).toBe('0')
  })

  it('starts open when the device remembers it open', () => {
    localStorage.setItem(PROJECTS_STRIP_OPEN_KEY, '1')
    renderWithProviders(<DashboardProjectsStrip />)
    expect(screen.getAllByTestId('project-card')).toHaveLength(3)
  })

  it('says it is reading while the projects load, and names a refused read', () => {
    rows = null
    const { unmount } = renderWithProviders(<DashboardProjectsStrip />)
    expect(screen.getByRole('status').textContent).toContain('reading the projects…')
    unmount()
    failure = { kind: 'permission', message: 'You don\'t have access to this project list.' }
    renderWithProviders(<DashboardProjectsStrip />)
    expect(screen.getByText(/You don.t have access/)).toBeTruthy()
  })
})
