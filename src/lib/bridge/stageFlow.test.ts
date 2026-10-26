import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { STAGE_RULE_LINE, STAGE_RULE_LONG, STAGE_RULE_POINTS, buildStageFlow, marketWinShare, stageUsd, weeksToClear, withFieldPaces } from './stageFlow'

const today = () =>
  buildStageFlow({
    market: null, sales: null, fieldPerWeekUsd: null, bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
    collect: { pileUsd: 332_000, pileCount: null, inPerWeekUsd: 22_000, outPerWeekUsd: 46_000, lateCount: 49 },
    build: { pileUsd: 362_000, pileCount: 28, inPerWeekUsd: 49_000, outPerWeekUsd: 35_000, knownJobs: 28, guessUsd: 257_000, guessJobs: 36 },
    heldLinkId: null,
  })

describe('buildStageFlow', () => {
  it('reads each pile stage as a pile, two flow lines and weeks to clear', () => {
    const flow = today()
    const bill = flow.stages.find((s) => s.id === 'bill')!
    expect(bill.pile.headline).toBe('$233k finished, not yet billed')
    expect(bill.pile.sub).toEqual(['on 15 jobs'])
    expect(bill.flow).toEqual([
      { who: 'the field finishes', usd: '$34k' },
      { who: 'the office bills', usd: '$22k' },
    ])
    expect(bill.weeksText).toBe('10.6 weeks to bill what is already finished')
    const collect = flow.stages.find((s) => s.id === 'collect')!
    expect(collect.pile.headline).toBe('$332k billed, not yet paid')
    expect(collect.pile.sub).toEqual(['49 invoices late'])
    expect(collect.weeksText).toBe('7.2 weeks to collect what is already late')
    const build = flow.stages.find((s) => s.id === 'build')!
    expect(build.pile.sub).toEqual(['on 28 jobs that have a %', 'grey: 36 jobs have no %'])
    expect(build.pile.guessShare).toBeCloseTo(257 / 619, 3)
    expect(build.weeksText).toBe('10 to 14 weeks to build what is already sold')
  })

  it('lights the most weeks to clear and names a close second as the pair', () => {
    const flow = today()
    expect(flow.linkId).toBe('bill')
    expect(flow.nominatedId).toBe('bill')
    expect(flow.pairId).toBe('build')
    const bill = flow.stages.find((s) => s.id === 'bill')!
    expect(bill.isLink).toBe(true)
    expect(bill.badge).toBe('the weakest link, with Build')
    expect(flow.stages.find((s) => s.id === 'build')!.badge).toBe('a close second · set the %s')
    expect(flow.stages.find((s) => s.id === 'collect')!.badge).toBe('moves with Bill')
  })

  it('a held call stands against a wobble and yields to a clear overtake', () => {
    const base = today()
    const wobble = buildStageFlow({
      market: null, sales: null, fieldPerWeekUsd: null, bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 23_000 },
      collect: { pileUsd: 332_000, pileCount: null, inPerWeekUsd: 23_000, outPerWeekUsd: 46_000, lateCount: 49 },
      build: { pileUsd: 362_000, pileCount: 28, inPerWeekUsd: 49_000, outPerWeekUsd: 35_000, knownJobs: 28, guessUsd: 0, guessJobs: 0 },
      heldLinkId: 'bill',
    })
    expect(base.linkId).toBe('bill')
    expect(wobble.nominatedId).toBe('build')
    expect(wobble.linkId).toBe('bill')
    expect(wobble.heldStands).toBe(true)
    expect(wobble.stages.find((s) => s.id === 'build')!.badge).toBe('reads 10.3 weeks · the call holds Bill')
    const overtaken = buildStageFlow({
      market: null, sales: null, fieldPerWeekUsd: null, bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 40_000 },
      collect: { pileUsd: 332_000, pileCount: null, inPerWeekUsd: 40_000, outPerWeekUsd: 46_000, lateCount: 49 },
      build: { pileUsd: 362_000, pileCount: 28, inPerWeekUsd: 49_000, outPerWeekUsd: 35_000, knownJobs: 28, guessUsd: 0, guessJobs: 0 },
      heldLinkId: 'bill',
    })
    expect(overtaken.linkId).toBe('build')
    expect(overtaken.heldStands).toBe(false)
    expect(overtaken.stages.find((s) => s.id === 'build')!.badge).toBe('the weakest link')
    expect(overtaken.stages.find((s) => s.id === 'bill')!.badge).toBe('moves with Build')
  })

  it('says so for the stages the app cannot read yet', () => {
    const flow = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: null, bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 }, collect: null, build: null, heldLinkId: null })
    const market = flow.stages.find((s) => s.id === 'market')!
    expect(market.readable).toBe(false)
    expect(market.badge).toBe('not readable yet')
    expect(flow.stages.find((s) => s.id === 'collect')!.readable).toBe(false)
    expect(flow.linkId).toBe('bill')
    expect(flow.pairId).toBeNull()
    expect(flow.stages.find((s) => s.id === 'bill')!.badge).toBe('the weakest link')
  })

  it('says "reading…" on Market and Sales while their loader is in flight', () => {
    const flow = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: null, bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 }, collect: null, build: null, heldLinkId: null, demandLoading: true })
    const market = flow.stages.find((s) => s.id === 'market')!
    expect(market.readable).toBe(false)
    expect(market.badge).toBe('reading…')
    expect(market.pile.headline).toBe('reading…')
    expect(flow.stages.find((s) => s.id === 'sales')!.badge).toBe('reading…')
    // Build, Bill and Collect are untouched: their unread state still says "not readable yet".
    expect(flow.stages.find((s) => s.id === 'collect')!.badge).toBe('not readable yet')
  })

  it('reads Collect on the bills past their day, with what is not yet due grey and never a guess (v2.5856)', () => {
    const flow = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: null, bill: null, collect: { pileUsd: 140_000, notDueUsd: 157_000, pileCount: 47, inPerWeekUsd: 56_800, outPerWeekUsd: 29_200, lateCount: 47 }, build: null, heldLinkId: null })
    const c = flow.stages.find((s) => s.id === 'collect')!
    expect(c.pile.headline).toBe('$297k billed, not yet paid')
    expect(c.pile.sub).toEqual(['$140k past its day on 47 invoices', 'grey: $157k not yet due'])
    expect(c.pile.guessShare).toBeCloseTo(157 / 297, 3)
    expect(c.pile.greyKind).toBe('waiting')
    expect(c.weeks).toBeCloseTo(140 / 29.2, 3)
    expect(c.weeksText).toBe('4.8 weeks to collect what is already late')
    expect(c.badge).toBe('the weakest link')
    // Over a third grey, yet no thin-reading gate and no "set the %s": the grey is money not yet due, not a guess.
    const withBuild = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: null, bill: null, collect: { pileUsd: 140_000, notDueUsd: 157_000, pileCount: 47, inPerWeekUsd: 56_800, outPerWeekUsd: 29_200, lateCount: 47 }, build: { pileUsd: 150_000, pileCount: 10, inPerWeekUsd: 50_000, outPerWeekUsd: 34_000, knownJobs: 10, guessUsd: 0, guessJobs: 0 }, heldLinkId: null })
    expect(withBuild.linkId).toBe('collect')
    expect(withBuild.stages.find((s) => s.id === 'collect')!.badge).toBe('the weakest link, with Build')
    const old = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: null, bill: null, collect: { pileUsd: 332_000, pileCount: null, inPerWeekUsd: 22_000, outPerWeekUsd: 46_000, lateCount: 49 }, build: null, heldLinkId: null }).stages.find((s) => s.id === 'collect')!
    expect(old.pile.sub).toEqual(['49 invoices late'])
    expect(old.pile.guessShare).toBe(0)
  })

  it('reads no pace when a stage turns nothing', () => {
    expect(weeksToClear(1000, 0)).toBeNull()
    expect(weeksToClear(0, 500)).toBe(0)
    const flow = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: null, bill: { pileUsd: 233_000, pileCount: 0, inPerWeekUsd: 34_000, outPerWeekUsd: 0 }, collect: null, build: null, heldLinkId: null })
    expect(flow.stages.find((s) => s.id === 'bill')!.weeksText).toBe('no pace to read')
    expect(flow.linkId).toBeNull()
  })

  it('formats dollars the way the cards read them', () => {
    expect(stageUsd(233_000)).toBe('$233k')
    expect(stageUsd(4_728_000)).toBe('$4.7M')
    expect(stageUsd(34_000)).toBe('$34k')
    expect(stageUsd(9_700)).toBe('$9.7k')
    expect(stageUsd(390)).toBe('$390')
    expect(stageUsd(-16_300)).toBe('−$16.3k')
  })

  it('keeps every sentence it writes in plain words', () => {
    const flow = today()
    const lines = flow.stages.flatMap((s) => [s.weeksText, ...s.flow.map((f) => `${f.who} ${f.usd} a week.`)]).filter(Boolean)
    for (const line of [...lines, STAGE_RULE_LINE, STAGE_RULE_LONG, ...STAGE_RULE_POINTS.map((p) => p.text)]) {
      expect(plainWordsFailures(line), line).toEqual([])
    }
  })

  it('feeds Build the larger of its two paces and names the other on the card', () => {
    const byPercent = { pileUsd: 362_000, pileCount: 28, inPerWeekUsd: 49_000, outPerWeekUsd: 24_000, knownJobs: 28, guessUsd: 0, guessJobs: 0 }
    const honest = withFieldPaces(byPercent, 34_000)
    expect(honest.outPerWeekUsd).toBe(34_000)
    expect(honest.paces).toEqual({ byPercentUsd: 24_000, byHoursUsd: 34_000 })
    expect(withFieldPaces(byPercent, null)).toBe(byPercent)
    expect(withFieldPaces(byPercent, 20_000).outPerWeekUsd).toBe(24_000)
    const flow = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: 34_000, bill: null, collect: null, build: honest, heldLinkId: null })
    const build = flow.stages.find((s) => s.id === 'build')!
    expect(build.flow).toEqual([
      { who: 'sales sells', usd: '$49k' },
      { who: 'the field builds', usd: '$34k', tail: 'a week by hours' },
      { who: 'by the percents', usd: '$24k', tail: 'a week' },
    ])
    expect(build.weeksText).toBe('10.6 weeks to build what is already sold')
    // The percents lead: the card says so and names the hours.
    const pctLeads = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: 40_000, bill: null, collect: null, build: withFieldPaces({ ...byPercent, outPerWeekUsd: 40_000 }, 34_000), heldLinkId: null }).stages.find((s) => s.id === 'build')!
    expect(pctLeads.flow[1]).toEqual({ who: 'the field builds', usd: '$40k', tail: 'a week by the percents' })
    expect(pctLeads.flow[2]).toEqual({ who: 'by hours', usd: '$34k', tail: 'a week' })
    // Within a twentieth of each other, one line.
    const agree = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: 34_000, bill: null, collect: null, build: withFieldPaces({ ...byPercent, outPerWeekUsd: 33_000 }, 34_000), heldLinkId: null }).stages.find((s) => s.id === 'build')!
    expect(agree.flow).toHaveLength(2)
    expect(agree.flow[1]).toEqual({ who: 'the field builds', usd: '$34k', tail: 'a week' })
    for (const line of [...build.flow, ...pctLeads.flow].map((f) => `${f.who} ${f.usd} ${f.tail ?? 'a week'}.`)) expect(plainWordsFailures(line), line).toEqual([])
  })

  it('does not hand the link to Build on a thin percent unless it leads by a clear margin', () => {
    // Build reads 15 weeks with over half its pile a guess; Bill reads 13.5. Build leads, but not by the hold margin.
    const thin = buildStageFlow({
      market: null, sales: null, fieldPerWeekUsd: 24_000, bill: { pileUsd: 297_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
      collect: { pileUsd: 200_000, pileCount: null, inPerWeekUsd: 22_000, outPerWeekUsd: 46_000, lateCount: 10 },
      build: { pileUsd: 360_000, pileCount: 13, inPerWeekUsd: 49_000, outPerWeekUsd: 24_000, knownJobs: 13, guessUsd: 400_000, guessJobs: 14 },
      heldLinkId: null,
    })
    expect(thin.nominatedId).toBe('bill')
    expect(thin.linkId).toBe('bill')
    expect(thin.stages.find((s) => s.id === 'build')!.badge).toBe('reads 15.0 weeks on a thin % · set the %s')
    expect(thin.stages.find((s) => s.id === 'bill')!.badge).toBe('the weakest link, with Build')
    // By the hold margin, Build takes it, and the badge asks for the percents.
    const clear = buildStageFlow({
      market: null, sales: null, fieldPerWeekUsd: 20_000, bill: { pileUsd: 297_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
      collect: null,
      build: { pileUsd: 360_000, pileCount: 13, inPerWeekUsd: 49_000, outPerWeekUsd: 20_000, knownJobs: 13, guessUsd: 400_000, guessJobs: 14 },
      heldLinkId: null,
    })
    expect(clear.linkId).toBe('build')
    expect(clear.stages.find((s) => s.id === 'build')!.badge).toBe('the weakest link · set the %s')
    // A known pile is never gated.
    const known = buildStageFlow({
      market: null, sales: null, fieldPerWeekUsd: 24_000, bill: { pileUsd: 297_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
      collect: null,
      build: { pileUsd: 360_000, pileCount: 13, inPerWeekUsd: 49_000, outPerWeekUsd: 24_000, knownJobs: 13, guessUsd: 0, guessJobs: 0 },
      heldLinkId: null,
    })
    expect(known.linkId).toBe('build')
    expect(known.stages.find((s) => s.id === 'build')!.badge).toBe('the weakest link, with Bill')
  })

  it('reads Market and Sales by pace against the field, with the SENT / WON / LOST table', () => {
    const flow = buildStageFlow({
      market: { bidsInvited: 20, bidsInvitedUsd: 2_400_000, estimatesRequested: 25, estimatesRequestedUsd: 64_000, weeks: 8 },
      sales: { bids: { sentUsd: 2_400_000, wonUsd: 0, startedUsd: 98_000, lostUsd: 645_000 }, estimates: { sentUsd: 64_000, wonUsd: 25_000, lostUsd: 0 }, awaiting: { bids: 28, bidsUsd: 4_728_000, estimates: 13, estimatesUsd: 46_000 }, soldPerWeekUsd: 49_000 },
      fieldPerWeekUsd: 35_000,
      bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
      collect: null,
      build: null,
      heldLinkId: null,
    })
    const market = flow.stages.find((s) => s.id === 'market')!
    expect(market.pile.headline).toBe('45 asks in 8 weeks')
    expect(market.pile.sub).toEqual(['20 bids opened', '25 estimates requested'])
    expect(market.flow).toEqual([
      { who: 'bids', usd: '$2.4M', tail: 'from GCs' },
      { who: 'estimates', usd: '$64k', tail: 'from customers' },
    ])
    // Market reads against the field through the window's win share by value, not the raw asks: $2.4M invited converts to $15.4k a week here.
    expect(market.weeksText).toBe('about $308k a week asked')
    expect(market.weeksText2).toBe('≈ $15.4k a week at the window’s 5% win share')
    expect(market.badge).toBe('short of the field')
    const sales = flow.stages.find((s) => s.id === 'sales')!
    expect(sales.pile.headline).toBe('$4.8M awaiting an answer')
    expect(sales.table!.rows[0]).toEqual({ label: 'bids', cells: ['$2.4M', '$98k', '$645k'], note: 'won counts $98k of bids that became jobs' })
    expect(sales.table!.rows[1]!.cells).toEqual(['$64k', '$25k', '$0'])
    expect(sales.weeksText).toBe('sold $49k of work a week')
    expect(sales.weeksText2).toBe('the field builds $35k a week')
    expect(sales.badge).toBe('ahead of the field · wait')
    expect(flow.linkId).toBe('bill')
    const behind = buildStageFlow({ market: null, sales: { bids: { sentUsd: 0, wonUsd: 0, startedUsd: 0, lostUsd: 0 }, estimates: { sentUsd: 0, wonUsd: 0, lostUsd: 0 }, awaiting: { bids: 0, bidsUsd: 0, estimates: 0, estimatesUsd: 0 }, soldPerWeekUsd: 20_000 }, fieldPerWeekUsd: 35_000, bill: null, collect: null, build: null, heldLinkId: null })
    expect(behind.stages.find((s) => s.id === 'sales')!.badge).toBe('behind the field')
  })

  it('reads the window’s win share by value, and falls back to the asks alone without one', () => {
    const sales = { bids: { sentUsd: 2_400_000, wonUsd: 0, startedUsd: 98_000, lostUsd: 645_000 }, estimates: { sentUsd: 64_000, wonUsd: 25_000, lostUsd: 0 }, awaiting: { bids: 0, bidsUsd: 0, estimates: 0, estimatesUsd: 0 }, soldPerWeekUsd: null }
    expect(marketWinShare(sales)).toBeCloseTo(123_000 / 2_464_000, 6)
    expect(marketWinShare({ ...sales, bids: { ...sales.bids, sentUsd: 0 }, estimates: { ...sales.estimates, sentUsd: 0 } })).toBeNull()
    expect(marketWinShare(null)).toBeNull()
    // With no Sales reading, Market compares the asks alone and the card says so.
    const flow = buildStageFlow({
      market: { bidsInvited: 20, bidsInvitedUsd: 2_400_000, estimatesRequested: 25, estimatesRequestedUsd: 64_000, weeks: 8 },
      sales: null,
      fieldPerWeekUsd: 35_000,
      bill: null,
      collect: null,
      build: { pileUsd: 362_000, pileCount: 28, inPerWeekUsd: 49_000, outPerWeekUsd: 35_000, knownJobs: 28, guessUsd: 0, guessJobs: 0 },
      heldLinkId: null,
    })
    const market = flow.stages.find((s) => s.id === 'market')!
    expect(market.badge).toBe('not short')
    expect(market.weeksText2).toBe('win share not readable: compared on the asks alone')
  })
})
