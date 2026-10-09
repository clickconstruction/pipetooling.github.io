// @vitest-environment jsdom
/**
 * Robots → Audits: a slate can be parked (v2.5016, the owner's call of 2026-10-09). Up next names
 * each slate it holds with a Skip this slate door; a skipped slate leaves Up next for the Parked
 * fold, stays parked on this device, and Bring it back returns its rows. Made-up robot copies.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { BidsAuditsTab } from './BidsAuditsTab'

const audit = (id: string, project: string, requestedAt: string) => ({
  id,
  bid_id: `bid-${id}`,
  ct_project_id: null,
  ct_view_url: null,
  status: 'pending',
  requested_at: requestedAt,
  completed_at: null,
  completed_by: null,
  digested_at: null,
  created_by: null,
  created_at: requestedAt,
  updated_at: requestedAt,
  bids: { id: `bid-${id}`, bid_number: id.replace(/\D/g, '') || '1', project_name: project, selected_bid_version_id: null },
})
const audits = [
  audit('a1', 'ZZ Twin ALPHA (backtest R2)', '2026-09-05T15:00:00Z'),
  audit('a2', 'ZZ Twin BRAVO (backtest)', '2026-08-31T15:00:00Z'),
  audit('a3', 'ZZ Twin CHARLIE (backtest)', '2026-08-31T15:05:00Z'),
  audit('a4', 'ZZ Twin ECHO (backtest R2)', '2026-09-05T15:10:00Z'),
]

// Every copy has priced rows, so each is workable and the two-pane layout opens the top one on its own.
const countRows = audits.map((a, i) => ({ id: `r${i}`, fixture: 'WC-1', count: 2, bid_version_id: null, bid_id: a.bid_id }))
const assignments = countRows.map((r) => ({ bid_id: r.bid_id, count_row_id: r.id, price_book_entry_id: null, unit_price_override: 1000 }))

function tableResult(table: string): unknown {
  const data = table === 'bid_audits' ? audits : table === 'bids_count_rows' ? countRows : table === 'bid_pricing_assignments' ? assignments : []
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const m of ['select', 'order', 'limit', 'in', 'eq', 'insert', 'update', 'range']) chain[m] = self
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve)
  return chain
}

vi.mock('../../lib/supabase', () => ({ supabase: { from: (table: string) => tableResult(table) } }))
vi.mock('../../hooks/useIsDigitalTwin', () => ({ useIsDigitalTwin: () => false }))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const names = (el: HTMLElement) => within(el).queryAllByTestId('audit-row').map((r) => r.querySelector('span')?.textContent)

describe('BidsAuditsTab · park a slate', () => {
  it('Skip this slate folds the slate into Parked, it stays parked on this device, and Bring it back returns it', async () => {
    const first = renderWithProviders(<BidsAuditsTab authUser={null} myRole="dev" />)
    await settle()
    const upNext = await screen.findByTestId('queue-up-next')
    expect(names(upNext).sort()).toEqual(['ALPHA', 'BRAVO', 'CHARLIE', 'ECHO'])
    const slates = within(upNext).getByTestId('queue-slates')
    expect(slates.textContent).toContain('re-bid Sep 5 · 2')
    expect(slates.textContent).toContain('slate Aug 31 · 2')
    expect(screen.queryByTestId('queue-parked')).toBeNull()

    fireEvent.click(within(slates).getByRole('button', { name: 'Skip the slate Aug 31 slate' }))
    await settle()
    expect(names(screen.getByTestId('queue-up-next')).sort()).toEqual(['ALPHA', 'ECHO'])
    expect(within(screen.getByTestId('queue-slates')).queryByRole('button', { name: 'Skip the slate Aug 31 slate' })).toBeNull()
    const parked = screen.getByTestId('queue-parked')
    expect(parked.textContent).toContain('Parked2 ▸· slate Aug 31')
    expect(names(parked)).toEqual([])

    // Parked is remembered on this device: a fresh mount still has it folded away.
    first.unmount()
    renderWithProviders(<BidsAuditsTab authUser={null} myRole="dev" />)
    await settle()
    await screen.findByTestId('queue-up-next')
    expect(names(screen.getByTestId('queue-up-next')).sort()).toEqual(['ALPHA', 'ECHO'])

    fireEvent.click(within(screen.getByTestId('queue-parked')).getByRole('button', { expanded: false }))
    const open = screen.getByTestId('queue-parked')
    expect(open.textContent).toContain('slate Aug 31 · 2 audits')
    expect(names(open).sort()).toEqual(['BRAVO', 'CHARLIE'])

    fireEvent.click(within(open).getByRole('button', { name: 'Bring the slate Aug 31 slate back' }))
    await settle()
    expect(screen.queryByTestId('queue-parked')).toBeNull()
    expect(names(screen.getByTestId('queue-up-next')).sort()).toEqual(['ALPHA', 'BRAVO', 'CHARLIE', 'ECHO'])
  })

  it('in two panes, parking the slate of the card open now opens the next card outside it', async () => {
    const realMatchMedia = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query === '(min-width: 1151px)', media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
    try {
      renderWithProviders(<BidsAuditsTab authUser={null} myRole="dev" />)
      await settle()
      const now = await screen.findByTestId('queue-now')
      expect(['BRAVO', 'CHARLIE']).toContain(names(now)[0])
      fireEvent.click(within(screen.getByTestId('queue-slates')).getByRole('button', { name: 'Skip the slate Aug 31 slate' }))
      await settle()
      expect(['ALPHA', 'ECHO']).toContain(names(screen.getByTestId('queue-now'))[0])
      expect(names(screen.getByTestId('queue-up-next'))).not.toContain('BRAVO')
      expect(names(screen.getByTestId('queue-up-next'))).not.toContain('CHARLIE')
    } finally {
      window.matchMedia = realMatchMedia
    }
  })
})
