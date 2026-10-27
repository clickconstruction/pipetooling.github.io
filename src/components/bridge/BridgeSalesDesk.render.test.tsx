// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeSalesDesk } from './BridgeSalesDesk'
import { buildSalesDesk, type SalesDecidedBid, type SalesOpenBid, type SalesOpenEstimate } from '../../lib/bridge/sales/salesDesk'
import { ymdAddDays } from '../../utils/dateUtils'

const TODAY = '2026-10-26'
const ago = (n: number): string => ymdAddDays(TODAY, -n)
const open = (id: string, gc: string | null, projectName: string, usd: number, ageDays: number): SalesOpenBid => ({ id, bidNumber: `B-${id}`, projectName, gcBuilderId: gc, customerId: null, usd, sentYmd: ago(ageDays), nextFollowupYmd: null, nextFollowupReason: null, lastContactYmd: null })
let seq = 0
const decided = (gc: string, outcome: 'won' | 'lost', usd: number, paceDays: number, lossCategory: string | null = null): SalesDecidedBid => {
  seq += 1
  return { id: `d${seq}`, gcBuilderId: gc, usd, sentYmd: ago(paceDays + 100), outcome, outcomeYmd: ago(100), lossCategory, lossReason: null }
}
const openBids = [open('az', 'summit', 'Auto Zone Kyle', 410_000, 31), open('pecan', 'summit', 'Pecan St', 230_000, 18), open('take5', 'burd', 'Take 5 Georgetown', 890_000, 58), open('b2', 'burd', 'Round Rock shell', 200_000, 22), open('a1', 'ati', 'Schertz clinic', 410_000, 12), open('k1', 'knight', 'Taylor plant', 290_000, 77), open('old', 'burd', 'An old ask', 480_000, 120)]
const decidedBids = [
  decided('summit', 'won', 110_000, 15),
  decided('summit', 'won', 100_000, 19),
  decided('summit', 'lost', 300_000, 19, 'price'),
  decided('summit', 'lost', 244_000, 25, 'other_sub'),
  decided('summit', 'lost', 200_000, 30, 'no_answer'),
  decided('burd', 'won', 100_000, 24),
  { ...decided('burd', 'lost', 200_000, 20), bidNumber: '301', projectName: 'Round Rock shell' },
  { ...decided('burd', 'lost', 200_000, 22), bidNumber: '302', projectName: null },
  ...[24, 26, 28].map((p) => decided('burd', 'lost', 200_000, p)),
  decided('burd', 'lost', 150_000, 30, 'project_died'),
  ...[1, 2, 3, 4, 5, 6].map(() => decided('knight', 'lost', 100_000, 60, 'no_answer')),
]
const openEstimates: SalesOpenEstimate[] = [{ id: 'e1', title: 'A tank', sentYmd: ago(4), usd: 2_800, customerId: 'c1' }]
const desk = buildSalesDesk({ todayYmd: TODAY, openBids, decidedBids, gcNames: new Map([['summit', 'Summit GC'], ['burd', 'Burd & Assoc.'], ['ati', 'ATI Schertz'], ['knight', 'Knight Contracting']]), openEstimates, fallbackRate: 0.14, estimateShare: 0.37 })
const card = { awaitingUsd: desk.pile.askedUsd, bids: desk.pile.bids, bidsUsd: desk.pile.bidsUsd, estimates: 1, estimatesUsd: 2_800 }
const paces = { soldPerWeekUsd: 50_400, fieldPerWeekUsd: 52_900 }

describe('BridgeSalesDesk (v2.5932)', () => {
  it('draws the headline, the verdict, the tiles, the rows in expected order, and closes on Escape', () => {
    const onClose = vi.fn()
    renderWithProviders(<BridgeSalesDesk desk={desk} error={null} card={card} paces={paces} isLink={false} readStamp="Mon, Oct 26 · pay week Oct 25–31" onClose={onClose} />)
    expect(screen.getByTestId('bridge-sales-headline').textContent).toBe(desk.headline)
    expect(screen.getByTestId('bridge-sales-verdict').textContent).toBe(desk.verdict)
    expect(desk.verdict).toMatch(/^2 calls this week protect \$33\.\dk of it\.$/)
    expect(screen.getByText('What the pile is worth')).toBeTruthy()
    expect(screen.getByText('At risk, the calls')).toBeTruthy()
    expect(screen.getByText('What thins the reading')).toBeTruthy()
    const rows = screen.getAllByTestId('bridge-sales-row')
    expect(rows.map((r) => within(r).getByRole('button').textContent?.slice(1, 10))).toEqual(['Summit GC', 'ATI Scher', 'Burd & As', 'The estim', 'Knight Co'])
    expect(rows[0]!.textContent).toContain('2 of 5 · 22%')
    expect(rows[0]!.textContent).toContain('12 d past pace')
    expect(rows[4]!.textContent).toContain('dead weight')
    expect(screen.getByText(/\$480k more on 1 bid sits past the 90-day window/)).toBeTruthy()
    expect(screen.getByText(/Knight Contracting never answers and holds \$290k open/)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('flips to open dollars and re-ranks, then a row opens to its move and door', () => {
    renderWithProviders(<BridgeSalesDesk desk={desk} error={null} card={card} paces={paces} isLink={true} readStamp="Mon, Oct 26" onClose={() => {}} />)
    const flip = screen.getByTestId('bridge-sales-flip')
    expect(flip.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(flip)
    expect(flip.getAttribute('aria-pressed')).toBe('true')
    expect(flip.textContent).toBe('Ranked by open dollars · press for expected dollars')
    expect(screen.getByTestId('bridge-sales-flip-note').textContent).toBe('By open dollars Burd & Assoc. leads. The 8% win share says otherwise. Press again.')
    const rows = screen.getAllByTestId('bridge-sales-row')
    expect(within(rows[0]!).getByRole('button').textContent).toContain('Burd & Assoc.')
    const head = within(rows[0]!).getByRole('button')
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('bridge-sales-move').textContent).toBe('Call Burd & Assoc. about Take 5 Georgetown.')
    expect(screen.getByText(/Take 5 Georgetown, \$890k, 58 days out\. 34 past their pace\./)).toBeTruthy()
    const doorLink = within(rows[0]!).getByText('Open the bid ›') as HTMLAnchorElement
    expect(doorLink.getAttribute('href')).toBe('/bids?tab=bid-board&bidId=take5')
    fireEvent.click(flip)
    expect(within(screen.getAllByTestId('bridge-sales-row')[0]!).getByRole('button').textContent).toContain('Summit GC')
  })

  it('draws the funnel with the unreasoned losses named, the footnote, and the footer doors', () => {
    renderWithProviders(<BridgeSalesDesk desk={desk} error={null} card={card} paces={paces} isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} />)
    const funnel = screen.getByTestId('bridge-sales-funnel')
    expect(funnel.textContent).toContain('Won $310k on 3 bids. Lost $2.5M on 15 bids. Most lost to No answer, $800k, then Price too high, $300k.')
    expect(funnel.textContent).toContain('Price too high')
    expect(funnel.textContent).toContain('5 losses carry no reason, so this strip under-reads.')
    expect((screen.getByText('Name them on the Bid Board ›') as HTMLAnchorElement).getAttribute('href')).toBe('/bids?tab=bid-board')
    expect(screen.getByText(/A loss with no reason opens on its bid, where Why we lost is written\./)).toBeTruthy()
  })

  it('lists each unreasoned loss under the blind line with a door onto its bid', () => {
    renderWithProviders(<BridgeSalesDesk desk={desk} error={null} card={card} paces={paces} isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} />)
    const blind = screen.getByTestId('bridge-sales-blind')
    const rows = within(blind).getAllByTestId('bridge-sales-no-reason')
    expect(rows).toHaveLength(5)
    expect(rows[0]!.textContent).toContain('B301 · Round Rock shell')
    expect(rows[0]!.textContent).toContain('$200k')
    expect(rows[1]!.textContent).toContain('B302')
    expect(rows[4]!.textContent).toContain('A bid with no name')
    expect(rows.map((r) => within(r).getByText('Open the bid ›').getAttribute('href'))).toEqual(['/bids?tab=bid-board&bidId=d7', '/bids?tab=bid-board&bidId=d8', '/bids?tab=bid-board&bidId=d9', '/bids?tab=bid-board&bidId=d10', '/bids?tab=bid-board&bidId=d11'])
    // The board door stays the line's last door, after the rows.
    const doors = within(blind).getAllByRole('link')
    expect(doors[doors.length - 1]!.textContent).toBe('Name them on the Bid Board ›')
    expect(screen.getByText(/The pace is the median of outcome_at less bid_date_sent, as recorded\./)).toBeTruthy()
    expect((screen.getByText('Open Estimates ›') as HTMLAnchorElement).getAttribute('href')).toBe('/estimates')
    expect(screen.getByText("The week's call is recorded on the link desk above, not here.")).toBeTruthy()
  })

  it('draws the header from the card while the reads are in flight, and the error as one line', () => {
    const { unmount } = renderWithProviders(<BridgeSalesDesk desk={null} error={null} card={card} paces={paces} isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} />)
    expect(screen.getByTestId('bridge-sales-headline').textContent).toBe('$2.4M asked')
    expect(screen.getByText('Reading the sales desk…')).toBeTruthy()
    expect(screen.queryByTestId('bridge-sales-row')).toBeNull()
    unmount()
    renderWithProviders(<BridgeSalesDesk desk={null} error="timeout" card={card} paces={paces} isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} />)
    expect(screen.getByRole('status').textContent).toBe('The Sales desk could not be read (timeout).')
  })
})
