// @vitest-environment jsdom
/**
 * Wiring for Looks like a customer on Needs You (punch list #307): the people who may answer on a
 * name get the line, other roles do not and their Dashboard asks for no count, and its button opens
 * Builders with the Looks like a customer chip on, in the city that has some.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { NeedsYouInputs } from '../../lib/dashboardNeedsYou'
import type { LookAlikeNeed } from '../../lib/research/lookAlikeWorklist'
import { DashboardPinnedQuickRow } from './DashboardPinnedQuickRow'

const NEED: LookAlikeNeed = { count: 14, byCity: [{ city: 'Austin', count: 9 }, { city: 'San Antonio', count: 5 }], city: 'Austin' }
const seen: NeedsYouInputs[] = []
const asked: boolean[] = []
const navigate = vi.fn()

vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))
vi.mock('../../hooks/useLookAlikeNudge', () => ({
  useLookAlikeNudge: (enabled: boolean) => {
    asked.push(enabled)
    return enabled ? NEED : null
  },
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
  asked.length = 0
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

describe('DashboardPinnedQuickRow · Looks like a customer on Needs You', () => {
  it.each(['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const)('%s gets the names that look like a customer', async (role) => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role={role} />)
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.lookAlikesEnabled).toBe(true)
    expect(last.lookAlikes).toEqual(NEED)
    expect(screen.getByText('14 names on permits look like a customer')).toBeTruthy()
    expect(screen.getByText('Austin 9 · San Antonio 5. Answer each once. Nothing is tied until you press.')).toBeTruthy()
  })

  it.each(['primary', 'superintendent', 'subcontractor', 'helpers'] as const)('%s does not, and no count is asked for', async (role) => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role={role} />)
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.lookAlikesEnabled).toBe(false)
    expect(last.lookAlikes ?? null).toBeNull()
    expect(asked.every((on) => on === false)).toBe(true)
  })

  it('asks for no count while the Dashboard hides its banners', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="assistant" hideBanners />)
    await settle()
    expect(asked.length).toBeGreaterThan(0)
    expect(asked.every((on) => on === false)).toBe(true)
  })

  it('the line opens Builders with the Looks like a customer chip on, in the city that has some', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="estimator" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Answer them/ }))
    expect(navigate).toHaveBeenCalledWith('/prospects?tab=permits&view=builders&looks=1&city=Austin')
  })
})
