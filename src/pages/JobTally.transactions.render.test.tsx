// @vitest-environment jsdom
/**
 * Job Tally → Transactions, the person's own card list (v2.5962): a lost signal reads the offline
 * sentence with Retry and never the empty line, and Retry reads the list again.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../lib/networkErrorMessage'

const H = vi.hoisted(() => ({ listError: null as unknown, reads: 0 }))

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers' })
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  /** The list RPC: a chain that answers the failure while it is set. */
  const listChain = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    b.range = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      H.reads++
      return Promise.resolve(H.listError ? { data: null, error: H.listError, status: 0 } : { data: [], error: null }).then(ok, bad)
    }
    return b
  }
  return {
    supabase: {
      ...stub,
      from: (table: string) =>
        table === 'users'
          ? { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: 'helpers' }, error: null }) }) }) }
          : stub.from(),
      rpc: (name: string) => (name === 'list_my_linked_mercury_transactions_for_tally' ? listChain() : stub.rpc()),
    },
  }
})
// The real reader, once: a lost signal is classed as the app classes it, without the retry backoff's wait.
vi.mock('../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../hooks/usePeopleAccess', () => ({ usePeopleAccess: () => ({ canAccessPay: false }) }))
vi.mock('../components/tally/TallyTeamQueue', () => ({ TallyTeamQueue: () => null }))

const { default: JobTally } = await import('./JobTally')

describe('JobTally → my card transactions', () => {
  it('a lost signal reads the offline sentence with Retry and no empty line; Retry reads the list again', async () => {
    H.listError = { message: 'TypeError: Load failed', details: '', hint: '', code: '' }
    H.reads = 0
    renderWithProviders(<JobTally />)
    await screen.findByText(OFFLINE_ERROR_MESSAGE)
    expect(screen.queryByText(/No card transactions to show yet/)).toBeNull()
    H.listError = null
    const before = H.reads
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText(/No card transactions to show yet/)
    expect(H.reads).toBe(before + 1)
  })
})
