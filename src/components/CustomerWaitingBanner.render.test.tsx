// @vitest-environment jsdom
/**
 * Render smoke for Hide for me (v2.3524): the called-state strip offers it to
 * the caller only; pressing it hides the strip for that viewer; another viewer
 * of the same rows never sees the control and keeps the strip.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { CustomerWaitingBanner } from './CustomerWaitingBanner'
import { CustomerWaitingValueProvider, type CustomerWaitingContextValue } from '../contexts/CustomerWaitingContext'
import type { CustomerWaitingRow } from '../lib/customerWaiting'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

afterEach(() => {
  cleanup()
  try {
    localStorage.clear()
  } catch {
    /* jsdom */
  }
})

const called: CustomerWaitingRow = {
  id: 'req-1',
  inbox: 'dispatch',
  title: 'Customer waiting — Jane Doe asks for a visit',
  created_at: '2026-09-16T14:00:00Z',
  reference_summary: null,
  pending_action: null,
  pending_payload: { source: 'portal', kind: 'visit', customerName: 'Jane Doe', description: 'Water heater leaking', phone: '5125550142', phoneSource: 'portal' },
  last_called_at: '2026-09-16T14:10:00Z',
  last_called_by: { name: 'Robert' },
  last_called_by_user_id: 'u-robert',
}

function mount(viewerId: string, rows: CustomerWaitingRow[] = [called]) {
  const value: CustomerWaitingContextValue = { eligible: true, loaded: true, rows, inboxHref: '/dispatch-mode/inbox', viewerId, logCall: async () => {}, reload: () => {} }
  // renderWithProviders mounts the router (at "/", not an inbox route) and the toast provider Call needs.
  return renderWithProviders(
    <CustomerWaitingValueProvider value={value}>
      <CustomerWaitingBanner />
    </CustomerWaitingValueProvider>,
  )
}

describe('CustomerWaitingBanner — Hide for me', () => {
  it('offers Hide for me to the caller, and hides the strip for them when pressed', () => {
    mount('u-robert')
    expect(screen.getByTestId('customer-waiting-banner').textContent).toContain('Robert called')
    fireEvent.click(screen.getByTestId('customer-waiting-hide-for-me'))
    expect(screen.queryByTestId('customer-waiting-banner')).toBeNull()
  })

  it('never offers it to anyone else, who keeps the strip', () => {
    mount('u-taunya')
    expect(screen.getByTestId('customer-waiting-banner')).toBeTruthy()
    expect(screen.queryByTestId('customer-waiting-hide-for-me')).toBeNull()
  })

  it('does not offer it while anyone is still waiting', () => {
    const waiting: CustomerWaitingRow = { ...called, id: 'req-2', last_called_at: null, last_called_by: null, last_called_by_user_id: null }
    mount('u-robert', [called, waiting])
    expect(screen.getByTestId('customer-waiting-banner').textContent).toContain('is waiting')
    expect(screen.queryByTestId('customer-waiting-hide-for-me')).toBeNull()
  })
})
