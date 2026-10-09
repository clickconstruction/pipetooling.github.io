// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 7b: the Schedule window on main's test state, with the
 * schedule's reads and its one press stood in for (`scheduleIo`). Fair Oaks D read back, a bar
 * pressed, the list on a phone, Helotes' first draft, Boerne while we bid, a lost job, a read that
 * fails, and a draw someone else beat.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcScheduleWindow } from './GcScheduleWindow'
import { drawSchedule, loadSchedule } from '../../lib/gc/scheduleIo'
import { plainWordsFailures } from '../../lib/plainWords'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { SCHEDULE_CHANGED } from '../../lib/gc/schedule/versionRefusal'
import type { ProjectSchedule } from '../../lib/gc/schedule/types'
import type { GcProject, GcState } from '../../lib/gc/types'
import { checkSupabaseError } from '../../utils/errorHandling'

vi.mock('../../lib/gc/scheduleIo', () => ({ loadSchedule: vi.fn(), drawSchedule: vi.fn() }))

const realMatchMedia = window.matchMedia
const asPhone = (phone: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: phone && query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
}
beforeEach(() => asPhone(false))
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
  vi.mocked(loadSchedule).mockReset()
  vi.mocked(drawSchedule).mockReset()
})

const s = initialGcState()
const job = (st: GcState, id: string) => st.projects.find((p) => p.id === id)!
/** The board with one job changed, as `loadSchedule` would lay it over the board. */
const withJob = (id: string, change: (p: GcProject) => GcProject): GcState => ({ ...s, projects: s.projects.map((p) => (p.id === id ? change(p) : p)) })
/** `loadSchedule`'s answer for one job of a state. */
const readOf = (st: GcState, id: string, version: number | null = 3) => ({ state: st, project: job(st, id), version })

function openWindow(project: GcProject, onClose = vi.fn()) {
  const view = render(<GcScheduleWindow state={s} project={project} by="Robert Douglas" onClose={onClose} />)
  return { ...view, onClose, dialog: () => screen.getByRole('dialog', { name: `${project.name}: the schedule` }) }
}
const toolbar = () => document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement

describe('the Schedule window', () => {
  it('reads Fair Oaks D back: the measures and the chart, its bars and links, with Print or PDF and Export', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'fairoaksd'))
    const { container } = openWindow(job(s, 'fairoaksd'))
    await screen.findByText('Work done against the plan')
    expect(loadSchedule).toHaveBeenCalledWith(s, 'fairoaksd')
    expect(screen.getByText('Projected finish')).toBeTruthy()
    expect(container.querySelectorAll('[data-gantt-bar]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('svg path').length).toBeGreaterThan(0)
    expect(within(toolbar()).getByRole('button', { name: 'Print or PDF' })).toBeTruthy()
    expect(within(toolbar()).getByRole('button', { name: 'Export' })).toBeTruthy()
    // Read only: nothing on the chart drags, links or asks for days.
    expect(screen.queryByRole('button', { name: /Ask for the days/ })).toBeNull()
    expect(drawSchedule).not.toHaveBeenCalled()
  })

  it('opens a pressed bar’s card: its days, its waits, its spare days and what holds it, in plain words', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'fairoaksd'))
    const { container } = openWindow(job(s, 'fairoaksd'))
    await screen.findByText('Work done against the plan')
    fireEvent.click(screen.getByText('Open all'))
    fireEvent.click(container.querySelector('[data-gantt-bar="felec-5"]') as HTMLElement)
    const card = container.querySelector('[data-gc-opened-activity="felec-5"]') as HTMLElement
    expect(card).toBeTruthy()
    for (const words of ['Mon Oct 19 to Fri Oct 30', '37 days before it moves the finish', 'waits on current insurance, theirs ran out Sep 15', 'Sidewalks and curbs in Concrete', 'Final inspection']) expect(within(card).getByText(words)).toBeTruthy()
    for (const dd of card.querySelectorAll('dd')) expect(plainWordsFailures(dd.textContent ?? ''), dd.textContent ?? '').toEqual([])
    fireEvent.click(within(card).getByRole('button', { name: 'Close the bar' }))
    expect(container.querySelector('[data-gc-opened-activity]')).toBeNull()
  })

  it('opens on the list on a phone (G-19)', async () => {
    asPhone(true)
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'fairoaksd'))
    openWindow(job(s, 'fairoaksd'))
    expect(await screen.findByRole('region', { name: 'The schedule as a list, by stage, the stage running today first' })).toBeTruthy()
  })

  it('draws Helotes’ first draft from the Monday after next, with no version and the log’s words, then shows it', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'helotes', null))
    let sent: ProjectSchedule | null = null
    vi.mocked(drawSchedule).mockImplementation(async (_state, _id, _press, schedule) => {
      sent = schedule
      return readOf(withJob('helotes', (p) => ({ ...p, schedule })), 'helotes', 1)
    })
    openWindow(job(s, 'helotes'))
    const press = await screen.findByRole('button', { name: 'Draw a first draft' })
    expect((screen.getByLabelText('Work starts') as HTMLInputElement).value).toBe('2026-10-05')
    fireEvent.click(press)
    await screen.findByText('Drawing the schedule.')
    expect(drawSchedule).toHaveBeenCalledTimes(1)
    const [state, id, words] = vi.mocked(drawSchedule).mock.calls[0]!
    expect([state, id]).toEqual([s, 'helotes'])
    expect(words).toEqual({ version: null, words: `Drew a first draft of the schedule on Helotes Dental Office: ${sent!.activities.length} activities from Mon Oct 5.` })
    expect(sent!.activities.length).toBeGreaterThan(0)
    expect(document.querySelectorAll('[data-gantt-bar]').length).toBeGreaterThan(0)
  })

  it('shows Boerne, still bidding, the rough’s sentence and no draw', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'boerne', null))
    openWindow(job(s, 'boerne'))
    expect(await screen.findByText('While we bid, the rough schedule is the one to draw.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Draw a first draft' })).toBeNull()
  })

  it('shows a lost job as lost, with no draw', async () => {
    const lost = withJob('helotes', (p) => ({ ...p, lostOn: '2026-10-01' }))
    vi.mocked(loadSchedule).mockResolvedValue(readOf(lost, 'helotes', null))
    openWindow(job(lost, 'helotes'))
    expect(await screen.findByText('This job was lost.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Draw a first draft' })).toBeNull()
  })

  it('says a read that failed in words, and reads again on Try again', async () => {
    vi.mocked(loadSchedule).mockRejectedValueOnce(new Error('The network is down.')).mockResolvedValue(readOf(s, 'fairoaksd'))
    openWindow(job(s, 'fairoaksd'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Work done against the plan')
    expect(loadSchedule).toHaveBeenCalledTimes(2)
  })

  it('says a draw someone else beat in the database’s words, and reads the schedule again', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'helotes', null))
    const detail = JSON.stringify({ read: null, version: 1, changes: [{ version: 1, at: '2026-11-02T14:00:00+00:00', by: null, name: null, words: 'Drew a first draft.' }] })
    let refusal: unknown = null
    try {
      checkSupabaseError({ data: null, status: 400, error: { code: 'P0001', message: SCHEDULE_CHANGED, details: detail, hint: null } }, 'draw the schedule')
    } catch (e) {
      refusal = e
    }
    vi.mocked(drawSchedule).mockRejectedValue(refusal)
    openWindow(job(s, 'helotes'))
    fireEvent.click(await screen.findByRole('button', { name: 'Draw a first draft' }))
    expect((await screen.findByRole('alert')).textContent).toContain(SCHEDULE_CHANGED)
    await waitFor(() => expect(loadSchedule).toHaveBeenCalledTimes(2))
  })

  it('closes on Close, on Escape and on the dark around it', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'boerne', null))
    const { onClose, dialog } = openWindow(job(s, 'boerne'))
    await screen.findByText('While we bid, the rough schedule is the one to draw.')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(dialog().parentElement as HTMLElement)
    fireEvent.click(dialog())
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
