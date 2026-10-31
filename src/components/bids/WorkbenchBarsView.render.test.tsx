// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { WorkbenchBarsView } from './WorkbenchBarsView'
import { workbenchBars, type WorkbenchBarsInput } from '../../lib/bids/workbenchBars'
import { ShapeSwitch, SideBySide, type ShapeView } from '../prototypes/SideBySide'

/** The mock-up's bid: sent at $48,700, the book $624 higher today, labor at the default crew rate, four rows with no cost. */
function sentBid(over: Partial<WorkbenchBarsInput> = {}): WorkbenchBarsInput {
  return {
    revenue: 49324,
    sent: { on: '2026-10-21', value: 48700 },
    cost: { labor: 16600, materials: 14000, tax: 1100, total: 31700 },
    rate: { value: 35.76, source: 'company' },
    noCost: { revenue: 2100, rows: 4 },
    drift: { gap: 624, moved: 3, wrong: 0 },
    laborOutOfStep: true,
    stamp: { pct: 31, revenueUsd: 48700, costUsd: 33600, uncostedUsd: 2100, rateSet: false },
    currentYear: 2026,
    ...over,
  }
}

/** The strip's shape on the tab, cut down: today's caveat lines, or the bars, by the switch; both for a dev with ?sbs=1. */
function Strip({ view, onDoor }: { view: ShapeView; onDoor: (door: string) => void }) {
  const bars = workbenchBars(sentBid())!
  const today = <p data-testid="today-lines">Went out at 31% · $33,600 cost on $48,700 · no labor rate</p>
  return (
    <div>
      <ShapeSwitch view={view} words={{ on: 'Show today’s look', off: 'Show the bars' }} />
      {view.sideBySide ? <SideBySide label="With the bars" testId="workbench-side-by-side" today={today} shape={<WorkbenchBarsView bars={bars} onDoor={onDoor} />} /> : view.on ? <WorkbenchBarsView bars={bars} onDoor={onDoor} /> : today}
    </div>
  )
}

function Harness({ sideBySide = false, onDoor = () => undefined }: { sideBySide?: boolean; onDoor?: (door: string) => void }) {
  const [on, setOn] = useState(false)
  return <Strip view={{ on, setOn, sideBySide }} onDoor={onDoor} />
}

describe('WorkbenchBarsView (punch list #217, bids-2, a prototype)', () => {
  it('draws the two bars on one scale, the marks, and the legend with each caveat’s door', () => {
    const onDoor = vi.fn()
    render(<WorkbenchBarsView bars={workbenchBars(sentBid())!} onDoor={onDoor} />)
    const view = screen.getByTestId('workbench-bars')
    expect(view.querySelector('[data-workbench-bar="revenue"]')?.textContent).toContain('Revenue · $48,700 sent Oct 21 · $49,324 at today’s book')
    expect([...view.querySelectorAll('[data-workbench-bar="cost"] [data-workbench-segment]')].map((e) => e.getAttribute('data-workbench-segment'))).toEqual(['labor', 'materials', 'drift', 'nocost', 'margin'])
    expect(view.querySelector('[data-workbench-mark="stamp"]')?.textContent).toBe('went out at 31%')
    expect(view.querySelector('[data-workbench-mark="sent"]')?.textContent).toBe('sent Oct 21 · $48,700')
    expect(within(view).getByText('labor', { selector: 'b' })).toBeTruthy()
    fireEvent.click(within(view).getByRole('button', { name: '↗ set Labor’s rate' }))
    fireEvent.click(within(view).getByRole('button', { name: '↗ Takeoffs' }))
    fireEvent.click(within(view).getByRole('button', { name: '↗ the rows' }))
    fireEvent.click(within(view).getByRole('button', { name: '↗ Labor' }))
    expect(onDoor.mock.calls.map((c) => c[0])).toEqual(['laborRate', 'takeoffs', 'noCostRows', 'labor'])
    expect(view.querySelector('[data-workbench-warn]')?.textContent).toContain('labor on last version’s counts')
  })

  it('with the switch off the strip reads as today; the press turns the bars on and back', () => {
    render(<Harness />)
    expect(screen.getByTestId('today-lines')).toBeTruthy()
    expect(screen.queryByTestId('workbench-bars')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show the bars' }))
    expect(screen.getByTestId('workbench-bars')).toBeTruthy()
    expect(screen.queryByTestId('today-lines')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show today’s look' }))
    expect(screen.getByTestId('today-lines')).toBeTruthy()
  })

  it('side by side for a dev: today’s lines above the bars, and no switch', () => {
    render(<Harness sideBySide />)
    const both = screen.getByTestId('workbench-side-by-side')
    expect(within(both).getByText('Today')).toBeTruthy()
    expect(within(both).getByText('With the bars')).toBeTruthy()
    expect(within(both).getByTestId('today-lines')).toBeTruthy()
    expect(within(both).getByTestId('workbench-bars')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Show the bars|Show today/ })).toBeNull()
  })

  it('an unsent bid with no caveat draws no door and no warning', () => {
    render(<WorkbenchBarsView bars={workbenchBars(sentBid({ sent: null, revenue: 48700, rate: { value: 42, source: 'override' }, noCost: { revenue: 0, rows: 0 }, drift: null, laborOutOfStep: false, stamp: null }))!} onDoor={() => undefined} />)
    const view = screen.getByTestId('workbench-bars')
    expect(view.querySelectorAll('[data-workbench-door]').length).toBe(0)
    expect(view.querySelector('[data-workbench-warn]')).toBeNull()
    expect(view.querySelector('[data-workbench-mark]')).toBeNull()
    expect(view.querySelector('[data-workbench-bar="revenue"]')?.textContent).toContain('Revenue · $48,700')
  })
})
