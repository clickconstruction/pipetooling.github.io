// @vitest-environment jsdom
/**
 * The journey across the top of the run (v2.7477): the run's three steps with a count of notices under
 * each, a tick on a done step, the step the run is on marked. One line on a phone.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienRunJourney from './LienRunJourney'
import { lienRunParts } from '../../lib/jobs/lienRunParts'

const signed = { how: 'typed' as const, at: '2026-11-12T15:00:00Z', by: 'Sam' }
const row = (itemId: string, over: Partial<Parameters<typeof lienRunParts>[0][number]> = {}) => ({ itemId, held: null, signed, printed: null, paperless: false, mailed: null, ...over })
/** Three notices: two ready, one waiting on the signature. The run stands on step 1. */
const stepOne = lienRunParts([row('a'), row('b'), row('c', { signed: null })], [], { leaderName: 'Sam' }).nodes
/** All three printed: the run stands on step 3. */
const stepThree = lienRunParts(['a', 'b', 'c'].map((id) => row(id, { printed: { at: '2026-11-16T15:00:00Z', by: 'ZZ Office' } })), []).nodes

describe('LienRunJourney', () => {
  it('draws the run’s three steps, each counting notices, with the step the run is on marked', () => {
    renderWithProviders(<LienRunJourney nodes={stepOne} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByTestId('run-journey-1').textContent).toBe('1Get them right2 of 3 are ready')
    expect(screen.getByTestId('run-journey-1').getAttribute('data-state')).toBe('now')
    expect(screen.getByTestId('run-journey-1').getAttribute('aria-current')).toBe('step')
    expect(screen.getByTestId('run-journey-2').textContent).toBe('2Print0 of 3 printed')
    expect(screen.getByTestId('run-journey-3').textContent).toBe('3Mail and record0 of 3 ready to record')
    // Delivered is not a step of the run.
    expect(screen.getByTestId('run-journey').textContent).not.toContain('Delivered')
  })

  it('ticks the steps the run is past', () => {
    renderWithProviders(<LienRunJourney nodes={stepThree} />)
    expect(screen.getByTestId('run-journey-1').textContent).toBe('✓Get them right3 of 3 were ready')
    expect(screen.getByTestId('run-journey-2').textContent).toBe('✓Print3 of 3 printed')
    expect(screen.getByTestId('run-journey-3').getAttribute('data-state')).toBe('now')
  })

  it('on a phone the steps are one line, the step the run is on, and a press unfolds them (punch list #352, PR 7)', () => {
    const before = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      renderWithProviders(<LienRunJourney nodes={stepOne} />)
      const line = screen.getByTestId('run-journey-line')
      expect(line.getAttribute('aria-expanded')).toBe('false')
      expect(line.style.minHeight).toBe('44px')
      // Amber while the run stands on what stops a notice.
      expect(line.getAttribute('data-warn')).toBe('yes')
      expect(screen.getByTestId('run-journey-line-head').textContent).toBe('Step 1 of 3 · Get them right')
      expect(screen.getByTestId('run-journey-line-count').textContent).toBe('2 of 3 are ready')
      // Folded: no step is drawn.
      expect(screen.queryByTestId('run-journey')).toBeNull()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
      fireEvent.click(line)
      expect(line.getAttribute('aria-expanded')).toBe('true')
      expect(screen.getAllByRole('listitem')).toHaveLength(3)
      fireEvent.click(line)
      expect(screen.queryByTestId('run-journey')).toBeNull()
    } finally {
      window.matchMedia = before
    }
  })
})
