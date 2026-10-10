// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 11: the what-if copy on the Schedule window (G-81). A dev makes a copy and
 * the window reads it; in the copy only moves are offered (call 2); a pull tried there goes through the copy's own save,
 * never the real move save (call 3); Keep sends the kernel's moves with the version read and its line in the log (call
 * 5); Throw it away asks once; nobody who may not move a bar sees the way in; and the line's sentence about the bills is
 * the money team's only (call 7). The io is mocked over one job read, Fair Oaks D with two lines finished early.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcScheduleWindow } from './GcScheduleWindow'
import { keepScheduleWhatIf, loadSchedule, loadScheduleMoney, saveScheduleMove, startWhatIf, throwAwayWhatIf, tryInWhatIf } from '../../lib/gc/scheduleIo'
import type { ScheduleMoney } from '../../lib/gc/scheduleMoney'
import { NO_DRAWS } from '../../lib/gc/drawRows'
import { addDays } from '../../lib/gc/building'
import { moveRecord, planMove } from '../../lib/gc/schedule/moves'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { withLineReported } from '../../lib/gc/schedule/testReports'
import { whatIfCopy, whatIfProject } from '../../lib/gc/schedule/whatIf'
import { tryInCopy } from '../../lib/gc/schedule/whatIfWindow'
import type { ScheduleWhatIf } from '../../lib/gc/schedule/types'
import type { GcProject } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const s = withLineReported(withLineReported(initialGcState(), 'fairoaksd', 'fhvac', 'fhvac-2', 100), 'fairoaksd', 'fplumb', 'fplumb-3', 100)
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
/** The job as the window last read it; each mocked write changes it as the database would. */
let current: GcProject = fairOaks
const readOf = () => ({ state: s, project: current, version: 3 })

vi.mock('../../lib/gc/scheduleIo', () => {
  const loadSchedule = vi.fn()
  return {
    loadSchedule,
    loadScheduleWithHolds: vi.fn((state: unknown, id: string) => loadSchedule(state, id)),
    loadScheduleMoney: vi.fn(),
    saveScheduleMove: vi.fn(),
    startWhatIf: vi.fn(),
    tryInWhatIf: vi.fn(),
    throwAwayWhatIf: vi.fn(),
    keepScheduleWhatIf: vi.fn(),
  }
})
// The bills as a stand-in: a shift whenever asked, so the line's sentence shows for whoever is handed one.
vi.mock('../../lib/gc/billingForecast', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/gc/billingForecast')>()
  return { ...real, planBillingShift: vi.fn(() => [{ on: '2026-11-01', delta: -4000 }, { on: '2026-12-01', delta: 4000 }]), shiftWords: vi.fn(() => '$4,000 of the Nov 1 bill moves to Dec 1.') }
})

beforeEach(() => {
  current = fairOaks
  vi.mocked(loadSchedule).mockImplementation(() => Promise.resolve(readOf()))
  vi.mocked(loadScheduleMoney).mockImplementation(() => new Promise(() => undefined))
  vi.mocked(startWhatIf).mockImplementation((_st, _id, _v, made: ScheduleWhatIf) => {
    current = { ...fairOaks, whatIf: made }
    return Promise.resolve(readOf())
  })
  vi.mocked(tryInWhatIf).mockImplementation((_st, _id, w: ScheduleWhatIf) => {
    current = { ...current, whatIf: w }
    return Promise.resolve(readOf())
  })
  vi.mocked(throwAwayWhatIf).mockImplementation(() => {
    current = fairOaks
    return Promise.resolve(readOf())
  })
  vi.mocked(keepScheduleWhatIf).mockImplementation(() => {
    current = fairOaks
    return Promise.resolve(readOf())
  })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const open = (over: { canMove?: boolean; money?: boolean } = {}) =>
  render(<GcScheduleWindow state={s} project={fairOaks} by="Robert Douglas" canMove={over.canMove ?? true} canPull reads={over.money ? { money: true } : {}} onClose={vi.fn()} />)

/** A copy with TPO tried three days later, with its reason. */
function withTried(): GcProject {
  const opened = { ...fairOaks, whatIf: whatIfCopy(fairOaks, 'Robert Douglas', s.today)! }
  const onCopy = whatIfProject(opened)!
  const a = onCopy.schedule!.activities.find((x) => x.lineId === 'froof-1')!
  const plan = planMove(onCopy, 'froof-1', addDays(a.start, 3), addDays(a.finish, 3))!
  const move = moveRecord(onCopy.schedule!, 'froof-1', plan, { reason: 'weather', note: 'Rain on the deck.', by: 'Robert Douglas' }, s.today)
  return { ...opened, whatIf: tryInCopy(opened, move, plan.activities)! }
}

describe('the what-if copy on the Schedule window (PR 11)', () => {
  it('a dev makes a copy with the version read, and the window then reads it', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'What if…' }))
    await waitFor(() => expect(startWhatIf).toHaveBeenCalledWith(s, 'fairoaksd', 3, expect.objectContaining({ on: s.today, by: 'Robert Douglas' })))
    await waitFor(() => expect(document.querySelector('[data-what-if-line]')).toBeTruthy())
    expect(screen.getByText('Tried in the what-if')).toBeTruthy()
    // On the toolbar and on the line.
    expect(screen.getAllByRole('button', { name: 'See the real schedule' })).toHaveLength(2)
  })

  it('offers only moves in the copy: the walk, the cards and Print are hidden', async () => {
    current = withTried()
    open()
    await screen.findByRole('button', { name: 'What if · 1' })
    expect(document.querySelector('[data-walk-line]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Print or PDF' })).toBeTruthy()
    // The cards (their own words, since the chart's legend also says what the work waits on).
    const cards = () => [document.body.textContent!.includes("Deliveries on order, decisions the customer owes, permits, the utility's work."), screen.queryByText('Where the work is'), screen.queryByText('Milestones')]
    expect(cards().every(Boolean)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'What if · 1' }))
    await screen.findByText('Tried in the what-if (1)')
    expect(document.querySelector('[data-walk-line]')).toBeNull()
    for (const gone of ['Print or PDF', 'Export', 'Add an activity']) expect(screen.queryByRole('button', { name: gone })).toBeNull()
    expect(cards()).toEqual([false, null, null])
    // The pull is a move, so it stays.
    expect(screen.getByRole('button', { name: 'Pull the work earlier' })).toBeTruthy()
  })

  it('tries a pull on the copy through the copy’s own save, never the real one', async () => {
    current = { ...fairOaks, whatIf: whatIfCopy(fairOaks, 'Robert Douglas', s.today)! }
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'What if · 0' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pull the work earlier' }))
    const dialog = screen.getByRole('dialog', { name: 'Pull the work earlier' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try pulling 1 activity earlier' }))
    await waitFor(() => expect(tryInWhatIf).toHaveBeenCalled())
    const tried = vi.mocked(tryInWhatIf).mock.calls[0]![2]
    expect(tried.schedule.moves?.[0]).toMatchObject({ reason: 'early' })
    expect(saveScheduleMove).not.toHaveBeenCalled()
  })

  it('keeps the copy’s moves with the version read and its line in the log, then shows the real schedule', async () => {
    current = withTried()
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'What if · 1' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Keep the move…' }))
    const dialog = screen.getByRole('dialog', { name: 'Keep the what-if' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep the move' }))
    await waitFor(() => expect(keepScheduleWhatIf).toHaveBeenCalled())
    const [st, id, press, kept] = vi.mocked(keepScheduleWhatIf).mock.calls[0]!
    expect([st, id, press]).toEqual([s, 'fairoaksd', { version: 3, words: `Robert Douglas kept a what-if on ${fairOaks.name}: 1 move on the schedule, each with its reason.` }])
    expect(kept.kept.map((m) => [m.lineId, m.reason, m.fromWhatIf])).toEqual([['froof-1', 'weather', s.today]])
    await waitFor(() => expect(document.querySelector('[data-what-if-line]')).toBeNull())
    expect(screen.getByRole('button', { name: 'What if…' })).toBeTruthy()
  })

  it('throws the copy away only on the second press', async () => {
    current = withTried()
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'What if · 1' }))
    const line = await waitFor(() => document.querySelector('[data-what-if-line]') as HTMLElement)
    fireEvent.click(within(line).getByRole('button', { name: 'Throw it away' }))
    expect(throwAwayWhatIf).not.toHaveBeenCalled()
    fireEvent.click(within(line).getByRole('button', { name: 'Throw it away' }))
    await waitFor(() => expect(throwAwayWhatIf).toHaveBeenCalledWith(s, 'fairoaksd'))
    await waitFor(() => expect(document.querySelector('[data-what-if-line]')).toBeNull())
  })

  it('shows no way in to someone who may not move a bar', async () => {
    open({ canMove: false })
    await screen.findByText('Changes to the schedule')
    expect(screen.queryByRole('button', { name: 'What if…' })).toBeNull()
  })

  it('says what the copy does to the bills to the money team only', async () => {
    const money: ScheduleMoney = { bills: { terms: [], contract: [], billing: new Map(), names: {}, payDays: {} }, changeOrders: [], draws: NO_DRAWS }
    vi.mocked(loadScheduleMoney).mockResolvedValue(money)
    current = withTried()
    open({ money: true })
    fireEvent.click(await screen.findByRole('button', { name: 'What if · 1' }))
    await waitFor(() => expect(document.querySelector('[data-what-if-words]')!.textContent).toContain('The bills: $4,000 of the Nov 1 bill moves to Dec 1.'))
    cleanup()
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'What if · 1' }))
    await waitFor(() => expect(document.querySelector('[data-what-if-words]')).toBeTruthy())
    expect(document.querySelector('[data-what-if-words]')!.textContent).not.toContain('The bills')
  })
})
