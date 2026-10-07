// @vitest-environment jsdom
/**
 * v2.4750: the firm's links dialog — every link listed with its address, Copy / Send… / Rotate / Turn off
 * per live link, the dead ones under Turned off, and the welcome email sent for the link picked (v2.4624).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import LegalPortalLinkButton from './LegalPortalLinkButton'

const tables: Record<string, unknown[]> = {}
const rpcs: Record<string, unknown> = {}
const rpcCalls: Array<[string, Record<string, unknown>]> = []
const invoke = vi.fn()

vi.mock('../../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'order', 'in', 'limit']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: (tables[table] ?? [])[0] ?? null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(ok)
    return b
  }
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args])
        const r = rpcs[name]
        return Promise.resolve(r === undefined ? { data: null, error: { message: `function ${name} does not exist` } } : { data: r, error: null })
      },
      functions: { invoke: (...a: unknown[]) => invoke(...a) },
    },
  }
})

vi.mock('../../../contexts/ConfirmDialogContext', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../contexts/ConfirmDialogContext')>()), useConfirmDialog: () => () => Promise.resolve(true) }))

const firmLink = { id: 'f1', purpose: 'firm', label: null, createdAt: '2026-10-06T15:00:00Z', createdBy: 'Robert', revokedAt: null, revokedBy: null, revokeReason: null, token: 'sample-partner-k4tp9x2mq7zr' }
const janeLink = { id: 'p1', purpose: 'person', label: 'Jane Doe, paralegal', createdAt: '2026-10-06T16:00:00Z', createdBy: 'Will', revokedAt: null, revokedBy: null, revokeReason: null, token: 'sample-partner-aaaaaaaaaaaa' }
const oldLink = { id: 'f0', purpose: 'firm', label: null, createdAt: '2026-09-11T15:00:00Z', createdBy: 'Robert', revokedAt: '2026-10-06T15:00:00Z', revokedBy: 'Robert', revokeReason: 'rotated', token: null }

afterEach(() => {
  cleanup()
  invoke.mockReset()
  rpcCalls.length = 0
  for (const k of Object.keys(tables)) delete tables[k]
  for (const k of Object.keys(rpcs)) delete rpcs[k]
})

const openDialog = () => {
  renderWithProviders(<LegalPortalLinkButton firmId="firm-1" firmName="Sample & Partner" />)
  fireEvent.click(screen.getByRole('button', { name: /Firm’s link/ }))
}

describe('LegalPortalLinkButton — the firm’s links', () => {
  it('lists every link with its short address, the sends, and the turned-off ones', async () => {
    rpcs.list_legal_portal_links = { links: [janeLink, firmLink, oldLink] }
    tables.sent_documents = [{ source_id: 'f1', recipient_emails: ['ann@firm.example.com'], sent_at: '2026-10-02T15:00:00Z', sent_by_name: 'Will' }]
    tables.legal_firms = [{ email: 'ann@firm.example.com' }]
    openDialog()
    await waitFor(() => expect(document.querySelectorAll('[data-legal-link-row]')).toHaveLength(2))
    const firmRow = document.querySelector('[data-legal-link-row="firm"]') as HTMLElement
    expect(firmRow.textContent).toContain('Sample & Partner’s own link')
    expect(firmRow.textContent).toContain('my.clickplumbing.com/sample-partner-k4tp9x2mq7zr')
    expect(firmRow.textContent).toContain('since 2026-10-06 by Robert')
    await waitFor(() => expect(firmRow.querySelector('[data-legal-link-sent]')?.textContent).toMatch(/Sent to ann@firm\.example\.com on 2026-10-02 by Will/))
    const janeRow = document.querySelector('[data-legal-link-row="person"]') as HTMLElement
    expect(janeRow.textContent).toContain('Jane Doe, paralegal')
    expect(janeRow.textContent).toContain('not sent from here yet')
    expect(within(janeRow).getByRole('button', { name: 'Copy' })).toBeTruthy()
    expect(document.querySelector('[data-legal-links-past]')?.textContent).toContain('2026-09-11 to 2026-10-06 · rotated by Robert')
    expect(document.body.textContent).toContain('2 live links: the firm’s own and 1 for one person at the firm.')
  })

  it('sends the firm its own link by default, then a person’s link when Send… is pressed on their row', async () => {
    rpcs.list_legal_portal_links = { links: [janeLink, firmLink] }
    tables.legal_firms = [{ email: 'ann@firm.example.com' }]
    invoke.mockResolvedValue({ data: { ok: true, sentTo: ['ann@firm.example.com'] }, error: null })
    openDialog()
    await waitFor(() => expect(document.querySelector('[data-legal-send-link]')).not.toBeNull())
    expect(document.querySelector('[data-legal-send-link]')?.textContent).toContain('Send the firm their link')
    expect(((await screen.findByRole('checkbox')) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1))
    const [name, opts] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(name).toBe('legal-send-firm-link')
    expect(opts.body).toMatchObject({ firmId: 'firm-1', linkId: 'f1', useOnFile: true, token: 'sample-partner-k4tp9x2mq7zr' })

    const janeRow = document.querySelector('[data-legal-link-row="person"]') as HTMLElement
    fireEvent.click(within(janeRow).getByRole('button', { name: 'Send…' }))
    expect(document.querySelector('[data-legal-send-link]')?.textContent).toContain('Send Jane Doe, paralegal their link')
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
    fireEvent.change(screen.getByLabelText('Another address'), { target: { value: 'jane@firm.example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2))
    const [, opts2] = invoke.mock.calls[1] as [string, { body: Record<string, unknown> }]
    expect(opts2.body).toMatchObject({ firmId: 'firm-1', linkId: 'p1', useOnFile: false, typed: 'jane@firm.example.com' })
  })

  it('creates the firm’s link, adds a person’s, rotates and turns off through the id RPCs', async () => {
    rpcs.list_legal_portal_links = { links: [] }
    rpcs.create_legal_portal_link = { id: 'f1', token: 'sample-partner-k4tp9x2mq7zr', exists: true }
    rpcs.rotate_legal_portal_link = { id: 'f2', token: 'sample-partner-bbbbbbbbbbbb', exists: true }
    rpcs.revoke_legal_portal_link_by_id = { revoked: true }
    tables.legal_firms = [{ email: '' }]
    openDialog()
    await waitFor(() => expect(document.body.textContent).toContain('No link yet.'))
    fireEvent.click(screen.getByRole('button', { name: 'Create the firm’s link' }))
    await waitFor(() => expect(rpcCalls.some(([n]) => n === 'create_legal_portal_link')).toBe(true))
    expect(rpcCalls.find(([n]) => n === 'create_legal_portal_link')![1]).toMatchObject({ p_firm_id: 'firm-1', p_label: null })
    expect(String(rpcCalls.find(([n]) => n === 'create_legal_portal_link')![1].p_address)).toMatch(/^sample-partner-[a-z0-9]{3}$/)

    rpcs.list_legal_portal_links = { links: [firmLink] }
    fireEvent.change(screen.getByLabelText('Who it is for'), { target: { value: 'Jane Doe, paralegal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add a link' }))
    await waitFor(() => expect(rpcCalls.filter(([n]) => n === 'create_legal_portal_link')).toHaveLength(2))
    expect(rpcCalls.filter(([n]) => n === 'create_legal_portal_link')[1]?.[1]).toMatchObject({ p_firm_id: 'firm-1', p_label: 'Jane Doe, paralegal' })

    await waitFor(() => expect(document.querySelector('[data-legal-link-row="firm"]')).not.toBeNull())
    const firmRow = document.querySelector('[data-legal-link-row="firm"]') as HTMLElement
    fireEvent.click(within(firmRow).getByRole('button', { name: 'Rotate' }))
    await waitFor(() => expect(rpcCalls.some(([n]) => n === 'rotate_legal_portal_link')).toBe(true))
    expect(rpcCalls.find(([n]) => n === 'rotate_legal_portal_link')![1]).toMatchObject({ p_link_id: 'f1' })
    // A plain Rotate keeps the name part and rolls three new characters; the 12-character key of v2.4750 gets a default address.
    expect(rpcCalls.find(([n]) => n === 'rotate_legal_portal_link')![1].p_address).toBeNull()
    fireEvent.click(within(document.querySelector('[data-legal-link-row="firm"]') as HTMLElement).getByRole('button', { name: 'Turn off' }))
    await waitFor(() => expect(rpcCalls.some(([n]) => n === 'revoke_legal_portal_link_by_id')).toBe(true))
    expect(rpcCalls.find(([n]) => n === 'revoke_legal_portal_link_by_id')![1]).toEqual({ p_link_id: 'f1' })
  })

  it('Change address… types a name part, rolls the tail and saves it as a rotate to that address', async () => {
    rpcs.list_legal_portal_links = { links: [{ ...firmLink, token: 'sample-partner-f6a' }] }
    rpcs.rotate_legal_portal_link = { id: 'f2', token: 'snell-law-k2m', exists: true }
    tables.legal_firms = [{ email: '' }]
    openDialog()
    await waitFor(() => expect(document.querySelector('[data-legal-link-row="firm"]')).not.toBeNull())
    expect(document.body.textContent).toContain('my.clickplumbing.com/sample-partner-f6a')
    fireEvent.click(screen.getByRole('button', { name: 'Change address…' }))
    const base = screen.getByLabelText('New address') as HTMLInputElement
    expect(base.value).toBe('sample-partner')
    fireEvent.change(base, { target: { value: 'Snell Law' } })
    expect(base.value).toBe('snell-law')
    fireEvent.click(screen.getByRole('button', { name: 'Save the new address' }))
    await waitFor(() => expect(rpcCalls.some(([n]) => n === 'rotate_legal_portal_link')).toBe(true))
    const args = rpcCalls.find(([n]) => n === 'rotate_legal_portal_link')![1]
    expect(args.p_link_id).toBe('f1')
    expect(String(args.p_address)).toMatch(/^snell-law-[a-z0-9]{3}$/)
    // A plain Rotate on a short key keeps the name part.
    rpcCalls.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Rotate' }))
    await waitFor(() => expect(rpcCalls.some(([n]) => n === 'rotate_legal_portal_link')).toBe(true))
    expect(String(rpcCalls.find(([n]) => n === 'rotate_legal_portal_link')![1].p_address)).toMatch(/^sample-partner-[a-z0-9]{3}$/)
  })

  it('before the list RPC is live, says so instead of going quiet', async () => {
    tables.legal_firms = [{ email: '' }]
    openDialog()
    await waitFor(() => expect(document.body.textContent).toContain('needs a database update that is not live yet'))
    expect(screen.queryByRole('button', { name: 'Create the firm’s link' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Preview ↗' }).getAttribute('href')).toBe('http://localhost:3000/legal?firm=firm-1&preview=1')
  })

  it('holds the send button and says why when an address is not an email', async () => {
    rpcs.list_legal_portal_links = { links: [firmLink] }
    tables.legal_firms = [{ email: '' }]
    openDialog()
    await waitFor(() => expect(document.querySelector('[data-legal-send-link]')).not.toBeNull())
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.change(screen.getByLabelText('Another address'), { target: { value: 'not-an-email' } })
    expect((screen.getByRole('button', { name: 'Send the link' }) as HTMLButtonElement).disabled).toBe(true)
    expect(invoke).not.toHaveBeenCalled()
  })
})
