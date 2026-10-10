// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 8a: the move's window and the record of moves on main's test state.
 * A move saves only with a reason and a sentence, Cancel saves nothing, a save someone else beat stays open with the
 * person's words and says what changed (G-134), and the record lists each move with Undo and Redo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcMoveExplain, GcMoveHistory, type PendingMove } from './GcScheduleMoves'
import { addDays } from '../../lib/gc/building'
import { moveRecord, planMove, undoMove } from '../../lib/gc/schedule/moves'
import { partMoveOf, splitParts } from '../../lib/gc/schedule/splitBars'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { SCHEDULE_CHANGED } from '../../lib/gc/schedule/versionRefusal'
import { WHAT_IF_NO_WHY } from '../../lib/gc/schedule/whatIf'
import { plainWordsFailures } from '../../lib/plainWords'
import type { ScheduleActivity, ScheduleMove } from '../../lib/gc/schedule/types'
import type { GcProject } from '../../lib/gc/types'
import { checkSupabaseError } from '../../utils/errorHandling'

afterEach(cleanup)

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const tpo = fairOaks.schedule!.activities.find((a) => a.lineId === 'froof-1')!
/** TPO membrane a week later, as a drag leaves it. */
const weekLater: PendingMove = { lineId: tpo.lineId, start: addDays(tpo.start, 7), finish: addDays(tpo.finish, 7), after: tpo.after }

/** `gc_schedule_bump`'s refusal as the io throws it: the phrase, and the change saved since. */
function refusal(): unknown {
  const details = JSON.stringify({ read: 3, version: 4, changes: [{ version: 4, at: '2026-11-02T20:14:00+00:00', by: null, name: 'Ann', words: 'Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30. Ann: The fixtures ship a week late.' }] })
  try {
    checkSupabaseError({ data: null, status: 400, error: { code: 'P0001', message: SCHEDULE_CHANGED, details, hint: null } }, 'save the move')
  } catch (e) {
    return e
  }
  throw new Error('no refusal')
}

function explain(over: { project?: GcProject; onSave?: ReturnType<typeof vi.fn>; onReload?: ReturnType<typeof vi.fn>; onClose?: ReturnType<typeof vi.fn> } = {}) {
  const onSave = over.onSave ?? vi.fn(() => Promise.resolve())
  const onReload = over.onReload ?? vi.fn()
  const onClose = over.onClose ?? vi.fn()
  const view = render(<GcMoveExplain state={s} project={over.project ?? fairOaks} pending={weekLater} by="Robert" today={s.today} onSave={onSave} onReload={onReload} onClose={onClose} />)
  const dialog = () => screen.getByRole('dialog', { name: 'Why it moved' })
  const save = () => within(dialog()).getByRole('button', { name: /Save the move|Saving/ })
  const why = () => {
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Weather' }))
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'Rain kept the roof open a week.' } })
  }
  return { ...view, onSave, onReload, onClose, dialog, save, why }
}

describe('the window a move is saved from', () => {
  it('says what the move does, and saves only with a reason and a sentence', async () => {
    const { dialog, save, why, onSave, onClose } = explain()
    expect(within(dialog()).getByRole('heading').textContent).toBe('Move Roofing · TPO membrane')
    expect(dialog().textContent).toContain('Mon Sep 28 to Fri Oct 16')
    expect((save() as HTMLButtonElement).disabled).toBe(true)
    why()
    expect((save() as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSave).toHaveBeenCalledTimes(1)
    const [move, activities, words] = onSave.mock.calls[0]!
    expect(move).toMatchObject({ lineId: 'froof-1', by: 'Robert', reason: 'weather', note: 'Rain kept the roof open a week.', to: { start: '2026-09-28', finish: '2026-10-16' } })
    expect((activities as { lineId: string; start: string }[]).find((a) => a.lineId === 'froof-1')?.start).toBe('2026-09-28')
    expect(words).toMatch(/^Roofing · TPO membrane now runs Mon Sep 28 to Fri Oct 16\..* Robert: Rain kept the roof open a week\.$/)
  })

  it('Cancel saves nothing', () => {
    const { dialog, onSave, onClose } = explain()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('stays open when someone saved first, says what they changed, reads again, and saves on the next press with the words kept', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(refusal()).mockResolvedValueOnce(undefined)
    const { dialog, save, why, onReload, onClose } = explain({ onSave })
    why()
    fireEvent.click(save())
    const alert = await within(dialog()).findByRole('alert')
    expect(alert.textContent).toContain(SCHEDULE_CHANGED)
    expect(alert.textContent).toContain('2:14 pm Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30. Ann: The fixtures ship a week late.')
    expect(alert.textContent).toContain('Your move was not saved. The chart shows the new dates now. Try it again on them.')
    expect(onReload).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    // The reason and the words are still there: one press saves it on the dates read again.
    expect((within(dialog()).getByRole('textbox') as HTMLTextAreaElement).value).toBe('Rain kept the roof open a week.')
    expect(within(dialog()).getByRole('button', { name: 'Weather' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(save())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('says any other failure in its words and reads nothing again', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('The network is down.'))
    const { dialog, save, why, onReload, onClose } = explain({ onSave })
    why()
    fireEvent.click(save())
    expect((await within(dialog()).findByRole('alert')).textContent).toContain('The network is down.')
    expect(onReload).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('the record of moves', () => {
  /** Fair Oaks D with TPO membrane moved a week later, the move on its record, as the database reads it back. */
  function moved(): GcProject {
    const schedule = fairOaks.schedule!
    const plan = planMove(fairOaks, tpo.lineId, weekLater.start, weekLater.finish)!
    const move = { ...moveRecord(schedule, tpo.lineId, plan, { reason: 'weather', note: 'Rain kept the roof open a week.', by: 'Robert' }, s.today), id: 'move-row-1' }
    return { ...fairOaks, schedule: { ...schedule, activities: plan.activities, moves: [move, ...(schedule.moves ?? [])] } }
  }

  it('starts empty, saying how a bar moves: dragged, or changed in its form (8b)', () => {
    const empty = { ...fairOaks, schedule: { ...fairOaks.schedule!, moves: [] } }
    render(<GcMoveHistory project={empty} />)
    expect(screen.getByText('None yet. Drag a bar on the chart, or press one to change its dates. Every move is kept here with who made it and why.')).toBeTruthy()
  })

  it('lists a move with who, why and their words, and Undo sends that move', () => {
    const onUndo = vi.fn()
    render(<GcMoveHistory project={moved()} onUndo={onUndo} onRedo={vi.fn()} />)
    expect(screen.getByText('“Rain kept the roof open a week.”')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalledWith(expect.objectContaining({ id: 'move-row-1', lineId: 'froof-1' }))
    expect(screen.queryByRole('button', { name: 'Redo' })).toBeNull()
  })

  it('offers Redo on the move just undone', () => {
    const project = moved()
    const back = undoMove(project, 'move-row-1', 'Robert', s.today)!
    const onRedo = vi.fn()
    render(<GcMoveHistory project={{ ...project, schedule: back }} onUndo={vi.fn()} onRedo={onRedo} />)
    expect(screen.getByText('undone')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(onRedo).toHaveBeenCalledWith(expect.objectContaining({ id: 'move-row-1' }))
  })

  it('is the record only for someone who may not move a bar', () => {
    render(<GcMoveHistory project={moved()} />)
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('says what someone else changed when an undo was refused', () => {
    render(<GcMoveHistory project={moved()} onUndo={vi.fn()} onRedo={vi.fn()} refused={[{ version: 4, at: '2026-11-02T20:14:00+00:00', by: null, name: 'Ann', words: 'Ann undid a move.' }]} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain(SCHEDULE_CHANGED)
    expect(alert.textContent).toContain('Nothing was undone or put back. The chart shows the new dates now.')
  })
})

describe('a part of a split line moved (PR 8b)', () => {
  it('says the part’s days and what its line does, and saves the move with the parts’ days', async () => {
    const made = splitParts(tpo, [{ name: 'East half', start: tpo.start, finish: '2026-09-30' }, { name: 'West half', start: '2026-10-01', finish: tpo.finish }], 50)
    if (!('parts' in made)) throw new Error(made.problem)
    const split = { ...fairOaks, schedule: { ...fairOaks.schedule!, activities: fairOaks.schedule!.activities.map((a) => (a.lineId === 'froof-1' ? { ...a, parts: made.parts } : a)) } }
    const line = split.schedule.activities.find((a) => a.lineId === 'froof-1')!
    const pending = partMoveOf(line, 'froof-1-p2', '2026-10-02', '2026-10-09')!
    const onSave = vi.fn(() => Promise.resolve())
    const onClose = vi.fn()
    render(<GcMoveExplain state={s} project={split} pending={pending} by="Robert" today={s.today} onSave={onSave} onReload={vi.fn()} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Why it moved' })
    expect(within(dialog).getByRole('heading').textContent).toBe('Move Roofing · TPO membrane, West half')
    expect(dialog.querySelector('[data-gc-part-line]')?.textContent).toBe('TPO membrane keeps its dates, Sep 21 to Oct 9. Nothing after it moves.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Weather' }))
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Rain on the west side.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the move' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const [move, , words] = onSave.mock.calls[0]! as unknown as [{ parts?: { id: string } }, unknown, string]
    expect(move.parts?.id).toBe('froof-1-p2')
    expect(words).toBe('Roofing · TPO membrane, West half now runs Fri Oct 2 to Fri Oct 9. Robert: Rain on the west side.')
  })
})

describe('in the what-if copy (PR 11): trying', () => {
  it('tries a move with no reason, marked as none yet, and says so in plain words', async () => {
    const onSave = vi.fn((_move: ScheduleMove, _activities: ScheduleActivity[], _words: string) => Promise.resolve())
    const onClose = vi.fn()
    render(<GcMoveExplain state={s} project={fairOaks} pending={weekLater} by="Robert" today={s.today} onSave={onSave} onReload={vi.fn()} onClose={onClose} trying />)
    const dialog = screen.getByRole('dialog', { name: 'Why it moved' })
    expect(within(dialog).getByRole('heading').textContent).toBe('Try moving Roofing · TPO membrane')
    const said = ['In the what-if, a reason is optional. Keep asks for one.', 'Tried with no reason yet, on the copy only.']
    for (const words of said) expect(dialog.textContent).toContain(words)
    for (const words of [...said, 'Tried with its reason, on the copy only.']) expect(plainWordsFailures(words), words).toEqual([])
    const tryIt = within(dialog).getByRole('button', { name: 'Try it' }) as HTMLButtonElement
    expect(tryIt.disabled).toBe(false)
    fireEvent.click(tryIt)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSave.mock.calls[0]![0]).toMatchObject({ lineId: 'froof-1', reason: WHAT_IF_NO_WHY.reason, note: WHAT_IF_NO_WHY.note, noWhy: true })
  })

  it('tries a move with its reason when one is given whole', async () => {
    const onSave = vi.fn((_move: ScheduleMove, _activities: ScheduleActivity[], _words: string) => Promise.resolve())
    render(<GcMoveExplain state={s} project={fairOaks} pending={weekLater} by="Robert" today={s.today} onSave={onSave} onReload={vi.fn()} onClose={vi.fn()} trying />)
    const dialog = screen.getByRole('dialog', { name: 'Why it moved' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Weather' }))
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Rain kept the roof open a week.' } })
    expect(dialog.textContent).toContain('Tried with its reason, on the copy only.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try it' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const move = onSave.mock.calls[0]![0]
    expect([move.reason, move.note, move.noWhy]).toEqual(['weather', 'Rain kept the roof open a week.', undefined])
  })

  it('the copy’s record says what was tried, and how to keep it', () => {
    const { container } = render(<GcMoveHistory project={fairOaks} trying />)
    expect(container.textContent).toBe('Tried in the what-if Nothing tried yet. Drag a bar on the chart, or press one to change its dates.')
    cleanup()
    const plan = planMove(fairOaks, 'froof-1', weekLater.start, weekLater.finish)!
    const move = { ...moveRecord(fairOaks.schedule!, 'froof-1', plan, { ...WHAT_IF_NO_WHY, by: 'Robert' }, s.today), noWhy: true }
    const tried = { ...fairOaks, schedule: { ...fairOaks.schedule!, activities: plan.activities, moves: [move] } }
    render(<GcMoveHistory project={tried} onUndo={vi.fn()} onRedo={vi.fn()} trying />)
    expect(screen.getByText('Tried in the what-if (1)')).toBeTruthy()
    expect(screen.getByText('Every move tried on the copy, newest first. Keep puts them on the real schedule.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
  })
})
