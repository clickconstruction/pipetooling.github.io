// @vitest-environment jsdom
/**
 * Render smokes for BidPriceRequestsTable's add path (v2.3495) — picking a
 * house appends a card with its own day and its own quote link, and the Save
 * button counts what it is about to write. The batch arithmetic itself is the
 * kernel's job and is tested in `src/lib/bids/bidPriceRequests.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { BidPriceRequestsTable } from './BidPriceRequestsTable'

const inserted: unknown[] = []
const invoked: Array<{ fn: string; body: Record<string, unknown> }> = []

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'robert', email: 'robert@x.test' }, profileName: 'Robert', role: 'dev' }),
}))

vi.mock('../../lib/supplyHousePickerRows', () => ({
  fetchSupplyHousePickerRows: () =>
    Promise.resolve([
      { id: 'ferguson', name: 'Ferguson' },
      { id: 'moore', name: 'Moore Supply' },
    ]),
}))

vi.mock('../../lib/userDisplayNames', () => ({
  fetchUserDisplayNames: () => Promise.resolve([]),
  userDisplayLabel: () => 'Robert',
}))

vi.mock('../../lib/supabase', () => {
  const listResult = (data: unknown[]) => {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'not', 'is']) builder[m] = () => builder
    ;(builder as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(res)
    return builder
  }
  const versionResult = () => {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit']) builder[m] = () => builder
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
    return builder
  }
  return {
    supabase: {
      from: (table: string) => ({
        ...(table === 'bid_versions' ? versionResult() : listResult([])),
        insert: (rows: unknown) => {
          if (table === 'bid_rfqs') inserted.push(rows)
          return Promise.resolve({ error: null })
        },
      }),
      functions: {
        invoke: (fn: string, opts: { body: Record<string, unknown> }) => {
          invoked.push({ fn, body: opts.body })
          if (opts.body.mode === 'preview') return Promise.resolve({ data: { ok: true, previews: [{ subject: 'Price request · B1 · 0 items', text: 'Bid: B1' }] }, error: null })
          return Promise.resolve({ data: { ok: true, results: [{ ok: true }] }, error: null })
        },
      },
    },
  }
})

function renderTable() {
  return renderWithProviders(
    <BidPriceRequestsTable bidId="bid-1" serviceTypeId={null} pricingHref="/bids?tab=pricing&bidId=bid-1" />,
  )
}

describe('BidPriceRequestsTable — the add block (v2.3495)', () => {
  it('mounts with no requests and offers the add button', async () => {
    renderTable()
    expect(await screen.findByText('No price requests on this bid yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Add a request' })).toBeTruthy()
  })

  it('picks a house, shows its own day and quote link, then counts a second house', async () => {
    renderTable()
    await settle()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add a request' }))

    // The picker opens straight away on the first house.
    fireEvent.click(await screen.findByRole('button', { name: /Ferguson/ }))
    expect(await screen.findByLabelText('When the Ferguson request went out')).toBeTruthy()
    expect(screen.getByLabelText('Quote link for Ferguson')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add request' })).toBeTruthy()

    // The second house comes from the explicit door.
    fireEvent.click(screen.getByRole('button', { name: '+ Add another supply house' }))
    fireEvent.click(await screen.findByRole('button', { name: /Moore Supply/ }))

    expect(await screen.findByLabelText('Quote link for Moore Supply')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add 2 requests' })).toBeTruthy()

    // Removing one puts the count back.
    fireEvent.click(screen.getByRole('button', { name: 'Remove Moore Supply' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add request' })).toBeTruthy())
  })

  it('Add N requests writes every card as one insert, each with its own day and link', async () => {
    renderTable()
    await settle()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add a request' }))
    fireEvent.click(await screen.findByRole('button', { name: /Ferguson/ }))
    fireEvent.change(await screen.findByLabelText('Quote link for Ferguson'), { target: { value: 'drive.google.com/file/d/abc' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Add another supply house' }))
    fireEvent.click(await screen.findByRole('button', { name: /Moore Supply/ }))
    fireEvent.change(await screen.findByLabelText('When the Moore Supply request went out'), { target: { value: '2026-09-14' } })

    fireEvent.click(screen.getByRole('button', { name: 'Add 2 requests' }))

    await waitFor(() => expect(inserted).toHaveLength(1))
    const rows = inserted[0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ bid_id: 'bid-1', supply_house_id: 'ferguson', sent_via: 'outside', status: 'sent', quote_url: null, request_url: 'https://drive.google.com/file/d/abc', created_by: 'robert' })
    expect(rows[1]).toMatchObject({ supply_house_id: 'moore', requested_on: '2026-09-14', request_url: null, status: 'sent' })
    // The block closes once the write lands.
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add a request' })).toBeTruthy())
    inserted.length = 0
  })

  it('Cancel closes the block and writes nothing', async () => {
    renderTable()
    await settle()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add a request' }))
    fireEvent.click(await screen.findByRole('button', { name: /Ferguson/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add a request' })).toBeTruthy())
    expect(screen.queryByLabelText('Quote link for Ferguson')).toBeNull()
    expect(inserted).toHaveLength(0)
  })

  it('v2.3526: a house with no rep starts as I’ll send it; flipped to the app with an address, Ask emails it and records nothing itself', async () => {
    renderTable()
    await settle()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add a request' }))
    fireEvent.click(await screen.findByRole('button', { name: /Ferguson/ }))
    const group = await screen.findByRole('group', { name: 'How Ferguson is asked' })
    const app = group.querySelector('[data-ask-how="app"]') as HTMLButtonElement
    const outside = group.querySelector('[data-ask-how="outside"]') as HTMLButtonElement
    expect(outside.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Add request' })).toBeTruthy()

    fireEvent.click(app)
    expect(app.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Ask by email' })).toBeTruthy()
    // No address yet: Ask refuses and names the way out.
    fireEvent.click(screen.getByRole('button', { name: 'Ask by email' }))
    expect(await screen.findByText(/No address to email/)).toBeTruthy()
    expect(invoked).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Address the app emails for Ferguson'), { target: { value: 'dan@ferguson.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview the email' }))
    expect(await screen.findByTestId('ask-preview')).toBeTruthy()
    expect(invoked[0]!).toMatchObject({ fn: 'send-rfq-email', body: { mode: 'preview', bidId: 'bid-1' } })

    fireEvent.click(screen.getByRole('button', { name: 'Ask by email' }))
    await waitFor(() => expect(invoked).toHaveLength(2))
    expect(invoked[1]!.body).toMatchObject({ mode: 'send', bidId: 'bid-1', requests: [{ supplyHouseId: 'ferguson', email: 'dan@ferguson.com' }] })
    expect(inserted).toHaveLength(0)
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add a request' })).toBeTruthy())
  })
})
