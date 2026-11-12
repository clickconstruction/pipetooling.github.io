// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeStepWindow, type StepFoldSpec, type StepGroup } from './BridgeStepWindow'

// The frame alone, with made-up rows: the Market and Sales smokes hold what each window puts in it.

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `r${i + 1}`, title: `Thing ${i + 1}`, sub: `Why ${i + 1}` }))
const groups: StepGroup[] = [
  { key: 'do', title: 'Do this week', rows: [{ key: 'call', title: 'Call Oak Hollow HOA', sub: 'Quiet 6 weeks.', press: { label: 'Open their bids', to: '/bids?tab=bid-board', primary: true, testId: 'the-press' } }, ...rows(4)] },
  { key: 'none', title: 'Nothing here', rows: [], empty: 'Nothing waiting on a source.' },
  { key: 'hidden', title: 'Never drawn', rows: [] },
]
const folds: StepFoldSpec[] = [
  { key: 'all', label: 'Every source (12)', content: <div>the whole list</div> },
  { key: 'how', label: 'How this is counted', content: <div>the rules</div> },
]

const draw = (over: Partial<Parameters<typeof BridgeStepWindow>[0]> = {}) => {
  const onClose = vi.fn()
  renderWithProviders(<BridgeStepWindow testId="the-window" ariaLabel="Market, broken down" eyebrow="Market" headline="Market is worth $9k a week." headlineTestId="the-headline" line="The field builds $30k a week." groups={groups} folds={folds} onClose={onClose} {...over} />)
  return onClose
}

describe('BridgeStepWindow', () => {
  it('opens on where the step stands, then the rows, a few at a time', () => {
    draw()
    expect(screen.getByRole('dialog', { name: 'Market, broken down' })).toBeTruthy()
    expect(screen.getByTestId('the-headline').textContent).toBe('Market is worth $9k a week.')
    // Three rows show until the rest is asked for, and the press says how many there are.
    const group = screen.getByTestId('bridge-step-group-do')
    expect(group.querySelectorAll('[data-testid="bridge-step-row"]').length).toBe(3)
    const all = screen.getByTestId('bridge-step-all-do')
    expect(all.textContent).toBe('Show all 5 ›')
    fireEvent.click(all)
    expect(group.querySelectorAll('[data-testid="bridge-step-row"]').length).toBe(5)
    expect(all.getAttribute('aria-expanded')).toBe('true')
    // A row's press that names a page is a link to it.
    expect(screen.getByTestId('the-press').getAttribute('href')).toBe('/bids?tab=bid-board')
    // An empty group says its line when it has one, and is not drawn when it has none.
    expect(screen.getByTestId('bridge-step-group-none').textContent).toBe('Nothing hereNothing waiting on a source.')
    expect(screen.queryByTestId('bridge-step-group-hidden')).toBeNull()
  })

  it('keeps the rest behind presses at the foot, one open at a time', () => {
    draw()
    expect(screen.queryByTestId('bridge-step-fold-body-all')).toBeNull()
    fireEvent.click(screen.getByTestId('bridge-step-fold-all'))
    expect(screen.getByTestId('bridge-step-fold-body-all').textContent).toBe('the whole list')
    fireEvent.click(screen.getByTestId('bridge-step-fold-how'))
    expect(screen.queryByTestId('bridge-step-fold-body-all')).toBeNull()
    expect(screen.getByTestId('bridge-step-fold-body-how').textContent).toBe('the rules')
    // A press on the open one closes it.
    fireEvent.click(screen.getByTestId('bridge-step-fold-how'))
    expect(screen.queryByTestId('bridge-step-fold-body-how')).toBeNull()
  })

  it('closes on ×, on Escape and on a press outside, and not on a press inside', () => {
    const onClose = draw()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('the-window'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('leaves Escape to a sheet that is open over it', () => {
    const onClose = draw({ escCloses: false })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
