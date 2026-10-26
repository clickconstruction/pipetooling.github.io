import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildDialReading, dialSpec } from './dial'
import { buildStageFlow, type StageFlowInput } from './stageFlow'
import { buildReflexes, otherLevers, reflexLine } from './waits'

const input: StageFlowInput = {
  market: { bidsInvited: 20, bidsInvitedUsd: 2_400_000, estimatesRequested: 25, estimatesRequestedUsd: 64_000, weeks: 8 },
  sales: { bids: { sentUsd: 2_400_000, wonUsd: 0, startedUsd: 98_000, lostUsd: 645_000 }, estimates: { sentUsd: 64_000, wonUsd: 25_000, lostUsd: 0 }, awaiting: { bids: 28, bidsUsd: 4_728_000, estimates: 13, estimatesUsd: 46_000 }, soldPerWeekUsd: 49_000 },
  fieldPerWeekUsd: 35_000,
  build: { pileUsd: 362_000, pileCount: 28, inPerWeekUsd: 49_000, outPerWeekUsd: 35_000, knownJobs: 28, guessUsd: 0, guessJobs: 0 },
  bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
  collect: { pileUsd: 332_000, pileCount: 49, inPerWeekUsd: 22_000, outPerWeekUsd: 46_000, lateCount: 49 },
  heldLinkId: null,
}

describe('everything else waits', () => {
  it('sizes the four presses from the field’s rate and today’s asks', () => {
    const r = buildReflexes({ stageInput: input, fieldHoursPerWeek: 300, fieldPeople: 7 })
    expect(r.map((x) => [x.id, x.stage, x.usd, x.addUsd])).toEqual([
      ['plumber', 'build', 40_000, 5000],
      ['bids', 'market', 411_000, 103_000],
      ['fieldday', 'build', 42_000, 7000],
      ['overhead', null, null, 0],
    ])
  })

  it('reads what each press did, and that the link did not move', () => {
    const before = buildStageFlow(input)
    const reflexes = buildReflexes({ stageInput: input, fieldHoursPerWeek: 300, fieldPeople: 7 })
    const plumber = reflexes[0]!
    const spec = dialSpec(input, 'build', { perUnitUsd: 35_000 / 300 })!
    const reading = buildDialReading(input, 'build', plumber.usd as number, { spec, todayYmd: '2026-10-10', dayLabel: (y) => y })
    const line = reflexLine({ reflex: plumber, before, reading, stageInput: input, overheadPerDayUsd: 348, billPerJobUsd: 233_000 / 15 })
    expect(line.text).toBe('Hire another plumber: the field finishes $40k a week, $5k more. The office still bills $22k, so $18k a week waits unbilled instead of $13k. The link did not move.')
    const overhead = reflexLine({ reflex: reflexes[3]!, before, reading: null, stageInput: input, overheadPerDayUsd: 348, billPerJobUsd: 233_000 / 15 })
    expect(overhead.text).toBe('Cut overhead 10%: $35 a day, $244 a week. Nothing above moved. One finished job billed is about $15.5k.')
    const bids = reflexes[1]!
    const mspec = dialSpec(input, 'market', { perUnitUsd: null })!
    const mreading = buildDialReading(input, 'market', bids.usd as number, { spec: mspec, todayYmd: '2026-10-10', dayLabel: (y) => y })
    const bline = reflexLine({ reflex: bids, before, reading: mreading, stageInput: input, overheadPerDayUsd: 348, billPerJobUsd: null })
    expect(bline.text).toBe('Push for more bids: $103k more asked a week. The field still builds $35k. More sold only adds to the piles. The link did not move.')
    for (const t of [line.text, overhead.text, bline.text]) expect(plainWordsFailures(t), t).toEqual([])
  })

  it('lists the other links’ levers without the lit one', () => {
    const levers = otherLevers('bill')
    expect(levers.map((l) => l.id)).toEqual(['market', 'sales', 'build', 'collect', 'decision', 'capital', 'talent'])
    expect(levers[0]).toEqual({ id: 'market', name: 'Market', lever: 'more bids out, referrals' })
  })
})
