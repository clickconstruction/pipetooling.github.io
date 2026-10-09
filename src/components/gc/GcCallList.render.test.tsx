// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 7c-ii: the tests of the prototype's `GcCallList.render.test.tsx` (branch
 * spike/gc-mode) that draw the call list alone, moved word for word on main's test state. A row per person with Call and
 * Follow up, a line about a bar that opens it, Hide, Their work, and the opened bar's company. The call form's answer plays
 * the prototype's reducer and its Follow up sheet, and stays on the spike; the window draws the list with Call only
 * (`GcScheduleWindow.render.test.tsx`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcBarCaller, GcCallList } from './GcCallList'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { barCaller, callList } from '../../lib/gc/schedule/callList'
import type { GcState } from '../../lib/gc/types'

afterEach(cleanup)

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const lineOf = (s: GcState, label: string) => scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity.lineId
/** Press a `tel:` link without jsdom trying to follow it. */
function press(link: Element) {
  link.addEventListener('click', (e) => e.preventDefault(), { once: true })
  fireEvent.click(link)
}

function list(onFollowUp = vi.fn(), onWorkList = vi.fn(), onReason = vi.fn()) {
  const state = initialGcState()
  const calls = callList(state, job(state), new Map())
  const view = render(<GcCallList list={calls} onFollowUp={onFollowUp} onWorkList={onWorkList} onReason={onReason} />)
  return { ...view, state, calls, onFollowUp, onWorkList, onReason }
}

describe('the call list', () => {
  it('Their work shows a trade’s company on the chart, only for a company the chart has bars for (G-13)', () => {
    const state = initialGcState()
    const calls = callList(state, job(state), new Map())
    const onChart = new Set(scheduleMeasures(state, job(state)).items.map((i) => i.company))
    const picked = vi.fn()
    render(<GcCallList list={calls} onFollowUp={vi.fn()} onWorkList={vi.fn()} onReason={vi.fn()} theirWork={(p) => (onChart.has(p.company) ? () => picked(p.company) : null)} />)
    const withWork = calls.people.filter((p) => onChart.has(p.company))
    expect(withWork.length).toBeGreaterThan(0)
    const links = screen.getAllByText('Their work')
    expect(links.length).toBe(withWork.length)
    fireEvent.click(links[0]!)
    expect(picked).toHaveBeenCalledWith(withWork[0]!.company)
  })

  it('has a row per person, each with Call and Follow up', () => {
    const { container, calls } = list()
    expect(screen.getByText(`${calls.count} to call about the schedule`)).toBeTruthy()
    expect(screen.getByText(`· ${calls.late} late`)).toBeTruthy()
    expect(screen.getAllByText('Follow up').length).toBe(calls.count)
    expect(container.querySelectorAll('a[href^="tel:"]').length).toBe(calls.count)
    expect(screen.getByText('Pecan Valley Electric')).toBeTruthy()
  })

  it('Call and Follow up open the sheet at the person, and Work the list from the first', () => {
    const { container, calls, onFollowUp, onWorkList } = list()
    press(container.querySelector('a[href^="tel:"]')!)
    expect(onFollowUp).toHaveBeenLastCalledWith(calls.people[0], true)
    fireEvent.click(screen.getAllByText('Follow up')[1]!)
    expect(onFollowUp).toHaveBeenLastCalledWith(calls.people[1], false)
    fireEvent.click(screen.getByText('Work the list'))
    expect(onWorkList).toHaveBeenCalledTimes(1)
  })

  it('a line about a bar opens the bar; a reason with no bar is words only', () => {
    const { state, onReason } = list()
    fireEvent.click(screen.getByText('Lighting is behind: 40% done against 48% in the plan. It is due Fri Oct 23.'))
    expect(onReason).toHaveBeenCalledWith(lineOf(state, 'Lighting'))
    expect(screen.getByText('Their insurance ran out Tue Sep 15. Nothing they do for us is covered. They are at work on Panels and feeders, and Lighting.').closest('button')).toBeNull()
  })

  it('Hide folds it to its first line, and Show brings it back', () => {
    const { calls } = list()
    fireEvent.click(screen.getByText('Hide'))
    expect(screen.queryAllByText('Follow up').length).toBe(0)
    expect(screen.getByText(`${calls.count} to call about the schedule`)).toBeTruthy()
    fireEvent.click(screen.getByText('Show'))
    expect(screen.getAllByText('Follow up').length).toBe(calls.count)
  })

  it('says so when nobody is to call', () => {
    const state = initialGcState()
    const drawing = state.projects.find((p) => p.stage !== 'building')!
    render(<GcCallList list={callList(state, drawing, new Map())} onFollowUp={vi.fn()} onWorkList={vi.fn()} onReason={vi.fn()} />)
    expect(screen.getByText('Nobody to call about the schedule.')).toBeTruthy()
  })
})

describe('the opened bar’s company', () => {
  it('says who does it, with Call and Follow up', () => {
    const state = initialGcState()
    const caller = barCaller(state, job(state), lineOf(state, 'Rooftop units'))!
    const onFollowUp = vi.fn()
    const { container } = render(<GcBarCaller caller={caller} onFollowUp={onFollowUp} />)
    expect(screen.getByText('Cool Breeze Mechanical')).toBeTruthy()
    const call = container.querySelector('a[href^="tel:"]')!
    expect(call.textContent).toBe('Call Andre')
    press(call)
    expect(onFollowUp).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByText('Follow up'))
    expect(onFollowUp).toHaveBeenLastCalledWith(false)
  })
})
