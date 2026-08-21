// @vitest-environment jsdom
/**
 * Render-smoke tests for the portal globe button (portal train PR 4; preview +
 * advanced v2.2001): the office-only 🌐 that copies / previews a customer's
 * portal link, with Rotate / Turn off / history behind the gear.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const { rpcMock, linkRowsMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(async () => ({ data: { token: 'tok1234567890abcdef', audience: 'customer', activeSince: '2026-08-21T00:00:00Z' }, error: null })),
  linkRowsMock: { rows: [] as unknown[] },
}))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseFrom = stub.from as (table: string) => unknown
  return {
    supabase: {
      ...stub,
      rpc: rpcMock,
      from: (table: string) => {
        if (table !== 'customer_portal_links') return baseFrom(table)
        const builder: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'order']) builder[m] = () => builder
        builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: linkRowsMock.rows, error: null })
        return builder
      },
    },
  }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import CustomerPortalGlobeButton from './CustomerPortalGlobeButton'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('CustomerPortalGlobeButton', () => {
  it('opens the modal, mints a first link, embeds the preview, and hides Rotate/Turn off behind the gear', async () => {
    linkRowsMock.rows = []
    renderWithProviders(<CustomerPortalGlobeButton customerId="c1" customerName="Knight Contracting" />)
    fireEvent.click(screen.getByLabelText("Open Knight Contracting's customer portal link"))
    await waitFor(() => expect(screen.getByText(/\/portal\?t=tok1234567890abcdef/)).toBeTruthy())
    expect(rpcMock).toHaveBeenCalledWith('mint_customer_portal_link', {
      p_customer_id: 'c1',
      p_audience: 'customer',
      p_rotate: false,
    })
    expect(screen.getByText('Copy link')).toBeTruthy()
    expect(screen.getByText('Preview as customer')).toBeTruthy()
    expect(screen.getByTitle('Portal preview — Knight Contracting')).toBeTruthy()
    // Rotate / Turn off live under the gear now.
    expect(screen.queryByText('Rotate')).toBeNull()
    fireEvent.click(screen.getByLabelText('Advanced settings'))
    expect(screen.getByText('Rotate')).toBeTruthy()
    expect(screen.getByText('Turn off')).toBeTruthy()
    expect(screen.getByText('Link history')).toBeTruthy()
  })

  it('a turned-off link shows the off state instead of silently re-minting', async () => {
    linkRowsMock.rows = [
      { audience: 'customer', token: 'deadtok', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-02T00:00:00Z', created_by: null },
    ]
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="c9" customerName="Diamondback" />)
    fireEvent.click(screen.getByLabelText("Open Diamondback's customer portal link"))
    await waitFor(() => expect(screen.getByText('This portal is turned off.')).toBeTruthy())
    expect(screen.getByText('Turn portal back on')).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('gc default audience mints as gc', async () => {
    linkRowsMock.rows = []
    rpcMock.mockClear()
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
