// @vitest-environment jsdom
/**
 * Render smokes for BidSubmittalChip (Submittals stage 4b): the words for a shared
 * revision waiting on a named reviewer, rows sent back, a draft, a closed room, and
 * "none yet"; the chip is a door to the Submittals tab for the bid.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidSubmittalChip } from './BidSubmittalChip'
import { describeBidSubmittal } from '../../lib/submittals/bidSubmittalSummary'

const state: { rev: Record<string, unknown> | null; room: Record<string, unknown> | null; items: Record<string, unknown>[]; people: Record<string, unknown>[] } = { rev: null, room: null, items: [], people: [] }
const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      const chain = () => b
      b.select = chain
      b.eq = chain
      b.order = chain
      b.limit = chain
      b.maybeSingle = () => Promise.resolve({ data: table === 'bid_submittals' ? state.rev : table === 'bid_submittal_rooms' ? state.room : null, error: null })
      b.then = (res: (v: unknown) => void) => res({ data: table === 'bid_submittal_items' ? state.items : table === 'bid_submittal_people' ? state.people : [], error: null })
      return b
    },
  },
}))

describe('describeBidSubmittal', () => {
  it('words every state', () => {
    expect(describeBidSubmittal({ revNumber: 2, status: 'shared', roomStatus: 'open', waitingOn: ['Dana W.'], sentBack: 0 })).toBe('Rev 2 · shared · waiting on Dana W.')
    expect(describeBidSubmittal({ revNumber: 2, status: 'shared', roomStatus: 'open', waitingOn: ['A', 'B', 'C'], sentBack: 0 })).toBe('Rev 2 · shared · waiting on A, B +1')
    expect(describeBidSubmittal({ revNumber: 2, status: 'shared', roomStatus: 'open', waitingOn: ['Dana W.'], sentBack: 3 })).toBe('Rev 2 · shared · 3 rows sent back')
    expect(describeBidSubmittal({ revNumber: 1, status: 'draft', roomStatus: null, waitingOn: [], sentBack: 0 })).toBe('Rev 1 · draft')
    expect(describeBidSubmittal({ revNumber: 3, status: 'shared', roomStatus: 'closed', waitingOn: [], sentBack: 0 })).toBe('Rev 3 · room closed')
  })
})

describe('BidSubmittalChip', () => {
  it('reads the newest revision, the room and the people, and opens the tab', async () => {
    state.rev = { id: 'r2', rev_number: 2, status: 'shared' }
    state.room = { id: 'room', status: 'open' }
    state.items = [{ review_decision: null }, { review_decision: 'approved' }]
    state.people = [{ name: 'Dana W.', open_count: 0, may_decide: true, closed_at: null }, { name: 'Logan P.', open_count: 3, may_decide: false, closed_at: null }]
    renderWithProviders(<BidSubmittalChip bidId="b398" />)
    const chip = await screen.findByRole('button', { name: 'Rev 2 · shared · waiting on Dana W.' })
    fireEvent.click(chip)
    expect(navigate).toHaveBeenCalledWith('/bids?tab=submittals&bidId=b398')
  })
  it('a bid with no submittal reads none yet', async () => {
    state.rev = null
    renderWithProviders(<BidSubmittalChip bidId="b400" />)
    expect(await screen.findByRole('button', { name: '· none yet' })).toBeTruthy()
  })
})
