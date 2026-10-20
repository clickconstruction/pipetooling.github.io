import { describe, expect, it } from 'vitest'
import { buildOrder } from './order'
import { buildResources } from './resources'
import { buildStageFlow } from './stageFlow'

describe('buildOrder', () => {
  it('tiers the eight links: first, with it, next, follows, waits', () => {
    const flow = buildStageFlow({
      market: { bidsInvited: 20, bidsInvitedUsd: 2_400_000, estimatesRequested: 25, estimatesRequestedUsd: 64_000, weeks: 8 },
      sales: { bids: { sentUsd: 2_400_000, wonUsd: 0, startedUsd: 98_000, lostUsd: 645_000 }, estimates: { sentUsd: 64_000, wonUsd: 25_000, lostUsd: 0 }, awaiting: { bids: 28, bidsUsd: 4_728_000, estimates: 13, estimatesUsd: 46_000 }, soldPerWeekUsd: 49_000 },
      fieldPerWeekUsd: 35_000,
      build: { pileUsd: 362_000, pileCount: 28, inPerWeekUsd: 49_000, outPerWeekUsd: 35_000, knownJobs: 28, guessUsd: 257_000, guessJobs: 36 },
      bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 },
      collect: { pileUsd: 332_000, pileCount: 49, inPerWeekUsd: 22_000, outPerWeekUsd: 46_000, lateCount: 49 },
      heldLinkId: null,
    })
    const resources = buildResources({ linkId: flow.linkId, pendingHours: 585, pendingSessions: 104, unpricedJobs: 6, noPctJobs: 6, unsortedBankRows: 1151, bidsNoValue: 0, bankUsd: 390, bankSynced: true, lowestUsd: -16_300, lowestLabel: 'Oct 12', floorUsd: 5000, clearsFloor: false, fieldPeople: 7, fieldHours7d: 317, billers: 1 })
    const order = buildOrder({ flow, resources, pressedId: 'collect' })
    expect(order.rows.map((r) => `${r.rank} ${r.id} ${r.tier}`)).toEqual(['1 bill First', '2 decision With it', '3 talent With it', '4 build Next', '5 collect Follows', '6 capital Follows', '7 market Waits', '8 sales Waits'])
    expect(order.rows[0]!.firstMove).toBe('Bill the finished work.')
    expect(order.rows[0]!.reading).toBe('10.6 weeks to bill what is already finished')
    expect(order.rows[1]!.reading).toBe('4 piles on you · bottlenecks at the leadership level')
    expect(order.rows[7]!.reading).toBe('sold $49k of work a week; the field builds $35k a week')
    expect(order.rows.filter((r) => r.tierHead).map((r) => r.tier)).toEqual(['First', 'With it', 'Next', 'Follows', 'Waits'])
    expect(order.rows[4]!.pressed).toBe(true)
    expect(order.pressedLine).toBe('You pressed Collect: follows · moves when the link moves; nothing to do here first.')
  })
  it('puts a stage the app cannot read last, and says so', () => {
    const flow = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: null, build: null, bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 }, collect: null, heldLinkId: null })
    const order = buildOrder({ flow, resources: [], pressedId: 'bill' })
    expect(order.rows.map((r) => r.id)).toEqual(['bill', 'market', 'sales', 'build', 'collect'])
    expect(order.rows[1]!.reading).toBe('the app does not read this stage yet')
    expect(order.pressedLine).toBe('You pressed Bill: first · the most weeks to clear what is already waiting.')
  })
})
