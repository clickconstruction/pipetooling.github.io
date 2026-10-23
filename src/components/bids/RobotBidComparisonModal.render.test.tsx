// @vitest-environment jsdom
/**
 * The robot-vs-ours comparison (v2.5751, punch list #142): on a sent bid's live run the modal says
 * where the robot is and carries Read the run into the status sheet; without a live run or the
 * door, neither shows.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RobotBidComparisonModal } from './RobotBidComparisonModal'
import type { Bid } from '../../types/bids'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const source = { id: 'h497', bid_number: '497', project_name: 'Lone Star Market', bid_value: 223010, selected_bid_version_id: null, bid_date_sent: '2026-10-20' } as unknown as Bid
const twin = { id: 's500', bid_number: '500', project_name: 'ZZ Shadow Lone Star Market', bid_value: null, selected_bid_version_id: null } as unknown as Bid

describe('RobotBidComparisonModal', () => {
  it('a live run: the sentence under the table, and Read the run closes the modal and opens the status sheet on our bid', async () => {
    const onClose = vi.fn()
    const onReadRun = vi.fn()
    render(
      <RobotBidComparisonModal
        pair={{ source, twin }}
        onClose={onClose}
        onOpenBidTab={() => {}}
        onOpenRobotBoard={() => {}}
        liveLine="Step 4 of 7. Counting. Last word 2m ago."
        onReadRun={onReadRun}
      />,
    )
    await screen.findByText('Count rows')
    expect(screen.getByTestId('robot-compare-live').textContent).toBe('The robot is on this bid right now. Step 4 of 7. Counting. Last word 2m ago.')
    fireEvent.click(screen.getByRole('button', { name: 'Read the run' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onReadRun).toHaveBeenCalledWith(source)
  })

  it('no live run and no door: the modal reads as before', async () => {
    render(<RobotBidComparisonModal pair={{ source, twin }} onClose={() => {}} onOpenBidTab={() => {}} onOpenRobotBoard={() => {}} />)
    await screen.findByText('Count rows')
    expect(screen.queryByTestId('robot-compare-live')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Read the run' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open on Robot Board' })).toBeTruthy()
  })
})
