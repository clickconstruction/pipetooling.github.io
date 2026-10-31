// @vitest-environment jsdom
/**
 * Render smoke for the stage strip (punch list #221, PR 4): the inline pill's words and its fold to the seven
 * stops, the full strip's stops with the lit one marked and the sentence under them, the assisted chip, and the
 * door on the lit stop once fixtures are ready. The kernel's own tests pin the stops and the words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { buildRobotStage, type RobotStageRow } from '../../lib/bids/robotStage'
import { RobotStageStrip } from './RobotStageStrip'

afterEach(() => cleanup())

const ISO = '2026-10-30T19:41:00Z'
const base: RobotStageRow = { bid_id: 'b1', shell_bid_id: 's1', shell_bid_number: '652', run_status: 'locked', claimed_at: ISO, plans_filed: true, read_at: ISO, counted_at: null, priced_at: null, locked_at: ISO, scored_at: null, questions_at: null, heartbeat_at: null, heartbeat_state: null, heartbeat_stage: null, heartbeat_progress: null, heartbeat_is_round: false, key_label: null, key_last_seen_at: null, median_minutes: null, fixtures_at: ISO, fixtures_found: 23, fixtures_sure: 21, fixtures_taken: 0, fixtures_set_aside: 0, assisted_at: null }
const NOW = Date.parse('2026-10-30T20:00:00Z')

describe('RobotStageStrip', () => {
  it('inline: the pill reads the lit stop and unfolds to the seven stops with the door', () => {
    const onOpen = vi.fn()
    render(<RobotStageStrip stage={buildRobotStage(base, { bid_date_sent: null }, NOW)} variant="inline" onOpenFixtures={onOpen} />)
    const pill = screen.getByRole('button', { name: /Robot · fixtures ready · 23/ })
    expect(screen.queryByTestId('robot-stage-sent')).toBeNull()
    fireEvent.click(pill)
    expect(screen.getByTestId('robot-stage-sent').getAttribute('data-state')).toBe('now')
    expect(screen.getByTestId('robot-stage-fixtures').getAttribute('data-state')).toBe('done')
    expect(screen.getByTestId('robot-stage-sentence').textContent).toContain('The robot’s fixtures are ready. 23 found, 21 sure.')
    fireEvent.click(screen.getByRole('button', { name: 'Review them' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('full: the stops in a row, the sentence, and the assisted chip once she took fixtures', () => {
    render(<RobotStageStrip stage={buildRobotStage({ ...base, fixtures_taken: 15, assisted_at: ISO }, { bid_date_sent: null }, NOW)} variant="full" />)
    expect(screen.getByTestId('robot-stage-strip')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByTestId('robot-stage-sentence').textContent).toContain('You took 15 of the robot’s 23 fixtures.')
    expect(screen.getByTestId('robot-stage-assisted')).toBeTruthy()
  })

  it('inline before the seal: counting, no door', () => {
    render(<RobotStageStrip stage={buildRobotStage({ ...base, locked_at: null }, { bid_date_sent: null }, NOW)} variant="inline" onOpenFixtures={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Robot · counting/ }))
    expect(screen.queryByRole('button', { name: 'Review them' })).toBeNull()
  })

  it('detached: the pill only toggles, and the full face carries the door', () => {
    const onToggle = vi.fn()
    const onOpen = vi.fn()
    const stage = buildRobotStage(base, { bid_date_sent: null }, NOW)
    render(<RobotStageStrip stage={stage} variant="inline" detached expanded onToggleExpanded={onToggle} />)
    expect(screen.queryByTestId('robot-stage-sent')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Robot · fixtures ready · 23/ }))
    expect(onToggle).toHaveBeenCalledTimes(1)
    cleanup()
    render(<RobotStageStrip stage={stage} variant="full" onOpenFixtures={onOpen} />)
    expect(screen.getByTestId('robot-stage-sent').getAttribute('title')).toBe('Sent')
    fireEvent.click(screen.getByRole('button', { name: 'Review them' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
