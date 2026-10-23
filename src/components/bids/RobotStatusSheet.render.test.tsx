// @vitest-environment jsdom
/**
 * The robot status sheet (v2.5732, punch list #142): the seven-step bar under the second step,
 * the last word, the first-visit fold, Read the run and Leave this one to me.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { RobotStatusSheet } from './RobotStatusSheet'
import { buildRobotProgress, type RobotProgressRow } from '../../lib/bids/robotProgress'
import type { Bid } from '../../types/bids'

const rpc = vi.fn(async (name: string) => {
  if (name === 'robot_run_signals') {
    return {
      data: [
        { at: '2026-10-21T19:04:00Z', kind: 'stamp', state: null, stage: null, progress: null, words: '[pipeline STG-0] claimed' },
        { at: '2026-10-21T19:36:00Z', kind: 'signal', state: 'working', stage: 'STG-2', progress: { step: 'reading', read: '12 of 31 sheets', next: 'the fixture schedule on P-601' }, words: 'heartbeat stage=STG-2 state=working' },
      ],
      error: null,
    }
  }
  return { data: null, error: null }
})
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(a[0] as string) } }))

const NOW = Date.now()
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()
const row = (over: Partial<RobotProgressRow> = {}): RobotProgressRow => ({
  bid_id: 'h1', shell_bid_id: 's1', shell_bid_number: '2041', run_status: 'open', claimed_at: minutesAgo(34), plans_filed: true,
  read_at: null, counted_at: null, priced_at: null, locked_at: null, scored_at: null, questions_at: null,
  heartbeat_at: minutesAgo(2), heartbeat_state: 'working', heartbeat_stage: 'STG-2',
  heartbeat_progress: { step: 'reading', read: '12 of 31 sheets' }, heartbeat_is_round: true, key_label: "Robert's Mac Mini", key_last_seen_at: minutesAgo(2), median_minutes: 62, ...over,
})
const bid = { id: 'h1', bid_number: '511', project_name: 'Oak Hollow Dental TI', bid_date_sent: null, outcome: null, bid_value: null, robot_requested_at: null, robot_opt_out: false, plans_link: 'https://drive.example/x', service_type_id: 'st-plumb', address: '1 Main', distance_from_office: '41', bid_due_date: '2026-10-24', gc_builder_id: 'gc1' } as unknown as Bid
const input = {
  bid,
  serviceTypeName: 'Plumbing',
  twinBidNumber: '2041',
  run: { status: 'open', created_at: minutesAgo(34), locked_at: null, scored_at: null, delta_pct: null, shadow_bid_number: '2041', requested_by_name: null, teacher_name: null },
  openQuestions: 0,
  presence: null,
}

describe('RobotStatusSheet with progress', () => {
  it('draws the bar with the third step lit, the last word, the fold open on the first visit, and the two presses', async () => {
    localStorage.removeItem('pipetooling_robot_touches_seen')
    const onLeave = vi.fn()
    renderWithProviders(
      <RobotStatusSheet input={input} twin={null} progress={buildRobotProgress(row(), NOW)} onClose={() => {}} onOpenRobotBoard={() => {}} onCompare={() => {}} onToggleRequest={() => {}} onOpenQuestions={() => {}} onLeaveToMe={onLeave} />,
    )
    await settle()
    expect(screen.getByTestId('robot-status-subtitle').textContent).toMatch(/^Step 3 of 7\. Reading the sheets, 12 of 31 sheets\. Last word 2m ago\.$/)
    const cells = screen.getByTestId('robot-progress-bar').querySelectorAll('[data-step]')
    expect(cells.length).toBe(7)
    expect([...cells].map((c) => c.getAttribute('data-state'))).toEqual(['done', 'done', 'now', 'todo', 'todo', 'todo', 'todo'])
    expect(cells[2]!.textContent).toContain('12 of 31 sheets')
    expect(screen.getByTestId('robot-progress-line').textContent).toMatch(/Last word .*, from Robert's Mac Mini\. Most bids take about an hour\./)
    expect(screen.getByText('The robot reads the plans and works on its own copy of the bid.')).toBeTruthy()
    expect(localStorage.getItem('pipetooling_robot_touches_seen')).toBe('1')
    fireEvent.click(screen.getByText('Leave this one to me'))
    expect(onLeave).toHaveBeenCalledWith(bid)
  })

  it('Read the run lists the stamps and the signals in the shape\'s words; the fold is closed on a later visit', async () => {
    localStorage.setItem('pipetooling_robot_touches_seen', '1')
    renderWithProviders(
      <RobotStatusSheet input={input} twin={null} progress={buildRobotProgress(row(), NOW)} onClose={() => {}} onOpenRobotBoard={() => {}} onCompare={() => {}} onToggleRequest={() => {}} onOpenQuestions={() => {}} />,
    )
    await settle()
    expect(screen.queryByText('The robot reads the plans and works on its own copy of the bid.')).toBeNull()
    expect(screen.queryByText('Leave this one to me')).toBeNull()
    fireEvent.click(screen.getByText('Read the run'))
    await waitFor(() => expect(screen.getByTestId('robot-run').textContent).toContain('Reading the sheets, 12 of 31 sheets. Next: the fixture schedule on P-601.'))
    expect(screen.getByTestId('robot-run').textContent).toContain('[pipeline STG-0] claimed')
    expect(rpc).toHaveBeenCalledWith('robot_run_signals')
  })

  it('v2.5751: runOpenAtStart lands on Read the run already unfolded, and a sent bid\'s live run draws the bar', async () => {
    localStorage.setItem('pipetooling_robot_touches_seen', '1')
    const sentBid = { ...bid, bid_date_sent: '2026-10-20' } as unknown as Bid
    renderWithProviders(
      <RobotStatusSheet input={{ ...input, bid: sentBid }} twin={null} progress={buildRobotProgress(row(), NOW)} runOpenAtStart onClose={() => {}} onOpenRobotBoard={() => {}} onCompare={() => {}} onToggleRequest={() => {}} onOpenQuestions={() => {}} onLeaveToMe={() => {}} />,
    )
    await waitFor(() => expect(screen.getByTestId('robot-run').textContent).toContain('[pipeline STG-0] claimed'))
    expect(screen.getByText('Hide the run')).toBeTruthy()
    expect(screen.getByTestId('robot-progress-bar')).toBeTruthy()
    // A sent bid cannot be left to a person: the robot's run on it is coverage, not a shadow of a number still to come.
    expect(screen.queryByText('Leave this one to me')).toBeNull()
  })

  it('a quiet robot says so in amber words, and a sealed one says its number shows when you send', async () => {
    const quiet = buildRobotProgress(row({ heartbeat_at: minutesAgo(12), key_last_seen_at: minutesAgo(12) }), NOW)
    const { unmount } = renderWithProviders(
      <RobotStatusSheet input={input} twin={null} progress={quiet} onClose={() => {}} onOpenRobotBoard={() => {}} onCompare={() => {}} onToggleRequest={() => {}} onOpenQuestions={() => {}} />,
    )
    await settle()
    expect(screen.getByTestId('robot-progress-line').textContent).toBe('The robot went quiet on this bid 12m ago. Another round picks it up within ten minutes.')
    unmount()
    const sealedInput = { ...input, run: { ...input.run, status: 'locked', locked_at: minutesAgo(1) } }
    renderWithProviders(
      <RobotStatusSheet input={sealedInput} twin={null} progress={buildRobotProgress(row({ locked_at: minutesAgo(1) }), NOW)} onClose={() => {}} onOpenRobotBoard={() => {}} onCompare={() => {}} onToggleRequest={() => {}} onOpenQuestions={() => {}} />,
    )
    await settle()
    expect(screen.queryByTestId('robot-progress-bar')).toBeNull()
    expect(screen.getByTestId('robot-status-subtitle').textContent).toMatch(/^Sealed/)
  })
})
