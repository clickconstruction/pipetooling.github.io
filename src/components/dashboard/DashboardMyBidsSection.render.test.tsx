// @vitest-environment jsdom
/**
 * The owner's ask of 2026-11-19: a primary's My Bids card opens folded to its
 * heading, at every width. The heading keeps its count and New Bid beside it,
 * and one press shows the bids. Every other role's card opens as it did.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const BIDS = [
  {
    id: 'b1',
    project_name: 'Fire Cabinet Installation',
    bid_due_date: '2025-10-27',
    bid_date_sent: null,
    outcome: null,
    customer_id: null,
    estimator_id: 'me',
    account_manager_id: null,
    service_type: { name: 'Plumbing' },
  },
  {
    id: 'b2',
    project_name: 'Restroom Stalls',
    bid_due_date: '2026-03-23',
    bid_date_sent: null,
    outcome: null,
    customer_id: null,
    estimator_id: null,
    account_manager_id: 'me',
    service_type: { name: 'Plumbing' },
  },
]

/** What the `bids` read answers, and a gate that holds it while a test reads the loading card. */
const bidsRead: { rows: unknown[]; hold: Promise<void> | null } = { rows: BIDS, hold: null }

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { from: (table: string) => unknown }
  const origFrom = stub.from.bind(stub)
  /** A chain that answers the bids at whatever point it is awaited. */
  const bidsChain = (): unknown => {
    const answer = async () => {
      if (bidsRead.hold) await bidsRead.hold
      return { data: bidsRead.rows, error: null }
    }
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'or', 'order', 'limit']) chain[m] = () => chain
    chain.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => answer().then(ok, bad)
    return chain
  }
  stub.from = (table: string) => (table === 'bids' ? bidsChain() : origFrom(table))
  return { supabase: stub }
})

import { DashboardMyBidsSection } from './DashboardMyBidsSection'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { UserRole } from '../../hooks/useAuth'

const noop = () => {}
const section = (role: UserRole | null) => (
  <DashboardMyBidsSection authUserId="me" role={role} onContentVisibleChange={noop} />
)

/** The heading once the bids have loaded: the count is in its name. */
const loadedHeading = () => screen.findByRole('button', { name: 'My Bids, 2 bids' })

afterEach(() => {
  bidsRead.rows = BIDS
  bidsRead.hold = null
})

describe('DashboardMyBidsSection — how the card opens', () => {
  it('a primary: folded to the heading, with its count and New Bid in view, and one press shows the bids', async () => {
    renderWithProviders(section('primary'))
    const heading = await loadedHeading()
    expect(heading.getAttribute('aria-expanded')).toBe('false')
    expect(heading.textContent).toContain('My Bids (2)')
    expect(screen.getByRole('link', { name: 'New Bid' }).getAttribute('href')).toBe('/bids?new=true')
    expect(screen.queryByText('Fire Cabinet Installation')).toBeNull()
    expect(screen.queryByText('View all')).toBeNull()

    fireEvent.click(heading)
    await waitFor(() => expect(screen.getByText('Fire Cabinet Installation')).toBeTruthy())
    expect(screen.getByText('Restroom Stalls')).toBeTruthy()
    expect(heading.getAttribute('aria-expanded')).toBe('true')
    expect(heading.textContent).toContain('My Bids (2)')

    fireEvent.click(heading)
    await waitFor(() => expect(screen.queryByText('Fire Cabinet Installation')).toBeNull())
    expect(screen.getByRole('link', { name: 'New Bid' })).toBeTruthy()
  })

  it.each(['estimator', 'assistant', 'master_technician', 'dev'] as const)('%s: open, as before', async (role) => {
    renderWithProviders(section(role))
    const heading = await loadedHeading()
    expect(heading.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Fire Cabinet Installation')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'New Bid' })).toBeTruthy()
  })

  it('a primary, while the bids load: the folded heading gives no count it does not have', async () => {
    let release = noop
    bidsRead.hold = new Promise<void>((resolve) => {
      release = resolve
    })
    renderWithProviders(section('primary'))
    const loading = await screen.findByRole('button', { name: 'My Bids, loading' })
    expect(loading.getAttribute('aria-expanded')).toBe('false')
    expect(loading.textContent).not.toMatch(/\(\d+\)/)
    expect(screen.getByRole('link', { name: 'New Bid' })).toBeTruthy()

    release()
    const heading = await loadedHeading()
    expect(heading.getAttribute('aria-expanded')).toBe('false')
  })

  it('a role that arrives after the first paint as primary still folds the card', async () => {
    const view = renderWithProviders(section(null))
    view.rerender(section('primary'))
    const heading = await loadedHeading()
    expect(heading.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Fire Cabinet Installation')).toBeNull()
  })
})
