// @vitest-environment jsdom
/**
 * Replace the firm (v2.4712): the panel says what retiring does before it is pressed, checks the
 * new firm's form, calls `legal_replace_firm` once, and while an account is still with the old
 * firm it refuses and points back to that account on the desk.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import LegalFirmReplacePanel from './LegalFirmReplacePanel'
import type { LegalFirmRow } from '../../../lib/legal/legalMatters'
import type { LegalFirmFacts } from '../../../lib/legal/legalFirmFacts'

const rpc = vi.hoisted(() => ({ legalRpcData: vi.fn() }))
vi.mock('../../../hooks/useLegalMatters', () => ({ legalRpcData: rpc.legalRpcData }))

const firm = { id: 'firm-zz', name: 'ZZ Test Firm', handling_name: '', email: '', phone: '', contingency_pct: 33, filing_cost: 350, active: true } as LegalFirmRow
const free: LegalFirmFacts = { withFirm: [], people: 2, linkLive: true }
const busy: LegalFirmFacts = { withFirm: [{ id: 'm1', payerName: 'Brazos Ridge Contracting', payerKey: 'c:brazos' }], people: 0, linkLive: false }

function renderPanel(facts: LegalFirmFacts) {
  const onReplaced = vi.fn()
  const onShowAccount = vi.fn()
  renderWithProviders(<LegalFirmReplacePanel firm={firm} facts={facts} onReplaced={onReplaced} onShowAccount={onShowAccount} />)
  fireEvent.click(screen.getByRole('button', { name: 'Replace with a new firm…' }))
  return { onReplaced, onShowAccount }
}

describe('LegalFirmReplacePanel', () => {
  beforeEach(() => rpc.legalRpcData.mockReset())

  it('says what retiring the stand-in does, then replaces it in one call', async () => {
    rpc.legalRpcData.mockResolvedValue({ error: null, data: { ok: true, firm_id: 'firm-new' } })
    const { onReplaced } = renderPanel(free)
    expect(screen.getByText('ZZ Test Firm is retired. Its history stays on its record.')).toBeTruthy()
    expect(screen.getByText('Its portal link stops working.')).toBeTruthy()
    expect(screen.getByText('Its 2 people on its email list stop getting emails.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Replace the firm' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Give the firm a name.')
    expect(rpc.legalRpcData).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText('Example Law Firm, PLLC'), { target: { value: '  Example Law Firm, PLLC ' } })
    fireEvent.change(screen.getByPlaceholderText('A. Attorney'), { target: { value: 'Ann Example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Replace the firm' }))
    await waitFor(() => expect(onReplaced).toHaveBeenCalledTimes(1))
    expect(rpc.legalRpcData).toHaveBeenCalledWith('legal_replace_firm', { p_old_firm_id: 'firm-zz', p_name: 'Example Law Firm, PLLC', p_handling_name: 'Ann Example', p_email: '', p_phone: '', p_contingency_pct: 33, p_filing_cost: 350 })
    expect(screen.getByRole('button', { name: 'Replace with a new firm…' })).toBeTruthy()
  })

  it('shows a refusal in the office’s words and keeps the form open', async () => {
    rpc.legalRpcData.mockResolvedValue({ error: 'Could not find the function public.legal_replace_firm(p_contingency_pct) in the schema cache', data: null })
    const { onReplaced } = renderPanel(free)
    fireEvent.change(screen.getByPlaceholderText('Example Law Firm, PLLC'), { target: { value: 'Example Law Firm, PLLC' } })
    fireEvent.click(screen.getByRole('button', { name: 'Replace the firm' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Replacing needs a database update that is not live yet/)
    expect(onReplaced).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Replace the firm' })).toBeTruthy()
  })

  it('while an account is with the stand-in, refuses and points back to it on the desk', () => {
    const { onShowAccount } = renderPanel(busy)
    expect(screen.getByText(/1 account is with ZZ Test Firm\./)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Replace the firm' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByPlaceholderText('Example Law Firm, PLLC')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show it on the desk' }))
    expect(onShowAccount).toHaveBeenCalledWith('c:brazos')
    expect(rpc.legalRpcData).not.toHaveBeenCalled()
  })
})
