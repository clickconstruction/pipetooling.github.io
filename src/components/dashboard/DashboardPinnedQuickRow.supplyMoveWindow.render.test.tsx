// @vitest-environment jsdom
/**
 * Wiring for the move window's Needs You line (v2.5723, punch list #132): the office set gets the
 * strip's numbers into the builder and the line on screen, other roles do not, and Work the list
 * lands on the worked list — /materials?tab=supply-houses&list=movable.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { NeedsYouInputs } from '../../lib/dashboardNeedsYou'
import { DashboardPinnedQuickRow } from './DashboardPinnedQuickRow'

const WINDOW = { count: 14, dollars: 7474.71, asked: 3, soonestDueYmd: '2026-10-25' }
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
vi.mock('../../hooks/useSupplyMoveWindowNudge', () => ({
  useSupplyMoveWindowNudge: (enabled: boolean) => ({ moveWindow: enabled ? WINDOW : null, reload: () => {} }),
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

describe('DashboardPinnedQuickRow · the move window on Needs You', () => {
  it.each(['dev', 'master_technician', 'assistant', 'controller'] as const)('%s gets the line with the strip’s numbers', async (role) => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role={role} />)
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.supplyMoveWindowEnabled).toBe(true)
    expect(last.supplyMoveWindow).toEqual(WINDOW)
    expect(screen.getByText('$7,474.71 on 14 current invoices is not on a job account yet')).toBeTruthy()
  })

  it.each(['estimator', 'primary'] as const)('%s does not', async (role) => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role={role} />)
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.supplyMoveWindowEnabled).toBe(false)
    expect(last.supplyMoveWindow ?? null).toBeNull()
    expect(screen.queryByText(/is not on a job account yet/)).toBeNull()
  })

  it('Work the list opens the worked list on Materials → Supply houses', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="assistant" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Work the list/ }))
    expect(navigate).toHaveBeenCalledWith('/materials?tab=supply-houses&list=movable')
  })
})
