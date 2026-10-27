// @vitest-environment jsdom
/**
 * Render smoke for Rate my crew (Supervision, PR 4): the deck loads its cards from the
 * RPC, shows the first unrated person with the sliders, and saves a supervisor row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'

type RpcResult = { data: unknown; error: { message: string; code?: string } | null; status?: number }
const H = vi.hoisted(() => ({
  rpc: vi.fn(async (): Promise<RpcResult> => ({ data: null, error: null })),
  upserts: [] as unknown[],
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: H.rpc,
    from: () => ({
      upsert: (row: unknown) => {
        H.upserts.push(row)
        return { select: () => Promise.resolve({ data: [{ id: 'r1' }], error: null }) }
      },
    }),
  },
}))

// The real reader, once: a lost signal is classed as the app classes it, without the retry backoff's wait.
vi.mock('../../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
// The Retry panel reads the person for its telemetry (v2.5962).
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

import RateMyCrewDeck from './RateMyCrewDeck'

describe('RateMyCrewDeck', () => {
  beforeEach(() => {
    H.rpc.mockReset()
    H.upserts.length = 0
  })
  afterEach(() => cleanup())

  it('shows the first unrated person, then saves a supervisor row and moves on', async () => {
    H.rpc.mockResolvedValue({
      data: {
        supervisor: true,
        month: '2026-09-01',
        people: [
          { user_id: 'sam', name: 'Sam Reyes', role: 'helpers', days: 3, jobs: ['J258 · Oak St'], reviewed: true },
          { user_id: 'bryan', name: 'Bryan Ortiz', role: 'helpers', days: 4, jobs: ['J258 · Oak St', 'J291 · Elm Ct'], reviewed: false },
        ],
      },
      error: null,
    })
    renderWithProviders(<RateMyCrewDeck open onClose={() => {}} userId="mike" reviewMonth="2026-09-01" />)
    await screen.findByRole('heading', { name: 'Bryan Ortiz' })
    expect(screen.getByText(/4 days together · J258 · Oak St, J291 · Elm Ct/)).toBeTruthy()
    const save = screen.getByRole('button', { name: /Save Bryan Ortiz/ }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    const slider = screen.getAllByRole('slider')[0] as HTMLInputElement
    fireEvent.change(slider, { target: { value: '72' } })
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.click(save)
    await waitFor(() => expect(H.upserts.length).toBe(1))
    expect(H.upserts[0]).toMatchObject({ subject_user_id: 'bryan', reviewer_user_id: 'mike', review_month: '2026-09-01', source: 'supervisor', rating_ability: 72 })
    // Sam was already rated, so the deck is done.
    await screen.findByText(/That's your crew for/)
  })

  it('says so when nobody qualifies', async () => {
    H.rpc.mockResolvedValue({ data: { supervisor: true, month: '2026-09-01', people: [] }, error: null })
    renderWithProviders(<RateMyCrewDeck open onClose={() => {}} userId="mike" reviewMonth="2026-09-01" />)
    await screen.findByText(/Nobody you supervised on two or more days/)
  })

  it('a lost signal reads the offline sentence with Retry, never "Nobody you supervised"; Retry reads the deck again', async () => {
    H.rpc.mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 })
    H.rpc.mockResolvedValue({ data: { supervisor: true, month: '2026-09-01', people: [] }, error: null })
    renderWithProviders(<RateMyCrewDeck open onClose={() => {}} userId="mike" reviewMonth="2026-09-01" />)
    await screen.findByText(OFFLINE_ERROR_MESSAGE)
    expect(screen.queryByText(/Nobody you supervised/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText(/Nobody you supervised on two or more days/)
    expect(H.rpc).toHaveBeenCalledTimes(2)
  })
})
