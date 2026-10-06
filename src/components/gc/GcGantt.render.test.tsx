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
