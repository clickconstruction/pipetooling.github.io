// @vitest-environment jsdom
/**
 * Wiring for Contracts and clauses on Needs You (Messages, cut 4c, v2.5285): a signed-in viewer's line reads the clause
 * changes waiting on their approval (`useClauseNeeds`, which reads only for a controller or a dev), and its button opens
 * the oldest change's paper on Settings → Contracts and clauses.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { NeedsYouInputs } from '../../lib/dashboardNeedsYou'
import type { ClauseNeedRow } from '../../lib/contracts/approval'
import { DashboardPinnedQuickRow } from './DashboardPinnedQuickRow'

const ROWS = vi.hoisted(() => [] as ClauseNeedRow[])
const seen: NeedsYouInputs[] = []
const navigate = vi.fn()

vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'controller' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))
vi.mock('../../hooks/useClauseNeeds', () => ({ useClauseNeeds: (enabled: boolean) => ({ rows: enabled ? ROWS : [], reload: () => {} }) }))
vi.mock('../../lib/dashboardNeedsYou', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dashboardNeedsYou')>('../../lib/dashboardNeedsYou')
  return {
    ...actual,
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

const ROW: ClauseNeedRow = {
  proposal: {
    id: 'p-waiting',
    paperId: '00000000-0000-0000-0000-00000000c1c1',
    kind: 'edit',
    clauseId: 'msa-2',
    baseV: 1,
    en: 'Insurance: $2,000,000 per occurrence.',
    es: '',
    scope: 'all',
    byUserId: 'u-rosa',
    by: 'Rosa',
    at: '2026-10-12T15:00:00Z',
    why: 'the insurer asked for it',
    state: 'proposed',
    decidedBy: null,
    decidedAt: null,
    declineWhy: null,
  },
  title: 'Rosa changed clause 2 of the Master services agreement.',
  badge: 'Waiting on your approval',
  facts: ['for everyone', 'Oct 12, 10:00 AM', 'the insurer asked for it'],
  words: 'Insurance: $2,000,000 per occurrence.',
  age: { days: 4, state: 'amber', label: '4 days waiting' },
}

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

describe('DashboardPinnedQuickRow · Contracts and clauses on Needs You', () => {
  it('draws the change waiting on the approver, and opens its paper on Settings', async () => {
    ROWS.splice(0, ROWS.length, ROW)
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="controller" />)
    await settle()
    const last = seen[seen.length - 1]!
    expect(last.contractClausesEnabled).toBe(true)
    expect(last.contractClauses).toEqual([ROW])
    expect(screen.getByText('Rosa changed clause 2 of the Master services agreement.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Review/ }))
    expect(navigate).toHaveBeenCalledWith('/settings?tab=settings-clauses#settings-clause-paper-00000000-0000-0000-0000-00000000c1c1')
  })

  it('draws nothing when nothing waits', async () => {
    ROWS.splice(0, ROWS.length)
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="assistant" />)
    await settle()
    expect(screen.queryByText(/clause/)).toBeNull()
  })
})
