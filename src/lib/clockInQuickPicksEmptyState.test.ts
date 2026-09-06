import { describe, expect, it } from 'vitest'
import {
  CLOCK_IN_NO_PICKS_HEADLINE,
  clockInNoPicksGuidanceParts,
  clockInQuickPicksEmpty,
  showClockInNoPicksGuidance,
} from './clockInQuickPicksEmptyState'

describe('clockInQuickPicksEmpty', () => {
  it('is true only when all three sources are empty', () => {
    expect(clockInQuickPicksEmpty({ assignedJobs: 0, dispatchJobs: 0, workingBoardBids: 0 })).toBe(true)
    expect(clockInQuickPicksEmpty({ assignedJobs: 1, dispatchJobs: 0, workingBoardBids: 0 })).toBe(false)
    expect(clockInQuickPicksEmpty({ assignedJobs: 0, dispatchJobs: 2, workingBoardBids: 0 })).toBe(false)
    expect(clockInQuickPicksEmpty({ assignedJobs: 0, dispatchJobs: 0, workingBoardBids: 1 })).toBe(false)
  })
})

describe('showClockInNoPicksGuidance', () => {
  const base = { loading: false, quickPicksEmpty: true, searchText: '', hasSelection: false }

  it('shows once the empty load has settled and nothing is typed or chosen', () => {
    expect(showClockInNoPicksGuidance(base)).toBe(true)
  })

  it('stays hidden while quick picks load (no flashing empty state)', () => {
    expect(showClockInNoPicksGuidance({ ...base, loading: true })).toBe(false)
  })

  it('hides when there are picks, when the tech is typing, or once a job is chosen', () => {
    expect(showClockInNoPicksGuidance({ ...base, quickPicksEmpty: false })).toBe(false)
    expect(showClockInNoPicksGuidance({ ...base, searchText: 'oak' })).toBe(false)
    expect(showClockInNoPicksGuidance({ ...base, searchText: '   ' })).toBe(true)
    expect(showClockInNoPicksGuidance({ ...base, hasSelection: true })).toBe(false)
  })
})

describe('clockInNoPicksGuidanceParts', () => {
  it('names dispatch by number when one is on file', () => {
    const parts = clockInNoPicksGuidanceParts('512 360 0599')
    expect(parts.phone).toBe('512 360 0599')
    expect(`${parts.before}${parts.phone}${parts.after}`).toBe(
      'Search by job name or number below, or call dispatch at 512 360 0599 and they will get you on a job.',
    )
  })

  it('still points at dispatch when no number has loaded', () => {
    const parts = clockInNoPicksGuidanceParts(null)
    expect(parts.phone).toBeNull()
    expect(parts.before).toContain('call dispatch')
    expect(parts.after).toBe('')
  })

  it('headline says what is missing in field words', () => {
    expect(CLOCK_IN_NO_PICKS_HEADLINE).toMatch(/schedule/)
    expect(CLOCK_IN_NO_PICKS_HEADLINE).not.toMatch(/quick pick/i)
  })
})
