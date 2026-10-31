// @vitest-environment jsdom
/**
 * Render smoke for Bids → Adopt bids as versions (punch list #184, sweep A, PR 2): every picked
 * bid is tried past one that fails, the one that did not adopt stays picked with the reason, and
 * the window stays open on it while the package reloads.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { AdoptBidModal } from './AdoptBidModal'

const BIDS = [
  { id: 'b1', bid_number: '501', project_name: 'Cedar Bend Phase 1', customer_id: 'c1', bid_date_sent: null, bid_value: null, outcome: null },
  { id: 'b2', bid_number: '502', project_name: 'Cedar Bend Phase 2', customer_id: 'c1', bid_date_sent: null, bid_value: null, outcome: null },
  { id: 'b3', bid_number: '503', project_name: 'Cedar Bend Phase 3', customer_id: 'c1', bid_date_sent: null, bid_value: null, outcome: null },
]
const adoptCalls: string[] = []
const adoptNames: Record<string, string> = {}

vi.mock('../../lib/supabase', () => {
  function reads(data: unknown) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'is', 'neq', 'order', 'limit', 'eq', 'in', 'range']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok, bad)
    return b
  }
  return {
    supabase: {
      from: (table: string) => reads(table === 'bids' ? BIDS : []),
      rpc: async (_fn: string, args: { p_source_bid_id: string; p_name: string }) => {
        adoptCalls.push(args.p_source_bid_id)
        adoptNames[args.p_source_bid_id] = args.p_name
        return args.p_source_bid_id === 'b2' ? { error: { message: 'source bid already has versions', code: 'P0001' } } : { error: null }
      },
    },
  }
})
vi.mock('../../lib/supabasePaging', () => ({ fetchAllRowsChunkedIn: async () => [] }))
vi.mock('../../lib/bids/countRowTallies', () => ({ loadCountRowTalliesByBid: async () => new Map() }))

afterEach(() => {
  cleanup()
  adoptCalls.length = 0
  for (const k of Object.keys(adoptNames)) delete adoptNames[k]
})

const TARGET = { id: 'bt', bid_number: '500', project_name: 'Cedar Bend', customer_id: 'c1' } as unknown as BidWithBuilder

describe('Adopt bids as versions', () => {
  it('tries every picked bid, and keeps the one that did not adopt with the reason', async () => {
    const onAdopted = vi.fn()
    renderWithProviders(<AdoptBidModal targetBid={TARGET} onClose={() => {}} onAdopted={onAdopted} />)
    for (const n of ['501', '502', '503']) fireEvent.click(await screen.findByText(new RegExp(`^B${n} `)))
    fireEvent.click(screen.getByRole('button', { name: /Preview 3 moves/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Adopt 3 bids' }))
    await waitFor(() => expect(onAdopted).toHaveBeenCalledWith({ keepOpen: true }))
    // Newest bid first, and the bid after the refused one was still tried.
    expect(adoptCalls).toEqual(['b3', 'b2', 'b1'])
    expect(document.querySelector('[data-adopt-failed="502"]')?.textContent).toBe('Did not adopt · The bid did not adopt: source bid already has versions')
    expect(screen.getByText(/1 bid did not adopt\. It stays here with the reason\./)).toBeTruthy()
    // Only the one that did not adopt is still picked: one more press tries it.
    expect(screen.getByRole('button', { name: 'Adopt 1 bid' })).toBeTruthy()
  })

  it('the preview names each version in a field, and the typed name is what the function gets (v2.6252)', async () => {
    const onAdopted = vi.fn()
    renderWithProviders(<AdoptBidModal targetBid={TARGET} onClose={() => {}} onAdopted={onAdopted} />)
    fireEvent.click(await screen.findByText(/^B501 /))
    // The pick row already has the field, prefilled with the suggestion.
    const pickField = screen.getByRole('textbox', { name: 'Name of the version from B501' }) as HTMLInputElement
    expect(pickField.value).not.toBe('')
    fireEvent.click(screen.getByRole('button', { name: /Preview 1 move/ }))
    // The preview shows the same name as a field; a change here is what adopts.
    const previewField = screen.getByRole('textbox', { name: 'Name of the version from B501' }) as HTMLInputElement
    expect(previewField.value).toBe(pickField.value)
    fireEvent.change(previewField, { target: { value: 'William · Initial, Apr 7 set' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adopt 1 bid' }))
    await waitFor(() => expect(onAdopted).toHaveBeenCalled())
    expect(adoptNames.b1).toBe('William · Initial, Apr 7 set')
  })
})
