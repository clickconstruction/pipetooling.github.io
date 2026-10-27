// @vitest-environment jsdom
/**
 * Render smoke for Checklist → Cost this task (v2.5962): the people and pay read; a lost signal reads
 * the offline sentence with Retry above the form, Cancel stays, and Retry reads them again.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

const H = vi.hoisted(() => ({ usersError: null as unknown, reads: 0 }))
vi.mock('../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      if (table === 'users') H.reads++
      const failed = table === 'users' && H.usersError
      const rows = table === 'users' ? [{ id: 'u1', name: 'Bryan Ortiz', email: 'b@example.com' }] : []
      return Promise.resolve(failed ? { data: null, error: H.usersError, status: 0 } : { data: rows, error: null }).then(ok, bad)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})
// The real reader, once: a lost signal is classed as the app classes it, without the retry backoff's wait.
vi.mock('../../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../../hooks/useChecklistCostEstimates', () => ({ useChecklistCostEstimates: () => ({}) }))
vi.mock('../../lib/checklistCostStore', () => ({
  cachedChecklistCostEstimates: () => ({}),
  writeChecklistCostActual: vi.fn(),
  writeChecklistCostEstimate: vi.fn(),
}))

import ChecklistCostModal from './ChecklistCostModal'

describe('ChecklistCostModal', () => {
  it('a lost signal reads the offline sentence with Retry above the form, Cancel stays, and Retry reads again', async () => {
    H.usersError = { message: 'TypeError: Load failed', details: '', hint: '', code: '' }
    H.reads = 0
    renderWithProviders(<ChecklistCostModal open costKey="k1" taskTitle="Snake the main" onClose={() => {}} />)
    await screen.findByText(OFFLINE_ERROR_MESSAGE)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    H.usersError = null
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('option', { name: 'Bryan Ortiz' })
    expect(screen.queryByText(OFFLINE_ERROR_MESSAGE)).toBeNull()
    expect(H.reads).toBe(2)
  })
})
