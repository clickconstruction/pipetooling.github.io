// @vitest-environment jsdom
/**
 * Render smoke for the Projects board (punch list #242, PR 3): the gate, the cards worst first,
 * the empty state with its door to the Pipeline, a failed read as a retry panel, and the Recent
 * changes strip with Undo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'

import ProjectsBoard from './ProjectsBoard'
import { renderWithProviders } from '../test/renderSmokeMocks'

let rows: unknown[] = []
let failure: unknown = null
let role = 'dev'
const history: unknown[] = []
const undoLatest = vi.fn(() => Promise.resolve(true))

vi.mock('../lib/supabase', () => {
  function builder(): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'range']) b[m] = () => b
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(failure ? { data: null, error: failure } : { data: rows, error: null }).then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: () => builder() } }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  const base = useAuthModuleMock({ role: 'dev', profileName: 'Robert' })
  return { ...base, useAuth: () => ({ ...(base.useAuth as () => Record<string, unknown>)(), role }) }
})
vi.mock('../hooks/useBidVsActualBurnInputs', () => ({
  useBidVsActualBurnInputs: (_enabled: boolean, ids: readonly string[]) => ({
    loading: false,
    inputsByJob: new Map(
      ids.map((id) => [
        id,
        id === 'late'
          ? { chargeEvents: [{ source: 'team_labor', dateKey: '2026-10-20', amount: 9000, label: 'a', hours: 200 }], valueEvents: [], paymentEvents: [], revenue: 27000, fallbackPercent: null, teamHours: 200, cardChargesExcluded: false }
          : { chargeEvents: [{ source: 'team_labor', dateKey: '2026-10-20', amount: 1080, label: 'a', hours: 24 }, { source: 'team_labor', dateKey: '2026-10-21', amount: 1080, label: 'b', hours: 24 }], valueEvents: [], paymentEvents: [], revenue: 27000, fallbackPercent: null, teamHours: 48, cardChargesExcluded: false },
      ]),
    ),
  }),
}))
vi.mock('../hooks/useJobBudgetRows', () => ({ useJobBudgetRows: () => new Map() }))
vi.mock('../hooks/useStageChecklistStates', () => ({ useStageChecklistStates: () => ({ questions: [], answersByFixture: new Map(), loading: false, reload: () => {} }) }))
vi.mock('../hooks/useExpectedHours', () => ({
  useExpectedHours: () => ({ byJob: new Map(), history, undo: history.length ? { kind: 'clear', jobId: 'late' } : null, loading: false, error: null, setTarget: vi.fn(), clearTarget: vi.fn(), undoLatest, reload: () => {} }),
}))

const fixtures = [
  { id: 'r', name: 'Rough In', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: 100, sequence_order: 1 },
  { id: 't', name: 'Top Out', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: 50, sequence_order: 2 },
  { id: 's', name: 'Trim Set', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: null, sequence_order: 3 },
]
const job = (id: string, p: Record<string, unknown> = {}) => ({ id, hcp_number: id === 'late' ? '1050' : '1044', click_number: null, job_name: id === 'late' ? 'The Bunker' : 'The Lodge', job_address: '', status: 'working', pct_complete: 50, revenue: 27000, fixtures: fixtures.map((f) => ({ ...f, id: `${id}-${f.id}` })), ...p })

describe('ProjectsBoard', () => {
  beforeEach(() => {
    failure = null
    role = 'dev'
    history.length = 0
    undoLatest.mockClear()
  })
  afterEach(cleanup)

  it('draws every working project as a card, worst first', async () => {
    rows = [job('fine'), job('late'), job('small', { revenue: 9000, fixtures: [{ id: 'x', name: 'Repipe', stage_kind: 'any', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: null, sequence_order: 1 }] })]
    renderWithProviders(<ProjectsBoard />)
    await waitFor(() => expect(screen.getAllByTestId('project-card')).toHaveLength(2))
    const cards = screen.getAllByTestId('project-card')
    // 200 h in at 50% on a 270 h track is behind; 48 h in is ahead.
    expect(cards[0]!.textContent).toContain('J1050 · The Bunker')
    expect(cards[0]!.dataset.tone).toBe('behind')
    expect(cards[1]!.dataset.tone).toBe('ahead')
    expect(screen.getByText('2 projects')).toBeTruthy()
  })

  it('says what fills the board when nothing is working as a project', async () => {
    rows = []
    renderWithProviders(<ProjectsBoard />)
    await screen.findByText('No working projects yet.')
    expect(screen.getByRole('link', { name: 'Open the Pipeline' }).getAttribute('href')).toBe('/jobs?tab=stages')
  })

  it('draws a failed read as a retry panel with its reason', async () => {
    rows = []
    // A refusal: no retry backoff, the reason drawn at once with no Retry.
    failure = { message: 'permission denied for table jobs_ledger', code: '42501' }
    renderWithProviders(<ProjectsBoard />)
    // The class decides the words, never the raw message: a refusal reads as permission, with no Retry.
    await screen.findByText(/You don.t have permission/)
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
    expect(screen.queryByTestId('project-cards')).toBeNull()
    failure = null
  })

  it('sends a role outside the board away', () => {
    role = 'helpers'
    rows = [job('fine')]
    renderWithProviders(<ProjectsBoard />)
    expect(screen.queryByTestId('projects-board')).toBeNull()
    role = 'dev'
  })

  it('lists the recent changes with Undo for a setter', async () => {
    rows = [job('late')]
    history.push({ kind: 'set', id: 'h1', jobId: 'late', hours: 200, from: 270, by: 'Robert', at: '2026-11-01T20:00:00Z', why: 'framed in a week' })
    renderWithProviders(<ProjectsBoard />)
    await screen.findAllByTestId('project-card')
    expect(screen.getByTestId('targets-history').textContent).toContain('J1050 · The Bunker · 270 → 200 h · Robert · framed in a week')
    screen.getByRole('button', { name: 'Undo the last change' }).click()
    expect(undoLatest).toHaveBeenCalledTimes(1)
    history.length = 0
  })
})
