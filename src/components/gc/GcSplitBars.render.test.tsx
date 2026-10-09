// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 9b: one line as several bars (G-39) on main's test state. The parts card
 * splits a line through its window with the parts and the log's line, hands a part's new dates to the move window, and
 * makes a split line one bar again; a split someone else beat keeps the window open and reads again.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcPartsCard } from './GcSplitBars'
import { splitParts } from '../../lib/gc/schedule/splitBars'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { ActivityPart, ScheduleActivity } from '../../lib/gc/schedule/types'
import { SCHEDULE_CHANGED } from '../../lib/gc/schedule/versionRefusal'
import { checkSupabaseError } from '../../utils/errorHandling'

afterEach(cleanup)

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const tpo = fairOaks.schedule!.activities.find((a) => a.lineId === 'froof-1')!

function refusal(): unknown {
  const details = JSON.stringify({ read: 3, version: 4, changes: [{ version: 4, at: '2026-11-02T20:14:00+00:00', by: null, name: 'Ann', words: 'Ann moved Lighting.' }] })
  try {
    checkSupabaseError({ data: null, status: 400, error: { code: 'P0001', message: SCHEDULE_CHANGED, details, hint: null } }, 'split the bar')
  } catch (e) {
    return e
  }
  throw new Error('no refusal')
}

/** TPO membrane in two parts, as a split leaves it. */
function splitTpo(): ScheduleActivity {
  const made = splitParts(tpo, [{ name: 'East half', start: tpo.start, finish: '2026-09-30' }, { name: 'West half', start: '2026-10-01', finish: tpo.finish }], 50)
  if (!('parts' in made)) throw new Error(made.problem)
  return { ...tpo, parts: made.parts }
}

function card(activity: ScheduleActivity, over: { onSplit?: ReturnType<typeof vi.fn>; onReload?: ReturnType<typeof vi.fn> } = {}) {
  const onSplit = over.onSplit ?? vi.fn((_parts: ActivityPart[], _words: string) => Promise.resolve())
  const onJoin = vi.fn((_words: string) => Promise.resolve())
  const onMovePart = vi.fn()
  const project = { ...fairOaks, schedule: { ...fairOaks.schedule!, activities: fairOaks.schedule!.activities.map((a) => (a.lineId === activity.lineId ? activity : a)) } }
  render(<GcPartsCard project={project} activity={activity} pct={50} by="Robert" onSplit={onSplit} onJoin={onJoin} onMovePart={onMovePart} {...(over.onReload ? { onReload: over.onReload } : {})} />)
  return { onSplit, onJoin, onMovePart, project }
}

describe('a line in parts (PR 9b)', () => {
  it('splits a line through its window, with the parts and the log’s line, and the window closes', async () => {
    const { onSplit, project } = card(tpo)
    fireEvent.click(screen.getByRole('button', { name: 'Split into parts…' }))
    const dialog = screen.getByRole('dialog', { name: /^Split .* into parts$/ })
    fireEvent.change(within(dialog).getByLabelText("Part 1's name"), { target: { value: 'East half' } })
    fireEvent.change(within(dialog).getByLabelText("Part 2's name"), { target: { value: 'West half' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Split it' }))
    await waitFor(() => expect(onSplit).toHaveBeenCalledTimes(1))
    const [parts, words] = onSplit.mock.calls[0]!
    expect((parts as ActivityPart[]).map((p) => p.name)).toEqual(['East half', 'West half'])
    expect(words).toBe(`Robert split Roofing · TPO membrane on ${project.name} into 2 parts: East half, West half.`)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps the window open when someone saved first, says what they changed, and reads again', async () => {
    const onReload = vi.fn()
    card(tpo, { onSplit: vi.fn().mockRejectedValueOnce(refusal()), onReload })
    fireEvent.click(screen.getByRole('button', { name: 'Split into parts…' }))
    const dialog = screen.getByRole('dialog', { name: /^Split .* into parts$/ })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Split it' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain(SCHEDULE_CHANGED)
    expect(onReload).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog', { name: /^Split .* into parts$/ })).toBeTruthy()
  })

  it('hands a part’s new dates to the move window, and makes a split line one bar again with the log’s line', async () => {
    const { onMovePart, onJoin, project } = card(splitTpo())
    fireEvent.click(screen.getByRole('button', { name: "Change a part's dates…" }))
    fireEvent.change(screen.getByLabelText('Which part'), { target: { value: 'froof-1-p2' } })
    fireEvent.change(screen.getByLabelText('West half starts'), { target: { value: '2026-10-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save, and say why' }))
    expect(onMovePart).toHaveBeenCalledWith(expect.objectContaining({ lineId: 'froof-1', part: expect.objectContaining({ id: 'froof-1-p2' }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Make it one bar' }))
    expect(screen.getByText(/^The parts go\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Make it one bar' }))
    await waitFor(() => expect(onJoin).toHaveBeenCalledWith(`Robert made Roofing · TPO membrane on ${project.name} one bar again.`))
  })
})
