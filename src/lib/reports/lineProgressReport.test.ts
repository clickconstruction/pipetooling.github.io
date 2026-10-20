import { describe, expect, it } from 'vitest'
import {
  defaultOpenLine,
  howRows,
  jobLine,
  jobPercentFromLines,
  lineIsDone,
  linePct,
  lineProgressFieldValue,
  lineWords,
  linesModeAvailable,
  movedLines,
  pctWord,
} from './lineProgressReport'
import { jobPercentFromStages, type StageProgressRow } from './stageProgressReport'

// The mock-up's job: J1204 Pecan Grove lot 14 — four stages and a water heater.
const underground: StageProgressRow = { fixtureId: 'u', name: 'Underground', kind: 'order', sequenceOrder: 1, weightPct: 20, progressPct: 100, drawPaid: true }
const roughIn: StageProgressRow = { fixtureId: 'r', name: 'Rough In', kind: 'order', sequenceOrder: 2, weightPct: 35, progressPct: 35, drawPaid: false }
const topOut: StageProgressRow = { fixtureId: 't', name: 'Top Out', kind: 'order', sequenceOrder: 3, weightPct: 25, progressPct: null, drawPaid: false }
const trimSet: StageProgressRow = { fixtureId: 's', name: 'Trim Set', kind: 'order', sequenceOrder: 4, weightPct: 15, progressPct: null, drawPaid: false }
const heater: StageProgressRow = { fixtureId: 'w', name: 'Water heater', kind: 'any', sequenceOrder: 5, weightPct: 5, progressPct: null, drawPaid: false }
const rows = [underground, roughIn, topOut, trimSet, heater]

describe('lineProgressReport (punch list #130)', () => {
  it('the list shows on two or more priced lines, whatever their kind', () => {
    expect(linesModeAvailable([heater])).toBe(false)
    expect(linesModeAvailable([heater, { ...heater, fixtureId: 'x', name: 'Permit' }])).toBe(true)
    expect(linesModeAvailable([])).toBe(false)
  })

  it('a line reads its pick, else what is on record, a paid draw 100 whatever is said', () => {
    expect(linePct(roughIn, {})).toBe(35)
    expect(linePct(roughIn, { r: 50 })).toBe(50)
    expect(linePct(roughIn, { r: 104.4 })).toBe(100)
    expect(linePct(topOut, {})).toBe(0)
    expect(linePct(underground, { u: 10 })).toBe(100)
    expect(lineIsDone(underground, {})).toBe(true)
    expect(lineIsDone(roughIn, { r: 100 })).toBe(true)
    expect(lineIsDone(roughIn, { r: 99 })).toBe(false)
  })

  it('the job is Σ share × line percent, rounded, and agrees with the one-stage math', () => {
    expect(jobPercentFromLines(rows, {})).toBe(32)
    expect(jobPercentFromLines(rows, { r: 50 })).toBe(38)
    expect(jobPercentFromLines(rows, { r: 50, w: 100 })).toBe(43)
    expect(jobPercentFromLines(rows, { r: 50 })).toBe(jobPercentFromStages(rows, { fixtureId: 'r', pct: 50 }))
    expect(jobPercentFromLines(rows, { r: 100, t: 100, s: 100, w: 100 })).toBe(100)
  })

  it('the row that opens by itself is the first Order stage not done, else the first Any-time line, else none', () => {
    expect(defaultOpenLine(rows)?.fixtureId).toBe('r')
    expect(defaultOpenLine([underground, { ...roughIn, progressPct: 100 }, { ...topOut, progressPct: 100 }, { ...trimSet, progressPct: 100 }, heater])?.fixtureId).toBe('w')
    expect(defaultOpenLine([underground, { ...heater, progressPct: 100 }])).toBeNull()
  })

  it('moved lines are the picks that differ from the record, in row order; a paid draw never moves', () => {
    expect(movedLines(rows, {})).toEqual([])
    expect(movedLines(rows, { r: 35 })).toEqual([])
    expect(movedLines(rows, { t: 0 })).toEqual([])
    expect(movedLines(rows, { u: 50 })).toEqual([])
    expect(movedLines(rows, { w: 100, r: 50 })).toEqual([
      { fixtureId: 'r', name: 'Rough In', from: 35, to: 50 },
      { fixtureId: 'w', name: 'Water heater', from: null, to: 100 },
    ])
  })

  it('the Stage progress field names each moved line and the job, and is empty when nothing moved', () => {
    expect(lineProgressFieldValue(rows, {})).toBe('')
    expect(lineProgressFieldValue(rows, { r: 50, w: 100 })).toBe('Rough In 35% → 50% · Water heater — → 100% · job 32% → 43%')
    // The office had typed 46; the lines say 32. The report tells the truth of both.
    expect(lineProgressFieldValue(rows, { r: 50 }, 46)).toBe('Rough In 35% → 50% · job 46% → 38%')
  })

  it('the job line reads the recorded number before, the lines after', () => {
    expect(jobLine(rows, {})).toEqual({ before: 32, after: 32, moved: false })
    expect(jobLine(rows, { r: 50 }, 46)).toEqual({ before: 46, after: 38, moved: true })
    expect(jobLine(rows, { r: 35 }, null)).toEqual({ before: 32, after: 32, moved: false })
  })

  it("a row's words: paid, done, a move up or down, on record, or nothing yet", () => {
    expect(lineWords(underground, {})).toEqual({ text: '✓ Paid', tone: 'paid' })
    expect(lineWords({ ...roughIn, progressPct: 100 }, {})).toEqual({ text: '✓ Done', tone: 'done' })
    expect(lineWords(roughIn, { r: 50 })).toEqual({ text: '35% → 50%', tone: 'up' })
    expect(lineWords(roughIn, { r: 100 })).toEqual({ text: '35% → ✓ Done', tone: 'up' })
    expect(lineWords(roughIn, { r: 20 })).toEqual({ text: '35% → 20%', tone: 'down' })
    expect(lineWords(heater, { w: 100 })).toEqual({ text: '— → ✓ Done', tone: 'up' })
    expect(lineWords(roughIn, {})).toEqual({ text: '35%', tone: 'plain' })
    expect(lineWords(topOut, {})).toEqual({ text: '—', tone: 'none' })
    expect(pctWord(null)).toBe('—')
    expect(pctWord(0)).toBe('0%')
  })

  it('the arithmetic behind the job line: share, standing and points per line, the total the job', () => {
    const how = howRows(rows, { r: 50, w: 100 })
    expect(how.rows).toEqual([
      { fixtureId: 'u', name: 'Underground', sharePct: 20, standing: 'paid', points: 20 },
      { fixtureId: 'r', name: 'Rough In', sharePct: 35, standing: '50%', points: 18 },
      { fixtureId: 't', name: 'Top Out', sharePct: 25, standing: '—', points: 0 },
      { fixtureId: 's', name: 'Trim Set', sharePct: 15, standing: '—', points: 0 },
      { fixtureId: 'w', name: 'Water heater', sharePct: 5, standing: 'done', points: 5 },
    ])
    expect(how.total).toBe(43)
  })

  it('the points add up to the job exactly, whatever the shares round to (the live walk: 54.95 + 22.5 is 77, not 55 + 23)', () => {
    const co: StageProgressRow = { fixtureId: 'c', name: 'CHANGE ORDER: Deep cleaning of 2 systems', kind: 'any', sequenceOrder: 0, weightPct: 54.95, progressPct: null, drawPaid: true }
    const hvac: StageProgressRow = { fixtureId: 'h', name: 'HVAC to spec', kind: 'any', sequenceOrder: 1, weightPct: 45.05, progressPct: null, drawPaid: false }
    const how = howRows([co, hvac], { h: 50 })
    expect(how.total).toBe(77)
    expect(how.rows.map((r) => r.points)).toEqual([55, 22])
    expect(how.rows.reduce((s, r) => s + r.points, 0)).toBe(how.total)
    // Rounding up: 55.37 + 22.315 is 78, and the row with the larger remainder takes the point.
    const up = howRows([{ ...co, weightPct: 55.37 }, { ...hvac, weightPct: 44.63 }], { h: 50 })
    expect(up.total).toBe(78)
    expect(up.rows.map((r) => r.points)).toEqual([56, 22])
    // Nothing said anywhere: every row 0, the total 0.
    expect(howRows([{ ...co, drawPaid: false }, hvac], {}).rows.map((r) => r.points)).toEqual([0, 0])
  })
})
