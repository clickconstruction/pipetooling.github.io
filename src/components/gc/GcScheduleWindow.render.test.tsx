// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 7b: the Schedule window on main's test state, with the
 * schedule's reads and its one press stood in for (`scheduleIo`). Fair Oaks D read back, a bar
 * pressed, the list on a phone, Helotes' first draft, Boerne while we bid, a lost job, a read that
 * fails, and a draw someone else beat. Since 7c-ii, the call list grouped by company, with Call only.
 * Since 9a, an inspection passed or failed, the job's own work and the dates to meet, for a dev. Since
 * 9b, a bar's place, a split, a wait and a new baseline.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcScheduleWindow } from './GcScheduleWindow'
import {
  addScheduleActivity,
  addScheduleWait,
  drawSchedule,
  failScheduleInspection,
  loadSchedule,
  passScheduleInspection,
  removeScheduleActivity,
  saveScheduleMove,
  setOwnWorkDone,
  setScheduleBaseline,
  setScheduleMilestone,
  setSchedulePlaces,
  splitScheduleBar,
  undoScheduleMove,
} from '../../lib/gc/scheduleIo'
import { addDays } from '../../lib/gc/building'
import { callList } from '../../lib/gc/schedule/callList'
import { chartHolds } from '../../lib/gc/schedule/chartHolds'
import { moveRecord, planMove } from '../../lib/gc/schedule/moves'
import { scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { plainWordsFailures } from '../../lib/plainWords'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { SCHEDULE_CHANGED } from '../../lib/gc/schedule/versionRefusal'
import type { ProjectSchedule } from '../../lib/gc/schedule/types'
import type { GcProject, GcState } from '../../lib/gc/types'
import { checkSupabaseError } from '../../utils/errorHandling'

vi.mock('../../lib/gc/scheduleIo', () => ({
  loadSchedule: vi.fn(),
  drawSchedule: vi.fn(),
  saveScheduleMove: vi.fn(),
  undoScheduleMove: vi.fn(),
  redoScheduleMove: vi.fn(),
  setActualDates: vi.fn(),
  addScheduleActivity: vi.fn(),
  removeScheduleActivity: vi.fn(),
  setOwnWorkDone: vi.fn(),
  passScheduleInspection: vi.fn(),
  failScheduleInspection: vi.fn(),
  setScheduleMilestone: vi.fn(),
  removeScheduleMilestone: vi.fn(),
  addScheduleWait: vi.fn(),
  setScheduleWaitStep: vi.fn(),
  removeScheduleWait: vi.fn(),
  setSchedulePlaces: vi.fn(),
  splitScheduleBar: vi.fn(),
  joinScheduleBar: vi.fn(),
  setScheduleBaseline: vi.fn(),
}))

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
  vi.mocked(saveScheduleMove).mockReset()
  vi.mocked(undoScheduleMove).mockReset()
  for (const press of [addScheduleActivity, removeScheduleActivity, setOwnWorkDone, passScheduleInspection, failScheduleInspection, setScheduleMilestone]) vi.mocked(press).mockReset()
  for (const press of [addScheduleWait, setSchedulePlaces, splitScheduleBar, setScheduleBaseline]) vi.mocked(press).mockReset()
})

const s = initialGcState()
const job = (st: GcState, id: string) => st.projects.find((p) => p.id === id)!
/** The board with one job changed, as `loadSchedule` would lay it over the board. */
const withJob = (id: string, change: (p: GcProject) => GcProject): GcState => ({ ...s, projects: s.projects.map((p) => (p.id === id ? change(p) : p)) })
/** `loadSchedule`'s answer for one job of a state. */
const readOf = (st: GcState, id: string, version: number | null = 3) => ({ state: st, project: job(st, id), version })

function openWindow(project: GcProject, onClose = vi.fn(), canMove = false) {
  const view = render(<GcScheduleWindow state={s} project={project} by="Robert Douglas" canMove={canMove} onClose={onClose} />)
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

describe('moving a bar in the window (PR 8a)', () => {
  /** A drag on a bar of the chart a week later, played with mouse events of the pointer's names (jsdom's carry no coordinates). */
  function dragWeekLater(container: HTMLElement, name: string) {
    fireEvent.click(screen.getByText('Open all'))
    const bar = [...container.querySelectorAll('[data-gantt-bar]')].find((el) => el.getAttribute('aria-label')?.startsWith(name)) as HTMLElement
    const pointer = (type: string, clientX: number) => fireEvent(bar, new MouseEvent(type, { bubbles: true, clientX, button: 0 }))
    pointer('pointerdown', 100)
    pointer('pointermove', 163)
    pointer('pointerup', 163)
    fireEvent.click(bar)
  }
  const whyIt = async () => {
    const dialog = await screen.findByRole('dialog', { name: 'Why it moved' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Weather' }))
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Rain kept the roof open a week.' } })
    return dialog
  }

  it('a dev drags a bar, says why, and it saves with the version read and the log’s words', async () => {
    const read = readOf(s, 'fairoaksd', 3)
    vi.mocked(loadSchedule).mockResolvedValue(read)
    vi.mocked(saveScheduleMove).mockImplementation(async (_state, _id, _press, _move, activities) => readOf(withJob('fairoaksd', (p) => ({ ...p, schedule: { ...p.schedule!, activities } })), 'fairoaksd', 4))
    const { container } = openWindow(job(s, 'fairoaksd'), vi.fn(), true)
    await screen.findByText('Work done against the plan')
    dragWeekLater(container, 'TPO membrane')
    const dialog = await whyIt()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the move' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Why it moved' })).toBeNull())
    expect(saveScheduleMove).toHaveBeenCalledTimes(1)
    const [state, id, press, move] = vi.mocked(saveScheduleMove).mock.calls[0]!
    // The state the move was worked out on, with its bars: the io measures the answer against them.
    expect(state).toBe(read.state)
    expect(id).toBe('fairoaksd')
    expect(press.version).toBe(3)
    expect(press.words).toMatch(/^Roofing · TPO membrane now runs Mon Sep 28 to Fri Oct 16\..* Robert Douglas: Rain kept the roof open a week\.$/)
    expect(move).toMatchObject({ lineId: 'froof-1', reason: 'weather', by: 'Robert Douglas' })
  })

  it('a save someone else beat stays open, reads the schedule again, and saves on the next press', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'fairoaksd', 3))
    const details = JSON.stringify({ read: 3, version: 4, changes: [{ version: 4, at: '2026-11-02T20:14:00+00:00', by: null, name: 'Ann', words: 'Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30. Ann: The fixtures ship a week late.' }] })
    let stale: unknown = null
    try {
      checkSupabaseError({ data: null, status: 400, error: { code: 'P0001', message: SCHEDULE_CHANGED, details, hint: null } }, 'save the move')
    } catch (e) {
      stale = e
    }
    vi.mocked(saveScheduleMove).mockRejectedValueOnce(stale).mockResolvedValueOnce(readOf(s, 'fairoaksd', 5))
    const { container } = openWindow(job(s, 'fairoaksd'), vi.fn(), true)
    await screen.findByText('Work done against the plan')
    dragWeekLater(container, 'TPO membrane')
    const dialog = await whyIt()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the move' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('2:14 pm Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30.')
    await waitFor(() => expect(loadSchedule).toHaveBeenCalledTimes(2))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Why it moved' })).getByRole('button', { name: 'Save the move' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Why it moved' })).toBeNull())
    expect(saveScheduleMove).toHaveBeenCalledTimes(2)
  })

  it('Undo sends the move with the version read and the log’s words', async () => {
    const p = job(s, 'fairoaksd')
    const a = p.schedule!.activities.find((x) => x.lineId === 'froof-1')!
    const plan = planMove(p, a.lineId, addDays(a.start, 7), addDays(a.finish, 7))!
    const move = { ...moveRecord(p.schedule!, a.lineId, plan, { reason: 'weather', note: 'Rain kept the roof open a week.', by: 'Robert' }, s.today), id: 'move-row-1' }
    const movedState = withJob('fairoaksd', (x) => ({ ...x, schedule: { ...x.schedule!, activities: plan.activities, moves: [move, ...(x.schedule!.moves ?? [])] } }))
    const read = readOf(movedState, 'fairoaksd', 7)
    vi.mocked(loadSchedule).mockResolvedValue(read)
    vi.mocked(undoScheduleMove).mockResolvedValue(readOf(s, 'fairoaksd', 8))
    openWindow(job(movedState, 'fairoaksd'), vi.fn(), true)
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(undoScheduleMove).toHaveBeenCalledTimes(1))
    expect(vi.mocked(undoScheduleMove).mock.calls[0]).toEqual([read.state, 'fairoaksd', { version: 7, words: 'Robert Douglas undid a move: Roofing · TPO membrane is back to Sep 21 to Oct 9.' }, 'move-row-1'])
  })

  it('a bar pressed opens its form for a dev; a change goes through Why it moved and saves (8b)', async () => {
    const read = readOf(s, 'fairoaksd', 3)
    vi.mocked(loadSchedule).mockResolvedValue(read)
    vi.mocked(saveScheduleMove).mockResolvedValue(readOf(s, 'fairoaksd', 4))
    const { container } = openWindow(job(s, 'fairoaksd'), vi.fn(), true)
    await screen.findByText('Work done against the plan')
    fireEvent.click(screen.getByText('Open all'))
    fireEvent.click(container.querySelector('[data-gantt-bar="froof-1"]') as HTMLElement)
    const editor = container.querySelector('[data-gc-activity-editor="froof-1"]') as HTMLElement
    expect(editor).toBeTruthy()
    // The bar's card stays under it, with its facts.
    expect(container.querySelector('[data-gc-opened-activity="froof-1"]')).toBeTruthy()
    fireEvent.change(within(editor).getByLabelText('Finishes'), { target: { value: '2026-10-16' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Save, and say why' }))
    const dialog = await whyIt()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the move' }))
    await waitFor(() => expect(saveScheduleMove).toHaveBeenCalledTimes(1))
    const [state, , press, move] = vi.mocked(saveScheduleMove).mock.calls[0]!
    expect(state).toBe(read.state)
    expect(press.version).toBe(3)
    expect(move).toMatchObject({ lineId: 'froof-1', to: { start: '2026-09-21', finish: '2026-10-16' } })
  })

  it('a bar pressed opens no form for someone who may not move it, only its card', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'fairoaksd', 3))
    const { container } = openWindow(job(s, 'fairoaksd'))
    await screen.findByText('Work done against the plan')
    fireEvent.click(screen.getByText('Open all'))
    fireEvent.click(container.querySelector('[data-gantt-bar="froof-1"]') as HTMLElement)
    expect(container.querySelector('[data-gc-opened-activity="froof-1"]')).toBeTruthy()
    expect(container.querySelector('[data-gc-activity-editor]')).toBeNull()
  })

  it('someone who may not move a bar drags nothing and has no Undo', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'fairoaksd', 3))
    const { container } = openWindow(job(s, 'fairoaksd'))
    await screen.findByText('Work done against the plan')
    dragWeekLater(container, 'TPO membrane')
    expect(screen.queryByRole('dialog', { name: 'Why it moved' })).toBeNull()
    expect(screen.getByText(/Changes to the schedule/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })
})

describe('the call list in the window (7c-ii)', () => {
  const fairOaks = job(s, 'fairoaksd')
  const lineOf = (label: string) => scheduleMeasures(s, fairOaks).items.find((i) => i.label === label)!.activity.lineId
  /** Fair Oaks D grouped by company, where the chart draws who to call. */
  async function byCompany(st: GcState = s) {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(st, 'fairoaksd'))
    const view = openWindow(job(st, 'fairoaksd'))
    fireEvent.click(within(await screen.findByRole('group', { name: 'Group the chart' })).getByRole('button', { name: 'By company' }))
    return { ...view, list: () => screen.getByRole('region', { name: 'Who to call about the schedule' }) }
  }

  it('lists who to call with Call only: no Follow up and no Work the list until the Board lane’s sheet', async () => {
    const { list } = await byCompany()
    const calls = list().querySelectorAll('a[href^="tel:"]')
    expect(calls.length).toBe(callList(s, fairOaks, chartHolds(s, fairOaks)).count)
    for (const a of calls) expect(a.getAttribute('href')).toMatch(/^tel:\d+$/)
    expect(within(list()).queryByText('Follow up')).toBeNull()
    expect(within(list()).queryByText('Work the list')).toBeNull()
  })

  it('a line about a bar opens its card, with the company doing it and Call', async () => {
    const { container, list } = await byCompany()
    fireEvent.click(within(list()).getByText('Lighting is behind: 40% done against 48% in the plan. It is due Fri Oct 23.'))
    const card = container.querySelector(`[data-gc-opened-activity="${lineOf('Lighting')}"]`) as HTMLElement
    expect(within(card).getByText('Pecan Valley Electric')).toBeTruthy()
    expect(card.querySelector('[data-tour="gc-bar-caller"] a[href^="tel:"]')?.textContent).toMatch(/^Call \S+$/)
    expect(within(card).queryByText('Follow up')).toBeNull()
  })

  it('Their work shows only that company on the chart (G-13)', async () => {
    const { list } = await byCompany()
    const onChart = new Set(scheduleMeasures(s, fairOaks).items.map((i) => i.company))
    const first = callList(s, fairOaks, chartHolds(s, fairOaks)).people.find((p) => onChart.has(p.company))!
    fireEvent.click(within(list()).getAllByText('Their work')[0]!)
    expect((screen.getByRole('combobox', { name: 'One company' }) as HTMLSelectElement).value).toBe(first.company)
  })

  it('has no call list on a job not being built', async () => {
    await byCompany(withJob('fairoaksd', (p) => ({ ...p, stage: 'buyout' })))
    expect(screen.queryByRole('region', { name: 'Who to call about the schedule' })).toBeNull()
    expect(document.querySelector('[data-tour="gc-call-list"]')).toBeNull()
  })
})

describe('the job’s own work, an inspection and the dates to meet in the window (PR 9a)', () => {
  /** Fair Oaks D open for a dev, read at version 3. */
  async function open(st: GcState = s) {
    const read = readOf(st, 'fairoaksd', 3)
    vi.mocked(loadSchedule).mockResolvedValue(read)
    const view = openWindow(job(st, 'fairoaksd'), vi.fn(), true)
    await screen.findByText('Work done against the plan')
    return { ...view, read }
  }
  /** A bar pressed on the chart: its form. */
  function pressBar(container: HTMLElement, id: string): HTMLElement {
    fireEvent.click(screen.getByText('Open all'))
    fireEvent.click(container.querySelector(`[data-gantt-bar="${id}"]`) as HTMLElement)
    return container.querySelector(`[data-gc-activity-editor="${id}"]`) as HTMLElement
  }

  it('records an inspection passed from its form, a record', async () => {
    vi.mocked(passScheduleInspection).mockResolvedValue(readOf(s, 'fairoaksd', 3))
    const { container, read } = await open()
    const editor = pressBar(container, 'fairoaksd-insp-roughin')
    fireEvent.click(within(editor).getByRole('button', { name: 'It passed today' }))
    await waitFor(() => expect(passScheduleInspection).toHaveBeenCalledWith(read.state, 'fairoaksd', 'fairoaksd-insp-roughin'))
  })

  it('records a failed inspection with the version read, the bars it leaves and the log’s words', async () => {
    vi.mocked(failScheduleInspection).mockResolvedValue(readOf(s, 'fairoaksd', 4))
    const { container, read } = await open()
    const editor = pressBar(container, 'fairoaksd-insp-roughin')
    fireEvent.click(within(editor).getByRole('button', { name: 'It failed' }))
    fireEvent.change(within(editor).getByRole('textbox'), { target: { value: 'The bonding jumper is missing.' } })
    fireEvent.change(within(editor).getByDisplayValue(addDays(s.today, 3)), { target: { value: '2026-11-02' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Record the failure' }))
    await waitFor(() => expect(failScheduleInspection).toHaveBeenCalledTimes(1))
    const [state, id, press, activityId, failure, activities] = vi.mocked(failScheduleInspection).mock.calls[0]!
    expect(state).toBe(read.state)
    expect(id).toBe('fairoaksd')
    expect(press.version).toBe(3)
    expect(press.words).toMatch(/^The rough-in inspection failed on .*: The bonding jumper is missing\. .*Re-inspection Mon Nov 2\./)
    expect(activityId).toBe('fairoaksd-insp-roughin')
    expect(failure).toMatchObject({ note: 'The bonding jumper is missing.', reinspectOn: '2026-11-02' })
    expect(activities.find((a) => a.lineId === 'fairoaksd-insp-roughin')).toMatchObject({ start: '2026-11-02', finish: '2026-11-03' })
  })

  it('puts the job’s own work on the chart with the version read and the log’s words', async () => {
    vi.mocked(addScheduleActivity).mockResolvedValue(readOf(s, 'fairoaksd', 4))
    const { read } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Add an activity' }))
    fireEvent.change(screen.getByLabelText('What it is'), { target: { value: 'Slab cure' } })
    fireEvent.change(screen.getByLabelText('The day it starts'), { target: { value: '2026-10-05' } })
    fireEvent.change(screen.getByLabelText('The day it finishes'), { target: { value: '2026-10-14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put it on the schedule' }))
    await waitFor(() => expect(addScheduleActivity).toHaveBeenCalledTimes(1))
    const [state, id, press, activities] = vi.mocked(addScheduleActivity).mock.calls[0]!
    expect(state).toBe(read.state)
    expect(id).toBe('fairoaksd')
    expect(press).toEqual({ version: 3, words: `Robert Douglas put Slab cure on ${job(s, 'fairoaksd').name}'s schedule, Mon Oct 5 to Wed Oct 14, Cure time.` })
    expect(activities.find((a) => a.added)).toMatchObject({ added: { label: 'Slab cure', who: 'Cure time', doneOn: null } })
  })

  it('marks the job’s own work done in its form, a record, and takes it off with the version read', async () => {
    const own = { lineId: 'fairoaksd-own-1', packageId: '', start: '2026-10-05', finish: '2026-10-14', after: [], added: { label: 'Slab cure', who: 'Cure time', doneOn: null } }
    const st = withJob('fairoaksd', (p) => ({ ...p, schedule: { ...p.schedule!, activities: [...p.schedule!.activities, own] } }))
    vi.mocked(setOwnWorkDone).mockResolvedValue(readOf(st, 'fairoaksd', 3))
    vi.mocked(removeScheduleActivity).mockResolvedValue(readOf(s, 'fairoaksd', 4))
    const { container, read } = await open(st)
    const editor = pressBar(container, 'fairoaksd-own-1')
    fireEvent.click(within(editor).getByRole('button', { name: 'Mark it done today' }))
    await waitFor(() => expect(setOwnWorkDone).toHaveBeenCalledWith(read.state, 'fairoaksd', 'fairoaksd-own-1', s.today))
    await waitFor(() => expect((within(editor).getByRole('button', { name: 'Take it off the schedule' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(within(editor).getByRole('button', { name: 'Take it off the schedule' }))
    await waitFor(() => expect(removeScheduleActivity).toHaveBeenCalledTimes(1))
    const [, , press, activityId] = vi.mocked(removeScheduleActivity).mock.calls[0]!
    expect(press).toEqual({ version: 3, words: `Slab cure came off ${job(s, 'fairoaksd').name}'s schedule.` })
    expect(activityId).toBe('fairoaksd-own-1')
    await waitFor(() => expect(container.querySelector('[data-gc-activity-editor]')).toBeNull())
  })

  it('adds a date to meet, a record', async () => {
    vi.mocked(setScheduleMilestone).mockResolvedValue(readOf(s, 'fairoaksd', 3))
    const { read } = await open()
    fireEvent.change(screen.getByLabelText('New milestone'), { target: { value: 'Storefront glazed' } })
    fireEvent.change(screen.getByLabelText("New milestone's day"), { target: { value: '2026-11-06' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }))
    await waitFor(() => expect(setScheduleMilestone).toHaveBeenCalledWith(read.state, 'fairoaksd', expect.objectContaining({ label: 'Storefront glazed', planned: '2026-11-06', packageId: null })))
  })

  it('shows none of them to someone who may not move a bar', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'fairoaksd', 3))
    const { container } = openWindow(job(s, 'fairoaksd'))
    await screen.findByText('Work done against the plan')
    expect(screen.queryByRole('button', { name: 'Add an activity' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add milestone' })).toBeNull()
    fireEvent.click(screen.getByText('Open all'))
    fireEvent.click(container.querySelector('[data-gantt-bar="fairoaksd-insp-roughin"]') as HTMLElement)
    expect(container.querySelector('[data-gc-opened-activity="fairoaksd-insp-roughin"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'It passed today' })).toBeNull()
  })
})

describe('waits, places, parts and the baseline in the window (PR 9b)', () => {
  async function open() {
    const read = readOf(s, 'fairoaksd', 3)
    vi.mocked(loadSchedule).mockResolvedValue(read)
    const view = openWindow(job(s, 'fairoaksd'), vi.fn(), true)
    await screen.findByText('Work done against the plan')
    return { ...view, read }
  }
  function pressBar(container: HTMLElement, id: string): HTMLElement {
    fireEvent.click(screen.getByText('Open all'))
    fireEvent.click(container.querySelector(`[data-gantt-bar="${id}"]`) as HTMLElement)
    return container.querySelector(`[data-gc-activity-editor="${id}"]`) as HTMLElement
  }

  it('sets a bar’s place from its form, a record', async () => {
    vi.mocked(setSchedulePlaces).mockResolvedValue(readOf(s, 'fairoaksd', 3))
    const { container, read } = await open()
    const editor = pressBar(container, 'froof-3')
    fireEvent.click(within(editor).getByRole('button', { name: 'Set the place' }))
    await waitFor(() => expect(setSchedulePlaces).toHaveBeenCalledWith(read.state, 'fairoaksd', [{ lineId: 'froof-3', place: 'Roof' }]))
  })

  it('splits a line from its parts card with the version read and the log’s words', async () => {
    vi.mocked(splitScheduleBar).mockResolvedValue(readOf(s, 'fairoaksd', 4))
    const { container, read } = await open()
    pressBar(container, 'froof-1')
    fireEvent.click(screen.getByRole('button', { name: 'Split into parts…' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: /^Split .* into parts$/ })).getByRole('button', { name: 'Split it' }))
    await waitFor(() => expect(splitScheduleBar).toHaveBeenCalledTimes(1))
    const [state, id, press, activityId, parts] = vi.mocked(splitScheduleBar).mock.calls[0]!
    expect(state).toBe(read.state)
    expect(id).toBe('fairoaksd')
    expect(press.version).toBe(3)
    expect(press.words).toMatch(/^Robert Douglas split Roofing · TPO membrane on .* into 2 parts: /)
    expect(activityId).toBe('froof-1')
    expect(parts).toHaveLength(2)
  })

  it('adds what the work waits on, a record', async () => {
    vi.mocked(addScheduleWait).mockResolvedValue(readOf(s, 'fairoaksd', 3))
    const { read } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Add one' }))
    fireEvent.change(screen.getByLabelText('What it is'), { target: { value: 'Storefront glass' } })
    fireEvent.change(screen.getByLabelText('The day it is expected'), { target: { value: '2026-11-06' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put it on the schedule' }))
    await waitFor(() => expect(addScheduleWait).toHaveBeenCalledWith(read.state, 'fairoaksd', expect.objectContaining({ kind: 'delivery', title: 'Storefront glass', expectedOn: '2026-11-06' })))
  })

  it('takes a new baseline with the version read and the log’s words', async () => {
    vi.mocked(setScheduleBaseline).mockResolvedValue(readOf(s, 'fairoaksd', 4))
    const { read } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Set a new baseline' }))
    fireEvent.change(screen.getByLabelText('Why a new baseline'), { target: { value: 'Change order 2 added a canopy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Take the plan as it stands' }))
    await waitFor(() => expect(setScheduleBaseline).toHaveBeenCalledTimes(1))
    const [state, id, press, name, why] = vi.mocked(setScheduleBaseline).mock.calls[0]!
    expect(state).toBe(read.state)
    expect(id).toBe('fairoaksd')
    expect(press).toEqual({ version: 3, words: `Robert Douglas set a new baseline on ${job(s, 'fairoaksd').name}, ${name}: Change order 2 added a canopy. The plan at Start is kept.` })
    expect(why).toBe('Change order 2 added a canopy')
  })

  it('shows none of them to someone who may not move a bar', async () => {
    vi.mocked(loadSchedule).mockResolvedValue(readOf(s, 'fairoaksd', 3))
    const { container } = openWindow(job(s, 'fairoaksd'))
    await screen.findByText('Work done against the plan')
    for (const name of ['Add one', 'Look at the places', 'Set a new baseline']) expect(screen.queryByRole('button', { name })).toBeNull()
    fireEvent.click(screen.getByText('Open all'))
    fireEvent.click(container.querySelector('[data-gantt-bar="froof-1"]') as HTMLElement)
    expect(screen.queryByRole('button', { name: 'Split into parts…' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Set the place' })).toBeNull()
  })
})
