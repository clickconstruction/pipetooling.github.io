// @vitest-environment jsdom
/**
 * The chase clock as a strip of days on the Call queue (punch list #217, bids-7, a prototype): the
 * tab reads as today until a person presses *Show the strip of days*; then the header sentence goes,
 * each pending bid gets its strip — the send, the contact, the rule's diamond, the gettable tick,
 * today — and the press is remembered per person. With `?sbs=1` a dev sees both shapes, captioned.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithProviders, settle, useAuthModuleMock, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import { ToastProvider } from '../../contexts/ToastContext'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { shapeViewStorageKey } from '../prototypes/SideBySide'

import { BidsCallQueueTab } from './BidsCallQueueTab'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())

const TODAY = todayYmdInAppTz()
const SENT = ymdAddDays(TODAY, -5)
const CONTACT = ymdAddDays(TODAY, -3)
const KEY = shapeViewStorageKey('chase-clock', SMOKE_AUTH_USER_ID)

function bid(over: Partial<BidWithBuilder>): BidWithBuilder {
  return {
    id: 'bid-1',
    bid_number: '482',
    project_name: 'Library restrooms',
    bid_value: 18725,
    outcome: null,
    bid_date_sent: SENT,
    last_contact: null,
    loss_category: null,
    loss_reason: null,
    bid_tab_low: null,
    bid_tab_high: null,
    bid_tab_rank_from_low: null,
    bid_tab_bidder_count: null,
    customer_id: 'gc-sample',
    gc_builder_id: null,
    service_type_id: 'st1',
    customers: { id: 'gc-sample', name: 'Sample Builders', contact_info: { phone: '6025550000' } },
    bids_gc_builders: null,
    ...over,
  } as unknown as BidWithBuilder
}

function tab() {
  return (
    <BidsCallQueueTab
      bids={[bid({})]}
      sentScope={{ kind: 'trade', tradeId: 'st1', tradeName: 'Plumbing' }}
      gcPacketsByBid={{}}
      ledgerPrefixMap={{}}
      lastContactFromEntries={{ 'bid-1': `${CONTACT}T18:00:00.000Z` }}
      contactInstantsByBid={{ 'bid-1': [`${CONTACT}T18:00:00.000Z`] }}
      narrowViewport640={false}
      authUserId={SMOKE_AUTH_USER_ID}
      onError={() => {}}
      onReloadBids={() => {}}
      onOpenBuilderCard={() => {}}
    />
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('BidsCallQueueTab — the chase clock strip', () => {
  it('reads as today until the press; then the sentence goes and each pending bid gets its strip, remembered per person', async () => {
    const { container } = renderWithProviders(tab())
    await settle()
    // Today's look: the header sentence and the verdict words, no strip.
    expect(screen.getByText(/0 builders worth a call/)).toBeTruthy()
    expect(screen.getByText('1 of 1 fresh')).toBeTruthy()
    expect(container.querySelector('[data-chase-clock]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show the strip of days' }))
    await settle()
    expect(screen.queryByText(/0 builders worth a call/)).toBeNull()
    expect(screen.queryByText('1 of 1 fresh')).toBeNull()
    expect(container.querySelector('[data-chase-clock-legend]')).toBeTruthy()
    const strip = container.querySelector('[data-chase-clock]')!
    expect(strip).toBeTruthy()
    // The send a blue dot, the contact a filled dot, the rule's day a dashed diamond a week after it, the tab day a tick three weeks after the send, today outlined.
    expect(strip.querySelector(`[data-chase-clock-day="${SENT}"] [data-chase-clock-mark="sent"]`)).toBeTruthy()
    expect(strip.querySelector(`[data-chase-clock-day="${CONTACT}"] [data-chase-clock-mark="contact"]`)).toBeTruthy()
    expect(strip.querySelector(`[data-chase-clock-day="${ymdAddDays(CONTACT, 7)}"] [data-chase-clock-mark="default"]`)).toBeTruthy()
    expect(strip.querySelector(`[data-chase-clock-day="${ymdAddDays(SENT, 21)}"] [data-chase-clock-mark="gettable"]`)).toBeTruthy()
    expect(strip.querySelector(`[data-chase-clock-day="${TODAY}"]`)?.getAttribute('data-today')).toBe('yes')
    expect(strip.getAttribute('data-to-chase')).toBeNull()
    // The bid's own line over the strip, and the filter chips still carry their counts.
    expect(screen.getByText(/482 · Library restrooms/)).toBeTruthy()
    expect(screen.getByText('quiet 3 d')).toBeTruthy()
    expect(screen.getByRole('button', { name: /To chase/ })).toBeTruthy()
    // The three rows stay as the doors; the Chase row's verdict words are gone.
    expect(screen.getByText(/Loss reasons/)).toBeTruthy()
    expect(screen.getByText(/Bid tabs/)).toBeTruthy()
    // Remembered.
    expect(window.localStorage.getItem(KEY)).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Show today’s look' }))
    await settle()
    expect(container.querySelector('[data-chase-clock]')).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('opens on the strip when the person had it on, and marks a bid to chase once today has passed the diamond', async () => {
    window.localStorage.setItem(KEY, '1')
    const { container } = renderWithProviders(
      <BidsCallQueueTab
        bids={[bid({ bid_date_sent: ymdAddDays(TODAY, -20) })]}
        sentScope={{ kind: 'trade', tradeId: 'st1', tradeName: 'Plumbing' }}
        gcPacketsByBid={{}}
        ledgerPrefixMap={{}}
        lastContactFromEntries={{ 'bid-1': `${ymdAddDays(TODAY, -12)}T18:00:00.000Z` }}
        contactInstantsByBid={{ 'bid-1': [`${ymdAddDays(TODAY, -12)}T18:00:00.000Z`] }}
        narrowViewport640={false}
        authUserId={SMOKE_AUTH_USER_ID}
        onError={() => {}}
        onReloadBids={() => {}}
        onOpenBuilderCard={() => {}}
      />,
    )
    await settle()
    const strip = container.querySelector('[data-chase-clock]')!
    expect(strip).toBeTruthy()
    expect(strip.getAttribute('data-to-chase')).toBe('yes')
    expect(container.querySelector('[data-chase-clock-verdict]')?.textContent).toBe('to chase')
    expect(strip.querySelector(`[data-chase-clock-day="${ymdAddDays(TODAY, -5)}"] [data-chase-clock-mark="default"]`)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show today’s look' })).toBeTruthy()
  })

  it('with ?sbs=1 a dev sees today’s look and the strip one above the other, captioned, with no switch', async () => {
    render(
      <ToastProvider>
        <ConfirmDialogProvider>
          <MemoryRouter initialEntries={['/bids?tab=call-queue&sbs=1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {tab()}
          </MemoryRouter>
        </ConfirmDialogProvider>
      </ToastProvider>,
    )
    await settle()
    const sbs = await screen.findByTestId('call-queue-sbs')
    expect(sbs.querySelector('[data-side-by-side-today] p')?.textContent).toBe('Today')
    expect(sbs.querySelector('[data-side-by-side-shape] p')?.textContent).toBe('With the strip')
    expect(sbs.querySelector('[data-side-by-side-today]')?.textContent).toContain('0 builders worth a call')
    expect(sbs.querySelector('[data-side-by-side-today] [data-chase-clock]')).toBeNull()
    expect(sbs.querySelector('[data-side-by-side-shape] [data-chase-clock]')).toBeTruthy()
    expect(sbs.querySelector('[data-side-by-side-today]')?.textContent).toContain('1 of 1 fresh')
    expect(sbs.querySelector('[data-side-by-side-shape]')?.textContent).not.toContain('1 of 1 fresh')
    expect(document.querySelector('[data-shape-switch]')).toBeNull()
  })
})
