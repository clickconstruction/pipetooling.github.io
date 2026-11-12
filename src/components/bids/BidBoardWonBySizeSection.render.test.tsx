// @vitest-environment jsdom
/**
 * Render smoke for the Bid Board's chart of what we win by the size of the bid (punch list #318, PR 2). The counting
 * is the Bridge's (`bidWins.test.ts` holds every rule); this pins the wiring: the board's bids in, one row a size,
 * a ZZ test bid and an unsent bid out, the send day read as the date it is, and the chart following the bids it is
 * handed, which is how it follows the board's trade. Every bid is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { BidBoardWonBySizeSection } from './BidBoardWonBySizeSection'
import { BidBoardEstimatingHealthSection } from './BidBoardEstimatingHealthSection'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { plainWordsFailures } from '../../lib/plainWords'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../utils/dateUtils', async () => {
  const mod = await vi.importActual<typeof import('../../utils/dateUtils')>('../../utils/dateUtils')
  return { ...mod, todayYmdInAppTz: () => '2026-11-11' }
})

afterEach(() => cleanup())

let n = 0
function bid(over: { sent: string | null; usd: number; outcome?: string | null; name?: string; agreed?: number | null }): BidWithBuilder {
  n += 1
  return { id: `bid-${n}`, project_name: over.name ?? `Made-up job ${n}`, bid_date_sent: over.sent, bid_value: over.usd, agreed_value: over.agreed ?? null, outcome: over.outcome ?? null, estimator_id: null, estimator: null, account_manager_id: null, account_manager: null } as unknown as BidWithBuilder
}

const rows = () => screen.getAllByTestId('bid-size-wins-row').map((r) => r.textContent)

describe('BidBoardWonBySizeSection', () => {
  it('draws one row a size from the board’s sent bids, won by dollars', () => {
    renderWithProviders(
      <BidBoardWonBySizeSection
        filteredBids={[
          bid({ sent: '2026-10-01', usd: 6_000, outcome: 'won' }),
          bid({ sent: '2026-10-02', usd: 2_000, outcome: 'lost' }),
          bid({ sent: '2026-10-03', usd: 30_000, outcome: 'started_or_complete' }),
          bid({ sent: '2026-10-04', usd: 90_000, outcome: 'lost' }),
          // The agreed value is the bid's dollars when it has one: this one is a large bid, not a mid one.
          bid({ sent: '2026-10-05', usd: 40_000, agreed: 60_000, outcome: 'won' }),
          bid({ sent: '2026-11-01', usd: 700_000 }),
        ]}
      />,
    )
    expect(screen.getByRole('heading', { name: 'What we win, by the size of the bid' })).toBeTruthy()
    expect(rows()).toEqual([
      'Under $10k75% won1 won for $6k, 1 lost for $2k.',
      '$10k to $50k100% won1 won for $30k, 0 lost for $0.',
      '$50k to $500k40% won1 won for $60k, 1 lost for $90k.',
      'Over $500kno readNone marked won or lost yet, 1 with no mark for $700k.',
    ])
    expect(screen.getByTestId('bid-size-wins-foot').textContent).toBe('1 sent bid has no mark, for $700k. Marking them makes these rates true.')
  })

  it('leaves out a ZZ test bid and a bid never sent, and a job made from a bid decides nothing', () => {
    renderWithProviders(
      <BidBoardWonBySizeSection
        filteredBids={[bid({ sent: '2026-10-01', usd: 20_000, outcome: 'won' }), bid({ sent: '2026-10-01', usd: 20_000, outcome: 'lost' }), bid({ sent: '2026-10-01', usd: 20_000, outcome: 'won', name: 'ZZ Test shadow bid' }), bid({ sent: null, usd: 20_000, outcome: 'won' })]}
      />,
    )
    expect(rows()[1]).toBe('$10k to $50k50% won1 won for $20k, 1 lost for $20k.')
    expect(screen.getByTestId('bid-size-wins-foot').textContent).toBe('Every sent bid on this board is marked.')
  })

  it('reads the day a bid was sent as the date it is: 89 days is not yet half lost, 90 days is', () => {
    // 2026-08-14 is 89 days before 2026-11-11 and 2026-08-13 is 90. Read as an instant, each would land a day early.
    const won = bid({ sent: '2026-10-01', usd: 20_000, outcome: 'won' })
    const { unmount } = renderWithProviders(<BidBoardWonBySizeSection filteredBids={[won, bid({ sent: '2026-08-14', usd: 20_000 })]} />)
    expect(rows()[1]).toBe('$10k to $50k100% won1 won for $20k, 0 lost for $0, 1 with no mark for $20k.')
    unmount()
    renderWithProviders(<BidBoardWonBySizeSection filteredBids={[won, bid({ sent: '2026-08-13', usd: 20_000 })]} />)
    // Won 20,000 against half of 20,000 counted as lost.
    expect(rows()[1]).toBe('$10k to $50k67% won1 won for $20k, 0 lost for $0, 1 with no mark for $20k.')
  })

  it('says what fills it when no sent bid is marked, in plain words', () => {
    renderWithProviders(<BidBoardWonBySizeSection filteredBids={[bid({ sent: '2026-11-01', usd: 20_000 })]} />)
    expect(screen.queryAllByTestId('bid-size-wins-row')).toEqual([])
    const empty = document.querySelector('[data-empty-state]')
    expect(empty?.textContent).toBe('No sent bid on this board is marked won or lost yet. Mark a bid won or lost and its size fills in here.')
    const lead = screen.getByTestId('bid-size-wins').querySelector('p')?.textContent ?? ''
    expect(lead).toBe('Won by dollars, among the bids of each size that were sent. A bid counts as won or lost only when it is marked. With no mark it counts as 50% lost after 90 days and 95% lost after 180 days.')
    for (const words of [lead, empty?.textContent ?? '']) expect(plainWordsFailures(words), words).toEqual([])
  })
})

describe('BidBoardEstimatingHealthSection', () => {
  it('places the chart under The pulse, and the chart follows the bids the board hands it', () => {
    const plumbing = [bid({ sent: '2026-10-01', usd: 20_000, outcome: 'won' }), bid({ sent: '2026-10-02', usd: 20_000, outcome: 'lost' })]
    const electrical = [bid({ sent: '2026-10-01', usd: 5_000, outcome: 'won' })]
    const { unmount } = renderWithProviders(<BidBoardEstimatingHealthSection weeklySentSummaries={[]} filteredBids={plumbing} canSeeEstimatingLabor={false} />)
    const chart = screen.getByTestId('bid-size-wins')
    const pulse = screen.getByRole('heading', { name: /pulse/i })
    expect((pulse.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)
    expect(rows()[1]).toBe('$10k to $50k50% won1 won for $20k, 1 lost for $20k.')
    unmount()
    // Another trade's bids: the same section, another reading.
    renderWithProviders(<BidBoardEstimatingHealthSection weeklySentSummaries={[]} filteredBids={electrical} canSeeEstimatingLabor={false} />)
    expect(rows()[0]).toBe('Under $10k100% won1 won for $5k, 0 lost for $0.')
    expect(rows()[1]).toBe('$10k to $50kno readNone marked won or lost yet.')
  })
})
