// @vitest-environment jsdom
/**
 * The chase clock on Waiting to hear (punch list #217, bids-7, a prototype): the open bid reads
 * *Last contact …* and the paragraph names the seven days until a person presses *Show the strip
 * of days*; then the bid's clock draws under its title and the seven days are the dashed diamond.
 * The press is the Call queue's, remembered per person. With `?sbs=1` a dev sees both.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithProviders, settle, useAuthModuleMock, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import { ToastProvider } from '../../contexts/ToastContext'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { shapeViewStorageKey } from '../prototypes/SideBySide'

import { BidsWaitingToHearLens } from './BidsWaitingToHearLens'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

/** Every read answers empty: the story panel and the tab ladder stay quiet, and nothing throws. */
function emptyQuery(): unknown {
  const q: Record<string, unknown> = {}
  const chain = () => q
  for (const m of ['select', 'in', 'eq', 'not', 'order', 'limit', 'range', 'insert', 'update']) q[m] = chain
  q.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
  return q
}
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => emptyQuery() } }))
vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())

const TODAY = todayYmdInAppTz()
const SENT = ymdAddDays(TODAY, -5)
const CONTACT = ymdAddDays(TODAY, -3)
const KEY = shapeViewStorageKey('chase-clock', SMOKE_AUTH_USER_ID)

function bid(): BidWithBuilder {
  return {
    id: 'bid-1',
    bid_number: '482',
    project_name: 'Library restrooms',
    bid_value: 18725,
    outcome: null,
    bid_date_sent: SENT,
    last_contact: `${CONTACT}T18:00:00.000Z`,
    loss_category: null,
    loss_reason: null,
    bid_tab_low: null,
    bid_tab_high: null,
    bid_tab_rank_from_low: null,
    bid_tab_bidder_count: null,
    customer_id: 'gc-sample',
    gc_builder_id: null,
    service_type_id: 'st1',
    address: null,
    customers: { id: 'gc-sample', name: 'Sample Builders', contact_info: { phone: '6025550000' } },
    bids_gc_builders: null,
  } as unknown as BidWithBuilder
}

function lens() {
  return (
    <BidsWaitingToHearLens
      bids={[bid()]}
      sentScope={{ kind: 'trade', tradeId: 'st1', tradeName: 'Plumbing' }}
      gcPacketsByBid={{}}
      ledgerPrefixMap={{}}
      lastContactFromEntries={{}}
      recipientsByBidId={{}}
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

describe('BidsWaitingToHearLens — the chase clock strip', () => {
  it('reads Last contact and the seven days until the press; then the open bid’s clock draws and the rule is the dashed diamond', async () => {
    const { container } = renderWithProviders(lens())
    await settle()
    expect(screen.getByText(/Last contact/)).toBeTruthy()
    expect(screen.getByText(/in over 7 days/)).toBeTruthy()
    expect(container.querySelector('[data-waiting-chase-clock]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show the strip of days' }))
    await settle()
    expect(screen.queryByText(/Last contact/)).toBeNull()
    expect(screen.queryByText(/in over 7 days/)).toBeNull()
    const strip = container.querySelector('[data-waiting-chase-clock] [data-chase-clock]')!
    expect(strip).toBeTruthy()
    expect(strip.querySelector(`[data-chase-clock-day="${SENT}"] [data-chase-clock-mark="sent"]`)).toBeTruthy()
    expect(strip.querySelector(`[data-chase-clock-day="${CONTACT}"] [data-chase-clock-mark="contact"]`)).toBeTruthy()
    expect(strip.querySelector(`[data-chase-clock-day="${ymdAddDays(CONTACT, 7)}"] [data-chase-clock-mark="default"]`)).toBeTruthy()
    expect(strip.querySelector(`[data-chase-clock-day="${ymdAddDays(SENT, 21)}"] [data-chase-clock-mark="gettable"]`)).toBeTruthy()
    expect(container.querySelector('[data-waiting-chase-clock] [data-chase-clock-legend]')).toBeTruthy()
    // The one-tap chips stay under the strip.
    expect(screen.getByText('Left message')).toBeTruthy()
    expect(window.localStorage.getItem(KEY)).toBe('1')
  })

  it('with ?sbs=1 a dev sees the Last contact line and the strip one above the other, captioned, with no switch', async () => {
    render(
      <ToastProvider>
        <ConfirmDialogProvider>
          <MemoryRouter initialEntries={['/bids?tab=waiting-to-hear&sbs=1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {lens()}
          </MemoryRouter>
        </ConfirmDialogProvider>
      </ToastProvider>,
    )
    await settle()
    const sbs = await screen.findByTestId('waiting-to-hear-sbs')
    expect(sbs.querySelector('[data-side-by-side-today] p')?.textContent).toBe('Today')
    expect(sbs.querySelector('[data-side-by-side-shape] p')?.textContent).toBe('With the strip')
    expect(sbs.querySelector('[data-side-by-side-today]')?.textContent).toContain('Last contact')
    expect(sbs.querySelector('[data-side-by-side-shape] [data-chase-clock]')).toBeTruthy()
    expect(document.querySelector('[data-shape-switch]')).toBeNull()
    // The paragraph keeps today's words beside both shapes.
    expect(screen.getByText(/in over 7 days/)).toBeTruthy()
  })
})
