// @vitest-environment jsdom
/**
 * Render smoke for the schedule's Gantt, Phase 1 (the owner, 2026-10-05; `to-dos/gc-mode/GANTT_PLAN.md`):
 * a bar for every activity not folded away, the links drawn, the filters with their counts, three
 * ways to group, and a press on a bar opens it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcGantt } from './GcGantt'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { daysBetween, weekdayDate } from '../../lib/gcMode/gcModel'

afterEach(cleanup)

function chart(onPick = vi.fn()) {
  const state = initialGcState()
  const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')!
  const m = scheduleMeasures(state, project)
  const view = render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={new Map()} today={state.today} building picked={null} onPick={onPick} />)
  const bars = () => view.container.querySelectorAll('[data-gantt-bar]').length
  return { ...view, m, bars, onPick }
}

describe('the Gantt', () => {
  it('opens with finished trades folded and the live work drawn, links and all', () => {
    const { container, m, bars } = chart()
    // Sitework and Concrete are done: folded. Everything else has a bar.
    expect(bars()).toBeGreaterThan(0)
    expect(bars()).toBeLessThan(m.items.length)
    expect(screen.getByText('Sitework').closest('button')?.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('Roofing').closest('button')?.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelectorAll('svg path').length).toBeGreaterThan(0)
    expect(screen.getByText('today')).toBeTruthy()
    fireEvent.click(screen.getByText('Open all'))
    expect(bars()).toBe(m.items.length)
  })

  it('says where each bar stands, in a word beside its name', () => {
    chart()
    expect(screen.getAllByText('due today').length).toBeGreaterThan(0)
    expect(screen.getAllByText('behind').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2 spare days').length).toBeGreaterThan(0)
    expect(screen.getByText('no spare days')).toBeTruthy()
  })

  it('a filter shows only what it counts, and Show all brings the rest back', () => {
    const { bars } = chart()
    fireEvent.click(screen.getByText('Open all'))
    const all = bars()
    const pill = screen.getByText('5 or fewer spare days').closest('button')!
    const n = Number(pill.querySelector('b')?.textContent)
    fireEvent.click(pill)
    expect(bars()).toBe(n)
    expect(screen.getByText(`Showing ${n} of ${all}`)).toBeTruthy()
    fireEvent.click(screen.getByText('Show all'))
    expect(bars()).toBe(all)
  })

  it('draws the call list under the toolbar only while grouped by company (G-115)', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')!
    const m = scheduleMeasures(state, project)
    render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={new Map()} today={state.today} building picked={null} onPick={vi.fn()} callList={<div>The call list</div>} />)
    expect(screen.queryByText('The call list')).toBeNull()
    fireEvent.click(screen.getByText('By company'))
    expect(screen.getByText('The call list')).toBeTruthy()
    fireEvent.click(screen.getByText('By trade'))
    expect(screen.queryByText('The call list')).toBeNull()
  })

  it('groups by stage and by company without losing a bar', () => {
    const { bars, m } = chart()
    fireEvent.click(screen.getByText('By stage'))
    if (screen.queryByText('Open all')) fireEvent.click(screen.getByText('Open all'))
    expect(bars()).toBe(m.items.length)
    expect(screen.getByText('Dry-in', { selector: 'strong' })).toBeTruthy()
    fireEvent.click(screen.getByText('By company'))
    expect(screen.getByText('Summit Roofing', { selector: 'strong' })).toBeTruthy()
  })

  it('a bar dragged a week later asks to move it there, and does not open the editor', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')!
    const m = scheduleMeasures(state, project)
    const onPick = vi.fn()
    const onMove = vi.fn()
    const { container } = render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={new Map()} today={state.today} building picked={null} onPick={onPick} onMove={onMove} />)
    const bar = [...container.querySelectorAll('[data-gantt-bar]')].find((el) => el.getAttribute('aria-label')?.startsWith('TPO membrane'))!
    const a = m.items.find((r) => r.label === 'TPO membrane')!.activity
    // Weeks zoom draws a day 9 px wide: 63 px is a week.
    // jsdom's pointer events carry no coordinates, so the drag is played with mouse events of the same names.
    const pointer = (type: string, clientX: number) => fireEvent(bar, new MouseEvent(type, { bubbles: true, clientX, button: 0 }))
    pointer('pointerdown', 100)
    pointer('pointermove', 163)
    expect(screen.getByRole('status').textContent).toContain('Mon Sep 28 to Fri Oct 16')
    pointer('pointerup', 163)
    fireEvent.click(bar)
    expect(onMove).toHaveBeenCalledWith(a.lineId, '2026-09-28', '2026-10-16')
    expect(onPick).not.toHaveBeenCalled()
  })

  it('a press on a bar opens that activity, and the links can be hidden', () => {
    const { container, onPick } = chart()
    const bar = container.querySelector('[data-gantt-bar]')!
    fireEvent.click(bar)
    expect(onPick).toHaveBeenCalledWith(bar.getAttribute('data-gantt-bar'))
    fireEvent.click(screen.getByText('Hide the links'))
    expect(container.querySelectorAll('svg path').length).toBe(0)
  })
})

describe('waits drawn by hand (G-34)', () => {
  it('a press on a link asks to take the wait off, and a line pulled from a port to a bar asks to add one', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')!
    const m = scheduleMeasures(state, project)
    const onLink = vi.fn()
    const onUnlink = vi.fn()
    const { container } = render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={new Map()} today={state.today} building picked={null} onPick={() => undefined} onLink={onLink} onUnlink={onUnlink} />)
    fireEvent.click(screen.getByText('Open all'))
    const hit = container.querySelector('svg path[stroke="transparent"]')!
    fireEvent.click(hit)
    expect(onUnlink).toHaveBeenCalledTimes(1)
    const [from, to] = onUnlink.mock.calls[0]!
    expect(m.items.find((r) => r.activity.lineId === to)?.activity.after).toContain(from)
    // A line from the roof's port, dropped on the rooftop units.
    const tpo = m.items.find((r) => r.label === 'TPO membrane')!.activity.lineId
    const rtu = m.items.find((r) => r.label === 'Rooftop units')!.activity.lineId
    const port = container.querySelector(`[data-gantt-port="${tpo}"]`)!
    const scroller = container.querySelector('[data-gantt-scroller]')!
    const rtuBar = container.querySelector(`[data-gantt-bar="${rtu}"]`) as HTMLElement
    const was = document.elementFromPoint
    document.elementFromPoint = () => rtuBar
    fireEvent(port, new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }))
    fireEvent(scroller, new MouseEvent('pointermove', { bubbles: true, clientX: 50, clientY: 80 }))
    fireEvent(scroller, new MouseEvent('pointerup', { bubbles: true }))
    document.elementFromPoint = was
    expect(onLink).toHaveBeenCalledWith(tpo, rtu)
  })
})

describe('spare days as a faint tail, on request (G-08)', () => {
  it('draws a tail for every bar with room when asked, none on the red chain, and the hover card names the day each tail ends', () => {
    const { container, m } = chart()
    fireEvent.click(screen.getByText('Open all'))
    expect(container.querySelectorAll('[data-gantt-spare]')).toHaveLength(0)
    const toggle = screen.getByRole('button', { name: 'Show spare days' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Hide spare days' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText("a bar's spare days: how long it can slip before the job finishes later")).toBeTruthy()
    const tails = [...container.querySelectorAll<HTMLElement>('[data-gantt-spare]')]
    expect(tails).toHaveLength(14)
    const label = (id: string) => m.items.find((i) => i.activity.lineId === id)?.label
    const tailed = tails.map((t) => label(t.getAttribute('data-gantt-spare') ?? ''))
    for (const red of ['Trim', 'Test and balance', 'Final inspection']) expect(tailed).not.toContain(red)
    // Every tail ends on the day the hover card says it can finish by, and is drawn out to that day (9 px a day, weeks).
    for (const tail of tails) {
      const id = tail.getAttribute('data-gantt-spare') ?? ''
      const to = tail.getAttribute('data-gantt-spare-to') ?? ''
      const bar = container.querySelector<HTMLElement>(`[data-gantt-bar="${id}"]`)
      const a = m.items.find((i) => i.activity.lineId === id)?.activity
      if (!bar || !a) throw new Error(`no bar for ${id}`)
      const end = parseFloat(tail.style.left) + parseFloat(tail.style.width)
      expect(Math.round((end - parseFloat(bar.style.left)) / 9) - 1).toBe(daysBetween(a.start, to))
      fireEvent.mouseEnter(bar)
      const row = [...screen.getByRole('tooltip').querySelectorAll('div')].find((d) => d.firstElementChild?.textContent === 'Can finish by')
      expect(row?.lastElementChild?.textContent).toBe(weekdayDate(to))
      fireEvent.mouseLeave(bar)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Hide spare days' }))
    expect(container.querySelectorAll('[data-gantt-spare]')).toHaveLength(0)
  })
})
