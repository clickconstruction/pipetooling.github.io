// @vitest-environment jsdom
/**
 * Quickfill's Needs You carries the move window's line (v2.5723, punch list #132): the office set
 * gets the strip's numbers into the builder and the line on screen, other roles do not, and Work
 * the list lands on the worked list — /materials?tab=supply-houses&list=movable.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { NeedsYouInputs } from '../../lib/dashboardNeedsYou'
import { JobsListCacheProvider } from '../../contexts/JobsListCacheContext'
import { QuickfillNeedsYouSection } from './QuickfillNeedsYouSection'

/** The section sits under the app's jobs-list cache (one of its stations reads it). */
const section = () => (
  <JobsListCacheProvider>
    <QuickfillNeedsYouSection />
  </JobsListCacheProvider>
)

const WINDOW = { count: 1, dollars: 213.5, asked: 0, soonestDueYmd: '2026-11-05' }
const auth = { role: 'assistant' }
const seen: NeedsYouInputs[] = []
const navigate = vi.fn()

vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: auth.role }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))
vi.mock('../../hooks/useSupplyMoveWindowNudge', () => ({
  useSupplyMoveWindowNudge: (enabled: boolean) => ({ moveWindow: enabled ? WINDOW : null, reload: () => {} }),
}))
vi.mock('../../lib/dashboardNeedsYou', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dashboardNeedsYou')>('../../lib/dashboardNeedsYou')
  return {
    ...actual,
    // The real builder over the section's own inputs; every call is kept.
    buildNeedsYouItems: (inputs: NeedsYouInputs) => {
      seen.push(inputs)
      return actual.buildNeedsYouItems(inputs)
    },
  }
})

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  seen.length = 0
  navigate.mockClear()
})

describe('QuickfillNeedsYouSection · the move window', () => {
  it.each(['dev', 'master_technician', 'assistant', 'controller'])('%s gets the line with the strip’s numbers', async (role) => {
    auth.role = role
    renderWithProviders(section())
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.supplyMoveWindowEnabled).toBe(true)
    expect(last.supplyMoveWindow).toEqual(WINDOW)
    expect(screen.getByText('$213.50 on one current invoice is not on a job account yet')).toBeTruthy()
  })

  it.each(['estimator', 'primary'])('%s does not', async (role) => {
    auth.role = role
    renderWithProviders(section())
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.supplyMoveWindowEnabled).toBe(false)
    expect(screen.queryByText(/is not on a job account yet/)).toBeNull()
  })

  it('Work the list opens the worked list on Materials → Supply houses', async () => {
    // The move window is the office's line (v2.5843): a controller reads it folded, the assistant presses it.
    auth.role = 'assistant'
    renderWithProviders(section())
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Work the list/ }))
    expect(navigate).toHaveBeenCalledWith('/materials?tab=supply-houses&list=movable')
  })
})
