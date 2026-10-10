// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 11: the what-if copy's screen on main's test state (G-81). The way in and
 * out in its three looks, the line over the chart with Throw it away asked once, and the window Keep goes through: it
 * asks for each reason missing, says the kernel's refusal when the real schedule moved under the copy, hands the kernel's
 * answer to the save, and stays open to read again when someone else saved first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcWhatIfButton, GcWhatIfKeep, GcWhatIfLine } from './GcWhatIf'
import { addDays } from '../../lib/gc/building'
import { moveRecord, planMove } from '../../lib/gc/schedule/moves'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { SCHEDULE_CHANGED } from '../../lib/gc/schedule/versionRefusal'
import { WHAT_IF_NO_WHY, whatIfCopy, whatIfProject } from '../../lib/gc/schedule/whatIf'
import { tryInCopy } from '../../lib/gc/schedule/whatIfWindow'
import type { GcProject } from '../../lib/gc/types'
import { plainWordsFailures } from '../../lib/plainWords'
import { checkSupabaseError } from '../../utils/errorHandling'

afterEach(cleanup)

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const opened: GcProject = { ...fairOaks, whatIf: whatIfCopy(fairOaks, 'Robert', s.today)! }

/** A line moved `by` days on the copy: with a reason, or with none yet. */
function tried(project: GcProject, lineId: string, by: number, why: { reason: 'weather'; note: string } | null): GcProject {
  const onCopy = whatIfProject(project)!
  const a = onCopy.schedule!.activities.find((x) => x.lineId === lineId)!
  const plan = planMove(onCopy, lineId, addDays(a.start, by), addDays(a.finish, by))!
  const move = { ...moveRecord(onCopy.schedule!, lineId, plan, { ...(why ?? WHAT_IF_NO_WHY), by: 'Robert' }, s.today), ...(why ? {} : { noWhy: true }) }
  return { ...project, whatIf: tryInCopy(project, move, plan.activities)! }
}
/** TPO a few days later with a reason, then Rough-in plumbing with none. */
const twoTried = tried(tried(opened, 'froof-1', 3, { reason: 'weather', note: 'Rain on the deck.' }), 'fplumb-3', 2, null)

/** `gc_schedule_bump`'s refusal as the io throws it. */
function refusal(): unknown {
  const details = JSON.stringify({ read: 3, version: 4, changes: [{ version: 4, at: '2026-11-02T20:14:00+00:00', by: null, name: 'Ann', words: 'Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30.' }] })
  try {
    checkSupabaseError({ data: null, status: 400, error: { code: 'P0001', message: SCHEDULE_CHANGED, details, hint: null } }, 'keep the what-if')
  } catch (e) {
    return e
  }
  throw new Error('no refusal')
}

describe('GcWhatIfButton: the way in and out', () => {
  it('makes a copy, opens the one there is, or goes back to the real schedule', () => {
    const onStart = vi.fn()
    const onShow = vi.fn()
    const { rerender } = render(<GcWhatIfButton project={fairOaks} shown={false} busy={false} onStart={onStart} onShow={onShow} />)
    fireEvent.click(screen.getByRole('button', { name: 'What if…' }))
    expect(onStart).toHaveBeenCalledTimes(1)
    rerender(<GcWhatIfButton project={twoTried} shown={false} busy={false} onStart={onStart} onShow={onShow} />)
    fireEvent.click(screen.getByRole('button', { name: 'What if · 2' }))
    expect(onShow).toHaveBeenLastCalledWith(true)
    rerender(<GcWhatIfButton project={twoTried} shown busy={false} onStart={onStart} onShow={onShow} />)
    fireEvent.click(screen.getByRole('button', { name: 'See the real schedule' }))
    expect(onShow).toHaveBeenLastCalledWith(false)
    rerender(<GcWhatIfButton project={fairOaks} shown={false} busy onStart={onStart} onShow={onShow} />)
    expect((screen.getByRole('button', { name: 'What if…' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('GcWhatIfLine: over the chart while the copy is shown', () => {
  it('says what the copy does, with the money team’s bills only when handed in, and asks once before throwing it away', () => {
    const onThrowAway = vi.fn()
    const onKeep = vi.fn()
    const { rerender } = render(<GcWhatIfLine project={twoTried} bills={null} busy={false} problem={null} onKeep={onKeep} onThrowAway={onThrowAway} onReal={vi.fn()} />)
    const words = document.querySelector('[data-what-if-words]')!.textContent!
    expect(words).toMatch(/^A copy of the schedule to try moves on\. Nothing here reaches the trades or the customer\. 2 moves tried\. .* 1 move has no reason yet\.$/)
    expect(words).not.toContain('The bills')
    rerender(<GcWhatIfLine project={twoTried} bills="$4,000 of the Nov 1 bill moves to Dec 1." busy={false} problem={null} onKeep={onKeep} onThrowAway={onThrowAway} onReal={vi.fn()} />)
    expect(document.querySelector('[data-what-if-words]')!.textContent).toContain('The bills: $4,000 of the Nov 1 bill moves to Dec 1.')
    fireEvent.click(screen.getByRole('button', { name: 'Keep the 2 moves…' }))
    expect(onKeep).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Throw it away' }))
    expect(onThrowAway).not.toHaveBeenCalled()
    expect(screen.getByText('Throw away the copy and its 2 moves? The real schedule stays as it is.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Throw it away' }))
    expect(onThrowAway).toHaveBeenCalledTimes(1)
  })

  it('cannot keep a copy with nothing tried', () => {
    render(<GcWhatIfLine project={opened} bills={null} busy={false} problem={null} onKeep={vi.fn()} onThrowAway={vi.fn()} onReal={vi.fn()} />)
    expect((screen.getByRole('button', { name: 'Keep the moves…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[data-what-if-words]')!.textContent).toContain('Move a bar to try something.')
  })
})

describe('GcWhatIfKeep: the window Keep goes through', () => {
  const keep = (project: GcProject, over: { onKeep?: ReturnType<typeof vi.fn>; onReload?: ReturnType<typeof vi.fn>; onClose?: ReturnType<typeof vi.fn>; onThrowAway?: ReturnType<typeof vi.fn> } = {}) => {
    const onKeep = over.onKeep ?? vi.fn(() => Promise.resolve())
    const onReload = over.onReload ?? vi.fn()
    const onClose = over.onClose ?? vi.fn()
    const onThrowAway = over.onThrowAway ?? vi.fn()
    render(<GcWhatIfKeep project={project} by="Robert" today={s.today} onKeep={onKeep} onThrowAway={onThrowAway} onReload={onReload} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Keep the what-if' })
    return { onKeep, onReload, onClose, onThrowAway, dialog, press: () => within(dialog).getByRole('button', { name: /^Keep the 2 moves$|Keeping/ }) as HTMLButtonElement }
  }

  it('lists the moves oldest first, asks for each reason missing, then hands the kernel’s answer over', async () => {
    const { onKeep, onClose, dialog, press } = keep(twoTried)
    expect([...dialog.querySelectorAll('[data-keep-move]')].map((li) => li.getAttribute('data-keep-move'))).toEqual(['move-1', 'move-2'])
    expect(dialog.querySelector('[data-keep-problem]')!.textContent).toBe('Give each move a reason and a sentence.')
    expect(press().disabled).toBe(true)
    const group = within(dialog).getByRole('group', { name: /^Why it moved: / })
    fireEvent.click(within(group).getByRole('button', { name: 'Crew' }))
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Plumbing waits on the roof crew.' } })
    expect(dialog.querySelector('[data-keep-problem]')!.textContent).toBe('Kept as moves by Robert, today. Undo takes them off one at a time.')
    fireEvent.click(press())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const kept = onKeep.mock.calls[0]![0] as { kept: { lineId: string; reason: string; note: string; fromWhatIf?: string }[] }
    expect(kept.kept.map((m) => [m.lineId, m.reason, m.note, m.fromWhatIf])).toEqual([
      ['froof-1', 'weather', 'Rain on the deck.', s.today],
      ['fplumb-3', 'crew', 'Plumbing waits on the roof crew.', s.today],
    ])
    for (const words of ['These moves go on the real schedule, oldest first, each with its reason.', 'Kept as moves by Robert, today. Undo takes them off one at a time.', 'Nothing was kept. The chart shows the new dates now. Press Keep again if the copy still holds.']) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })

  it('says the real schedule moved under the copy in the kernel’s words, with Throw it away beside them', () => {
    const real = twoTried.schedule!
    const moved = { ...twoTried, schedule: { ...real, activities: real.activities.map((a) => (a.lineId === 'felec-3' ? { ...a, start: addDays(a.start, 2), finish: addDays(a.finish, 2) } : a)) } }
    const { dialog, onKeep, onThrowAway, press } = keep(moved)
    expect(dialog.querySelector('[data-keep-problem]')!.textContent).toMatch(/^The real schedule changed since this copy was made\. .+ moved there\. Throw this copy away and make a new one\.$/)
    expect(press().disabled).toBe(true)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Throw it away' }))
    expect(onThrowAway).toHaveBeenCalled()
    expect(onKeep).not.toHaveBeenCalled()
  })

  it('stays open and reads again when someone saved first, then keeps on the next press', async () => {
    const reason = { reason: 'weather' as const, note: 'Rain on the deck.' }
    const both = tried(tried(opened, 'froof-1', 3, reason), 'fplumb-3', 2, reason)
    const onKeep = vi.fn().mockRejectedValueOnce(refusal()).mockResolvedValueOnce(undefined)
    const { onReload, onClose, dialog, press } = keep(both, { onKeep })
    fireEvent.click(press())
    await waitFor(() => expect(onReload).toHaveBeenCalled())
    expect(dialog.textContent).toContain('Nothing was kept. The chart shows the new dates now. Press Keep again if the copy still holds.')
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(press())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onKeep).toHaveBeenCalledTimes(2)
  })
})
