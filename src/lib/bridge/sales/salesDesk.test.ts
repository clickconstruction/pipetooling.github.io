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
  isMarked,
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
  open('az', 'sycamore', 'Parts store shell', 410_000, 31),
  open('pecan', 'sycamore', 'Pecan St', 230_000, 18),
  open('lube', 'birch', 'Corner lube shop', 890_000, 58),
  open('b2', 'birch', 'Round Rock shell', 200_000, 22),
  open('b3', 'birch', 'Hutto retail', 150_000, 31),
  open('a1', 'alder', 'Schertz clinic', 120_000, 12),
  open('a2', 'alder', 'Cibolo shell', 100_000, 5),
  open('a3', 'alder', 'Selma retail', 90_000, 20),
  open('a4', 'alder', 'Converse plant', 100_000, 30),
  open('mk1', 'maple', 'Leander clinic', 230_000, 44),
  open('k1', 'kestrel', 'Taylor plant', 200_000, 77),
  open('k2', 'kestrel', 'Hutto shell', 90_000, 52),
  open('n1', null, 'Small job', 20_000, 10),
  open('n2', null, 'No value yet', 0, 3),
  open('n3', null, 'Another no value', 0, 3),
  open('ac1', 'acme', 'Acme office', 30_000, 5),
  open('be1', 'beta', 'Beta shop', 25_000, 8),
  open('g1', 'gamma', 'Gamma strip', 15_000, 70),
  open('old', 'birch', 'An old ask', 480_000, 120),
]

const decidedBids: SalesDecidedBid[] = [
  // Sycamore: 2 of 5, 22% by value, pace 19.
  decided('sycamore', 'won', 110_000, 15),
  decided('sycamore', 'won', 100_000, 19),
  decided('sycamore', 'lost', 300_000, 19, 'price'),
  decided('sycamore', 'lost', 244_000, 25, 'other_sub'),
  decided('sycamore', 'lost', 200_000, 30, 'no_answer'),
  // Birch: 1 of 7, 9%, pace 24, four losses with no reason.
  decided('birch', 'won', 100_000, 24),
  decided('birch', 'lost', 200_000, 20, 'price'),
  { ...decided('birch', 'lost', 150_000, 22), bidNumber: '402', projectName: null },
  { ...decided('birch', 'lost', 150_000, 24), bidNumber: null, projectName: ' Pflugerville clinic ' },
  { ...decided('birch', 'lost', 200_000, 26), bidNumber: '418', projectName: 'Hutto shell' },
  decided('birch', 'lost', 150_000, 28),
  decided('birch', 'lost', 150_000, 30, 'project_died'),
  // Alder: 3 of 11, 18%, pace 35.
  ...[1, 2, 3].map(() => decided('alder', 'won', 60_000, 35)),
  ...[1, 2, 3, 4].map(() => decided('alder', 'lost', 102_500, 35, 'price')),
  ...[1, 2].map(() => decided('alder', 'lost', 102_500, 35, 'gc_lost')),
  ...[1, 2].map(() => decided('alder', 'lost', 102_500, 35, 'other_sub')),
  // Maple: 3 decided, under the minimum, so the window's share stands in; pace 29 is its own.
  decided('maple', 'won', 70_000, 29),
  decided('maple', 'lost', 100_000, 29, 'price'),
  decided('maple', 'lost', 50_000, 29, 'no_answer'),
  // Kestrel: six asks, all silent.
  ...[1, 2, 3, 4, 5, 6].map(() => decided('kestrel', 'lost', 100_000, 60, 'no_answer')),
]

const openEstimates: SalesOpenEstimate[] = [
  ...Array.from({ length: 15 }, (_, i) => ({ id: `e${i + 1}`, title: `Estimate ${i + 1}`, sentYmd: ago(i + 1), usd: 3_000, customerId: `c${i + 1}` })),
  { id: 'e16', title: 'The oldest', sentYmd: ago(21), usd: 4_800, customerId: 'c16' },
  { id: 'e17', title: 'Today', sentYmd: TODAY, usd: 3_000, customerId: 'c17' },
]

const gcNames = new Map([
  ['sycamore', 'Sycamore GC'],
  ['birch', 'Birch & Assoc.'],
  ['alder', 'Alder Build'],
  ['maple', 'Maple Builders'],
  ['kestrel', 'Kestrel Contracting'],
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
    expect(plainName('Corner lube (shop) — phase 2; bldg B · west')).toBe('Corner lube shop, phase 2, bldg B west')
    expect(plainName('Plain name')).toBe('Plain name')
  })
})

describe('buildSalesDesk on the mock-up figures', () => {
  it('reads each asker’s own rate and pace, falls back under five decided, and names the dead weight', () => {
    const sycamore = asker('sycamore')
    expect(sycamore.rate).toBeCloseTo(210_000 / 954_000, 6)
    expect(sycamore.rateSource).toBe('own')
    expect(sycamore.paceDays).toBe(19)
    expect(sycamore.decided).toEqual({ count: 5, won: 2, wonUsd: 210_000, lostUsd: 744_000 })
    const birch = asker('birch')
    expect(birch.rate).toBeCloseTo(100_000 / 1_100_000, 6)
    expect(birch.paceDays).toBe(24)
    expect(asker('alder').rate).toBeCloseTo(0.18, 6)
    expect(asker('alder').paceDays).toBe(35)
    const maple = asker('maple')
    expect(maple.rate).toBe(0.14)
    expect(maple.rateSource).toBe('window')
    expect(maple.paceDays).toBe(29)
    expect(maple.paceSource).toBe('own')
    const gamma = asker('gamma')
    expect(gamma.paceDays).toBe(SALES_NO_PACE_DAYS)
    expect(gamma.paceSource).toBe('assumed')
    expect(gamma.rateSource).toBe('window')
    const kestrel = asker('kestrel')
    expect(kestrel.deadWeight).toBe(true)
    expect(kestrel.state).toBe('dead')
    expect(kestrel.expectedUsd).toBe(0)
    expect(kestrel.openUsd).toBe(290_000)
    expect(asker('none').name).toBe('No GC on the bid')
    expect(asker('none').isGc).toBe(false)
  })

  it('ages each open bid against its asker’s pace and sums the expected dollars', () => {
    const sycamore = asker('sycamore')
    const az = sycamore.bids.find((b) => b.id === 'az')!
    expect(az.ageDays).toBe(31)
    expect(az.pastDays).toBe(12)
    expect(az.aging).toBeCloseTo(1 - 12 / 19, 6)
    expect(az.expectedUsd).toBeCloseTo(410_000 * (210_000 / 954_000) * (1 - 12 / 19), 3)
    const pecan = sycamore.bids.find((b) => b.id === 'pecan')!
    expect(pecan.pastDays).toBe(0)
    expect(pecan.expectedUsd).toBeCloseTo(230_000 * (210_000 / 954_000), 3)
    expect(sycamore.expectedUsd).toBeCloseTo(az.expectedUsd + pecan.expectedUsd, 3)
    const lube = asker('birch').bids.find((b) => b.id === 'lube')!
    expect(lube.pastDays).toBe(34)
    expect(lube.aging).toBe(0)
    expect(lube.expectedUsd).toBe(0)
    expect(asker('alder').expectedUsd).toBeCloseTo(410_000 * 0.18, 3)
    expect(asker('alder').state).toBe('inside')
    expect(asker('maple').expectedUsd).toBeCloseTo(230_000 * 0.14 * (1 - 15 / 29), 3)
    expect(asker('maple').pastDays).toBe(15)
  })

  it('keeps the bid past the 90-day window off the pile and off the bar', () => {
    expect(desk.offPile).toEqual({ bids: 1, usd: 480_000, words: '1 more bid, $480k, was sent over 90 days ago. It is off this pile and off the bar.' })
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
    expect(desk.legend.map((l) => l.label)).toEqual(['On time', 'Past their usual answer', 'Estimates getting old', 'Never answered, $0'])
    expect(desk.legend[3]!.words).toBe('Kestrel Contracting never answers and holds $290k open.')
  })

  it('ranks the rows by expected dollars, folds the rest past six, and keeps the estimates and the dead weight apart', () => {
    expect(desk.rows.map((r) => r.key)).toEqual(['sycamore', 'alder', 'birch', 'estimates', 'maple', 'acme', 'rest', 'beta', 'kestrel'])
    const sycamore = row('sycamore')
    expect(sycamore.meta).toBe('2 bids · GC')
    expect(sycamore.winsLabel).toBe('2 of 5 · 22%')
    expect(sycamore.paceLabel).toBe('answers in about 19 d, as recorded')
    expect(sycamore.state).toEqual({ kind: 'past', label: '12 days late' })
    expect(sycamore.story).toEqual(['Parts store shell, $410k, 31 days out. 12 days past their usual answer.', 'Pecan St, $230k, 18 days out.'])
    expect(sycamore.say).toBe('Deciding Pecan St alone settles $50.6k of what the pile is worth.')
    expect(sycamore.move).toBe('Call Sycamore GC about Parts store shell.')
    expect(sycamore.door).toEqual({ label: 'Open the bid ›', to: '/bids?tab=bid-board&bidId=az' })
    const birch = row('birch')
    expect(birch.winsLabel).toBe('1 of 7 · 9%')
    expect(birch.state.label).toBe('34 days late')
    expect(birch.say).toBe('Biggest open dollars in the list. At 9% won they are worth less than Sycamore GC.')
    expect(birch.move).toBe('Call Birch & Assoc. about Corner lube shop.')
    expect(birch.door.to).toBe('/bids?tab=bid-board&bidId=lube')
    const alder = row('alder')
    expect(alder.state).toEqual({ kind: 'inside', label: 'on time' })
    expect(alder.say).toBe('An answer takes about 35 days here, as recorded. Calling early spends goodwill.')
    expect(alder.move).toBe('Leave them.')
    expect(alder.door).toEqual({ label: 'Open the bids ›', to: '/bids?tab=bid-board' })
    const maple = row('maple')
    expect(maple.winsLabel).toBe('1 of 3 · all bids together, 14%')
    expect(maple.move).toBe('Call Maple Builders about Leander clinic.')
    expect(maple.door.to).toBe('/bids?tab=bid-board&bidId=mk1')
    const rest = row('rest')
    expect(rest.meta).toBe('4 bids')
    expect(rest.story).toEqual(["4 smaller bids, 1 past its asker's usual answer."])
    expect(rest.winsLabel).toBe('their own records')
    expect(rest.state).toEqual({ kind: 'past', label: '1 late' })
    expect(rest.move).toBe('Decide the 1 on the Bid Board.')
    expect(rest.door.to).toBe('/bids?tab=bid-board')
    const est = row('estimates')
    expect(est.meta).toBe('17 customers')
    expect(est.winsLabel).toBe('37% won by dollars')
    expect(est.openUsd).toBe(52_800)
    expect(est.state).toEqual({ kind: 'aging', label: 'getting old' })
    expect(est.story).toEqual(['17 sent and not answered. The oldest is 21 days out.', 'Small asks win on speed.'])
    expect(est.move).toBe('1 went out today. Answer the next request the same day.')
    expect(est.door).toEqual({ label: 'Open Estimates ›', to: '/estimates' })
    // No estimate history on this input: the estimates fade at the company's pace and the label says so.
    expect(est.paceLabel).toBe("fade at the company's 35 d usual answer, no estimate answers yet")
    expect(desk.estimatesPaceSource).toBe('company')
    expect(desk.estimatesPaceDays).toBe(35)
    expect(desk.estimatesPaceFloored).toBe(false)
    expect(desk.estimateReads).toEqual({ paceDays: null, speed: { sameDay: { decided: 0, accepted: 0 }, later: { decided: 0, accepted: 0 }, ratio: null, words: SALES_SPEED_DEFAULT_WORDS }, requestedTodayUnsent: 0 })
    expect(desk.howItReads).toContain("They fade at the company's 35 day answer, since no estimate has one on record yet.")
    const kestrel = row('kestrel')
    expect(kestrel.winsLabel).toBe('0 of 6 · never answered')
    expect(kestrel.state).toEqual({ kind: 'dead', label: 'never answered' })
    expect(kestrel.story[2]).toBe('6 asks these 12 months, no answer on any.')
    expect(kestrel.move).toBe('Decide the relationship, not the bid.')
    expect(kestrel.door.to).toBe('/bids?tab=bid-board')
    expect(row('acme').winsLabel).toBe('no decided bids · all bids together, 14%')
    expect(row('acme').paceLabel).toBe('no answers on record, 45 d assumed')
  })

  it('flips to open dollars and names the inversion', () => {
    const byOpen = sortSalesRows(desk.rows, 'open')
    expect(byOpen.map((r) => r.key)).toEqual(['birch', 'sycamore', 'alder', 'kestrel', 'maple', 'estimates', 'rest', 'acme', 'beta'])
    expect(sortSalesRows(desk.rows, 'expected').map((r) => r.key)).toEqual(desk.rows.map((r) => r.key))
    expect(salesFlipNote(desk.rows, 'expected')).toBeNull()
    expect(salesFlipNote(desk.rows, 'open')).toBe('By open dollars Birch & Assoc. leads. Their 9% won rate says otherwise. Press again.')
    expect(salesSortButtonLabel('expected')).toBe('Ranked by what each ask is worth. Press to rank by open dollars.')
    expect(salesSortButtonLabel('open')).toBe('Ranked by open dollars. Press to rank by what each ask is worth.')
    // One row leads both ways: the note says so in the same plain words.
    expect(salesFlipNote([row('sycamore')], 'open')).toBe('By open dollars Sycamore GC leads, and by what the asks are worth too.')
    expect(salesFlipNote([row('rest'), row('acme')], 'open')).toBe('By open dollars Everyone else leads. What the asks are worth says otherwise. Press again.')
  })

  it('writes the tiles, the headline, the verdict and the sub-line', () => {
    expect(desk.tiles[0]).toMatchObject({ head: 'What the pile is worth', value: '≈ $232k', words: 'Open dollars flatter the pile. Say the $232k, never the $3.0M.' })
    expect(desk.tiles[1]).toMatchObject({ head: 'Past their usual answer', value: '$59.4k on 3 calls', words: "These asks are past the asker's usual answer. A call decides the ask or starts its clock again.", tone: 'amber' })
    expect(desk.tiles[2]).toMatchObject({ head: 'What makes the rates less sure', value: '2 + 4', words: '2 bids have no value and 4 losses carry no reason. Both make every rate here less sure.', tone: 'red' })
    expect(desk.headline).toBe('$3.0M asked. Worth about $232k.')
    expect(desk.verdict).toBe('3 calls this week protect $59.4k of what the pile is worth.')
    expect(desk.ruleLines).toEqual(['Every number here is what the ask is worth.', "That is the ask times the asker's own won rate.", 'It fades to nothing by twice their usual answer.'])
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
    expect(f.blind).toBe('4 losses carry no reason, so the reasons read low.')
    expect(f.lines[6]!.label).toBe('No reason written')
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
    const many = Array.from({ length: 10 }, (_, i) => ({ ...decided('birch', 'lost', 10_000 * (i + 1), 20), bidNumber: String(500 + i), projectName: `Lot ${i + 1}` }))
    const capped = buildSalesDesk({ ...input, decidedBids: many }).funnel
    expect(capped.noReason.count).toBe(10)
    expect(capped.noReasonBids).toHaveLength(SALES_NO_REASON_SHOWN)
    expect(capped.noReasonBids[0]!.label).toBe('B509 · Lot 10')
    expect(capped.noReasonBids[7]!.label).toBe('B502 · Lot 3')
    expect(capped.blind).toBe('10 losses carry no reason, so the reasons read low.')
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
    expect(empty.verdict).toBe("No ask is past its asker's usual answer this week.")
    expect(empty.headline).toBe('$0 asked. Worth about $0.')
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
    { ...open('r2', 'sycamore', 'River annex', 100_000, 5), customerId: 'cust-river' },
    { ...open('o1', null, 'Oak shell', 50_000, 3), customerId: 'cust-oak' },
    open('n1', null, 'No one', 20_000, 4),
    open('s1', 'sycamore', 'Sycamore only', 80_000, 6),
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
    expect(by('sycamore').bids.map((b) => b.id)).toEqual(['s1'])
    expect(by('sycamore').customerId).toBeNull()
    expect(by('none').name).toBe('No GC on the bid')
    expect(by('none').isGc).toBe(false)
    expect(d.howItReads).toContain('An asker is the customer on the bid, the GC the bid form names. A bid with no customer reads its GC builder, or folds into No GC on the bid.')
    // A customer with no name on record reads as such.
    const unnamed = buildSalesDesk({ ...input, openBids: [{ ...open('u1', null, 'Unnamed', 10_000, 2), customerId: 'cust-ghost' }], decidedBids: [], gcNames: new Map() })
    expect(unnamed.askers[0]!.name).toBe('A GC with no name on record')
    plain(d.howItReads)
  })
})

describe('a win is a mark (the owner’s rule, 2026-11-11)', () => {
  // Delta: one marked won, one a job was made from with no mark, one marked started, one marked lost with a job, two lost.
  const jobOnly: SalesDecidedBid = { ...decided('delta', 'lost', 120_000, 0), outcome: null, outcomeYmd: null, jobCreatedYmd: ago(90) }
  const started: SalesDecidedBid = { ...decided('delta', 'won', 80_000, 20), outcome: 'started_or_complete' }
  const lostWithJob: SalesDecidedBid = { ...decided('delta', 'lost', 50_000, 15, 'price'), jobCreatedYmd: ago(95) }
  const deltaDecided: SalesDecidedBid[] = [decided('delta', 'won', 100_000, 14), jobOnly, started, lostWithJob, decided('delta', 'lost', 150_000, 16, 'no_answer'), decided('delta', 'lost', 100_000, 30)]
  const d = buildSalesDesk({ ...input, openBids: [open('dl1', 'delta', 'Delta shell', 200_000, 5)], decidedBids: deltaDecided, gcNames: new Map([['delta', 'Delta Build']]) })

  it('counts a bid as won only when it is marked won or started, and a job made from a bid decides nothing', () => {
    expect(isWin({ outcome: null })).toBe(false)
    expect(isWin({ outcome: 'started_or_complete' })).toBe(true)
    expect(isWin({ outcome: 'won' })).toBe(true)
    expect(isWin({ outcome: 'lost' })).toBe(false)
    // A job made from the bid moves neither answer.
    expect(isWin(jobOnly)).toBe(false)
    expect(isWin(lostWithJob)).toBe(false)
    expect(isMarked(jobOnly)).toBe(false)
    expect(isMarked(lostWithJob)).toBe(true)
    expect(decidedYmd({ outcomeYmd: null, jobCreatedYmd: ago(9) })).toBe(ago(9))
    expect(decidedYmd({ outcomeYmd: ago(3), jobCreatedYmd: ago(9) })).toBe(ago(3))
    expect(decidedYmd({ outcomeYmd: null })).toBeNull()
    // The bid with a job and no mark is in no record: five decided, two won. The lost bid with a job stays lost.
    const delta = d.askers.find((a) => a.key === 'delta')!
    expect(delta.decided).toEqual({ count: 5, won: 2, wonUsd: 180_000, lostUsd: 300_000 })
    expect(delta.rate).toBeCloseTo(180_000 / 480_000, 6)
    expect(delta.rateSource).toBe('own')
    expect(delta.deadWeight).toBe(false)
    // The paces: 14, 20, 15, 16 and 30, a median of 16. The unmarked bid's job gives no pace.
    expect(delta.paceDays).toBe(16)
    expect(d.companyPaceDays).toBe(16)
    expect(d.funnel.won).toEqual({ count: 2, usd: 180_000 })
    expect(d.funnel.lost).toEqual({ count: 3, usd: 300_000 })
    expect(d.funnel.words[0]).toBe('Won $180k on 2 bids. Lost $300k on 3 bids.')
    expect(d.funnel.lines.map((l) => [l.key, l.count, l.usd])).toEqual([
      ['won', 2, 180_000],
      ['price', 1, 50_000],
      ['no_answer', 1, 150_000],
      ['none', 1, 100_000],
    ])
    // It is not a loss with no reason either.
    expect(d.funnel.noReasonBids.map((b) => b.usd)).toEqual([100_000])
    expect(d.howItReads).toContain('A bid counts as won only when it is marked won, or marked started or complete. A job made from a bid does not make it won. A bid counts as lost only when it is marked lost. The rate is won dollars over won and lost dollars.')
    expect(d.howItReads).toContain('A marked bid with no answer day reads the day its job was made.')
    plain(d.howItReads)
  })

  it('reads an asker whose only decided bids are jobs with no mark as having no record', () => {
    const only = buildSalesDesk({ ...input, openBids: [open('dl1', 'delta', 'Delta shell', 200_000, 5)], decidedBids: [jobOnly, { ...jobOnly, id: 'j2' }], gcNames: new Map([['delta', 'Delta Build']]) })
    const delta = only.askers[0]!
    expect(delta.decided).toEqual({ count: 0, won: 0, wonUsd: 0, lostUsd: 0 })
    expect(delta.rateSource).toBe('window')
    expect(delta.paceSource).toBe('assumed')
    expect(only.funnel.won.count + only.funnel.lost.count).toBe(0)
    expect(only.companyPaceSource).toBe('assumed')
    // A marked bid with neither day on record still counts in the rate and gives no pace.
    const noDay = buildSalesDesk({ ...input, openBids: [open('x1', 'x', 'X', 10_000, 1)], decidedBids: [{ ...decided('x', 'won', 10_000, 5), outcomeYmd: null }], gcNames: new Map() })
    expect(noDay.askers[0]!.decided.won).toBe(1)
    expect(noDay.askers[0]!.paceSource).toBe('assumed')
  })
})

describe('an asker with few marked bids is read at the won rate for bids the size of each ask (punch list #318)', () => {
  // The won rate for each size of bid, smallest first, as `bidWins.ts` hands them over. Made-up rates.
  const bidSizeRates = [
    { underUsd: 10_000, rate: 0.4 },
    { underUsd: 50_000, rate: 0.2 },
    { underUsd: 500_000, rate: 0.05 },
    { underUsd: Infinity, rate: null },
  ]
  // Alder has no marked bid. Birch has five, one won of five equal bids: its own 20%.
  const birchRecord = [decided('birch', 'won', 50_000, 20), ...[1, 2, 3, 4].map(() => decided('birch', 'lost', 50_000, 20, 'price'))]
  const fresh = [open('a1', 'alder', 'Small ask', 8_000, 3), open('a2', 'alder', 'Mid ask', 30_000, 3), open('a3', 'alder', 'Large ask', 200_000, 3), open('a4', 'alder', 'Giant ask', 900_000, 3), open('b1', 'birch', 'Their ask', 200_000, 3)]
  const names = new Map([
    ['alder', 'Alder Build'],
    ['birch', 'Birch Homes'],
  ])
  const sized = buildSalesDesk({ todayYmd: TODAY, openBids: fresh, decidedBids: birchRecord, gcNames: names, openEstimates: [], fallbackRate: 0.1, bidSizeRates, estimateShare: null })
  const rowOf = (d: typeof sized, key: string) => d.rows.find((r) => r.key === key)!

  it('reads each ask at its own size’s rate, and an ask no size has a rate for at all bids together', () => {
    // 8k at 40%, 30k at 20%, 200k at 5%, and 900k at the 10% of all bids together. Every ask is three days out, so none has faded.
    expect(rowOf(sized, 'alder').expectedUsd).toBeCloseTo(8_000 * 0.4 + 30_000 * 0.2 + 200_000 * 0.05 + 900_000 * 0.1, 6)
    expect(rowOf(sized, 'alder').winsLabel).toBe('no decided bids · read at the rate for bids this size')
    // An asker read by size has no one rate to print.
    expect(rowOf(sized, 'alder').rate).toBeNull()
  })

  it('leaves an asker with enough marked bids on their own record', () => {
    expect(rowOf(sized, 'birch').expectedUsd).toBeCloseTo(200_000 * 0.2, 6)
    expect(rowOf(sized, 'birch').winsLabel).toBe('1 of 5 · 20%')
    expect(rowOf(sized, 'birch').rate).toBe(0.2)
  })

  it('falls back to all bids together when no rate by size is handed over, as before', () => {
    const flat = buildSalesDesk({ todayYmd: TODAY, openBids: fresh, decidedBids: birchRecord, gcNames: names, openEstimates: [], fallbackRate: 0.1, estimateShare: null })
    expect(rowOf(flat, 'alder').expectedUsd).toBeCloseTo((8_000 + 30_000 + 200_000 + 900_000) * 0.1, 6)
    expect(rowOf(flat, 'alder').winsLabel).toBe('no decided bids · all bids together, 10%')
  })

  it('says the rule in the footnote, in plain words', () => {
    const line = 'An asker with fewer than 5 marked bids has each ask read at the won rate for bids its size.'
    expect(sized.howItReads).toContain(line)
    expect(sized.howItReads).toContain('A bid a job was made from stays in the pile until it is marked.')
    expect(sized.howItReads).not.toContain('all bids together')
    plain(sized.howItReads)
    plain(rowOf(sized, 'alder').say)
  })
})

describe('the words on the page', () => {
  // Every string a typical desk prints, with the estimates' history and the flip both ways.
  const typical = buildSalesDesk({ ...input, estimateHistory: [...speedHistory('ratio'), ...accepts] })
  const sentences = [
    typical.headline,
    typical.verdict,
    ...typical.ruleLines,
    ...salesSubLines(typical, { soldPerWeekUsd: 50_400, fieldPerWeekUsd: 52_900 }),
    ...typical.tiles.map((t) => t.words),
    ...typical.legend.map((l) => l.words),
    typical.offPile.words ?? '',
    ...typical.rows.flatMap((r) => [...r.story, r.say ?? '', r.move]),
    ...typical.funnel.words,
    typical.funnel.blind ?? '',
    salesSortButtonLabel('expected'),
    salesSortButtonLabel('open'),
    salesFlipNote(typical.rows, 'open') ?? '',
    typical.howItReads,
  ].filter(Boolean)
  // The labels: a few words each, where a dot between two figures is a cell wall and not glue.
  const labels = [...typical.tiles.flatMap((t) => [t.head, t.value]), ...typical.legend.map((l) => l.label), ...typical.rows.flatMap((r) => [r.name, r.meta, r.winsLabel, r.paceLabel, r.state.label, r.door.label]), ...typical.funnel.lines.map((l) => l.label)]

  it('writes every sentence of a typical desk in plain words', () => {
    expect(sentences.length).toBeGreaterThan(40)
    for (const text of sentences) expect(plainWordsFailures(text), text).toEqual([])
  })

  it('uses none of the words a first reader cannot use, and names no column', () => {
    for (const text of [...sentences, ...labels]) {
      expect(text, text).not.toMatch(/expected dollars|of expected|win share|win rate|rides? at|evaporating|dead weight|at risk|protected|under-reads|\bpace\b/i)
      expect(text, text).not.toMatch(/[a-z]_[a-z]/)
    }
    expect(typical.legend.map((l) => l.key)).toEqual(['protected', 'risk', 'evaporating', 'dead'])
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
    expect(floored.howItReads).toContain('The estimates answer in 0 days, the middle number from sent to accepted. They fade at a 7 day floor instead. Under it a same day answer would read every open estimate as late and worth $0. The floor is an owner call.')
    plain(floored.howItReads)
    plain(est.paceLabel)
  })

  it('floors the company pace the same way when it stands in, and leaves a pace at or above the floor as read', () => {
    const quick = buildSalesDesk({ ...input, decidedBids: [decided('sycamore', 'won', 1, 2), decided('sycamore', 'lost', 1, 3), decided('sycamore', 'won', 1, 2)] })
    expect(quick.companyPaceDays).toBe(2)
    expect(quick.estimatesPaceSource).toBe('company')
    expect(quick.estimatesPaceFloored).toBe(true)
    expect(quick.estimatesPaceDays).toBe(7)
    const est = quick.rows.find((r) => r.key === 'estimates')!
    expect(est.paceLabel).toBe('fade at a 7 d floor, no estimate answers yet')
    expect(quick.howItReads).toContain("No estimate has an answer on record yet, so the company's 2 day answer would stand in. They fade at a 7 day floor instead. Under it a same day answer would read every open estimate as late and worth $0. The floor is an owner call.")
    plain(quick.howItReads)
    plain(est.paceLabel)
    const atFloor = buildSalesDesk({ ...input, estimateHistory: [answered('customer_accepted', true, 7)] })
    expect(atFloor.estimatesPaceFloored).toBe(false)
    expect(atFloor.estimatesPaceDays).toBe(7)
    expect(atFloor.rows.find((r) => r.key === 'estimates')!.paceLabel).toBe("fade at the estimates' ~7 d usual answer")
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
    expect(est.paceLabel).toBe("fade at the estimates' ~10 d usual answer")
    // Ages 0 to 10 hold, 11 to 19 fade by a tenth a day, 20 and past read 0: 14.5 whole estimates' worth at 37%.
    expect(withPace.bar.evaporatingUsd).toBeCloseTo(3_000 * 0.37 * 14.5, 3)
    expect(withPace.howItReads).toContain("They fade at the estimates' own 10 day answer, the middle number from sent to accepted.")
    expect(withPace.howItReads).not.toContain('floor')
    expect(withPace.howItReads).toContain('The line about speed reads once 5 answered estimates went out the same day and 5 later.')
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
