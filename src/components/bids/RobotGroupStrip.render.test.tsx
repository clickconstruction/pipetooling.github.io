// @vitest-environment jsdom
/**
 * Render smokes for RobotGroupStrip (v2.4256, punch list #63) — the Robots group's six
 * numbers, drawn on every lens, each a door to the lens that works it.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { RobotGroupStrip } from './RobotGroupStrip'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { RobotRowState } from '../../lib/bids/robotRowState'

const shadowRows = [
  {
    id: 'sh-live', status: 'locked', axis: null, created_at: '2026-09-07T10:00:00Z', locked_at: '2026-09-07T12:00:00Z', scored_at: null,
    shadow_bid_number: '482', reference_bid_number: '431', project_name: 'PALMER WINERY', requested_by_name: null,
    reference_sent_at: null, locked_total: null, reference_value: null, delta_pct: null, teacher_name: 'Wendi', teacher_standard: true,
  },
  {
    id: 'sh-sent', status: 'scored', axis: 'franchise-oil-change', created_at: '2026-09-04T10:00:00Z', locked_at: '2026-09-04T12:00:00Z', scored_at: '2026-09-08T15:00:00Z',
    shadow_bid_number: '418', reference_bid_number: '397', project_name: 'TAKE 5 BROWNSVILLE', requested_by_name: null,
    reference_sent_at: '2026-09-08', locked_total: 72854, reference_value: 50528, delta_pct: 44.2, teacher_name: 'Wendi', teacher_standard: true,
  },
]
const auditRows = [{ id: 'a-418', bid_id: 's418', status: 'pending', requested_at: '2026-08-31T15:00:00Z' }]

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'bid_best_efforts') return { select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }
      if (table === 'users') return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'wendi' }], error: null }) }) }
      if (table === 'bid_audits') return { select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: auditRows, error: null }) }) }) }
      if (table === 'twin_run_scores') return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }
      return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }
    },
    rpc: () => Promise.resolve({ data: shadowRows, error: null }),
  },
}))

const bid = (over: Partial<BidWithBuilder> & { id: string; bid_number: string; project_name: string }): BidWithBuilder =>
  ({ outcome: null, bid_date_sent: null, bid_value: null, plans_link: 'https://drive/x', customers: null, bids_gc_builders: null, estimator: { id: 'wendi', name: 'Wendi', email: 'w@x' }, ...over }) as unknown as BidWithBuilder

const humanBids = [
  bid({ id: 'h431', bid_number: '431', project_name: 'PALMER WINERY' }),
  bid({ id: 'h397', bid_number: '397', project_name: 'TAKE 5 BROWNSVILLE', bid_date_sent: '2026-09-08', bid_value: 50528 }),
  bid({ id: 'h380', bid_number: '380', project_name: 'MEDINA VALLEY ISD', plans_link: null, bid_due_date: '2026-09-10' }),
  bid({ id: 'h483', bid_number: '483', project_name: 'Laynes Chicken Fingers', bid_due_date: '2026-09-18' }),
]
const robotBids = [
  bid({ id: 's482', bid_number: '482', project_name: 'ZZ Shadow PALMER WINERY', twin_source_bid_id: 'h431' }),
  bid({ id: 's418', bid_number: '418', project_name: 'ZZ Shadow TAKE 5 BROWNSVILLE', twin_source_bid_id: null }),
]
const rowStateFor = (b: BidWithBuilder): RobotRowState => {
  if (b.id === 'h380') return { kind: 'needs', badge: '?', title: '', questions: 0, gaps: [{ key: 'plans', label: 'No plans link', fix: 'Paste the plan set on the Edit form under Job Plans.', required: true }] }
  return { kind: 'queued', title: '' }
}

describe('RobotGroupStrip', () => {
  it('draws the six numbers once the runs load, and each tile opens its lens', async () => {
    const onOpen = vi.fn()
    renderWithProviders(<RobotGroupStrip bids={humanBids} robotBids={robotBids} auditPending={2} rowStateFor={rowStateFor} activeKey="audits" canOpen={() => true} onOpen={onOpen} />)
    // Live-eligible: 431 and 483 (the no-plans bid is not live) → 1 shadowed of 2.
    await waitFor(() => expect(screen.getByText('1 / 2')).toBeTruthy())
    expect(screen.getByText(/^of our bids have a robot run →$/)).toBeTruthy()
    expect(screen.getByText(/^live plumbing bids shadowed →$/)).toBeTruthy()
    expect(screen.getByText(/^sealed, waiting on your number →$/)).toBeTruthy()
    expect(screen.getByText(/^need something from a person →$/)).toBeTruthy()
    expect(screen.getByText(/audits waiting · oldest \d+ d/)).toBeTruthy()
    expect(screen.getByText(/kinds of job earned first drafts/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /kinds of job earned first drafts/ }))
    expect(onOpen).toHaveBeenLastCalledWith('robot-scoreboard')
    fireEvent.click(screen.getByRole('button', { name: /need something from a person/ }))
    expect(onOpen).toHaveBeenLastCalledWith('robot-board')
    // The open lens's own tile is marked current and wears no arrow.
    const audits = screen.getByRole('button', { name: /audits waiting/ })
    expect(audits.getAttribute('aria-current')).toBe('true')
    expect(audits.textContent).not.toMatch(/→/)
  })

  it('a lens the viewer may not open draws a plain tile, not a door', async () => {
    const onOpen = vi.fn()
    renderWithProviders(<RobotGroupStrip bids={humanBids} robotBids={robotBids} auditPending={0} rowStateFor={rowStateFor} activeKey="robot-board" canOpen={(k) => k !== 'robot-scoreboard'} onOpen={onOpen} />)
    await waitFor(() => expect(screen.getByText('1 / 2')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /kinds of job earned first drafts/ })).toBeNull()
    expect(screen.getByText(/kinds of job earned first drafts/)).toBeTruthy()
    expect(screen.getByText(/^audits waiting/)).toBeTruthy()
  })
})
