// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 13b: Tell the trades on the Schedule window. The record of moves counts the
 * companies not told and says so under each move; the press opens the window, which tells through `tellTheTrades` and
 * reads the schedule again; the kept line after a what-if opens the same window; a told move undone reads as a call;
 * each told company's answer shows; and none of it shows in the what-if copy or to someone who may not send a trade
 * email. The io is mocked over one job read: Fair Oaks D with its TPO membrane moved 30 days.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcScheduleWindow } from './GcScheduleWindow'
import { loadSchedule } from '../../lib/gc/scheduleIo'
import { tellTheTrades } from '../../lib/gc/tellTradesIo'
import { addDays } from '../../lib/gc/building'
import { moveRecord, planMove } from '../../lib/gc/schedule/moves'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { whatIfCopy } from '../../lib/gc/schedule/whatIf'
import type { ScheduleMove } from '../../lib/gc/schedule/types'
import type { GcProject } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
let current: GcProject = fairOaks

vi.mock('../../lib/gc/scheduleIo', () => {
  const loadSchedule = vi.fn()
  return { loadSchedule, loadScheduleWithHolds: vi.fn((state: unknown, id: string) => loadSchedule(state, id)), loadScheduleMoney: vi.fn(() => new Promise(() => undefined)) }
})
vi.mock('../../lib/gc/tellTradesIo', () => ({ tellTheTrades: vi.fn(() => Promise.resolve({ told: [{ companyId: 'summit', company: 'Summit Roofing' }], refused: [] })) }))

/** TPO membrane 30 days later, with what telling and undoing left on the move. */
function moved(change: Partial<ScheduleMove> = {}): GcProject {
  const a = fairOaks.schedule!.activities.find((x) => x.lineId === 'froof-1')!
  const plan = planMove(fairOaks, 'froof-1', addDays(a.start, 30), addDays(a.finish, 30))!
  const move = { ...moveRecord(fairOaks.schedule!, 'froof-1', plan, { reason: 'weather', note: 'Rain stopped the roof for a week.', by: 'Robert' }, s.today), ...change }
  return { ...fairOaks, schedule: { ...fairOaks.schedule!, activities: plan.activities, moves: [move] } }
}

beforeEach(() => {
  current = moved()
  vi.mocked(loadSchedule).mockImplementation(() => Promise.resolve({ state: s, project: current, version: 3 }))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** An element once the read has drawn it. */
const found = (selector: string) =>
  waitFor(() => {
    const el = document.querySelector(selector)
    if (!el) throw new Error(`${selector} is not drawn yet`)
    return el as HTMLElement
  })
const open = (canTell = true) => render(<GcScheduleWindow state={s} project={fairOaks} by="Robert Douglas" canMove canTell={canTell} onClose={vi.fn()} />)

describe('Tell the trades on the Schedule window (PR 13b)', () => {
  it('counts the companies not told, says so under the move, and tells them from the window', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Tell the trades · 2' }))
    expect(document.querySelector('[data-move-untold]')!.textContent).toBe('The trades have not been told.')
    const dialog = screen.getByRole('dialog', { name: 'Tell the trades' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell 2 companies' }))
    await waitFor(() => expect(tellTheTrades).toHaveBeenCalled())
    const [, project, companies] = vi.mocked(tellTheTrades).mock.calls[0]!
    expect(project.id).toBe('fairoaksd')
    expect(companies.map((c) => c.partner.company)).toEqual(['Summit Roofing', 'Cool Breeze Mechanical'])
    await waitFor(() => expect(vi.mocked(loadSchedule).mock.calls.length).toBeGreaterThan(1))
    expect(await within(dialog).findByText('Told Summit Roofing.')).toBeTruthy()
  })

  it('shows what each told company answered, and no press once all are told', async () => {
    current = moved({ toldOn: s.today, toldTo: ['summit', 'coolbreeze'], answers: [{ partnerId: 'summit', on: s.today, ok: true }] })
    open()
    await screen.findByText('Summit Roofing: the dates work.')
    expect(screen.getByText(/^Cool Breeze Mechanical: told .+, no answer yet\.$/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Tell the trades/ })).toBeNull()
    expect(document.querySelector('[data-move-untold]')).toBeNull()
  })

  it('reads a told move undone as a call', async () => {
    current = moved({ toldOn: s.today, toldTo: ['summit'], undoneOn: s.today, undoneBy: 'Robert' })
    open()
    const line = await found('[data-move-told-undone]')
    expect(line.textContent).toMatch(/^Told, then undone: Summit Roofing still has the moved dates\. Call them\.Call \S+$/)
    expect(within(line).getByRole('link').getAttribute('href')).toMatch(/^tel:/)
  })

  it('shows the kept line after a what-if, and its Tell the trades opens the window', async () => {
    current = moved({ fromWhatIf: '2026-10-01' })
    open()
    const kept = await found('[data-what-if-kept]')
    expect(kept.textContent).toContain('1 move kept from the what-if. Summit Roofing and Cool Breeze Mechanical have not been told.')
    fireEvent.click(within(kept).getByRole('button', { name: 'Tell the trades' }))
    expect(screen.getByRole('dialog', { name: 'Tell the trades' })).toBeTruthy()
  })

  it('tells nobody from the what-if copy', async () => {
    current = { ...moved({ fromWhatIf: '2026-10-01' }), whatIf: whatIfCopy(moved(), 'Robert', s.today)! }
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'What if · 0' }))
    await screen.findByText('Tried in the what-if')
    expect(screen.queryByRole('button', { name: /^Tell the trades/ })).toBeNull()
    expect(document.querySelector('[data-what-if-kept]')).toBeNull()
  })

  it('shows no way to tell to someone who may not send a trade email', async () => {
    open(false)
    await screen.findByText(/^Changes to the schedule/)
    expect(screen.queryByRole('button', { name: /^Tell the trades/ })).toBeNull()
    expect(document.querySelector('[data-move-untold]')).toBeNull()
  })
})
