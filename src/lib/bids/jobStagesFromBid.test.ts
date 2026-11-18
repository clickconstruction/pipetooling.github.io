import { describe, expect, it } from 'vitest'
import type { BidSchedule } from '../aiaBidSchedule'
import type { AwardBidBreakdown } from '../jobs/awardBaseline'
import { DEFAULT_LINE_BUDGET_SETTINGS } from '../jobs/lineBudgets'
import {
  BID_CARRY_WORDS,
  bidStageHoursWhy,
  bidStageLines,
  bidStageSplits,
  bringBidStagesLabel,
  bringBidStagesStanding,
  defaultBidStageSplitKey,
  type BidStageSplit,
  type BringStagesLine,
} from './jobStagesFromBid'

const settings = DEFAULT_LINE_BUDGET_SETTINGS
const bid = { bid_number: '482', project_name: 'Oak Ridge' }

const scheduleLine = (label: string, scheduledValue: number, stage: 'rough_in' | 'top_out' | 'trim_set' | null = null) => ({ id: `l-${label}`, label, scheduledValue, labor: null, stage, fromPrevious: 0, thisPeriod: 0, stored: 0 })
const schedule = (...lines: ReturnType<typeof scheduleLine>[]): BidSchedule => ({ lines, splitLaborMaterial: false, shape: 'lines' })

/** A bid the award would take: every Labor row has hours and the bid has a rate. */
const usable = (over: Partial<AwardBidBreakdown> = {}): AwardBidBreakdown => ({
  has_estimate: true,
  labor_hours: 563,
  labor_rate: 45,
  labor_usd: 25_335,
  materials_usd: 19_720,
  completeness: { rows_total: 10, rows_with_hours: 10, rate_set: true, usable: true },
  labor_hours_by_stage: { rough: 240, top: 190, trim: 133 },
  ...over,
})

const split = (key: 'commercial' | 'residential' | 'bid', s: BidSchedule | null = null): BidStageSplit => bidStageSplits(s).find((x) => x.key === key)!
const sumCents = (lines: ReadonlyArray<{ line_unit_price: number }>) => lines.reduce((t, l) => t + Math.round(l.line_unit_price * 100), 0)

describe('bidStageSplits', () => {
  it('offers the two company splits when the bid has no schedule', () => {
    expect(bidStageSplits(null).map((s) => s.key)).toEqual(['commercial', 'residential'])
  })

  it('puts the bid’s own schedule first when it holds two or more priced lines', () => {
    const splits = bidStageSplits(schedule(scheduleLine('Underground', 4000), scheduleLine('Rough In', 6000, 'rough_in')))
    expect(splits.map((s) => s.key)).toEqual(['bid', 'commercial', 'residential'])
    expect(splits[0]!.rows).toEqual([
      { name: 'Underground', weight: 4000, stage: null },
      { name: 'Rough In', weight: 6000, stage: 'rough_in' },
    ])
  })

  it('reads a schedule line’s stage from its name when the line carries none', () => {
    const splits = bidStageSplits(schedule(scheduleLine('Top Out', 1), scheduleLine('Trim Set', 1)))
    expect(splits[0]!.rows.map((r) => r.stage)).toEqual(['top_out', 'trim_set'])
  })

  it('treats a schedule with one priced line as no split', () => {
    expect(bidStageSplits(schedule(scheduleLine('Everything', 9000), scheduleLine('Empty', 0))).map((s) => s.key)).toEqual(['commercial', 'residential'])
  })

  it('names each preset row’s stage, and none for Final', () => {
    expect(split('commercial').rows.map((r) => r.stage)).toEqual(['rough_in', 'top_out', 'trim_set', null])
  })
})

describe('defaultBidStageSplitKey', () => {
  it('lights the bid’s schedule when there is one', () => {
    expect(defaultBidStageSplitKey(bidStageSplits(schedule(scheduleLine('A', 1), scheduleLine('B', 1))), 'residential')).toBe('bid')
  })

  it('follows the customer’s kind, and takes the company standard when it says nothing', () => {
    const splits = bidStageSplits(null)
    expect(defaultBidStageSplitKey(splits, 'Residential')).toBe('residential')
    expect(defaultBidStageSplitKey(splits, 'commercial')).toBe('commercial')
    expect(defaultBidStageSplitKey(splits, null)).toBe('commercial')
  })

  it('is null with nothing to offer', () => {
    expect(defaultBidStageSplitKey([], 'commercial')).toBeNull()
  })
})

describe('bidStageLines, the dollars', () => {
  it('splits 30/30/30/10 to the cent', () => {
    const r = bidStageLines({ priceUsd: 56_343, split: split('commercial'), breakdown: null, settings, bid, agreed: true })
    expect(r.lines.map((l) => [l.name, l.line_unit_price])).toEqual([
      ['Rough In', 16_902.9],
      ['Top Out', 16_902.9],
      ['Trim Set', 16_902.9],
      ['Final', 5_634.3],
    ])
    expect(r.totalUsd).toBe(56_343)
  })

  it('adds up on a price that does not divide evenly', () => {
    for (const price of [100.01, 1000.01, 33_333.33, 7.77]) {
      for (const key of ['commercial', 'residential'] as const) {
        const r = bidStageLines({ priceUsd: price, split: split(key), breakdown: null, settings, bid, agreed: true })
        expect(sumCents(r.lines)).toBe(Math.round(price * 100))
      }
    }
  })

  it('scales the bid’s own lines to the price the job opens at', () => {
    const s = schedule(scheduleLine('Rough In', 600, 'rough_in'), scheduleLine('Trim Set', 400, 'trim_set'))
    const r = bidStageLines({ priceUsd: 2000, split: split('bid', s), breakdown: null, settings, bid, agreed: false })
    expect(r.lines.map((l) => l.line_unit_price)).toEqual([1200, 800])
    expect(r.lines[0]!.line_description).toBe('B482 · Oak Ridge — 60% of what was sent')
  })

  it('makes every line a plain Any time line with no bill on it', () => {
    const r = bidStageLines({ priceUsd: 9000, split: split('residential'), breakdown: null, settings, bid, agreed: true })
    for (const l of r.lines) {
      expect(l.stage_kind).toBe('any')
      expect(l.count).toBe(1)
      expect(l.invoice_id).toBeNull()
    }
    expect(r.lines[0]!.line_description).toBe('B482 · Oak Ridge — 40% of the agreed value')
  })

  it('brings nothing for a price of zero', () => {
    expect(bidStageLines({ priceUsd: 0, split: split('commercial'), breakdown: usable(), settings, bid, agreed: true }).lines).toEqual([])
  })
})

describe('bidStageLines, the hours', () => {
  it('gives each stage its own hours from the bid, and none to Final', () => {
    const r = bidStageLines({ priceUsd: 56_343, split: split('commercial'), breakdown: usable(), settings, bid, agreed: true })
    expect(r.hoursBasis).toBe('stages')
    expect(r.unplacedHours).toBe(0)
    const [rough, top, trim, final] = r.preview
    // The share is stored as a whole percent, so a line reads within a couple of hours of the bid's own figure.
    expect(Math.abs(rough!.hours - 240)).toBeLessThan(2)
    expect(Math.abs(top!.hours - 190)).toBeLessThan(2)
    expect(Math.abs(trim!.hours - 133)).toBeLessThan(2)
    expect(final).toMatchObject({ hours: 0, hoursFrom: 'none' })
    expect(rough!.hoursFrom).toBe('bid')
    expect(r.lines[0]).toMatchObject({ budget_labor_pct: 64, budget_materials_pct: 35, budget_source: 'workbench', budget_rate_usd: 45, budget_tuned_at: null })
    expect(r.lines[3]).toMatchObject({ budget_labor_pct: 0, budget_source: 'workbench' })
  })

  it('never lets labor and materials pass the line’s price', () => {
    const r = bidStageLines({ priceUsd: 10_000, split: split('commercial'), breakdown: usable({ labor_hours_by_stage: { rough: 900, top: 10, trim: 10 }, materials_usd: 6000 }), settings, bid, agreed: true })
    const rough = r.lines[0]!
    expect(rough.budget_labor_pct).toBe(100)
    expect(rough.budget_materials_pct).toBe(0)
    for (const l of r.lines) expect((l.budget_labor_pct ?? 0) + (l.budget_materials_pct ?? 0)).toBeLessThanOrEqual(100)
  })

  it('shares one stage’s hours between two lines by their price', () => {
    const s = schedule(scheduleLine('Rough In, building A', 600, 'rough_in'), scheduleLine('Rough In, building B', 400, 'rough_in'), scheduleLine('Trim Set', 1000, 'trim_set'))
    const r = bidStageLines({ priceUsd: 40_000, split: split('bid', s), breakdown: usable({ labor_hours_by_stage: { rough: 100, top: 0, trim: 50 } }), settings, bid, agreed: true })
    // The lines scale to $12,000, $8,000 and $20,000, so Rough In's 100 h land 60 and 40, each within a whole percent of its line.
    expect(Math.abs(r.preview[0]!.hours - 60)).toBeLessThan(2)
    expect(Math.abs(r.preview[1]!.hours - 40)).toBeLessThan(2)
    expect(Math.abs(r.preview[2]!.hours - 50)).toBeLessThan(2)
    expect(r.preview[0]!.hours).toBeGreaterThan(r.preview[1]!.hours)
  })

  it('says how many of the bid’s hours found no line', () => {
    const s = schedule(scheduleLine('Rough In', 500, 'rough_in'), scheduleLine('Top Out', 500, 'top_out'))
    const r = bidStageLines({ priceUsd: 40_000, split: split('bid', s), breakdown: usable(), settings, bid, agreed: true })
    expect(r.unplacedHours).toBe(133)
    expect(BID_CARRY_WORDS.hoursFrom(r, 'B482 · Oak Ridge', '')).toBe('Hours: B482 · Oak Ridge’s Labor tab. 133 h on the bid have no line here.')
  })

  it('spreads the bid’s hours by price when the bid has none by stage', () => {
    const r = bidStageLines({ priceUsd: 56_343, split: split('commercial'), breakdown: usable({ labor_hours_by_stage: null }), settings, bid, agreed: true })
    expect(r.hoursBasis).toBe('spread')
    expect(r.lines.map((l) => l.budget_labor_pct)).toEqual([45, 45, 45, 45])
    expect(BID_CARRY_WORDS.hoursFrom(r, 'B482', '')).toBe('Hours: B482’s Labor tab, spread by price.')
  })

  it('reads the bid’s own hours back whatever rate the bid priced its labor at', () => {
    // A bid at $30 an hour once read 15 h on a line where its Labor tab said 23: every reader of a line divides by the company's rate.
    for (const labor_rate of [30, 45, 80, null]) {
      const b = usable({ labor_rate, labor_usd: labor_rate ? 563 * labor_rate : 0, completeness: { rows_total: 10, rows_with_hours: 10, rate_set: labor_rate != null, usable: labor_rate != null } })
      const r = bidStageLines({ priceUsd: 56_343, split: split('commercial'), breakdown: b, settings, bid, agreed: true })
      expect(r.hoursBasis).toBe('stages')
      expect(r.lines[0]!.budget_rate_usd).toBe(45)
      expect(Math.abs(r.preview[0]!.hours - 240)).toBeLessThan(2)
      expect(Math.abs(r.totalHours - 563)).toBeLessThan(5)
    }
  })

  it('keeps small hours on a big price within a percent of the line', () => {
    const r = bidStageLines({ priceUsd: 56_343, split: split('commercial'), breakdown: usable({ labor_hours: 70, labor_hours_by_stage: { rough: 23, top: 27, trim: 20 } }), settings, bid, agreed: true })
    expect(r.preview.slice(0, 3).map((p) => Math.round(p.hours))).toEqual([23, 26, 19])
  })

  it('stores no budget when the bid cannot be used, and the lines read the company’s split', () => {
    const thin = usable({ completeness: { rows_total: 31, rows_with_hours: 9, rate_set: true, usable: false } })
    for (const breakdown of [null, thin]) {
      const r = bidStageLines({ priceUsd: 56_343, split: split('commercial'), breakdown, settings, bid, agreed: true })
      expect(r.hoursBasis).toBe('assumed')
      expect(r.lines.every((l) => l.budget_source === undefined)).toBe(true)
      expect(r.preview.every((p) => p.hoursFrom === 'assumed')).toBe(true)
      // Rough In at the company's 45% labor and $45 an hour.
      expect(r.preview[0]!.hours).toBeCloseTo((16_902.9 * 0.45) / 45, 5)
    }
    expect(bidStageHoursWhy(thin, bid, settings)).toBe('B482 has hours on 9 of 31 Labor rows.')
    expect(bidStageHoursWhy(null, bid, settings)).toBe('B482 has no cost estimate.')
    expect(bidStageHoursWhy(usable(), bid, settings)).toBe('')
  })
})

describe('BID_CARRY_WORDS', () => {
  it('names the window and each press by what it does', () => {
    expect(BID_CARRY_WORDS.title(56_343)).toBe('How should $56,343 come onto the job?')
    expect(BID_CARRY_WORDS.title(1200.5)).toBe('How should $1,200.50 come onto the job?')
    expect(BID_CARRY_WORDS.confirm('stages', 56_343, 4)).toBe('Bring 4 stages · $56,343')
    expect(BID_CARRY_WORDS.confirm('stages', 500, 1)).toBe('Bring 1 stage · $500')
    expect(BID_CARRY_WORDS.confirm('one', 56_343, 4)).toBe('Carry $56,343 over')
    expect(BID_CARRY_WORDS.confirm('zero', 56_343, 4)).toBe('Start at $0')
  })

  it('says where the dollars and the hours came from', () => {
    expect(BID_CARRY_WORDS.dollarsFrom(split('commercial'), 'B482')).toBe('Dollars: the company’s 30/30/30/10.')
    expect(BID_CARRY_WORDS.dollarsFrom(split('residential'), 'B482')).toBe('Dollars: the company’s 40/40/20.')
    expect(BID_CARRY_WORDS.dollarsFrom(split('bid', schedule(scheduleLine('A', 1), scheduleLine('B', 1))), 'B482')).toBe('Dollars: B482’s schedule of values.')
    expect(BID_CARRY_WORDS.hoursFrom({ hoursBasis: 'assumed', unplacedHours: 0 }, 'B482', 'B482 has no cost estimate.')).toBe('Hours: assumed from the company’s split. B482 has no cost estimate.')
    expect(BID_CARRY_WORDS.hours({ hours: 240.4, hoursFrom: 'bid' })).toBe('240 h')
    expect(BID_CARRY_WORDS.hours({ hours: 169.03, hoursFrom: 'assumed' })).toBe('≈ 169 h')
    expect(BID_CARRY_WORDS.hours({ hours: 0, hoursFrom: 'none' })).toBe('no hours')
  })
})

describe('bringBidStagesStanding', () => {
  const line = (over: Partial<BringStagesLine> = {}): BringStagesLine => ({ id: 'f1', line_kind: 'work', invoice_id: null, progress_pct: null, progress_report_id: null, trip_id: null, budget_source: 'assumed', ...over })
  const input = (over: Partial<Parameters<typeof bringBidStagesStanding>[0]> = {}) => ({ bidId: 'b1', status: 'working', lines: [line()], hasPayApplication: false, checklistLineIds: new Set<string>(), windowLineIds: new Set<string>(), ...over })

  it('offers the stages on an open job from a bid with one clean line', () => {
    expect(bringBidStagesStanding(input())).toEqual({ state: 'ready', lineId: 'f1' })
    expect(bringBidStagesStanding(input({ status: 'waiting' }))).toEqual({ state: 'ready', lineId: 'f1' })
  })

  it('does not count a discount as a second line', () => {
    expect(bringBidStagesStanding(input({ lines: [line(), line({ id: 'd1', line_kind: 'discount' })] }))).toEqual({ state: 'ready', lineId: 'f1' })
  })

  it('says nothing with no bid, a closed job, no line or several lines', () => {
    expect(bringBidStagesStanding(input({ bidId: null })).state).toBe('none')
    for (const status of ['ready_to_bill', 'billed', 'paid', null]) expect(bringBidStagesStanding(input({ status })).state).toBe('none')
    expect(bringBidStagesStanding(input({ lines: [] })).state).toBe('none')
    expect(bringBidStagesStanding(input({ lines: [line(), line({ id: 'f2' })] })).state).toBe('none')
  })

  it('holds with its reason and the door that still works', () => {
    const cases: Array<[Partial<Parameters<typeof bringBidStagesStanding>[0]>, string, string]> = [
      [{ lines: [line({ invoice_id: 'inv' })] }, 'on-a-bill', 'This line is on a bill, so it stays one line. Add a stage with + Add line item.'],
      [{ hasPayApplication: true }, 'pay-application', 'This job has a pay application, so its lines stay as they are. Add a stage with + Add line item.'],
      [{ lines: [line({ progress_pct: 0 })] }, 'crew-percent', 'The crew has reported on this line, so it stays one line. Add a stage with + Add line item.'],
      [{ lines: [line({ progress_report_id: 'r1' })] }, 'crew-percent', 'The crew has reported on this line, so it stays one line. Add a stage with + Add line item.'],
      [{ checklistLineIds: new Set(['f1']) }, 'checklist', 'This line has a checklist answer, so it stays one line. Add a stage with + Add line item.'],
      [{ windowLineIds: new Set(['f1']) }, 'window', 'This line has stage dates on the Subs tab, so it stays one line. Add a stage with + Add line item.'],
      [{ lines: [line({ trip_id: 't1' })] }, 'trip', 'This line came from a trip, so it stays one line. Add a stage with + Add line item.'],
      [{ lines: [line({ budget_source: 'tuned' })] }, 'tuned', 'The owner tuned this line’s budget, so it stays one line. Add a stage with + Add line item.'],
    ]
    for (const [over, hold, words] of cases) expect(bringBidStagesStanding(input(over))).toEqual({ state: 'held', hold, words })
  })

  it('names the bill first when several things hang on the line', () => {
    const r = bringBidStagesStanding(input({ lines: [line({ invoice_id: 'inv', progress_pct: 50, trip_id: 't1' })], hasPayApplication: true }))
    expect(r).toMatchObject({ state: 'held', hold: 'on-a-bill' })
  })

  it('ignores a checklist answer or a window on some other line', () => {
    expect(bringBidStagesStanding(input({ checklistLineIds: new Set(['other']), windowLineIds: new Set(['other']) })).state).toBe('ready')
  })
})

describe('bringBidStagesLabel', () => {
  it('names the bid by its number', () => {
    expect(bringBidStagesLabel({ bid_number: '398' })).toBe('Bring B398’s stages')
    expect(bringBidStagesLabel({ bid_number: null })).toBe('Bring the bid’s stages')
  })
})
