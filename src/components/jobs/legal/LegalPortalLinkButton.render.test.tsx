// @vitest-environment jsdom
/** v2.4624 (punch list #85 item 21): the link card sends the firm its link and says when it went. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import LegalPortalLinkButton from './LegalPortalLinkButton'

const tables: Record<string, unknown[]> = {}
const invoke = vi.fn()

vi.mock('../../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'order', 'in', 'limit']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: (tables[table] ?? [])[0] ?? null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(ok)
    return b
  }
  return { supabase: { from: (t: string) => builder(t), rpc: () => builder('rpc'), functions: { invoke: (...a: unknown[]) => invoke(...a) } } }
})

afterEach(() => {
  cleanup()
  invoke.mockReset()
  for (const k of Object.keys(tables)) delete tables[k]
})

describe('LegalPortalLinkButton — Send the firm their link', () => {
  it('shows the last send of this link, and sends to the address on file plus a typed one', async () => {
    tables.legal_portal_links = [{ id: 'link-1', token: 'tok_0123456789abcdef', created_at: '2026-10-01T15:00:00Z', revoked_at: null }]
    tables.sent_documents = [{ recipient_emails: ['ann@firm.example.com'], sent_at: '2026-10-02T15:00:00Z', sent_by_name: 'Will' }]
    tables.legal_firms = [{ email: 'ann@firm.example.com' }]
    invoke.mockResolvedValue({ data: { ok: true, sentTo: ['ann@firm.example.com', 'bo@firm.example.com'] }, error: null })
    renderWithProviders(<LegalPortalLinkButton firmId="firm-1" firmName="Sample & Partner" />)
    fireEvent.click(screen.getByRole('button', { name: /Firm’s link/ }))
    await waitFor(() => expect(document.querySelector('[data-legal-link-sent]')?.textContent).toMatch(/Sent to ann@firm\.example\.com on 2026-10-02 by Will/))
    expect(((await screen.findByRole('checkbox')) as HTMLInputElement).checked).toBe(true)
    fireEvent.change(screen.getByLabelText('Another address'), { target: { value: 'bo@firm.example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send it again' }))
    await waitFor(() => expect(invoke).toHaveBeenCalled())
    const [name, opts] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(name).toBe('legal-send-firm-link')
    expect(opts.body).toMatchObject({ firmId: 'firm-1', useOnFile: true, typed: 'bo@firm.example.com', token: 'tok_0123456789abcdef' })
  })

  it('a live link with no token readable (hash only at rest, item 22) still sends, with no token in the body', async () => {
    tables.legal_portal_links = [{ id: 'link-1', firm_id: 'firm-1', token_hash: 'abc', created_at: '2026-10-01T15:00:00Z', revoked_at: null }]
    tables.legal_firms = [{ email: 'ann@firm.example.com' }]
    invoke.mockResolvedValue({ data: { ok: true, sentTo: ['ann@firm.example.com'] }, error: null })
    renderWithProviders(<LegalPortalLinkButton firmId="firm-1" firmName="Sample & Partner" />)
    fireEvent.click(screen.getByRole('button', { name: /Firm’s link/ }))
    await waitFor(() => expect(document.querySelector('[data-legal-link-hidden]')).not.toBeNull())
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }))
    await waitFor(() => expect(invoke).toHaveBeenCalled())
    const [, opts] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(opts.body).toMatchObject({ firmId: 'firm-1', useOnFile: true })
    expect(opts.body).not.toHaveProperty('token')
    expect(opts.body).not.toHaveProperty('publicOrigin')
  })

  it('holds the button and says why when an address is not an email', async () => {
    tables.legal_portal_links = [{ id: 'link-1', token: 'tok_0123456789abcdef', created_at: '2026-10-01T15:00:00Z', revoked_at: null }]
    tables.legal_firms = [{ email: '' }]
    renderWithProviders(<LegalPortalLinkButton firmId="firm-1" firmName="Sample & Partner" />)
    fireEvent.click(screen.getByRole('button', { name: /Firm’s link/ }))
    await waitFor(() => expect(document.querySelector('[data-legal-send-link]')).not.toBeNull())
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(document.body.textContent).toMatch(/Not sent from here yet/)
    fireEvent.change(screen.getByLabelText('Another address'), { target: { value: 'not-an-email' } })
    expect((screen.getByRole('button', { name: 'Send the link' }) as HTMLButtonElement).disabled).toBe(true)
    expect(invoke).not.toHaveBeenCalled()
  })
})
