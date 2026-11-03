// @vitest-environment jsdom
/**
 * Render smoke for the Projects board (punch list #242, PR 3): the gate, the cards worst first,
 * the empty state with its door to the Pipeline, a failed read as a retry panel, and the Recent
 * changes strip with Undo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import ProjectsBoard from './ProjectsBoard'
import { PROJECT_GATE_WORDS } from '../lib/jobs/projectsBoard'
import { renderWithProviders } from '../test/renderSmokeMocks'

let rows: unknown[] = []
let failure: unknown = null
let role = 'dev'
const history: unknown[] = []
const undoLatest = vi.fn(() => Promise.resolve(true))
let readsWages = true
const rpcCalls: Array<{ name: string; args: { p_job_ids?: string[] } }> = []
const burnEnabled: boolean[] = []

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: { p_job_ids?: string[] }) => {
      rpcCalls.push({ name, args })
      return Promise.resolve(failure ? { data: null, error: failure } : { data: { reads_wages: readsWages, jobs: rows }, error: null })
    },
  },
}))
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  const base = useAuthModuleMock({ role: 'dev', profileName: 'Robert' })
  return { ...base, useAuth: () => ({ ...(base.useAuth as () => Record<string, unknown>)(), role }) }
})
vi.mock('../hooks/useBidVsActualBurnInputs', () => ({
  useBidVsActualBurnInputs: (enabled: boolean, ids: readonly string[]) => {
    burnEnabled.push(enabled)
    return {
      loading: false,
      inputsByJob: new Map(enabled ? ids.map((id) => [id, { chargeEvents: [{ source: 'team_labor', dateKey: '2026-10-20', amount: 1080, label: 'a', who: 'Ana', hours: 24 }], valueEvents: [], paymentEvents: [], revenue: 27000, fallbackPercent: null, teamHours: 24, cardChargesExcluded: false }]) : []),
    }
  },
}))
vi.mock('../hooks/useStageChecklistStates', () => ({ useStageChecklistStates: () => ({ questions: [], answersByFixture: new Map(), loading: false, reload: () => {} }) }))
vi.mock('../hooks/useExpectedHours', () => ({
  useExpectedHours: () => ({ byJob: new Map(), history, undo: history.length ? { kind: 'clear', jobId: 'late' } : null, loading: false, error: null, setTarget: vi.fn(), clearTarget: vi.fn(), undoLatest, reload: () => {} }),
}))

const fixtures = [
  { id: 'r', name: 'Rough In', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: 100, sequence_order: 1 },
  { id: 't', name: 'Top Out', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: 50, sequence_order: 2 },
  { id: 's', name: 'Trim Set', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: null, sequence_order: 3 },
]
const job = (id: string, p: Record<string, unknown> = {}) => ({ id, hcp_number: id === 'late' ? '1050' : '1044', click_number: null, job_name: id === 'late' ? 'The Bunker' : 'The Lodge', job_address: '', status: 'working', pct_complete: 50, revenue: 27000, budget_kind: null, budget_hours: null, spent_pct: null, values: [], labor: id === 'late' ? [{ ymd: '2026-10-20', who: 'Ana', hours: 200 }] : [{ ymd: '2026-10-20', who: 'Ana', hours: 24 }, { ymd: '2026-10-21', who: 'Ana', hours: 24 }], fixtures: fixtures.map((f) => ({ ...f, id: `${id}-${f.id}` })), ...p })

describe('ProjectsBoard', () => {
  beforeEach(() => {
    failure = null
    role = 'dev'
    readsWages = true
    history.length = 0
    undoLatest.mockClear()
    rpcCalls.length = 0
    burnEnabled.length = 0
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

  it('goes by the job\'s kind, with the guess only for a job whose kind is not set', async () => {
    const repipe = (price: number) => ({ revenue: price, fixtures: [{ id: 'x', name: 'Repipe', stage_kind: 'any', line_kind: 'fixture', line_unit_price: price, count: 1, progress_pct: null, sequence_order: 1 }] })
    const facts = { kind: null, bid_id: null, project_id: null, first_work_date: '2026-10-01', billing_only: false }
    rows = [
      // A small job with a bid behind it reads Project, so it lands here under the old price.
      job('small-bid', { ...facts, ...repipe(9000), bid_id: 'b1', job_name: 'Small bid' }),
      // An HCP job over the old price, worked and with nothing behind it, reads Service call.
      job('big-service', { ...facts, ...repipe(90000), job_name: 'Big service' }),
      // With no number, no bid and no stage, the kind is not set: the price still decides.
      job('big-unset', { ...facts, ...repipe(30000), hcp_number: '', click_number: 'C77', job_name: 'Big unset' }),
      job('small-unset', { ...facts, ...repipe(9000), hcp_number: '', click_number: 'C78', job_name: 'Small unset' }),
    ]
    renderWithProviders(<ProjectsBoard />)
    await waitFor(() => expect(screen.getAllByTestId('project-card')).toHaveLength(2))
    const titles = screen.getAllByTestId('project-card').map((c) => c.textContent ?? '')
    expect(titles.some((t) => t.includes('Small bid'))).toBe(true)
    expect(titles.some((t) => t.includes('Big unset'))).toBe(true)
    expect(titles.some((t) => t.includes('Big service') || t.includes('Small unset'))).toBe(false)
    expect(screen.getByText(PROJECT_GATE_WORDS)).toBeTruthy()
  })

  it('stands every role on the one server read, and asks for dollars only for a viewer whose read carries them', async () => {
    rows = [job('fine'), job('late')]
    readsWages = false
    role = 'superintendent'
    renderWithProviders(<ProjectsBoard />)
    await waitFor(() => expect(screen.getAllByTestId('project-card')).toHaveLength(2))
    // The whole board sends no ids at all, so the function's default stands.
    expect(rpcCalls[0]).toEqual({ name: 'list_project_board', args: {} })
    // The superintendent reads the same tones the leader does, with no read of his own.
    const cards = screen.getAllByTestId('project-card')
    expect(cards[0]!.dataset.tone).toBe('behind')
    expect(cards[1]!.dataset.tone).toBe('ahead')
    expect(burnEnabled.every((e) => e === false)).toBe(true)
    expect((screen.getByLabelText('Expected hours for J1050 · The Bunker') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByText('Job ›')).toBeNull()
  })

  it('asks a payroll viewer\'s own read for the dollars on a day', async () => {
    rows = [job('fine')]
    readsWages = true
    renderWithProviders(<ProjectsBoard />)
    await screen.findByTestId('project-card')
    await waitFor(() => expect(burnEnabled[burnEnabled.length - 1]).toBe(true))
    expect(screen.getByText('Job ›')).toBeTruthy()
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
    await screen.findByText(/You don.t have access to this project list/)
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

  it('opens the project the Costs tab came from large, and says so when it is not on the board (PR 5)', async () => {
    rows = [job('fine'), job('late')]
    render(
      <MemoryRouter initialEntries={['/projects-board?job=late']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProjectsBoard />
      </MemoryRouter>,
    )
    await screen.findByTestId('project-card-big')
    // The window's title names the project; the card under it does not say it twice.
    expect(screen.getByRole('dialog').textContent).toContain('J1050 · The Bunker')
    expect(screen.queryByTestId('focus-missing')).toBeNull()
    cleanup()
    render(
      <MemoryRouter initialEntries={['/projects-board?job=gone']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProjectsBoard />
      </MemoryRouter>,
    )
    expect((await screen.findByTestId('focus-missing')).textContent).toContain('press Project under Kind on its Edit tab')
    expect(screen.queryByTestId('project-card-big')).toBeNull()
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
