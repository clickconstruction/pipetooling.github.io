// @vitest-environment jsdom
/**
 * Render smokes for the phone's Customer summary sheet header (v2.5831): the Edit customer door
 * for the roles whose RLS lets them update customers, Open record for the roles the Customers
 * page admits, neither for a sub, and every property with its note in full — the door codes
 * Taunya could not see from her phone.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

// Mutable role so one file covers the branches; `useAuth` reads it per render.
let mockRole: string = 'estimator'
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue({ role: mockRole, estimatorProspectsAccess: false }),
    useOptionalAuth: () => makeUseAuthValue({ role: mockRole, estimatorProspectsAccess: false }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

const openEditCustomerModal = vi.fn()
vi.mock('../../contexts/EditCustomerModalContext', () => ({
  useEditCustomerModal: () => ({ openEditCustomerModal }),
}))

// A sub cannot read customer_addresses (RLS: office roles and estimators), so the table answers
// by role: rows for the estimator, none for the sub.
const addressRows = [
  { id: 'b', address: '9 Elm St', note: null, is_primary: false, sequence_order: 1 },
  { id: 'a', address: '12 Lenox Ct', note: 'Gate code 4411. Dog in the yard.', is_primary: true, sequence_order: 0 },
]
vi.mock('../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const rows = () => {
      if (table === 'customers') return { name: 'Lenox Builders', address: '12 Lenox Ct', contact_info: { phone: '512-555-0101' } }
      if (table === 'customer_addresses') return mockRole === 'estimator' ? addressRows : []
      return []
    }
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit', 'in', 'is', 'not', 'range']) b[m] = () => b
    b.maybeSingle = () => b
    b.single = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(ok, bad)
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})
/** The feed's answer: a failure while set (v2.5962), else an empty feed. */
const feed = vi.hoisted(() => ({ failure: null as { error: string; errorKind: 'network' | 'server' | 'unknown' } | null, reads: 0 }))
vi.mock('../../lib/customerSummaryActivity', () => ({
  fetchCustomerSummaryActivity: async () => {
    feed.reads++
    return feed.failure
      ? { data: { jobs: [], items: [], truncated: false }, ...feed.failure }
      : { data: { jobs: [], items: [], truncated: false }, error: null, errorKind: null }
  },
}))
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: vi.fn() }))
vi.mock('../ReportViewModal', () => ({ default: () => null }))

import CustomerSummaryModal from './CustomerSummaryModal'
import { renderSettled } from '../../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

async function mount(role: string) {
  mockRole = role
  openEditCustomerModal.mockClear()
  const onClose = vi.fn()
  const r = await renderSettled(<CustomerSummaryModal customerId="c1" onClose={onClose} />, {
    loaded: () => screen.findByRole('heading', { name: 'Lenox Builders' }),
  })
  return { ...r, onClose }
}

describe('CustomerSummaryModal header (v2.5831)', () => {
  it('an estimator gets Edit customer, which opens the editor on this customer, and Open record to /customers/:id', async () => {
    const { onClose } = await mount('estimator')
    fireEvent.click(screen.getByRole('button', { name: 'Edit customer' }))
    expect(openEditCustomerModal).toHaveBeenCalledTimes(1)
    expect(openEditCustomerModal.mock.calls[0]![0]).toBe('c1')
    expect(typeof openEditCustomerModal.mock.calls[0]![1].onSaved).toBe('function')
    const open = screen.getByRole('link', { name: 'Open record' })
    expect(open.getAttribute('href')).toBe('/customers/c1')
    fireEvent.click(open)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('draws every property, the primary first, with its note in full, and No note where none was typed', async () => {
    await mount('estimator')
    const props = await screen.findAllByTestId('customer-summary-property')
    expect(props.map((p) => within(p).getByRole('button').textContent)).toEqual(['12 Lenox Ct', '9 Elm St'])
    expect(props.map((p) => within(p).getByTestId('customer-summary-property-note').textContent)).toEqual([
      'Gate code 4411. Dog in the yard.',
      'No note',
    ])
  })

  it('a sub gets neither door and sees the customer’s one address', async () => {
    await mount('subcontractor')
    expect(screen.queryByRole('button', { name: 'Edit customer' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Open record' })).toBeNull()
    const props = await screen.findAllByTestId('customer-summary-property')
    expect(props.map((p) => within(p).getByRole('button').textContent)).toEqual(['12 Lenox Ct'])
    expect(screen.getByRole('button', { name: 'Close customer summary' })).toBeTruthy()
  })

  it('no interactions says where they come from, and an empty category offers All, which shows every one', async () => {
    await mount('estimator')
    const empty = () => document.querySelector('[data-empty-state]') as HTMLElement
    await waitFor(() => expect(empty()?.textContent).toBe('No interactions yet. Notes, reports and changes on their jobs land here.'))
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter interactions' })).getByRole('button', { name: 'Notes' }))
    expect(empty().textContent).toBe('No interactions in Notes. All shows every one.')
    fireEvent.click(within(empty()).getByRole('button', { name: 'All' }))
    expect(within(screen.getByRole('group', { name: 'Filter interactions' })).getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
    expect(empty().textContent).toBe('No interactions yet. Notes, reports and changes on their jobs land here.')
  })

  it('a lost signal on the feed reads the offline sentence with Retry; Retry reads the feed again', async () => {
    feed.failure = { error: OFFLINE_ERROR_MESSAGE, errorKind: 'network' }
    feed.reads = 0
    await mount('estimator')
    await screen.findByText(OFFLINE_ERROR_MESSAGE)
    feed.failure = null
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('No interactions yet. Notes, reports and changes on their jobs land here.')
    expect(feed.reads).toBe(2)
  })
})
