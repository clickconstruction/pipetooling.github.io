import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { buildBidWins, buildMarketWorth, type BidSent } from '../bidWins'
import { buildEstimateWins, type EstimateSent } from '../estimateWins'
import { buildMarketDesk, marketHeader, type MarketDeskBid, type MarketDeskEstimate } from './marketDesk'
import { MARKET_COUNTED_MAX_WORDS, MARKET_STEP_WORDS, buildMarketStep, marketCounted, marketErrorWords, marketSourceCount, marketStepRows } from './marketStepWindow'

const TODAY = '2026-10-26'
const WINDOW = '2026-08-31'
let seq = 0
const bid = (gcId: string | null, createdYmd: string, usd: number, over: Partial<MarketDeskBid> = {}): MarketDeskBid => ({ id: `b${++seq}`, createdYmd, sentYmd: createdYmd, usd, outcome: null, outcomeYmd: null, jobCreatedYmd: null, gcId, projectName: null, ...over })
const est = (createdYmd: string, usd: number): MarketDeskEstimate => ({ id: `e${++seq}`, createdYmd, sentYmd: createdYmd, status: 'sent', usd, acceptedYmd: null, updatedYmd: createdYmd })

/** Made-up sources: Ridgeway asks every month, Oak Hollow went quiet in June, Pine Fork sent a bid with no value. */
const names = new Map([
  ['gc-ridgeway', 'Ridgeway Builders'],
  ['gc-oak', 'Oak Hollow HOA'],
  ['gc-pine', 'Pine Fork Homes'],
])
const deskOf = (bids: MarketDeskBid[], fieldPerWeekUsd: number | null = 52_900) =>
  buildMarketDesk({ todayYmd: TODAY, windowStart: WINDOW, bids, estimates: [est('2026-09-10', 3_000)], gcNames: names, firstBidYmdByGc: new Map([...names.keys()].map((k) => [k, '2024-02-01'])), winShare: 0.14, fieldPerWeekUsd })
const deskBids = [
  bid('gc-ridgeway', '2026-05-05', 58_000, { outcome: 'won', outcomeYmd: '2026-05-29' }),
  bid('gc-ridgeway', '2026-09-01', 58_000),
  bid('gc-ridgeway', '2026-10-22', 58_000),
  bid('gc-oak', '2026-05-15', 70_000),
  bid('gc-oak', '2026-06-15', 70_000),
  bid('gc-pine', '2026-10-05', 0),
  bid('gc-pine', '2026-10-01', 70_000),
]
const desk = deskOf(deskBids)
const header = marketHeader({ askedPerWeekUsd: desk.askedPerWeekUsd, winShare: 0.14, fieldPerWeekUsd: 52_900 })

const sent = (sentYmd: string, usd: number, outcome: string | null = null): BidSent => ({ sentYmd, usd, outcome, hasJob: false, jobUsd: null })
/** Under $10k wins half and over $500k nothing. Two old bids carry no mark and count as 95% lost in their sizes. */
const bidWins = buildBidWins({
  todayYmd: TODAY,
  windowStart: WINDOW,
  bids: [
    sent('2026-09-08', 5_000, 'won'),
    sent('2026-09-09', 5_000, 'lost'),
    sent('2026-09-10', 10_000, 'won'),
    sent('2026-09-11', 30_000, 'lost'),
    sent('2026-09-12', 60_000, 'started_or_complete'),
    sent('2026-09-13', 540_000, 'lost'),
    sent('2026-09-14', 600_000, 'lost'),
    sent('2026-02-02', 40_000),
    sent('2026-03-03', 80_000),
    sent('2026-10-12', 120_000),
  ],
})
const estimate = (sentYmd: string, usd: number, status: string): EstimateSent => ({ sentYmd, usd, status, customerKey: null, addressKey: null })
const estimateWins = buildEstimateWins({ todayYmd: TODAY, windowStart: WINDOW, estimates: [estimate('2026-09-15', 6_000, 'customer_accepted'), estimate('2026-09-20', 2_000, 'declined'), estimate('2026-10-20', 8_000, 'sent')] })
const worth = buildMarketWorth(bidWins, estimateWins)

describe('the Market window on the step frame (punch list #318)', () => {
  it('leads with what Market is worth at the won rates against what the field builds', () => {
    const step = buildMarketStep({ header, desk, worth, bidWins, estimateWins })
    expect(step.byWonRates).toBe(true)
    const worthUsd = worth.perWeekUsd as number
    expect(worthUsd).toBeLessThan(52_900)
    expect(step.headline).toMatch(/^Market is worth \$[\d.]+k? a week\. The field builds \$52\.9k\.$/)
    expect(step.line).toMatch(/^That is \$[\d.]+k a week short of keeping the field busy\.$/)
    // Ahead of the field, and level with it.
    expect(buildMarketStep({ header, desk, worth, bidWins, estimateWins, fieldPerWeekUsd: 1_000 }).line).toMatch(/^That is \$[\d.]+k a week more than the field builds\.$/)
    expect(buildMarketStep({ header, desk, worth, bidWins, estimateWins, fieldPerWeekUsd: worthUsd }).line).toBe('That is what the field builds.')
    // The page's own figure wins over the header's.
    expect(buildMarketStep({ header, desk, worth, bidWins, estimateWins, fieldPerWeekUsd: 61_000 }).headline).toContain('The field builds $61k.')
  })

  it('says the two parts and draws a bar for each bid size on a true scale', () => {
    const step = buildMarketStep({ header, desk, worth, bidWins, estimateWins })
    expect(step.figures.map((f) => f.key)).toEqual(['bids', 'estimates'])
    expect(step.figures[0]!.words).toMatch(/^bids, at \d+% won$/)
    expect(step.figures[1]!.words).toBe('estimates, at 75% won')
    expect(step.figures[1]!.value).toBe('$1.5k')
    expect(step.bars.map((b) => [b.label, b.pct])).toEqual([
      ['Under $10k', '50%'],
      ['$10k to $50k', '13%'],
      ['$50k to $500k', '44%'],
      ['Over $500k', '0%'],
    ])
    for (const [i, b] of step.bars.entries()) expect(b.share).toBe(bidWins.sizes[i]!.rate)
    // A size with nothing won or lost has no bar to draw and says so with a dash.
    const thin = buildBidWins({ todayYmd: TODAY, windowStart: WINDOW, bids: [sent('2026-09-08', 5_000, 'won')] })
    expect(buildMarketStep({ header, desk, worth, bidWins: thin, estimateWins }).bars.map((b) => b.pct)).toEqual(['100%', '—', '—', '—'])
  })

  it('picks up to three things to do, the old bids first, each with one press', () => {
    const rows = buildMarketStep({ header, desk, worth, bidWins, estimateWins }).rows
    expect(rows.map((r) => r.key)).toEqual(['old-bids', 'call', 'value'])
    expect(rows[0]).toEqual({ key: 'old-bids', title: 'Mark 2 old bids won or lost', sub: 'Sent over 180 days ago, no mark. $120k.', press: { label: 'Open the Bid Board', to: '/bids?tab=bid-board', primary: true } })
    expect(rows[1]).toEqual({ key: 'call', title: 'Call Oak Hollow HOA', sub: 'Quiet 19 weeks. $140k asked in the last 26 weeks.', press: { label: 'Open their bids', to: '/bids?tab=bid-board' } })
    expect(rows[2]).toEqual({ key: 'value', title: 'Put a value on 1 bid', sub: 'A bid with no value counts for nothing.', press: { label: 'Open the bids', to: '/bids' } })
    expect(rows.filter((r) => r.press.primary)).toHaveLength(1)
    // No old bids, nobody quiet, every bid valued: nothing to do. While the sources read, only the old bids show.
    const steady = deskOf([bid('gc-ridgeway', '2026-10-22', 58_000)])
    expect(marketStepRows(steady, null)).toEqual([])
    expect(marketStepRows(null, bidWins).map((r) => r.key)).toEqual(['old-bids'])
    expect(marketStepRows(null, { noMarkOld: { count: 1, usd: 9_000 } })[0]!.title).toBe('Mark 1 old bid won or lost')
  })

  it('takes the field’s pace, the quiet weeks and the count of sources from fields, never from a sentence', () => {
    expect(header.fieldPerWeekUsd).toBe(52_900)
    expect(marketHeader({ askedPerWeekUsd: 1, winShare: 0.14, fieldPerWeekUsd: null }).fieldPerWeekUsd).toBeNull()
    // The words can say anything: the figures hold.
    const reworded = buildMarketStep({ header: { ...header, subLine: 'Nothing to read here.' }, desk: { ...desk, subLine: 'Nothing to read here.', restLine: null, rows: desk.rows.map((r) => ({ ...r, desc: '' })) }, worth, bidWins, estimateWins })
    expect(reworded.headline).toContain('The field builds $52.9k.')
    expect(reworded.rows[1]).toMatchObject({ title: 'Call Oak Hollow HOA', sub: 'Quiet 19 weeks. $140k asked in the last 26 weeks.' })
    expect(desk.rows.find((r) => r.name === 'Oak Hollow HOA')!.quietWeeks).toBe(19)
    expect(desk.rows.find((r) => r.name === 'Ridgeway Builders')!.quietWeeks).toBeNull()
    expect(marketSourceCount(desk)).toBe(4)
    // Past the rows the list shows, the smaller sources its last line folds are counted too.
    const many = deskOf(Array.from({ length: 11 }, (_, i) => bid(`gc-${i}`, '2026-10-01', 10_000 + i)))
    expect(many.rows).toHaveLength(8)
    expect(many.restCount).toBe(4)
    expect(marketSourceCount(many)).toBe(12)
    expect(buildMarketStep({ header, desk: many }).sourceCount).toBe(12)
  })

  it('falls back to the old headline until the won rates are read, and keeps the one win share out of the open view', () => {
    const step = buildMarketStep({ header, desk, worth: null, bidWins: null, estimateWins: null })
    expect(step.byWonRates).toBe(false)
    expect(step.headline).toBe(desk.headline)
    expect(step.line).toBe('The field builds $52.9k a week.')
    expect(step.figures).toEqual([])
    expect(step.bars).toEqual([])
    expect(buildMarketStep({ header, desk: null }).headline).toBe(header.headline)
    expect(buildMarketStep({ header: marketHeader({ askedPerWeekUsd: 1, winShare: null, fieldPerWeekUsd: null }), desk: null }).line).toBe('The field’s pace is not read yet.')
    // A worth with no rate behind either part is no worth.
    expect(buildMarketStep({ header, desk, worth: buildMarketWorth(null, null) }).byWonRates).toBe(false)
    // The worth known and the field not: the headline says the worth alone.
    const noField = buildMarketStep({ header: marketHeader({ askedPerWeekUsd: 1, winShare: 0.14, fieldPerWeekUsd: null }), desk: null, worth, bidWins, estimateWins })
    expect(noField.headline).toMatch(/^Market is worth \$[\d.]+k? a week\.$/)
    expect(noField.line).toBe('The field’s pace is not read yet.')
  })

  it('states the won rules in How this is counted in under 200 words, with no column names and no one win share once the worth is known', () => {
    const wordsOf = (sections: ReturnType<typeof marketCounted>, closing: string): number => [...sections.flatMap((c) => [c.head, c.words]), closing].join(' ').split(/\s+/).filter(Boolean).length
    const step = buildMarketStep({ header, desk, worth, bidWins, estimateWins })
    expect(step.counted.map((c) => [c.key, c.head])).toEqual([
      ['worth', 'What Market is worth'],
      ['sources', 'The list of sources'],
    ])
    expect(step.counted[0]!.words).toBe(
      'Market is worth what the bids and estimates sent can be expected to win a week. A bid counts as won or lost only when it is marked. With no mark it counts as 50% lost after 90 days and 95% lost after 180 days. Each bid is read at the won rate for bids its size. An estimate is lost when the customer declines it. It is also lost when the customer passes it over for another at the same address. It is also lost when the customer gives no answer for 90 days.',
    )
    // What a source is, what quiet means and the span the list covers come from the list's own kernel.
    expect(step.counted[1]!.words).toBe(desk.howItReads)
    expect(step.counted[1]!.words).toContain('The list covers the last 26 pay weeks, this week included. A source is the customer on a bid.')
    expect(step.counted[1]!.words).toContain('Quiet means no ask for 4 weeks or more.')
    const all = step.counted.map((c) => c.words).join(' ')
    expect(all).not.toMatch(/win share|Feeding it takes|became a job|job was made|[a-z]_[a-z]/)
    expect(MARKET_COUNTED_MAX_WORDS).toBe(200)
    expect(wordsOf(step.counted, desk.recordedLine)).toBeLessThan(MARKET_COUNTED_MAX_WORDS)
    // Before the won rates are read the fold says which rule the headline uses, in the same room.
    const before = marketCounted(false)
    expect(before[0]!.words.startsWith('The won rates are not read yet. Until they are, the headline judges the asks at one win share. A bid counts as won or lost only when it is marked.')).toBe(true)
    expect(before.map((c) => c.words).join(' ')).not.toMatch(/[a-z]_[a-z]/)
    expect(wordsOf(before, desk.recordedLine)).toBeLessThan(MARKET_COUNTED_MAX_WORDS)
  })

  it('holds every sentence it writes to the plain-words rule', () => {
    const steps = [buildMarketStep({ header, desk, worth, bidWins, estimateWins }), buildMarketStep({ header, desk, worth, bidWins, estimateWins, fieldPerWeekUsd: 1_000 }), buildMarketStep({ header, desk: null }), buildMarketStep({ header: marketHeader({ askedPerWeekUsd: 1, winShare: null, fieldPerWeekUsd: null }), desk: null, worth, bidWins, estimateWins })]
    const words: string[] = [MARKET_STEP_WORDS.nothingToDo, MARKET_STEP_WORDS.sourcesNote, MARKET_STEP_WORDS.asksNote, MARKET_STEP_WORDS.feedLineNote, marketErrorWords('The read timed out'), ...marketCounted(false).flatMap((c) => [c.head, c.words])]
    for (const s of steps) {
      if (s.byWonRates) words.push(s.headline)
      words.push(s.line)
      for (const r of s.rows) words.push(r.title, r.sub, r.press.label)
      for (const c of s.counted) words.push(c.head, c.words)
    }
    expect(words.flatMap((w) => plainWordsFailures(w))).toEqual([])
    expect(marketErrorWords('The read timed out')).toBe('The sources and the asks by week could not be read. The read timed out.')
    expect(marketErrorWords('Permission denied.')).toBe('The sources and the asks by week could not be read. Permission denied.')
  })
})
