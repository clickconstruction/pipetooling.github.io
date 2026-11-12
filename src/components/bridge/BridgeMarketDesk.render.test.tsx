// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeMarketDesk } from './BridgeMarketDesk'
import { buildMarketDesk, marketHeader, type MarketDeskBid, type MarketDeskEstimate } from '../../lib/bridge/market/marketDesk'
import { buildBidWins, buildMarketWorth, type BidSent } from '../../lib/bridge/bidWins'
import { buildEstimateWins, type EstimateSent } from '../../lib/bridge/estimateWins'

const md = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
let seq = 0
const bid = (gcId: string | null, createdYmd: string, usd: number, over: Partial<MarketDeskBid> = {}): MarketDeskBid => ({ id: `b${++seq}`, createdYmd, sentYmd: createdYmd, usd, outcome: null, outcomeYmd: null, jobCreatedYmd: null, gcId, projectName: null, ...over })
const est = (createdYmd: string, usd: number): MarketDeskEstimate => ({ id: `e${++seq}`, createdYmd, sentYmd: createdYmd, status: 'sent', usd, acceptedYmd: null, updatedYmd: createdYmd })

// Made-up sources, every one of them.
const desk = buildMarketDesk({
  todayYmd: '2026-10-26',
  windowStart: '2026-08-31',
  bids: [
    bid('gc-ridgeway', '2026-05-05', 58_000, { outcome: 'won', outcomeYmd: '2026-05-29' }),
    bid('gc-ridgeway', '2026-09-01', 58_000),
    bid('gc-ridgeway', '2026-10-22', 58_000),
    bid('gc-pine', '2026-10-05', 0),
    bid('gc-pine', '2026-10-01', 70_000),
    bid('gc-oak', '2026-05-15', 70_000),
    bid('gc-oak', '2026-06-15', 70_000),
    ...['2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-08-24', '2026-08-31'].map((d) => bid('gc-cedar', d, 40_000)),
  ],
  estimates: [est('2026-09-10', 3_000), est('2026-10-24', 3_000)],
  gcNames: new Map([
    ['gc-ridgeway', 'Ridgeway Builders'],
    ['gc-pine', 'Pine Fork Homes'],
    ['gc-oak', 'Oak Hollow HOA'],
    ['gc-cedar', 'Cedar Knoll Contracting'],
  ]),
  firstBidYmdByGc: new Map([
    ['gc-ridgeway', '2024-02-01'],
    ['gc-pine', '2025-11-11'],
    ['gc-oak', '2024-06-06'],
    ['gc-cedar', '2025-01-10'],
  ]),
  winShare: 0.14,
  fieldPerWeekUsd: 52_900,
  dayLabel: md,
})
const header = marketHeader({ askedPerWeekUsd: desk.askedPerWeekUsd, winShare: 0.14, fieldPerWeekUsd: 52_900 })

const sent = (sentYmd: string, usd: number, outcome: string | null = null): BidSent => ({ sentYmd, usd, outcome, hasJob: false, jobUsd: null })
const bidWins = buildBidWins({
  todayYmd: '2026-10-26',
  windowStart: '2026-08-31',
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
const estimateWins = buildEstimateWins({ todayYmd: '2026-10-26', windowStart: '2026-08-31', estimates: [estimate('2026-09-15', 6_000, 'customer_accepted'), estimate('2026-09-20', 2_000, 'declined'), estimate('2026-10-20', 8_000, 'sent')] })
const worth = buildMarketWorth(bidWins, estimateWins)

const STAMP = 'Mon, Oct 26 · pay week Oct 25–31'
const openFold = (key: string): HTMLElement => {
  fireEvent.click(screen.getByTestId(`bridge-step-fold-${key}`))
  return screen.getByTestId(`bridge-step-fold-body-${key}`)
}
/** The sentences that judged Market at one win share. */
const OLD_JUDGEMENT = /win share|Feeding it takes|to feed the field/

describe('BridgeMarketDesk on the step frame (spike candidate 9)', () => {
  it('opens on what Market is worth, the two parts, the four bars and up to three things to do', () => {
    const onClose = vi.fn()
    renderWithProviders(<BridgeMarketDesk header={header} desk={desk} error={null} isLink={false} readStamp={STAMP} onClose={onClose} worth={worth} bidWins={bidWins} estimateWins={estimateWins} />)
    const dialog = screen.getByRole('dialog', { name: 'Market, broken down' })
    expect(screen.getByTestId('bridge-market-desk').contains(dialog)).toBe(true)
    expect(dialog.textContent).toContain('Market · what comes in to price')
    expect(screen.getByTestId('bridge-market-headline').textContent).toMatch(/^Market is worth \$[\d.]+k a week\. The field builds \$52\.9k\.$/)
    expect(dialog.textContent).toMatch(/That is \$[\d.]+k a week short of keeping the field busy\./)

    const figures = screen.getAllByTestId('bridge-market-figure')
    expect(figures).toHaveLength(2)
    expect(figures[0]!.textContent).toMatch(/^\$[\d.]+k?bids, at \d+% won$/)
    expect(figures[1]!.textContent).toBe('$1.5kestimates, at 75% won')

    expect(screen.getByText('What we win, by the size of the bid')).toBeTruthy()
    const bars = screen.getAllByTestId('bridge-market-size-bar')
    expect(bars.map((b) => b.textContent)).toEqual(['Under $10k50%', '$10k to $50k13%', '$50k to $500k44%', 'Over $500k0%'])
    // Each bar is drawn to the true share of a 0 to 100% track.
    const fills = screen.getAllByTestId('bridge-market-size-fill')
    expect(fills).toHaveLength(4)
    fills.forEach((f, i) => expect(parseFloat(f.style.width)).toBeCloseTo((bidWins.sizes[i]!.rate as number) * 100, 3))
    expect(fills[0]!.style.width).toBe('50%')
    expect(fills[3]!.style.width).toBe('0%')

    const group = screen.getByTestId('bridge-step-group-do')
    expect(group.textContent).toContain('Do this week')
    const rows = within(group).getAllByTestId('bridge-step-row')
    expect(rows.map((r) => r.textContent)).toEqual(['Mark 2 old bids won or lostSent over 180 days ago, no mark. $120k.Open the Bid Board', 'Call Oak Hollow HOAQuiet 19 weeks. $140k asked in the last 26 weeks.Open their bids', 'Put a value on 1 bidA bid with no value counts for nothing.Open the bids'])
    const first = screen.getByTestId('bridge-market-do-old-bids') as HTMLAnchorElement
    expect(first.textContent).toBe('Open the Bid Board')
    expect(first.getAttribute('href')).toBe('/bids?tab=bid-board')
    expect(screen.getByTestId('bridge-market-do-call').getAttribute('href')).toBe('/bids?tab=bid-board')
    expect(screen.getByTestId('bridge-market-do-value').getAttribute('href')).toBe('/bids')

    // Everything else waits behind a press, in this order, and none of it is open.
    expect([...screen.getByTestId('bridge-step-folds').querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Every source (5) ›', 'The asks by week ›', 'What this window cannot see ›', 'How this is counted ›'])
    expect(screen.queryByTestId('bridge-market-row')).toBeNull()
    expect(screen.queryByTestId('bridge-market-strip')).toBeNull()
    expect(dialog.textContent).not.toMatch(OLD_JUDGEMENT)
    expect(dialog.textContent).toContain(`Read ${STAMP}`)
    // The Bid Board's door is a row's press, so the foot offers only Estimates.
    expect((screen.getByText('Open Estimates ›') as HTMLAnchorElement).getAttribute('href')).toBe('/estimates')
    expect(screen.queryByText('Open the Bid Board ›')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps every source, the tiles, the strip, the panels and the footnote behind the four folds', () => {
    renderWithProviders(<BridgeMarketDesk header={header} desk={desk} error={null} isLink={false} readStamp={STAMP} onClose={() => {}} worth={worth} bidWins={bidWins} estimateWins={estimateWins} />)
    const dialog = screen.getByRole('dialog')

    const sources = openFold('sources')
    expect(screen.getByTestId('bridge-market-verdict').textContent).toBe('Call Oak Hollow HOA and put a value on Pine Fork Homes’s bid. That is this week’s lever.')
    const rows = within(sources).getAllByTestId('bridge-market-row')
    expect(rows.map((r) => r.querySelector('b')!.textContent)).toEqual(['Ridgeway Builders', 'Pine Fork Homes', 'Customers’ estimates', 'Oak Hollow HOA', 'Cedar Knoll Contracting'])
    expect(rows[3]!.textContent).toContain('fading')
    expect(rows[4]!.textContent).toContain('no answers')
    expect(rows[1]!.textContent).toContain('GC. Last ask Oct 5. 1 bid has no value.')
    expect(sources.textContent).not.toMatch(/dead weight|rides? at \$0/)
    const head = rows[0]!.querySelector('button[aria-expanded]') as HTMLButtonElement
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('bridge-market-row-det').textContent).toBe('Won 1 of 1 answered. 33% by value. Answers in about 24 days, as recorded. Last ask Oct 22.')
    expect((screen.getByText('Open their bids ›') as HTMLAnchorElement).getAttribute('href')).toBe('/bids?tab=bid-board')
    expect(screen.getByTestId('bridge-market-pricing-spend').textContent).toContain('Cedar Knoll Contracting has taken 6 priced bids for $0 won and no answer in 26 weeks.')
    expect(dialog.textContent).not.toMatch(OLD_JUDGEMENT)

    // One fold is open at a time: the asks take the sources' place.
    const asks = openFold('asks')
    expect(screen.queryByTestId('bridge-market-row')).toBeNull()
    expect(within(asks).getAllByTestId('bridge-market-tile')).toHaveLength(3)
    const cells = screen.getAllByLabelText(/^Week of /)
    expect(cells).toHaveLength(26)
    expect(cells[24]!.getAttribute('aria-label')).toBe('Week of Oct 18: $61k asked, $58k from GCs, $3k from customers')
    fireEvent.click(cells[24]!)
    expect(screen.getByTestId('bridge-market-week-line').textContent).toBe('Week of Oct 18: $61k asked, $58k from GCs, $3k from customers')
    // With the won rates read, the line that judged the asks at one win share is off the strip.
    expect(screen.queryByTestId('bridge-market-subline')).toBeNull()
    expect(dialog.textContent).not.toMatch(OLD_JUDGEMENT)

    expect(openFold('cannot-see').textContent).toContain('A GC enters the book at their first invite and not before.')
    expect(screen.getByTestId('bridge-market-cannot-see')).toBeTruthy()

    const counted = openFold('counted')
    expect(counted.textContent).toContain('A bid counts as won or lost only when it is marked.')
    expect(counted.textContent).toContain('With no mark it counts as 50% lost after 90 days and 95% lost after 180 days.')
    expect(counted.textContent).toContain('Each bid is read at the won rate for bids its size.')
    expect(counted.textContent).toContain('It is also lost when the customer passes it over for another at the same address.')
    expect(counted.textContent).toContain('It is also lost when the customer gives no answer for 90 days.')
    expect(counted.textContent).toContain('A source is the customer on a bid.')
    expect(counted.textContent).toContain('Quiet means no ask for 4 weeks or more.')
    expect(counted.textContent).toContain('The list covers the last 26 pay weeks, this week included.')
    // Under 200 words, and nothing in it says the list counts wins another way.
    expect((counted.textContent ?? '').replace(/([a-z.])([A-Z])/g, '$1 $2').split(/\s+/).filter(Boolean).length).toBeLessThan(200)
    expect(counted.textContent).not.toMatch(/job was made|became a job/)
    expect(counted.textContent).toContain('No plan is recorded here. The week’s call stays with the lit link above.')
    expect(counted.textContent).not.toMatch(/How this reads|[a-z]_[a-z]/)
    expect(dialog.textContent).not.toMatch(OLD_JUDGEMENT)
  })

  it('falls back to the headline it had before while the won rates are not read', () => {
    renderWithProviders(<BridgeMarketDesk header={header} desk={desk} error={null} isLink={false} readStamp={STAMP} onClose={() => {}} worth={null} bidWins={null} estimateWins={null} />)
    const dialog = screen.getByRole('dialog')
    expect(screen.getByTestId('bridge-market-headline').textContent).toBe(desk.headline)
    expect(dialog.textContent).toContain('The field builds $52.9k a week.')
    expect(screen.queryByTestId('bridge-market-figure')).toBeNull()
    expect(screen.queryByTestId('bridge-market-sizes')).toBeNull()
    // The rows the sources give still show, and no press is drawn blue without the old bids.
    expect(screen.getAllByTestId('bridge-step-row').map((r) => r.textContent)).toEqual(['Call Oak Hollow HOAQuiet 19 weeks. $140k asked in the last 26 weeks.Open their bids', 'Put a value on 1 bidA bid with no value counts for nothing.Open the bids'])
    expect(screen.queryByTestId('bridge-market-do-old-bids')).toBeNull()
    // The one win share stays out of the open view. It waits with the strip that draws it.
    expect(dialog.textContent).not.toMatch(OLD_JUDGEMENT)
    const asks = openFold('asks')
    expect(screen.getByTestId('bridge-market-subline').textContent).toBe(desk.subLine)
    expect(asks.textContent).toContain('a week to feed the field')
    expect(openFold('counted').textContent).toContain('Until they are, the headline judges the asks at one win share.')
  })

  it('leaves the props the page passed before working with the new three left out', () => {
    renderWithProviders(<BridgeMarketDesk header={header} desk={desk} error={null} isLink readStamp={STAMP} onClose={() => {}} />)
    expect(screen.getByTestId('bridge-market-headline').textContent).toBe(desk.headline)
    expect(screen.getByTestId('bridge-market-headline').style.color).toBe('var(--text-red-700)')
  })

  it('draws the header from the page while the reads are in flight, and the error near the top in plain words', () => {
    const first = renderWithProviders(<BridgeMarketDesk header={header} desk={null} error={null} isLink readStamp="Mon, Oct 26" onClose={() => {}} />)
    expect(screen.getByTestId('bridge-market-headline').textContent).toBe(header.headline)
    expect(screen.getByText('Reading the sources and the asks by week…')).toBeTruthy()
    expect(screen.queryByTestId('bridge-step-group-do')).toBeNull()
    expect([...screen.getByTestId('bridge-step-folds').querySelectorAll('button')].map((b) => b.textContent)).toEqual(['What this window cannot see ›', 'How this is counted ›'])
    // No row opens the Bid Board yet, so the foot keeps its door.
    expect((screen.getByText('Open the Bid Board ›') as HTMLAnchorElement).getAttribute('href')).toBe('/bids?tab=bid-board')
    first.unmount()
    renderWithProviders(<BridgeMarketDesk header={header} desk={null} error="The read timed out" isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} worth={worth} bidWins={bidWins} estimateWins={estimateWins} />)
    expect(screen.getByTestId('bridge-market-error').textContent).toBe('The sources and the asks by week could not be read. The read timed out.')
    expect(screen.queryByText('Reading the sources and the asks by week…')).toBeNull()
    // The worth and the old bids do not wait on the sources.
    expect(screen.getByTestId('bridge-market-headline').textContent).toMatch(/^Market is worth /)
    expect(screen.getAllByTestId('bridge-step-row')).toHaveLength(1)
  })
})
