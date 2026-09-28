// @vitest-environment jsdom
/**
 * v2.3872: the job form's three inline confirm overlays as components. Pins each seam — closed
 * renders nothing; open reads its words and numbers; the buttons and the backdrop call the shell's
 * callbacks, and stay put while a remove is in flight; the Stripe preview closes on Escape and
 * prints one line per named line item.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderSettled, renderWithProviders } from '../../test/renderSmokeMocks'
import { JobFormPaymentRemoveConfirm } from './JobFormPaymentRemoveConfirm'
import { JobFormStripeLinePreviewDialog } from './JobFormStripeLinePreviewDialog'
import { JobFormMercuryUnlinkConfirm } from './JobFormMercuryUnlinkConfirm'
import type { FixtureRow, PaymentRow } from '../../lib/jobs/jobFormTypes'

afterEach(() => {
  cleanup()
})

describe('JobFormPaymentRemoveConfirm', () => {
  const preview = { rowAmt: 500, jobTotal: 2_000, currentRem: 800, newRem: 1_300 }
  it('closed renders nothing; open shows the line, the totals and which copy applies, and wires both buttons', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const { container } = renderWithProviders(<JobFormPaymentRemoveConfirm open={false} preview={preview} confirmsPersistedRpc busy={false} onCancel={onCancel} onConfirm={onConfirm} zIndex={1011} />)
    expect(container.textContent).toBe('')
    cleanup()
    await renderSettled(<JobFormPaymentRemoveConfirm open preview={preview} confirmsPersistedRpc busy={false} onCancel={onCancel} onConfirm={onConfirm} zIndex={1011} />, { loaded: () => screen.findByText('Remove payment?') })
    expect(screen.getByText(/updates the database immediately/)).toBeTruthy()
    expect(screen.getByText('$1,300.00')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove payment' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
  it('a line that was only typed says autosave carries the change — the form has no Save button to press', async () => {
    await renderSettled(<JobFormPaymentRemoveConfirm open preview={preview} confirmsPersistedRpc={false} busy={false} onCancel={() => {}} onConfirm={() => {}} zIndex={1011} />, { loaded: () => screen.findByText('Remove payment?') })
    expect(screen.getByText(/leaves the form now, and the job saves the change by itself/)).toBeTruthy()
    expect(screen.queryByText(/updates the database immediately/)).toBeNull()
    expect(screen.queryByText(/click/i)).toBeNull()
  })
  it('the form-only copy when the remove is not persisted; the confirm is disabled while busy or with no preview', async () => {
    await renderSettled(<JobFormPaymentRemoveConfirm open preview={null} confirmsPersistedRpc={false} busy onCancel={() => {}} onConfirm={() => {}} zIndex={1011} />, { loaded: () => screen.findByText('Remove payment?') })
    expect(screen.getByText('This payment line is no longer available.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Removing…' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('JobFormStripeLinePreviewDialog', () => {
  const rows = [
    { id: 'f1', name: 'Water heater', line_description: '50 gal', discount_pct: null },
    { id: 'f2', name: 'Hose bibb', line_description: '', discount_pct: null },
  ] as unknown as FixtureRow[]
  it('prints one Stripe line per named row, closes from the button and on Escape', async () => {
    const onClose = vi.fn()
    await renderSettled(<JobFormStripeLinePreviewDialog open rows={rows} onClose={onClose} zIndex={1011} />, { loaded: () => screen.findByText('Stripe line descriptions') })
    expect(screen.getByText(/Water heater/)).toBeTruthy()
    expect(screen.getByText(/Hose bibb/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
  it('says so when no line is named yet; closed renders nothing', () => {
    renderWithProviders(<JobFormStripeLinePreviewDialog open rows={[]} onClose={() => {}} zIndex={1011} />)
    expect(screen.getByText('No named line items yet.')).toBeTruthy()
    cleanup()
    const { container } = renderWithProviders(<JobFormStripeLinePreviewDialog open={false} rows={rows} onClose={() => {}} zIndex={1011} />)
    expect(container.textContent).toBe('')
  })
})

describe('JobFormMercuryUnlinkConfirm', () => {
  const payments = [{ id: 'p1', amount: 250, mercury_transaction_id: 'mtx-1' }] as unknown as PaymentRow[]
  const editing = { id: 'job-1', status: 'paid' } as unknown as Parameters<typeof JobFormMercuryUnlinkConfirm>[0]['editing']
  it('closed with no row; open warns about double-counting and, on a Paid job, about moving back to Billed; the buttons wire through', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const { container } = renderWithProviders(<JobFormMercuryUnlinkConfirm rowId={null} payments={payments} editing={editing} busyRowId={null} onCancel={onCancel} onConfirm={onConfirm} zIndex={1011} />)
    expect(container.textContent).toBe('')
    cleanup()
    await renderSettled(<JobFormMercuryUnlinkConfirm rowId="p1" payments={payments} editing={editing} busyRowId={null} onCancel={onCancel} onConfirm={onConfirm} zIndex={1011} />, { loaded: () => screen.findByText('Unlink and remove?') })
    expect(screen.getByText(/could double-count/)).toBeTruthy()
    expect(screen.getByText(/This job is Paid/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Unlink and remove' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
  it('while the unlink runs, both buttons are disabled and read Removing…, and the backdrop does not cancel', async () => {
    const onCancel = vi.fn()
    await renderSettled(<JobFormMercuryUnlinkConfirm rowId="p1" payments={payments} editing={editing} busyRowId="p1" onCancel={onCancel} onConfirm={() => {}} zIndex={1011} />, { loaded: () => screen.findByText('Unlink and remove?') })
    expect((screen.getByRole('button', { name: 'Removing…' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onCancel).not.toHaveBeenCalled()
  })
})
