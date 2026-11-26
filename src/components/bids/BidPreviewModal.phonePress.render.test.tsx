// @vitest-environment jsdom
/**
 * The Bid window's presses on a phone (punch list #426, the live walk of 2026-11-24 and the live look after it).
 * **Copy for text**, **Edit bid** and the ✕ stand 44 px tall at a phone's width, the ✕ as wide. The *Open in Bids*
 * tabs and the *Files & links* chips stand 44 px tall. **Map**, the development's door, the GC's name and **Show all
 * fields** are padded to 44 px, with a margin that gives the same back. At a desk each keeps its drawn size.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { stubPhoneWidth } from '../../test/phoneWidth'
import { BidPreviewModal } from './BidPreviewModal'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/developments/fetchRecordQuestions', () => ({ fetchRecordQuestions: async () => ({ requests: [], names: new Map<string, string>() }) }))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  stubPhoneWidth(false)
})

const BID = {
  id: 'bid-1',
  bid_number: '418',
  project_name: 'Lodge',
  address: null,
  service_type_id: null,
  customer_id: null,
  customers: null,
  bids_gc_builders: null,
  outcome: null,
  bid_due_date: null,
  bid_date_sent: null,
  bid_value: null,
  notes: null,
  itb_links: null,
  plans_link: null,
  estimator: null,
  account_manager: null,
  development: null,
} as unknown as BidWithBuilder

const draw = () => renderWithProviders(<BidPreviewModal bid={BID} loading={false} error={null} onClose={() => {}} onNavigateToBidsTab={() => {}} onRequestEditBid={() => {}} />)

describe('BidPreviewModal · the top presses on a phone', () => {
  it('at a phone’s width the head stacks: the name with the ✕ at its right, Copy for text and Edit bid on the line under (punch list #426, finding 262)', async () => {
    stubPhoneWidth(true)
    draw()
    const copy = await screen.findByRole('button', { name: 'Copy for text' })
    const head = document.querySelector('[data-bid-head]') as HTMLElement
    expect(head.dataset.bidHead).toBe('stacked')
    expect(head.style.display).toBe('grid')
    const name = head.querySelector('[data-bid-head-name]') as HTMLElement
    const under = head.querySelector('[data-bid-head-presses]') as HTMLElement
    const close = screen.getByRole('button', { name: 'Close' })
    // The name's block and the two presses' block are not on one row: the presses span the head's whole width, under.
    expect(under.dataset.bidHeadPresses).toBe('under')
    expect(under.style.gridColumn).toBe('1 / -1')
    expect(name.contains(under)).toBe(false)
    expect([...under.querySelectorAll('button')]).toEqual([copy, screen.getByRole('button', { name: 'Edit bid' })])
    // The ✕ is the head's own child, right after the name, so it sits at the name's right on the first line.
    expect(close.parentElement).toBe(head)
    expect(name.nextElementSibling).toBe(close)
    expect(name.textContent).toContain('Lodge')
  })

  it('at a desk the head is one row, with the three presses beside the name as before', async () => {
    stubPhoneWidth(false)
    draw()
    await screen.findByRole('button', { name: 'Copy for text' })
    const head = document.querySelector('[data-bid-head]') as HTMLElement
    expect(head.dataset.bidHead).toBe('row')
    expect(head.style.display).toBe('flex')
    const beside = head.querySelector('[data-bid-head-presses]') as HTMLElement
    expect(beside.dataset.bidHeadPresses).toBe('beside')
    expect([...beside.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Copy for text', 'Edit bid', 'Close'])
  })

  it('at a phone’s width Copy for text, Edit bid and the ✕ stand 44 px tall, and the ✕ is as wide', async () => {
    stubPhoneWidth(true)
    draw()
    const copy = await screen.findByRole('button', { name: 'Copy for text' })
    const edit = screen.getByRole('button', { name: 'Edit bid' })
    const close = screen.getByRole('button', { name: 'Close' })
    expect(copy.style.minHeight).toBe('44px')
    expect(edit.style.minHeight).toBe('44px')
    expect(close.style.minHeight).toBe('44px')
    expect(close.style.minWidth).toBe('44px')
  })

  it('at a desk each keeps the size it was drawn', async () => {
    stubPhoneWidth(false)
    draw()
    const copy = await screen.findByRole('button', { name: 'Copy for text' })
    expect(copy.style.minHeight).toBe('')
    expect(screen.getByRole('button', { name: 'Edit bid' }).style.minHeight).toBe('')
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close.style.minHeight).toBe('')
    expect(close.style.minWidth).toBe('')
  })
})

/** A bid with every press the window can draw in its body: an address, a development, a GC and one file link. */
const FULL_BID = {
  ...BID,
  address: '12 Cedar Bend',
  customer_id: 'cust-1',
  customers: { name: 'Sample Contracting' },
  development: { id: 'dev-1', name: 'Cedar Bend' },
  drive_link: 'https://drive.example.com/folder',
} as unknown as BidWithBuilder

const drawFull = () => renderWithProviders(<BidPreviewModal bid={FULL_BID} loading={false} error={null} onClose={() => {}} onNavigateToBidsTab={() => {}} onRequestEditBid={() => {}} />)

describe('BidPreviewModal · the presses in the window’s body on a phone', () => {
  it('at a phone’s width the tabs and the file chips stand 44 px tall', async () => {
    stubPhoneWidth(true)
    drawFull()
    const tab = await screen.findByRole('button', { name: 'Bid Board' })
    expect(tab.style.minHeight).toBe('44px')
    expect(screen.getByRole('link', { name: 'Drive folder' }).style.minHeight).toBe('44px')
    // A chip with no link is not a press, and stands as tall so the row stays even.
    expect(screen.getByText('Plans — none').style.minHeight).toBe('44px')
  })

  it('at a phone’s width Map, the development’s door, the GC’s name and Show all fields are padded to 44 px', async () => {
    stubPhoneWidth(true)
    drawFull()
    const map = await screen.findByRole('link', { name: 'Map' })
    expect(map.style.padding).toBe('14px 8.5px')
    expect(map.style.margin).toBe('-14px -8.5px')
    const door = screen.getByTestId('bid-preview-development')
    expect(door.style.padding).toBe('14.5px 0px')
    expect(door.style.margin).toBe('-10.5px 0px -14.5px')
    const gc = screen.getByRole('button', { name: 'Sample Contracting' })
    expect(gc.style.padding).toBe('11px 0px')
    expect(gc.style.margin).toBe('-11px 0px')
    const all = screen.getByRole('button', { name: 'Show all fields' })
    expect(all.style.padding).toBe('13px 0px')
    expect(all.style.margin).toBe('-13px 0px')
  })

  it('at a desk each keeps the size it was drawn', async () => {
    stubPhoneWidth(false)
    drawFull()
    const tab = await screen.findByRole('button', { name: 'Bid Board' })
    expect(tab.style.minHeight).toBe('')
    expect(screen.getByRole('link', { name: 'Drive folder' }).style.minHeight).toBe('')
    const map = screen.getByRole('link', { name: 'Map' })
    expect(map.style.padding).toBe('')
    expect(map.style.margin).toBe('')
    expect(screen.getByTestId('bid-preview-development').style.margin).toBe('4px 0px 0px')
    expect(screen.getByRole('button', { name: 'Sample Contracting' }).style.padding).toBe('0px')
    expect(screen.getByRole('button', { name: 'Show all fields' }).style.padding).toBe('0px')
  })
})
