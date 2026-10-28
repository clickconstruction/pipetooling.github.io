import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { applyDial, buildDialReading, dialSpec, farDayLabel, todayPace } from './dial'
import type { StageFlowInput } from './stageFlow'

const input: StageFlowInput = {
  market: { bidsInvited: 20, bidsInvitedUsd: 2_400_000, estimatesRequested: 25, estimatesRequestedUsd: 64_000, weeks: 8 },
  sales: { bids: { sentUsd: 2_400_000, wonUsd: 0, startedUsd: 98_000, lostUsd: 645_000 }, estimates: { sentUsd: 64_000, wonUsd: 25_000, lostUsd: 0 }, awaiting: { bids: 28, bidsUsd: 4_728_000, estimates: 13, estimatesUsd: 46_000 }, soldPerWeekUsd: 49_000 },
  fieldPerWeekUsd: 35_000,
  build: { pileUsd: 362_000, pileCount: 28, inPerWeekUsd: 49_000, outPerWeekUsd: 35_000, knownJobs: 28, guessUsd: 0, guessJobs: 0 },
  bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
  collect: { pileUsd: 332_000, pileCount: 49, inPerWeekUsd: 22_000, outPerWeekUsd: 46_000, lateCount: 49 },
  heldLinkId: null,
}
const dayLabel = (ymd: string) => ymd
const todayYmd = '2026-10-10'

describe('the dial', () => {
  it('reads today’s pace and a range around it', () => {
    expect(todayPace(input, 'bill')).toBe(22_000)
    expect(todayPace(input, 'market')).toBe(308_000)
    const spec = dialSpec(input, 'bill', { perUnitUsd: 233_000 / 15 })!
    expect(spec).toMatchObject({ stage: 'bill', todayUsd: 22_000, minUsd: 6000, maxUsd: 66_000, stepUsd: 1000, elevateAtUsd: 33_000 })
    expect(dialSpec({ ...input, bill: null }, 'bill', { perUnitUsd: null })).toBeNull()
  })

  it('moving Bill feeds Collect; moving Build feeds Bill and the feeders’ pace', () => {
    const a = applyDial(input, 'bill', 40_000)
    expect(a.bill!.outPerWeekUsd).toBe(40_000)
    expect(a.collect!.inPerWeekUsd).toBe(40_000)
    const b = applyDial(input, 'build', 50_000)
    expect(b.build!.outPerWeekUsd).toBe(50_000)
    expect(b.fieldPerWeekUsd).toBe(50_000)
    expect(b.bill!.inPerWeekUsd).toBe(50_000)
    const m = applyDial(input, 'market', 616_000)
    expect(m.market!.bidsInvitedUsd).toBe(4_800_000)
  })

  it('at today’s pace Bill is the link, the pile grows and the money line splits the field’s week', () => {
    const spec = dialSpec(input, 'bill', { perUnitUsd: 233_000 / 15 })!
    const r = buildDialReading(input, 'bill', 22_000, { spec, todayYmd, dayLabel })
    expect(r.valueText).toBe('$22k/wk')
    expect(r.unitText).toBe('about 1.4 jobs a week')
    expect(r.marks.map((m) => m.label)).toEqual(['today', 'the pile stops growing', 'above here Build is the link', 'a second biller from here'])
    expect(r.lines[0]).toEqual({ head: 'the pile', text: 'The field finishes $34k a week and the office bills $22k. The pile grows $12k a week and reaches $377k in twelve weeks.', tone: 'amber' })
    expect(r.lines[1]!.text).toBe('Bill is the weakest link: 10.6 weeks to bill what is already finished. Build is next, 10.3 weeks.')
    expect(r.lines[2]!.text).toBe('Of the field’s $34k a week, $22k becomes a bill. $12k a week is earned on paper and not billed.')
    expect(r.spark.tone).toBe('red')
    expect(r.spark.endText).toBe('$377k')
    expect(r.flow.linkId).toBe('bill')
  })

  it('at $40k Build becomes the link and the pile is gone by a date', () => {
    const spec = dialSpec(input, 'bill', { perUnitUsd: 233_000 / 15 })!
    const r = buildDialReading(input, 'bill', 40_000, { spec, todayYmd, dayLabel })
    expect(r.flow.linkId).toBe('build')
    expect(r.lines[0]!.text).toBe('The field finishes $34k a week and the office bills $40k. The pile shrinks $6k a week and is gone by 2027-07-09.')
    expect(r.lines[1]!.text).toBe('Build becomes the weakest link: 10.3 weeks to build what is already sold. Bill is down to 5.8 weeks.')
    expect(r.lines[2]!.text).toBe('All of the field’s $34k a week becomes a bill, plus $6k a week of the old pile.')
    expect(r.spark.tone).toBe('green')
  })

  it('a feeder reads Build’s pile and the field’s pace', () => {
    const spec = dialSpec(input, 'sales', { perUnitUsd: null })!
    const r = buildDialReading(input, 'sales', 49_000, { spec, todayYmd, dayLabel })
    expect(r.marks.map((m) => m.label)).toEqual(['today', 'the field’s pace'])
    expect(r.lines[0]!.text).toBe('The field gets $49k a week of work and builds $35k. Build’s pile grows $14k a week.')
    expect(r.lines[1]!.text).toBe('Bill stays the weakest link. Selling more adds to the piles and does not move it.')
    expect(r.spark.pileWord).toBe('Build’s pile')
    const dry = buildDialReading(input, 'sales', 20_000, { spec, todayYmd, dayLabel })
    expect(dry.lines[0]!.text).toContain('It runs out of work by')
    expect(dry.lines[1]!.text).toBe('Bill is the weakest link until the field runs out of work. Then Sales is.')
  })

  it('keeps every reading in plain words', () => {
    for (const stage of ['market', 'sales', 'build', 'bill', 'collect'] as const) {
      const spec = dialSpec(input, stage, { perUnitUsd: 10_000 })!
      for (const usd of [spec.minUsd, spec.todayUsd, spec.maxUsd]) {
        const r = buildDialReading(input, stage, usd, { spec, todayYmd, dayLabel: (y) => y })
        for (const l of r.lines) expect(plainWordsFailures(l.text), `${stage} ${usd}: ${l.text}`).toEqual([])
      }
    }
  })
})

describe('a far day names its year (#201)', () => {
  const md = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

  it('keeps the month and day inside the year ahead, even across New Year, and adds the year past it', () => {
    expect(farDayLabel('2026-12-19', todayYmd, md)).toBe('Dec 19')
    expect(farDayLabel('2027-03-28', todayYmd, md)).toBe('Mar 28')
    expect(farDayLabel('2027-09-10', todayYmd, md)).toBe('Sep 10')
    expect(farDayLabel('2027-09-11', todayYmd, md)).toBe('Sep 11, 2027')
    expect(farDayLabel('2028-06-04', todayYmd, md)).toBe('Jun 4, 2028')
  })

  it('the pile line: ten weeks out keeps the day, two years out names the year', () => {
    const spec = dialSpec(input, 'bill', { perUnitUsd: 233_000 / 15 })!
    const near = buildDialReading(input, 'bill', 57_300, { spec, todayYmd, dayLabel: md })
    expect(near.lines[0]!.text).toContain('is gone by Dec 19.')
    const far = buildDialReading(input, 'bill', 36_000, { spec, todayYmd, dayLabel: md })
    expect(far.lines[0]!.text).toContain('is gone by Jan 3, 2029.')
  })

  it('the field line: across New Year keeps the day, two years out names the year', () => {
    const spec = dialSpec(input, 'sales', { perUnitUsd: null })!
    const near = buildDialReading(input, 'sales', 20_000, { spec, todayYmd, dayLabel: md })
    expect(near.lines[0]!.text).toBe('The field gets $20k a week of work and builds $35k. It runs out of work by Mar 28.')
    const far = buildDialReading(input, 'sales', 31_500, { spec, todayYmd, dayLabel: md })
    expect(far.lines[0]!.text).toContain('It runs out of work by Oct 3, 2028.')
  })
})
