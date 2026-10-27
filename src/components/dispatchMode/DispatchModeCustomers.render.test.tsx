// @vitest-environment jsdom
/**
 * Render smoke for the phone dock's Customers list (v2.5962): a lost signal reads the offline sentence
 * with Retry and Retry reads the list again; a refused read names what it could not read, with no Retry.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

const H = vi.hoisted(() => ({ customersError: null as unknown, reads: 0 }))
vi.mock('../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'gte', 'order', 'range', 'limit']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      if (table === 'customers') H.reads++
      const failed = table === 'customers' && H.customersError
      const rows = table === 'customers' ? [{ id: 'c1', name: 'Lenox Builders', address: '12 Lenox Ct' }] : []
      return Promise.resolve(failed ? { data: null, error: H.customersError, status: 0 } : { data: rows, error: null }).then(ok, bad)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})
// The real reader, once: a refusal or a lost signal is classed as the app classes it, without the retry backoff's wait.
vi.mock('../../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'subcontractor' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('./CustomerSummaryModal', () => ({ default: () => null }))

import DispatchModeCustomers from './DispatchModeCustomers'

describe('DispatchModeCustomers', () => {
  it('a lost signal reads the offline sentence with Retry, and Retry reads the list again', async () => {
    H.customersError = { message: 'TypeError: Load failed', details: '', hint: '', code: '' }
    H.reads = 0
    renderWithProviders(<DispatchModeCustomers />)
    await screen.findByText(OFFLINE_ERROR_MESSAGE)
    expect(screen.queryByText('No customers match.')).toBeNull()
    H.customersError = null
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Lenox Builders')
    expect(H.reads).toBe(2)
  })

  it('a refused read names what it could not read, with no Retry', async () => {
    H.customersError = { message: 'permission denied for table customers', code: '42501', details: null, hint: null }
    renderWithProviders(<DispatchModeCustomers />)
    await screen.findByText("You don't have access to this customer list.")
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    H.customersError = null
  })
})
