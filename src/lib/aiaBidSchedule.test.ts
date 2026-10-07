import { describe, expect, it } from 'vitest'
import {
  bidStageOfJobLine,
  crewOfferForLine,
  crewPercentByStage,
  linesFromBidSovLines,
  linesFromStageSplits,
  scaleLinesToAmount,
  scheduleGap,
} from './aiaBidSchedule'
import type { SovLine } from './bidDocuments/sovLines'
import type { SovStageSplit } from './bidDocuments/sovLaborMaterial'
import type { PayApplicationLine } from './aiaPayApplicationLines'

const sov = (p: Partial<SovLine>): SovLine => ({ id: 'x', sortOrder: 0, label: '', value: 0, labor: null, note: '', stage: null, ...p })
const line = (p: Partial<PayApplicationLine>): PayApplicationLine => ({ id: 'a', label: 'Top-out', scheduledValue: 28800, labor: 12960, stage: 'top_out', fromPrevious: 0, thisPeriod: 0, stored: 0, ...p })

describe('the bid\'s schedule as lines', () => {
  it('brings the estimator\'s lines over as written, in order, with typed labor or the company share', () => {
    const lines = linesFromBidSovLines(
      [
        sov({ id: 'b', sortOrder: 1, label: ' Top-out ', value: 28800, labor: 12000, stage: 'top_out' }),
        sov({ id: 'a', sortOrder: 0, label: 'Underground', value: 19200, stage: 'rough_in' }),
        sov({ id: 'c', sortOrder: 2 }),
      ],
      45,
    )
    expect(lines).toEqual([
      // 45% of 19,200.
      { id: 'sov-a', label: 'Underground', scheduledValue: 19200, labor: 8640, stage: 'rough_in', fromPrevious: 0, thisPeriod: 0, stored: 0 },
      { id: 'sov-b', label: 'Top-out', scheduledValue: 28800, labor: 12000, stage: 'top_out', fromPrevious: 0, thisPeriod: 0, stored: 0 },
    ])
  })

  it('brings a bid left on the stages over as three lines with their labor part', () => {
    const splits = [
      { stage: 'rough_in', label: 'Rough In', value: 33600, labor: 15120, material: 18480 },
      { stage: 'top_out', label: 'Top Out', value: 38400, labor: 17280, material: 21120 },
      { stage: 'trim_set', label: 'Trim Set', value: 24000, labor: 10800, material: 13200 },
    ] as SovStageSplit[]
    expect(linesFromStageSplits(splits).map((l) => [l.id, l.label, l.scheduledValue, l.labor, l.stage])).toEqual([
      ['stage-rough_in', 'Rough In', 33600, 15120, 'rough_in'],
      ['stage-top_out', 'Top Out', 38400, 17280, 'top_out'],
      ['stage-trim_set', 'Trim Set', 24000, 10800, 'trim_set'],
    ])
  })

  it('brings nothing from a bid with only one stage staged, so the job keeps its one line', () => {
    // Job 1007 on 2026-10-04: one of 22 fixtures staged, the whole contract on Trim Set.
    const oneStage = [{ stage: 'trim_set', label: 'Trim Set', value: 249715.66, labor: 0, material: 249715.66 }] as SovStageSplit[]
    expect(linesFromStageSplits(oneStage)).toEqual([])
    expect(linesFromStageSplits([])).toEqual([])
  })
})

describe('the lines against the contract', () => {
  const lines = [line({ id: 'a', scheduledValue: 19200, labor: 8640 }), line({ id: 'b', scheduledValue: 28800, labor: 12960, thisPeriod: 1000 })]

  it('says how far the lines are from the contract to date', () => {
    expect(scheduleGap(lines, 48000)).toEqual({ total: 48000, gap: 0 })
    expect(scheduleGap(lines, 50000)).toEqual({ total: 48000, gap: 2000 })
    expect(scheduleGap(lines, 45000)).toEqual({ total: 48000, gap: -3000 })
  })

  it('scales every line to the amount, to the cent, and leaves claimed work alone', () => {
    const scaled = scaleLinesToAmount(lines, 50000)!
    expect(scaled.map((l) => l.scheduledValue)).toEqual([20000, 30000])
    expect(scaled.map((l) => l.labor)).toEqual([9000, 13500])
    expect(scaled[1]!.thisPeriod).toBe(1000)
    // Thirds of 100.00 still add to 100.00.
    const thirds = scaleLinesToAmount([line({ id: 'a', scheduledValue: 1, labor: null }), line({ id: 'b', scheduledValue: 1, labor: null }), line({ id: 'c', scheduledValue: 1, labor: null })], 100)!
    expect(thirds.reduce((t, l) => t + Math.round(l.scheduledValue * 100), 0)).toBe(10000)
    expect(scaleLinesToAmount([line({ scheduledValue: 0 })], 100)).toBeNull()
    expect(scaleLinesToAmount(lines, 0)).toBeNull()
  })
})

describe('the crew\'s percents', () => {
  it('reads a job line\'s stage word as one of the bid\'s three stages', () => {
    expect(bidStageOfJobLine('Underground')).toBe('rough_in')
    expect(bidStageOfJobLine('Rough In')).toBe('rough_in')
    expect(bidStageOfJobLine('2. Top Out')).toBe('top_out')
    expect(bidStageOfJobLine('Trim Set')).toBe('trim_set')
    expect(bidStageOfJobLine('Final')).toBe('trim_set')
    expect(bidStageOfJobLine('Permit')).toBeNull()
    expect(bidStageOfJobLine(null)).toBeNull()
  })

  it('takes each stage\'s percent from the job\'s stage lines, weighted by price when a stage has several', () => {
    const crew = crewPercentByStage([
      { name: 'Underground', count: 1, line_unit_price: 10000, progress_pct: 100 },
      { name: 'Rough In', count: 1, line_unit_price: 30000, progress_pct: 60 },
      { name: 'Top Out', count: 1, line_unit_price: 38400, progress_pct: 90 },
      { name: 'Trim Set', count: 1, line_unit_price: 24000, progress_pct: null },
      { name: 'Permit', count: 1, line_unit_price: 500, progress_pct: 100 },
    ])
    // (10,000 × 100 + 30,000 × 60) / 40,000 = 70.
    expect(crew).toEqual({ rough_in: 70, top_out: 90 })
    // A stage line with no price still counts.
    expect(crewPercentByStage([{ name: 'Top Out', count: 0, line_unit_price: null, progress_pct: 40 }])).toEqual({ top_out: 40 })
  })

  it('offers the crew\'s percent only when it is ahead of what the line claims', () => {
    const crew = { top_out: 90 }
    expect(crewOfferForLine(line({ fromPrevious: 14400 }), crew)).toBe(90) // the line is at 50%
    expect(crewOfferForLine(line({ fromPrevious: 14400, thisPeriod: 11520 }), crew)).toBeNull() // already at 90%
    expect(crewOfferForLine(line({ fromPrevious: 28800 }), crew)).toBeNull() // past it
    expect(crewOfferForLine(line({ stage: 'trim_set' }), crew)).toBeNull() // no report for the stage
    expect(crewOfferForLine(line({ stage: null }), crew)).toBeNull()
    expect(crewOfferForLine(line({ scheduledValue: 0 }), crew)).toBeNull()
  })
})
