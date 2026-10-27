// @vitest-environment jsdom
/**
 * Render-smoke tests for SettingsHcpReconcileSection (v2.2255) — the dev-only
 * HCP reconcile importer on Settings → Jobs & billing. Since punch list #184 (sweep A, PR 2)
 * the Apply button says its count and what it is made of, a refused row no longer stops the
 * rest, and the rows that did not apply stay listed with the reason.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import SettingsHcpReconcileSection from './SettingsHcpReconcileSection'

// One job with one unlinked payment and no invoice: the invoices export plans one invoice to create.
const TABLES: Record<string, unknown[]> = {
  jobs_ledger: [{ id: 'j1', hcp_number: '1001' }],
  jobs_ledger_invoices: [],
  jobs_ledger_payments: [{ id: 'p1', job_id: 'j1', amount: 500, paid_on: '2026-08-01', invoice_id: null, payment_type: 'check', note: null, sequence_order: 0, mercury_transaction_id: null }],
}
const inserts: string[] = []

vi.mock('../../lib/supabase', () => {
  function builder(table: string, mode: 'read' | 'insert') {
    const result = () =>
      mode === 'insert'
        ? Promise.resolve({ data: null, error: { message: 'new row violates row-level security policy', code: '42501' } })
        : Promise.resolve({ data: TABLES[table] ?? [], error: null })
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'range', 'order', 'update', 'delete', 'single']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => result().then(ok, bad)
    return b
  }
  return {
    supabase: {
      from: (table: string) => ({
        select: () => builder(table, 'read'),
        insert: () => {
          inserts.push(table)
          return builder(table, 'insert')
        },
        update: () => builder(table, 'read'),
        delete: () => builder(table, 'read'),
      }),
    },
  }
})

describe('SettingsHcpReconcileSection render smoke', () => {
  it('renders collapsed, expands to the two lanes with file pickers', () => {
    renderWithProviders(<SettingsHcpReconcileSection />)
    const toggle = screen.getByRole('button', { name: /HCP reconcile/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/Choose invoices export/)).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/1 · Bill dates & links/)).toBeTruthy()
    expect(screen.getByText(/2 · True payment dates/)).toBeTruthy()
    expect(screen.getByText(/Choose invoices export/)).toBeTruthy()
    expect(screen.getByText(/Choose payments report/)).toBeTruthy()
    expect(screen.getByText(/Choose jobs export/)).toBeTruthy()
    // No plan yet → no Apply buttons and no premature "reconciled" state.
    expect(screen.queryByRole('button', { name: /^Apply/ })).toBeNull()
    expect(screen.queryByText(/Nothing to do/)).toBeNull()
  })

  it('Apply says its count, and a refused row stays listed with the reason', async () => {
    const { container } = renderWithProviders(<SettingsHcpReconcileSection />)
    fireEvent.click(screen.getByRole('button', { name: /HCP reconcile/ }))
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const csv = 'Invoice #,Invoice status,Latest send date,Job #\nA1,Paid,2026-08-01T12:00:00Z,1001\n'
    fireEvent.change(input, { target: { files: [new File([csv], 'invoices.csv', { type: 'text/csv' })] } })
    const apply = await screen.findByRole('button', { name: 'Apply 1 invoice' })
    fireEvent.click(apply)
    const failed = await waitFor(() => {
      const el = container.querySelector('[data-hcp-reconcile-failed="invoices"]')
      if (!el) throw new Error('no failed list yet')
      return el
    })
    expect(inserts).toEqual(['jobs_ledger_invoices'])
    expect(failed.textContent).toContain('1 change did not apply. It stays here with the reason.')
    expect(failed.textContent).toContain('Job 1001 · invoice #A1')
    // The refused row is still the plan: the button reads its count and tries it again.
    expect(screen.getByRole('button', { name: 'Apply 1 invoice' })).toBeTruthy()
  })
})
