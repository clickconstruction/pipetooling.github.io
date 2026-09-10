// @vitest-environment jsdom
/**
 * Render smokes for BidsRobotMirrorTab (v2.3222) — the Robot Board as a mirror of
 * the Bid Board: our bids in the board's sections, a robot column that shows
 * status only before send and the robot's number / ours / delta after.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidsRobotMirrorTab } from './BidsRobotMirrorTab'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

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

const scoreRows = [
  {
    id: 's1', run_label: 'R2-BT-25', kind: 'backtest', axis: 'institutional', project_name: 'AISD GARCIA', twin_bid_number: '471', reference_bid_number: '201',
    locked_total: 409385, reference_value: 180357, delta_pct: 127.0, counts_note: null, scope_verdict: 'pass', gate_eligible: true, note: null, scored_at: '2026-09-05T10:00:00Z',
    teacher_user_id: 'wendi', teacher_name: 'Wendi',
  },
]

const auditRows = [
  { id: 'a-418', bid_id: 's418', status: 'pending', requested_at: '2026-08-31T15:00:00Z' },
  { id: 'a-471', bid_id: 's471', status: 'pending', requested_at: '2026-09-05T13:00:00Z' },
]

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'users') return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'wendi' }], error: null }) }) }
      if (table === 'bid_audits') return { select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: auditRows, error: null }) }) }) }
      if (table === 'twin_run_scores') return { select: () => ({ order: () => Promise.resolve({ data: scoreRows, error: null }) }) }
      return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }), in: () => Promise.resolve({ data: [], error: null }) }) }
    },
    rpc: () => Promise.resolve({ data: shadowRows, error: null }),
  },
}))

const bid = (over: Partial<BidWithBuilder> & { id: string; bid_number: string; project_name: string }): BidWithBuilder =>
  ({
    outcome: null,
    bid_date_sent: null,
    bid_value: null,
    plans_link: 'https://drive/x',
    customers: null,
    bids_gc_builders: null,
    estimator: { id: 'wendi', name: 'Wendi', email: 'w@x' },
    ...over,
  }) as unknown as BidWithBuilder

const humanBids = [
  bid({ id: 'h431', bid_number: '431', project_name: 'PALMER WINERY' }),
  bid({ id: 'h397', bid_number: '397', project_name: 'TAKE 5 BROWNSVILLE', bid_date_sent: '2026-09-08', bid_value: 50528 }),
  bid({ id: 'h201', bid_number: '201', project_name: 'AISD GARCIA SCHOOL RENOVATION', outcome: 'lost', bid_date_sent: '2026-04-24', bid_value: 180357 }),
  bid({ id: 'h999', bid_number: '999', project_name: 'Uncovered live bid' }),
]
const robotBids = [
  bid({ id: 's482', bid_number: '482', project_name: 'ZZ Shadow PALMER WINERY', twin_source_bid_id: 'h431' }),
  bid({ id: 's418', bid_number: '418', project_name: 'ZZ Shadow TAKE 5 BROWNSVILLE', twin_source_bid_id: null }),
  bid({ id: 's471', bid_number: '471', project_name: 'ZZ Twin AISD GARCIA (backtest R2)', twin_source_bid_id: 'h201' }),
]

describe('BidsRobotMirrorTab', () => {
  it('mirrors our bids by section: sealed live rows show no money, scored rows show robot / ours / delta, doors follow the audit', async () => {
    const onReviewNow = vi.fn()
    const onRowCount = vi.fn()
    renderWithProviders(
      <BidsRobotMirrorTab
        bids={humanBids}
        robotBids={robotBids}
        auditPending={2}
        loading={false}
        highlightBidId={null}
        onEditBid={vi.fn()}
        onCompare={vi.fn()}
        onOpenShell={vi.fn()}
        onOpenAudit={vi.fn()}
        onReviewNow={onReviewNow}
        onRowCount={onRowCount}
      />,
    )
    await waitFor(() => expect(screen.getByText('PALMER WINERY')).toBeTruthy())

    // The strip: three of ours mirrored; two live eligible (431 covered, 999 not); the audit gate; no axis past Gate B.
    // The shell-paired rows render first and the run-paired ones land as the shadow/score
    // reads settle, so the count is reached, not read — waitFor, never a bare expect (flaked in CI).
    await waitFor(() => expect(onRowCount).toHaveBeenLastCalledWith(3))
    expect(screen.getByText('our bids with a robot run')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('1 / 2')).toBeTruthy())
    expect(screen.getByText('1 more live bid has no robot yet')).toBeTruthy()

    // Sealed live shadow: status word, the shell named, and NO number anywhere on the row.
    expect(screen.getByText('sealed')).toBeTruthy()
    expect(screen.getByText(/shadow b482 · opens when we send/)).toBeTruthy()
    expect(screen.getByText('review at send')).toBeTruthy()

    // Scored shadow on the sent bid (paired through the run's reference number): robot / ours / delta + Review now.
    expect(screen.getByText('$72,854')).toBeTruthy()
    expect(screen.getByText('$50,528')).toBeTruthy()
    expect(screen.getByText('+44.2%')).toBeTruthy()
    // Lost is collapsed by default, as on the board — open it for the backtest row.
    fireEvent.click(screen.getByRole('button', { name: /Lost/ }))
    expect(screen.getByText('$409,385')).toBeTruthy()
    expect(screen.getByText('+127.0%')).toBeTruthy()
    expect(screen.getByText(/backtest R2/)).toBeTruthy()

    const reviewButtons = screen.getAllByRole('button', { name: 'Review now' })
    expect(reviewButtons.length).toBe(2)
    fireEvent.click(reviewButtons[0]!)
    expect(onReviewNow).toHaveBeenCalledTimes(1)
    expect(onReviewNow.mock.calls[0]?.[0]).toMatchObject({ id: 'h397' })
    expect(onReviewNow.mock.calls[0]?.[1]).toMatchObject({ status: 'scored', robotTotal: 72854, deltaPct: 44.2 })
  })
})
