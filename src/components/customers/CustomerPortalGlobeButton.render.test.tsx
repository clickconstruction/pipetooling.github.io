// @vitest-environment jsdom
/**
 * Render-smoke tests for the portal globe button (portal train PR 4): the
 * office-only 🌐 that copies / previews / rotates / revokes a customer's
 * portal link.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(async () => ({ data: { token: 'tok1234567890abcdef', audience: 'customer', activeSince: '2026-08-21T00:00:00Z' }, error: null })),
}))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  return { supabase: { ...stub, rpc: rpcMock } }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import CustomerPortalGlobeButton from './CustomerPortalGlobeButton'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('CustomerPortalGlobeButton', () => {
  it('renders for office roles, opens the modal, fetches the link, and offers the actions', async () => {
    renderWithProviders(<CustomerPortalGlobeButton customerId="c1" customerName="Knight Contracting" />)
    const btn = screen.getByLabelText("Open Knight Contracting's customer portal link")
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByText(/\/portal\?t=tok1234567890abcdef/)).toBeTruthy())
    expect(rpcMock).toHaveBeenCalledWith('mint_customer_portal_link', {
      p_customer_id: 'c1',
      p_audience: 'customer',
      p_rotate: false,
    })
    expect(screen.getByText('Copy link')).toBeTruthy()
    expect(screen.getByText('Preview as customer')).toBeTruthy()
    expect(screen.getByText('Rotate')).toBeTruthy()
    expect(screen.getByText('Turn off')).toBeTruthy()
  })

  it('gc default audience mints as gc', async () => {
    renderWithProviders(<CustomerPortalGlobeButton customerId="c2" customerName="DSI" defaultAudience="gc" />)
    fireEvent.click(screen.getByLabelText("Open DSI's customer portal link"))
    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('mint_customer_portal_link', {
        p_customer_id: 'c2',
        p_audience: 'gc',
        p_rotate: false,
      }),
    )
  })
})
