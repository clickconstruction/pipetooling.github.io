// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeMarketDesk } from './BridgeMarketDesk'
import { buildMarketDesk, marketHeader, type MarketDeskBid, type MarketDeskEstimate } from '../../lib/bridge/market/marketDesk'

const md = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
let seq = 0
const bid = (gcId: string | null, createdYmd: string, usd: number, over: Partial<MarketDeskBid> = {}): MarketDeskBid => ({ id: `b${++seq}`, createdYmd, sentYmd: createdYmd, usd, outcome: null, outcomeYmd: null, jobCreatedYmd: null, gcId, projectName: null, ...over })
const est = (createdYmd: string, usd: number): MarketDeskEstimate => ({ id: `e${++seq}`, createdYmd, sentYmd: createdYmd, status: 'sent', usd, acceptedYmd: null, updatedYmd: createdYmd })

const desk = buildMarketDesk({
  todayYmd: '2026-10-26',
  windowStart: '2026-08-31',
  bids: [
    bid('gc-burd', '2026-05-05', 58_000, { outcome: 'won', outcomeYmd: '2026-05-29' }),
    bid('gc-burd', '2026-09-01', 58_000),
    bid('gc-burd', '2026-10-22', 58_000),
    bid('gc-summit', '2026-10-05', 0),
    bid('gc-summit', '2026-10-01', 70_000),
    bid('gc-mk', '2026-05-15', 70_000),
    bid('gc-mk', '2026-06-15', 70_000),
    ...['2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-08-24', '2026-08-31'].map((d) => bid('gc-knight', d, 40_000)),
  ],
  estimates: [est('2026-09-10', 3_000), est('2026-10-24', 3_000)],
  gcNames: new Map([
    ['gc-burd', 'Burd & Assoc.'],
    ['gc-summit', 'Summit GC'],
    ['gc-mk', 'MK Builders'],
    ['gc-knight', 'Knight Contracting'],
  ]),
  firstBidYmdByGc: new Map([
    ['gc-burd', '2024-02-01'],
    ['gc-summit', '2025-11-11'],
    ['gc-mk', '2024-06-06'],
    ['gc-knight', '2025-01-10'],
  ]),
  winShare: 0.14,
  fieldPerWeekUsd: 52_900,
  dayLabel: md,
})
const header = marketHeader({ askedPerWeekUsd: desk.askedPerWeekUsd, winShare: 0.14, fieldPerWeekUsd: 52_900 })

describe('BridgeMarketDesk (v2.5931)', () => {
  it('draws the headline, the verdict, the strip with a label on every week, the book, the panels, and closes on Escape', () => {
    const onClose = vi.fn()
    renderWithProviders(<BridgeMarketDesk header={header} desk={desk} error={null} isLink={false} readStamp="Mon, Oct 26 · pay week Oct 25–31" onClose={onClose} />)
    expect(screen.getByTestId('bridge-market-headline').textContent).toBe(desk.headline)
    expect(screen.getByTestId('bridge-market-verdict').textContent).toBe('Call MK Builders and put a value on Summit GC’s bid. That is this week’s lever.')
    expect(screen.getAllByTestId('bridge-market-tile')).toHaveLength(3)
    const cells = screen.getAllByLabelText(/^Week of /)
    expect(cells).toHaveLength(26)
    expect(cells[24]!.getAttribute('aria-label')).toBe('Week of Oct 18: $61k asked, $58k from GCs, $3k from customers')
    fireEvent.click(cells[24]!)
    expect(screen.getByTestId('bridge-market-week-line').textContent).toBe('Week of Oct 18: $61k asked, $58k from GCs, $3k from customers')
    const rows = screen.getAllByTestId('bridge-market-row')
    expect(rows.map((r) => r.querySelector('b')!.textContent)).toEqual(['Burd & Assoc.', 'Summit GC', 'Customers (estimates)', 'MK Builders', 'Knight Contracting'])
    expect(rows[3]!.textContent).toContain('fading')
    expect(rows[4]!.textContent).toContain('dead weight')
    const head = rows[0]!.querySelector('button[aria-expanded]') as HTMLButtonElement
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('bridge-market-row-det').textContent).toBe('Won 1 of 1 answered. 33% by value. Answers in about 24 days, as recorded. Last ask Oct 22.')
    expect((screen.getByText('Open their bids ›') as HTMLAnchorElement).getAttribute('href')).toBe('/bids?tab=bid-board')
    expect(screen.getByTestId('bridge-market-pricing-spend').textContent).toContain('Knight Contracting has taken 6 priced bids for $0 won and no answer in 26 weeks.')
    expect(screen.getByTestId('bridge-market-zero-bids').textContent).toContain('1 bid rides at $0.')
    expect((screen.getByText('Open the bids ›') as HTMLAnchorElement).getAttribute('href')).toBe('/bids')
    expect(screen.getByTestId('bridge-market-cannot-see').textContent).toContain('A GC enters the book at their first invite and not before.')
    expect(screen.getByText(/^How this reads:/)).toBeTruthy()
    expect(screen.getByText('No plan is recorded here. The week’s call stays with the lit link above.')).toBeTruthy()
    expect((screen.getByText('Open Estimates ›') as HTMLAnchorElement).getAttribute('href')).toBe('/estimates')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('draws the header from the page while the reads are in flight, and the error as one line', () => {
    renderWithProviders(<BridgeMarketDesk header={header} desk={null} error={null} isLink readStamp="Mon, Oct 26" onClose={() => {}} />)
    expect(screen.getByTestId('bridge-market-headline').textContent).toBe(header.headline)
    expect(screen.getByText('Reading the Market desk…')).toBeTruthy()
    expect(screen.queryByTestId('bridge-market-verdict')).toBeNull()
    renderWithProviders(<BridgeMarketDesk header={header} desk={null} error="timeout" isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} />)
    expect(screen.getByText('The Market desk could not be read (timeout).')).toBeTruthy()
  })
})
