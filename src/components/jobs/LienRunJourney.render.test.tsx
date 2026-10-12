// @vitest-environment jsdom
/**
 * The journey across the top of the run (Run-2): six nodes with their counts, the blocker's note on
 * its node, the done ticks, and the fill as wide as the done nodes reach.
 */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienRunJourney from './LienRunJourney'
import type { RunJourney } from '../../lib/jobs/runJourney'

const journey: RunJourney = {
  total: 3,
  fillRatio: 0.2,
  nodes: [
    { key: 'built', label: 'Built', count: '3 of 3', done: true, state: 'done', note: null },
    { key: 'signed', label: 'Signed', count: '1 of 3', done: false, state: 'blocked', note: '2 wait on Robert' },
    { key: 'sent', label: 'Sent', count: '0 of 3', done: false, state: 'todo', note: null },
    { key: 'mailed', label: 'In the mail', count: '0 of 3', done: false, state: 'todo', note: null },
    { key: 'recorded', label: 'Recorded', count: '0 of 3', done: false, state: 'todo', note: null },
    { key: 'delivered', label: 'Delivered', count: '0 of 3', done: false, state: 'todo', note: null },
  ],
}

describe('LienRunJourney', () => {
  it('draws six nodes, a tick on the done one, the blocker on its node, and the fill', () => {
    renderWithProviders(<LienRunJourney journey={journey} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByTestId('run-journey-built').textContent).toBe('✓Built3 of 3')
    expect(screen.getByTestId('run-journey-signed').getAttribute('data-state')).toBe('blocked')
    expect(screen.getByTestId('run-journey-signed').textContent).toBe('2Signed1 of 3 · 2 wait on Robert')
    expect(screen.getByTestId('run-journey-delivered').textContent).toBe('6Delivered0 of 3')
    const fill = screen.getByTestId('run-journey').querySelector('.lienRunJourneyFill') as HTMLElement
    expect(fill.style.width).toBe('20%')
  })
})
