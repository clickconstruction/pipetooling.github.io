// @vitest-environment jsdom
/**
 * Render smoke for Job Tally → Allocate from clock (v2.5962): the three days' sessions read; a lost
 * signal reads the offline sentence with Retry and Retry reads them again; a refused read names what it
 * could not read, with no Retry.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

const H = vi.hoisted(() => ({ sessionsError: null as unknown, reads: 0 }))
vi.mock('../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      if (table === 'clock_sessions') H.reads++
      const failed = table === 'clock_sessions' && H.sessionsError
      return Promise.resolve(failed ? { data: null, error: H.sessionsError, status: 0 } : { data: [], error: null }).then(ok, bad)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table), rpc: () => Promise.resolve({ data: null, error: null }) } }
})
// The real reader, once: a refusal or a lost signal is classed as the app classes it, without the retry backoff's wait.
vi.mock('../../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

import { TallyClockWindowAllocateModal } from './TallyClockWindowAllocateModal'

function open() {
  return renderWithProviders(
    <TallyClockWindowAllocateModal
      open
      onClose={() => {}}
      userId="u1"
      transactionId="tx1"
      swipeAtIso="2026-10-20T18:00:00Z"
      transactionAmount={-42.5}
      onSaved={() => {}}
    />,
  )
}

describe('TallyClockWindowAllocateModal', () => {
  it('a lost signal reads the offline sentence with Retry, and Retry reads the sessions again', async () => {
    H.sessionsError = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }
    H.reads = 0
    open()
    await screen.findByText(OFFLINE_ERROR_MESSAGE)
    expect(screen.queryByText(/No clock sessions with a job or bid/)).toBeNull()
    H.sessionsError = null
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText(/No clock sessions with a job or bid/)
    expect(H.reads).toBe(2)
  })

  it('a refused read names what it could not read, with no Retry', async () => {
    H.sessionsError = { message: 'permission denied for table clock_sessions', code: '42501', details: null, hint: null }
    open()
    await screen.findByText("You don't have access to this clock history.")
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    H.sessionsError = null
  })
})
