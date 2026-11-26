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

const { rpcMock, linkRowsMock, slugRowMock, authMock, proposalRowsMock } = vi.hoisted(() => ({
  /** The GC proposals that name a link (#443, finding 254): none unless a case says otherwise. */
  proposalRowsMock: { rows: [] as Array<{ portal_link_id: string | null }>, asked: [] as string[][] },
  rpcMock: vi.fn(async (..._args: unknown[]): Promise<{ data: unknown; error: null }> => ({ data: { token: 'tok1234567890abcdef', audience: 'all', activeSince: '2026-08-21T00:00:00Z' }, error: null })),
  linkRowsMock: { rows: [] as unknown[] },
  slugRowMock: { row: null as unknown },
  /** The signed-in role: a dev unless a case says otherwise (#443, row 11: the delete press is a dev's alone). */
  authMock: { role: 'dev' as string },
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
        if (table === 'job_paper_proposals') {
          const builder: Record<string, unknown> = {}
          builder.select = () => builder
          builder.in = (_col: string, ids: string[]) => {
            proposalRowsMock.asked.push(ids)
            return builder
          }
          builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: proposalRowsMock.rows, error: null })
          return builder
        }
        return baseFrom(table)
      },
    },
  }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const m = useAuthModuleMock()
  return { ...m, useAuth: () => ({ ...m.useAuth(), role: authMock.role }), useOptionalAuth: () => ({ ...m.useOptionalAuth(), role: authMock.role }) }
})

import CustomerPortalGlobeButton from './CustomerPortalGlobeButton'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

describe('CustomerPortalGlobeButton', () => {
  it('never-minted: opening writes nothing — the link is created on "Create their link", then the hero appears', async () => {
    linkRowsMock.rows = []
    slugRowMock.row = null
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="c1" customerName="Kestrin Contracting" />)
    await settle()
    fireEvent.click(screen.getByLabelText("Open Kestrin Contracting's customer portal link"))
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
    // B18 / J21-F6: the default address is the name PLUS a random tail — the bare name is the edit.
    expect(addressInput.value).toMatch(/^kestrin-contracting-[a-km-np-z2-9]{4}$/)
    // #389, finding 180: the suggestion is not saved until Copy link, and the window says so under the box.
    expect(screen.getByText('Not saved yet. Copy link saves it.')).toBeTruthy()
    expect(screen.queryByText('Editable until first shared')).toBeNull()
    expect(addressInput.style.color).toBe('var(--text-muted)')
    expect(screen.getByText('✓ hard to guess — random tail')).toBeTruthy()
    expect(screen.getByLabelText('New random tail')).toBeTruthy()
    expect(screen.getByText('Copy link')).toBeTruthy()
    expect(screen.getByText('Preview as customer')).toBeTruthy()
    expect(screen.getByTitle('Portal preview — Kestrin Contracting')).toBeTruthy()
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
    renderWithProviders(<CustomerPortalGlobeButton customerId="c9" customerName="Davenport" />)
    await settle()
    fireEvent.click(screen.getByLabelText("Open Davenport's customer portal link"))
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
    await settle()
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
    await settle()
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
    slugRowMock.row = { slug: 'kestrin-contracting', locked_at: '2026-08-21T00:00:00Z' }
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="c3" customerName="Kestrin Contracting" />)
    await settle()
    fireEvent.click(screen.getByLabelText("Open Kestrin Contracting's customer portal link"))
    await waitFor(() => expect(screen.getByText('Copy link')).toBeTruthy())
    expect(screen.queryByLabelText('Portal address')).toBeNull() // static text, no input
    expect(screen.queryByText('Editable until first shared')).toBeNull()
    expect(rpcMock).not.toHaveBeenCalled() // active link — nothing minted
    // Post-lock, the gear's Address row is the editor (input + dice + Save).
    fireEvent.click(screen.getByLabelText('Advanced settings'))
    expect(screen.getByLabelText('New portal address')).toBeTruthy()
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('a saved address that is not shared yet keeps the old line, drawn as the box’s own (#389, finding 180)', async () => {
    linkRowsMock.rows = [
      { customer_id: 'c4', audience: 'all', token: 'tokSSS1234567890abc', created_at: '2026-08-01T00:00:00Z', revoked_at: null, created_by: null },
    ]
    slugRowMock.row = { slug: 'kestrin-contracting-q4mt', locked_at: null }
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="c4" customerName="Kestrin Contracting" />)
    await settle()
    fireEvent.click(screen.getByLabelText("Open Kestrin Contracting's customer portal link"))
    const addressInput = (await screen.findByLabelText('Portal address')) as HTMLInputElement
    expect(addressInput.value).toBe('kestrin-contracting-q4mt')
    expect(addressInput.style.color).toBe('inherit')
    expect(screen.getByText('Editable until first shared')).toBeTruthy()
    expect(screen.queryByText('Not saved yet. Copy link saves it.')).toBeNull()
  })

  it('Copy link on a fresh portal saves and locks the suggestion, and the not-saved line goes (#389, finding 180)', async () => {
    linkRowsMock.rows = [
      { customer_id: 'c5', audience: 'all', token: 'tokCCC1234567890abc', created_at: '2026-08-01T00:00:00Z', revoked_at: null, created_by: null },
    ]
    slugRowMock.row = null
    rpcMock.mockClear()
    rpcMock.mockImplementation(async (...args: unknown[]) => {
      const name = args[0] as string
      if (name === 'set_customer_portal_slug') return { data: { slug: (args[1] as { p_slug: string }).p_slug }, error: null }
      if (name === 'mark_customer_portal_slug_shared') return { data: { ok: true }, error: null }
      return { data: { token: 'tok1234567890abcdef', audience: 'all', activeSince: '2026-08-21T00:00:00Z' }, error: null }
    })
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    try {
      renderWithProviders(<CustomerPortalGlobeButton customerId="c5" customerName="Kestrin Contracting" />)
      await settle()
      fireEvent.click(screen.getByLabelText("Open Kestrin Contracting's customer portal link"))
      const addressInput = (await screen.findByLabelText('Portal address')) as HTMLInputElement
      const suggested = addressInput.value
      expect(screen.getByText('Not saved yet. Copy link saves it.')).toBeTruthy()
      fireEvent.click(screen.getByText('Copy link'))
      await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('set_customer_portal_slug', { p_customer_id: 'c5', p_slug: suggested }))
      await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('mark_customer_portal_slug_shared', { p_customer_id: 'c5' }))
      await waitFor(() => expect(screen.queryByLabelText('Portal address')).toBeNull()) // locked: static text now
      expect(screen.getByText(suggested)).toBeTruthy()
      expect(screen.queryByText('Not saved yet. Copy link saves it.')).toBeNull()
      expect(screen.queryByText('Editable until first shared')).toBeNull()
      expect(writeText).toHaveBeenCalledTimes(1)
    } finally {
      rpcMock.mockReset()
      rpcMock.mockImplementation(async () => ({ data: { token: 'tok1234567890abcdef', audience: 'all', activeSince: '2026-08-21T00:00:00Z' }, error: null }))
    }
  })

  it('a dev deletes a test customer’s turned-off link from History, after the confirm (punch list #443, row 11)', async () => {
    authMock.role = 'dev'
    linkRowsMock.rows = [
      { id: 'l-off', customer_id: 'zz1', audience: 'all', token: 'deadtok', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-02T00:00:00Z', created_by: null },
    ]
    slugRowMock.row = null
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="zz1" customerName="ZZ Test Portal Customer" />)
    await settle()
    fireEvent.click(screen.getByLabelText("Open ZZ Test Portal Customer's customer portal link"))
    await waitFor(() => expect(screen.getByText('This portal is turned off.')).toBeTruthy())
    // The off state has no gear, so a dev reads History under the off box.
    expect(screen.getByTestId('portal-off-history')).toBeTruthy()
    const press = await screen.findByTestId('portal-link-delete')
    expect(press.textContent).toBe('Delete…')
    expect(press.getAttribute('aria-disabled')).toBe('false')
    fireEvent.click(press)
    const confirm = await screen.findByRole('button', { name: 'Delete the link' })
    expect(screen.getByText('Delete this turned-off link of ZZ Test Portal Customer?')).toBeTruthy()
    expect(rpcMock).not.toHaveBeenCalled()
    fireEvent.click(confirm)
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('delete_test_portal_link', { p_link_id: 'l-off' }))
    await waitFor(() => expect(screen.getByText('The turned-off link was deleted.')).toBeTruthy())
  })

  it('a real customer’s turned-off link reads a dead Delete… with its reason, and a press on it deletes nothing (punch list #443, row 11)', async () => {
    authMock.role = 'dev'
    linkRowsMock.rows = [
      { id: 'l-real', customer_id: 'c7', audience: 'all', token: 'deadtok', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-02T00:00:00Z', created_by: null },
    ]
    slugRowMock.row = null
    rpcMock.mockClear()
    renderWithProviders(<CustomerPortalGlobeButton customerId="c7" customerName="Harbor Row Plumbing" />)
    await settle()
    fireEvent.click(screen.getByLabelText("Open Harbor Row Plumbing's customer portal link"))
    await waitFor(() => expect(screen.getByText('This portal is turned off.')).toBeTruthy())
    const press = await screen.findByTestId('portal-link-delete')
    expect(press.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Only a test customer’s link can be deleted. The customer’s name must start with ZZ.')).toBeTruthy()
    fireEvent.click(press)
    expect(screen.queryByRole('button', { name: 'Delete the link' })).toBeNull()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('a turned-off link a GC proposal names reads a dead Delete… with the reason, and opens no confirm (punch list #443, finding 254)', async () => {
    authMock.role = 'dev'
    linkRowsMock.rows = [
      { id: 'l-named', customer_id: 'zz1', audience: 'all', token: 'deadtok1', created_at: '2026-08-03T00:00:00Z', revoked_at: '2026-08-04T00:00:00Z', created_by: null },
      { id: 'l-free', customer_id: 'zz1', audience: 'all', token: 'deadtok2', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-02T00:00:00Z', created_by: null },
    ]
    slugRowMock.row = null
    proposalRowsMock.rows = [{ portal_link_id: 'l-named' }, { portal_link_id: 'l-named' }]
    proposalRowsMock.asked = []
    rpcMock.mockClear()
    try {
      renderWithProviders(<CustomerPortalGlobeButton customerId="zz1" customerName="ZZ Test Portal Customer" />)
      await settle()
      fireEvent.click(screen.getByLabelText("Open ZZ Test Portal Customer's customer portal link"))
      await waitFor(() => expect(screen.getByText('2 GC proposals name this link. It stays.')).toBeTruthy())
      // One read, for the turned-off links of this window alone.
      expect(proposalRowsMock.asked.at(-1)).toEqual(['l-named', 'l-free'])
      const presses = screen.getAllByTestId('portal-link-delete')
      expect(presses.map((p) => p.getAttribute('aria-disabled'))).toEqual(['true', 'false'])
      fireEvent.click(presses[0]!)
      expect(screen.queryByRole('button', { name: 'Delete the link' })).toBeNull()
      expect(rpcMock).not.toHaveBeenCalled()
    } finally {
      proposalRowsMock.rows = []
    }
  })

  it('a refusal the database sends anyway is said as its own sentence, not as a failure (punch list #443, finding 254)', async () => {
    authMock.role = 'dev'
    linkRowsMock.rows = [
      { id: 'l-off', customer_id: 'zz1', audience: 'all', token: 'deadtok', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-02T00:00:00Z', created_by: null },
    ]
    slugRowMock.row = null
    rpcMock.mockClear()
    // The window read no proposal, and one came to name the link before the press.
    rpcMock.mockImplementationOnce(async () => ({ data: null, error: { message: '1 GC proposal names this link. It stays.', code: 'P0001' } }) as never)
    renderWithProviders(<CustomerPortalGlobeButton customerId="zz1" customerName="ZZ Test Portal Customer" />)
    await settle()
    fireEvent.click(screen.getByLabelText("Open ZZ Test Portal Customer's customer portal link"))
    fireEvent.click(await screen.findByTestId('portal-link-delete'))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete the link' }))
    const said = await screen.findByText('1 GC proposal names this link. It stays.')
    expect(said.textContent).toBe('1 GC proposal names this link. It stays.')
    expect(screen.queryByText(/Failed to delete the link/)).toBeNull()
    expect(screen.queryByText('The turned-off link was deleted.')).toBeNull()
  })

  it('an assistant reads no Delete… in History (punch list #443, row 11)', async () => {
    authMock.role = 'assistant'
    try {
      linkRowsMock.rows = [
        { id: 'l-off', customer_id: 'zz2', audience: 'all', token: 'deadtok', created_at: '2026-08-01T00:00:00Z', revoked_at: '2026-08-02T00:00:00Z', created_by: null },
      ]
      slugRowMock.row = null
      rpcMock.mockClear()
      renderWithProviders(<CustomerPortalGlobeButton customerId="zz2" customerName="ZZ Test Portal Customer" />)
      await settle()
      fireEvent.click(screen.getByLabelText("Open ZZ Test Portal Customer's customer portal link"))
      await waitFor(() => expect(screen.getByText('This portal is turned off.')).toBeTruthy())
      // The office's off state is as it was: no History under the box, no press.
      expect(screen.queryByTestId('portal-off-history')).toBeNull()
      expect(screen.queryByTestId('portal-link-delete')).toBeNull()
    } finally {
      authMock.role = 'dev'
    }
  })
})
