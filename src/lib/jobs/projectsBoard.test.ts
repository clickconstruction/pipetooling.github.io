import { describe, expect, it } from 'vitest'

import { canSeeProjectsBoard, canSetExpectedHours, checklistCountOf, isWorkingProject, paceCounts, paceRank, PROJECT_GATE_WORDS, projectLabel, projectPace, sortByPace, worstWords, type ProjectFixture, type ProjectRow } from './projectsBoard'
import { plainWordsFailures } from '../plainWords'
import { DEFAULT_LINE_BUDGET_SETTINGS } from './lineBudgets'
import type { SuperintendentLine } from './superintendentLine'
import type { ProjectBoardJob } from './projectBoardRead'

const fixture = (p: Partial<ProjectFixture> & { id: string }): ProjectFixture => ({ name: p.id, stage_kind: 'any', line_kind: 'fixture', line_unit_price: 1000, count: 1, progress_pct: null, sequence_order: 0, ...p })
const row = (p: Partial<ProjectRow> & { id: string }): ProjectRow => ({ hcp_number: '1044', click_number: null, job_name: 'The Lodge', job_address: '1 Hill Rd', status: 'working', pct_complete: null, revenue: null, fixtures: [], ...p })

// Three stages by name, each $9,000: 45% labor at $45/h is 90 h for Rough In and Top Out, 40% is 80 h for Trim Set, 260 h in all.
const staged = [
  fixture({ id: 'r', name: 'Rough In', line_unit_price: 9000, sequence_order: 1, progress_pct: 100 }),
  fixture({ id: 't', name: 'Top Out', line_unit_price: 9000, sequence_order: 2, progress_pct: 50 }),
  fixture({ id: 's', name: 'Trim Set', line_unit_price: 9000, sequence_order: 3 }),
]

describe('the gate', () => {
  // A job the read says everything about: already worked, nothing behind it, no press yet.
  const known = (p: Partial<ProjectRow> & { id: string }) => row({ kind: null, bid_id: null, project_id: null, first_work_date: '2026-10-01', billing_only: false, ...p })
  const repipe = [fixture({ id: 'x', name: 'Repipe' })]

  it('takes a job reading Project, at any price', () => {
    expect(isWorkingProject(known({ id: 'pressed', kind: 'project', revenue: 900, fixtures: repipe }))).toBe(true)
    expect(isWorkingProject(known({ id: 'before', first_work_date: null, revenue: 900, fixtures: repipe }))).toBe(true)
    expect(isWorkingProject(known({ id: 'bid', bid_id: 'b1', fixtures: repipe }))).toBe(true)
    expect(isWorkingProject(known({ id: 'gc', project_id: 'p1', fixtures: repipe }))).toBe(true)
    expect(isWorkingProject(known({ id: 'marked', fixtures: [fixture({ id: 'x', name: 'Whole house', stage_kind: 'order' })] }))).toBe(true)
    expect(isWorkingProject(known({ id: 'named', fixtures: staged }))).toBe(true)
  })

  it('leaves off a job reading Service call, even priced over the gate', () => {
    // An HCP number with nothing before it reads Service call by the kernel's order, whatever the price.
    expect(isWorkingProject(known({ id: 'hcp', revenue: 90000, fixtures: repipe }))).toBe(false)
    // The office's press wins over a stage and a price alike.
    expect(isWorkingProject(known({ id: 'pressed', kind: 'service', revenue: 90000, fixtures: staged }))).toBe(false)
  })

  it('keeps the guess for a job reading Kind not set: $25,000 and up is on, under it is off', () => {
    const unset = (p: Partial<ProjectRow> & { id: string }) => known({ hcp_number: '', click_number: 'C77', fixtures: repipe, ...p })
    expect(isWorkingProject(unset({ id: 'at', revenue: 25000 }))).toBe(true)
    expect(isWorkingProject(unset({ id: 'over', revenue: '90000' }))).toBe(true)
    expect(isWorkingProject(unset({ id: 'under', revenue: '24999' }))).toBe(false)
    expect(isWorkingProject(unset({ id: 'none', revenue: null }))).toBe(false)
  })

  it('leaves off a billing-only job, which nobody clocks on, though it reads Project', () => {
    expect(isWorkingProject(known({ id: 'bills', billing_only: true, revenue: 90000, fixtures: staged }))).toBe(false)
  })

  it('leaves off a job that is not Working, whatever it reads', () => {
    expect(isWorkingProject(known({ id: 'billed', status: 'billed', kind: 'project', revenue: 90000, fixtures: staged }))).toBe(false)
  })

  it('keeps the whole guess on a read older than the facts, so no job drops off before the function is pushed', () => {
    expect(isWorkingProject(row({ id: 'a', fixtures: [fixture({ id: 'x', name: 'Whole house', stage_kind: 'order' })] }))).toBe(true)
    expect(isWorkingProject(row({ id: 'b', fixtures: staged }))).toBe(true)
    expect(isWorkingProject(row({ id: 'c', revenue: 25000, fixtures: repipe }))).toBe(true)
    expect(isWorkingProject(row({ id: 'd', revenue: '24999', fixtures: repipe }))).toBe(false)
    expect(isWorkingProject(row({ id: 'e', status: 'billed', revenue: 90000, fixtures: staged }))).toBe(false)
    expect(isWorkingProject(row({ id: 'f', fixtures: [fixture({ id: 'x', name: 'Diagnostic' }), fixture({ id: 'y', name: 'Parts' })] }))).toBe(false)
  })

  it('says the rule in plain words, with the price from the one constant', () => {
    expect(PROJECT_GATE_WORDS).toContain('$25,000')
    expect(plainWordsFailures(PROJECT_GATE_WORDS)).toEqual([])
  })
})

describe('who', () => {
  it('lets the leader, the office and the superintendents in, and only the leader and the office set', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller', 'superintendent']) expect(canSeeProjectsBoard(r)).toBe(true)
    for (const r of ['estimator', 'primary', 'subcontractor', 'helpers', null]) expect(canSeeProjectsBoard(r)).toBe(false)
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) expect(canSetExpectedHours(r)).toBe(true)
    expect(canSetExpectedHours('superintendent')).toBe(false)
  })
})

describe('projectLabel', () => {
  it('reads the HCP number first, then the Click number, then a dash', () => {
    expect(projectLabel(row({ id: 'a' }))).toBe('J1044 · The Lodge')
    expect(projectLabel(row({ id: 'a', hcp_number: null, click_number: 77, job_name: '  ' }))).toBe('J77 · Untitled job')
    expect(projectLabel(row({ id: 'a', hcp_number: '', click_number: null }))).toBe('J— · The Lodge')
  })
})

const settings = DEFAULT_LINE_BUDGET_SETTINGS
const job = (p: Partial<ProjectBoardJob> = {}): ProjectBoardJob => ({ ...row({ id: 'a', pct_complete: 50, fixtures: staged }), budgetKind: null, budgetHours: null, labor: [{ ymd: '2026-10-20', who: 'Ana', hours: 24 }, { ymd: '2026-10-21', who: 'Ana', hours: 24 }], values: [], spentPct: 24, ...p })
const none = { answered: 0, asked: 0 }

describe('projectPace', () => {
  it('reads the track from the lines\' sum as assumed when the job has no baseline, cut by its stages', () => {
    const pace = projectPace({ job: job(), target: null, checklist: none, settings })
    expect(pace.baseHours).toBe(260)
    expect(pace.baseSource).toBe('assumed')
    expect(pace.budgetEdge).toBe(260)
    expect(pace.stages.map((s) => s.name)).toEqual(['Rough In', 'Top Out', 'Trim Set'])
    expect(pace.stages[0]).toMatchObject({ hours: 90, laborUsd: 90 * 45, pctDone: 100 })
    expect(pace.input).toMatchObject({ hoursBudget: 260, budgetSource: 'assumed', hoursUsed: 48, pctDone: 50 })
    expect(pace.input.laborDays).toEqual([{ ymd: '2026-10-20', hours: 24 }, { ymd: '2026-10-21', hours: 24 }])
    // 50% done on 48 of 260 h (18%): well ahead.
    expect(pace.line.tone).toBe('ahead')
  })

  it('reads the read\'s percent as the money, over a budget of 100, and no money with no percent', () => {
    const pace = projectPace({ job: job({ spentPct: 78 }), target: null, checklist: none, settings })
    expect(pace.input.money).toEqual({ spentUsd: 78, budgetUsd: 100 })
    expect(pace.line.money).toMatchObject({ spentPct: 78, leads: true })
    expect(pace.line.headline).toBe('Spending 28 points ahead of the work.')
    expect(projectPace({ job: job({ spentPct: null }), target: null, checklist: none, settings }).line.money).toBeNull()
  })

  it('reads the track from the baseline\'s hours when it carries them, the stages scaled to it', () => {
    const pace = projectPace({ job: job({ budgetKind: 'bid', budgetHours: 180 }), target: null, checklist: none, settings })
    expect(pace.baseHours).toBe(180)
    expect(pace.baseSource).toBe('bid')
    // 90 · 90 · 80 of 260, scaled to the bid's 180.
    expect(pace.stages.map((s) => Math.round(s.hours))).toEqual([62, 62, 55])
    expect(pace.line.hoursWords).toContain('◆ from the bid')
    expect(projectPace({ job: job({ budgetKind: 'typed', budgetHours: 200 }), target: null, checklist: none, settings }).baseSource).toBe('typed')
  })

  it("reads the hours frozen at award off the score read before the live row, the number the score reads (the owner's call of 2026-11-09)", () => {
    // Refresh from bid moved the live row to 220 h; the award froze 180 h and the Scoreboard reads 180.
    const pace = projectPace({ job: job({ budgetKind: 'bid', budgetHours: 220 }), target: null, checklist: none, settings, score: { certifiedPct: 50, signedOn: '2026-11-08', subHours: 0, awardedHours: 180, awardedKind: 'bid' } })
    expect(pace).toMatchObject({ baseHours: 180, baseSource: 'bid', baseFrozen: true })
    expect(pace.line.hoursWords).toContain('180 h budget ◆ from the bid, frozen at award')
    // A book award is a pace budget too, read as a guess; a project awarded before PR 1a has no award and keeps the live row.
    expect(projectPace({ job: job({ budgetKind: 'bid', budgetHours: 220 }), target: null, checklist: none, settings, score: { certifiedPct: null, signedOn: null, subHours: 0, awardedHours: 241, awardedKind: 'book' } })).toMatchObject({ baseHours: 241, baseSource: 'book', baseFrozen: true })
    expect(projectPace({ job: job({ budgetKind: 'bid', budgetHours: 220 }), target: null, checklist: none, settings, score: { certifiedPct: null, signedOn: null, subHours: 0, awardedHours: null, awardedKind: null } })).toMatchObject({ baseHours: 220, baseSource: 'bid', baseFrozen: false })
    // The leader's target still outranks the award on the line; the words say expected, not frozen.
    const target = { id: 't1', jobId: 'a', hours: 200, from: 180, by: 'Robert', at: '2026-11-01T20:00:00Z', why: 'framed in a week' }
    expect(projectPace({ job: job(), target, checklist: none, settings, score: { certifiedPct: null, signedOn: null, subHours: 0, awardedHours: 180, awardedKind: 'bid' } }).line.hoursWords).toBe('200 h budget 🎯 expected · 48 h in')
  })

  it('falls back to the lines when the baseline has no hours or is not a real footing', () => {
    expect(projectPace({ job: job({ budgetKind: 'bid', budgetHours: 0 }), target: null, checklist: none, settings })).toMatchObject({ baseHours: 260, baseSource: 'assumed' })
    expect(projectPace({ job: job({ budgetKind: 'other', budgetHours: 100 }), target: null, checklist: none, settings })).toMatchObject({ baseHours: 260, baseSource: 'assumed' })
  })

  it('reads the expected hours as the budget when a target is set, the words naming who and why', () => {
    const target = { id: 't1', jobId: 'a', hours: 200, from: 260, by: 'Robert', at: '2026-11-01T20:00:00Z', why: 'framed in a week' }
    const pace = projectPace({ job: job(), target, checklist: { answered: 2, asked: 5 }, settings })
    expect(pace.input).toMatchObject({ hoursBudget: 200, budgetSource: 'target' })
    expect(pace.line.targetLine).toBe('Expected 200 h, set by Robert on Nov 1 (was 260 h): framed in a week')
    // The track's edge stays the base budget; the target is a mark inside it.
    expect(pace.budgetEdge).toBe(260)
    expect(pace.line.proofWords).toContain('checklist 2 of 5 ready')
  })

  it('is too early to call on a job with no hours on it yet', () => {
    const pace = projectPace({ job: job({ labor: [] }), target: null, checklist: none, settings })
    expect(pace.input).toMatchObject({ hoursUsed: 0, laborDays: [] })
    expect(pace.line.tone).toBe('early')
  })

  it('reads a tuned line\'s own split from the five budget columns, so its stage\'s share moves (PR 5)', () => {
    // Rough In tuned to 60% labor: $5,400 at $45/h is 120 h, where the company split read 90.
    const tuned = staged.map((f) => (f.id === 'r' ? { ...f, budget_labor_pct: 60, budget_materials_pct: 25, budget_source: 'tuned', budget_tuned_at: '2026-11-01T20:00:00Z', budget_rate_usd: 45 } : f))
    const pace = projectPace({ job: job({ fixtures: tuned }), target: null, checklist: none, settings })
    expect(pace.baseHours).toBe(290)
    expect(pace.stages.map((s) => Math.round(s.hours))).toEqual([120, 90, 80])
    // A split with no source stored reads the company split, as before.
    const unsourced = staged.map((f) => (f.id === 'r' ? { ...f, budget_labor_pct: 60, budget_materials_pct: 25, budget_source: null } : f))
    expect(projectPace({ job: job({ fixtures: unsourced }), target: null, checklist: none, settings }).baseHours).toBe(260)
  })

  it('leaves a discount line out of the budget and the shares', () => {
    const pace = projectPace({ job: job({ fixtures: [...staged, fixture({ id: 'd', name: 'Discount', line_kind: 'discount', line_unit_price: -5000 })] }), target: null, checklist: none, settings })
    expect(pace.baseHours).toBe(260)
    expect(pace.stages).toHaveLength(3)
  })
})

describe('worst first', () => {
  const mk = (tone: 'ahead' | 'behind' | 'even' | 'early', days: number, leads = false) => ({ line: { tone, days, money: leads ? { leads: true } : null } as unknown as SuperintendentLine })
  it('ranks money leading, then behind by days, then even, ahead, and no reading last', () => {
    expect(paceRank(mk('behind', -2, true).line)).toBe(0)
    expect(paceRank(mk('behind', -2).line)).toBe(1)
    expect(paceRank(mk('even', 0).line)).toBe(2)
    expect(paceRank(mk('ahead', 3).line)).toBe(3)
    expect(paceRank(mk('early', 0).line)).toBe(4)
    const sorted = sortByPace([mk('ahead', 1), mk('behind', -1), mk('early', 0), mk('behind', -4), mk('behind', 0, true), mk('even', 0)])
    expect(sorted.map((c) => `${c.line.tone}:${c.line.days}`)).toEqual(['behind:0', 'behind:-4', 'behind:-1', 'even:0', 'ahead:1', 'early:0'])
  })
})

describe('checklistCountOf', () => {
  it('sums the stage checklists\' asked and answered across the job\'s stages', () => {
    const questions = [
      { id: 'q1', kind: 'rough_in' as const, order: 1, words: 'Slab tested?', asksPhoto: false },
      { id: 'q2', kind: 'rough_in' as const, order: 2, words: 'Photo of the stub-ups', asksPhoto: true },
      { id: 'q3', kind: 'top_out' as const, order: 1, words: 'Vents tied in?', asksPhoto: false },
    ]
    const answers = new Map([['r', [{ questionId: 'q1', pick: 'yes' as const, note: '', photo: null }]]])
    expect(checklistCountOf(staged, questions, answers)).toEqual({ answered: 1, asked: 3 })
    expect(checklistCountOf(staged, [], new Map())).toEqual({ answered: 0, asked: 0 })
  })
})

describe('the Dashboard strip\'s counts and the worst project\'s words (PR 6)', () => {
  const line = (tone: 'ahead' | 'behind' | 'even' | 'early', days: number, money: { leads: boolean; wrong?: boolean } | null = null) => ({ tone, days, money } as unknown as SuperintendentLine)
  it('counts the projects by tone, the money leaders inside behind', () => {
    expect(paceCounts([line('behind', -3), line('behind', 0, { leads: true }), line('ahead', 2), line('even', 0), line('early', 0)])).toEqual({ total: 5, behind: 2, moneyLeading: 1, even: 1, ahead: 1, early: 1 })
    expect(paceCounts([])).toEqual({ total: 0, behind: 0, moneyLeading: 0, even: 0, ahead: 0, early: 0 })
  })
  it('names the worst in three words, or none when it is not behind', () => {
    expect(worstWords(line('behind', -3))).toBe('3 d behind')
    expect(worstWords(line('behind', 0, { leads: true }))).toBe('money ahead')
    expect(worstWords(line('behind', 0, { leads: true, wrong: true }))).toBe('budget?')
    expect(worstWords(line('ahead', 2))).toBeNull()
    expect(worstWords(line('early', 0))).toBeNull()
  })
})
