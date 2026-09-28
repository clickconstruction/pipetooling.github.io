import { describe, expect, it } from 'vitest'
import type { GcPacket } from './gcPackets'
import {
  bidImportCarry,
  bidImportCarryQuestion,
  bidImportEffectiveGc,
  bidImportFirstLine,
  bidImportGcOptions,
  bidImportLabel,
  bidImportWinWrite,
  decideBidImportGc,
  type BidImportGcOption,
} from './jobImportFromBid'

const version = (id: string, customerId: string | null) => ({ id, name: id, customer_id: customerId, sort_order: 0 })
const packet = (over: Partial<GcPacket> & { key: string }): GcPacket => ({
  gcId: over.key === '' || over.key.startsWith('shared:') ? null : over.key,
  name: `GC ${over.key || 'own'}`,
  versions: [version(`v-${over.key || 'own'}`, over.key || null)],
  sentOn: '2026-09-01',
  sentValue: 10_000,
  outcome: null,
  ...over,
})
const option = (over: Partial<BidImportGcOption> = {}): BidImportGcOption => ({ key: 'gc-a', customerId: 'gc-a', name: 'Acme', sentOn: null, value: 12_000, outcome: null, sharedLetter: false, ...over })
const bid = { bid_number: '482', project_name: 'Oak Ridge' }

describe('bidImportLabel', () => {
  it('is the number and the name, either alone, or the fallback', () => {
    expect(bidImportLabel(bid, 'the bid')).toBe('B482 · Oak Ridge')
    expect(bidImportLabel({ bid_number: ' 482 ', project_name: null }, 'the bid')).toBe('B482')
    expect(bidImportLabel({ bid_number: null, project_name: '  Oak Ridge ' }, 'the bid')).toBe('Oak Ridge')
    expect(bidImportLabel({ bid_number: null, project_name: '   ' }, 'this bid')).toBe('this bid')
  })
})

describe('bidImportGcOptions', () => {
  const base = { bidCustomerId: 'gc-own', cachedBidGcName: undefined, embeddedBidGcName: 'Own GC', bidDateSent: '2026-08-20' }

  it('is one option per packet', () => {
    const options = bidImportGcOptions({ ...base, packets: [packet({ key: '' }), packet({ key: 'gc-a', sentValue: 9_000, outcome: 'won' })] })
    expect(options.map((o) => [o.key, o.customerId, o.value, o.outcome, o.sharedLetter])).toEqual([
      ['', null, 10_000, null, false],
      ['gc-a', 'gc-a', 9_000, 'won', false],
    ])
  })

  it('puts the bid’s GC first when it has no packet of its own, riding the shared letter with no value', () => {
    const options = bidImportGcOptions({ ...base, packets: [packet({ key: 'shared:gc-b', sharedLetter: true })] })
    expect(options[0]).toEqual({ key: '', customerId: null, name: 'Own GC', sentOn: '2026-08-20', value: null, outcome: null, sharedLetter: true })
    expect(options).toHaveLength(2)
  })

  it('names the bid’s GC from the cache first, then the bid, then "the GC"', () => {
    expect(bidImportGcOptions({ ...base, packets: [], cachedBidGcName: ' Cached ' })[0]?.name).toBe('Cached')
    expect(bidImportGcOptions({ ...base, packets: [], embeddedBidGcName: null })[0]?.name).toBe('the GC')
  })

  it('adds nothing for a bid with no GC', () => {
    expect(bidImportGcOptions({ ...base, bidCustomerId: null, packets: [] })).toEqual([])
  })
})

describe('decideBidImportGc', () => {
  const optionsOf = (packets: GcPacket[]) => bidImportGcOptions({ packets, bidCustomerId: 'gc-own', cachedBidGcName: undefined, embeddedBidGcName: 'Own GC', bidDateSent: null })

  it('one GC goes on silently at its sent value; none at nothing', () => {
    const one = [packet({ key: '', sentValue: 8_500 })]
    expect(decideBidImportGc(one, optionsOf(one))).toEqual({ kind: 'proceed', chosen: null, sentValue: 8_500 })
    expect(decideBidImportGc([], [])).toEqual({ kind: 'proceed', chosen: null, sentValue: null })
  })

  it('several GCs with exactly one recorded winner go on as that GC', () => {
    const packets = [packet({ key: '', outcome: 'lost' }), packet({ key: 'gc-a', name: 'Acme', sentValue: 9_000, outcome: 'won' })]
    expect(decideBidImportGc(packets, optionsOf(packets))).toEqual({
      kind: 'proceed',
      chosen: { key: 'gc-a', customerId: 'gc-a', name: 'Acme', sentOn: '2026-09-01', value: 9_000, outcome: 'won', sharedLetter: false },
      sentValue: 9_000,
    })
  })

  it('several GCs and no winner asks, and the pick records the Won', () => {
    const packets = [packet({ key: '' }), packet({ key: 'gc-a' })]
    expect(decideBidImportGc(packets, optionsOf(packets))).toEqual({ kind: 'ask', writesWin: true })
  })

  it('more than one recorded winner asks and records nothing', () => {
    const packets = [packet({ key: '', outcome: 'won' }), packet({ key: 'gc-a', outcome: 'won' })]
    expect(decideBidImportGc(packets, optionsOf(packets))).toEqual({ kind: 'ask', writesWin: false })
  })

  it('a shared-letter packet that reads won is not a winner', () => {
    const packets = [packet({ key: '' }), packet({ key: 'shared:gc-b', sharedLetter: true, outcome: 'won' })]
    expect(decideBidImportGc(packets, optionsOf(packets))).toEqual({ kind: 'ask', writesWin: true })
  })
})

describe('bidImportCarry', () => {
  it('offers the agreed value when it is above zero', () => {
    expect(bidImportCarry({ agreedValueRaw: 15_000, sentValue: 12_000 })).toEqual({ agreedValue: 15_000, carryValue: 15_000 })
    expect(bidImportCarry({ agreedValueRaw: '15000.50', sentValue: null })).toEqual({ agreedValue: 15_000.5, carryValue: 15_000.5 })
  })

  it('else what was sent, when that is above zero', () => {
    expect(bidImportCarry({ agreedValueRaw: null, sentValue: 12_000 })).toEqual({ agreedValue: null, carryValue: 12_000 })
    expect(bidImportCarry({ agreedValueRaw: 0, sentValue: 12_000 })).toEqual({ agreedValue: 0, carryValue: 12_000 })
  })

  it('else nothing', () => {
    expect(bidImportCarry({ agreedValueRaw: null, sentValue: null })).toEqual({ agreedValue: null, carryValue: null })
    expect(bidImportCarry({ agreedValueRaw: undefined, sentValue: 0 })).toEqual({ agreedValue: null, carryValue: null })
    expect(bidImportCarry({ agreedValueRaw: -5, sentValue: -1 })).toEqual({ agreedValue: -5, carryValue: null })
  })

  it('an unreadable agreed value falls through to what was sent, but still counts as the bid having one', () => {
    const out = bidImportCarry({ agreedValueRaw: 'abc', sentValue: 12_000 })
    expect(out.carryValue).toBe(12_000)
    expect(out.agreedValue).not.toBeNull()
    expect(Number.isNaN(out.agreedValue)).toBe(true)
  })
})

describe('bidImportCarryQuestion / bidImportFirstLine', () => {
  it('an agreed value: says whose figure it is, and Yes records nothing on the bid', () => {
    expect(bidImportCarryQuestion({ carryValue: 15_000, agreedValue: 15_000, bid, gcName: 'Acme' })).toEqual({
      title: 'Start the job at $15,000.00?',
      message: "That's B482 · Oak Ridge's agreed value. Yes puts it on the job as the first line item; No starts the job at $0 and writes nothing.",
      confirmLabel: 'Carry $15,000.00 over',
      cancelLabel: 'Start at $0',
    })
    expect(bidImportFirstLine({ carryValue: 15_000, agreedValue: 15_000, bid })).toEqual({ name: 'Bid price', count: 1, line_unit_price: 15_000, line_description: 'B482 · Oak Ridge — agreed value', invoice_id: null })
  })

  it('a sent value: names the GC, and Yes records it on the bid', () => {
    const q = bidImportCarryQuestion({ carryValue: 12_000, agreedValue: null, bid, gcName: ' Acme ' })
    expect(q.message).toBe("That's what Acme was sent on B482 · Oak Ridge. Yes puts it on the job as the first line item and records it on the bid as the agreed value; No starts the job at $0 and writes nothing.")
    expect(bidImportFirstLine({ carryValue: 12_000, agreedValue: null, bid }).line_description).toBe('B482 · Oak Ridge — as sent')
  })

  it('falls back to "the GC" and "the bid"', () => {
    const q = bidImportCarryQuestion({ carryValue: 500, agreedValue: null, bid: { bid_number: null, project_name: null }, gcName: null })
    expect(q.message).toContain("That's what the GC was sent on the bid.")
  })
})

describe('bidImportEffectiveGc', () => {
  const cache: Record<string, string> = { 'gc-a': 'Acme (cached)' }
  const cachedNameOf = (id: string) => cache[id]

  it('with no chosen GC it is the bid’s, named by the bid when the cache has no row', () => {
    expect(bidImportEffectiveGc({ chosen: null, bidCustomerId: 'gc-own', embeddedBidGcName: 'Own GC', cachedNameOf })).toEqual({ id: 'gc-own', name: 'Own GC' })
  })

  it('a chosen GC with its own customer is that customer, named from the cache first', () => {
    expect(bidImportEffectiveGc({ chosen: option(), bidCustomerId: 'gc-own', embeddedBidGcName: 'Own GC', cachedNameOf })).toEqual({ id: 'gc-a', name: 'Acme (cached)' })
    expect(bidImportEffectiveGc({ chosen: option({ key: 'gc-z', customerId: 'gc-z', name: 'Zed' }), bidCustomerId: 'gc-own', embeddedBidGcName: 'Own GC', cachedNameOf })).toEqual({ id: 'gc-z', name: 'Zed' })
  })

  it('a chosen option with no customer of its own is the bid’s GC', () => {
    expect(bidImportEffectiveGc({ chosen: option({ key: '', customerId: null, name: 'Picker name' }), bidCustomerId: 'gc-own', embeddedBidGcName: 'Own GC', cachedNameOf })).toEqual({ id: 'gc-own', name: 'Own GC' })
  })

  it('is null with no GC anywhere, and "—" when nothing names it', () => {
    expect(bidImportEffectiveGc({ chosen: null, bidCustomerId: null, embeddedBidGcName: null, cachedNameOf })).toBeNull()
    expect(bidImportEffectiveGc({ chosen: null, bidCustomerId: 'gc-own', embeddedBidGcName: '  ', cachedNameOf })).toEqual({ id: 'gc-own', name: '—' })
  })
})

describe('bidImportWinWrite', () => {
  const packets = [
    packet({ key: '', name: 'Own GC', versions: [version('v1', null), version('v2', null)] }),
    packet({ key: 'gc-a', name: 'Acme', outcome: 'lost', versions: [version('v3', 'gc-a')] }),
    packet({ key: 'shared:gc-b', name: 'Bravo', sharedLetter: true, versions: [] }),
  ]

  it('marks the picked packet’s versions won and carries every packet as it stands after', () => {
    expect(bidImportWinWrite(packets, '')).toEqual({
      versionIds: ['v1', 'v2'],
      packetsAfter: [
        { key: '', name: 'Own GC', outcome: 'won', sentOn: '2026-09-01', versionIds: ['v1', 'v2'], sharedLetter: false },
        { key: 'gc-a', name: 'Acme', outcome: 'lost', sentOn: '2026-09-01', versionIds: ['v3'], sharedLetter: false },
        { key: 'shared:gc-b', name: 'Bravo', outcome: null, sentOn: '2026-09-01', versionIds: [], sharedLetter: true },
      ],
      previousOutcome: null,
    })
  })

  it('remembers a packet that read lost', () => {
    expect(bidImportWinWrite(packets, 'gc-a')?.previousOutcome).toBe('lost')
    expect(bidImportWinWrite(packets, 'gc-a')?.packetsAfter[1]?.outcome).toBe('won')
  })

  it('is null for a packet with no versions, or one that is not there', () => {
    expect(bidImportWinWrite(packets, 'shared:gc-b')).toBeNull()
    expect(bidImportWinWrite(packets, 'gc-missing')).toBeNull()
  })
})
