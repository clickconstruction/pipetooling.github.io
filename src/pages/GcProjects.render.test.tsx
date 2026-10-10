// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import GcProjects from './GcProjects'
import { renderSettled, settle } from '../test/renderSmokeMocks'
import { recordNavClick } from '../lib/navClickTelemetry'
import { GC_NEW_HERE_SEEN_KEY } from '../lib/gc/tour'
import { askGcCompanies, carryGcTrade, loadGcBoardRows, loadGcProjects, markGcBidSent, setGcProjectMoney } from '../lib/gc/gcIo'
import { clinicBoardRows } from '../lib/gc/boardTestRows'
import { loadSchedule } from '../lib/gc/scheduleIo'
import { loadGcDailyLogs, saveGcDailyLog } from '../lib/gc/dailyLogIo'
import { loadGcSubmittals } from '../lib/gc/submittalsIo'
import { loadGcRfis, startRfiChangeOrder } from '../lib/gc/rfisIo'
import { emailTheTrade, loadGcDraws, payDraw } from '../lib/gc/drawsIo'
import { acceptWork } from '../lib/gc/closeoutIo'
import { loadGcPunch } from '../lib/gc/punchIo'
import { loadGcBillingRows } from '../lib/gc/gcIo'
import { awardedClinicBoardRows } from '../lib/gc/boardTestRows'
import type { DrawTables } from '../lib/gc/drawRows'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

/** The signed-in role: a dev unless a test says otherwise (door 2 opens the Board to the office). */
const auth = vi.hoisted(() => ({ role: 'dev' }))
vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../test/renderSmokeMocks')
  const byRole = new Map<string, ReturnType<typeof makeUseAuthValue>>()
  const value = () => {
    if (!byRole.has(auth.role)) byRole.set(auth.role, makeUseAuthValue({ role: auth.role }))
    return byRole.get(auth.role)!
  }
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

// The company window's Their portal loads one company's link; none is made yet.
vi.mock('../lib/gc/tradePortalLinksIo', () => ({
  loadTradePortalLinks: vi.fn(() => Promise.resolve({ links: [], visits: {} })),
  makeTradePortalLink: vi.fn(),
  turnOffTradePortalLink: vi.fn(),
}))

// The schedule's window (PR 7b) reads the job's schedule over the board: nothing is drawn on the test board.
vi.mock('../lib/gc/scheduleIo', () => ({
  loadSchedule: vi.fn((state: { projects: { id: string }[] }, id: string) => Promise.resolve({ state, project: state.projects.find((p) => p.id === id), version: null })),
  drawSchedule: vi.fn(),
}))

// No GC project yet: the page loads empty, so the card stops show their missing words.
vi.mock('../lib/gc/gcIo', async () => {
  const { EMPTY_SCOPE_BOOK } = await import('../lib/gc/scopeBook')
  const none = () => Promise.resolve([])
  return {
    loadGcPickerCustomers: none,
    loadGcProjects: vi.fn(none),
    loadGcBoardRows: vi.fn(),
    loadGcTeam: none,
    loadScopeBookStore: () => Promise.resolve(EMPTY_SCOPE_BOOK),
    answerQuestion: vi.fn(),
    checkDriveAccess: vi.fn(),
    createGcProject: vi.fn(),
    editScopeBookLine: vi.fn(),
    issuePlanSet: vi.fn(),
    makeDriveFolders: vi.fn(),
    markQuestionSent: vi.fn(),
    mergeScopeBookLines: vi.fn(),
    recordQuestion: vi.fn(),
    saveScopeBookLine: vi.fn(),
    saveScopeSet: vi.fn(),
    sendQuestionToArchitect: vi.fn(),
    addGcCompany: vi.fn(),
    vetGcCompany: vi.fn(),
    setGcCompanyCoverage: vi.fn(),
    logGcAskContact: vi.fn(),
    askGcCompanies: vi.fn(() => Promise.resolve()),
    declineGcAsk: vi.fn(),
    setGcCompanyLanguage: vi.fn(),
    setGcAskPlugs: vi.fn(),
    setGcAskExclusionCovers: vi.fn(),
    setGcAskTakenAlternates: vi.fn(),
    carryGcTrade: vi.fn(() => Promise.resolve()),
    setGcProjectMoney: vi.fn(() => Promise.resolve()),
    markGcBidSent: vi.fn(() => Promise.resolve()),
    markGcWon: vi.fn(),
    markGcLost: vi.fn(),
    bringGcBack: vi.fn(),
    shareGcBidTab: vi.fn(() => Promise.resolve()),
    loadGcChangeOrders: vi.fn(none),
    loadGcChangeOrderEmails: vi.fn(none),
    loadGcChangeRequests: vi.fn(none),
    loadGcChangeRequestEmails: vi.fn(none),
    loadGcBillingRows: vi.fn(() => Promise.resolve({ terms: [], contract: [], billing: new Map(), names: {}, payDays: {} })),
  }
})

// Building's daily log: no log yet, and a save that goes through.
vi.mock('../lib/gc/dailyLogIo', () => ({
  loadGcDailyLogs: vi.fn(() => Promise.resolve([])),
  saveGcDailyLog: vi.fn(() => Promise.resolve('log-1')),
}))

// Building's submittals: an empty register, and every press going through.
vi.mock('../lib/gc/submittalsIo', () => ({
  loadGcSubmittals: vi.fn(() => Promise.resolve({ submittals: [], holds: [], rounds: [] })),
  addSubmittal: vi.fn(() => Promise.resolve('sub-1')),
  submittalCameIn: vi.fn(() => Promise.resolve('round-1')),
  sendSubmittalToArchitect: vi.fn(() => Promise.resolve({ to: 'architect@example.com' })),
  markSubmittalSent: vi.fn(() => Promise.resolve()),
  answerSubmittal: vi.fn(() => Promise.resolve()),
}))

// Building's RFIs: none asked, and every press going through.
vi.mock('../lib/gc/rfisIo', () => ({
  loadGcRfis: vi.fn(() => Promise.resolve({ rfis: [], holds: [] })),
  addRfi: vi.fn(() => Promise.resolve('rfi-1')),
  sendRfiToArchitect: vi.fn(() => Promise.resolve({ to: 'architect@example.com' })),
  markRfiSent: vi.fn(() => Promise.resolve()),
  answerRfi: vi.fn(() => Promise.resolve()),
  startRfiChangeOrder: vi.fn(() => Promise.resolve('co-1')),
}))

// Building's draws: none yet, and every press going through. The email to the trade is the page's to send.
vi.mock('../lib/gc/drawsIo', () => ({
  loadGcDraws: vi.fn(() => Promise.resolve({ sows: [], sowLines: [], draws: [], drawLines: [], reports: [], backCharges: [], tradeSends: [] })),
  drawCameIn: vi.fn(() => Promise.resolve('draw-new')),
  approveDraw: vi.fn(() => Promise.resolve()),
  approveDrawLess: vi.fn(() => Promise.resolve()),
  sendDrawBack: vi.fn(() => Promise.resolve()),
  payDraw: vi.fn(() => Promise.resolve()),
  drawWaiverIn: vi.fn(() => Promise.resolve()),
  chargeTrade: vi.fn(() => Promise.resolve('bc-new')),
  settleBackCharge: vi.fn(() => Promise.resolve()),
  takeBackCharge: vi.fn(() => Promise.resolve()),
  sendTradeChange: vi.fn(() => Promise.resolve()),
  emailTheTrade: vi.fn(() => Promise.resolve({ ok: true, key: 'k', detail: null })),
}))

// Building's closeout: no punch item, and every press going through.
vi.mock('../lib/gc/punchIo', () => ({ loadGcPunch: vi.fn(() => Promise.resolve([])) }))
vi.mock('../lib/gc/closeoutIo', () => ({
  acceptWork: vi.fn(() => Promise.resolve('2026-10-12')),
  finalPayAppCameIn: vi.fn(() => Promise.resolve('draw-final')),
  approveRetainage: vi.fn(() => Promise.resolve('2026-10-12')),
  changeSignedIn: vi.fn(() => Promise.resolve('line-new')),
  closeJob: vi.fn(() => Promise.resolve('2026-10-12')),
}))

const loadedEmpty = { loaded: () => screen.findByText('No GC project yet. Press New project when the first plans come in.') }

describe('GcProjects: New here?', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.mocked(recordNavClick).mockClear()
  })
  afterEach(() => window.localStorage.clear())

  it('opens by itself on a first visit, shows a missing card in words, and records how far the walk got', async () => {
    await renderSettled(<GcProjects />, loadedEmpty)
    expect(await screen.findByRole('dialog', { name: 'GC mode' })).toBeTruthy()
    expect(window.localStorage.getItem(GC_NEW_HERE_SEEN_KEY)).toBe('1')
    expect(recordNavClick).toHaveBeenCalledWith(expect.any(String), 'dev', 'gc_new_here', 'opened?by=first-visit&of=10')

    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Next →' }))
    expect(await screen.findByText('No GC project yet. Its card shows here once you press New project.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    await settle()
    expect(screen.queryByRole('dialog', { name: "A project's card" })).toBeNull()
    expect(recordNavClick).toHaveBeenLastCalledWith(expect.any(String), 'dev', 'gc_new_here', 'closed?stop=3&of=10')
  })

  it('stays shut once seen, and opens on New here?', async () => {
    window.localStorage.setItem(GC_NEW_HERE_SEEN_KEY, '1')
    await renderSettled(<GcProjects />, loadedEmpty)
    expect(screen.queryByRole('dialog', { name: 'GC mode' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'New here?' }))
    expect(await screen.findByRole('dialog', { name: 'GC mode' })).toBeTruthy()
    expect(recordNavClick).toHaveBeenCalledWith(expect.any(String), 'dev', 'gc_new_here', 'opened?by=button&of=10')
  })
})

describe('GcProjects: the Project Board', () => {
  beforeEach(() => window.localStorage.setItem(GC_NEW_HERE_SEEN_KEY, '1'))
  afterEach(() => {
    window.localStorage.clear()
    auth.role = 'dev'
  })

  it('door 2: an estimator sees the board, Trade partners and Follow up, and never Trade portals', async () => {
    auth.role = 'estimator'
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    expect(screen.getByRole('heading', { name: 'Project Board' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Project Board, Trade partners or Follow up' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trade partners' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Trade portals' })).toBeNull()
    expect(screen.queryByText('Devs only')).toBeNull()
  })

  it('the Owner Billing door: a controller sees Money and a won job\'s Change orders', async () => {
    auth.role = 'controller'
    const base = clinicBoardRows()
    const rows = { ...base, projects: base.projects.map((p) => ({ ...p, stage: 'building' as const })) }
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    expect(screen.getByRole('group', { name: 'Project Board, Trade partners, Follow up or Money' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Money' })).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Change orders' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Trade portals' })).toBeNull()
  })

  it('the Owner Billing door: an estimator sees neither Money nor a won job\'s Change orders', async () => {
    auth.role = 'estimator'
    const base = clinicBoardRows()
    const rows = { ...base, projects: base.projects.map((p) => ({ ...p, stage: 'building' as const })) }
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    expect(screen.getByRole('group', { name: 'Project Board, Trade partners or Follow up' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Money' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Change orders/ })).toBeNull()
  })

  it('a dev has the board, Trade partners, Follow up and Money, and no Trade portals: each link is in its company window', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    expect(screen.getByRole('group', { name: 'Project Board, Trade partners, Follow up or Money' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Trade portals' })).toBeNull()
  })

  it('a dev sees the board above the projects, with each project still listed under it', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    expect(screen.getByRole('heading', { name: 'Project Board' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Each project' })).toBeTruthy()
    expect(document.querySelector('[data-gc-board-row="p1"]')).toBeTruthy()
    expect(document.querySelector('[data-gc-project="p1"]')).toBeTruthy()
  })

  it('a dev switches to Trade partners, with the company new to us waiting at the top', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Trade partners' }))
    expect(screen.getByRole('heading', { name: 'Trade partners' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Jump to a trade' })).toBeTruthy()
    expect(document.querySelector('[data-gc-vet="hillside"]')).toBeTruthy()
    expect(document.querySelector('[data-gc-board-row="p1"]')).toBeNull()
    expect(document.querySelector('[data-gc-project="p1"]')).toBeTruthy()
  })

  it('a dev sees the asks under each trade of a project, and Follow up with its count', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    expect(document.querySelector('[data-gc-project="p1"] [data-gc-trade-asks="k1"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Follow up (1)' }))
    expect(screen.getByRole('heading', { name: 'Follow up' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Late on their word (1)' })).toBeTruthy()
  })

  it('a dev asks for quotes from a project’s trade, and the window records the asks', async () => {
    const base = clinicBoardRows()
    const rows = clinicBoardRows({ companies: [...base.companies, { ...base.companies[0]!, id: 'alamo', name: 'Alamo Concrete', trades: ['Concrete'], address: '9 Main St, Boerne' }] })
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValue(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    const concrete = document.querySelector('[data-gc-project="p1"] [data-gc-trade-asks="k2"]') as HTMLElement
    fireEvent.click(within(concrete).getByRole('button', { name: 'Ask for quotes' }))
    const dialog = screen.getByRole('dialog', { name: 'Ask for Concrete quotes' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask Alamo Concrete' }))
    // The email tick starts off (the owner's call 3), so a dev's untouched press passes no sender: nothing is emailed.
    await waitFor(() => expect(askGcCompanies).toHaveBeenCalledWith('k2', ['alamo'], expect.any(String), expect.any(String), null))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ask for Concrete quotes' })).toBeNull())
    vi.mocked(loadGcBoardRows).mockReset()
  })

  it('a dev opens a company’s window from its name on Trade partners', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Trade partners' }))
    const line = document.querySelector('[data-gc-partner="lonestar"]') as HTMLElement
    fireEvent.click(within(line).getByRole('button', { name: 'Lonestar Earthworks' }))
    const dialog = screen.getByRole('dialog', { name: 'Lonestar Earthworks' })
    expect(within(dialog).getByText('Who gets our emails')).toBeTruthy()
    expect(within(dialog).getByText('Their portal')).toBeTruthy()
    expect(await within(dialog).findByRole('button', { name: 'Make the link' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Lonestar Earthworks' })).toBeNull()
  })

  it('door 2: an estimator opens a company’s window, without Their portal until the trade wave', async () => {
    auth.role = 'estimator'
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Trade partners' }))
    const line = document.querySelector('[data-gc-partner="lonestar"]') as HTMLElement
    fireEvent.click(within(line).getByRole('button', { name: 'Lonestar Earthworks' }))
    const dialog = screen.getByRole('dialog', { name: 'Lonestar Earthworks' })
    expect(within(dialog).getByText('Who gets our emails')).toBeTruthy()
    expect(within(dialog).queryByText('Their portal')).toBeNull()
  })

  it('a dev carries a quote from Compare quotes, and the trades load again so the window reads Carrying', async () => {
    const rows = clinicBoardRows()
    const carried = rows.projects.map((p) => ({ ...p, trades: p.trades.map((t) => (t.id === 'k1' ? { ...t, carriedInviteId: 'i1' } : t)) }))
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects).mockResolvedValueOnce(carried)
    vi.mocked(loadGcBoardRows).mockImplementation((projects) => Promise.resolve({ ...rows, projects }))
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    const sitework = document.querySelector('[data-gc-project="p1"] [data-gc-trade-asks="k1"]') as HTMLElement
    fireEvent.click(within(sitework).getByRole('button', { name: 'Compare quotes (1)' }))
    const dialog = screen.getByRole('dialog', { name: 'Compare Sitework quotes' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Carry this number' }))
    await waitFor(() => expect(carryGcTrade).toHaveBeenCalledWith('k1', { inviteId: 'i1' }))
    expect(await screen.findByRole('button', { name: 'Carrying. Stop' })).toBeTruthy()
    vi.mocked(loadGcBoardRows).mockReset()
  })

  it('a dev reads our number with the money, opens it on the card and saves an input', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValue(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    expect(loadGcBoardRows).toHaveBeenCalledWith(rows.projects, expect.any(String), { money: true })
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Our number' }))
    const fee = within(card).getByLabelText('Fee')
    fireEvent.change(fee, { target: { value: '9' } })
    fireEvent.blur(fee)
    await waitFor(() => expect(setGcProjectMoney).toHaveBeenCalledWith('p1', { generalConditions: 12000, contingencyPct: 3, feePct: 9 }))
    await waitFor(() => expect(vi.mocked(loadGcBoardRows).mock.calls.length).toBeGreaterThan(1))
    fireEvent.click(within(card).getByRole('button', { name: 'Hide our number' }))
    expect(card.querySelector('[data-gc-our-number]')).toBeNull()
    vi.mocked(loadGcBoardRows).mockReset()
  })

  it('a dev opens the bid tabs on a card once a trade has two quotes', async () => {
    const base = clinicBoardRows()
    const rows = clinicBoardRows({
      invites: base.invites.map((i) => (i.id === 'i2' ? { ...i, status: 'bid' } : i)),
      quotes: [...base.quotes, { id: 'q2', invite_id: 'i2', amount: 60000, based_on_rev: 0, submitted_on: '2026-10-06', includes: { s1: 'yes', s2: 'yes' }, note: '', good_for_days: null, alternates: [], quote_file: '', exclusions: null, created_at: '2026-10-06T10:00:00Z' }],
    })
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValue(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Bid tabs (1)' }))
    expect(card.querySelector('[data-gc-bid-tab="k1"]')).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: 'Hide the bid tabs' }))
    expect(card.querySelector('[data-gc-bid-tabs]')).toBeNull()
    vi.mocked(loadGcBoardRows).mockReset()
  })

  it('the schedule’s PR 7b: a dev opens a project’s Schedule from its card', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Schedule' }))
    expect(await screen.findByRole('dialog', { name: `${rows.projects[0]!.name}: the schedule` })).toBeTruthy()
    expect(loadSchedule).toHaveBeenCalledWith(expect.anything(), 'p1')
  })

  it('the schedule’s PR 7b: the office team has no Schedule on a card until the schedule’s PR 10', async () => {
    auth.role = 'assistant'
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    expect(within(card).getByRole('button', { name: 'The plans' })).toBeTruthy()
    expect(within(card).queryByRole('button', { name: 'Schedule' })).toBeNull()
  })

  it('a dev marks our bid sent from the card, and the projects load again', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockImplementation((projects) =>
      Promise.resolve({ ...rows, projects, boardDates: { p1: { ...rows.boardDates.p1!, our_bid_sent_on: vi.mocked(markGcBidSent).mock.calls.length ? '2026-10-08' : null } } }),
    )
    await renderSettled(<GcProjects />, { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) })
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'We sent our bid' }))
    await waitFor(() => expect(markGcBidSent).toHaveBeenCalledWith('p1'))
    expect(await within(card).findByText('our bid went in Oct 8')).toBeTruthy()
    vi.mocked(loadGcBoardRows).mockReset()
  })
})

describe('GcProjects: the daily log (Building)', () => {
  beforeEach(() => window.localStorage.setItem(GC_NEW_HERE_SEEN_KEY, '1'))
  afterEach(() => {
    window.localStorage.clear()
    auth.role = 'dev'
    vi.mocked(loadGcDailyLogs).mockClear()
    vi.mocked(saveGcDailyLog).mockClear()
  })

  /** The clinic being built: started long ago unless a test says otherwise, so its last five working days have no log. */
  function building(startedOn: string | null = '2026-01-05') {
    const base = clinicBoardRows()
    return { ...base, projects: base.projects.map((p) => ({ ...p, stage: 'building' as const })), boardDates: { p1: { ...base.boardDates.p1!, started_on: startedOn } } }
  }
  const loaded = { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) }

  it('a dev sees Daily log on a job being built, with the working days in the last week that have no log', async () => {
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    expect(await within(card).findByRole('button', { name: 'Daily log · 5 missed' })).toBeTruthy()
    expect(loadGcDailyLogs).toHaveBeenCalledWith(['p1'])
  })

  it('a dev opens it before work starts, and the window says the log starts then', async () => {
    const rows = building(null)
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    fireEvent.click(await within(card).findByRole('button', { name: 'Daily log' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hill Country Clinic: daily log' })
    expect(within(dialog).getByText('The daily log starts once work starts.')).toBeTruthy()
  })

  it('a dev saves today’s log with our own crew, and only the logs are read again', async () => {
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    fireEvent.click(await within(card).findByRole('button', { name: 'Daily log · 5 missed' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hill Country Clinic: daily log' })
    // Until the Board's B6 signs a statement of work, our own Plumbing is the one trade a log may name.
    expect(within(dialog).queryByRole('spinbutton', { name: 'Workers on site, Concrete' })).toBeNull()
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Workers on site, Plumbing' }), { target: { value: '2' } })
    const reads = vi.mocked(loadGcDailyLogs).mock.calls.length
    const projectReads = vi.mocked(loadGcProjects).mock.calls.length
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the log' }))
    await waitFor(() => expect(saveGcDailyLog).toHaveBeenCalledTimes(1))
    expect(saveGcDailyLog).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1', crews: [{ packageId: 'k3', workers: 2 }], done: '', delays: [] }))
    await waitFor(() => expect(vi.mocked(loadGcDailyLogs).mock.calls.length).toBe(reads + 1))
    expect(vi.mocked(loadGcProjects).mock.calls.length).toBe(projectReads)
  })

  it('an estimator never sees it, and its logs are not read', async () => {
    auth.role = 'estimator'
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    expect(screen.queryByRole('button', { name: /^Daily log/ })).toBeNull()
    expect(loadGcDailyLogs).not.toHaveBeenCalled()
  })

  it('a job still bidding has no Daily log, even for a dev', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    expect(screen.queryByRole('button', { name: /^Daily log/ })).toBeNull()
  })
})

describe('GcProjects: submittals (Building)', () => {
  beforeEach(() => window.localStorage.setItem(GC_NEW_HERE_SEEN_KEY, '1'))
  afterEach(() => {
    window.localStorage.clear()
    auth.role = 'dev'
    vi.mocked(loadGcSubmittals).mockClear()
    vi.mocked(loadSchedule).mockClear()
  })

  const building = () => {
    const base = clinicBoardRows()
    return { ...base, projects: base.projects.map((p) => ({ ...p, stage: 'building' as const })) }
  }
  const loaded = { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) }

  it('a dev opens Submittals on a job being built, and the window reads the job’s register and its schedule', async () => {
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    expect(loadGcSubmittals).not.toHaveBeenCalled()
    fireEvent.click(await within(card).findByRole('button', { name: 'Submittals' }))
    expect(await screen.findByRole('dialog', { name: 'Hill Country Clinic: submittals' })).toBeTruthy()
    expect(loadGcSubmittals).toHaveBeenCalledWith(['p1'])
    expect(vi.mocked(loadSchedule).mock.calls.some(([, id]) => id === 'p1')).toBe(true)
  })

  it('an estimator never sees Submittals, and no register is read', async () => {
    auth.role = 'estimator'
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    expect(screen.queryByRole('button', { name: 'Submittals' })).toBeNull()
    expect(loadGcSubmittals).not.toHaveBeenCalled()
  })

  it('a job still bidding has no Submittals, even for a dev', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    expect(screen.queryByRole('button', { name: 'Submittals' })).toBeNull()
  })
})

describe('GcProjects: RFIs (Building)', () => {
  beforeEach(() => window.localStorage.setItem(GC_NEW_HERE_SEEN_KEY, '1'))
  afterEach(() => {
    window.localStorage.clear()
    auth.role = 'dev'
    vi.mocked(loadGcRfis).mockReset()
    vi.mocked(loadGcRfis).mockImplementation(() => Promise.resolve({ rfis: [], holds: [] }))
    vi.mocked(startRfiChangeOrder).mockClear()
    vi.mocked(loadSchedule).mockClear()
  })

  const building = () => {
    const base = clinicBoardRows()
    return { ...base, projects: base.projects.map((p) => ({ ...p, stage: 'building' as const })) }
  }
  const loaded = { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) }

  it('a dev opens RFIs on a job being built, and the window reads the job’s RFIs and its schedule', async () => {
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    expect(loadGcRfis).not.toHaveBeenCalled()
    fireEvent.click(await within(card).findByRole('button', { name: 'RFIs' }))
    expect(await screen.findByRole('dialog', { name: 'Hill Country Clinic: RFIs' })).toBeTruthy()
    expect(loadGcRfis).toHaveBeenCalledWith(['p1'])
    expect(vi.mocked(loadSchedule).mock.calls.some(([, id]) => id === 'p1')).toBe(true)
  })

  it('a cost answer starts a change order, and Change orders opens in place of the RFIs', async () => {
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    const rfi = {
      id: 'r1', project_id: 'p1', number: 1, question: 'Cap the old gas line or take it out?', sheets: ['C-101'], package_id: null, asked_by_company_id: null,
      recorded_by: 'u1', asked_on: '2026-10-01', needed_days: 3, sent_to_architect_on: '2026-10-01', email_send_log_id: null, answered_on: '2026-10-05',
      answer_text: 'Take it out.', answered_by: 'architect', impact: 'cost', cost: 3800, days: 2, change_order_id: null, created_at: '2026-10-01T00:00:00Z',
    }
    vi.mocked(loadGcRfis).mockResolvedValue({ rfis: [rfi], holds: [] })
    await renderSettled(<GcProjects />, loaded)
    fireEvent.click(await within(document.querySelector('[data-gc-project="p1"]') as HTMLElement).findByRole('button', { name: 'RFIs' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hill Country Clinic: RFIs' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start a change order' }))
    expect(await screen.findByRole('dialog', { name: 'Hill Country Clinic: change orders' })).toBeTruthy()
    expect(vi.mocked(startRfiChangeOrder).mock.calls[0]?.[0].id).toBe('p1')
    expect(vi.mocked(startRfiChangeOrder).mock.calls[0]?.[1]).toMatchObject({ id: 'r1', answer: { impact: 'cost', cost: 3800, days: 2 } })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Hill Country Clinic: RFIs' })).toBeNull())
  })

  it('an estimator never sees RFIs, and none are read', async () => {
    auth.role = 'estimator'
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    expect(screen.queryByRole('button', { name: 'RFIs' })).toBeNull()
    expect(loadGcRfis).not.toHaveBeenCalled()
  })

  it('a job still bidding has no RFIs, even for a dev', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    expect(screen.queryByRole('button', { name: 'RFIs' })).toBeNull()
  })
})

describe('GcProjects: Draws (Building)', () => {
  beforeEach(() => window.localStorage.setItem(GC_NEW_HERE_SEEN_KEY, '1'))
  afterEach(() => {
    window.localStorage.clear()
    auth.role = 'dev'
    vi.mocked(loadGcDraws).mockReset()
    vi.mocked(loadGcDraws).mockImplementation(() => Promise.resolve(NONE))
    vi.mocked(payDraw).mockClear()
    vi.mocked(emailTheTrade).mockClear()
  })

  const NONE: DrawTables = { sows: [], sowLines: [], draws: [], drawLines: [], reports: [], backCharges: [], tradeSends: [] }
  /** The clinic being built, its sitework's statement of work signed by Lonestar. */
  const building = () => {
    const base = awardedClinicBoardRows()
    return {
      ...base,
      projects: base.projects.map((p) => ({ ...p, stage: 'building' as const })),
      sows: (base.sows ?? []).map((w) => ({ ...w, status: 'signed', signed_on: '2026-10-09' })),
    }
  }
  /** Lonestar's first pay application, approved: half the clearing, nothing stored. */
  const approvedDraw: DrawTables = {
    ...NONE,
    sows: [{ id: 'w1', package_id: 'k1' }],
    sowLines: [
      { id: 'l1', sow_id: 'w1', position: 0, scope_item_id: 's1' },
      { id: 'l2', sow_id: 'w1', position: 1, scope_item_id: 's2' },
    ],
    draws: [
      {
        id: 'd1', sow_id: 'w1', number: 1, requested_on: '2026-10-10', status: 'approved', gross: 16600, retainage: 1660, net: 14940, final: false,
        waiver: 'conditional', waiver_on: null, approved_on: '2026-10-11', paid_on: null, asked: null, sent_back_on: null, sent_back_note: null,
        period_to: '2026-10-10', address: '', license: '', signed_by: 'Ana Ruiz', signed_title: 'Owner', signed_on: '2026-10-10',
        file_name: null, drive_url: null, recorded_by: 'u1', created_at: '2026-10-10T00:00:00Z', seq: 1,
      },
    ],
    drawLines: [{ draw_id: 'd1', sow_line_id: 'l1', to_pct: 50, stored: 0, we_see: null }],
  }
  const loaded = { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) }

  it('a dev opens Draws after RFIs on a job being built, with every trade’s draws read', async () => {
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    const names = within(card).getAllByRole('button').map((b) => b.textContent)
    expect(names.indexOf('Draws')).toBe(names.indexOf('RFIs') + 1)
    await waitFor(() => expect(vi.mocked(loadGcDraws).mock.calls[0]?.[0]).toContain('k1'))
    fireEvent.click(within(card).getByRole('button', { name: 'Draws' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hill Country Clinic: Draws' })
    expect(dialog.querySelector('[data-draw-trade="k1"]')).toBeTruthy()
  })

  it('a press with the email tick off emails nothing; with it on, the trade is emailed from the rows read again', async () => {
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    vi.mocked(loadGcDraws).mockResolvedValue(approvedDraw)
    await renderSettled(<GcProjects />, loaded)
    fireEvent.click(await within(document.querySelector('[data-gc-project="p1"]') as HTMLElement).findByRole('button', { name: 'Draws' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hill Country Clinic: Draws' })
    const tick = within(dialog.querySelector('[data-draw-email-tick]') as HTMLElement).getByRole('checkbox') as HTMLInputElement
    expect(tick.checked).toBe(false)
    const reads = vi.mocked(loadGcDraws).mock.calls.length
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Mark paid' }))
    await waitFor(() => expect(payDraw).toHaveBeenCalledWith('d1'))
    await waitFor(() => expect(vi.mocked(loadGcDraws).mock.calls.length).toBeGreaterThan(reads))
    await settle()
    expect(emailTheTrade).not.toHaveBeenCalled()

    fireEvent.click(tick)
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Mark paid' }))
    await waitFor(() => expect(emailTheTrade).toHaveBeenCalledWith('lonestar', expect.any(Function)))
  })

  it('a master reads the draws for the money since O9, but sees no Draws while Building is built', async () => {
    auth.role = 'master_technician'
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    expect(screen.queryByRole('button', { name: 'Draws' })).toBeNull()
    await waitFor(() => expect(vi.mocked(loadGcDraws).mock.calls[0]?.[0]).toContain('k1'))
  })

  it('the controller reads the draws too, and the statement of work without its press', async () => {
    auth.role = 'controller'
    const base = awardedClinicBoardRows()
    const rows = { ...base, sows: (base.sows ?? []).map((w) => ({ ...w, status: 'draft', sent_on: null })) }
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    await waitFor(() => expect(vi.mocked(loadGcDraws).mock.calls[0]?.[0]).toContain('k1'))
    const sow = document.querySelector('[data-gc-trade-sow="k1"]') as HTMLElement
    expect(within(sow).getByText('Statement of work drafted')).toBeTruthy()
    expect(within(sow).queryByRole('button', { name: 'Send to their portal to sign' })).toBeNull()
  })

  it('an estimator reads no draws', async () => {
    auth.role = 'estimator'
    const rows = building()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    expect(loadGcDraws).not.toHaveBeenCalled()
  })

  it('a job still bidding has no Draws, even for a dev', async () => {
    const rows = clinicBoardRows()
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    expect(screen.queryByRole('button', { name: 'Draws' })).toBeNull()
  })
})

describe('GcProjects: Closeout (Building)', () => {
  beforeEach(() => window.localStorage.setItem(GC_NEW_HERE_SEEN_KEY, '1'))
  afterEach(() => {
    window.localStorage.clear()
    auth.role = 'dev'
    vi.mocked(loadGcDraws).mockReset()
    vi.mocked(loadGcDraws).mockImplementation(() => Promise.resolve(NONE))
    vi.mocked(loadGcPunch).mockClear()
    vi.mocked(loadGcBillingRows).mockClear()
    vi.mocked(acceptWork).mockClear()
    vi.mocked(loadGcBoardRows).mockReset()
  })

  const NONE: DrawTables = { sows: [], sowLines: [], draws: [], drawLines: [], reports: [], backCharges: [], tradeSends: [] }
  /** The clinic at a stage, its sitework's statement of work signed by Lonestar. */
  const at = (stage: 'building' | 'closed') => {
    const base = awardedClinicBoardRows()
    return {
      ...base,
      projects: base.projects.map((p) => ({ ...p, stage })),
      sows: (base.sows ?? []).map((w) => ({ ...w, status: 'signed', signed_on: '2026-10-09' })),
    }
  }
  /** Lonestar billed every line, approved and paid: closeout opens on Accept the work. */
  const allBilled: DrawTables = {
    ...NONE,
    sows: [{ id: 'w1', package_id: 'k1' }],
    sowLines: [
      { id: 'l1', sow_id: 'w1', position: 0, scope_item_id: 's1' },
      { id: 'l2', sow_id: 'w1', position: 1, scope_item_id: 's2' },
    ],
    draws: [
      {
        id: 'd1', sow_id: 'w1', number: 1, requested_on: '2026-10-10', status: 'paid', gross: 66500, retainage: 6650, net: 59850, final: false,
        waiver: 'unconditional', waiver_on: '2026-10-11', approved_on: '2026-10-10', paid_on: '2026-10-11', asked: null, sent_back_on: null, sent_back_note: null,
        period_to: '2026-10-10', address: '', license: '', signed_by: 'Ana Ruiz', signed_title: 'Owner', signed_on: '2026-10-10',
        file_name: null, drive_url: null, recorded_by: 'u1', created_at: '2026-10-10T00:00:00Z', seq: 1,
      },
    ],
    drawLines: [
      { draw_id: 'd1', sow_line_id: 'l1', to_pct: 100, stored: 0, we_see: null },
      { draw_id: 'd1', sow_line_id: 'l2', to_pct: 100, stored: 0, we_see: null },
    ],
  }
  const loaded = { loaded: () => screen.findByRole('navigation', { name: 'Jump to a stage' }) }

  it('a dev opens Closeout after Draws, and it reads the customer’s bills and the punch list for that job', async () => {
    const rows = at('building')
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    const names = within(card).getAllByRole('button').map((b) => b.textContent)
    expect(names.indexOf('Closeout')).toBe(names.indexOf('Draws') + 1)
    expect(loadGcPunch).not.toHaveBeenCalled()
    fireEvent.click(within(card).getByRole('button', { name: 'Closeout' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hill Country Clinic: Closeout' })
    await waitFor(() => expect(loadGcPunch).toHaveBeenCalledWith(['p1']))
    expect(loadGcBillingRows).toHaveBeenCalledWith(['p1'])
    expect(dialog.querySelector('[data-closeout-trade="k1"]')).toBeTruthy()
  })

  it('Accept the work goes to its function and reads the board again', async () => {
    const rows = at('building')
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValue(rows)
    vi.mocked(loadGcDraws).mockResolvedValue(allBilled)
    await renderSettled(<GcProjects />, loaded)
    fireEvent.click(await within(document.querySelector('[data-gc-project="p1"]') as HTMLElement).findByRole('button', { name: 'Closeout' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hill Country Clinic: Closeout' })
    const boardReads = vi.mocked(loadGcBoardRows).mock.calls.length
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Accept the work' }))
    await waitFor(() => expect(acceptWork).toHaveBeenCalledWith('k1'))
    await waitFor(() => expect(vi.mocked(loadGcBoardRows).mock.calls.length).toBeGreaterThan(boardReads))
  })

  it('a closed job keeps Closeout and has no Draws', async () => {
    const rows = at('closed')
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    const card = document.querySelector('[data-gc-project="p1"]') as HTMLElement
    expect(within(card).getByRole('button', { name: 'Closeout' })).toBeTruthy()
    expect(within(card).queryByRole('button', { name: 'Draws' })).toBeNull()
  })

  it('a master sees no Closeout while Building is built, and nothing of it is read', async () => {
    auth.role = 'master_technician'
    const rows = at('building')
    vi.mocked(loadGcProjects).mockResolvedValueOnce(rows.projects)
    vi.mocked(loadGcBoardRows).mockResolvedValueOnce(rows)
    await renderSettled(<GcProjects />, loaded)
    expect(screen.queryByRole('button', { name: 'Closeout' })).toBeNull()
    expect(loadGcPunch).not.toHaveBeenCalled()
  })
})
