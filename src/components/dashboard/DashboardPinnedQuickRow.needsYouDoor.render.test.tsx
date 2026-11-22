// @vitest-environment jsdom
/**
 * The Needs you door under the new phone layout (`lib/phoneLayout/needsYouPlace.ts`): the same one-line door,
 * handed the Inbox tab it opens, drawn on Job Mode's own Dashboard as the one thing of the banners, and reading
 * the count and the first line the card it opens reads. With the switch off the door is the door it was.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { DashboardPinnedQuickRow } from './DashboardPinnedQuickRow'

import type { LienBoardDot } from '../../lib/jobs/lienBoard'

const scenario: { phoneLayout: boolean; strip: LienBoardDot[] | null } = { phoneLayout: false, strip: null }
const navigate = vi.fn()

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))
vi.mock('../../hooks/useNewPhoneLayout', () => ({ useNewPhoneLayout: () => ({ on: scenario.phoneLayout, stored: scenario.phoneLayout, setStored: () => {} }) }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})
// The Lien desk's strip is built from the desk's own read. Here the test hands it over, so the wiring is what is held.
vi.mock('../../hooks/useNeedsYouInputs', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useNeedsYouInputs')>('../../hooks/useNeedsYouInputs')
  return { ...actual, useNeedsYouInputs: (args: Parameters<typeof actual.useNeedsYouInputs>[0]) => ({ ...actual.useNeedsYouInputs(args), lienBoardStrip: scenario.strip }) }
})
// Three lines, worst first as the builder ranks them: the office's, then the leader's own two.
vi.mock('../../lib/dashboardNeedsYou', async () => {
  const actual = await vi.importActual<typeof import('../../lib/dashboardNeedsYou')>('../../lib/dashboardNeedsYou')
  return {
    ...actual,
    buildNeedsYouItems: () => [
      { key: 'lien-serve-copy', severity: 'red', kicker: 'Liens', title: '11 filed liens have not been served', detail: '', figure: '11', actionLabel: 'Open the Lien desk' },
      { key: 'lien-notice-sign', severity: 'blue', kicker: 'Lien deadlines', title: 'Sign 7 lien notices before the run', detail: '', figure: '7', actionLabel: 'Sign them' },
      { key: 'tally-self', severity: 'amber', kicker: 'Your card purchases', title: '3 purchases need a job', detail: '', figure: '3', actionLabel: 'Open tally' },
    ],
  }
})

beforeAll(installDomShims)
beforeEach(() => {
  scenario.phoneLayout = false
  scenario.strip = null
  navigate.mockClear()
})
afterEach(cleanup)

const props = {
  authUserId: 'u-1',
  role: 'master_technician' as const,
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

const door = () => document.querySelector('[data-needs-you-door]') as HTMLElement | null
const card = () => document.querySelector('section[aria-label^="Needs you"]')

describe('the Needs you door · where it leads', () => {
  it('opens Dispatch Mode’s Inbox unless it is handed another', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} needsYouDoor />)
    await settle()
    fireEvent.click(door()!)
    expect(navigate).toHaveBeenCalledWith('/dispatch-mode/inbox')
  })

  it('opens Job Mode’s Inbox when it is handed that tab', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} needsYouDoor needsYouDoorTo="/job-mode/inbox" />)
    await settle()
    expect(door()!.textContent).toContain('Inbox ›')
    fireEvent.click(door()!)
    expect(navigate).toHaveBeenCalledWith('/job-mode/inbox')
  })
})

describe('the Needs you door · the cards under the list', () => {
  const round = () => document.querySelector('section[aria-label="The office\'s round"]')

  it('the card has the office’s round under it', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} />)
    await settle()
    expect(card()).toBeTruthy()
    expect(round()).toBeTruthy()
  })

  it('the office person’s door takes the round to the Inbox tab, as it has since v2.3883', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} needsYouDoor />)
    await settle()
    expect(door()).toBeTruthy()
    expect(round()).toBeNull()
  })

  it('a door that keeps the cards leaves the round on the page, under the door', async () => {
    scenario.phoneLayout = true
    renderWithProviders(<DashboardPinnedQuickRow {...props} needsYouDoor needsYouDoorKeepsCards />)
    await settle()
    expect(card()).toBeNull()
    expect(door()!.compareDocumentPosition(round()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('the Needs you door · the Lien desk’s strip', () => {
  const DOTS: LienBoardDot[] = [
    { key: 'by_day', figure: '17', words: 'by Dec 15', tone: 'red' },
    { key: 'waiting', figure: '7', words: 'waiting on the leader', tone: 'violet' },
    { key: 'in_mail', figure: '7', words: 'to print and mail', tone: 'amber' },
    { key: 'unpaid', figure: '$111,623', words: 'unpaid on the desk', tone: 'quiet' },
  ]
  const strips = () => Array.from(document.querySelectorAll('[data-needs-you-lien-board]')) as HTMLElement[]

  it('the card draws the strip inside itself', async () => {
    scenario.strip = DOTS
    renderWithProviders(<DashboardPinnedQuickRow {...props} />)
    await settle()
    expect(strips()).toHaveLength(1)
    expect(card()!.contains(strips()[0]!)).toBe(true)
    expect(strips()[0]!.hasAttribute('data-standalone')).toBe(false)
  })

  it('a door that keeps the cards keeps the strip on the page, under the door, and it opens the Lien desk', async () => {
    scenario.phoneLayout = true
    scenario.strip = DOTS
    renderWithProviders(<DashboardPinnedQuickRow {...props} needsYouDoor needsYouDoorKeepsCards />)
    await settle()
    expect(card()).toBeNull()
    expect(strips()).toHaveLength(1)
    const strip = strips()[0]!
    expect(strip.hasAttribute('data-standalone')).toBe(true)
    // On its own the strip is a card: the label and The Board on a head row, the four dots under it.
    expect(strip.textContent).toBe('Lien deskThe Board ›17by Dec 157waiting on the leader7to print and mail$111,623unpaid on the desk')
    expect(strip.querySelectorAll('[data-needs-you-lien-dot]')).toHaveLength(4)
    expect(door()!.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const round = document.querySelector('section[aria-label="The office\'s round"]')!
    expect(strip.compareDocumentPosition(round) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(strip)
    expect(navigate).toHaveBeenCalledWith('/lien-desk')
  })

  it('the office person’s older door takes the strip to the Inbox tab with the list', async () => {
    scenario.strip = DOTS
    renderWithProviders(<DashboardPinnedQuickRow {...props} needsYouDoor />)
    await settle()
    expect(door()).toBeTruthy()
    expect(strips()).toHaveLength(0)
  })

  it('Job Mode’s own Dashboard draws the door and no strip', async () => {
    scenario.phoneLayout = true
    scenario.strip = DOTS
    renderWithProviders(<DashboardPinnedQuickRow {...props} bannersOnly={false} hideBanners hideJobReport needsYouDoor needsYouDoorTo="/job-mode/inbox" />)
    await settle()
    expect(door()).toBeTruthy()
    expect(strips()).toHaveLength(0)
  })

  it('a desk with nothing on it draws no strip under the door', async () => {
    scenario.phoneLayout = true
    renderWithProviders(<DashboardPinnedQuickRow {...props} needsYouDoor needsYouDoorKeepsCards />)
    await settle()
    expect(door()).toBeTruthy()
    expect(strips()).toHaveLength(0)
  })
})

describe('the Needs you door · Job Mode’s own Dashboard', () => {
  const jobMode = { ...props, bannersOnly: false, hideBanners: true, hideJobReport: true, jobModeDay: { hoursThisWeek: 12, tomorrowJobs: 1 } }

  it('draws neither the door nor the card without the ask, as before the switch', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...jobMode} />)
    await settle()
    expect(door()).toBeNull()
    expect(card()).toBeNull()
    expect(document.querySelector('[data-job-mode-top-row]')).toBeTruthy()
  })

  it('draws the door alone when asked: no card, and the day’s row still under it', async () => {
    scenario.phoneLayout = true
    renderWithProviders(<DashboardPinnedQuickRow {...jobMode} needsYouDoor needsYouDoorTo="/job-mode/inbox" />)
    await settle()
    const d = door()!
    expect(d.textContent).toBe('Needs you · 2 · Sign 7 lien notices before the runInbox ›')
    expect(card()).toBeNull()
    const row = document.querySelector('[data-job-mode-top-row]') as HTMLElement
    expect(d.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(d)
    expect(navigate).toHaveBeenCalledWith('/job-mode/inbox')
  })
})

describe('the Needs you door · Job Mode’s own Dashboard counts the viewer’s own lines', () => {
  // An estimator presses neither lien line. The purchases line is anyone's, so it is the one line of his own.
  // The list with none of his own, which draws no door here, is held in `needsYouPlace.test.ts`.
  const jobMode = { ...props, role: 'estimator' as const, bannersOnly: false, hideBanners: true, hideJobReport: true }

  it('the door names his one line and leaves the other two to the card', async () => {
    scenario.phoneLayout = true
    renderWithProviders(<DashboardPinnedQuickRow {...jobMode} needsYouDoor needsYouDoorTo="/job-mode/inbox" />)
    await settle()
    expect(door()!.textContent).toBe('Needs you · 1 · 3 purchases need a jobInbox ›')
  })
})

describe('the Needs you door · what it says', () => {
  it('switch off: every line counted and the list’s first line, as the door read before', async () => {
    renderWithProviders(<DashboardPinnedQuickRow {...props} needsYouDoor />)
    await settle()
    expect(door()!.textContent).toBe('Needs you · 3 · 11 filed liens have not been servedInbox ›')
  })

  it('switch on: the viewer’s own count and first line, which the card it opens says', async () => {
    scenario.phoneLayout = true
    const { unmount } = renderWithProviders(<DashboardPinnedQuickRow {...props} needsYouDoor />)
    await settle()
    expect(door()!.textContent).toBe('Needs you · 2 · Sign 7 lien notices before the runInbox ›')
    unmount()
    // The card the door opens: the same number in its pill, the same line first on Walk the list.
    renderWithProviders(<DashboardPinnedQuickRow {...props} />)
    await settle()
    const section = card() as HTMLElement
    expect(section.getAttribute('aria-label')).toBe('Needs you, 3 items')
    expect(section.textContent).toContain('1 for others')
    expect(section.textContent).toContain('Sign 7 lien notices before the run')
  })

  it('switch on, a helper whose lines are all his own: the count is the whole list', async () => {
    scenario.phoneLayout = true
    renderWithProviders(<DashboardPinnedQuickRow {...props} role="helpers" needsYouDoor needsYouDoorTo="/job-mode/inbox" />)
    await settle()
    // Only the purchases line is a helper's own; the two lien lines are the office's and the owner's.
    expect(door()!.textContent).toBe('Needs you · 1 · 3 purchases need a jobInbox ›')
  })
})
