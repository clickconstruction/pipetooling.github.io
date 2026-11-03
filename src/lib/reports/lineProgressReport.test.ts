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
  unreportedLineSeed,
} from './lineProgressReport'
import { jobPercentFromStages, type StageProgressRow } from './stageProgressReport'

// The mock-up's job: J1204 Pecan Grove lot 14 — four stages and a water heater.
const underground: StageProgressRow = { fixtureId: 'u', name: 'Underground', kind: 'order', sequenceOrder: 1, weightPct: 20, progressPct: 100, drawPaid: true }
const roughIn: StageProgressRow = { fixtureId: 'r', name: 'Rough In', kind: 'order', sequenceOrder: 2, weightPct: 35, progressPct: 35, drawPaid: false }
const topOut: StageProgressRow = { fixtureId: 't', name: 'Top Out', kind: 'order', sequenceOrder: 3, weightPct: 25, progressPct: null, drawPaid: false }
const trimSet: StageProgressRow = { fixtureId: 's', name: 'Trim Set', kind: 'order', sequenceOrder: 4, weightPct: 15, progressPct: null, drawPaid: false }
const heater: StageProgressRow = { fixtureId: 'w', name: 'Water heater', kind: 'any', sequenceOrder: 5, weightPct: 5, progressPct: null, drawPaid: false }
const rows = [underground, roughIn, topOut, trimSet, heater]

// Job 804 (2026-11-02): Residential 40/40/20, billed in full and set to 100 by the office, no line ever reported.
const roughIn804: StageProgressRow = { fixtureId: 'r', name: 'Rough In', kind: 'order', sequenceOrder: 1, weightPct: 40, progressPct: null, drawPaid: false }
const topOut804: StageProgressRow = { fixtureId: 't', name: 'Top Out', kind: 'order', sequenceOrder: 2, weightPct: 40, progressPct: null, drawPaid: false }
const trimSet804: StageProgressRow = { fixtureId: 's', name: 'Trim Set', kind: 'order', sequenceOrder: 3, weightPct: 20, progressPct: null, drawPaid: false }
const job804 = [roughIn804, topOut804, trimSet804]

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
    // The office had typed 46; the paid draw and Rough In carry 32.25 of it, and the three lines nobody has reported
    // share the rest (v2.6391). Rough In's 15 points on a 35% share move the job 5.25: 46 → 51, not 46 → 38.
    expect(lineProgressFieldValue(rows, { r: 50 }, 46)).toBe('Rough In 35% → 50% · job 46% → 51%')
  })

  it('the job line reads the recorded number before, the lines after', () => {
    expect(jobLine(rows, {})).toEqual({ before: 32, after: 32, moved: false })
    expect(jobLine(rows, { r: 50 }, 46)).toEqual({ before: 46, after: 51, moved: true })
    expect(jobLine(rows, { r: 35 }, null)).toEqual({ before: 32, after: 32, moved: false })
  })

  describe('a line nobody has reported counts from the job\'s record, not as 0 (v2.6391, job 804)', () => {
    it('the seed: the recorded percent beyond the reported lines and paid draws, spread by weight over the rest', () => {
      expect(unreportedLineSeed(job804, 100)).toBe(100)
      expect(unreportedLineSeed(job804, 60)).toBe(60)
      expect(unreportedLineSeed(job804, 0)).toBe(0)
      expect(unreportedLineSeed(job804, null)).toBeNull()
      expect(unreportedLineSeed(job804, undefined)).toBeNull()
      // The mock-up's job at 46: the paid draw and Rough In carry 32.25, so the 45 points nobody has reported hold 13.75.
      expect(unreportedLineSeed(rows, 46)).toBeCloseTo(30.556, 3)
      // Every line has a number, or a paid draw: nothing to seed.
      expect(unreportedLineSeed([underground, roughIn], 46)).toBeNull()
      // The fresh job whose 40 came from Rough In being done: the rest count as 0, not 40 (the simple seed would count Rough In twice).
      expect(unreportedLineSeed([{ ...roughIn804, progressPct: 100 }, topOut804, trimSet804], 40)).toBe(0)
      // A record the reported lines already pass, or one they cannot carry, clamps.
      expect(unreportedLineSeed([{ ...roughIn804, progressPct: 100 }, { ...topOut804, progressPct: 50 }, trimSet804], 40)).toBe(0)
      expect(unreportedLineSeed([{ ...roughIn804, progressPct: 35 }, topOut804, trimSet804], 100)).toBe(100)
    })

    it('804: the job at 100 stays at 100 when Rough In is marked done; the old call still reads 40', () => {
      expect(jobPercentFromLines(job804, { r: 100 })).toBe(40)
      expect(lineProgressFieldValue(job804, { r: 100 })).toBe('Rough In — → 100% · job 0% → 40%')
      expect(jobPercentFromLines(job804, {}, 100)).toBe(100)
      expect(jobPercentFromLines(job804, { r: 100 }, 100)).toBe(100)
      expect(jobLine(job804, { r: 100 }, 100)).toEqual({ before: 100, after: 100, moved: true })
      expect(lineProgressFieldValue(job804, { r: 100 }, 100)).toBe('Rough In — → 100% · job 100% → 100%')
    })

    it('a job at 60 reads its unreported lines at 60, and one line moved to 50 moves the job by its share alone', () => {
      expect(jobPercentFromLines(job804, {}, 60)).toBe(60)
      expect(jobPercentFromLines(job804, { r: 50 }, 60)).toBe(56) // 20 + 24 + 12
      expect(lineProgressFieldValue(job804, { r: 50 }, 60)).toBe('Rough In — → 50% · job 60% → 56%')
      expect(jobPercentFromLines(job804, { s: 100 }, 60)).toBe(68) // 24 + 24 + 20
    })

    it('a fresh job whose 40 is Rough In done: Top Out to 100 reads 80, never 88', () => {
      const fresh = [{ ...roughIn804, progressPct: 100 }, topOut804, trimSet804]
      expect(jobPercentFromLines(fresh, {}, 40)).toBe(40)
      expect(jobPercentFromLines(fresh, { t: 100 }, 40)).toBe(80)
      expect(lineProgressFieldValue(fresh, { t: 100 }, 40)).toBe('Top Out — → 100% · job 40% → 80%')
    })

    it('a line\'s number reads the seed only when it has no pick and no record; a pick put back on 0 is no pick', () => {
      expect(linePct(topOut804, {}, 60)).toBe(60)
      expect(linePct(topOut804, { t: 0 }, 60)).toBe(60)
      expect(linePct(topOut804, { t: 25 }, 60)).toBe(25)
      expect(linePct(roughIn, {}, 60)).toBe(35)
      expect(linePct(underground, {}, 60)).toBe(100)
      expect(linePct(topOut804, {})).toBe(0)
      expect(movedLines(job804, { t: 0 })).toEqual([])
      expect(jobPercentFromLines(job804, { t: 0 }, 60)).toBe(60)
      // A pick that lands on the seed is still the tech's number: named, stamped, and the job unmoved.
      expect(movedLines(job804, { t: 60 })).toEqual([{ fixtureId: 't', name: 'Top Out', from: null, to: 60 }])
      expect(lineProgressFieldValue(job804, { t: 60 }, 60)).toBe('Top Out — → 60% · job 60% → 60%')
      // The row's words and the record stay as they were: the seed is the sum's business.
      expect(lineWords(topOut804, {})).toEqual({ text: 'not started', tone: 'none' })
      expect(lineIsDone(topOut804, {})).toBe(false)
    })

    it('a record the lines cannot carry clamps the seed at done, and one the lines already pass seeds 0', () => {
      expect(jobPercentFromLines(rows, {}, 100)).toBe(77) // 32.25 + 45 at 100
      expect(lineProgressFieldValue(rows, { r: 50 }, 100)).toBe('Rough In 35% → 50% · job 100% → 83%') // 20 + 17.5 + 45
      const past = [{ ...roughIn804, progressPct: 100 }, { ...topOut804, progressPct: 50 }, trimSet804]
      expect(jobPercentFromLines(past, {}, 40)).toBe(60)
    })

    it('how? names what a seeded line counts as, and its points still add up to the job', () => {
      const how804 = howRows(job804, { r: 100 }, 100)
      expect(how804.rows).toEqual([
        { fixtureId: 'r', name: 'Rough In', sharePct: 40, standing: 'done', points: 40 },
        { fixtureId: 't', name: 'Top Out', sharePct: 40, standing: 'counts as 100%', points: 40 },
        { fixtureId: 's', name: 'Trim Set', sharePct: 20, standing: 'counts as 100%', points: 20 },
      ])
      expect(how804.total).toBe(100)
      const how = howRows(rows, { r: 50 }, 46)
      expect(how.rows.map((r) => r.standing)).toEqual(['paid', '50%', 'counts as 31%', 'counts as 31%', 'counts as 31%'])
      expect(how.rows.map((r) => r.points)).toEqual([20, 17, 8, 5, 1])
      expect(how.total).toBe(51)
      // No record: the old words, the old points.
      expect(howRows(job804, { r: 100 }).rows.map((r) => r.standing)).toEqual(['done', '—', '—'])
    })
  })

  it("a row's words: paid, done, a move up or down, on record, or nothing yet", () => {
    expect(lineWords(underground, {})).toEqual({ text: '✓ Paid', tone: 'paid' })
    expect(lineWords({ ...roughIn, progressPct: 100 }, {})).toEqual({ text: '✓ Done', tone: 'done' })
    expect(lineWords(roughIn, { r: 50 })).toEqual({ text: '35% → 50%', tone: 'up' })
    expect(lineWords(roughIn, { r: 100 })).toEqual({ text: '35% → ✓ Done', tone: 'up' })
    expect(lineWords(roughIn, { r: 20 })).toEqual({ text: '35% → 20%', tone: 'down' })
    expect(lineWords(heater, { w: 100 })).toEqual({ text: '— → ✓ Done', tone: 'up' })
    expect(lineWords(roughIn, {})).toEqual({ text: '35%', tone: 'plain' })
    expect(lineWords(topOut, {})).toEqual({ text: 'not started', tone: 'none' })
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
