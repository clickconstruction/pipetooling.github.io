// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 14c: the office's answers on the Schedule window. Take opens Why it moved
 * filled in with the notice and saves the move naming it; a notice another move took first is refused, the card reads
 * again and its row goes; Push back and our superintendent's check are records through the schedule's io; and neither
 * card shows to someone who may not move a bar, or in the what-if copy. The io is mocked over one job read: Fair Oaks D,
 * where Summit Roofing says its TPO membrane (Sep 21 to Oct 9) will finish Wed Oct 14.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcScheduleWindow } from './GcScheduleWindow'
import { loadSchedule, pushBackLateNotice, saveScheduleMove, verifyLookAhead } from '../../lib/gc/scheduleIo'
import { lateNoticeMove } from '../../lib/gc/schedule/lateNotices'
import { NOTICE_ANSWERED_FIRST } from '../../lib/gc/schedule/lateWindow'
import { moveRecord, planMove } from '../../lib/gc/schedule/moves'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { whatIfCopy } from '../../lib/gc/schedule/whatIf'
import type { LateNotice } from '../../lib/gc/schedule/types'
import type { GcProject } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const NOTE = 'The membrane ships Oct 12. We finish two days after it lands.'
const NOTICE: LateNotice = {
  id: 'late-1',
  partnerId: 'summit',
  lineId: 'froof-1',
  on: '2026-10-02',
  by: 'Carla Nguyen',
  started: true,
  was: { start: '2026-09-21', finish: '2026-10-09' },
  to: { start: '2026-09-21', finish: '2026-10-14' },
  reason: 'materials',
  note: NOTE,
}
const told: GcProject = { ...fairOaks, schedule: { ...fairOaks.schedule!, lateNotices: [NOTICE] } }
/** The job as the window last read it. */
let current: GcProject = told
const readOf = () => ({ state: s, project: current, version: 3 })

/** The notice taken by someone else's move, as the database would keep it. */
function takenElsewhere(): GcProject {
  const pending = lateNoticeMove(s, told, NOTICE)!
  const plan = planMove(told, pending.lineId, pending.start, pending.finish, pending.after)!
  const move = moveRecord(told.schedule!, pending.lineId, plan, { ...pending.why, by: 'Ann' }, s.today, undefined, 'late-1')
  return { ...told, schedule: { ...told.schedule!, activities: plan.activities, moves: [move] } }
}

vi.mock('../../lib/gc/scheduleIo', () => {
  const loadSchedule = vi.fn()
  return {
    loadSchedule,
    loadScheduleWithHolds: vi.fn((state: unknown, id: string) => loadSchedule(state, id)),
    loadScheduleMoney: vi.fn(() => new Promise(() => undefined)),
    saveScheduleMove: vi.fn(),
    pushBackLateNotice: vi.fn(),
    verifyLookAhead: vi.fn(),
    crewMarkLookAhead: vi.fn(),
  }
})

beforeEach(() => {
  current = told
  vi.mocked(loadSchedule).mockImplementation(() => Promise.resolve(readOf()))
  vi.mocked(saveScheduleMove).mockImplementation(() => Promise.resolve(readOf()))
  vi.mocked(pushBackLateNotice).mockImplementation(() => Promise.resolve(readOf()))
  vi.mocked(verifyLookAhead).mockImplementation(() => Promise.resolve(readOf()))
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
const open = (canMove = true) => render(<GcScheduleWindow state={s} project={fairOaks} by="Robert Douglas" canMove={canMove} onClose={vi.fn()} />)

describe('the office’s answers on the Schedule window (PR 14c)', () => {
  it('takes a notice through Why it moved, filled in with it, and saves the move naming it', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Take Wed Oct 14' }))
    const dialog = screen.getByRole('dialog', { name: 'Why it moved' })
    expect(within(dialog).getByRole('button', { name: 'Materials' }).getAttribute('aria-pressed')).toBe('true')
    expect((within(dialog).getByRole('textbox') as HTMLTextAreaElement).value).toBe(`Summit Roofing told us Fri Oct 2: ${NOTE}`)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the move' }))
    await waitFor(() => expect(saveScheduleMove).toHaveBeenCalledTimes(1))
    const [, projectId, press, move] = vi.mocked(saveScheduleMove).mock.calls[0]!
    expect(projectId).toBe('fairoaksd')
    expect(press.version).toBe(3)
    expect(move).toMatchObject({ lineId: 'froof-1', reason: 'materials', lateNoticeId: 'late-1', to: { start: '2026-09-21', finish: '2026-10-14' } })
  })

  it('says so when another move took the notice first: the card reads again and its row goes', async () => {
    vi.mocked(saveScheduleMove).mockImplementation(() => {
      current = takenElsewhere()
      return Promise.reject(new Error('That late notice was taken already.'))
    })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Take Wed Oct 14' }))
    const dialog = screen.getByRole('dialog', { name: 'Why it moved' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the move' }))
    expect(await within(dialog).findByText(NOTICE_ANSWERED_FIRST)).toBeTruthy()
    await waitFor(() => expect(document.querySelector('[data-late-notices]')).toBeNull())
    expect((within(dialog).getByRole('button', { name: 'Save the move' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('pushes back with a sentence, a record through the schedule’s io', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Push back' }))
    fireEvent.change(screen.getByPlaceholderText('We need the day as drawn. The next trade is booked that week.'), { target: { value: 'We need the roof dry by Oct 9.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send it to Summit Roofing' }))
    await waitFor(() => expect(pushBackLateNotice).toHaveBeenCalledWith(s, 'fairoaksd', 'late-1', 'We need the roof dry by Oct 9.'))
  })

  it('checks a trade’s mark, a record through the schedule’s io', async () => {
    open()
    const line = await found('[data-verify-line="froof-1"]')
    fireEvent.click(within(line).getByRole('button', { name: 'Right, done' }))
    await waitFor(() => expect(verifyLookAhead).toHaveBeenCalledTimes(1))
    const [, projectId, mark] = vi.mocked(verifyLookAhead).mock.calls[0]!
    expect(projectId).toBe('fairoaksd')
    expect(mark).toMatchObject({ lineId: 'froof-1', weekOf: '2026-09-28', verifiedOn: s.today })
  })

  it('shows neither card to someone who may not move a bar', async () => {
    open(false)
    await screen.findByText(/^Changes to the schedule/)
    expect(document.querySelector('[data-late-notices]')).toBeNull()
    expect(document.querySelector('[data-verify-card]')).toBeNull()
  })

  it('shows neither card in the what-if copy', async () => {
    current = { ...told, whatIf: whatIfCopy(told, 'Robert', s.today)! }
    open()
    await found('[data-late-notices]')
    fireEvent.click(await screen.findByRole('button', { name: 'What if · 0' }))
    await screen.findByText('Tried in the what-if')
    expect(document.querySelector('[data-late-notices]')).toBeNull()
    expect(document.querySelector('[data-verify-card]')).toBeNull()
  })
})
