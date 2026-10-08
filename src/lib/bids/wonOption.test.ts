import { describe, expect, it } from 'vitest'

import { planSamePageLetter, type SamePageSection } from './coverLetterSamePage'
import { buildBidRoomRevisionPayload } from './bidRoomPayload'
import { agreedValueForOption, letterOptionVersions, roomSectionsForLetterOptions, roomSectionsForPacket, wonOptionVersionId, wonOptionWrites } from './wonOption'

const v = (id: string, name: string, sort_order: number, over: Partial<{ include_in_submission: boolean; is_alternate: boolean; outcome: string | null; customer_id: string | null }> = {}) => ({
  id, name, sort_order, include_in_submission: true, is_alternate: false, outcome: null, customer_id: null, ...over,
})

describe('letterOptionVersions — the options a win has to choose between', () => {
  it('is the packet’s base versions in the letter, in step-1 order; alternates, unticked and other GCs’ versions are not options', () => {
    const versions = [v('ve', 'Value Engineered', 2), v('tp', 'To Plans', 1), v('alt', 'Phase 2', 3, { is_alternate: true }), v('off', 'Draft', 0, { include_in_submission: false }), v('gc', 'Merit', 1, { customer_id: 'gc-merit' })]
    expect(letterOptionVersions(versions).map((o) => o.id)).toEqual(['tp', 've'])
    expect(letterOptionVersions(versions, 'gc-merit').map((o) => o.id)).toEqual(['gc'])
  })
})

describe('wonOptionVersionId / wonOptionWrites', () => {
  const options = [v('tp', 'To Plans', 1), v('ve', 'Value Engineered', 2)]
  it('nothing recorded until an option reads won', () => {
    expect(wonOptionVersionId(options)).toBeNull()
    expect(wonOptionVersionId([v('tp', 'To Plans', 1), v('ve', 'Value Engineered', 2, { outcome: 'won' })])).toBe('ve')
  })
  it('the answer wins the chosen option and clears a previous answer; the other option is never marked lost', () => {
    expect(wonOptionWrites(options, 've')).toEqual({ won: ['ve'], cleared: [] })
    const bothWon = [v('tp', 'To Plans', 1, { outcome: 'won' }), v('ve', 'Value Engineered', 2, { outcome: 'won' })]
    expect(wonOptionWrites(bothWon, 've')).toEqual({ won: [], cleared: ['tp'] })
    expect(wonOptionWrites(options, 'nope')).toEqual({ won: [], cleared: [] })
  })
  it('the agreed value is the option’s sent value plus the accepted add-ons', () => {
    const alts = [{ key: 'group:break room', tag: 'Break room', amount: 3220, offered: true, accepted: true, answer: 'taken' as const }]
    expect(agreedValueForOption(366998.23, alts, ['Break room'])).toBe(370218.23)
    expect(agreedValueForOption(366998.23, alts, [])).toBe(366998.23)
    expect(agreedValueForOption(null, alts, ['Break room'])).toBeNull()
  })
})

describe('roomSectionsForLetterOptions — every signable combination, carrying its version', () => {
  const sec = (over: Partial<SamePageSection> & { name: string }): SamePageSection => ({ bidVersionId: over.name, revenueSum: 0, fixtureRows: [], isAlternate: false, ...over })
  const plan = planSamePageLetter([
    sec({ name: 'To Plans', bidVersionId: 'tp', revenueSum: 922196.69, fixtureRows: [{ fixture: 'WC', count: 6 }] }),
    sec({ name: 'TP excl MG', bidVersionId: 'tp', revenueSum: 880227.11, isAlternate: true, offeredPricingId: 'p2' }),
    sec({ name: 'Value Engineered', bidVersionId: 've', revenueSum: 366998.23 }),
    sec({ name: 'VE excl MG', bidVersionId: 've', revenueSum: 329441.55, isAlternate: true, offeredPricingId: 'p4' }),
    sec({ name: 'Phase 2 only', bidVersionId: 'p2v', revenueSum: 500000, isAlternate: true }),
  ])!
  it('Option 1 is the proposal; the rest are alternates in lieu of it, named by the letter', () => {
    const rows = roomSectionsForLetterOptions(plan.options!, plan.alternates, { option: (o) => `Option ${o.n} — ${o.section.name}`, alternate: (_o, _a, j) => `Alternate ${j + 1}` })
    expect(rows.map((r) => [r.name, r.isAlternate, r.revenueSum, r.bidVersionId])).toEqual([
      ['Option 1 — To Plans', false, 922196.69, 'tp'],
      ['Option 1 — To Plans · Alternate 1', true, 880227.11, 'tp'],
      ['Option 2 — Value Engineered', true, 366998.23, 've'],
      ['Option 2 — Value Engineered · Alternate 1', true, 329441.55, 've'],
      ['Phase 2 only', true, 500000, 'p2v'],
    ])
    expect(rows[0]!.fixtureRows).toEqual([{ fixture: 'WC', count: 6 }])
  })
})

describe('roomSectionsForPacket — a room never sums two base bids (v2.4892)', () => {
  const sec = (over: Partial<SamePageSection> & { name: string }): SamePageSection => ({ bidVersionId: over.name, revenueSum: 0, fixtureRows: [], isAlternate: false, ...over })
  const labels = () => ({ option: (o: { n: number; section: SamePageSection }) => `Option ${o.n} — ${o.section.name}`, alternate: (_o: unknown, _a: unknown, j: number) => `Alternate ${j + 1}` })
  const payload = (sections: ReturnType<typeof roomSectionsForPacket>) =>
    buildBidRoomRevisionPayload({ projectName: 'P', projectAddress: 'A', gcName: 'G', serviceTypeName: 'Plumbing', sections, inclusions: '', exclusions: '', terms: '' })!
      .options.map((o) => [o.name, o.is_base, o.total_cents, o.bid_version_id ?? null])

  it('two base versions: the room offers each as its own option at its own total, with its version', () => {
    const rows = roomSectionsForPacket([sec({ name: 'To Plans', bidVersionId: 'tp', revenueSum: 120000 }), sec({ name: 'Value Engineered', bidVersionId: 've', revenueSum: 95000 })], labels)
    expect(payload(rows)).toEqual([
      ['Option 1 — To Plans', true, 12_000_000, 'tp'],
      ['Option 2 — Value Engineered', false, 9_500_000, 've'],
    ])
  })

  it('what the room did before: the same two sections handed over raw fold into one base at their sum', () => {
    const raw = [sec({ name: 'To Plans', bidVersionId: null, revenueSum: 120000 }), sec({ name: 'Value Engineered', bidVersionId: null, revenueSum: 95000 })]
    expect(payload(raw.map((s) => ({ ...s })))).toEqual([['Base bid', true, 21_500_000, null]])
  })

  it('one base: the sections as they are, the base carrying its version for the signature', () => {
    const rows = roomSectionsForPacket([sec({ name: 'To Plans', bidVersionId: 'tp', revenueSum: 120000 }), sec({ name: 'Phase 2', bidVersionId: 'p2', revenueSum: 30000, isAlternate: true })], labels)
    expect(payload(rows)).toEqual([
      ['To Plans', true, 12_000_000, 'tp'],
      ['Phase 2', false, 3_000_000, 'p2'],
    ])
  })

  it('a bid with no versions: one base and its offered prices, unchanged', () => {
    const rows = roomSectionsForPacket([sec({ name: 'Standard', bidVersionId: null, revenueSum: 1000 }), sec({ name: 'Budget', bidVersionId: null, revenueSum: 800, isAlternate: true, offeredPricingId: 'p2' })], labels)
    expect(rows.map((r) => [r.name, r.isAlternate, r.revenueSum, r.bidVersionId])).toEqual([
      ['Standard', false, 1000, null],
      ['Budget', true, 800, null],
    ])
  })
})
