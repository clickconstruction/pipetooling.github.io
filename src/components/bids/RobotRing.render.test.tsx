// @vitest-environment jsdom
/**
 * The ring round the robot icon (v2.5732, punch list #142): seven segments filled by the steps
 * done, the glyph inside, no ring for a state with no run.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { RobotRing } from './RobotRing'
import { buildRobotProgress, type RobotProgressRow } from '../../lib/bids/robotProgress'

const NOW = Date.parse('2026-10-21T19:38:00Z')
const row = (over: Partial<RobotProgressRow> = {}): RobotProgressRow => ({
  bid_id: 'h1', shell_bid_id: 's1', shell_bid_number: '2041', run_status: 'open', claimed_at: '2026-10-21T19:04:00Z', plans_filed: true,
  read_at: null, counted_at: null, priced_at: null, locked_at: null, scored_at: null, questions_at: null,
  heartbeat_at: '2026-10-21T19:36:00Z', heartbeat_state: 'working', heartbeat_stage: 'STG-2',
  heartbeat_progress: { step: 'reading', read: '12 of 31 sheets' }, heartbeat_is_round: true, key_label: "Robert's Mac Mini", key_last_seen_at: '2026-10-21T19:36:00Z', median_minutes: null, ...over,
})

describe('RobotRing', () => {
  it('fills by the progress: two steps done and 12 of 31 sheets is 34%, blue', () => {
    const { container } = render(<RobotRing state={{ kind: 'working', title: '', twinBidNumber: null }} progress={buildRobotProgress(row(), NOW)} />)
    const ring = container.querySelector('[data-ring-fill]')!
    expect(ring.getAttribute('data-ring-fill')).toBe('34.1')
    expect(ring.getAttribute('data-ring-tone')).toBe('blue')
    expect(container.querySelector('svg')).not.toBeNull()
  })
  it('with no row, fills by the icon state: queued empty and gray, sealed full and green, needs amber', () => {
    const q = render(<RobotRing state={{ kind: 'queued', title: '' }} />).container.querySelector('[data-ring-fill]')!
    expect(q.getAttribute('data-ring-fill')).toBe('0')
    expect(q.getAttribute('data-ring-tone')).toBe('gray')
    const s = render(<RobotRing state={{ kind: 'sealed', title: '', lockedAt: null, twinBidNumber: null }} />).container.querySelector('[data-ring-fill]')!
    expect(s.getAttribute('data-ring-fill')).toBe('100')
    expect(s.getAttribute('data-ring-tone')).toBe('green')
    const n = render(<RobotRing state={{ kind: 'needs', badge: '?', title: '', gaps: [], questions: 0 }} />).container.querySelector('[data-ring-fill]')!
    expect(n.getAttribute('data-ring-tone')).toBe('amber')
  })
  it('quiet turns the fill amber; sealed progress is full', () => {
    const quiet = render(<RobotRing state={{ kind: 'working', title: '', twinBidNumber: null }} progress={buildRobotProgress(row({ heartbeat_at: '2026-10-21T19:20:00Z', key_last_seen_at: '2026-10-21T19:20:00Z' }), NOW)} />).container.querySelector('[data-ring-fill]')!
    expect(quiet.getAttribute('data-ring-tone')).toBe('amber')
    const sealed = render(<RobotRing state={{ kind: 'sealed', title: '', lockedAt: null, twinBidNumber: null }} progress={buildRobotProgress(row({ locked_at: '2026-10-21T19:58:00Z' }), NOW)} />).container.querySelector('[data-ring-fill]')!
    expect(sealed.getAttribute('data-ring-fill')).toBe('100')
  })
  it('a grade or a division-off state draws the glyph alone', () => {
    const { container } = render(<RobotRing state={{ kind: 'off', reason: 'division', title: '' }} />)
    expect(container.querySelector('[data-ring-fill]')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('[data-testid="robot-left-mark"]')).toBeNull()
  })
  it('a bid left to a person (v2.5751) draws the left-to-you mark at the ring\'s size, no glyph and no fill', () => {
    const { container } = render(<RobotRing state={{ kind: 'off', reason: 'opt-out', title: '' }} size={26} />)
    const mark = container.querySelector('[data-testid="robot-left-mark"]')!
    expect(mark.textContent).toBe('you')
    expect((mark as HTMLElement).style.width).toBe('26px')
    expect(container.querySelector('[data-ring-fill]')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })
})
