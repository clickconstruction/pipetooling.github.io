import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { ymdAddDays } from '../../../utils/dateUtils'
import {
  SALES_AGING_PACE_MULTIPLE,
  SALES_DECIDED_DAYS,
  SALES_ESTIMATE_PACE_FLOOR_DAYS,
  SALES_ESTIMATE_SPEED_MIN,
  SALES_NO_PACE_DAYS,
  SALES_NO_REASON_SHOWN,
  SALES_RATE_MIN_DECIDED,
  SALES_SPEED_DEFAULT_WORDS,
  askerKey,
  buildSalesDesk,
  decidedYmd,
  isWin,
  median,
  plainName,
  readEstimateHistory,
  salesAging,
  salesFlipNote,
  salesSortButtonLabel,
  salesSubLines,
  sortSalesRows,
  type SalesDecidedBid,
  type SalesDeskInput,
  type SalesEstimateHistory,
  type SalesOpenBid,
  type SalesOpenEstimate,
} from './salesDesk'

const TODAY = '2026-10-26'
const ago = (n: number): string => ymdAddDays(TODAY, -n)
const plain = (s: string | null) => {
  if (s != null) expect(plainWordsFailures(s), s).toEqual([])
}

const open = (id: string, gc: string | null, projectName: string, usd: number, ageDays: number): SalesOpenBid => ({ id, bidNumber: `B-${id}`, projectName, gcBuilderId: gc, customerId: null, usd, sentYmd: ago(ageDays), nextFollowupYmd: null, nextFollowupReason: null, lastContactYmd: null })
let seq = 0
const decided = (gc: string | null, outcome: 'won' | 'lost', usd: number, paceDays: number, lossCategory: string | null = null): SalesDecidedBid => {
  seq += 1
  return { id: `d${seq}`, gcBuilderId: gc, customerId: null, usd, sentYmd: ago(paceDays + 100), outcome, outcomeYmd: ago(100), jobCreatedYmd: null, lossCategory, lossReason: lossCategory ? 'their words' : null }
}

const openBids: SalesOpenBid[] = [
  open('az', 'summit', 'Auto Zone Kyle', 410_000, 31),
  open('pecan', 'summit', 'Pecan St', 230_000, 18),
  open('take5', 'burd', 'Take 5 Georgetown', 890_000, 58),
  open('b2', 'burd', 'Round Rock shell', 200_000, 22),
  open('b3', 'burd', 'Hutto retail', 150_000, 31),
  open('a1', 'ati', 'Schertz clinic', 120_000, 12),
  open('a2', 'ati', 'Cibolo shell', 100_000, 5),
  open('a3', 'ati', 'Selma retail', 90_000, 20),
  open('a4', 'ati', 'Converse plant', 100_000, 30),
  open('mk1', 'mk', 'Leander clinic', 230_000, 44),
  open('k1', 'knight', 'Taylor plant', 200_000, 77),
  open('k2', 'knight', 'Hutto shell', 90_000, 52),
  open('n1', null, 'Small job', 20_000, 10),
  open('n2', null, 'No value yet', 0, 3),
  open('n3', null, 'Another no value', 0, 3),
  open('ac1', 'acme', 'Acme office', 30_000, 5),
  open('be1', 'beta', 'Beta shop', 25_000, 8),
  open('g1', 'gamma', 'Gamma strip', 15_000, 70),
  open('old', 'burd', 'An old ask', 480_000, 120),
]

const decidedBids: SalesDecidedBid[] = [
  // Summit: 2 of 5, 22% by value, pace 19.
  decided('summit', 'won', 110_000, 15),
  decided('summit', 'won', 100_000, 19),
  decided('summit', 'lost', 300_000, 19, 'price'),
  decided('summit', 'lost', 244_000, 25, 'other_sub'),
  decided('summit', 'lost', 200_000, 30, 'no_answer'),
  // Burd: 1 of 7, 9%, pace 24, four losses with no reason.
  decided('burd', 'won', 100_000, 24),
  decided('burd', 'lost', 200_000, 20, 'price'),
  { ...decided('burd', 'lost', 150_000, 22), bidNumber: '402', projectName: null },
  { ...decided('burd', 'lost', 150_000, 24), bidNumber: null, projectName: ' Pflugerville clinic ' },
  { ...decided('burd', 'lost', 200_000, 26), bidNumber: '418', projectName: 'Hutto shell' },
  decided('burd', 'lost', 150_000, 28),
  decided('burd', 'lost', 150_000, 30, 'project_died'),
  // ATI: 3 of 11, 18%, pace 35.
  ...[1, 2, 3].map(() => decided('ati', 'won', 60_000, 35)),
  ...[1, 2, 3, 4].map(() => decided('ati', 'lost', 102_500, 35, 'price')),
  ...[1, 2].map(() => decided('ati', 'lost', 102_500, 35, 'gc_lost')),
  ...[1, 2].map(() => decided('ati', 'lost', 102_500, 35, 'other_sub')),
  // MK: 3 decided, under the minimum, so the window's share stands in; pace 29 is its own.
  decided('mk', 'won', 70_000, 29),
  decided('mk', 'lost', 100_000, 29, 'price'),
  decided('mk', 'lost', 50_000, 29, 'no_answer'),
  // Knight: six asks, all silent.
  ...[1, 2, 3, 4, 5, 6].map(() => decided('knight', 'lost', 100_000, 60, 'no_answer')),
]

const openEstimates: SalesOpenEstimate[] = [
  ...Array.from({ length: 15 }, (_, i) => ({ id: `e${i + 1}`, title: `Estimate ${i + 1}`, sentYmd: ago(i + 1), usd: 3_000, customerId: `c${i + 1}` })),
  { id: 'e16', title: 'The oldest', sentYmd: ago(21), usd: 4_800, customerId: 'c16' },
  { id: 'e17', title: 'Today', sentYmd: TODAY, usd: 3_000, customerId: 'c17' },
]

const gcNames = new Map([
  ['summit', 'Summit GC'],
  ['burd', 'Burd & Assoc.'],
  ['ati', 'ATI Schertz'],
  ['mk', 'MK Builders'],
  ['knight', 'Knight Contracting'],
  ['acme', 'Acme Builders'],
  ['beta', 'Beta Homes'],
  ['gamma', 'Gamma Construction'],
])

const input: SalesDeskInput = { todayYmd: TODAY, openBids, decidedBids, gcNames, openEstimates, fallbackRate: 0.14, estimateShare: 0.37 }
const desk = buildSalesDesk(input)
const asker = (key: string) => desk.askers.find((a) => a.key === key)!
const row = (key: string) => desk.rows.find((r) => r.key === key)!

// The estimates' own history: every status, so the accepted ones give the pace and the decided ones the same-day split.
const hist = (id: string, over: Partial<SalesEstimateHistory> = {}): SalesEstimateHistory => ({ id, createdYmd: ago(40), sentYmd: ago(40), status: 'sent', acceptedYmd: null, updatedYmd: ago(30), usd: 3_000, ...over })
let hseq = 0
/** An estimate sent `sentAgo` days back and answered `paceDays` later; `sameDay` says whether it went out the day it was asked. */
const answered = (status: 'customer_accepted' | 'declined', sameDay: boolean, paceDays = 4, sentAgo = 60): SalesEstimateHistory => {
  hseq += 1
  return hist(`h${hseq}`, { createdYmd: sameDay ? ago(sentAgo) : ago(sentAgo + 2), sentYmd: ago(sentAgo), status, acceptedYmd: status === 'customer_accepted' ? ago(sentAgo - paceDays) : null, updatedYmd: ago(sentAgo - paceDays) })
}
const fill = (n: number, status: 'customer_accepted' | 'declined', sameDay: boolean): SalesEstimateHistory[] => Array.from({ length: n }, () => answered(status, sameDay))
/** The accepted ones with paces 8, 10 and 14, above the floor, one accepted with no sent day, one declined. */
const accepts: SalesEstimateHistory[] = [answered('customer_accepted', true, 8), answered('customer_accepted', false, 14), answered('customer_accepted', true, 10), hist('nosent', { sentYmd: null, status: 'customer_accepted', acceptedYmd: ago(10) }), answered('declined', true)]
function speedHistory(shape: 'ratio' | 'only' | 'flat' | 'silent' | 'thin'): SalesEstimateHistory[] {
  switch (shape) {
    case 'ratio':
      return [...fill(4, 'customer_accepted', true), ...fill(2, 'declined', true), ...fill(2, 'customer_accepted', false), ...fill(4, 'declined', false)]
    case 'only':
      return [...fill(2, 'customer_accepted', true), ...fill(3, 'declined', true), ...fill(5, 'declined', false)]
    case 'flat':
      return [...fill(2, 'customer_accepted', true), ...fill(3, 'declined', true), ...fill(2, 'customer_accepted', false), ...fill(3, 'declined', false)]
    case 'silent':
      return [...fill(5, 'declined', true), ...fill(5, 'declined', false)]
    case 'thin':
      return [...fill(4, 'customer_accepted', true), ...fill(6, 'customer_accepted', false)]
  }
}

describe('the thresholds', () => {
  it('are the owner calls built to the defaults the to-do drew', () => {
    expect(SALES_RATE_MIN_DECIDED).toBe(5)
    expect(SALES_AGING_PACE_MULTIPLE).toBe(2)
    expect(SALES_NO_PACE_DAYS).toBe(45)
    expect(SALES_DECIDED_DAYS).toBe(365)
    expect(SALES_ESTIMATE_SPEED_MIN).toBe(5)
    expect(SALES_NO_REASON_SHOWN).toBe(8)
    expect(SALES_ESTIMATE_PACE_FLOOR_DAYS).toBe(7)
  })
})

describe('salesAging and the helpers', () => {
  it('holds 1 inside the pace, fades to 0 at twice it, and reads 0 with no pace', () => {
    expect(salesAging(10, 19)).toBe(1)
    expect(salesAging(19, 19)).toBe(1)
    expect(salesAging(31, 19)).toBeCloseTo(1 - 12 / 19, 6)
    expect(salesAging(38, 19)).toBe(0)
    expect(salesAging(58, 24)).toBe(0)
    expect(salesAging(5, 0)).toBe(0)
  })
  it('median and plainName', () => {
    expect(median([])).toBeNull()
    expect(median([30, 15, 19, 25, 19])).toBe(19)
    expect(median([20, 30])).toBe(25)
    expect(plainName('Take 5 (Georgetown) — phase 2; bldg B · west')).toBe('Take 5 Georgetown, phase 2, bldg B west')
    expect(plainName('Plain name')).toBe('Plain name')
  })
})

describe('buildSalesDesk on the mock-up figures', () => {
  it('reads each asker’s own rate and pace, falls back under five decided, and names the dead weight', () => {
    const summit = asker('summit')
    expect(summit.rate).toBeCloseTo(210_000 / 954_000, 6)
    expect(summit.rateSource).toBe('own')
    expect(summit.paceDays).toBe(19)
    expect(summit.decided).toEqual({ count: 5, won: 2, wonUsd: 210_000, lostUsd: 744_000 })
    const burd = asker('burd')
    expect(burd.rate).toBeCloseTo(100_000 / 1_100_000, 6)
    expect(burd.paceDays).toBe(24)
    expect(asker('ati').rate).toBeCloseTo(0.18, 6)
    expect(asker('ati').paceDays).toBe(35)
    const mk = asker('mk')
    expect(mk.rate).toBe(0.14)
    expect(mk.rateSource).toBe('window')
    expect(mk.paceDays).toBe(29)
    expect(mk.paceSource).toBe('own')
    const gamma = asker('gamma')
    expect(gamma.paceDays).toBe(SALES_NO_PACE_DAYS)
    expect(gamma.paceSource).toBe('assumed')
    expect(gamma.rateSource).toBe('window')
    const knight = asker('knight')
    expect(knight.deadWeight).toBe(true)
    expect(knight.state).toBe('dead')
    expect(knight.expectedUsd).toBe(0)
    expect(knight.openUsd).toBe(290_000)
    expect(asker('none').name).toBe('No GC on the bid')
    expect(asker('none').isGc).toBe(false)
  })

  it('ages each open bid against its asker’s pace and sums the expected dollars', () => {
    const summit = asker('summit')
    const az = summit.bids.find((b) => b.id === 'az')!
    expect(az.ageDays).toBe(31)
    expect(az.pastDays).toBe(12)
    expect(az.aging).toBeCloseTo(1 - 12 / 19, 6)
    expect(az.expectedUsd).toBeCloseTo(410_000 * (210_000 / 954_000) * (1 - 12 / 19), 3)
    const pecan = summit.bids.find((b) => b.id === 'pecan')!
    expect(pecan.pastDays).toBe(0)
    expect(pecan.expectedUsd).toBeCloseTo(230_000 * (210_000 / 954_000), 3)
    expect(summit.expectedUsd).toBeCloseTo(az.expectedUsd + pecan.expectedUsd, 3)
    const take5 = asker('burd').bids.find((b) => b.id === 'take5')!
    expect(take5.pastDays).toBe(34)
    expect(take5.aging).toBe(0)
    expect(take5.expectedUsd).toBe(0)
    expect(asker('ati').expectedUsd).toBeCloseTo(410_000 * 0.18, 3)
    expect(asker('ati').state).toBe('inside')
    expect(asker('mk').expectedUsd).toBeCloseTo(230_000 * 0.14 * (1 - 15 / 29), 3)
    expect(asker('mk').pastDays).toBe(15)
  })

  it('keeps the bid past the 90-day window off the pile and off the bar', () => {
    expect(desk.offPile).toEqual({ bids: 1, usd: 480_000, words: '$480k more on 1 bid sits past the 90-day window, off this pile and off the bar.' })
    expect(desk.pile.bids).toBe(18)
    expect(desk.pile.bidsUsd).toBe(2_900_000)
    expect(desk.pile.estimates).toBe(17)
    expect(desk.pile.estimatesUsd).toBe(52_800)
    expect(desk.pile.askedUsd).toBe(2_952_800)
  })

  it('draws the bar by expected dollars with the dead weight apart', () => {
    const protectedUsd = 230_000 * (210_000 / 954_000) + 200_000 * (100_000 / 1_100_000) + 410_000 * 0.18 + 30_000 * 0.14 + 25_000 * 0.14 + 20_000 * 0.14
    const atRiskUsd = 410_000 * (210_000 / 954_000) * (1 - 12 / 19) + 150_000 * (100_000 / 1_100_000) * (1 - 7 / 24) + 230_000 * 0.14 * (1 - 15 / 29) + 15_000 * 0.14 * (1 - 25 / 45)
    expect(desk.bar.protectedUsd).toBeCloseTo(protectedUsd, 3)
    expect(desk.bar.atRiskUsd).toBeCloseTo(atRiskUsd, 3)
    expect(desk.bar.evaporatingUsd).toBeCloseTo(52_800 * 0.37, 3)
    expect(desk.bar.deadOpenUsd).toBe(290_000)
    expect(desk.pile.expectedUsd).toBeCloseTo(protectedUsd + atRiskUsd + 52_800 * 0.37, 3)
    expect(desk.companyPaceDays).toBe(35)
    expect(desk.legend.map((l) => l.label)).toEqual(['Protected', 'At risk', 'Evaporating', 'Dead weight, $0'])
    expect(desk.legend[3]!.words).toBe('Knight Contracting never answers and holds $290k open.')
  })

  it('ranks the rows by expected dollars, folds the rest past six, and keeps the estimates and the dead weight apart', () => {
    expect(desk.rows.map((r) => r.key)).toEqual(['summit', 'ati', 'burd', 'estimates', 'mk', 'acme', 'rest', 'beta', 'knight'])
    const summit = row('summit')
    expect(summit.meta).toBe('2 bids · GC')
    expect(summit.winsLabel).toBe('2 of 5 · 22%')
    expect(summit.paceLabel).toBe('answers in about 19 d, as recorded')
    expect(summit.state).toEqual({ kind: 'past', label: '12 d past pace' })
    expect(summit.story).toEqual(['Auto Zone Kyle, $410k, 31 days out. 12 past their pace.', 'Pecan St, $230k, 18 days out.'])
    expect(summit.say).toBe('Deciding Pecan St alone moves $50.6k of expected.')
    expect(summit.move).toBe('Call Summit GC about Auto Zone Kyle.')
    expect(summit.door).toEqual({ label: 'Open the bid ›', to: '/bids?tab=bid-board&bidId=az' })
    const burd = row('burd')
    expect(burd.winsLabel).toBe('1 of 7 · 9%')
    expect(burd.state.label).toBe('34 d past pace')
    expect(burd.say).toBe('Biggest open dollars on the desk. At 9% they buy less expected than Summit GC.')
    expect(burd.move).toBe('Call Burd & Assoc. about Take 5 Georgetown.')
    expect(burd.door.to).toBe('/bids?tab=bid-board&bidId=take5')
    const ati = row('ati')
    expect(ati.state).toEqual({ kind: 'inside', label: 'inside pace' })
    expect(ati.say).toBe('An answer takes about 35 days here, as recorded. Calling early spends goodwill.')
    expect(ati.move).toBe('Leave them.')
    expect(ati.door).toEqual({ label: 'Open the bids ›', to: '/bids?tab=bid-board' })
    const mk = row('mk')
    expect(mk.winsLabel).toBe("1 of 3 · the window's 14%")
    expect(mk.move).toBe('Call MK Builders about Leander clinic.')
    expect(mk.door.to).toBe('/bids?tab=bid-board&bidId=mk1')
    const rest = row('rest')
    expect(rest.meta).toBe('4 bids')
    expect(rest.story).toEqual(["4 smaller bids, 1 past its asker's pace."])
    expect(rest.move).toBe('Decide the 1 on the Bid Board.')
    expect(rest.door.to).toBe('/bids?tab=bid-board')
    const est = row('estimates')
    expect(est.meta).toBe('17 customers')
    expect(est.winsLabel).toBe('37% by value')
    expect(est.openUsd).toBe(52_800)
    expect(est.state).toEqual({ kind: 'aging', label: 'aging daily' })
    expect(est.story).toEqual(['17 sent and not answered. The oldest is 21 days out.', 'Small asks win on speed.'])
    expect(est.move).toBe('1 went out today. Answer the next request the same day.')
    expect(est.door).toEqual({ label: 'Open Estimates ›', to: '/estimates' })
    // No estimate history on this input: the estimates fade at the company's pace and the label says so.
    expect(est.paceLabel).toBe("fade at the company's 35 d pace, no estimate pace yet")
    expect(desk.estimatesPaceSource).toBe('company')
    expect(desk.estimatesPaceDays).toBe(35)
    expect(desk.estimatesPaceFloored).toBe(false)
    expect(desk.estimateReads).toEqual({ paceDays: null, speed: { sameDay: { decided: 0, accepted: 0 }, later: { decided: 0, accepted: 0 }, ratio: null, words: SALES_SPEED_DEFAULT_WORDS }, requestedTodayUnsent: 0 })
    expect(desk.howItReads).toContain("They fade at the company's 35 day pace, since no estimate pace is on record yet.")
    const knight = row('knight')
    expect(knight.winsLabel).toBe('0 of 6 · never answered')
    expect(knight.state).toEqual({ kind: 'dead', label: 'dead weight' })
    expect(knight.story[2]).toBe('6 asks these 12 months, no answer on any.')
    expect(knight.move).toBe('Decide the relationship, not the bid.')
    expect(knight.door.to).toBe('/bids?tab=bid-board')
    expect(row('acme').winsLabel).toBe("no decided bids · the window's 14%")
    expect(row('acme').paceLabel).toBe('no pace on record, 45 d assumed')
  })

  it('flips to open dollars and names the inversion', () => {
    const byOpen = sortSalesRows(desk.rows, 'open')
    expect(byOpen.map((r) => r.key)).toEqual(['burd', 'summit', 'ati', 'knight', 'mk', 'estimates', 'rest', 'acme', 'beta'])
    expect(sortSalesRows(desk.rows, 'expected').map((r) => r.key)).toEqual(desk.rows.map((r) => r.key))
    expect(salesFlipNote(desk.rows, 'expected')).toBeNull()
    expect(salesFlipNote(desk.rows, 'open')).toBe('By open dollars Burd & Assoc. leads. The 9% win share says otherwise. Press again.')
    expect(salesSortButtonLabel('expected')).toBe('Ranked by expected dollars · press to see it by open dollars')
    expect(salesSortButtonLabel('open')).toBe('Ranked by open dollars · press for expected dollars')
  })

  it('writes the tiles, the headline, the verdict and the sub-line', () => {
    expect(desk.tiles[0]).toMatchObject({ head: 'What the pile is worth', value: '≈ $232k', words: 'Open dollars flatter the pile. Say the $232k, never the $3.0M.' })
    expect(desk.tiles[1]).toMatchObject({ head: 'At risk, the calls', value: '$59.4k on 3 calls', tone: 'amber' })
    expect(desk.tiles[2]).toMatchObject({ head: 'What thins the reading', value: '2 + 4', words: '2 bids ride at $0 value and 4 losses carry no reason. Both thin every share below.', tone: 'red' })
    expect(desk.headline).toBe('$3.0M asked · worth about $232k')
    expect(desk.verdict).toBe('3 calls this week protect $59.4k of it.')
    expect(desk.calls).toEqual({ count: 3, usd: desk.bar.atRiskUsd })
    expect(desk.thins).toEqual({ noValueBids: 2, noReasonLosses: 4 })
    expect(salesSubLines(desk, { soldPerWeekUsd: 50_400, fieldPerWeekUsd: 52_900 })).toEqual(['18 bids, $2.9M.', '17 estimates, $52.8k.', "Sold $50.4k a week against the field's $52.9k."])
    expect(salesSubLines(desk, { soldPerWeekUsd: null, fieldPerWeekUsd: null })[2]).toBe('Sold: not readable until Build reads.')
  })

  it('folds the decided asks into the funnel by loss category and names the unreasoned losses', () => {
    const f = desk.funnel
    expect(f.won).toEqual({ count: 7, usd: 560_000 })
    expect(f.lost).toEqual({ count: 25, usd: 3_314_000 })
    expect(f.lines.map((l) => [l.key, l.count, l.usd])).toEqual([
      ['won', 7, 560_000],
      ['gc_lost', 2, 205_000],
      ['price', 7, 1_010_000],
      ['other_sub', 3, 449_000],
      ['project_died', 1, 150_000],
      ['no_answer', 8, 850_000],
      ['none', 4, 650_000],
    ])
    expect(f.lines[2]!.label).toBe('Price too high')
    expect(f.words).toEqual(['Won $560k on 7 bids. Lost $3.3M on 25 bids.', 'Most lost to Price too high, $1.0M, then No answer, $850k.'])
    expect(f.blind).toBe('4 losses carry no reason, so this strip under-reads.')
  })

  it('names each unreasoned loss, biggest first, with a door onto its bid', () => {
    const f = desk.funnel
    expect(f.noReasonBids.map((b) => [b.label, b.usd, b.door.to])).toEqual([
      ['B418 · Hutto shell', 200_000, '/bids?tab=bid-board&bidId=d10'],
      ['B402', 150_000, '/bids?tab=bid-board&bidId=d8'],
      ['Pflugerville clinic', 150_000, '/bids?tab=bid-board&bidId=d9'],
      ['A bid with no name', 150_000, '/bids?tab=bid-board&bidId=d11'],
    ])
    expect(f.noReasonBids.every((b) => b.door.label === 'Open the bid ›')).toBe(true)
    expect(desk.howItReads).toContain('A loss with no reason opens on its bid, where Why we lost is written.')
    // Past the cap the rest wait behind the board door; the count still says all of them.
    const many = Array.from({ length: 10 }, (_, i) => ({ ...decided('burd', 'lost', 10_000 * (i + 1), 20), bidNumber: String(500 + i), projectName: `Lot ${i + 1}` }))
    const capped = buildSalesDesk({ ...input, decidedBids: many }).funnel
    expect(capped.noReason.count).toBe(10)
    expect(capped.noReasonBids).toHaveLength(SALES_NO_REASON_SHOWN)
    expect(capped.noReasonBids[0]!.label).toBe('B509 · Lot 10')
    expect(capped.noReasonBids[7]!.label).toBe('B502 · Lot 3')
    expect(capped.blind).toBe('10 losses carry no reason, so this strip under-reads.')
  })

  it('holds every new sentence of the estimates and the funnel to the plain-words rule', () => {
    const withHistory = buildSalesDesk({ ...input, estimateHistory: [...speedHistory('ratio'), ...accepts, hist('t1', { createdYmd: TODAY, sentYmd: null, status: 'draft' })] })
    plain(withHistory.howItReads)
    for (const r of withHistory.rows) {
      r.story.forEach(plain)
      plain(r.move)
    }
    for (const shape of ['ratio', 'only', 'flat', 'silent', 'thin'] as const) plain(readEstimateHistory(speedHistory(shape), TODAY).speed.words)
    withHistory.funnel.words.forEach(plain)
    plain(withHistory.funnel.blind)
  })

  it('reads an empty pile without a call and with no blind spot', () => {
    const empty = buildSalesDesk({ todayYmd: TODAY, openBids: [], decidedBids: [], gcNames: new Map(), openEstimates: [], fallbackRate: null, estimateShare: null })
    expect(empty.rows).toEqual([])
    expect(empty.verdict).toBe("No ask is past its asker's pace this week.")
    expect(empty.headline).toBe('$0 asked · worth about $0')
    expect(empty.funnel.blind).toBeNull()
    expect(empty.funnel.noReasonBids).toEqual([])
    expect(empty.funnel.words).toEqual(['Won $0 on 0 bids. Lost $0 on 0 bids.'])
    expect(empty.offPile.words).toBeNull()
    expect(empty.companyPaceSource).toBe('assumed')
    expect(empty.legend[3]!.words).toBe('No asker on the pile has gone silent on every bid.')
    plain(empty.howItReads)
  })

  it('holds every sentence to the plain-words rule', () => {
    plain(desk.verdict)
    desk.ruleLines.forEach(plain)
    salesSubLines(desk, { soldPerWeekUsd: 50_400, fieldPerWeekUsd: 52_900 }).forEach(plain)
    salesSubLines(desk, { soldPerWeekUsd: null, fieldPerWeekUsd: null }).forEach(plain)
    desk.tiles.forEach((t) => plain(t.words))
    desk.legend.forEach((l) => plain(l.words))
    plain(desk.offPile.words)
    for (const r of desk.rows) {
      r.story.forEach(plain)
      plain(r.say)
      plain(r.move)
    }
    desk.funnel.words.forEach(plain)
    plain(desk.funnel.blind)
    plain(salesFlipNote(desk.rows, 'open'))
    plain(desk.howItReads)
  })
})

describe("the asker is the bid's customer", () => {
  // The bid form's GC field writes customer_id, never gc_builder_id: the asker is keyed by the customer and named from customers.
  const names = new Map([...gcNames, ['cust-river', 'River Homes'], ['cust-oak', 'Oak Partners']])
  const byCustomer: SalesOpenBid[] = [
    { ...open('r1', null, 'River plant', 300_000, 10), customerId: 'cust-river' },
    // A bid with both: the customer keys it and the GC builder is set aside.
    { ...open('r2', 'summit', 'River annex', 100_000, 5), customerId: 'cust-river' },
    { ...open('o1', null, 'Oak shell', 50_000, 3), customerId: 'cust-oak' },
    open('n1', null, 'No one', 20_000, 4),
    open('s1', 'summit', 'Summit only', 80_000, 6),
  ]
  const riverDecided: SalesDecidedBid[] = [...[1, 2, 3].map(() => ({ ...decided(null, 'won', 100_000, 12), customerId: 'cust-river' })), ...[1, 2].map(() => ({ ...decided(null, 'lost', 100_000, 12, 'price'), customerId: 'cust-river' }))]
  const d = buildSalesDesk({ ...input, openBids: byCustomer, decidedBids: riverDecided, gcNames: names })
  const by = (key: string) => d.askers.find((a) => a.key === key)!

  it('keys the asker by customer_id, names it from customers, and falls back to the GC builder, else no GC', () => {
    expect(askerKey({ customerId: 'c', gcBuilderId: 'g' })).toBe('c')
    expect(askerKey({ customerId: null, gcBuilderId: 'g' })).toBe('g')
    expect(askerKey({ gcBuilderId: 'g' })).toBe('g')
    expect(askerKey({ customerId: null, gcBuilderId: null })).toBe('none')
    const river = by('cust-river')
    expect(river.name).toBe('River Homes')
    expect(river.customerId).toBe('cust-river')
    expect(river.isGc).toBe(true)
    expect(river.bids.map((b) => b.id)).toEqual(['r1', 'r2'])
    expect(river.openUsd).toBe(400_000)
    // The decided bids key the same way, so the rate and the pace are the customer's own.
    expect(river.decided).toEqual({ count: 5, won: 3, wonUsd: 300_000, lostUsd: 200_000 })
    expect(river.rate).toBeCloseTo(0.6, 6)
    expect(river.rateSource).toBe('own')
    expect(river.paceDays).toBe(12)
    expect(river.paceSource).toBe('own')
    expect(d.rows.find((r) => r.key === 'cust-river')!.meta).toBe('2 bids · GC')
    expect(d.rows.find((r) => r.key === 'cust-river')!.winsLabel).toBe('3 of 5 · 60%')
    expect(by('cust-oak').name).toBe('Oak Partners')
    expect(by('summit').bids.map((b) => b.id)).toEqual(['s1'])
    expect(by('summit').customerId).toBeNull()
    expect(by('none').name).toBe('No GC on the bid')
    expect(by('none').isGc).toBe(false)
    expect(d.howItReads).toContain('An asker is the customer on the bid, the GC the bid form names. A bid with no customer reads its GC builder, or folds into No GC on the bid.')
    // A customer with no name on record reads as such.
    const unnamed = buildSalesDesk({ ...input, openBids: [{ ...open('u1', null, 'Unnamed', 10_000, 2), customerId: 'cust-ghost' }], decidedBids: [], gcNames: new Map() })
    expect(unnamed.askers[0]!.name).toBe('A GC with no name on record')
    plain(d.howItReads)
  })
})

describe("a win is the Sales card's own rule", () => {
  // Delta: one marked won, one a job was made from with no outcome, one marked started, one lost with a job, two lost.
  const jobOnly: SalesDecidedBid = { ...decided('delta', 'lost', 120_000, 0), outcome: null, outcomeYmd: null, jobCreatedYmd: ago(90) }
  const started: SalesDecidedBid = { ...decided('delta', 'won', 80_000, 20), outcome: 'started_or_complete' }
  const lostWithJob: SalesDecidedBid = { ...decided('delta', 'lost', 50_000, 15, 'price'), jobCreatedYmd: ago(95) }
  const deltaDecided: SalesDecidedBid[] = [decided('delta', 'won', 100_000, 14), jobOnly, started, lostWithJob, decided('delta', 'lost', 150_000, 16, 'no_answer'), decided('delta', 'lost', 100_000, 30)]
  const d = buildSalesDesk({ ...input, openBids: [open('dl1', 'delta', 'Delta shell', 200_000, 5)], decidedBids: deltaDecided, gcNames: new Map([['delta', 'Delta Build']]) })

  it('counts a bid with a job and no outcome, a started bid and a lost bid with a job as won, in the rate and the funnel', () => {
    expect(isWin({ outcome: null, jobCreatedYmd: ago(1) })).toBe(true)
    expect(isWin({ outcome: 'started_or_complete', jobCreatedYmd: null })).toBe(true)
    expect(isWin({ outcome: 'won', jobCreatedYmd: null })).toBe(true)
    expect(isWin({ outcome: 'lost', jobCreatedYmd: null })).toBe(false)
    expect(isWin({ outcome: 'lost', jobCreatedYmd: ago(1) })).toBe(true)
    expect(decidedYmd({ outcomeYmd: null, jobCreatedYmd: ago(9) })).toBe(ago(9))
    expect(decidedYmd({ outcomeYmd: ago(3), jobCreatedYmd: ago(9) })).toBe(ago(3))
    expect(decidedYmd({ outcomeYmd: null })).toBeNull()
    const delta = d.askers.find((a) => a.key === 'delta')!
    expect(delta.decided).toEqual({ count: 6, won: 4, wonUsd: 350_000, lostUsd: 250_000 })
    expect(delta.rate).toBeCloseTo(350_000 / 600_000, 6)
    expect(delta.rateSource).toBe('own')
    expect(delta.deadWeight).toBe(false)
    // The paces: 14, the job's 10 standing in for outcome_at, 20, 15, 16 and 30, a median of 15.5 rounded up.
    expect(delta.paceDays).toBe(16)
    expect(d.companyPaceDays).toBe(16)
    expect(d.funnel.won).toEqual({ count: 4, usd: 350_000 })
    expect(d.funnel.lost).toEqual({ count: 2, usd: 250_000 })
    expect(d.funnel.words[0]).toBe('Won $350k on 4 bids. Lost $250k on 2 bids.')
    expect(d.funnel.lines.map((l) => [l.key, l.count, l.usd])).toEqual([
      ['won', 4, 350_000],
      ['no_answer', 1, 150_000],
      ['none', 1, 100_000],
    ])
    expect(d.howItReads).toContain('A bid marked won or started counts as won, and so does a bid a job was made from. The rate is won dollars over won and lost dollars.')
    expect(d.howItReads).toContain('A bid with no outcome_at reads the day its job was made.')
    plain(d.howItReads)
    // A bid with neither day on record still counts in the rate and gives no pace.
    const noDay = buildSalesDesk({ ...input, openBids: [open('x1', 'x', 'X', 10_000, 1)], decidedBids: [{ ...decided('x', 'won', 10_000, 5), outcomeYmd: null }], gcNames: new Map() })
    expect(noDay.askers[0]!.decided.won).toBe(1)
    expect(noDay.askers[0]!.paceSource).toBe('assumed')
  })
})

describe('the estimates pace has a floor', () => {
  // Live the customers accept the same day: the median from sent to accepted is 0 days.
  const sameDay: SalesEstimateHistory[] = [answered('customer_accepted', true, 0), answered('customer_accepted', false, 0), answered('customer_accepted', true, 1)]
  const floored = buildSalesDesk({ ...input, estimateHistory: sameDay })

  it('fades the estimates at the floor when their own pace sits under it, and says so on the row and in the footnote', () => {
    expect(floored.estimateReads.paceDays).toBe(0)
    expect(floored.estimatesPaceSource).toBe('own')
    expect(floored.estimatesPaceFloored).toBe(true)
    expect(floored.estimatesPaceDays).toBe(SALES_ESTIMATE_PACE_FLOOR_DAYS)
    const est = floored.rows.find((r) => r.key === 'estimates')!
    expect(est.paceLabel).toBe('fade at a 7 d floor, the estimates answer in ~0 d')
    // Ages 0 to 7 hold, 8 to 13 fade by a seventh a day, 14 and past read 0: 11 whole estimates' worth at 37%.
    expect(floored.bar.evaporatingUsd).toBeCloseTo(3_000 * 0.37 * 11, 3)
    expect(floored.howItReads).toContain('The estimates answer in 0 days, the median of acceptor_consented_at less sent_at. They fade at a 7 day floor instead. Under it a same day answer would read every open estimate as past pace and worth $0. The floor is an owner call.')
    plain(floored.howItReads)
    plain(est.paceLabel)
  })

  it('floors the company pace the same way when it stands in, and leaves a pace at or above the floor as read', () => {
    const quick = buildSalesDesk({ ...input, decidedBids: [decided('summit', 'won', 1, 2), decided('summit', 'lost', 1, 3), decided('summit', 'won', 1, 2)] })
    expect(quick.companyPaceDays).toBe(2)
    expect(quick.estimatesPaceSource).toBe('company')
    expect(quick.estimatesPaceFloored).toBe(true)
    expect(quick.estimatesPaceDays).toBe(7)
    const est = quick.rows.find((r) => r.key === 'estimates')!
    expect(est.paceLabel).toBe('fade at a 7 d floor, no estimate pace yet')
    expect(quick.howItReads).toContain("No estimate pace is on record yet, so the company's 2 day pace would stand in. They fade at a 7 day floor instead. Under it a same day answer would read every open estimate as past pace and worth $0. The floor is an owner call.")
    plain(quick.howItReads)
    plain(est.paceLabel)
    const atFloor = buildSalesDesk({ ...input, estimateHistory: [answered('customer_accepted', true, 7)] })
    expect(atFloor.estimatesPaceFloored).toBe(false)
    expect(atFloor.estimatesPaceDays).toBe(7)
    expect(atFloor.rows.find((r) => r.key === 'estimates')!.paceLabel).toBe("fade at the estimates' ~7 d pace")
  })
})

describe('the estimates read their own history', () => {
  it('takes the pace as the median of accepted less sent, and the row fades at it', () => {
    const reads = readEstimateHistory(accepts, TODAY)
    expect(reads.paceDays).toBe(10)
    const withPace = buildSalesDesk({ ...input, estimateHistory: accepts })
    expect(withPace.estimatesPaceDays).toBe(10)
    expect(withPace.estimatesPaceSource).toBe('own')
    expect(withPace.estimatesPaceFloored).toBe(false)
    const est = withPace.rows.find((r) => r.key === 'estimates')!
    expect(est.paceLabel).toBe("fade at the estimates' ~10 d pace")
    // Ages 0 to 10 hold, 11 to 19 fade by a tenth a day, 20 and past read 0: 14.5 whole estimates' worth at 37%.
    expect(withPace.bar.evaporatingUsd).toBeCloseTo(3_000 * 0.37 * 14.5, 3)
    expect(withPace.howItReads).toContain("They fade at the estimates' own 10 day pace, the median of acceptor_consented_at less sent_at.")
    expect(withPace.howItReads).not.toContain('floor')
    expect(withPace.howItReads).toContain('The speed line reads once 5 decided estimates sit on each side of the same-day line.')
    // No accepted estimate with both days: no pace, and the company's stands in.
    expect(readEstimateHistory([answered('declined', true), hist('x', { status: 'customer_accepted', sentYmd: null, acceptedYmd: ago(3) })], TODAY).paceDays).toBeNull()
    expect(readEstimateHistory([], TODAY)).toEqual({ paceDays: null, speed: { sameDay: { decided: 0, accepted: 0 }, later: { decided: 0, accepted: 0 }, ratio: null, words: SALES_SPEED_DEFAULT_WORDS }, requestedTodayUnsent: 0 })
  })

  it('writes the speed sentence in its three shapes and falls back on thin data', () => {
    const ratio = readEstimateHistory(speedHistory('ratio'), TODAY).speed
    expect(ratio.sameDay).toEqual({ decided: 6, accepted: 4 })
    expect(ratio.later).toEqual({ decided: 6, accepted: 2 })
    expect(ratio.ratio).toBeCloseTo(2, 6)
    expect(ratio.words).toBe('Estimates sent the day they were asked are accepted 2.0 times as often.')
    const only = readEstimateHistory(speedHistory('only'), TODAY).speed
    expect(only.ratio).toBeNull()
    expect(only.words).toBe('Only the estimates sent the day they were asked were accepted.')
    const flat = readEstimateHistory(speedHistory('flat'), TODAY).speed
    expect(flat.ratio).toBeCloseTo(1, 6)
    expect(flat.words).toBe('Sending the same day has not changed the answer so far.')
    expect(readEstimateHistory(speedHistory('silent'), TODAY).speed.words).toBe('Sending the same day has not changed the answer so far.')
    const thin = readEstimateHistory(speedHistory('thin'), TODAY).speed
    expect(thin.sameDay.decided).toBe(4)
    expect(thin.ratio).toBeNull()
    expect(thin.words).toBe(SALES_SPEED_DEFAULT_WORDS)
    // A decided estimate with no sent day, or one still open, is on neither side.
    expect(readEstimateHistory([...speedHistory('ratio'), hist('open', { status: 'sent' }), hist('nosent', { status: 'declined', sentYmd: null })], TODAY).speed.sameDay.decided).toBe(6)
    // The row carries the sentence.
    const est = buildSalesDesk({ ...input, estimateHistory: speedHistory('ratio') }).rows.find((r) => r.key === 'estimates')!
    expect(est.story).toEqual(['17 sent and not answered. The oldest is 21 days out.', 'Estimates sent the day they were asked are accepted 2.0 times as often.'])
  })

  it("counts today's requests still unsent and makes them the move", () => {
    const today = [hist('t1', { createdYmd: TODAY, sentYmd: null, status: 'draft' }), hist('t2', { createdYmd: TODAY, sentYmd: null, status: 'draft' }), hist('t3', { createdYmd: TODAY, sentYmd: null, status: 'declined' }), hist('t4', { createdYmd: TODAY, sentYmd: TODAY, status: 'sent' }), hist('t5', { createdYmd: ago(1), sentYmd: null, status: 'draft' })]
    expect(readEstimateHistory(today, TODAY).requestedTodayUnsent).toBe(2)
    const two = buildSalesDesk({ ...input, estimateHistory: today }).rows.find((r) => r.key === 'estimates')!
    expect(two.move).toBe("Answer today's 2 the same day.")
    const one = buildSalesDesk({ ...input, estimateHistory: [today[0]!] }).rows.find((r) => r.key === 'estimates')!
    expect(one.move).toBe("Answer today's one the same day.")
    // None requested today: the move stays on the next request.
    const none = buildSalesDesk({ ...input, estimateHistory: [today[4]!] }).rows.find((r) => r.key === 'estimates')!
    expect(none.move).toBe('1 went out today. Answer the next request the same day.')
  })
})
