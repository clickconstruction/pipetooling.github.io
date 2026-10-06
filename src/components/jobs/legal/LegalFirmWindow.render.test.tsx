// @vitest-environment jsdom
/**
 * The firm's window on the Legal desk (v2.4711): a dev edits the Settings block itself and a
 * save reloads the desk; everyone else reads the firm; what hangs on the firm is said first;
 * Esc and a click outside close the window alone.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../../test/renderSmokeMocks'
import LegalFirmWindow, { LEGAL_FIRM_SETTINGS_HREF } from './LegalFirmWindow'
import type { LegalFirmRow, LegalMatterRow, LegalRecipientRow } from '../../../lib/legal/legalMatters'

const db = vi.hoisted(() => ({ writes: [] as Array<{ table: string; op: string; payload: unknown }> }))

vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../../lib/supabase', () => {
  const answer = (table: string, op: string, single: boolean) => {
    if (table === 'legal_firms' && op === 'select') return { data: [{ id: 'firm-1', name: 'ZZ Test Firm', handling_name: '', email: 'zz@test.example', phone: '', contingency_pct: 33, filing_cost: 350, active: true }], error: null }
    if (table === 'legal_firms') return { data: { id: 'firm-1' }, error: null }
    if (table === 'app_settings' && op === 'select') return { data: single ? { value_text: JSON.stringify({ entity: 'Click Plumbing and Electrical, LLC', license: 'M-41207' }) } : [], error: null }
    if (table === 'legal_portal_links') return { data: [{ id: 'link-1' }], error: null }
    return { data: single ? null : [], error: null }
  }
  const builder = (table: string) => {
    let op = 'select'
    let single = false
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'order', 'limit', 'in']) b[m] = () => b
    for (const m of ['update', 'insert', 'upsert']) {
      b[m] = (payload: unknown) => {
        op = m
        db.writes.push({ table, op: m, payload })
        return b
      }
    }
    b.single = () => {
      single = true
      return b
    }
    b.maybeSingle = b.single
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(answer(table, op, single)).then(ok, bad)
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

const firm: LegalFirmRow = { id: 'firm-1', name: 'ZZ Test Firm', handling_name: 'Dana Holt', email: 'zz@test.example', phone: '(512) 555-0100', contingency_pct: 33, filing_cost: 350, active: true } as LegalFirmRow
const matters = [{ id: 'm1', firm_id: 'firm-1', stage: 'referred', closed_at: null, payer_name: 'Brazos Ridge Contracting', payer_key: 'c:brazos' }] as unknown as LegalMatterRow[]
const recipients = [{ id: 'r1', firm_id: 'firm-1', removed_at: null }, { id: 'r2', firm_id: 'firm-1', removed_at: null }] as unknown as LegalRecipientRow[]

function renderWindow(extra: { canEdit: boolean; firm?: LegalFirmRow | null }) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  renderWithProviders(<LegalFirmWindow firm={extra.firm === undefined ? firm : extra.firm} matters={matters} recipients={recipients} canEdit={extra.canEdit} onClose={onClose} onSaved={onSaved} zIndex={800} />)
  return { onClose, onSaved }
}

describe('LegalFirmWindow', () => {
  it('a dev edits the firm in the Settings block itself, and a save reloads the desk', async () => {
    db.writes.length = 0
    const { onSaved } = renderWindow({ canEdit: true })
    await settle()
    expect(screen.getByRole('dialog', { name: 'The collections law firm' })).toBeTruthy()
    expect(document.querySelector('[data-legal-firm-block="window"]')).toBeTruthy()
    expect(document.getElementById('settings-legal-firm')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Who we release accounts to' })).toBeTruthy()
    const name = await screen.findByDisplayValue('ZZ Test Firm')
    expect(await screen.findByText('portal link on')).toBeTruthy()
    expect(screen.getByText('1 account with the firm')).toBeTruthy()
    expect(screen.getByText('2 people on its email list')).toBeTruthy()
    expect(await screen.findByText('2 of 8 filled')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open in Settings ↗' }).getAttribute('href')).toBe(LEGAL_FIRM_SETTINGS_HREF)
    expect(screen.getByRole('button', { name: 'Replace with a new firm…' })).toBeTruthy()
    fireEvent.change(name, { target: { value: 'Example Law Firm, PLLC' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save firm' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(db.writes).toContainEqual(expect.objectContaining({ table: 'legal_firms', op: 'update', payload: expect.objectContaining({ name: 'Example Law Firm, PLLC' }) }))
  })

  it('everyone else reads the firm and is told who can change it', async () => {
    renderWindow({ canEdit: false })
    await settle()
    expect(document.querySelector('[data-legal-firm-readonly]')).toBeTruthy()
    expect(screen.getByText('ZZ Test Firm')).toBeTruthy()
    expect(screen.getByText('Dana Holt')).toBeTruthy()
    expect(screen.getByText('1 account with the firm')).toBeTruthy()
    expect(screen.getByText('Only a dev can change the firm. Ask a dev to update it.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Open in Settings ↗' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save firm' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Replace with a new firm…' })).toBeNull()
  })

  it('says so when no firm is set up', async () => {
    renderWindow({ canEdit: false, firm: null })
    await settle()
    expect(screen.getByText('No collections law firm is set up yet.')).toBeTruthy()
    expect(document.querySelector('[data-legal-firm-facts]')).toBeNull()
  })

  it('Esc and a click outside close the window and nothing else', async () => {
    const { onClose } = renderWindow({ canEdit: false })
    await settle()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('dialog', { name: 'The collections law firm' }).parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('dialog', { name: 'The collections law firm' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
