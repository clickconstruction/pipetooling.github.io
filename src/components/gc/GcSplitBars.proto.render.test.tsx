// @vitest-environment jsdom
/**
 * Render smoke for one line as several bars (G-39, `to-dos/gc-mode/mockups/G-39.md`): the card
 * under the opened activity splits a line and makes it one bar again, the split window says why it
 * cannot split yet, the chart draws a row per part under its line with a fold, a part's move goes
 * through Why it moved, and the portal, our crew's card and the walk read the parts.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcPartsCard, GcPortalPartRows } from './GcSplitBars.proto'
import { GcGantt } from './GcGantt'
import { GcMoveExplain } from './GcScheduleMoves.proto'
import { GcBuildingCrewCard } from './GcBuildingCrew'
import { GcScheduleWalk } from './GcScheduleWalk'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { partMoveOf } from '../../lib/gcMode/gcSplitBars'
import type { GcAction, GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

const ID = 'fairoaksd'
const LIGHTING = 'felec-3'
const play = (state: GcState, ...actions: GcAction[]) => actions.reduce((s, a) => gcReducer(s, a), state)
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const act = (s: GcState, lineId: string) => job(s).schedule!.activities.find((a) => a.lineId === lineId)!
const s0 = initialGcState()
const SPLIT: GcAction = {
  type: 'splitActivity',
  projectId: ID,
  lineId: LIGHTING,
  parts: [
    { name: 'Sales floor', start: '2026-09-14', finish: '2026-10-09' },
    { name: 'Back of house', start: '2026-10-10', finish: '2026-10-23' },
  ],
  by: 'Robert',
}
const s1 = play(s0, SPLIT, { type: 'tradeReportPart', projectId: ID, packageId: 'felec', sovId: LIGHTING, partId: 'felec-3-p1', pct: 60 })

describe('Parts of this line', () => {
  it('on one bar, says how to split it, and the window splits it with the shares from the days', () => {
    const dispatch = vi.fn()
    render(<GcPartsCard project={job(s0)} activity={act(s0, LIGHTING)} pct={40} by="Robert" dispatch={dispatch} onMovePart={() => undefined} />)
    expect(screen.getByText('Lighting is one bar. Split it when the work goes in parts, a floor or an area at a time.')).toBeTruthy()
    fireEvent.click(screen.getByText('Split into parts…'))
    const win = screen.getByRole('dialog', { name: 'Split Lighting into parts' })
    expect(within(win).getByText("Each part gets its own bar. The line's dates and its 40% stay.")).toBeTruthy()
    expect((within(win).getByLabelText("Part 1's name") as HTMLInputElement).value).toBe('Part 1')
    expect((within(win).getByLabelText('Part 2 starts') as HTMLInputElement).value).toBe('2026-10-04')
    expect(within(win).getAllByText('50%').length).toBe(2)
    // The last part must end with the line: changing its finish says why, and Split it waits.
    fireEvent.change(within(win).getByLabelText('Part 2 finishes'), { target: { value: '2026-10-20' } })
    expect(within(win).getByText('The first part starts Mon Sep 14 and the last ends Fri Oct 23, as the line does. Move a part after the split to change that.')).toBeTruthy()
    expect((within(win).getByText('Split it').closest('button') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(win).getByLabelText('Part 2 finishes'), { target: { value: '2026-10-23' } })
    fireEvent.change(within(win).getByLabelText("Part 1's name"), { target: { value: 'Sales floor' } })
    fireEvent.change(within(win).getByLabelText("Part 2's name"), { target: { value: 'Back of house' } })
    fireEvent.change(within(win).getByLabelText('Part 1 finishes'), { target: { value: '2026-10-09' } })
    fireEvent.change(within(win).getByLabelText('Part 2 starts'), { target: { value: '2026-10-10' } })
    expect(within(win).getByText('65%')).toBeTruthy()
    expect(within(win).getByText('35%')).toBeTruthy()
    fireEvent.click(within(win).getByText('Split it'))
    expect(dispatch).toHaveBeenCalledWith(SPLIT)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a third part can be added and taken out again', () => {
    render(<GcPartsCard project={job(s0)} activity={act(s0, LIGHTING)} pct={40} by="Robert" dispatch={() => undefined} onMovePart={() => undefined} />)
    fireEvent.click(screen.getByText('Split into parts…'))
    fireEvent.click(screen.getByText('+ Another part'))
    expect((screen.getByLabelText("Part 3's name") as HTMLInputElement).value).toBe('Part 3')
    fireEvent.click(screen.getByLabelText('Take out part 3'))
    expect(screen.queryByLabelText("Part 3's name")).toBeNull()
  })

  it('on a split line, lists the parts, sends a part to Why it moved, and makes it one bar after a word', () => {
    const dispatch = vi.fn()
    const onMovePart = vi.fn()
    render(<GcPartsCard project={job(s1)} activity={act(s1, LIGHTING)} pct={53} by="Robert" dispatch={dispatch} onMovePart={onMovePart} />)
    const table = screen.getByRole('table', { name: 'The parts of Lighting' })
    expect(within(table).getAllByRole('row').map((r) => r.textContent)).toEqual(['Sales floorSep 14 to Oct 965% of the work60% done', 'Back of houseOct 10 to Oct 2335% of the work40% done'])
    expect(screen.getByText('Lighting is 53% done, the parts by their share.')).toBeTruthy()
    fireEvent.click(screen.getByText("Change a part's dates…"))
    fireEvent.change(screen.getByLabelText('Which part'), { target: { value: 'felec-3-p2' } })
    fireEvent.change(screen.getByLabelText('Back of house starts'), { target: { value: '2026-10-17' } })
    fireEvent.change(screen.getByLabelText('Back of house finishes'), { target: { value: '2026-10-30' } })
    fireEvent.click(screen.getByText('Save, and say why'))
    expect(onMovePart).toHaveBeenCalledWith(partMoveOf(act(s1, LIGHTING), 'felec-3-p2', '2026-10-17', '2026-10-30'))
    fireEvent.click(screen.getByText('Make it one bar'))
    expect(screen.getByText('The parts go. Lighting keeps its 53% and its dates.')).toBeTruthy()
    fireEvent.click(screen.getByText('Make it one bar'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'joinActivity', projectId: ID, lineId: LIGHTING, by: 'Robert' })
  })

  it('in a what-if copy, a part can be tried but a split is made on the real schedule', () => {
    render(<GcPartsCard project={job(s0)} activity={act(s0, LIGHTING)} pct={40} by="Robert" dispatch={() => undefined} onMovePart={() => undefined} tryIt />)
    expect(screen.queryByText('Split into parts…')).toBeNull()
    expect(screen.getByText('A split is made on the real schedule, not in the what-if.')).toBeTruthy()
    cleanup()
    render(<GcPartsCard project={job(s1)} activity={act(s1, LIGHTING)} pct={53} by="Robert" dispatch={() => undefined} onMovePart={() => undefined} tryIt />)
    expect(screen.queryByText('Make it one bar')).toBeNull()
    fireEvent.click(screen.getByText("Change a part's dates…"))
    expect(screen.getByText('Try it…')).toBeTruthy()
  })

  it('opens under the activity pressed on the chart', () => {
    render(<GcBuildingScheduleTab state={s1} project={job(s1)} dispatch={() => undefined} />)
    fireEvent.click(screen.getByText('Lighting', { selector: 'button' }))
    expect(screen.getByText('Lighting is 53% done, the parts by their share.')).toBeTruthy()
  })
})

describe('the chart', () => {
  function chart(s: GcState, onMovePart = vi.fn()) {
    const m = scheduleMeasures(s, job(s))
    const view = render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={new Map()} today={s.today} building picked={null} onPick={() => undefined} onMove={() => undefined} onMovePart={onMovePart} />)
    return { ...view, parts: () => [...view.container.querySelectorAll('[data-gantt-part]')].map((b) => b.getAttribute('data-gantt-part')) }
  }

  it('draws a row for each part under its line, unfolded, with its words and pill, and a caret folds them', () => {
    const { parts } = chart(s1)
    expect(parts()).toEqual(['felec-3:felec-3-p1', 'felec-3:felec-3-p2'])
    const row = (key: string) => document.querySelector(`[data-gantt-part-row="${key}"]`)!
    expect(row('felec-3:felec-3-p1').textContent).toContain('Sales floor60% · plan 73%behind')
    expect(row('felec-3:felec-3-p2').textContent).toContain('Back of house40%starts Oct 10')
    // No links start or end at a part: the bars the links and the arrow keys read are the lines'.
    expect(document.querySelector('[data-gantt-bar="felec-3-p1"]')).toBeNull()
    expect(screen.getByText(/a part of a split line, under its line/)).toBeTruthy()
    const caret = screen.getByLabelText('Fold the parts of Lighting')
    expect(caret.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(caret)
    expect(parts()).toEqual([])
    fireEvent.click(screen.getByLabelText('Show the parts of Lighting'))
    expect(parts()).toHaveLength(2)
  })

  it('a line not split has no caret and no part rows', () => {
    const { parts } = chart(s0)
    expect(parts()).toEqual([])
    expect(screen.queryByLabelText('Fold the parts of Lighting')).toBeNull()
  })
})

describe('Why it moved, for a part', () => {
  it("names the part, shows its dates and what the line's span does, and saves the part's move with its reason", () => {
    const dispatch = vi.fn()
    const pending = partMoveOf(act(s1, LIGHTING), 'felec-3-p2', '2026-10-17', '2026-10-30')!
    render(<GcMoveExplain state={s1} project={job(s1)} pending={pending} dispatch={dispatch} onClose={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Move Electrical · Lighting, Back of house' })).toBeTruthy()
    expect(screen.getByText('7 days later')).toBeTruthy()
    expect(document.querySelector('[data-gc-part-line]')?.textContent).toBe('Lighting now ends Fri Oct 30.')
    fireEvent.click(screen.getByText('Crew'))
    fireEvent.change(screen.getByLabelText('What happened, in your words'), { target: { value: 'Pecan Valley is short a crew on the back of house.' } })
    fireEvent.click(screen.getByText('Save the move'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'moveActivityPart', projectId: ID, lineId: LIGHTING, partId: 'felec-3-p2', start: '2026-10-17', finish: '2026-10-30', why: { reason: 'crew', note: 'Pecan Valley is short a crew on the back of house.', by: 'The office' } })
  })

  it('a part moved inside its line still opens the window, and the line keeps its dates', () => {
    const pending = partMoveOf(act(s1, LIGHTING), 'felec-3-p1', '2026-09-14', '2026-10-12')!
    render(<GcMoveExplain state={s1} project={job(s1)} pending={pending} dispatch={() => undefined} onClose={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Move Electrical · Lighting, Sales floor' })).toBeTruthy()
    expect(document.querySelector('[data-gc-part-line]')?.textContent).toBe('Lighting keeps its dates, Sep 14 to Oct 23. Nothing after it moves.')
  })
})

describe('reporting a part', () => {
  it("the portal shows the line's percent and a picker per part, none taking the line under what is billed", () => {
    // Panels and feeders: 80% reported, 50% billed.
    const s = play(s0, { type: 'splitActivity', projectId: ID, lineId: 'felec-2', parts: [{ name: 'Panels', start: '2026-09-14', finish: '2026-09-23' }, { name: 'Feeders', start: '2026-09-24', finish: '2026-10-02' }], by: 'Robert' })
    const dispatch = vi.fn()
    const line = job(s).packages.find((k) => k.id === 'felec')!.sow!.sov.find((l) => l.id === 'felec-2')!
    render(<GcPortalPartRows line={line} activity={act(s, 'felec-2')} ids={{ projectId: ID, packageId: 'felec' }} dispatch={dispatch} />)
    expect(screen.getByText('80% done', { selector: 'strong' })).toBeTruthy()
    const panels = screen.getByLabelText('Percent done, Panels and feeders, Panels') as HTMLSelectElement
    expect([...panels.options].map((o) => o.value)).toEqual(['30', '40', '50', '60', '70', '80', '90', '100'])
    fireEvent.change(panels, { target: { value: '90' } })
    expect(dispatch).toHaveBeenCalledWith({ type: 'tradeReportPart', projectId: ID, packageId: 'felec', sovId: 'felec-2', partId: 'felec-2-p1', pct: 90 })
  })

  it("our own crew's card reports a split stage a part at a time", () => {
    const s = play(s0, { type: 'splitActivity', projectId: ID, lineId: 'fplumb-3', parts: [{ name: 'Restrooms', start: '2026-09-28', finish: '2026-10-03' }, { name: 'Tenant bays', start: '2026-10-04', finish: '2026-10-09' }], by: 'Robert' })
    const dispatch = vi.fn()
    render(<GcBuildingCrewCard project={job(s)} pkg={job(s).packages.find((k) => k.id === 'fplumb')!} dispatch={dispatch} />)
    expect(screen.queryByLabelText("Our own crew's percent done on Top out")).toBeNull()
    fireEvent.change(screen.getByLabelText(/Our own crew's percent done on Top out · .*, Restrooms/), { target: { value: '100' } })
    expect(dispatch).toHaveBeenCalledWith({ type: 'selfReportPart', projectId: ID, packageId: 'fplumb', lineId: 'fplumb-3', partId: 'fplumb-3-p1', pct: 100 })
  })

  it("the walk lists a split bar's parts under its facts", () => {
    render(<GcScheduleWalk state={s1} project={job(s1)} holds={new Map()} dispatch={() => undefined} onClose={() => undefined} />)
    for (let i = 0; i < 12 && !screen.queryByRole('heading', { name: 'Electrical · Lighting' }); i += 1) fireEvent.click(screen.getByText('Yes, keep it'))
    expect(screen.getByRole('heading', { name: 'Electrical · Lighting' })).toBeTruthy()
    expect([...document.querySelectorAll('[data-gc-walk-parts] li')].map((li) => li.textContent)).toEqual(['Sales floor: 60%, plan 73%. Started Fri Oct 2.', 'Back of house: 40%, starts Sat Oct 10.'])
  })
})
