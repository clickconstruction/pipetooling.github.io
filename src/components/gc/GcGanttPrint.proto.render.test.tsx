// @vitest-environment jsdom
/**
 * Render smoke for Print or PDF from the prototype's Schedule tab (the Gantt's G-21,
 * `to-dos/gc-mode/mockups/G-21.md`): the paper takes the holds the tab's chart is given, and the
 * Projected finish measure's late lines on our team's paper. The chart's own tests moved to main with
 * the schedule's PR 7a (#5017) and are `GcGanttPrint.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import type { GcState, ScheduleMoveReason } from '../../lib/gcMode/gcTypes'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const dialog = () => screen.getByRole('dialog', { name: 'Print the chart' })
const framed = () => dialog().querySelector('iframe')?.getAttribute('srcdoc') ?? ''

describe('the paper takes the holds the chart is given (G-21 after G-77)', () => {
  it('prints Site lighting and Fire alarm as the Schedule tab’s chart shows them: held, by Pecan Valley’s papers', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')!
    render(<GcBuildingScheduleTab state={state} project={project} dispatch={vi.fn()} />)
    const toolbar = document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement
    // What the chart says beside each bar: the note drawn after it (barNote, from the tab's holds).
    const onChart = (label: string) => {
      const name = [...document.querySelectorAll('[data-gantt-scroller] button')].find((b) => b.textContent?.trim() === label && !b.hasAttribute('data-gantt-bar'))
      const lane = name?.parentElement?.parentElement?.children[1]
      return [...(lane?.querySelectorAll('span') ?? [])].find((sp) => (sp as HTMLElement).style.whiteSpace === 'nowrap')?.textContent ?? ''
    }
    const site = onChart('Site lighting')
    const fire = onChart('Fire alarm')
    expect(site).toBe('waits on current insurance, theirs ran out Sep 15')
    expect(fire).toBe('waits on current insurance and submittal 28 31 11-01')
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Print or PDF' }))
    const paper = new DOMParser().parseFromString(framed(), 'text/html')
    const texts = [...paper.querySelectorAll('svg.chart text')].map((t) => t.textContent ?? '')
    for (const [label, note] of [['Site lighting', site], ['Fire alarm', fire]] as const) {
      const at = texts.indexOf(label)
      expect(at).toBeGreaterThan(-1)
      expect(texts.slice(at, at + 5)).toContain('held')
      expect(texts).toContain(note)
    }
  })
})

describe('the Projected finish measure’s late lines on our team’s paper (G-98 after G-21)', () => {
  const ID = 'fairoaksd'
  const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
  const moveBy = (s: GcState, label: string, days: number, reason: ScheduleMoveReason, note: string): GcState => {
    const a = scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity
    return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note, by: 'Robert' } })
  }
  const changeOrder = (s: GcState, description: string, days: number, sign: boolean): GcState => {
    let state = gcReducer(s, { type: 'draftChangeOrder', projectId: ID, description, reason: 'plans', schedule: '', packageId: null, cost: 4_200, price: 0, days })
    const all = job(state).changeOrders ?? []
    const co = all[all.length - 1]!
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: ID, changeOrderId: co.id })
    return sign ? gcReducer(state, { type: 'ownerSignChangeOrder', projectId: ID, changeOrderId: co.id }) : state
  }
  /** The late-finish tests' job: Trim a week on the customer's tile, rain on Test and balance, change order 1 signed, change order 2 sent, $500 a day. */
  const lateJob = (): GcState => {
    let s = initialGcState()
    s = moveBy(s, 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.')
    s = moveBy(s, 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
    s = changeOrder(s, 'A larger roof curb for RTU-2', 1, true)
    s = changeOrder(s, 'Extra exterior lighting', 2, false)
    return gcReducer(s, { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })
  }

  it('prints each line the measure shows, in its order, right under the finish sentence; the customer’s copy keeps its own', () => {
    const state = lateJob()
    render(<GcBuildingScheduleTab state={state} project={job(state)} dispatch={vi.fn()} />)
    const shown = [...document.querySelectorAll('[data-tour="gc-late-finish"] > span')].map((el) => el.textContent ?? '')
    expect(shown.length).toBeGreaterThanOrEqual(3)
    const toolbar = document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Print or PDF' }))
    const head = () => [...new DOMParser().parseFromString(framed(), 'text/html').querySelectorAll('header.head p')].map((el) => el.textContent ?? '')
    const lines = head()
    const at = lines.findIndex((l) => l.startsWith('The contract says') || l.includes('The contract says'))
    expect(at).toBeGreaterThan(0)
    expect(lines.slice(at + 1, at + 1 + shown.length)).toEqual(shown)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'The customer' }))
    for (const line of shown) expect(head()).not.toContain(line)
  })
})
