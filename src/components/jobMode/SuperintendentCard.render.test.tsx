// @vitest-environment jsdom
/**
 * Render smoke for the superintendent's card on Job Mode (punch list #242, PR 4): the line's
 * headline and strip from the same read and `projectPace` the board stands on, the target line,
 * the money when it leads, the two presses, a day in hours with no dollar, a failed read's reason,
 * and nothing at all for a job that is not a project.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

import SuperintendentCard from './SuperintendentCard'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { ProjectBoardJob } from '../../lib/jobs/projectBoardRead'

const fixtures = [
  { id: 'r', name: 'Rough In', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: 100, sequence_order: 1 },
  { id: 't', name: 'Top Out', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: 50, sequence_order: 2 },
  { id: 's', name: 'Trim Set', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: null, sequence_order: 3 },
]
const project = (p: Partial<ProjectBoardJob> = {}): ProjectBoardJob => ({
  id: 'job-1',
  hcp_number: '1044',
  click_number: null,
  job_name: 'The Lodge',
  job_address: '1 Hill Rd',
  status: 'working',
  pct_complete: 30,
  revenue: 27000,
  fixtures,
  budgetKind: null,
  budgetHours: null,
  labor: [
    { ymd: '2026-10-20', who: 'Ana', hours: 80 },
    { ymd: '2026-10-21', who: 'Ana', hours: 90 },
  ],
  values: [{ ymd: '2026-10-20', pct: 25, kind: 'report' }],
  spentPct: 95,
  ...p,
})
let answer: () => Promise<{ readsWages: boolean; jobs: ProjectBoardJob[] }> = async () => ({ readsWages: false, jobs: [project()] })
let target: unknown = null
const asked: unknown[] = []

vi.mock('../../hooks/useProjectsBoard', () => ({
  loadProjectBoardRead: (ids: readonly string[]) => {
    asked.push(ids)
    return answer()
  },
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'superintendent', profileName: 'Sam' })
})
vi.mock('../../hooks/useJobStageChecklists', () => ({
  useJobStageChecklists: () => ({
    rows: [
      { fixtureId: 'r', name: 'Rough In', sequenceOrder: 1, state: { kind: 'rough_in', asked: 2, answered: 2, standing: 'ready', ready: true } },
      { fixtureId: 't', name: 'Top Out', sequenceOrder: 2, state: { kind: 'top_out', asked: 3, answered: 1, standing: 'not_ready', ready: false } },
    ],
    stages: [],
    questions: [],
    answersByFixture: new Map(),
    loading: false,
    error: null,
    putAnswer: () => {},
    reload: () => {},
    io: {},
  }),
}))
vi.mock('../../hooks/useExpectedHours', () => ({
  useExpectedHours: () => ({ byJob: target ? new Map([['job-1', target]]) : new Map(), history: [], undo: null, loading: false, error: null, setTarget: vi.fn(), clearTarget: vi.fn(), undoLatest: vi.fn(), reload: () => {} }),
}))
vi.mock('../stageChecklists/StageChecklistSheet', () => ({ StageChecklistSheet: ({ stage }: { stage: { name: string } }) => <div data-testid="checklist-sheet">{stage.name}</div> }))
// The Scoreboard's read: the office's sign-off and the subs' sheet hours ride it onto the card's line (the second walk's slips 3 and 4).
let scoreRead: unknown = null
vi.mock('../../hooks/useSuperintendentScores', () => ({ useSuperintendentScores: () => ({ read: scoreRead, loading: false, error: null, reload: vi.fn() }) }))

describe('SuperintendentCard', () => {
  afterEach(() => {
    cleanup()
    answer = async () => ({ readsWages: false, jobs: [project()] })
    target = null
    scoreRead = null
    asked.length = 0
  })

  it("reads the office's sign-off as the proof and counts the sub's sheet hours in, as the Scoreboard does (slips 3 and 4)", async () => {
    // The walk: 70 h bid baseline, no team hour, a 9 h sub sheet, the office's 25%; the card read "No certified pay app yet" and "0 h in".
    answer = async () => ({ readsWages: false, jobs: [project({ labor: [], pct_complete: 25, spentPct: null, budgetKind: 'bid', budgetHours: 70, plannedFinish: '2026-11-20' })] })
    scoreRead = {
      readsWages: false,
      sharePct: 10,
      burden: 1.2,
      rateUsd: null,
      rateSource: 'roster',
      fromYmd: '2026-11-01',
      toYmd: '2026-11-30',
      rows: [{ userId: 'u1', userName: 'Sam', jobId: 'job-1', jobLabel: 'J1044 The Lodge', status: 'working', priceUsd: 56_343, awardedKind: 'bid', awardedAt: '2026-11-08T18:00:00Z', plannedFinish: '2026-11-20', awardedHours: 70, certifiedPct: 25, signedOn: '2026-11-08', signedBy: 'Taunya', teamHours: 0, subHours: 9, hoursUnder: 8.5, scored: true, signedInPeriod: true, awardedUsd: null, rateUsd: null, earnedUsd: null, actualUsd: null, keptUsd: null, bonusUsd: 0 }],
    }
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    const card = await screen.findByTestId('superintendent-line')
    expect(card.textContent).toContain('70 h budget ◆ from the bid · 9 h in, all on sub sheets')
    expect(card.textContent).toContain("Signed off by the office at 25% on Nov 8 · checklist 3 of 5 ready · the crew's 25% is the signed-off figure.")
    expect(card.textContent).not.toContain('pay app')
    expect(card.textContent).not.toContain('0 h in')
  })

  it('reads the project behind with the money leading, the strip, the proof and the two presses, from the one read', async () => {
    const onSetPct = vi.fn()
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={onSetPct} />)
    const card = await screen.findByTestId('superintendent-line')
    expect(asked[0]).toEqual(['job-1'])
    // 170 h in at 30% on a 260 h track, 95% of the money spent: the money leads by a mile.
    expect(card.dataset.tone).toBe('behind')
    expect(card.textContent).toContain('J1044 · The Lodge')
    expect(screen.getByText('Spending 65 points ahead of the work.')).toBeTruthy()
    expect(screen.getByTestId('pace-strip')).toBeTruthy()
    expect(screen.getAllByTestId('pace-day')).toHaveLength(2)
    expect(screen.getAllByTestId('pace-stage')).toHaveLength(3)
    expect(screen.getByTestId('superintendent-money').textContent).toBe('95% of the money spent at 30% done · 65 points ahead of the work')
    expect(card.textContent).toContain('checklist 3 of 5 ready')
    fireEvent.click(screen.getByRole('button', { name: 'Set the %' }))
    expect(onSetPct).toHaveBeenCalledWith({ id: 'job-1', hcpNumber: 'J1044', jobName: 'The Lodge', label: 'J1044 · The Lodge' })
    fireEvent.click(screen.getByRole('button', { name: 'Open the checklist' }))
    // The next stage with a question left.
    expect(screen.getByTestId('checklist-sheet').textContent).toBe('Top Out')
  })

  it('reads the target the office set as its budget, in words', async () => {
    target = { id: 't1', jobId: 'job-1', hours: 200, from: 260, by: 'Robert', at: '2026-11-01T20:00:00Z', why: 'framed in a week' }
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    const line = await screen.findByTestId('superintendent-target')
    expect(line.textContent).toContain('Expected 200 h, set by Robert on Nov 1 (was 260 h): framed in a week')
    expect(screen.getByText(/200 h budget 🎯 expected/)).toBeTruthy()
  })

  it('opens a tapped day as a window, in hours, with no dollar anywhere', async () => {
    answer = async () => ({ readsWages: false, jobs: [project({ labor: [{ ymd: '2026-10-20', who: 'Ana', hours: 24 }, { ymd: '2026-10-21', who: 'Ana', hours: 24 }], pct_complete: 50, spentPct: 20 })] })
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    await screen.findByTestId('superintendent-line')
    fireEvent.click(screen.getAllByTestId('pace-day')[0]!)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/Tue, Oct 20/)).toBeTruthy()
    const day = screen.getByTestId('day-details')
    expect(day.textContent).toContain('24 h')
    expect(day.textContent).toContain('25% done')
    expect(day.textContent).not.toContain('$')
    expect(day.textContent).not.toContain('Bought that day')
  })

  it('says nothing for a job that is not a project', async () => {
    answer = async () => ({ readsWages: false, jobs: [project({ revenue: 9000, fixtures: [{ id: 'x', name: 'Repipe', stage_kind: 'any', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: null, sequence_order: 1 }] })] })
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    await waitFor(() => expect(asked.length).toBe(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('superintendent-line')).toBeNull()
  })

  it('names a refused read, and draws nothing for a job the read does not return', async () => {
    answer = () => Promise.reject({ message: 'denied', code: '42501' })
    const { unmount } = renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    await screen.findByText(/could not be read|permission|access/i)
    unmount()
    answer = async () => ({ readsWages: false, jobs: [] })
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('superintendent-line')).toBeNull()
  })
})
