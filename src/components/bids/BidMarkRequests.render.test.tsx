// @vitest-environment jsdom
/**
 * Render smoke for marks for a teammate (v2.4297), from both ends:
 *   - the receiver's picker row: the sender's initial with the not-opened dot, the note on the
 *     row, the card's Done, H on the row, and the Marked filter keeping the bid;
 *   - the sender's picker row: the outlined initial, "for Robert · seen …", Take it back;
 *   - the open bid's title: For someone… with the bid's estimator first, the note, the call;
 *     and the strip under the title marking it seen and finishing with Done or Not for me.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

const H = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../lib/supabase', async () => {
  const m = await import('../../test/renderSmokeMocks')
  const stub = m.makeSupabaseStub() as Record<string, unknown>
  return { supabase: { ...stub, rpc: (...args: unknown[]) => H.rpc(...args) } }
})

import { renderWithProviders as render } from '../../test/renderSmokeMocks'
import { BidPickerStandardList } from './BidPickerStandardList'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { getBidMarksSnapshot, resetBidMarksStoreForTests, setOnlyMarkedBids } from '../../lib/bids/bidMarksStore'
import { resetBidMarkHoldsForTests } from '../../lib/bids/bidMarkHold'
import type { BidMarkRequest } from '../../lib/bids/bidMarkRequests'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { Bid } from '../../types/bids'

const PEOPLE = {
  robert: { id: 'robert', name: 'Robert', role: 'dev' },
  wendi: { id: 'wendi', name: 'Wendi', role: 'assistant' },
  malachi: { id: 'malachi', name: 'Malachi', role: 'master_technician' },
}

function bid(over: Partial<BidWithBuilder> & { id: string; bid_number: string }): BidWithBuilder {
  return {
    project_name: `Project ${over.bid_number}`,
    address: '1 Main St',
    outcome: null,
    bid_date_sent: null,
    bid_due_date: null,
    bid_value: null,
    working_board_archived_at: null,
    service_type_id: null,
    customers: null,
    bids_gc_builders: null,
    estimator_id: null,
    account_manager_id: null,
    ...over,
  } as unknown as BidWithBuilder
}

const ROWS = [bid({ id: 'u1', bid_number: '494' }), bid({ id: 'u2', bid_number: '491' }), bid({ id: 'u3', bid_number: '488' })]

function req(over: Partial<BidMarkRequest> & { id: string }): BidMarkRequest {
  return {
    bid_id: 'u1',
    for_user_id: 'robert',
    from_user_id: 'wendi',
    note: 'GC moved the due date to Fri. Reprice the trim.',
    created_at: new Date().toISOString(),
    seen_at: null,
    closed_at: null,
    outcome: null,
    ...over,
  }
}

function asRobert(requests: BidMarkRequest[]) {
  resetBidMarksStoreForTests(undefined, { me: 'robert', people: PEOPLE, requests })
}

function wrapOf(bidNumber: string): HTMLElement {
  return screen.getByText(new RegExp(`Project ${bidNumber}`)).closest('.bid-mark-rowwrap') as HTMLElement
}

beforeEach(() => {
  H.rpc.mockReset()
  H.rpc.mockResolvedValue({ data: 1, error: null })
  resetBidMarksStoreForTests()
  resetBidMarkHoldsForTests()
})
afterEach(() => cleanup())

describe('the receiver', () => {
  it('the row wears the sender’s initial with the not-opened dot and the note, and the card’s Done finishes it', async () => {
    asRobert([req({ id: 'r1' })])
    render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
    const initial = screen.getByRole('button', { name: /Wendi marked this for you, not opened yet/ })
    expect(initial.textContent).toContain('W')
    expect(screen.getByText('Wendi: GC moved the due date to Fri. Reprice the trim.')).toBeTruthy()
    expect(wrapOf('494').dataset.marked).toBe('true')
    fireEvent.click(initial)
    const card = screen.getByRole('dialog', { name: 'Marked for you' })
    fireEvent.click(within(card).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(H.rpc).toHaveBeenCalledWith('bid_mark_requests_close', { p_bid_id: 'u1', p_outcome: 'done' }))
    expect(getBidMarksSnapshot().requests[0]).toMatchObject({ outcome: 'done' })
    expect(wrapOf('494').dataset.marked).toBeUndefined()
    expect(screen.queryByText(/Wendi: GC moved/)).toBeNull()
  })

  it('H on the row finishes it instead of making an own mark; Not for me passes it back', async () => {
    asRobert([req({ id: 'r1' }), req({ id: 'r2', bid_id: 'u2' })])
    render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
    const row = wrapOf('494').querySelector('.bid-mark-row-main') as HTMLElement
    fireEvent.keyDown(row, { key: 'h' })
    await waitFor(() => expect(H.rpc).toHaveBeenCalledWith('bid_mark_requests_close', { p_bid_id: 'u1', p_outcome: 'done' }))
    expect(getBidMarksSnapshot().marks).toEqual({})
    fireEvent.click(screen.getByRole('button', { name: /Wendi marked this for you/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Marked for you' })).getByRole('button', { name: 'Not for me' }))
    await waitFor(() => expect(H.rpc).toHaveBeenCalledWith('bid_mark_requests_close', { p_bid_id: 'u2', p_outcome: 'not_for_me' }))
  })

  it('the Marked filter keeps a bid marked for you', () => {
    asRobert([req({ id: 'r1', bid_id: 'u3' })])
    setOnlyMarkedBids(true)
    render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
    expect(screen.getByText(/Project 488/)).toBeTruthy()
    expect(screen.queryByText(/Project 494/)).toBeNull()
  })
})

describe('the sender', () => {
  it('the row wears the receiver’s initial outlined and where it stands; Take it back closes it', async () => {
    resetBidMarksStoreForTests(undefined, {
      me: 'wendi',
      people: PEOPLE,
      requests: [req({ id: 'r1', bid_id: 'u2', seen_at: new Date().toISOString() })],
    })
    render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
    expect(screen.getByText('for Robert · seen today')).toBeTruthy()
    expect(wrapOf('491').dataset.marked).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: /You marked this for Robert/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Marked for Robert' })).getByRole('button', { name: 'Take it back' }))
    await waitFor(() => expect(H.rpc).toHaveBeenCalledWith('bid_mark_request_take_back', { p_request_id: 'r1' }))
    expect(screen.queryByText(/for Robert/)).toBeNull()
  })

  it('a finished mark reads done', () => {
    resetBidMarksStoreForTests(undefined, {
      me: 'wendi',
      people: PEOPLE,
      requests: [req({ id: 'r1', bid_id: 'u2', seen_at: new Date().toISOString(), closed_at: new Date().toISOString(), outcome: 'done' })],
    })
    render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
    expect(screen.getByText('Robert is done · today')).toBeTruthy()
  })
})

describe('the open bid’s title', () => {
  const openBid = { id: 'u1', bid_number: '494', project_name: 'SPACEX', estimator_id: 'robert', account_manager_id: 'wendi', service_type_id: null } as unknown as Bid

  it('For someone… offers the bid’s estimator first and marks it with the note', async () => {
    resetBidMarksStoreForTests(undefined, { me: 'wendi', people: PEOPLE })
    H.rpc.mockImplementation(async (fn: string) => ({ data: fn === 'mark_bid_for' ? 'new-id' : false, error: null }))
    render(<BidWorkflowTabTitleWithPreview bid={openBid} previewEnabled={false} onOpenPreview={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /For someone/ }))
    const form = screen.getByRole('dialog', { name: 'Mark this bid for someone' })
    const robert = within(form).getByRole('button', { name: /Robert\s*Estimator/ })
    await waitFor(() => expect(robert.getAttribute('aria-pressed')).toBe('true'))
    expect(within(form).queryByRole('button', { name: /^Wendi/ })).toBeNull()
    fireEvent.change(within(form).getByLabelText(/What should they look at/), { target: { value: '  Reprice the trim.  ' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Mark for Robert' }))
    await waitFor(() => expect(H.rpc).toHaveBeenCalledWith('mark_bid_for', { p_bid_id: 'u1', p_for_user_id: 'robert', p_note: 'Reprice the trim.' }))
    expect(H.rpc).toHaveBeenCalledWith('user_has_push_device', { p_user_id: 'robert' })
  })

  it('the strip under the title shows the note, marks it seen, and Done finishes it', async () => {
    asRobert([req({ id: 'r1' })])
    render(<BidWorkflowTabTitleWithPreview bid={openBid} previewEnabled={false} onOpenPreview={vi.fn()} />)
    const strip = screen.getByRole('note', { name: 'Marked for you' })
    expect(within(strip).getByText('GC moved the due date to Fri. Reprice the trim.')).toBeTruthy()
    await waitFor(() => expect(H.rpc).toHaveBeenCalledWith('bid_mark_requests_seen', { p_bid_id: 'u1' }))
    fireEvent.click(within(strip).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(H.rpc).toHaveBeenCalledWith('bid_mark_requests_close', { p_bid_id: 'u1', p_outcome: 'done' }))
    expect(screen.queryByRole('note', { name: 'Marked for you' })).toBeNull()
  })
})
