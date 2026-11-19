// @vitest-environment jsdom
/**
 * Render smoke for the pinned row's Needs You slot (v2.3883): the card by
 * default, the one-line door to the Inbox deck when the parent asks for it.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { DashboardPinnedQuickRow } from './DashboardPinnedQuickRow'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))
vi.mock('../../lib/dashboardNeedsYou', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dashboardNeedsYou')>('../../lib/dashboardNeedsYou')
  return {
    ...actual,
    buildNeedsYouItems: () => [
      { key: 'lien-windows', severity: 'red', kicker: 'Lien windows', title: '1 lien window closes today', detail: 'Mail by Sep 15.', figure: '1', actionLabel: 'Open the Lien desk' },
      { key: 'tally-team', severity: 'amber', kicker: 'Team purchases', title: 'Team purchases waiting to be sorted', detail: '', figure: '12', actionLabel: 'Sort for the team' },
    ],
  }
})

beforeAll(installDomShims)
afterEach(cleanup)

const props = {
  authUserId: 'u-1',
  role: 'assistant' as const,
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

describe('DashboardPinnedQuickRow · Needs You', () => {
  it('draws the card by default', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} />)
    await settle()
    expect(document.querySelector('[data-needs-you-door]')).toBeNull()
    expect(document.querySelector('section[aria-label="Needs you, 2 items"]')).toBeTruthy()
  })

  it('draws the one-line door to the Inbox instead when asked', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} needsYouDoor />)
    await settle()
    const door = document.querySelector('[data-needs-you-door]') as HTMLElement
    expect(door.textContent).toContain('Needs you · 2')
    expect(door.textContent).toContain('1 lien window closes today')
    expect(door.textContent).toContain('Inbox ›')
    expect(document.querySelector('section[aria-label="Needs you, 2 items"]')).toBeNull()
  })

  it('quiet squares (v2.3891): the clock alone, with Job report and Tally as two links under it', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} bannersOnly={false} quietSquares jobReportFirst clockSlot={<div data-testid="clock">clock</div>} />)
    await settle()
    const quiet = document.querySelector('[data-quiet-squares]') as HTMLElement
    expect(quiet.querySelector('[data-testid="clock"]')).toBeTruthy()
    expect([...quiet.querySelectorAll('button, a')].map((x) => x.textContent?.trim().replace(/ · \d+$/, ''))).toEqual(['Job report', 'Tally', 'Paint a map'])
    expect(quiet.querySelector('[data-paint-a-map-press="link"]')).toBeTruthy()
  })
})

describe('DashboardPinnedQuickRow · Paint a map (punch list #392)', () => {
  it('beside the clock, a square after Job Report: a desk and a leader on a phone', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="master_technician" bannersOnly={false} jobReportFirst clockSlot={<div data-testid="clock">clock</div>} />)
    await settle()
    const square = document.querySelector('[data-paint-a-map-press="square"]') as HTMLElement
    expect(square).toBeTruthy()
    // The row reads Tally, the clock, Job Report, Paint a map.
    const row = square.parentElement as HTMLElement
    expect(row.lastElementChild).toBe(square)
    expect(square.previousElementSibling?.getAttribute('aria-label')).toBe('Job Report')
    expect(document.querySelector('[data-paint-a-map-press="link"], [data-paint-a-map-press="wide"]')).toBeNull()
  })

  it('in Job Mode, wide beside the Tally square, in the slot the Job Report button left', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="subcontractor" bannersOnly={false} hideBanners hideJobReport />)
    await settle()
    const wide = document.querySelector('[data-paint-a-map-press="wide"]') as HTMLElement
    expect(wide).toBeTruthy()
    // The stub's day is empty, so the second line says the person picks.
    expect(wide.querySelector('[data-paint-a-map-press-line]')?.textContent).toBe('On your last job, or one you pick')
    expect(document.querySelector('[data-paint-a-map-press="square"]')).toBeNull()
  })

  it('is not drawn where the row is not: the banners alone', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} />)
    await settle()
    expect(document.querySelector('[data-paint-a-map-press]')).toBeNull()
  })
})

