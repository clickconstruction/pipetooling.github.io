// @vitest-environment jsdom
/**
 * Render smoke for the superintendent's card on Job Mode (punch list #242, PR 4): the line's
 * headline and strip from the same read and `projectPace` the board stands on, the target line,
 * the money when it leads, the two presses, a day in hours with no dollar, a failed read's reason,
 * and nothing at all for a job that is not a project.
 *
 * Since punch list #396 the card's face is the headline, the stages as a rail that ends in the finish
 * day, the hours bar and **Set the %** on the stage in hand. The strip, the budget's source, the proof,
 * the target, the money and the score sit behind **How this is figured**, so each case that reads one
 * of them opens the fold first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

import SuperintendentCard from './SuperintendentCard'
import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import type { ProjectBoardJob } from '../../lib/jobs/projectBoardRead'
import { todayYmdInAppTz } from '../../utils/dateUtils'

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
// His own question on the job (punch list #396 PR 2): the job's tags, by note.
let noteTags: Map<string, unknown[]> = new Map()
vi.mock('../../hooks/useJobNoteTags', () => ({ useJobNoteTags: () => noteTags }))
vi.mock('./AskMasterSheet', () => ({ AskMasterSheet: ({ facts }: { facts: { pct: number | null; hoursWords: string | null; finishWords: string | null; stage?: string | null } }) => <div data-testid="ask-master-sheet">{`${facts.pct}|${facts.hoursWords}|${facts.finishWords}|${facts.stage}`}</div> }))
// My finish date (punch list #396 PR 3): what was said on the job, and the one write.
let finishCalls: unknown[] = []
let finishReadFails = false
const finishSaved: unknown[] = []
vi.mock('../../lib/jobMode/finishCallIo', () => ({
  loadFinishCalls: () => (finishReadFails ? Promise.reject({ message: 'relation does not exist', code: '42P01' }) : Promise.resolve(finishCalls)),
  saveFinishCall: (input: { jobId: string; finishOn: string; planWas: string | null; why: string | null }) => {
    finishSaved.push(input)
    finishCalls = [{ userId: SMOKE_AUTH_USER_ID, finishOn: input.finishOn, planWas: input.planWas, why: input.why, createdAt: new Date().toISOString() }, ...finishCalls]
    return Promise.resolve()
  },
}))
vi.mock('./FinishDateSheet', () => ({ FinishDateSheet: ({ plannedYmd, saidYmd }: { plannedYmd: string | null; saidYmd: string | null }) => <div data-testid="finish-date-sheet">{`${plannedYmd}|${saidYmd}`}</div> }))
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
    noteTags = new Map()
    finishCalls = []
    finishReadFails = false
    finishSaved.length = 0
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
    // The face: the headline, the days of hours left, the finish day at the foot of the rail and the hours as one bar.
    expect(card.textContent).toContain('On pace.')
    expect(screen.getByTestId('pace-days-left').textContent).toBe('3 days of hours left')
    expect(screen.getByTestId('pace-rail-finish').textContent).toContain('Fri, Nov 20')
    expect(screen.queryByTestId('pace-rail-at-pace')).toBeNull()
    expect(screen.getByTestId('pace-hours').textContent).toContain('9 of 70 h')
    // None of the bookkeeping is on the face.
    expect(card.textContent).not.toContain('frozen at award')
    expect(card.textContent).not.toContain('Signed off')
    expect(card.textContent).not.toContain('Scored this month')
    expect(screen.queryByTestId('pace-strip')).toBeNull()
    // One press and it is all there, as it read before.
    fireEvent.click(screen.getByTestId('pace-figured'))
    expect(screen.getByTestId('pace-figured').getAttribute('aria-expanded')).toBe('true')
    expect(card.textContent).toContain('70 h budget ◆ from the bid, frozen at award · 9 h in, all on sub sheets')
    expect(card.textContent).toContain('Planned finish Nov 20. At this pace, Nov 20.')
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
    expect(screen.getByText('Spending 65 points ahead of the work.')).toBeTruthy()
    // The rail: each stage by the crew's own number. Rough In is done, Top Out is in hand at 50, Trim Set is next.
    const rail = screen.getByTestId('pace-rail')
    expect(rail.dataset.from).toBe('stages')
    expect(screen.getAllByTestId('pace-rail-stage').map((r) => r.dataset.state)).toEqual(['done', 'now', 'next'])
    // No planned finish on this job, so the rail has no foot.
    expect(screen.queryByTestId('pace-rail-finish')).toBeNull()
    expect(screen.getByTestId('pace-hours').textContent).toContain('170 of 260 h')
    // The stage in hand carries the press, with where it stands.
    const setPct = screen.getByTestId('pace-rail-set-pct')
    expect(setPct.textContent).toBe('50% · Set the %')
    fireEvent.click(setPct)
    expect(onSetPct).toHaveBeenCalledWith({ id: 'job-1', hcpNumber: 'J1044', jobName: 'The Lodge', label: 'J1044 · The Lodge' })
    fireEvent.click(screen.getByRole('button', { name: 'Open the checklist' }))
    // The next stage with a question left.
    expect(screen.getByTestId('checklist-sheet').textContent).toBe('Top Out')
    // Behind the fold: the strip with its days and stages, the money that leads, the proof and the job's label.
    expect(screen.queryByTestId('pace-strip')).toBeNull()
    fireEvent.click(screen.getByTestId('pace-figured'))
    expect(card.textContent).toContain('J1044 · The Lodge')
    expect(screen.getByTestId('pace-strip')).toBeTruthy()
    expect(screen.getAllByTestId('pace-day')).toHaveLength(2)
    expect(screen.getAllByTestId('pace-stage')).toHaveLength(3)
    expect(screen.getByTestId('superintendent-money').textContent).toBe('95% of the money spent at 30% done · 65 points ahead of the work')
    expect(card.textContent).toContain('checklist 3 of 5 ready')
    // And it folds away again.
    fireEvent.click(screen.getByTestId('pace-figured'))
    expect(screen.queryByTestId('pace-strip')).toBeNull()
  })

  it('with no stage reported, the rail spreads the job percent over the stages and says so behind the fold', async () => {
    // Three stages and 50% for the job: the first is done, and the second is part way, by its share of the hours.
    answer = async () => ({ readsWages: false, jobs: [project({ fixtures: fixtures.map((f) => ({ ...f, progress_pct: null })), pct_complete: 50, spentPct: null })] })
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    const card = await screen.findByTestId('superintendent-line')
    expect(screen.getByTestId('pace-rail').dataset.from).toBe('job')
    expect(screen.getAllByTestId('pace-rail-stage').map((r) => r.dataset.state)).toEqual(['done', 'now', 'next'])
    expect(screen.getByTestId('pace-rail-set-pct').textContent).toMatch(/^\d+% · Set the %$/)
    expect(card.textContent).not.toContain('Stages read from the job’s percent.')
    fireEvent.click(screen.getByTestId('pace-figured'))
    expect(card.textContent).toContain('Stages read from the job’s percent.')
  })

  it('short: the card sits behind its headline, one line, and a press opens it as it is (punch list #384)', async () => {
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} short />)
    const row = await screen.findByTestId('superintendent-line-short')
    // Ahead or behind in one line: the project's own headline, and nothing of the card under it.
    expect(row.textContent).toContain('Spending 65 points ahead of the work.')
    expect(row.textContent).toContain('Tap for the pace card.')
    expect(row.getAttribute('aria-expanded')).toBe('false')
    // The row carries the picture: the work and the hours as two thin bars (punch list #396).
    expect(screen.getByTestId('pace-row-work')).toBeTruthy()
    expect(screen.getByTestId('pace-row-hours')).toBeTruthy()
    expect(screen.queryByTestId('superintendent-line')).toBeNull()
    expect(screen.queryByTestId('pace-rail')).toBeNull()
    fireEvent.click(row)
    // The card: the rail with the press on the stage in hand, and the rest one press further.
    const card = await screen.findByTestId('superintendent-line')
    expect(card.dataset.tone).toBe('behind')
    expect(screen.getByTestId('pace-rail')).toBeTruthy()
    expect(screen.getByTestId('pace-rail-set-pct')).toBeTruthy()
    fireEvent.click(screen.getByTestId('pace-figured'))
    expect(screen.getByTestId('pace-strip')).toBeTruthy()
    expect(screen.getByTestId('superintendent-money')).toBeTruthy()
    // And it folds again.
    fireEvent.click(screen.getByRole('button', { name: 'Fold the pace card' }))
    expect(screen.queryByTestId('superintendent-line')).toBeNull()
    expect(screen.getByTestId('superintendent-line-short')).toBeTruthy()
  })

  it('Ask a master opens the window with the card’s numbers, and the card says who his question waits on (punch list #396 PR 2)', async () => {
    answer = async () => ({ readsWages: false, jobs: [project({ plannedFinish: '2026-11-20' })] })
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    await screen.findByTestId('superintendent-line')
    // Nothing asked yet: the press, and no line under it.
    expect(screen.getByTestId('pace-ask-master').textContent).toBe('Ask a master')
    expect(screen.queryByTestId('pace-asked')).toBeNull()
    fireEvent.click(screen.getByTestId('pace-ask-master'))
    expect(screen.getByTestId('ask-master-sheet').textContent).toBe('30|170 of 260 h|Fri, Nov 20|Top Out')
    cleanup()
    // His question is on the job and not yet answered.
    noteTags = new Map([['n1', [{ noteId: 'n1', taggedUserId: 'm1', taggedName: 'Dana Whitfield', taggerUserId: SMOKE_AUTH_USER_ID, createdAt: new Date().toISOString(), clearedAt: null, clearedHow: null }]]])
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    expect((await screen.findByTestId('pace-asked')).textContent).toBe('Waiting on Dana.')
  })

  it('My finish date: the press opens the window, and his day is a row on the rail’s foot (punch list #396 PR 3)', async () => {
    // A plan far enough off that the card has nothing to ask.
    answer = async () => ({ readsWages: false, jobs: [project({ labor: [], pct_complete: 25, spentPct: null, budgetKind: 'bid', budgetHours: 70, plannedFinish: '2099-01-02' })] })
    finishCalls = [{ userId: SMOKE_AUTH_USER_ID, finishOn: '2099-01-05', planWas: '2099-01-02', why: 'Waiting on the inspector', createdAt: '2026-11-01T15:00:00Z' }]
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    await screen.findByTestId('superintendent-line')
    const said = await screen.findByTestId('pace-rail-said')
    expect(said.textContent).toContain('You said')
    expect(said.textContent).toContain('Mon, Jan 5')
    expect(said.textContent).toContain('Waiting on the inspector')
    expect(screen.queryByTestId('pace-finish-ask')).toBeNull()
    fireEvent.click(screen.getByTestId('pace-finish-date'))
    // The window opens on the plan and on his last word.
    expect(screen.getByTestId('finish-date-sheet').textContent).toBe('2099-01-02|2099-01-05')
  })

  it('the card asks when the plan’s day has come, and Yes says that day in his name', async () => {
    // The plan's day is today, by the app's own calendar.
    const planYmd = todayYmdInAppTz()
    answer = async () => ({ readsWages: false, jobs: [project({ labor: [], pct_complete: 25, spentPct: null, budgetKind: 'bid', budgetHours: 70, plannedFinish: planYmd })] })
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    const askBox = await screen.findByTestId('pace-finish-ask')
    expect(askBox.textContent).toMatch(/^Still finishing \w{3}, \w{3} \d{1,2}\?/)
    fireEvent.click(screen.getByTestId('pace-finish-yes'))
    await waitFor(() => expect(finishSaved).toEqual([{ jobId: 'job-1', finishOn: planYmd, planWas: planYmd, why: null }]))
    // Said today: the question is answered for the day, and his word is on the rail.
    await waitFor(() => expect(screen.queryByTestId('pace-finish-ask')).toBeNull())
    expect((await screen.findByTestId('pace-rail-said')).textContent).toContain('You said')
  })

  it('a finish date read that fails leaves the card whole, with the press still there', async () => {
    finishReadFails = true
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    await screen.findByTestId('superintendent-line')
    expect(screen.getByTestId('pace-rail')).toBeTruthy()
    expect(screen.queryByTestId('pace-rail-said')).toBeNull()
    expect(screen.getByTestId('pace-finish-date').textContent).toBe('My finish date')
  })

  it('reads the target the office set as its budget, in words', async () => {
    target = { id: 't1', jobId: 'job-1', hours: 200, from: 260, by: 'Robert', at: '2026-11-01T20:00:00Z', why: 'framed in a week' }
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    fireEvent.click(await screen.findByTestId('pace-figured'))
    const line = await screen.findByTestId('superintendent-target')
    expect(line.textContent).toContain('Expected 200 h, set by Robert on Nov 1 (was 260 h): framed in a week')
    expect(screen.getByText(/200 h budget 🎯 expected/)).toBeTruthy()
  })

  it('opens a tapped day as a window, in hours, with no dollar anywhere', async () => {
    answer = async () => ({ readsWages: false, jobs: [project({ labor: [{ ymd: '2026-10-20', who: 'Ana', hours: 24 }, { ymd: '2026-10-21', who: 'Ana', hours: 24 }], pct_complete: 50, spentPct: 20 })] })
    renderWithProviders(<SuperintendentCard jobId="job-1" onSetPct={() => {}} />)
    await screen.findByTestId('superintendent-line')
    fireEvent.click(screen.getByTestId('pace-figured'))
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
