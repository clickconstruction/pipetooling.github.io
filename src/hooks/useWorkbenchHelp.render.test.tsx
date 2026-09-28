// @vitest-environment jsdom
/**
 * The Workbench's help doors as a hook (region P2 of the Pricing map). Pins the seam: the
 * tour unfolds the solver first, walks only the stops that are on the page, and says so
 * instead of opening when none are.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useWorkbenchHelp } from './useWorkbenchHelp'

const toasts: Array<[string, string]> = []
vi.mock('../contexts/ToastContext', () => ({
  useToastContext: () => ({ showToast: (m: string, kind: string) => toasts.push([m, kind]), showActionToast: () => {} }),
}))

const events: string[] = []

function Probe({ anchors }: { anchors: string[] }) {
  const h = useWorkbenchHelp({ unfoldSolver: () => events.push('unfold') })
  return (
    <div>
      {anchors.map((a) => (
        <span key={a} data-tour={a} />
      ))}
      <div data-testid="state">{`card:${h.wbInfoOpen ? 'open' : 'closed'} · tour:${h.wbTourSteps ? h.wbTourSteps.map((s) => s.anchor).join(',') : 'closed'}`}</div>
      <button type="button" onClick={() => h.setWbInfoOpen(true)}>open card</button>
      <button type="button" onClick={() => h.setWbInfoOpen(false)}>close card</button>
      <button type="button" onClick={() => h.startWorkbenchTour()}>start tour</button>
      <button type="button" onClick={() => h.setWbTourSteps(null)}>close tour</button>
    </div>
  )
}

beforeEach(() => {
  toasts.length = 0
  events.length = 0
})
afterEach(() => cleanup())

const state = () => screen.getByTestId('state').textContent

describe('useWorkbenchHelp', () => {
  it('starts with both closed, and the card opens and closes', () => {
    render(<Probe anchors={[]} />)
    // first paint
    expect(state()).toBe('card:closed · tour:closed')
    fireEvent.click(screen.getByText('open card'))
    expect(state()).toBe('card:open · tour:closed')
    fireEvent.click(screen.getByText('close card'))
    expect(state()).toBe('card:closed · tour:closed')
  })

  it('the tour unfolds the solver, then walks the stops on the page — in the section’s order', () => {
    render(<Probe anchors={['workbench-rows', 'send-to', 'workbench-solver']} />)
    fireEvent.click(screen.getByText('start tour'))
    expect(events).toEqual(['unfold'])
    expect(state()).toBe('card:closed · tour:send-to,workbench-solver,workbench-rows')
    expect(toasts).toEqual([])
    fireEvent.click(screen.getByText('close tour'))
    expect(state()).toBe('card:closed · tour:closed')
  })

  it('with no stop on the page it says so and opens nothing — the solver still unfolds', () => {
    render(<Probe anchors={['somewhere-else']} />)
    fireEvent.click(screen.getByText('start tour'))
    expect(events).toEqual(['unfold'])
    expect(state()).toBe('card:closed · tour:closed')
    expect(toasts).toEqual([['Nothing to tour yet — the Workbench needs Counts, an active Pricing, and a cost estimate.', 'info']])
  })
})
