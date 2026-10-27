import { describe, expect, it } from 'vitest'
import type { ChaseTouch } from '../../jobs/paymentChase'
import type { PaySpeedData } from '../../jobs/billedExpectedPay'
import type { FinancialItem } from '../../dashboardFinancials'
import { plainWordsFailures } from '../../plainWords'
import { collectBillsFromAr } from './collectBills'
import { buildCollectPile, type CollectBill } from './collectPile'
import { buildCollectPayers } from './collectPayers'
import { collectHowItReads, collectLegend, collectPaceWords, collectRestWords, collectSlowFacts, collectStandsWords, collectTiles } from './collectWords'

const TODAY = '2026-10-25'
const speeds: PaySpeedData = {
  company: { medianDays: 7, samples: 286 },
  customers: { rmc: { medianDays: 35, samples: 4 }, harper: { medianDays: 74, samples: 1 }, handi: { medianDays: 6, samples: 10 } },
  segments: { residential: { medianDays: 2, samples: 136 }, commercial: { medianDays: 12, samples: 150 } },
  customerTypes: { structura: 'commercial', rmc: 'commercial', southern: 'commercial', harper: 'commercial', handi: 'commercial', tom: 'residential' },
  receipts: {},
  quality: null,
}
const bill = (key: string, payerId: string, payerName: string, billedYmd: string, usd: number, over: Partial<CollectBill> = {}): CollectBill => ({ key, jobId: `j-${key}`, payerId, payerName, billedYmd, usd, ...over })
const bills: CollectBill[] = [
  bill('spacex', 'structura', 'Structura, Inc. – Austin', '2026-09-24', 103_386, { sentFromHere: false }),
  bill('rmc-a', 'rmc', 'RMC- Dudley Mason', '2026-03-16', 13_420),
  bill('rmc-b', 'rmc', 'RMC- Dudley Mason', '2026-08-20', 55_151),
  bill('rmc-c', 'rmc', 'RMC- Dudley Mason', '2026-09-21', 8_780, { sentFromHere: false }),
  bill('sp', 'southern', 'Southern Post Construction', '2026-09-16', 38_625, { sentFromHere: false }),
  bill('tfh', 'harper', 'TF Harper', '2026-09-16', 29_323, { sentFromHere: false }),
  bill('tfh2', 'harper', 'TF Harper', '2026-07-06', 2_918),
  bill('hi', 'handi', 'H & I Construction', '2026-10-23', 14_220),
  bill('hi2', 'handi', 'H & I Construction', '2026-09-03', 350),
  bill('tom', 'tom', 'Tom Coyle', '2026-10-23', 215),
  bill('coll', 'old', 'An old GC', '2026-02-01', 19_522, { inCollections: true }),
]
const pile = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: { 'j-sp': { promisedYmd: '2026-10-16', markedByName: 'Taunya' } }, payAppJobIds: new Set(['j-spacex']), gcPayerIds: new Set(['rmc', 'harper', 'southern']), todayYmd: TODAY })
const cut = buildCollectPayers(pile)
const plain = (s: string) => expect(plainWordsFailures(s), s).toEqual([])

describe('collectBillsFromAr', () => {
  it('shapes AR rows and Collections rows into bills, reading the invoice id off the key', () => {
    const item = (key: string, amount: number, over: Partial<FinancialItem> = {}): FinancialItem => ({ key, label: 'J1 · A job', sublabel: null, amount, dateYmd: '2026-10-01', jobId: 'j1', address: null, customerId: 'c1', customerName: 'A Payer', ...over })
    const out = collectBillsFromAr({ ar: [item('inv:abc', 100), item('job:j2', 50, { customerName: null, jobId: 'j2' })], collections: [item('inv:def', 20)], sentByInvoice: new Map([['abc', false]]) })
    expect(out).toEqual([
      { key: 'inv:abc', jobId: 'j1', payerId: 'c1', payerName: 'A Payer', billedYmd: '2026-10-01', usd: 100, inCollections: false, sentFromHere: false },
      { key: 'job:j2', jobId: 'j2', payerId: 'c1', payerName: 'J1 · A job', billedYmd: '2026-10-01', usd: 50, inCollections: false, sentFromHere: null },
      { key: 'inv:def', jobId: 'j1', payerId: 'c1', payerName: 'A Payer', billedYmd: '2026-10-01', usd: 20, inCollections: true, sentFromHere: null },
    ])
  })
})

describe('collectWords (v2.5853)', () => {
  it('draws the legend in the bar’s order with Collections apart, in plain words', () => {
    const legend = collectLegend(pile, { largestNotDue: { name: 'Structura', usd: 103_386, dueYmd: '2026-10-29', dueWords: 'Oct 29' } })
    expect(legend.map((l) => l.state)).toEqual(['notdue', 'promised', 'broken', 'late', 'doubtful', 'collections'])
    expect(legend[0]!.label).toBe(`$${Math.round(pile.byState.notdue.usd / 1000)}k not yet due`)
    expect(legend[2]!.words).toContain('promised for Oct 16.')
    expect(legend[5]!.words).toContain('kept apart')
    for (const l of legend) plain(l.words)
  })

  it('draws the three tiles: the late part with its own weeks, the cut, the left-alone case', () => {
    const tiles = collectTiles(pile, cut, { paidPerWeekUsd: 29_200, billedPerWeekUsd: 56_800 })
    expect(tiles[0]!.value).toBe(`${pile.latePileUsd >= 100_000 ? '$' : '$'}${(pile.latePileUsd / 1000).toFixed(1).replace(/\.0$/, '')}k late`)
    expect(tiles[0]!.words).toContain('clears in')
    expect(tiles[1]!.head).toBe(`${cut.cut.length} payers hold`)
    expect(tiles[2]!.value).toBe(`$${Math.round((pile.headlineUsd + 12 * 27_600) / 1000)}k in twelve weeks`)
    expect(tiles[2]!.tone).toBe('amber')
    for (const t of tiles) plain(t.words)
    const shrinking = collectTiles(pile, cut, { paidPerWeekUsd: 60_000, billedPerWeekUsd: 56_800 })
    expect(shrinking[2]!.tone).toBe('green')
    plain(shrinking[2]!.words)
  })

  it('names the pace and its source', () => {
    expect(collectPaceWords({ paceDays: 35, paceSource: 'own', paceSamples: 4, isGc: true })).toEqual({ value: '~35 d', sub: '4 payments on record' })
    expect(collectPaceWords({ paceDays: 35, paceSource: 'gc', paceSamples: 5, isGc: true })).toEqual({ value: '~35 d', sub: 'first job · the GC pace here' })
    expect(collectPaceWords({ paceDays: 12, paceSource: 'segment', paceSamples: 150, isGc: false }).sub).toBe('first job · their segment’s pace')
    expect(collectPaceWords({ paceDays: null, paceSource: 'none', paceSamples: 0, isGc: false })).toEqual({ value: 'no pace', sub: 'nothing to read' })
  })

  it('says where each payer stands, in plain words, with the lien chip after', () => {
    const sp = cut.cut.find((p) => p.payerName === 'Southern Post Construction')!
    const words = collectStandsWords(sp, { tone: 'green', state: 'out', paper: 'notice', words: 'Notice sent Oct 14', sentence: 'July to September, to the owner and the GC.', title: '', door: { kind: 'desk' } as never, dueOn: null, daysLeft: null }, TODAY)
    expect(words[0]).toBe('Promised for Oct 16, recorded by Taunya. 9 days past.')
    expect(words).toContain('Marked billed by hand, never sent from here.')
    // The chip's own words ride on the move's paper link; the row reads its sentence (v2.5873).
    expect(words[words.length - 1]).toBe('July to September, to the owner and the GC.')
    for (const w of words) plain(w)
    const rmc = cut.cut.find((p) => p.payerName === 'RMC- Dudley Mason')!
    const rmcWords = collectStandsWords(rmc, null, TODAY)
    expect(rmcWords).toContain('$13.4k is doubtful by their pace.')
    expect(rmcWords.some((w) => w.startsWith('$55.2k is late.'))).toBe(true)
    expect(rmcWords).toContain('No call recorded.')
    for (const w of rmcWords) plain(w)
    for (const p of cut.payers) for (const w of collectStandsWords(p, null, TODAY)) plain(w)
  })

  it('writes the rest line, the footnote and the slow facts in plain words', () => {
    const rest = collectRestWords(cut)
    expect(rest.head).toContain('Everyone else')
    plain(rest.words)
    const how = collectHowItReads(pile, { commercial: 12, residential: 2, company: 7 })
    expect(how).toContain('the GC pace here, 55 days. That pace comes from the 2 GCs who have paid us.')
    plain(how)
    const facts = collectSlowFacts(pile, cut)
    expect(facts.map((f) => f.tone)).toEqual(['red', 'red', 'amber', 'grey'])
    expect(facts[0]!.head).toMatch(/^\$\d+k was marked billed by hand/)
    expect(facts[2]!.head).toContain('No pay history on')
    for (const f of facts) {
      plain(f.head)
      plain(f.words)
    }
  })
})

describe('collectStandsWords after the call (v2.5873)', () => {
  const touch = (over: Partial<ChaseTouch>): ChaseTouch => ({ id: 't', customerId: 'southern', jobId: 'j-sp', outcome: 'note', note: null, promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt: '2026-10-24T15:00:00Z', createdByName: 'Taunya', ...over })
  const sp = () => cut.payers.find((p) => p.payerName === 'Southern Post Construction')!
  it('reads a dispute with their words, marked disputed', () => {
    const w = collectStandsWords({ ...sp(), lastTouch: touch({ outcome: 'dispute', note: 'the trip charge is not ours' }) }, null, TODAY)
    expect(w).toContain('Disputed Oct 24, recorded by Taunya. Their words: the trip charge is not ours')
    expect(w).toContain('The bills stay in the pile, marked disputed, until the owner decides.')
    for (const x of w) plain(x)
  })
  it('reads a call that named no date, and the day the payer is back on the sheet', () => {
    const w = collectStandsWords({ ...sp(), lastTouch: touch({ outcome: 'cant_reach', note: 'No answer, left a message' }) }, null, TODAY)
    expect(w).toContain('Called Oct 24, Taunya. No answer, left a message.')
    expect(w).toContain('Back on the sheet Oct 27.')
    const old = collectStandsWords({ ...sp(), lastTouch: touch({ outcome: 'cant_reach', createdAt: '2026-10-20T15:00:00Z' }) }, null, TODAY)
    expect(old).toContain('Last touch Oct 20, Taunya.')
    for (const x of w) plain(x)
  })
  it('dates an evening call on Chicago’s day (v2.5956: 01:30 UTC on Oct 25 is 8:30 PM on Oct 24)', () => {
    const w = collectStandsWords({ ...sp(), lastTouch: touch({ outcome: 'cant_reach', note: null, createdAt: '2026-10-25T01:30:00Z' }) }, null, TODAY)
    expect(w).toContain('Called Oct 24, Taunya.')
    expect(w).toContain('Back on the sheet Oct 27.')
  })
  it('names the owner at a second miss', () => {
    const w = collectStandsWords({ ...sp(), misses: 2 }, null, TODAY)
    expect(w).toContain('2 misses on the account. The owner makes the next call.')
  })
})
