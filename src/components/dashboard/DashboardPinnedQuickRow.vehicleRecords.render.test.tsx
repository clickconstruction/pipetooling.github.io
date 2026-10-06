// @vitest-environment jsdom
/**
 * Wiring for the Needs You vehicle-records card (v2.4692): dev, assistant and controller get the
 * vehicle gaps into the builder, other roles do not, and the card's button opens People → Vehicles.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { NeedsYouInputs } from '../../lib/dashboardNeedsYou'
import { DashboardPinnedQuickRow } from './DashboardPinnedQuickRow'

const GAPS = [{ vehicleId: 'v-ram', name: '2016 Ford F-250', holderUserId: 'u-1', holderName: 'Sam P.', missing: ['insurance' as const, 'registration' as const, 'service' as const], insuranceOnPlan: false }]
const seen: NeedsYouInputs[] = []
const navigate = vi.fn()

vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))
vi.mock('../../hooks/useVehicleRecordGapsNudge', () => ({
  useVehicleRecordGapsNudge: (enabled: boolean) => ({ gaps: enabled ? GAPS : null, reload: () => {} }),
}))
vi.mock('../../lib/dashboardNeedsYou', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dashboardNeedsYou')>('../../lib/dashboardNeedsYou')
  return {
    ...actual,
    // The real builder over the row's own inputs, so the card draws what they make; every call is kept.
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

const props = {
  authUserId: 'u-1',
  visiblePins: [],
  quickActionDefs: [],
  quickButtonsPlacement: 'top' as const,
  showDashboardQuickButtons: false,
  costMatrixTotal: null,
  billedCount: null,
  billedTotal: null,
  supplyHousesAPTotal: null,
  subLaborDueTotal: null,
  renderModals: false,
  bannersOnly: true,
}

describe('DashboardPinnedQuickRow · vehicle records on Needs You', () => {
  it.each(['dev', 'assistant', 'controller'] as const)('%s gets the vehicles missing records', async (role) => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role={role} />)
    await settle()
    // first paint and after the hooks settle: the builder got the gate and the gaps
    const last = seen[seen.length - 1]!
    expect(last.vehicleRecordGapsEnabled).toBe(true)
    expect(last.vehicleRecordGaps).toEqual(GAPS)
    expect(screen.getByText('The 2016 Ford F-250 has no insurance, registration or service on file')).toBeTruthy()
  })

  it.each(['master_technician', 'estimator', 'primary'] as const)('%s does not', async (role) => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role={role} />)
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.vehicleRecordGapsEnabled).toBe(false)
    expect(last.vehicleRecordGaps ?? null).toBeNull()
  })

  it('the card opens People → Vehicles', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="assistant" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Open Vehicles/ }))
    expect(navigate).toHaveBeenCalledWith('/people?tab=vehicles')
  })
})
