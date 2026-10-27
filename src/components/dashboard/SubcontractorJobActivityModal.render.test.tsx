// @vitest-environment jsdom
/**
 * Render smoke for a job's Recent activity on the crew's Dashboard (v2.5962): a lost signal reads the
 * offline sentence with Retry and Retry reads the feed again; a refused read names what it could not
 * read, with no Retry.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

const H = vi.hoisted(() => ({ error: null as unknown, reads: 0 }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: async () => {
      H.reads++
      return H.error ? { data: null, error: H.error, status: 0 } : { data: [], error: null }
    },
  },
}))
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

import SubcontractorJobActivityModal from './SubcontractorJobActivityModal'

function open() {
  return renderWithProviders(<SubcontractorJobActivityModal open onClose={() => {}} jobId="j1" hcpNumber="1842" jobName="Riverside" />)
}

describe('SubcontractorJobActivityModal', () => {
  it('a lost signal reads the offline sentence with Retry, and Retry reads the feed again', async () => {
    H.error = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }
    H.reads = 0
    open()
    await screen.findByText(OFFLINE_ERROR_MESSAGE)
    H.error = null
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText(/No activity of these types appears for you yet/)
    expect(H.reads).toBe(2)
  })

  it('a refused read names what it could not read, with no Retry', async () => {
    H.error = { message: 'permission denied for function list_my_accessible_job_activity_events', code: '42501', details: null, hint: null }
    open()
    await screen.findByText("You don't have access to this job activity.")
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    H.error = null
  })
})
