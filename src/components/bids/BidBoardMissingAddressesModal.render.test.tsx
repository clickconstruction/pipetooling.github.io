// @vitest-environment jsdom
/**
 * The Bid Board's missing-address sheet and the memory of a miss (punch list #441): a row whose
 * address no map service could place says why, the day it was checked and the day the app asks
 * again, each day drawn as a value, and **Try again** beside **Save** asks now and says what it
 * found. A bid with no address keeps its own words and has no such press. Every address is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BidBoardMissingAddressesModal } from './BidBoardMissingAddressesModal'
import type { BidBoardMapBid } from '../../lib/bids/bidBoardMap'
import { composeMissingAddressRows } from '../../lib/bids/bidBoardMissingAddresses'
import type { TryAgainOutcome } from '../../lib/map/unplacedMemory'

vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: vi.fn() }))

const KEY = 'zz the pasture behind the made up barn'
function mapBid(id: string, address = '', addressKey = ''): BidBoardMapBid {
  return {
    id,
    label: `B${id} · ZZ Test`,
    numberLabel: `B${id}`,
    projectName: 'ZZ Test',
    gcName: null,
    address,
    addressKey,
    section: 'unsent',
    dueTone: null,
    dueLabel: null,
    estimatorName: null,
    distanceMiles: null,
    valueLabel: null,
    row: { customers: null, bids_gc_builders: null } as unknown as BidBoardMapBid['row'],
  } as BidBoardMapBid
}
const bare = mapBid('901')
const words = mapBid('902', 'ZZ the pasture behind the made up barn', KEY)
const miss = (checked_at: string | null) => (checked_at ? new Map([[KEY, { address_normalized: KEY, error_code: 'not_found', detail: null, checked_at }]]) : new Map())

function sheet(over: { checkedAt?: string | null; resolving?: boolean; isMobile?: boolean; onTryAgain?: (bid: BidBoardMapBid) => Promise<TryAgainOutcome> } = {}) {
  const props = {
    open: true,
    rows: composeMissingAddressRows({ noAddress: [bare], unmapped: [words], pins: [], resolving: over.resolving ?? false, keepIds: new Set<string>(), misses: miss(over.checkedAt === undefined ? '2026-11-20T18:00:00Z' : over.checkedAt) }),
    isMobile: over.isMobile ?? false,
    onClose: vi.fn(),
    onSave: vi.fn(async () => true),
    onTryAgain: vi.fn(over.onTryAgain ?? (async (): Promise<TryAgainOutcome> => ({ kind: 'placed' }))),
    onEditBid: vi.fn(),
    onFocusRow: vi.fn(),
  }
  render(<BidBoardMissingAddressesModal {...props} />)
  const items = [...document.querySelectorAll('li')]
  const noAddressRow = items[0] as HTMLElement
  const missRow = items[1] as HTMLElement
  return { props, noAddressRow, missRow }
}

afterEach(cleanup)

describe('BidBoardMissingAddressesModal · an address nobody could place (punch list #441)', () => {
  it('says why, the day it was checked and the day the app asks again, with Try again beside Save', () => {
    const { missRow } = sheet()
    expect(missRow.querySelector('[data-miss-reason]')!.textContent).toBe('No map service could find this address.')
    const checked = missRow.querySelector('[data-miss-checked]')!
    expect(checked.textContent).toBe('Checked Nov 20. The app asks again by itself on Dec 20.')
    expect([...checked.querySelectorAll('[data-value="worked-out"]')].map((b) => b.textContent)).toEqual(['Nov 20', 'Dec 20'])
    const tryAgain = within(missRow).getByRole('button', { name: 'Try again' })
    expect(tryAgain.parentElement).toBe(within(missRow).getByRole('button', { name: 'Save' }).parentElement)
    // The row's own words stay.
    expect(missRow.textContent).toContain('The map couldn’t find this address.')
  })

  it('a bid with no address keeps its own words, with no day line and no Try again', () => {
    const { noAddressRow } = sheet()
    expect(noAddressRow.textContent).toContain('No address on the bid')
    expect(noAddressRow.querySelector('[data-miss-memory]')).toBeNull()
    expect(within(noAddressRow).queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(1)
  })

  it('a miss nobody kept has no day line, and still offers Try again', () => {
    const { missRow } = sheet({ checkedAt: null })
    expect(missRow.querySelector('[data-miss-memory]')).toBeNull()
    expect(within(missRow).getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('while the map is still looking, there is no Try again', () => {
    const { missRow } = sheet({ resolving: true })
    expect(missRow.textContent).toContain('Looking for this address on the map…')
    expect(within(missRow).queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(missRow.querySelector('[data-miss-memory]')).toBeNull()
  })

  it('Try again asks once about the bid, is dead while it asks, and says a placed address', async () => {
    let answer: (o: TryAgainOutcome) => void = () => {}
    const { props, missRow } = sheet({ onTryAgain: () => new Promise<TryAgainOutcome>((r) => { answer = r }) })
    fireEvent.click(within(missRow).getByRole('button', { name: 'Try again' }))
    const asking = await within(missRow).findByRole('button', { name: 'Asking the map services…' })
    expect((asking as HTMLButtonElement).disabled).toBe(true)
    answer({ kind: 'placed' })
    await waitFor(() => expect(missRow.querySelector('[data-try-again-result="placed"]')).not.toBeNull())
    expect(missRow.querySelector('[data-try-again-result]')!.textContent).toBe('Placed. Its pin is on the map.')
    expect(props.onTryAgain).toHaveBeenCalledTimes(1)
    expect(props.onTryAgain).toHaveBeenCalledWith(words)
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('Try again that still finds no match moves the day and points at the box', async () => {
    const now = new Date().toISOString()
    const { missRow } = sheet({ onTryAgain: async () => ({ kind: 'missed', reason: 'No map service could find this address.', checkedAt: now }) })
    fireEvent.click(within(missRow).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(missRow.querySelector('[data-try-again-result="missed"]')).not.toBeNull())
    expect(missRow.querySelector('[data-try-again-result]')!.textContent).toBe('Still no match. Fix the address in the box and save to place it.')
    expect(missRow.querySelector('[data-miss-checked]')!.textContent).not.toContain('Nov 20.')
    // The press is live again for another try.
    expect((within(missRow).getByRole('button', { name: 'Try again' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a failed ask says the reason in red and keeps the day the app had', async () => {
    const { missRow } = sheet({ onTryAgain: async () => ({ kind: 'failed', reason: 'Lost signal.' }) })
    fireEvent.click(within(missRow).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(missRow.querySelector('[data-try-again-result="failed"]')).not.toBeNull())
    const result = missRow.querySelector('[data-try-again-result]') as HTMLElement
    expect(result.textContent).toBe('Could not ask the map services. Lost signal.')
    expect(result.style.color).toBe('var(--text-red-700)')
    expect(missRow.querySelector('[data-miss-checked]')!.textContent).toBe('Checked Nov 20. The app asks again by itself on Dec 20.')
  })

  it('on a phone the press takes a thumb', () => {
    const { missRow } = sheet({ isMobile: true })
    expect((within(missRow).getByRole('button', { name: 'Try again' }) as HTMLElement).style.minHeight).toBe('44px')
  })

  it('on a phone the four text presses take a thumb inside their line, and at a desk keep their size', () => {
    const names = ['B902', 'Check on Google Maps ↗', 'Edit bid']
    const phone = sheet({ isMobile: true })
    for (const name of names) {
      const press = within(phone.missRow).getByRole('button', { name }) as HTMLElement
      expect(press.style.minHeight, name).toBe('44px')
      expect(press.style.display, name).toBe('inline-flex')
      // The line gets back what the press grew by, so the row is as tall as it was.
      expect(parseFloat(press.style.marginTop), name).toBeLessThan(0)
      expect(press.style.marginBottom, name).toBe(press.style.marginTop)
    }
    cleanup()
    const desk = sheet()
    for (const name of names) expect((within(desk.missRow).getByRole('button', { name }) as HTMLElement).style.minHeight, name).toBe('')
  })

  it('Use it, offered beside a customer’s address on file, takes a thumb on a phone too', () => {
    const withCustomer = { ...bare, row: { customers: { address: '100 ZZ Test Lane, Austin, TX 78701' }, bids_gc_builders: null } as unknown as BidBoardMapBid['row'] }
    const rows = composeMissingAddressRows({ noAddress: [withCustomer], unmapped: [], pins: [], resolving: false, keepIds: new Set<string>(), misses: new Map() })
    expect(rows[0]!.customerAddress).toBe('100 ZZ Test Lane, Austin, TX 78701')
    const props = { open: true, rows, onClose: vi.fn(), onSave: vi.fn(async () => true), onTryAgain: vi.fn(async (): Promise<TryAgainOutcome> => ({ kind: 'placed' })), onEditBid: vi.fn(), onFocusRow: vi.fn() }
    const phone = render(<BidBoardMissingAddressesModal {...props} isMobile />)
    expect((screen.getByRole('button', { name: 'Use it' }) as HTMLElement).style.minHeight).toBe('44px')
    phone.unmount()
    render(<BidBoardMissingAddressesModal {...props} isMobile={false} />)
    expect((screen.getByRole('button', { name: 'Use it' }) as HTMLElement).style.minHeight).toBe('')
  })
})
