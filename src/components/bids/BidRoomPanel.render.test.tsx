// @vitest-environment jsdom
/**
 * Render smoke for the Bid Room staff panel (journey-map Tier-2 #31): the link comes first.
 * No room → "Get the link" is the primary and Send to GC waits for an email; a published,
 * never-sent room → Copy link + Open (with the office preview flag) are already there.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

type Rows = Record<string, Record<string, unknown>[]>
let rows: Rows = {}

/** Table-aware stand-in for the smoke stub: list endings resolve the table's rows, maybeSingle the first. */
function makeTableStub() {
  function builder(table: string, single: boolean): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    const result = () => Promise.resolve({ data: single ? (rows[table]?.[0] ?? null) : (rows[table] ?? []), error: null, count: 0 })
    for (const m of ['select', 'insert', 'update', 'eq', 'is', 'in', 'order', 'limit']) b[m] = () => b
    b.maybeSingle = () => builder(table, true)
    b.single = () => builder(table, true)
    b.then = (ok?: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => result().then(ok, ko)
    return b
  }
  return {
    from: (table: string) => builder(table, false),
    auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
  }
}

vi.mock('../../lib/supabase', () => ({ supabase: makeTableStub() }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidRoomPanel } from './BidRoomPanel'

const baseProps = {
  bidId: 'bid-1',
  gcCustomerId: null,
  gcName: 'Acme GC',
  projectName: 'Elm St Clinic',
  projectAddress: '1 Elm St',
  serviceTypeName: 'Plumbing',
  sections: [{ name: 'Base bid', isAlternate: false, revenueSum: 1000, fixtureRows: [] }],
  inclusions: '',
  exclusions: '',
  terms: '',
  crmCustomerId: null,
  onFirstLinkSent: () => {},
}

describe('BidRoomPanel', () => {
  it('no room yet: "Get the link" is the primary, Send to GC is disabled until an email is typed, no link controls', async () => {
    rows = {}
    renderWithProviders(<BidRoomPanel {...baseProps} />)
    fireEvent.click(screen.getByText('Set up'))
    const getLink = await screen.findByText('✍ Get the link')
    expect((getLink as HTMLButtonElement).disabled).toBe(false)
    const send = screen.getByText('Send to GC') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    expect(screen.queryByText('Copy link')).toBeNull()
    expect(screen.queryByText('Open ↗')).toBeNull()
    expect(screen.queryByText(/Publish & send/)).toBeNull()
    fireEvent.change(screen.getByLabelText('GC contact email'), { target: { value: 'pm@acme.com' } })
    expect((screen.getByText('Send to GC') as HTMLButtonElement).disabled).toBe(false)
  })

  it('published, never sent: Copy link and Open are there before any send; Open carries the preview flag; primary is Publish update', async () => {
    rows = {
      bid_proposal_rooms: [{ id: 'room-1', bid_id: 'bid-1', customer_id: null, closed_at: null, public_token: 'tok123', recipient_email: null, attachment_url: null }],
      bid_proposal_room_revisions: [{ room_id: 'room-1', rev_number: 1, published_at: '2026-09-05T12:00:00Z' }],
      bid_proposal_room_events: [],
      estimates: [],
    }
    renderWithProviders(<BidRoomPanel {...baseProps} />)
    fireEvent.click(await screen.findByText('Manage'))
    await waitFor(() => expect(screen.getByText('Copy link')).toBeTruthy())
    const open = screen.getByText('Open ↗') as HTMLAnchorElement
    expect(open.getAttribute('href')).toContain('/bid-room?t=tok123')
    expect(open.getAttribute('href')).toContain('preview=1')
    expect(screen.getByTestId('bid-room-link').textContent).toContain('/bid-room?t=tok123')
    expect(screen.getByTestId('bid-room-link').textContent).not.toContain('preview')
    expect(screen.getByText('Publish update')).toBeTruthy()
    expect(screen.getByText('Send to GC')).toBeTruthy()
    expect(screen.queryByText('Email link again')).toBeNull()
    expect(screen.getByText('Close room')).toBeTruthy()
  })
})
