// @vitest-environment jsdom
/**
 * Render smokes for the claim table on the Account tab (punch list #171, v2.6679): the two rows that fill in, a
 * typed row with its document door, the total, the Add form's refusal and save, Edit → Remove behind the confirm,
 * and the read-only draw. The rows' math lives in src/lib/legal/legalClaimLines.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LegalClaimTable, { type ClaimPanel } from './LegalClaimTable'
import { claimTable, type LegalClaimLineLike } from '../../../lib/legal/legalClaimLines'

afterEach(cleanup)

const line: LegalClaimLineLike = { id: 'l1', kind: 'materials', title: 'Materials left on site', amount: 5310, basis: 'contract ¶ 9', documentId: 'd1', documentTitle: 'Materials on site — count.pdf', settlementOnly: false }
const table = (lines: LegalClaimLineLike[] = [line]) =>
  claimTable({ balance: 14980, retainageHeldByJob: { j1: 6420 }, retainageAdded: 6420, retainageOnBills: 0, openBills: [{ jobLabel: 'C1412' }, { jobLabel: 'C1419' }], claimLines: lines }, (id) => (id === 'j1' ? 'C1412' : id))
const panel = (over: Partial<ClaimPanel> = {}): ClaimPanel => ({ documents: [{ id: 'd1', title: 'Materials on site — count.pdf' }, { id: 'd2', title: 'Change order 6 — refused.pdf' }], acts: { save: vi.fn(async () => null), remove: vi.fn(async () => null) }, onOpenDocument: vi.fn(), onOpenJob: vi.fn(), ...over })

describe('LegalClaimTable', () => {
  it('draws the two rows that fill in, the typed row with its document door, and the total', () => {
    const p = panel()
    const { container } = render(<LegalClaimTable table={table()} panel={p} />)
    const rows = container.querySelectorAll('[data-legal-claim-row]')
    expect([...rows].map((r) => r.getAttribute('data-legal-claim-row'))).toEqual(['bills', 'retainage', 'typed'])
    expect(within(rows[0] as HTMLElement).getByText('Open bills')).toBeTruthy()
    expect(within(rows[0] as HTMLElement).getByText('2 billed lines, from AR')).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByText('C1412 · Our contract on this job')).toBeTruthy()
    fireEvent.click(within(rows[1] as HTMLElement).getByRole('button', { name: /the job record/ }))
    expect(p.onOpenJob).toHaveBeenCalledWith('j1')
    fireEvent.click(within(rows[2] as HTMLElement).getByRole('button', { name: /Materials on site — count.pdf/ }))
    expect(p.onOpenDocument).toHaveBeenCalledWith('d1')
    const total = container.querySelector('[data-legal-claim-total]') as HTMLElement
    expect(total.textContent).toContain('The claim')
    expect(total.textContent).toContain('$26,710.00')
  })

  it('refuses an empty amount in words, then saves the line as typed', async () => {
    const p = panel()
    const { container } = render(<LegalClaimTable table={table([])} panel={p} />)
    expect(screen.getByText(/Nothing typed yet/)).toBeTruthy()
    fireEvent.click(container.querySelector('[data-legal-claim-add]') as HTMLElement)
    const kind = container.querySelector('[data-legal-claim-kind]') as HTMLSelectElement
    fireEvent.change(kind, { target: { value: 'damages' } })
    // The name follows the kind until the office types one.
    expect((container.querySelector('[data-legal-claim-title]') as HTMLInputElement).value).toBe('Damages')
    fireEvent.click(container.querySelector('[data-legal-claim-save]') as HTMLElement)
    expect(screen.getByRole('alert').textContent).toBe('Type the amount in dollars.')
    expect(p.acts!.save).not.toHaveBeenCalled()
    fireEvent.change(container.querySelector('[data-legal-claim-title]') as HTMLInputElement, { target: { value: 'Demobilization damages' } })
    fireEvent.change(container.querySelector('[data-legal-claim-amount]') as HTMLInputElement, { target: { value: '$2,800.00' } })
    fireEvent.change(container.querySelector('[data-legal-claim-basis]') as HTMLInputElement, { target: { value: 'contract ¶ 14' } })
    fireEvent.change(container.querySelector('[data-legal-claim-document]') as HTMLSelectElement, { target: { value: 'd2' } })
    fireEvent.click(container.querySelector('[data-legal-claim-save]') as HTMLElement)
    await waitFor(() => expect(p.acts!.save).toHaveBeenCalledWith({ kind: 'damages', title: 'Demobilization damages', amount: '$2,800.00', basis: 'contract ¶ 14', documentId: 'd2', settlementOnly: false }, null))
    await waitFor(() => expect(container.querySelector('[data-legal-claim-form]')).toBeNull())
  })

  it('shows the refusal the RPC sent back and keeps the form open', async () => {
    const p = panel({ acts: { save: vi.fn(async () => 'This matter is closed'), remove: vi.fn(async () => null) } })
    const { container } = render(<LegalClaimTable table={table([])} panel={p} />)
    fireEvent.click(container.querySelector('[data-legal-claim-add]') as HTMLElement)
    fireEvent.change(container.querySelector('[data-legal-claim-amount]') as HTMLInputElement, { target: { value: '500' } })
    fireEvent.click(container.querySelector('[data-legal-claim-save]') as HTMLElement)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('This matter is closed'))
    expect(container.querySelector('[data-legal-claim-form]')).toBeTruthy()
  })

  it('Edit opens the line in the form; Remove the line… asks first, then removes', async () => {
    const p = panel()
    const { container } = render(<LegalClaimTable table={table()} panel={p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect((container.querySelector('[data-legal-claim-amount]') as HTMLInputElement).value).toBe('5310.00')
    fireEvent.click(container.querySelector('[data-legal-claim-remove]') as HTMLElement)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Remove Materials left on site from the claim?')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove the line' }))
    await waitFor(() => expect(p.acts!.remove).toHaveBeenCalledWith('l1'))
    await waitFor(() => expect(container.querySelector('[data-legal-claim-form]')).toBeNull())
  })

  it('reads only when the office cannot edit: no Add press, no Edit, the doors still open', () => {
    const p = panel({ acts: null })
    const { container } = render(<LegalClaimTable table={table()} panel={p} />)
    expect(container.querySelector('[data-legal-claim-add]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByText(/Nothing typed yet/)).toBeNull()
    expect(screen.getByRole('button', { name: /Materials on site — count.pdf/ })).toBeTruthy()
  })
})

describe('settlement only (v2.6697, punch list #171)', () => {
  it('wears the chip, stays out of the total, says so under the table, and the form sends the flag', async () => {
    const so: LegalClaimLineLike = { ...line, id: 'l2', kind: 'fees', title: 'Fee waiver', amount: 400, documentId: null, documentTitle: '', settlementOnly: true }
    const p = panel()
    const { container } = render(<LegalClaimTable table={table([line, so])} panel={p} />)
    const rows = container.querySelectorAll('[data-legal-claim-row]')
    expect(within(rows[3] as HTMLElement).getByText('settlement only')).toBeTruthy()
    expect(within(rows[2] as HTMLElement).queryByText('settlement only')).toBeNull()
    expect((container.querySelector('[data-legal-claim-total]') as HTMLElement).textContent).toContain('$26,710.00')
    expect((container.querySelector('[data-legal-claim-settlement-only]') as HTMLElement).textContent).toContain('One line, $400.00, is settlement only.')
    fireEvent.click(container.querySelector('[data-legal-claim-add]') as HTMLElement)
    fireEvent.change(container.querySelector('[data-legal-claim-amount]') as HTMLInputElement, { target: { value: '250' } })
    fireEvent.click(container.querySelector('[data-legal-claim-settlement-only-box]') as HTMLInputElement)
    fireEvent.click(container.querySelector('[data-legal-claim-save]') as HTMLElement)
    await waitFor(() => expect(p.acts!.save).toHaveBeenCalledWith({ kind: 'materials', title: 'Materials left on site', amount: '250', basis: '', documentId: null, settlementOnly: true }, null))
  })
})
