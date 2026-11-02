import { describe, expect, it } from 'vitest'

import { canSeeProjectsBoard, canSetExpectedHours, checklistCountOf, isWorkingProject, paceCounts, paceRank, projectLabel, projectPace, sortByPace, worstWords, type ProjectFixture, type ProjectRow } from './projectsBoard'
import { DEFAULT_LINE_BUDGET_SETTINGS } from './lineBudgets'
import { JOB_BURN_DEFAULT_TARGET_MARGIN_PCT } from './jobBurn'
import type { JobChargeEvent } from '../jobChargesTimeline'
import type { SuperintendentLine } from './superintendentLine'

const fixture = (p: Partial<ProjectFixture> & { id: string }): ProjectFixture => ({ name: p.id, stage_kind: 'any', line_kind: 'fixture', line_unit_price: 1000, count: 1, progress_pct: null, sequence_order: 0, ...p })
const row = (p: Partial<ProjectRow> & { id: string }): ProjectRow => ({ hcp_number: '1044', click_number: null, job_name: 'The Lodge', job_address: '1 Hill Rd', status: 'working', pct_complete: null, revenue: null, fixtures: [], ...p })

// Three stages by name, each $9,000: 45% labor at $45/h is 90 h for Rough In and Top Out, 40% is 80 h for Trim Set, 260 h in all.
const staged = [
  fixture({ id: 'r', name: 'Rough In', line_unit_price: 9000, sequence_order: 1, progress_pct: 100 }),
  fixture({ id: 't', name: 'Top Out', line_unit_price: 9000, sequence_order: 2, progress_pct: 50 }),
  fixture({ id: 's', name: 'Trim Set', line_unit_price: 9000, sequence_order: 3 }),
]

describe('the gate', () => {
  it('takes a working job with a stage In order, marked or recognized from its names', () => {
    expect(isWorkingProject(row({ id: 'a', fixtures: [fixture({ id: 'x', name: 'Whole house', stage_kind: 'order' })] }))).toBe(true)
    expect(isWorkingProject(row({ id: 'b', fixtures: staged }))).toBe(true)
  })

  it('takes a working job priced at $25,000 and up with no stage, and nothing else', () => {
    expect(isWorkingProject(row({ id: 'c', revenue: 25000, fixtures: [fixture({ id: 'x', name: 'Repipe' })] }))).toBe(true)
    expect(isWorkingProject(row({ id: 'd', revenue: '24999', fixtures: [fixture({ id: 'x', name: 'Repipe' })] }))).toBe(false)
    expect(isWorkingProject(row({ id: 'e', status: 'billed', revenue: 90000, fixtures: staged }))).toBe(false)
    expect(isWorkingProject(row({ id: 'f', fixtures: [fixture({ id: 'x', name: 'Diagnostic' }), fixture({ id: 'y', name: 'Parts' })] }))).toBe(false)
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

const events: JobChargeEvent[] = [
  { source: 'team_labor', dateKey: '2026-10-20', amount: 1080, label: 'a', hours: 24 },
  { source: 'team_labor', dateKey: '2026-10-21', amount: 1080, label: 'b', hours: 24 },
  { source: 'supply_house', dateKey: '2026-10-21', amount: 2000, label: 'c' },
]
const settings = DEFAULT_LINE_BUDGET_SETTINGS

describe('projectPace', () => {
  it('reads the track from the lines\' sum as assumed when the job has no budget row, cut by its stages', () => {
    const pace = projectPace({ row: row({ id: 'a', pct_complete: 50, fixtures: staged }), budgetRow: null, burn: { chargeEvents: events, teamHours: 48, revenue: 27000 }, target: null, checklist: { answered: 0, asked: 0 }, settings, targetMarginPct: null })
    expect(pace.baseHours).toBe(260)
    expect(pace.baseSource).toBe('assumed')
    expect(pace.budgetEdge).toBe(260)
    expect(pace.stages.map((s) => s.name)).toEqual(['Rough In', 'Top Out', 'Trim Set'])
    expect(pace.stages[0]).toMatchObject({ hours: 90, laborUsd: 90 * 45, pctDone: 100 })
    expect(pace.input).toMatchObject({ hoursBudget: 260, budgetSource: 'assumed', hoursUsed: 48, pctDone: 50 })
    expect(pace.input.laborDays).toEqual([{ ymd: '2026-10-20', hours: 24 }, { ymd: '2026-10-21', hours: 24 }])
    // $27,000 at the Burn default margin of 35%: a $17,550 direct budget, $4,160 spent.
    expect(pace.budgetUsd).toBe(27000 * (1 - JOB_BURN_DEFAULT_TARGET_MARGIN_PCT / 100))
    expect(pace.input.money).toEqual({ spentUsd: 4160, budgetUsd: 17550 })
    // 50% done on 48 of 260 h (18%): well ahead.
    expect(pace.line.tone).toBe('ahead')
  })

  it('reads the track from the bid\'s hours when the budget row carries them, the stages scaled to it', () => {
    const budgetRow = { kind: 'bid', labor_hours: 180, labor_rate: 45, labor_usd: 8100, materials_usd: 9000, subs_usd: 0, other_usd: 0, total_direct_usd: 17100 }
    const pace = projectPace({ row: row({ id: 'a', pct_complete: 50, fixtures: staged }), budgetRow, burn: { chargeEvents: events, teamHours: 48, revenue: 27000 }, target: null, checklist: { answered: 0, asked: 0 }, settings, targetMarginPct: 25 })
    expect(pace.baseHours).toBe(180)
    expect(pace.baseSource).toBe('bid')
    // 90 · 90 · 80 of 260, scaled to the bid's 180.
    expect(pace.stages.map((s) => Math.round(s.hours))).toEqual([62, 62, 55])
    expect(pace.budgetUsd).toBe(17100)
    expect(pace.line.hoursWords).toContain('◆ from the bid')
  })

  it('reads the expected hours as the budget when a target is set, the words naming who and why', () => {
    const target = { id: 't1', jobId: 'a', hours: 200, from: 260, by: 'Robert', at: '2026-11-01T20:00:00Z', why: 'framed in a week' }
    const pace = projectPace({ row: row({ id: 'a', pct_complete: 50, fixtures: staged }), budgetRow: null, burn: { chargeEvents: events, teamHours: 48, revenue: 27000 }, target, checklist: { answered: 2, asked: 5 }, settings, targetMarginPct: null })
    expect(pace.input).toMatchObject({ hoursBudget: 200, budgetSource: 'target' })
    expect(pace.line.targetLine).toBe('Expected 200 h, set by Robert on Nov 1 (was 260 h): framed in a week')
    // The track's edge stays the base budget; the target is a mark inside it.
    expect(pace.budgetEdge).toBe(260)
    expect(pace.line.proofWords).toContain('checklist 2 of 5 ready')
  })

  it('reads no hours, no days and no money while the cost events load', () => {
    const pace = projectPace({ row: row({ id: 'a', pct_complete: 50, fixtures: staged }), budgetRow: null, burn: null, target: null, checklist: { answered: 0, asked: 0 }, settings, targetMarginPct: null })
    expect(pace.input).toMatchObject({ hoursUsed: null, laborDays: [], money: null })
    expect(pace.line.tone).toBe('early')
  })

  it('reads a tuned line\'s own split from the five budget columns, so its stage\'s share moves (PR 5)', () => {
    // Rough In tuned to 60% labor: $5,400 at $45/h is 120 h, where the company split read 90.
    const tuned = staged.map((f) => (f.id === 'r' ? { ...f, budget_labor_pct: 60, budget_materials_pct: 25, budget_source: 'tuned', budget_tuned_at: '2026-11-01T20:00:00Z', budget_rate_usd: 45 } : f))
    const pace = projectPace({ row: row({ id: 'a', fixtures: tuned }), budgetRow: null, burn: null, target: null, checklist: { answered: 0, asked: 0 }, settings, targetMarginPct: null })
    expect(pace.baseHours).toBe(290)
    expect(pace.stages.map((s) => Math.round(s.hours))).toEqual([120, 90, 80])
    // A split with no source stored reads the company split, as before.
    const unsourced = staged.map((f) => (f.id === 'r' ? { ...f, budget_labor_pct: 60, budget_materials_pct: 25, budget_source: null } : f))
    expect(projectPace({ row: row({ id: 'a', fixtures: unsourced }), budgetRow: null, burn: null, target: null, checklist: { answered: 0, asked: 0 }, settings, targetMarginPct: null }).baseHours).toBe(260)
  })

  it('leaves a discount line out of the budget and the shares', () => {
    const pace = projectPace({ row: row({ id: 'a', fixtures: [...staged, fixture({ id: 'd', name: 'Discount', line_kind: 'discount', line_unit_price: -5000 })] }), budgetRow: null, burn: null, target: null, checklist: { answered: 0, asked: 0 }, settings, targetMarginPct: null })
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
