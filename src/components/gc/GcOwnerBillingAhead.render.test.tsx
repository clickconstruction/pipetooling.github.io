// @vitest-environment jsdom
/**
 * Render smoke for The next 6 weeks following the bars (the Gantt, G-140): as the schedule stands
 * by default, with what changed and why, the draws that make the lowest week, each expected row
 * naming its bill day; and As reported so far, the way back, remembered.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcOwnerBillingAhead } from './GcOwnerBillingAhead'
import { setCashWeeksBars } from './useCashWeeksBars'
import { initialGcState } from '../../lib/gcMode/gcFixture'

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

afterEach(() => {
  cleanup()
  setCashWeeksBars('schedule')
})

describe('The next 6 weeks', () => {
  it('follows the schedule, says what changed and why, and names the draws that make the dip', () => {
    render(<GcOwnerBillingAhead state={initialGcState()} />)
    expect(screen.getByText('As the schedule stands').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('We go down to $323,600 carrying the week of Nov 2.')).toBeTruthy()
    expect(screen.getByText('Summit Roofing $118,800 and Cool Breeze Mechanical $84,240 are most of it.')).toBeTruthy()
    expect(
      screen.getByText(
        'The next 6 weeks follows the schedule now. Before, it counted only the work reported so far. As the schedule stands, $205,920 more goes to the trades in these weeks. The bills it expects bring $380,624 more, all of it after these weeks.',
      ),
    ).toBeTruthy()
    // Each expected row names the bill day its money is for.
    expect(screen.getAllByText(/for the work the schedule has done by Oct 25, paid by Nov 4/).length).toBe(4)
    expect(screen.getByText(/for the work they reported, paid by Nov 4 if they ask by Oct 25/)).toBeTruthy()
    expect(
      screen.getByText(
        /As the schedule stands, our bills come to \$526,492 through Dec 25\. The trades’ draws for the same work come to \$354,528\. Each counts on its day\. A job with no schedule counts the work reported so far\./,
      ),
    ).toBeTruthy()
  })

  it('goes back to the work reported so far, and remembers it', () => {
    render(<GcOwnerBillingAhead state={initialGcState()} />)
    fireEvent.click(screen.getByText('As reported so far'))
    expect(screen.getByText('As reported so far').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('We go down to $117,680 carrying the week of Nov 2.')).toBeTruthy()
    expect(screen.getByText('These weeks count only the work reported so far. Switch to As the schedule stands to follow the bars.')).toBeTruthy()
    expect(window.localStorage.getItem('gcCashWeeksBars')).toBe('reported')
    // A fresh card reads the remembered choice.
    cleanup()
    render(<GcOwnerBillingAhead state={initialGcState()} />)
    expect(screen.getByText('As reported so far').getAttribute('aria-pressed')).toBe('true')
  })

  it('counts only what is on the books when the box is unticked, either way', () => {
    render(<GcOwnerBillingAhead state={initialGcState()} />)
    fireEvent.click(screen.getByLabelText(/Count what we expect as the schedule stands/))
    expect(screen.getByText('We go down to $39,272 carrying the week of Oct 12.')).toBeTruthy()
    expect(screen.queryByText(/follows the schedule now/)).toBeNull()
  })
})
