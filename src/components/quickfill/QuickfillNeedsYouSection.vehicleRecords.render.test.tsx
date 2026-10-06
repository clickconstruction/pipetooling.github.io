// @vitest-environment jsdom
/**
 * Quickfill's Needs You carries the Dashboard's vehicle-records card (v2.4700, the owner's ask):
 * dev, assistant and controller get the vehicle gaps into the builder and the card on screen,
 * other roles do not, and the card's button opens People → Vehicles.
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

const GAPS = [{ vehicleId: 'v-1', name: '2016 Ford F-250', holderUserId: 'u-1', holderName: 'Sam P.', missing: ['insurance' as const, 'registration' as const, 'service' as const], insuranceOnPlan: true }]
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
vi.mock('../../hooks/useVehicleRecordGapsNudge', () => ({
  useVehicleRecordGapsNudge: (enabled: boolean) => ({ gaps: enabled ? GAPS : null, reload: () => {} }),
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

describe('QuickfillNeedsYouSection · vehicle records', () => {
  it.each(['dev', 'assistant', 'controller'])('%s gets the vehicles missing records', async (role) => {
    auth.role = role
    renderWithProviders(section())
    await settle()
    // first paint and after the hooks settle: the builder got the gate and the gaps
    const last = seen[seen.length - 1]!
    expect(last.vehicleRecordGapsEnabled).toBe(true)
    expect(last.vehicleRecordGaps).toEqual(GAPS)
    expect(screen.getByText('The 2016 Ford F-250 has no insurance cost, registration or service on file')).toBeTruthy()
  })

  it.each(['master_technician', 'estimator', 'primary'])('%s does not', async (role) => {
    auth.role = role
    renderWithProviders(section())
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.vehicleRecordGapsEnabled).toBe(false)
    expect(screen.queryByText(/has no insurance cost, registration or service on file/)).toBeNull()
  })

  it('the card opens People → Vehicles', async () => {
    auth.role = 'assistant'
    renderWithProviders(section())
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Open Vehicles/ }))
    expect(navigate).toHaveBeenCalledWith('/people?tab=vehicles')
  })
})
