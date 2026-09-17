// @vitest-environment jsdom
/**
 * Render smoke for the price-requests table's rows (PR 3, v2.3572): the Status chip per row,
 * the how-it-went chip beside the date, the Quote column holding only the quote — a paste box
 * on a waiting hand-sent row that writes `quote_url` on Enter — and Call on a hand-sent row
 * whose default rep has a phone. Three rows: a late app request, a quoted hand-sent one, and a
 * waiting hand-sent one.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidPriceRequestsTable } from './BidPriceRequestsTable'

const updates: Array<{ table: string; patch: Record<string, unknown>; id: string | null }> = []

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'robert', email: 'robert@x.test' }, profileName: 'Robert', role: 'dev' }),
}))
vi.mock('../../lib/supplyHousePickerRows', () => ({
  fetchSupplyHousePickerRows: () => Promise.resolve([{ id: 'ferguson', name: 'Ferguson' }, { id: 'nws', name: 'National Wholesale' }]),
}))
vi.mock('../../lib/userDisplayNames', () => ({
  fetchUserDisplayNames: () => Promise.resolve([]),
  userDisplayLabel: () => 'Robert',
}))
vi.mock('../../utils/dateUtils', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../utils/dateUtils')>()
  return { ...mod, todayYmdInAppTz: () => '2026-09-16' }
})

const RFQS = [
  { id: 'r-late', sent_via: 'app', supply_house_id: 'ferguson', sent_to: 'Ferguson', sent_email: 'dan@ferguson.com', status: 'sent', token: 'tok1', created_at: '2026-09-02T15:00:00Z', created_by: 'robert', viewed_at: null, needed_by: '2026-09-09', requested_on: null, request_url: null, quote_url: null, last_reminded_at: null, reminder_count: 0 },
  { id: 'r-quoted', sent_via: 'outside', supply_house_id: 'nws', sent_to: 'National Wholesale', sent_email: null, status: 'sent', token: null, created_at: '2026-09-10T15:00:00Z', created_by: 'robert', viewed_at: null, needed_by: null, requested_on: '2026-09-10', request_url: 'https://mail.google.com/thread/1', quote_url: 'https://drive.google.com/file/d/q1', last_reminded_at: null, reminder_count: 0 },
  { id: 'r-wait', sent_via: 'outside', supply_house_id: 'nws', sent_to: 'National Wholesale', sent_email: null, status: 'sent', token: null, created_at: '2026-09-12T15:00:00Z', created_by: 'robert', viewed_at: null, needed_by: null, requested_on: '2026-09-12', request_url: null, quote_url: null, last_reminded_at: null, reminder_count: 0 },
]
const REPS = [{ supply_house_id: 'nws', label: 'Kim', name: 'Kim Ammon', email: 'k.ammon@nws-inc.com', is_default: true, phone: '(210) 555-0142' }]

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
        ...(table === 'bid_versions' ? versionResult() : listResult(table === 'bid_rfqs' ? RFQS : table === 'supply_house_contacts' ? REPS : [])),
        insert: () => Promise.resolve({ error: null }),
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            updates.push({ table, patch, id })
            return Promise.resolve({ error: null })
          },
        }),
      }),
      functions: { invoke: () => Promise.resolve({ data: { ok: true }, error: null }) },
    },
  }
})

function renderTable() {
  return renderWithProviders(<BidPriceRequestsTable bidId="bid-1" serviceTypeId={null} pricingHref="/bids?tab=pricing&bidId=bid-1" />)
}

describe('BidPriceRequestsTable — the rows (PR 3, v2.3572)', () => {
  it('shows a Status chip per row and counts the late one in the header', async () => {
    renderTable()
    expect(await screen.findByText('late 7d')).toBeTruthy()
    expect(screen.getByText('quote in')).toBeTruthy()
    expect(screen.getByText('waiting')).toBeTruthy()
    expect(screen.getByText(/1 quote in · 1 late/)).toBeTruthy()
    expect(screen.getByText('by app')).toBeTruthy()
    expect(screen.getAllByText('sent outside').length).toBe(2)
    expect(screen.getByRole('columnheader', { name: 'Quote' })).toBeTruthy()
  })

  it('the Quote column holds only the quote: the pasted link on the quoted row, a paste box on the waiting one, and the request link moves under the date', async () => {
    renderTable()
    await screen.findByText('late 7d')
    expect(screen.getByText('drive.google.com/file/d/q1')).toBeTruthy()
    expect(screen.getByText('mail.google.com ↗')).toBeTruthy()
    const box = screen.getByPlaceholderText('Paste the quote link…') as HTMLInputElement
    fireEvent.change(box, { target: { value: 'drive.google.com/file/d/new' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    fireEvent.blur(box)
    await waitFor(() => expect(updates.some((u) => u.id === 'r-wait')).toBe(true))
    const u = updates.find((x) => x.id === 'r-wait')!
    expect(u.patch).toEqual({ quote_url: 'https://drive.google.com/file/d/new', status: 'quoted' })
  })

  it('Call appears on hand-sent rows whose rep has a phone, dialing through the one reading', async () => {
    renderTable()
    await screen.findByText('late 7d')
    const calls = screen.getAllByText('Call') as HTMLAnchorElement[]
    expect(calls.length).toBe(2)
    expect(calls[0]!.getAttribute('href')).toBe('tel:+12105550142')
    expect(calls[0]!.getAttribute('title')).toContain('(210) 555-0142')
    // the app row keeps Nudge, not Call
    expect(screen.getByText('Nudge')).toBeTruthy()
  })

  it('with a quote in, the header offers Price with robot and the desk link shortens (PR 4, v2.3573)', async () => {
    renderTable()
    await screen.findByText('late 7d')
    const btn = screen.getByText(/Price with robot · 1 quote in/) as HTMLAnchorElement
    expect(btn.closest('a')!.getAttribute('href')).toBe('/bids?tab=pricing&bidId=bid-1&robot=price')
    expect(screen.getByText('Open the desk ↗')).toBeTruthy()
  })
})
