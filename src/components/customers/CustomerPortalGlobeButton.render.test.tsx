// @vitest-environment jsdom
/**
 * Render-smoke tests for the portal globe button (custom-links rework
 * v2.2009): hero custom address + Copy/Preview, flat gear rows (Direct link /
 * Address / Separate views / Reset / History), merged 'all' audience, the
 * no-silent-revive rule for turned-off portals, and (journey-map #14(b)) the
 * no-mint-on-open rule for never-shared customers.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const { rpcMock, linkRowsMock, slugRowMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(async () => ({ data: { token: 'tok1234567890abcdef', audience: 'all', activeSince: '2026-08-21T00:00:00Z' }, error: null })),
  linkRowsMock: { rows: [] as unknown[] },
  slugRowMock: { row: null as unknown },
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
        if (table === 'customer_portal_links') {
          const builder: Record<string, unknown> = {}
          for (const m of ['select', 'eq', 'order']) builder[m] = () => builder
          builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: linkRowsMock.rows, error: null })
          return builder
        }
        if (table === 'customer_portal_slugs') {
          const builder: Record<string, unknown> = {}
          for (const m of ['select', 'eq']) builder[m] = () => builder
          builder.maybeSingle = () => Promise.resolve({ data: slugRowMock.row, error: null })
          return builder
        }
        if (table === 'customer_portal_slug_events') {
          const builder: Record<string, unknown> = {}
          for (const m of ['select', 'eq', 'order', 'limit']) builder[m] = () => builder
          builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })
          return builder
        }
        return baseFrom(table)
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
  it('never-minted: opening writes nothing — the link is created on "Create their link", then the hero appears', async () => {
    linkRowsMock.rows = []
    slugRowMock.row = null
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="c1" customerName="Knight Contracting" />)
    fireEvent.click(screen.getByLabelText("Open Knight Contracting's customer portal link"))
    // Journey-map #14(b) / J21-F7: the modal opens into the unminted state and
    // no RPC has run — "just looking" creates nothing.
    await waitFor(() => expect(screen.getByText('No portal link yet.')).toBeTruthy())
    expect(rpcMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Copy link')).toBeNull()
    expect(screen.queryByLabelText('Portal address')).toBeNull()
    fireEvent.click(screen.getByText('Create their link'))
    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('mint_customer_portal_link', {
        p_customer_id: 'c1',
        p_audience: 'all',
        p_rotate: false,
      }),
    )
    expect(rpcMock).toHaveBeenCalledTimes(1)
    // Hero: editable custom address, prefilled from the customer name.
    const addressInput = (await screen.findByLabelText('Portal address')) as HTMLInputElement
    expect(addressInput.value).toBe('knight-contracting')
    expect(screen.getByText('Editable until first shared')).toBeTruthy()
    expect(screen.getByText('✓ hard to guess')).toBeTruthy()
    expect(screen.getByText('Copy link')).toBeTruthy()
    expect(screen.getByText('Preview as customer')).toBeTruthy()
    expect(screen.getByTitle('Portal preview — Knight Contracting')).toBeTruthy()
    // Gear rows are hidden until the gear opens.
    expect(screen.queryByText('Rotate')).toBeNull()
    expect(screen.queryByText('Direct link')).toBeNull()
    fireEvent.click(screen.getByLabelText('Advanced settings'))
    expect(screen.getByText('Direct link')).toBeTruthy()
    expect(screen.getByText('Address')).toBeTruthy()
    expect(screen.getByText('Separate views')).toBeTruthy()
    expect(screen.getByText('🎲 Random tail')).toBeTruthy()
    expect(screen.getByText('GC bills only')).toBeTruthy()
    expect(screen.getByText('Their own jobs only')).toBeTruthy()
    expect(screen.getByText('Rotate')).toBeTruthy()
    expect(screen.getByText('Turn off')).toBeTruthy()
    expect(screen.getByText('History')).toBeTruthy()
  })

  it('a turned-off portal shows the off state instead of silently re-minting', async () => {
    linkRowsMock.rows = [
      { customer_id: 'c9', audience: 'all', token: 'deadtok', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-02T00:00:00Z', created_by: null },
    ]
    slugRowMock.row = null
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="c9" customerName="Diamondback" />)
    fireEvent.click(screen.getByLabelText("Open Diamondback's customer portal link"))
    await waitFor(() => expect(screen.getByText('This portal is turned off.')).toBeTruthy())
    expect(screen.getByText('Turn portal back on')).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('legacy-only turned-off rows (pre-merged audiences) also stay off', async () => {
    linkRowsMock.rows = [
      { customer_id: 'c8', audience: 'customer', token: 'oldtok', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-02T00:00:00Z', created_by: null },
    ]
    slugRowMock.row = null
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="c8" customerName="Old Off" />)
    fireEvent.click(screen.getByLabelText("Open Old Off's customer portal link"))
    await waitFor(() => expect(screen.getByText('This portal is turned off.')).toBeTruthy())
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('an active legacy link is continued: the merged link mints and the scoped link shows under Separate views', async () => {
    linkRowsMock.rows = [
      { customer_id: 'c2', audience: 'gc', token: 'gctok9876543210zyxwv', created_at: '2026-08-01T00:00:00Z', revoked_at: null, created_by: null },
    ]
    slugRowMock.row = null
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="c2" customerName="DSI" />)
    fireEvent.click(screen.getByLabelText("Open DSI's customer portal link"))
    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('mint_customer_portal_link', {
        p_customer_id: 'c2',
        p_audience: 'all',
        p_rotate: false,
      }),
    )
    fireEvent.click(await screen.findByLabelText('Advanced settings'))
    // The active gc link renders as an existing separate view (Copy + Turn off), not a create button.
    expect(screen.getByText('GC bills only')).toBeTruthy()
    expect(screen.getAllByText('Turn off').length).toBeGreaterThan(1) // scoped row + Reset row
  })

  it('a locked address is not editable in the hero and the meta line clears', async () => {
    linkRowsMock.rows = [
      { customer_id: 'c3', audience: 'all', token: 'tokLLL1234567890abc', created_at: '2026-08-01T00:00:00Z', revoked_at: null, created_by: null },
    ]
    slugRowMock.row = { slug: 'knight-contracting', locked_at: '2026-08-21T00:00:00Z' }
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="c3" customerName="Knight Contracting" />)
    fireEvent.click(screen.getByLabelText("Open Knight Contracting's customer portal link"))
    await waitFor(() => expect(screen.getByText('Copy link')).toBeTruthy())
    expect(screen.queryByLabelText('Portal address')).toBeNull() // static text, no input
    expect(screen.queryByText('Editable until first shared')).toBeNull()
    expect(rpcMock).not.toHaveBeenCalled() // active link — nothing minted
    // Post-lock, the gear's Address row is the editor (input + dice + Save).
    fireEvent.click(screen.getByLabelText('Advanced settings'))
    expect(screen.getByLabelText('New portal address')).toBeTruthy()
    expect(screen.getByText('Save')).toBeTruthy()
  })
})
