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
import { initialGcState } from '../../lib/gc/schedule/testState'
import { SCHEDULE_CHANGED } from '../../lib/gc/schedule/versionRefusal'
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

  it('starts empty, saying how a bar moves', () => {
    const empty = { ...fairOaks, schedule: { ...fairOaks.schedule!, moves: [] } }
    render(<GcMoveHistory project={empty} />)
    expect(screen.getByText('None yet. Drag a bar on the chart. Every move is kept here with who made it and why.')).toBeTruthy()
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
