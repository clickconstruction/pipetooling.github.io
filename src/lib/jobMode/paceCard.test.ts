import { describe, expect, it } from 'vitest'
import { PACE_CARD_WORDS, paceDayWords, paceDaysLeftWords, paceFinish, paceHours, paceRailStages, paceRowNote, paceStageRail, paceStageCheck, paceStageList, paceStagePrices, type PaceRailPiece } from './paceCard'
import { plainWordsFailures } from '../plainWords'

const four = (pcts: Array<number | null>) => [
  { name: 'Underground', hours: 14, pctDone: pcts[0] ?? null },
  { name: 'Rough-in', hours: 24.5, pctDone: pcts[1] ?? null },
  { name: 'Top-out', hours: 17.5, pctDone: pcts[2] ?? null },
  { name: 'Trim', hours: 14, pctDone: pcts[3] ?? null },
]

describe('paceStageRail', () => {
  it('is no rail for fewer than two stages', () => {
    expect(paceStageRail([], 40)).toBeNull()
    expect(paceStageRail([{ name: 'Repipe', hours: 40, pctDone: 50 }], 50)).toBeNull()
  })

  it('reads each stage by its own number when the crew reported any', () => {
    const rail = paceStageRail(four([100, 40, null, null]), 30)!
    expect(rail.from).toBe('stages')
    expect(rail.rows).toEqual([
      { name: 'Underground', state: 'done', pct: 100 },
      { name: 'Rough-in', state: 'now', pct: 40 },
      { name: 'Top-out', state: 'next', pct: 0 },
      { name: 'Trim', state: 'next', pct: 0 },
    ])
  })

  it('keeps a later stage done when it was finished out of order, and the first unfinished one is in hand', () => {
    const rail = paceStageRail(four([100, 50, 100, null]), 70)!
    expect(rail.rows.map((r) => r.state)).toEqual(['done', 'now', 'done', 'next'])
  })

  it('spreads the job percent over the stages by their hours when nobody reported a stage', () => {
    // 70 h in all: Underground is the first 20%, Rough-in the next 35%.
    const rail = paceStageRail(four([null, null, null, null]), 25)!
    expect(rail.from).toBe('job')
    expect(rail.rows.map((r) => r.state)).toEqual(['done', 'now', 'next', 'next'])
    expect(rail.rows[1]!.pct).toBe(14)
    // Exactly at a stage's end: that stage is done and the next is in hand at 0.
    const edge = paceStageRail(four([null, null, null, null]), 20)!
    expect(edge.rows.map((r) => [r.state, r.pct])).toEqual([['done', 100], ['now', 0], ['next', 0], ['next', 0]])
  })

  it('spreads by price where every stage carries one, so a first stage marked done reads done (the walk of 2026-11-20)', () => {
    // Rough In and Top Out at 45% labor, Trim Set at 40%: Rough In is 40% of the price and 40.9% of the hours.
    const stages = [
      { name: 'Rough In', hours: 56.4, pctDone: null, weight: 5640 },
      { name: 'Top Out', hours: 56.4, pctDone: null, weight: 5640 },
      { name: 'Trim Set', hours: 25.1, pctDone: null, weight: 2820 },
    ]
    // The job reads 40% once Rough In is marked 100%, since the job's percent is built by price.
    expect(paceStageRail(stages, 40)!.rows.map((r) => [r.state, r.pct])).toEqual([['done', 100], ['now', 0], ['next', 0]])
    // By hours, the same job read Rough In at 98% and still in hand.
    const byHours = paceStageRail(stages.map(({ weight: _w, ...s }) => s), 40)!
    expect(byHours.rows.map((r) => [r.state, r.pct])).toEqual([['now', 98], ['next', 0], ['next', 0]])
    // One price missing, or none above zero: the hours are the share.
    expect(paceStageRail([{ ...stages[0]!, weight: undefined }, stages[1]!, stages[2]!], 40)!.rows[0]!.pct).toBe(98)
    expect(paceStageRail(stages.map((s) => ({ ...s, weight: 0 })), 40)!.rows[0]!.pct).toBe(98)
  })

  it('reads nothing done with no percent, and every stage done at 100', () => {
    expect(paceStageRail(four([null, null, null, null]), null)!.rows.map((r) => r.state)).toEqual(['now', 'next', 'next', 'next'])
    expect(paceStageRail(four([null, null, null, null]), 100)!.rows.every((r) => r.state === 'done')).toBe(true)
    expect(paceStageRail(four([100, 100, 100, 100]), 100)!.rows.every((r) => r.state === 'done')).toBe(true)
  })
})

describe('paceRailStages', () => {
  const stage = (id: string, name: string, hours: number, pctDone: number | null = null): PaceRailPiece => ({ id, name, hours, pctDone, kind: 'order' })
  const line = (id: string, name: string, hours: number, pctDone: number | null = null, kind: 'any' | 'other' = 'any'): PaceRailPiece => ({ id, name, hours, pctDone, kind })
  const scope = 'Install 1 water heater with exterior mounting box. Install 2 showers in the new addition. Repipe 6 fixtures.'

  it('keeps the stages by name and folds every other bid line into one last row', () => {
    const rows = paceRailStages([stage('r', 'Rough In', 20), stage('t', 'Top Out', 20), stage('s', 'Trim Set', 10), line('a', scope, 12), line('b', 'Trenching (owner paid the sub)', 8)])
    expect(rows.map((r) => r.name)).toEqual(['Rough In', 'Top Out', 'Trim Set', 'Other work'])
    expect(rows[3]).toEqual({ id: 'other', name: 'Other work', hours: 20, pctDone: null, lineIds: ['a', 'b'] })
    expect(rows[0]!.lineIds).toEqual(['r'])
    // No word of a folded line's name reaches the rail.
    expect(rows.some((r) => r.name.includes('Install') || r.name.includes('paid'))).toBe(false)
  })

  it('one line outside the stages is still Other work, never its own name', () => {
    expect(paceRailStages([stage('r', 'Rough In', 20), line('a', scope, 12)]).map((r) => r.name)).toEqual(['Rough In', 'Other work'])
    // The board's own folded piece is one too.
    expect(paceRailStages([stage('r', 'Rough In', 20), line('other', 'Other lines', 5, null, 'other')]).map((r) => r.name)).toEqual(['Rough In', 'Other work'])
  })

  it('reads the folded row from its lines by their hours, an unreported line as 0', () => {
    const rows = paceRailStages([stage('r', 'Rough In', 20, 100), line('a', 'A', 30, 100), line('b', 'B', 10)])
    expect(rows[1]!.pctDone).toBe(75)
    expect(paceRailStages([stage('r', 'Rough In', 20, 100), line('a', 'A', 30), line('b', 'B', 10)])[1]!.pctDone).toBeNull()
  })

  it('leaves a job of stages alone, and a job with no stage has no rail', () => {
    const three = [stage('r', 'Rough In', 20, 100), stage('t', 'Top Out', 20, 50), stage('s', 'Trim Set', 10)]
    expect(paceRailStages(three).map((r) => [r.id, r.name, r.pctDone])).toEqual([['r', 'Rough In', 100], ['t', 'Top Out', 50], ['s', 'Trim Set', null]])
    // Two bid lines and no stage fold to one row, which is fewer than two: the card draws its Work bar.
    expect(paceStageRail(paceRailStages([line('a', scope, 30), line('b', 'B', 10)]), 40)).toBeNull()
  })

  it('draws the folded row last on the rail, in hand once the stages are done', () => {
    const rail = paceStageRail(paceRailStages([stage('r', 'Rough In', 20, 100), stage('t', 'Top Out', 20, 100), line('a', scope, 10, 40), line('b', 'B', 10)]), 80)!
    expect(rail.rows).toEqual([
      { name: 'Rough In', state: 'done', pct: 100 },
      { name: 'Top Out', state: 'done', pct: 100 },
      { name: 'Other work', state: 'now', pct: 20 },
    ])
  })
})

describe('the finish', () => {
  it('says a day as the day of the week and the month and day', () => {
    expect(paceDayWords('2026-11-20')).toBe('Fri, Nov 20')
    expect(paceDayWords(null)).toBeNull()
    expect(paceDayWords('not a day')).toBeNull()
  })

  it('shows the planned day alone when the job is on pace or too early to call', () => {
    expect(paceFinish({ plannedFinishYmd: '2026-11-20', days: 0, tone: 'even' })).toEqual({ planned: 'Fri, Nov 20', atPace: null })
    expect(paceFinish({ plannedFinishYmd: '2026-11-20', days: 0, tone: 'early' })).toEqual({ planned: 'Fri, Nov 20', atPace: null })
  })

  it('adds the day this pace lands on when behind or ahead', () => {
    expect(paceFinish({ plannedFinishYmd: '2026-11-20', days: -4, tone: 'behind' })).toEqual({ planned: 'Fri, Nov 20', atPace: { words: 'Tue, Nov 24', tone: 'behind' } })
    expect(paceFinish({ plannedFinishYmd: '2026-11-20', days: 2, tone: 'ahead' })).toEqual({ planned: 'Fri, Nov 20', atPace: { words: 'Wed, Nov 18', tone: 'ahead' } })
  })

  it('shows nothing with no planned finish, and no pace day when money leads with no days lost', () => {
    expect(paceFinish({ plannedFinishYmd: null, days: -2, tone: 'behind' })).toEqual({ planned: null, atPace: null })
    expect(paceFinish({ plannedFinishYmd: '2026-11-20', days: 0, tone: 'behind' })).toEqual({ planned: 'Fri, Nov 20', atPace: null })
  })
})

describe('the hours bar and the days left', () => {
  it('counts the team’s hours and the subs’ sheet hours against the budget', () => {
    expect(paceHours({ hoursUsed: null, subHours: 9, hoursBudget: 70 })).toEqual({ words: '9 of 70 h', fillPct: (9 / 70) * 100, over: false })
    expect(paceHours({ hoursUsed: 40, subHours: 10, hoursBudget: 70 })!.words).toBe('50 of 70 h')
  })

  it('stops the fill at the end of the bar and says the hours passed it', () => {
    expect(paceHours({ hoursUsed: 90, subHours: 0, hoursBudget: 70 })).toEqual({ words: '90 of 70 h', fillPct: 100, over: true })
  })

  it('is no bar with no budget', () => {
    expect(paceHours({ hoursUsed: 12, subHours: 0, hoursBudget: 0 })).toBeNull()
  })

  it('says the unspent hours in days', () => {
    expect(paceDaysLeftWords(2.6)).toBe('3 days of hours left')
    expect(paceDaysLeftWords(1.2)).toBe('1 day of hours left')
    expect(paceDaysLeftWords(0)).toBe('No hours left in the budget')
    expect(paceDaysLeftWords(null)).toBeNull()
  })
})

describe('the words', () => {
  it('says the folded row’s second line with the finish day when there is one', () => {
    expect(paceRowNote('2026-11-20')).toBe('Finish Fri, Nov 20. Tap for the pace card.')
    expect(paceRowNote(null)).toBe('Tap for the pace card.')
  })

  it('keeps every sentence on the card inside the plain words rules', () => {
    for (const words of [PACE_CARD_WORDS.figured, PACE_CARD_WORDS.rowOpen, PACE_CARD_WORDS.fromJob, PACE_CARD_WORDS.noDaysLeft, paceRowNote('2026-11-20'), paceDaysLeftWords(3)!]) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })
})

describe('the rail’s checklist press and the strip’s stage list (punch list #397, PR 5)', () => {
  it('says how many are answered, and is nothing for a stage with no question', () => {
    expect(paceStageCheck({ asked: 3, answered: 1 })).toEqual({ words: '1 of 3 answered', ready: false })
    expect(paceStageCheck({ asked: 2, answered: 2 })).toEqual({ words: '2 of 2 answered', ready: true })
    expect(paceStageCheck({ asked: 0, answered: 0 })).toBeNull()
    expect(paceStageCheck(null)).toBeNull()
  })

  it('lists each stage with its hours and the crew’s report, or says none was made', () => {
    expect(paceStageList([{ name: 'Rough In', hours: 23.4, pctDone: 100 }, { name: 'Top Out', hours: 26, pctDone: 39.6 }, { name: 'Trim Set', hours: 19, pctDone: null }])).toEqual([
      { name: 'Rough In', hours: '23 h', pct: '100%', reported: true },
      { name: 'Top Out', hours: '26 h', pct: '40%', reported: true },
      { name: 'Trim Set', hours: '19 h', pct: 'not reported', reported: false },
    ])
    expect(PACE_CARD_WORDS.stagesCount(1)).toBe('1 stage')
    expect(PACE_CARD_WORDS.stagesCount(4)).toBe('4 stages')
  })
})

describe('paceStagePrices', () => {
  const lines = [
    { id: 'a', price: 5640 },
    { id: 'b', price: 5640 },
    { id: 'c', price: 900 },
    { id: 'd', price: 300 },
  ]
  it('gives a line its own price, and the fold of the rest the price of every line no piece names', () => {
    expect([...paceStagePrices(lines, ['a', 'b', 'other'])]).toEqual([['a', 5640], ['b', 5640], ['other', 1200]])
    expect([...paceStagePrices(lines, ['a', 'b', 'c', 'd'])]).toEqual([['a', 5640], ['b', 5640], ['c', 900], ['d', 300]])
  })
  it('carries the price through the rail’s fold, so Other work is weighed by what it costs', () => {
    const prices = paceStagePrices(lines, ['a', 'b', 'c', 'd'])
    const pieces: PaceRailPiece[] = [
      { id: 'a', name: 'Rough In', hours: 50, pctDone: null, kind: 'order', price: prices.get('a') },
      { id: 'b', name: 'Top Out', hours: 50, pctDone: null, kind: 'order', price: prices.get('b') },
      { id: 'c', name: 'Camera the line', hours: 9, pctDone: null, kind: 'any', price: prices.get('c') },
      { id: 'd', name: 'Permit', hours: 1, pctDone: null, kind: 'any', price: prices.get('d') },
    ]
    expect(paceRailStages(pieces).map((s) => [s.name, s.weight])).toEqual([['Rough In', 5640], ['Top Out', 5640], [PACE_CARD_WORDS.otherWork, 1200]])
  })
})
