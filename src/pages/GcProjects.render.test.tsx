// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import GcProjects from './GcProjects'
import { renderSettled, settle } from '../test/renderSmokeMocks'
import { recordNavClick } from '../lib/navClickTelemetry'
import { GC_NEW_HERE_SEEN_KEY } from '../lib/gc/tour'
import { askGcCompanies, carryGcTrade, loadGcBoardRows, loadGcProjects, markGcBidSent, setGcProjectMoney } from '../lib/gc/gcIo'
import { clinicBoardRows } from '../lib/gc/boardTestRows'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

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
  }
})

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
  afterEach(() => window.localStorage.clear())

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
    await waitFor(() => expect(askGcCompanies).toHaveBeenCalledWith('k2', ['alamo'], expect.any(String), expect.any(String)))
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
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Lonestar Earthworks' })).toBeNull()
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
