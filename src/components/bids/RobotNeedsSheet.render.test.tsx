// @vitest-environment jsdom
/**
 * Render smoke for the robot needs sheet (v2.3223): a plans ask renders with
 * the standard taps even when the robot stored none, and tapping the rerun
 * pick answers with the bid id riding along so the page stamps the request.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RobotNeedsSheet, type RobotOpenQuestion } from './RobotNeedsSheet'
import type { Bid } from '../../types/bids'

const bid = {
  id: 'bid-378',
  bid_number: '378',
  project_name: 'SPACE X LEVEL 1 INTERIOR FIT OUT',
  plans_link: 'https://drive.example/space-x',
  plans_robot_readable: true,
  plans_robot_probe_note: null,
  service_type_id: 'st-plumbing',
  distance_from_office: 12,
  bid_due_date: '2026-09-20',
  gc_builder_id: 'gc-1',
  customer_id: null,
  outcome: null,
  robot_opt_out: false,
  bid_value: null,
} as unknown as Bid

const plansAsk: RobotOpenQuestion = {
  id: 'q-plans',
  question: 'Can you attach the plumbing sheets? The file on the bid right now is the electrical part.',
  topic: null,
  created_at: '2026-09-09T20:00:00Z',
}

const decision: RobotOpenQuestion = {
  id: 'q-tier',
  question: 'Which tier for the water heater?',
  topic: null,
  created_at: '2026-09-09T21:00:00Z',
  choices: ['Standard', 'Premium'],
  recommended: 'Premium',
}

describe('RobotNeedsSheet', () => {
  it('a legacy plans ask gets the standard taps; the rerun tap answers with the bid id for the request stamp', async () => {
    const onAnswer = vi.fn().mockResolvedValue(true)
    render(<RobotNeedsSheet bid={bid} questions={[plansAsk, decision]} onClose={() => {}} onEditBid={() => {}} onAnswer={onAnswer} />)
    expect(screen.getByText('Robot needs a different plan set')).toBeTruthy()
    expect(screen.getByText(/It stops here until these are fixed/)).toBeTruthy()
    // Plans ask: Copy intake address + Edit bid beside it, three taps under it.
    const plansRow = screen.getByTestId('robot-plans-ask')
    expect(plansRow.textContent).toContain('Copy intake address')
    expect(plansRow.textContent).toContain('Edit bid')
    fireEvent.click(screen.getByRole('button', { name: /★ Attached — rerun/ }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('q-plans', 'Attached — rerun', { rerunBidId: 'bid-378' }))

    // A decision keeps its own taps and never asks for a rerun.
    fireEvent.click(screen.getByRole('button', { name: /★ Premium/ }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('q-tier', 'Premium', undefined))
  })

  it('every Edit bid lands on the field that fixes the gap — a plans ask and a no-plans gap both open on Job Plans (v2.3334)', () => {
    const onEditBid = vi.fn()
    const { unmount } = render(<RobotNeedsSheet bid={bid} questions={[plansAsk]} onClose={() => {}} onEditBid={onEditBid} onAnswer={vi.fn()} />)
    const [beside, footer] = screen.getAllByRole('button', { name: 'Edit bid' })
    fireEvent.click(beside!)
    expect(onEditBid).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'bid-378' }), { focus: 'plansLink' })
    fireEvent.click(footer!)
    expect(onEditBid).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'bid-378' }), { focus: 'plansLink' })
    unmount()

    const noPlans = { ...bid, plans_link: null, plans_robot_readable: null } as unknown as Bid
    render(<RobotNeedsSheet bid={noPlans} questions={[]} onClose={() => {}} onEditBid={onEditBid} onAnswer={vi.fn()} />)
    expect(screen.getByText('No plans link')).toBeTruthy()
    const [gapDoor] = screen.getAllByRole('button', { name: 'Edit bid' })
    fireEvent.click(gapDoor!)
    expect(onEditBid).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'bid-378' }), { focus: 'plansLink' })
  })

  it('"Skip this bid" answers the plans ask without a rerun request', async () => {
    const onAnswer = vi.fn().mockResolvedValue(true)
    render(<RobotNeedsSheet bid={bid} questions={[plansAsk]} onClose={() => {}} onEditBid={() => {}} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip this bid' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('q-plans', 'Skip this bid', undefined))
  })
})
