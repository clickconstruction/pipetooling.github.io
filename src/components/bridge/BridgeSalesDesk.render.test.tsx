// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeSalesDesk } from './BridgeSalesDesk'
import { buildSalesDesk, type SalesDecidedBid, type SalesOpenBid, type SalesOpenEstimate } from '../../lib/bridge/sales/salesDesk'
import { buildBidWins, type BidSent } from '../../lib/bridge/bidWins'
import { buildEstimateWins, type EstimateSent } from '../../lib/bridge/estimateWins'
import { ymdAddDays } from '../../utils/dateUtils'

const TODAY = '2026-10-26'
const ago = (n: number): string => ymdAddDays(TODAY, -n)
const open = (id: string, gc: string | null, projectName: string, usd: number, ageDays: number): SalesOpenBid => ({ id, bidNumber: `B-${id}`, projectName, gcBuilderId: gc, customerId: null, usd, sentYmd: ago(ageDays), nextFollowupYmd: null, nextFollowupReason: null, lastContactYmd: null })
let seq = 0
const decided = (gc: string, outcome: 'won' | 'lost', usd: number, paceDays: number, lossCategory: string | null = null): SalesDecidedBid => {
  seq += 1
  return { id: `d${seq}`, gcBuilderId: gc, usd, sentYmd: ago(paceDays + 100), outcome, outcomeYmd: ago(100), lossCategory, lossReason: null }
}
// Every name here is made up.
const openBids = [open('club', 'oak', 'Clubhouse', 410_000, 31), open('pool', 'oak', 'Pool house', 230_000, 18), open('north', 'cedar', 'North office', 890_000, 58), open('b2', 'cedar', 'South office shell', 200_000, 22), open('a1', 'pine', 'Phase 2', 410_000, 12), open('k1', 'ridge', 'Shell building', 290_000, 77), open('old', 'cedar', 'An old ask', 480_000, 120)]
const decidedBids = [
  decided('oak', 'won', 110_000, 15),
  decided('oak', 'won', 100_000, 19),
  decided('oak', 'lost', 300_000, 19, 'price'),
  decided('oak', 'lost', 244_000, 25, 'other_sub'),
  decided('oak', 'lost', 200_000, 30, 'no_answer'),
  decided('cedar', 'won', 100_000, 24),
  { ...decided('cedar', 'lost', 200_000, 20), bidNumber: '301', projectName: 'South office shell' },
  { ...decided('cedar', 'lost', 200_000, 22), bidNumber: '302', projectName: null },
  ...[24, 26, 28].map((p) => decided('cedar', 'lost', 200_000, p)),
  decided('cedar', 'lost', 150_000, 30, 'project_died'),
  ...[1, 2, 3, 4, 5, 6].map(() => decided('ridge', 'lost', 100_000, 60, 'no_answer')),
]
const openEstimates: SalesOpenEstimate[] = [{ id: 'e1', title: 'A tank', sentYmd: ago(4), usd: 2_800, customerId: 'c1' }]
const desk = buildSalesDesk({ todayYmd: TODAY, openBids, decidedBids, gcNames: new Map([['oak', 'Oak Hollow HOA'], ['cedar', 'Cedar Bend Dental'], ['pine', 'Pine Fork Homes'], ['ridge', 'Ridgeway Builders']]), openEstimates, fallbackRate: 0.14, estimateShare: 0.37 })
const card = { awaitingUsd: desk.pile.askedUsd, bids: desk.pile.bids, bidsUsd: desk.pile.bidsUsd, estimates: 1, estimatesUsd: 2_800 }
const paces = { soldPerWeekUsd: 50_400, fieldPerWeekUsd: 52_900 }

// The owner's rules of 2026-11-11, on made-up rows. Out counts the part of each unmarked bid not yet lost by age.
const sent = (usd: number, ageDays: number, outcome: string | null = null): BidSent => ({ sentYmd: ago(ageDays), outcome, usd, hasJob: false, jobUsd: null })
const bidWins = buildBidWins({ todayYmd: TODAY, windowStart: ago(91), bids: [sent(4_000, 200, 'won'), sent(4_000, 200, 'lost'), sent(6_000, 10), sent(100_000, 300, 'won'), sent(300_000, 300, 'lost'), sent(200_000, 100), sent(600_000, 20), sent(40_000, 200), sent(30_000, 400)] })
const estimate = (usd: number, ageDays: number, status: string, customerKey: string): EstimateSent => ({ sentYmd: ago(ageDays), status, usd, customerKey })
const estimateWins = buildEstimateWins({ todayYmd: TODAY, windowStart: ago(91), estimates: [estimate(3_000, 30, 'customer_accepted', 'c1'), estimate(1_000, 30, 'declined', 'c2'), estimate(8_000, 5, 'sent', 'c3')] })

const base = { desk, error: null, card, paces, isLink: false, readStamp: 'Mon, Oct 26 · pay week Oct 25–31', onClose: () => {} }
const openFold = (key: string): HTMLElement => {
  fireEvent.click(screen.getByTestId(`bridge-step-fold-${key}`))
  return screen.getByTestId(`bridge-step-fold-body-${key}`)
}

describe('BridgeSalesDesk on the shared frame (punch list #318)', () => {
  it('opens on what is out at the won rates, the calls with their doors, the marks, and why we lost', () => {
    renderWithProviders(<BridgeSalesDesk {...base} worth={null} bidWins={bidWins} estimateWins={estimateWins} />)
    const dialog = screen.getByRole('dialog', { name: 'Sales, broken down' })
    expect(screen.getByTestId('bridge-sales-desk').contains(dialog)).toBe(true)
    expect(dialog.textContent).toContain('Sales · bids and estimates that are out')
    expect(screen.getByTestId('bridge-sales-headline').textContent).toBe('$718k is out. At our won rates that is about $138k.')
    expect(dialog.textContent).toContain('We sold $50.4k a week. The field builds $52.9k.')

    const rows = within(screen.getByTestId('bridge-step-group-week')).getAllByTestId('bridge-step-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.textContent).toContain('Call Cedar Bend Dental')
    expect(rows[0]!.textContent).toContain('$890k bid. 34 days past their usual answer.')
    const first = within(rows[0]!).getByRole('link') as HTMLAnchorElement
    expect(first.textContent).toBe('Open the bid')
    expect(first.getAttribute('href')).toBe('/bids?tab=bid-board&bidId=north')
    // The first press is the blue one, and the only one.
    expect(first.getAttribute('style')).toContain('rgb(37, 99, 235)')
    expect(rows[1]!.textContent).toContain('Call Oak Hollow HOA')
    expect(rows[1]!.textContent).toContain('$410k bid. 12 days past their usual answer.')
    expect(within(rows[1]!).getByRole('link').getAttribute('style')).not.toContain('rgb(37, 99, 235)')
    expect(rows[2]!.textContent).toContain('Mark 2 old bids won or lost')
    expect(rows[2]!.textContent).toContain('The won rates rest on the marks.')
    const mark = screen.getByTestId('bridge-sales-mark') as HTMLAnchorElement
    expect(mark.textContent).toBe('Open the Bid Board')
    expect(mark.getAttribute('href')).toBe('/bids?tab=bid-board')

    const why = screen.getByTestId('bridge-sales-why-lost')
    expect(why.textContent).toContain('Why we lost, last 12 months')
    const reasons = within(why).getAllByTestId('bridge-sales-why-row')
    expect(reasons.map((r) => r.textContent)).toEqual(['No reason writtenName it on 5 bids ›$1.0M · 5', 'No answer$800k · 7', 'Price too high$300k · 1'])
    expect((screen.getByTestId('bridge-sales-name-it') as HTMLAnchorElement).getAttribute('href')).toBe('/bids?tab=bid-board')

    // The open view says one figure for the pile, in none of the old words.
    expect(dialog.textContent).not.toMatch(/expected|win share/i)
    expect(screen.queryByTestId('bridge-sales-row')).toBeNull()
    expect(within(screen.getByTestId('bridge-step-folds')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Every asker (4) ›', 'What is in the pile ›', 'Every decided bid (18) ›', 'How this is counted ›'])
  })

  it('opens How this is counted on the new rules, in plain words, with the rate for each size', () => {
    renderWithProviders(<BridgeSalesDesk {...base} bidWins={bidWins} estimateWins={estimateWins} />)
    const how = openFold('how')
    expect(screen.getByTestId('bridge-step-fold-how').getAttribute('aria-expanded')).toBe('true')
    expect(how.textContent).toContain('A bid counts as won or lost only when it is marked.')
    expect(how.textContent).toContain('With no mark it counts as 50% lost after 90 days and 95% lost after 180 days.')
    expect(how.textContent).toContain('A bid with no mark counts as out only for the part not yet counted as lost.')
    expect(how.textContent).toContain('Each bid is read at the won rate for bids its size.')
    expect(how.textContent).toContain('An estimate is lost when the customer declines it or gives no answer for 90 days.')
    expect(how.textContent).toContain('It is also lost when the customer passes it over for another at the same address.')
    expect(how.textContent).toContain('The list behind Every asker still ranks each asker by their own record.')
    expect(how.textContent).toContain('A job made from a bid does not make it won.')
    expect(how.textContent).not.toMatch(/expected dollars|win share|win rate/i)
    expect(how.textContent).toContain('A loss with no reason opens on its bid, where Why we lost is written.')
    expect(how.textContent).not.toContain('call is recorded')
    expect(how.textContent).toContain('Read Mon, Oct 26 · pay week Oct 25–31')
    // No column of the database is named.
    expect(how.textContent).not.toMatch(/[a-z]_[a-z]/)
    const sizes = within(screen.getByTestId('bridge-sales-sizes')).getAllByRole('row')
    expect(sizes.map((r) => r.textContent)).toEqual(['Under $10k50% won1 won, 1 lost, 1 with no mark', '$10k to $50k0% won0 won, 0 lost, 2 with no mark', '$50k to $500k20% won1 won, 1 lost, 1 with no mark', 'Over $500k18% wonnothing won or lost yet'])
    // One fold is open at a time, and pressing it again closes it.
    fireEvent.click(screen.getByTestId('bridge-step-fold-how'))
    expect(screen.queryByTestId('bridge-step-fold-body-how')).toBeNull()
  })

  it('falls back to the headline it had when the new reads are not given, and asks for no marks', () => {
    const onClose = vi.fn()
    renderWithProviders(<BridgeSalesDesk {...base} bidWins={null} estimateWins={null} onClose={onClose} />)
    expect(screen.getByTestId('bridge-sales-headline').textContent).toBe(desk.headline)
    const rows = within(screen.getByTestId('bridge-step-group-week')).getAllByTestId('bridge-step-row')
    expect(rows.map((r) => within(r).getByRole('link').getAttribute('href'))).toEqual(['/bids?tab=bid-board&bidId=north', '/bids?tab=bid-board&bidId=club'])
    expect(screen.queryByTestId('bridge-sales-mark')).toBeNull()
    expect(screen.queryByTestId('bridge-sales-sizes')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps the verdict, the tiles and the four bands behind What is in the pile', () => {
    renderWithProviders(<BridgeSalesDesk {...base} />)
    expect(screen.queryByTestId('bridge-sales-verdict')).toBeNull()
    const pile = openFold('pile')
    expect(screen.getByTestId('bridge-sales-verdict').textContent).toBe(desk.verdict)
    expect(desk.verdict).toMatch(/^2 calls this week protect \$33\.\dk of what the pile is worth\.$/)
    expect(within(pile).getByText('What the pile is worth')).toBeTruthy()
    expect(within(pile).getByText('Past their usual answer')).toBeTruthy()
    expect(within(pile).getByText('What makes the rates less sure')).toBeTruthy()
    for (const band of ['On time', 'Past their usual answer', 'Estimates getting old', 'Never answered, $0']) expect(pile.textContent).toContain(`${band} · `)
    expect(within(pile).getByText(/1 more bid, \$480k, was sent over 90 days ago/)).toBeTruthy()
    expect(within(pile).getByText(/Ridgeway Builders never answers and holds \$290k open/)).toBeTruthy()
    expect((within(pile).getByText('Decide them on the Bid Board ›') as HTMLAnchorElement).getAttribute('href')).toBe('/bids?tab=bid-board')
    expect(pile.textContent).toContain('These figures read each asker by their own record, so they differ from the headline.')
    expect(pile.textContent).not.toMatch(/expected dollars|win share|evaporating|dead weight|at risk|protected|ride at/i)
  })

  it('keeps every asker behind its fold: the rows in order, the flip, and a row opening to its move and door', () => {
    renderWithProviders(<BridgeSalesDesk {...base} isLink={true} />)
    const askers = openFold('askers')
    let rows = screen.getAllByTestId('bridge-sales-row')
    expect(rows.map((r) => within(r).getAllByRole('button')[0]!.textContent?.slice(1, 10))).toEqual(['Oak Hollo', 'Pine Fork', 'Cedar Ben', 'The estim', 'Ridgeway '])
    expect(rows[0]!.textContent).toContain('2 of 5 · 22%')
    expect(rows[0]!.textContent).toContain('12 days late')
    expect(rows[0]!.textContent).toContain('worth')
    expect(rows[4]!.textContent).toContain('never answered')
    expect(askers.textContent).not.toMatch(/expected|win share|dead weight|past pace/i)
    const flip = screen.getByTestId('bridge-sales-flip')
    expect(flip.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(flip)
    expect(flip.getAttribute('aria-pressed')).toBe('true')
    expect(flip.textContent).toBe('Ranked by open dollars. Press to rank by what each ask is worth.')
    expect(screen.getByTestId('bridge-sales-flip-note').textContent).toBe('By open dollars Cedar Bend Dental leads. Their 8% won rate says otherwise. Press again.')
    rows = screen.getAllByTestId('bridge-sales-row')
    const head = within(rows[0]!).getByRole('button')
    expect(head.textContent).toContain('Cedar Bend Dental')
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('bridge-sales-move').textContent).toBe('Call Cedar Bend Dental about North office.')
    expect(within(askers).getByText(/North office, \$890k, 58 days out\. 34 days past their usual answer\./)).toBeTruthy()
    const doorLink = within(rows[0]!).getByText('Open the bid ›') as HTMLAnchorElement
    expect(doorLink.getAttribute('href')).toBe('/bids?tab=bid-board&bidId=north')
    fireEvent.click(flip)
    expect(within(screen.getAllByTestId('bridge-sales-row')[0]!).getAllByRole('button')[0]!.textContent).toContain('Oak Hollow HOA')
    // The two page doors the foot used to carry.
    expect((within(askers).getByText('Open the Bid Board ›') as HTMLAnchorElement).getAttribute('href')).toBe('/bids?tab=bid-board')
    expect((within(askers).getByText('Open Estimates ›') as HTMLAnchorElement).getAttribute('href')).toBe('/estimates')
  })

  it('keeps every decided bid behind its fold, with each unreasoned loss named and a door onto its bid', () => {
    renderWithProviders(<BridgeSalesDesk {...base} />)
    expect(screen.queryByTestId('bridge-sales-funnel')).toBeNull()
    openFold('decided')
    const funnel = screen.getByTestId('bridge-sales-funnel')
    expect(funnel.textContent).toContain('Won $310k on 3 bids. Lost $2.5M on 15 bids. Most lost to No answer, $800k, then Price too high, $300k.')
    for (const line of ['Won', 'Price too high', 'Went with another sub', 'Project died / on hold', 'No answer', 'No reason written']) expect(funnel.textContent).toContain(line)
    expect(funnel.textContent).toContain('5 losses carry no reason, so the reasons read low.')
    const blind = screen.getByTestId('bridge-sales-blind')
    const rows = within(blind).getAllByTestId('bridge-sales-no-reason')
    expect(rows).toHaveLength(5)
    expect(rows[0]!.textContent).toContain('B301 · South office shell')
    expect(rows[0]!.textContent).toContain('$200k')
    expect(rows[1]!.textContent).toContain('B302')
    expect(rows[4]!.textContent).toContain('A bid with no name')
    expect(rows.map((r) => within(r).getByText('Open the bid ›').getAttribute('href'))).toEqual(['/bids?tab=bid-board&bidId=d7', '/bids?tab=bid-board&bidId=d8', '/bids?tab=bid-board&bidId=d9', '/bids?tab=bid-board&bidId=d10', '/bids?tab=bid-board&bidId=d11'])
    // The board door stays the line's last door, after the rows.
    const doors = within(blind).getAllByRole('link')
    expect(doors[doors.length - 1]!.textContent).toBe('Name them on the Bid Board ›')
    expect(doors[doors.length - 1]!.getAttribute('href')).toBe('/bids?tab=bid-board')
  })

  it('draws the header from the card while the reads are in flight, and the error near the top in plain words', () => {
    const { unmount } = renderWithProviders(<BridgeSalesDesk {...base} desk={null} />)
    expect(screen.getByTestId('bridge-sales-headline').textContent).toBe('$2.4M asked')
    expect(screen.getByText('Reading Sales…')).toBeTruthy()
    expect(screen.queryByTestId('bridge-step-group-week')).toBeNull()
    expect(screen.queryByTestId('bridge-sales-why-lost')).toBeNull()
    // How this is counted reads before the lists land.
    expect(within(screen.getByTestId('bridge-step-folds')).getAllByRole('button').map((b) => b.textContent)).toEqual(['How this is counted ›'])
    unmount()
    renderWithProviders(<BridgeSalesDesk {...base} desk={null} error="timeout" bidWins={bidWins} estimateWins={estimateWins} />)
    expect(screen.getByRole('status').textContent).toBe('Sales could not be read: timeout')
    // The marks do not wait on the lists.
    expect(screen.getByTestId('bridge-sales-headline').textContent).toBe('$718k is out. At our won rates that is about $138k.')
    expect(within(screen.getByTestId('bridge-step-group-week')).getAllByTestId('bridge-step-row').map((r) => r.textContent)).toEqual(['Mark 2 old bids won or lostThe won rates rest on the marks.Open the Bid Board'])
    expect(screen.getByTestId('bridge-sales-mark').getAttribute('style')).toContain('rgb(37, 99, 235)')
  })
})
