import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { MARKET_BOOK_ROWS, MARKET_DEAD_WEIGHT_BIDS, MARKET_DESK_WEEKS, MARKET_FADING_SHARE, MARKET_NEW_NAME_DAYS, bidAnswered, bidWon, buildMarketDesk, foldMarketRecord, marketAskerId, marketHeader, marketVerdict, type MarketDeskBid, type MarketDeskEstimate, type MarketDeskInput } from './marketDesk'

const TODAY = '2026-10-26'
const WINDOW_START = '2026-08-31'
const md = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const plain = (s: string) => expect(plainWordsFailures(s), s).toEqual([])
const addDays = (ymd: string, n: number): string => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

let seq = 0
const bid = (gcId: string | null, createdYmd: string, usd: number, over: Partial<MarketDeskBid> = {}): MarketDeskBid => ({ id: `b${++seq}`, createdYmd, sentYmd: addDays(createdYmd, 3), usd, outcome: null, outcomeYmd: null, jobCreatedYmd: null, gcId, projectName: null, ...over })
/** A bid answered `days` after it was sent. */
const answered = (gcId: string, createdYmd: string, usd: number, outcome: 'won' | 'lost', days: number): MarketDeskBid => bid(gcId, createdYmd, usd, { outcome, outcomeYmd: addDays(addDays(createdYmd, 3), days) })
const est = (createdYmd: string, usd: number, status = 'sent'): MarketDeskEstimate => ({ id: `e${++seq}`, createdYmd, sentYmd: addDays(createdYmd, 1), status, usd, acceptedYmd: status === 'customer_accepted' ? addDays(createdYmd, 5) : null, updatedYmd: addDays(createdYmd, 5) })

/** The mock-up's book: Burd feeding, ATI feeding, Summit feeding with 3 $0 bids, MK fading, Pell fading, Hargrove a new name, Knight dead weight, the customers' estimates. */
function fixture(): MarketDeskInput {
  seq = 0
  const bids: MarketDeskBid[] = [
    // Burd: 19 bids at $58k. Last quarter 9 (2 won, 6 lost, 1 open), this quarter 10 open. One bid before the span for the pace read.
    answered('gc-burd', '2026-05-05', 58_000, 'won', 24),
    answered('gc-burd', '2026-05-12', 58_000, 'lost', 24),
    answered('gc-burd', '2026-05-19', 58_000, 'lost', 24),
    answered('gc-burd', '2026-06-02', 58_000, 'won', 24),
    answered('gc-burd', '2026-06-09', 58_000, 'lost', 24),
    answered('gc-burd', '2026-06-16', 58_000, 'lost', 24),
    answered('gc-burd', '2026-07-07', 58_000, 'lost', 24),
    answered('gc-burd', '2026-07-14', 58_000, 'lost', 24),
    bid('gc-burd', '2026-07-21', 58_000),
    ...['2026-08-04', '2026-08-11', '2026-08-18', '2026-09-01', '2026-09-08', '2026-09-15', '2026-10-06', '2026-10-13', '2026-10-20', '2026-10-22'].map((d) => bid('gc-burd', d, 58_000)),
    answered('gc-burd', '2026-03-01', 58_000, 'won', 24),
    // ATI: 6 bids at $80k, one won and one lost at 35 days.
    answered('gc-ati', '2026-05-20', 80_000, 'won', 35),
    answered('gc-ati', '2026-06-20', 80_000, 'lost', 35),
    bid('gc-ati', '2026-07-20', 80_000),
    bid('gc-ati', '2026-08-20', 80_000),
    bid('gc-ati', '2026-09-20', 80_000),
    bid('gc-ati', '2026-10-20', 80_000),
    // Summit: growing, one won at 19 days, three bids sent at $0.
    bid('gc-summit', '2026-06-01', 60_000),
    answered('gc-summit', '2026-07-01', 60_000, 'won', 19),
    bid('gc-summit', '2026-08-10', 70_000),
    bid('gc-summit', '2026-09-10', 70_000),
    bid('gc-summit', '2026-10-01', 70_000),
    bid('gc-summit', '2026-10-19', 70_000),
    bid('gc-summit', '2026-09-20', 0),
    bid('gc-summit', '2026-10-05', 0),
    bid('gc-summit', '2026-10-21', 0),
    // MK Builders: $200k last quarter, one $30k bid this quarter on Aug 17, then quiet.
    answered('gc-mk', '2026-05-15', 70_000, 'won', 31),
    answered('gc-mk', '2026-06-15', 70_000, 'lost', 31),
    bid('gc-mk', '2026-07-15', 60_000),
    bid('gc-mk', '2026-08-17', 30_000),
    // Pell: one bid in June, nothing since.
    bid('gc-pell', '2026-06-10', 12_000),
    // Hargrove: first-ever bid Oct 9.
    bid('gc-hargrove', '2026-10-09', 85_000),
    // Knight: six priced bids, none answered, the last on Aug 31.
    ...['2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-08-24', '2026-08-31'].map((d) => bid('gc-knight', d, 40_000)),
  ]
  const estimates: MarketDeskEstimate[] = [est('2026-05-20', 3_000, 'customer_accepted'), est('2026-06-10', 3_000, 'declined'), est('2026-07-01', 3_000), est('2026-07-20', 3_000), est('2026-08-05', 3_000), est('2026-08-25', 3_000), est('2026-09-10', 3_000, 'customer_accepted'), est('2026-09-25', 3_000), est('2026-10-10', 3_000), est('2026-10-24', 3_000)]
  return {
    todayYmd: TODAY,
    windowStart: WINDOW_START,
    bids,
    estimates,
    gcNames: new Map([
      ['gc-burd', 'Burd & Assoc.'],
      ['gc-ati', 'ATI'],
      ['gc-summit', 'Summit GC'],
      ['gc-mk', 'MK Builders'],
      ['gc-pell', 'Pell Homes'],
      ['gc-hargrove', 'Hargrove Construction'],
      ['gc-knight', 'Knight Contracting'],
    ]),
    firstBidYmdByGc: new Map([
      ['gc-burd', '2024-02-01'],
      ['gc-ati', '2025-03-03'],
      ['gc-summit', '2025-11-11'],
      ['gc-mk', '2024-06-06'],
      ['gc-pell', '2026-06-10'],
      ['gc-hargrove', '2026-10-09'],
      ['gc-knight', '2025-01-10'],
    ]),
    winShare: 0.14,
    fieldPerWeekUsd: 52_900,
    dayLabel: md,
  }
}

describe('marketDesk (v2.5931)', () => {
  it('holds the owner calls at their defaults', () => {
    expect(MARKET_DESK_WEEKS).toBe(26)
    expect(MARKET_FADING_SHARE).toBe(0.5)
    expect(MARKET_DEAD_WEIGHT_BIDS).toBe(6)
    expect(MARKET_NEW_NAME_DAYS).toBe(91)
  })

  it('draws the strip: 26 pay weeks ending with the current one, each cell summed by source with its label', () => {
    const d = buildMarketDesk(fixture())
    expect(d.spanStart).toBe('2026-05-03')
    expect(d.weeks).toHaveLength(26)
    expect(d.weeks[0]!.start).toBe('2026-05-03')
    expect(d.weeks[25]!).toMatchObject({ start: '2026-10-25', end: '2026-10-31', isCurrent: true })
    // The week of Oct 18: Burd Oct 20 and 22, ATI Oct 20, Summit Oct 19 and a $0 bid Oct 21, an estimate Oct 24.
    expect(d.weeks[24]!).toMatchObject({ start: '2026-10-18', gcUsd: 266_000, customerUsd: 3_000, totalUsd: 269_000, asks: 6 })
    expect(d.weeks[24]!.ariaLabel).toBe('Week of Oct 18: $269k asked, $266k from GCs, $3k from customers')
    expect(d.weeks[25]!.ariaLabel).toBe('Week of Oct 25: $0 asked so far, $0 from GCs, $0 from customers')
    const empty = d.weeks.filter((w) => !w.isCurrent && w.totalUsd === 0).length
    expect(empty).toBeGreaterThan(0)
    expect(d.emptyWeeksNote).toBe(`${empty} empty ${empty === 1 ? 'week' : 'weeks'} since May.`)
    expect(d.legend.gc).toBe('GC asks $2.5M in 26 weeks.')
    expect(d.legend.customers).toBe('Customer requests $30k.')
  })

  it('reads the headline from the card’s 8-week pace, the feed line from the field over the win share', () => {
    const d = buildMarketDesk(fixture())
    // The window from Aug 31: Burd 7 × 58k, ATI 2 × 80k, Summit 3 × 70k, Hargrove 85k, Knight 40k, 4 estimates: $913k over 8 weeks.
    expect(Math.round(d.askedPerWeekUsd)).toBe(114_125)
    expect(d.headline).toBe('About $114k a week asked, short of the field')
    expect(d.subLine).toBe('That is worth about $16k a week at the 14% win share. The field builds $52.9k a week. Feeding it takes about $378k a week asked, or a better share.')
    expect(Math.round(d.feedUsd as number)).toBe(377_857)
    expect(d.feedMissing).toBeNull()
    const enough = marketHeader({ askedPerWeekUsd: 500_000, winShare: 0.2, fieldPerWeekUsd: 50_000 })
    expect(enough.headline).toBe('About $500k a week asked, enough for the field')
    const noShare = marketHeader({ askedPerWeekUsd: 100_000, winShare: null, fieldPerWeekUsd: 50_000 })
    expect(noShare.headline).toBe('About $100k a week asked')
    expect(noShare.subLine).toContain('The win share is not readable yet.')
    expect(noShare.feedUsd).toBeNull()
    const noField = buildMarketDesk({ ...fixture(), fieldPerWeekUsd: null })
    expect(noField.feedUsd).toBeNull()
    expect(noField.feedMissing).toBe('The feed line needs the field’s pace. Build has not read yet.')
    plain(enough.subLine)
    plain(noShare.subLine)
    plain(noField.subLine)
    plain(noField.feedMissing as string)
  })

  it('names the states, sorts the book and words each row', () => {
    const d = buildMarketDesk(fixture())
    expect(d.rows.map((r) => [r.name, r.state])).toEqual([
      ['Burd & Assoc.', 'feeding'],
      ['ATI', 'feeding'],
      ['Summit GC', 'feeding'],
      ['Customers (estimates)', 'feeding'],
      ['Hargrove Construction', 'new name'],
      ['MK Builders', 'fading'],
      ['Pell Homes', 'fading'],
      ['Knight Contracting', 'dead weight'],
    ])
    const [burd, ati, summit, customers, hargrove, mk, pell, knight] = d.rows
    expect(burd!).toMatchObject({ askedWords: '$1.1M · 19 bids', paysWords: '$116k', wonCount: 2, answered: 8, desc: 'GC · last ask Oct 22' })
    expect(burd!.detLine).toBe('Won 2 of 8 answered. 11% by value. Answers in about 24 days, as recorded. Last ask Oct 22.')
    expect(burd!.quarters.map((q) => [q.label, q.askedUsd, q.wonWords])).toEqual([
      ['Last quarter', 522_000, '$116k'],
      ['This quarter so far', 580_000, 'awaiting'],
    ])
    expect(burd!.door).toEqual({ href: '/bids?tab=bid-board', label: 'Open their bids' })
    expect(ati!.detLine).toBe('Won 1 of 2 answered. 17% by value. Answers in about 35 days, as recorded. Last ask Oct 20.')
    expect(summit!).toMatchObject({ askedWords: '$400k · 9 bids', paysWords: '$60k', zeroBids: 3, pricedBids: 6, desc: 'GC · last ask Oct 21 · 3 bids ride at $0' })
    expect(summit!.detLine).toBe('Won 1 of 1 answered. 15% by value. Answers in about 19 days, as recorded. 3 bids have no value yet. They hide what Summit GC asks. Last ask Oct 21.')
    expect(customers!).toMatchObject({ kind: 'customers', askedWords: '$30k · 10 requests', paysWords: '$6k', door: { href: '/estimates', label: 'Open Estimates' } })
    expect(customers!.detLine).toBe('Small and many. Worked from the Estimates page, not from this book. Won 2 of 3 answered. 20% by value. Last ask Oct 24.')
    expect(hargrove!.detLine).toBe('Nothing answered yet. First bid ever on Oct 9. First answers say what the relationship is. Last ask Oct 9.')
    expect(mk!).toMatchObject({ askedWords: '$230k · 4 bids', paysWords: '$70k', desc: 'GC · 10 weeks quiet' })
    expect(mk!.detLine).toBe('Won 1 of 2 answered. 30% by value. Answers in about 31 days, as recorded. Quiet for 10 weeks.')
    expect(pell!.detLine).toBe('Nothing answered yet. Quiet for 19 weeks.')
    expect(knight!).toMatchObject({ askedWords: '$240k · 6 bids', paysWords: '—', pricedBids: 6, answered: 0, neverAnswered: false, desc: 'GC · 8 weeks quiet' })
    expect(knight!.detLine).toBe('Nothing answered yet. 6 priced bids in 26 weeks, nothing won, nothing answered. Pricing them costs days the live GCs wait on. Last ask Aug 31.')
    expect(d.restLine).toBeNull()
  })

  it('reads the three tiles: asked this quarter, the top three’s share, the new names', () => {
    const d = buildMarketDesk(fixture())
    const [asked, carry, names] = d.tiles
    expect(asked).toEqual({ head: 'Asked of us, this quarter', value: '$1.4M', delta: '▲ +10%', deltaTone: 'green', words: 'Against $1.2M in the 13 weeks before. More is arriving.' })
    expect(carry).toEqual({ head: 'Three GCs carry', value: '82%', delta: '▲ from 79%', deltaTone: 'red', words: 'Burd & Assoc., Summit GC and ATI. The book is narrowing.' })
    expect(names).toEqual({ head: 'New names', value: '1', delta: null, deltaTone: 'plain', words: '1 this quarter. Last quarter had 1. Hargrove Construction, first invite Oct 9. A new name is the only courting result the app can see.' })
  })

  it('writes the verdict from the quiet GCs and the GC with the most $0 bids, the pricing spend, and the $0 count', () => {
    const d = buildMarketDesk(fixture())
    expect(d.verdict).toBe('Call the 2 quiet GCs and put a value on Summit GC’s 3 bids. That is this week’s lever.')
    expect(d.pricingSpend).toEqual(['Knight Contracting has taken 6 priced bids for $0 won and no answer in 26 weeks. Each one cost pricing days the live GCs waited on. Keep pricing them or stop. The book will show the answer either way.'])
    expect(d.zeroBids).toEqual({ count: 3, words: '3 bids ride at $0. They hide what their GCs ask and thin the win share. Put the number on each.' })
    expect(marketVerdict([{ kind: 'gc', name: 'MK Builders', state: 'fading', zeroBids: 0 }])).toBe('Call MK Builders. That is this week’s lever.')
    expect(marketVerdict([{ kind: 'gc', name: 'Summit GC', state: 'feeding', zeroBids: 1 }])).toBe('Put a value on Summit GC’s bid. That is this week’s lever.')
    expect(marketVerdict([{ kind: 'gc', name: 'ATI', state: 'feeding', zeroBids: 0 }])).toBe('The asks are steady. Keep the book warm.')
    const steady = buildMarketDesk({ ...fixture(), bids: fixture().bids.filter((b) => b.gcId !== 'gc-knight' && !(b.usd === 0)) })
    expect(steady.pricingSpend).toEqual([])
    expect(steady.zeroBids).toBeNull()
  })

  it('says never answered only when the lifetime read shows no answer on record', () => {
    const base = fixture()
    const knightOf = (lifetimeByGc: MarketDeskInput['lifetimeByGc']) => {
      const d = buildMarketDesk({ ...base, lifetimeByGc })
      return { d, knight: d.rows.find((r) => r.key === 'gc:gc-knight')! }
    }
    // The whole record shows no answer: the words say ever.
    const never = knightOf(new Map([['gc-knight', { bids: 11, answered: 0, won: 0 }]]))
    expect(never.knight).toMatchObject({ state: 'dead weight', neverAnswered: true, desc: 'GC · 8 weeks quiet · has never answered a bid' })
    expect(never.knight.detLine).toBe('Nothing answered yet. 6 priced bids in 26 weeks and no answer, ever. Pricing them costs days the live GCs wait on. Last ask Aug 31.')
    expect(never.d.pricingSpend).toEqual(['Knight Contracting has taken 6 priced bids for $0 won and no answer, ever. Each one cost pricing days the live GCs waited on. Keep pricing them or stop. The book will show the answer either way.'])
    plain(never.knight.detLine)
    for (const p of never.d.pricingSpend) plain(p)
    // One answer years back: dead weight still, but the words stay with the span.
    const once = knightOf(new Map([['gc-knight', { bids: 11, answered: 1, won: 0 }]]))
    expect(once.knight).toMatchObject({ state: 'dead weight', neverAnswered: false, desc: 'GC · 8 weeks quiet' })
    expect(once.knight.detLine).toBe('Nothing answered yet. 6 priced bids in 26 weeks, nothing won, nothing answered. Pricing them costs days the live GCs wait on. Last ask Aug 31.')
    expect(once.d.pricingSpend).toEqual(['Knight Contracting has taken 6 priced bids for $0 won and no answer in 26 weeks. Each one cost pricing days the live GCs waited on. Keep pricing them or stop. The book will show the answer either way.'])
    // The read is in but Knight is not in it, or the read is absent: the span's words.
    expect(knightOf(new Map([['gc-burd', { bids: 40, answered: 0, won: 0 }]])).knight).toMatchObject({ neverAnswered: false, desc: 'GC · 8 weeks quiet' })
    expect(knightOf(undefined).knight).toMatchObject({ neverAnswered: false, desc: 'GC · 8 weeks quiet' })
    // A GC that is not dead weight never carries the claim, whatever its record says.
    const burd = buildMarketDesk({ ...base, lifetimeByGc: new Map([['gc-burd', { bids: 40, answered: 0, won: 0 }]]) }).rows.find((r) => r.key === 'gc:gc-burd')!
    expect(burd).toMatchObject({ state: 'feeding', neverAnswered: false, desc: 'GC · last ask Oct 22' })
  })

  it('keys the book by the bid’s customer, named from the customer list, with the GC list as the fallback', () => {
    // The bid form stores the GC as the bid's customer and leaves gc_builder_id null: the customer is the asker.
    expect(marketAskerId({ customerId: 'cust-burd', gcBuilderId: null })).toBe('cust-burd')
    expect(marketAskerId({ customerId: 'cust-ati', gcBuilderId: 'gc-ati' })).toBe('cust-ati')
    expect(marketAskerId({ customerId: null, gcBuilderId: 'gc-old' })).toBe('gc-old')
    expect(marketAskerId({ customerId: null, gcBuilderId: null })).toBeNull()
    const base = fixture()
    const burd = marketAskerId({ customerId: 'cust-burd', gcBuilderId: null }) as string
    const ati = marketAskerId({ customerId: 'cust-ati', gcBuilderId: 'gc-ati' }) as string
    const old = marketAskerId({ customerId: null, gcBuilderId: 'gc-old' }) as string
    const none = marketAskerId({ customerId: null, gcBuilderId: null })
    const bids = [answered(burd, '2026-08-03', 90_000, 'won', 20), bid(burd, '2026-10-05', 90_000), bid(ati, '2026-09-14', 40_000), bid(old, '2026-09-21', 25_000), bid(none, '2026-10-12', 10_000)]
    // One names map: the customers' names and the GC list's. A bid carrying both ids reads under its customer's name.
    const gcNames = new Map([
      ['gc-ati', 'ATI on the GC list'],
      ['gc-old', 'Old Line Builders'],
      ['cust-burd', 'Burd & Assoc.'],
      ['cust-ati', 'ATI'],
    ])
    const firstBidYmdByGc = new Map([
      ['cust-burd', '2024-02-01'],
      ['cust-ati', '2025-03-03'],
      ['gc-old', '2023-01-01'],
    ])
    const d = buildMarketDesk({ ...base, bids, estimates: [], gcNames, firstBidYmdByGc, lifetimeByGc: new Map([['cust-burd', { bids: 30, answered: 20, won: 6 }]]) })
    expect(d.rows.map((r) => [r.key, r.name, r.kind, r.state])).toEqual([
      ['gc:cust-burd', 'Burd & Assoc.', 'gc', 'feeding'],
      ['gc:cust-ati', 'ATI', 'gc', 'feeding'],
      ['gc:gc-old', 'Old Line Builders', 'gc', 'feeding'],
      ['no-gc', 'No GC on the bid', 'no-gc', 'feeding'],
    ])
    expect(d.rows[0]!).toMatchObject({ askedWords: '$180k · 2 bids', paysWords: '$90k', wonCount: 1, answered: 1 })
    expect(d.rows[0]!.detLine).toBe('Won 1 of 1 answered. 50% by value. Answers in about 20 days, as recorded. Last ask Oct 5.')
    expect(d.tiles[1]).toMatchObject({ head: 'Three GCs carry', value: '100%', words: 'Burd & Assoc., ATI and Old Line Builders. No last quarter to read against.' })
    for (const r of d.rows) plain(r.detLine)
    for (const tile of d.tiles) plain(tile.words)
  })

  it('counts a bid marked started or complete as won and answered, the Sales card’s rule', () => {
    expect(bidWon({ outcome: 'started_or_complete', jobCreatedYmd: null })).toBe(true)
    expect(bidAnswered({ outcome: 'started_or_complete', jobCreatedYmd: null })).toBe(true)
    expect(bidWon({ outcome: 'won', jobCreatedYmd: null })).toBe(true)
    expect(bidWon({ outcome: null, jobCreatedYmd: '2026-10-01' })).toBe(true)
    expect(bidWon({ outcome: 'lost', jobCreatedYmd: null })).toBe(false)
    expect(bidAnswered({ outcome: 'lost', jobCreatedYmd: null })).toBe(true)
    expect(bidWon({ outcome: null, jobCreatedYmd: null })).toBe(false)
    expect(bidAnswered({ outcome: null, jobCreatedYmd: null })).toBe(false)
    // Hargrove's second bid is marked started with no outcome day: won and answered, no answer pace.
    const f = fixture()
    f.bids.push(bid('gc-hargrove', '2026-10-15', 40_000, { outcome: 'started_or_complete' }))
    const hargrove = buildMarketDesk(f).rows.find((r) => r.key === 'gc:gc-hargrove')!
    expect(hargrove).toMatchObject({ state: 'new name', askedWords: '$125k · 2 bids', paysWords: '$40k', wonCount: 1, answered: 1 })
    expect(hargrove.detLine).toBe('Won 1 of 1 answered. 32% by value. First bid ever on Oct 9. First answers say what the relationship is. Last ask Oct 15.')
    expect(hargrove.quarters.map((q) => q.wonWords)).toEqual(['—', '$40k'])
    plain(hargrove.detLine)
  })

  it('folds the record by customer: the first bid and the lifetime read per asker', () => {
    const { firstBidYmdByGc, lifetimeByGc } = foldMarketRecord([
      // Burd is the customer on four bids, the GC list id on one of them: one won, one started, one lost, one open.
      { customerId: 'cust-burd', gcBuilderId: null, createdYmd: '2024-02-01', outcome: 'won' },
      { customerId: 'cust-burd', gcBuilderId: null, createdYmd: '2025-06-01', outcome: 'started_or_complete' },
      { customerId: 'cust-burd', gcBuilderId: null, createdYmd: '2026-10-01', outcome: null },
      { customerId: 'cust-burd', gcBuilderId: 'gc-burd', createdYmd: '2023-11-11', outcome: 'lost' },
      // Only the GC list id: the fallback key. A bid with no created day counts in the record, not the first day.
      { customerId: null, gcBuilderId: 'gc-old', createdYmd: '2025-01-10', outcome: null },
      { customerId: null, gcBuilderId: 'gc-old', createdYmd: null, outcome: 'lost' },
      // Neither: no asker, skipped.
      { customerId: null, gcBuilderId: null, createdYmd: '2026-09-09', outcome: 'won' },
    ])
    expect([...firstBidYmdByGc]).toEqual([
      ['cust-burd', '2023-11-11'],
      ['gc-old', '2025-01-10'],
    ])
    expect([...lifetimeByGc]).toEqual([
      ['cust-burd', { bids: 4, answered: 3, won: 2 }],
      ['gc-old', { bids: 2, answered: 1, won: 0 }],
    ])
    expect(firstBidYmdByGc.has('gc-burd')).toBe(false)
    expect(foldMarketRecord([])).toEqual({ firstBidYmdByGc: new Map(), lifetimeByGc: new Map() })
  })

  it('folds the smallest rows beyond the cap into one line, keeping the big quiet ones in the book', () => {
    const base = fixture()
    const f: MarketDeskInput = { ...base, gcNames: new Map([...base.gcNames, ['gc-zed', 'Zed Builders']]), firstBidYmdByGc: new Map([...base.firstBidYmdByGc, ['gc-zed', '2025-05-05']]) }
    f.bids.push(bid('gc-zed', '2026-09-01', 5_000))
    const d = buildMarketDesk(f)
    expect(d.rows).toHaveLength(MARKET_BOOK_ROWS)
    expect(d.rows.map((r) => r.name)).toContain('Knight Contracting')
    expect(d.rows.map((r) => r.name)).not.toContain('Zed Builders')
    expect(d.restLine).toBe('1 smaller GC holds the rest. $5k asked, $0 won. Steady, none quiet.')
    // Zed at $15k now outgrows Pell: the quiet $12k row folds instead, and the line says so.
    f.bids.push(bid('gc-zed', '2026-06-01', 10_000))
    const quiet = buildMarketDesk(f)
    expect(quiet.rows.map((r) => r.name)).not.toContain('Pell Homes')
    expect(quiet.restLine).toBe('1 smaller GC holds the rest. $12k asked, $0 won. 1 of them is quiet.')
    plain(quiet.restLine as string)
  })

  it('folds a bid with no GC into one row of its own', () => {
    const f = fixture()
    f.bids.push(bid(null, '2026-10-02', 20_000))
    const d = buildMarketDesk(f)
    const row = d.rows.find((r) => r.kind === 'no-gc')
    expect(row).toMatchObject({ name: 'No GC on the bid', desc: 'bids · last ask Oct 2', askedWords: '$20k · 1 bid' })
  })

  it('holds every sentence to plain words', () => {
    const d = buildMarketDesk(fixture())
    plain(d.headline)
    plain(d.verdict)
    plain(d.subLine)
    for (const t of d.tiles) plain(t.words)
    for (const r of d.rows) plain(r.detLine)
    for (const w of d.weeks) plain(w.ariaLabel)
    for (const p of d.pricingSpend) plain(p)
    plain(d.zeroBids!.words)
    plain(d.emptyWeeksNote as string)
    plain(d.legend.gc)
    plain(d.legend.customers)
    plain(d.cannotSee)
    plain(d.howItReads)
    plain(d.recordedLine)
    expect(d.howItReads).toContain('created_at')
    expect(d.howItReads).toContain('bid_date_sent')
    expect(d.howItReads).toContain('agreed_value or else bid_value')
    expect(d.howItReads).toContain('outcome and outcome_at')
    expect(d.howItReads).toContain('A bid is won when its outcome is won or started or complete, or when it became a job. A win counts at the bid’s value.')
    expect(d.howItReads).toContain('A GC is the bid’s customer, by customer_id, named from the customer list. A bid with no customer falls back to its gc_builder_id, named from the GC list.')
    expect(d.howItReads).toContain('total_cents')
    expect(d.howItReads).toContain(`${MARKET_DEAD_WEIGHT_BIDS} or more priced bids`)
    expect(d.howItReads).toContain('Never answered reads every bid on record for the GC, by the bid’s own outcome.')
    expect(d.howItReads).toContain(`${MARKET_NEW_NAME_DAYS} days`)
  })
})
