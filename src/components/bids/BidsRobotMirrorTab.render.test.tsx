// @vitest-environment jsdom
/**
 * Render smokes for BidsRobotMirrorTab (v2.3222, v2.3225) — the Robot Board as a
 * mirror of the Bid Board: our bids in the board's sections, a robot column that
 * shows status only before send and the robot's number / ours / delta after; the
 * live bids with no run listed with their doors; where the delta lives on expand.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidsRobotMirrorTab } from './BidsRobotMirrorTab'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { RobotRowState } from '../../lib/bids/robotRowState'

const shadowRows = [
  {
    id: 'sh-live', status: 'locked', axis: null, created_at: '2026-09-07T10:00:00Z', locked_at: '2026-09-07T12:00:00Z', scored_at: null,
    shadow_bid_number: '482', reference_bid_number: '431', project_name: 'PALMER WINERY', requested_by_name: null,
    reference_sent_at: null, locked_total: null, reference_value: null, delta_pct: null, teacher_name: 'Wendi', teacher_standard: true,
  },
  {
    id: 'sh-practice', status: 'locked', axis: null, created_at: '2026-09-06T10:00:00Z', locked_at: '2026-09-06T12:00:00Z', scored_at: null,
    shadow_bid_number: '481', reference_bid_number: '385', project_name: 'Galloway Park', requested_by_name: null,
    reference_sent_at: null, locked_total: null, reference_value: null, delta_pct: null, teacher_name: 'Grace', teacher_standard: false,
  },
  {
    id: 'sh-novalue', status: 'locked', axis: 'bank-branch', created_at: '2026-08-31T10:00:00Z', locked_at: '2026-08-31T12:00:00Z', scored_at: null,
    shadow_bid_number: '420', reference_bid_number: '391', project_name: 'RBFCU', requested_by_name: null,
    reference_sent_at: '2026-09-01', locked_total: null, reference_value: null, delta_pct: null, teacher_name: 'Grace', teacher_standard: false,
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
  { id: 'a-418', bid_id: 's418', status: 'pending', requested_at: '2026-08-31T15:00:00Z', self_assessment: 'Least sure about the travel line — $80/mi on a 64-mile proto.' },
  { id: 'a-471', bid_id: 's471', status: 'pending', requested_at: '2026-09-05T13:00:00Z', self_assessment: null },
]

// Priced rows for the where-the-delta-lives detail: the robot (s418) carries a row we don't; ours (h397) carries one it missed.
const countRowsByBid: Record<string, Array<{ id: string; fixture: string; count: number; bid_version_id: string | null }>> = {
  s418: [{ id: 'r1', fixture: 'GWH Gas Water Heater', count: 4, bid_version_id: null }],
  h397: [{ id: 'r2', fixture: 'ft of 1IN WATER', count: 33, bid_version_id: null }],
}
const assignsByBid: Record<string, Array<{ count_row_id: string; price_book_entry_id: string | null; unit_price_override: number | null }>> = {
  s418: [{ count_row_id: 'r1', price_book_entry_id: null, unit_price_override: 2462.5 }],
  h397: [{ count_row_id: 'r2', price_book_entry_id: null, unit_price_override: 14.4 }],
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      // v2.3234: recorded best efforts — none in these smokes.
      if (table === 'bid_best_efforts') return { select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }
      if (table === 'users') return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'wendi' }], error: null }) }) }
      if (table === 'bid_audits') return { select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: auditRows, error: null }) }) }) }
      if (table === 'twin_run_scores') return { select: () => ({ order: () => Promise.resolve({ data: scoreRows, error: null }) }) }
      if (table === 'bids_count_rows') return { select: () => ({ eq: (_col: string, bidId: string) => Promise.resolve({ data: countRowsByBid[bidId] ?? [], error: null }), in: () => ({ order: () => ({ range: () => Promise.resolve({ data: [], error: null }) }) }) }) }
      // v2.3239: the shared loader also reads typed prices and the bid's active pricing.
      if (table === 'bid_count_row_custom_prices') return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
      if (table === 'bids') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { selected_price_book_version_id: null }, error: null }) }) }) }
      if (table === 'bid_pricing_assignments') return { select: () => ({ eq: (_col: string, bidId: string) => Promise.resolve({ data: assignsByBid[bidId] ?? [], error: null }), in: () => ({ order: () => ({ range: () => Promise.resolve({ data: [], error: null }) }) }) }) }
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
  bid({ id: 'h385', bid_number: '385', project_name: 'Galloway Park', estimator: { id: 'grace', name: 'Grace', email: 'g@x' } }),
  bid({ id: 'h391', bid_number: '391', project_name: 'RBFCU Potranco', bid_date_sent: '2026-09-01', bid_value: null }),
  bid({ id: 'h397', bid_number: '397', project_name: 'TAKE 5 BROWNSVILLE', bid_date_sent: '2026-09-08', bid_value: 50528 }),
  bid({ id: 'h201', bid_number: '201', project_name: 'AISD GARCIA SCHOOL RENOVATION', outcome: 'lost', bid_date_sent: '2026-04-24', bid_value: 180357 }),
  bid({ id: 'h380', bid_number: '380', project_name: 'MEDINA VALLEY ISD', plans_link: null, bid_due_date: '2026-09-10' }),
  bid({ id: 'h483', bid_number: '483', project_name: 'Laynes Chicken Fingers', bid_due_date: '2026-09-18' }),
  bid({ id: 'h500', bid_number: '500', project_name: 'Opted out job', robot_opt_out: true }),
  bid({ id: 'h116', bid_number: '116', project_name: 'Archived lead', working_board_archived_at: '2026-06-01T00:00:00Z' }),
  bid({ id: 'h3', bid_number: '3', project_name: 'Never-sent lost lead', outcome: 'lost' }),
]
const robotBids = [
  bid({ id: 's482', bid_number: '482', project_name: 'ZZ Shadow PALMER WINERY', twin_source_bid_id: 'h431' }),
  bid({ id: 's481', bid_number: '481', project_name: 'ZZ Shadow Galloway Park', twin_source_bid_id: 'h385' }),
  bid({ id: 's420', bid_number: '420', project_name: 'ZZ Shadow RBFCU', twin_source_bid_id: 'h391' }),
  bid({ id: 's418', bid_number: '418', project_name: 'ZZ Shadow TAKE 5 BROWNSVILLE', twin_source_bid_id: null }),
  bid({ id: 's471', bid_number: '471', project_name: 'ZZ Twin AISD GARCIA (backtest R2)', twin_source_bid_id: 'h201' }),
]

const rowStateFor = (b: BidWithBuilder): RobotRowState => {
  if (b.id === 'h380') return { kind: 'needs', badge: '?', title: '', questions: 0, gaps: [{ key: 'plans', label: 'No plans link', fix: 'Paste the plan set on the Edit form under Job Plans.', required: true }] }
  if (b.id === 'h500') return { kind: 'off', reason: 'opt-out', title: '' }
  return { kind: 'queued', title: '' }
}

function renderTab() {
  const mocks = {
    onEditBid: vi.fn(),
    onCompare: vi.fn(),
    onOpenShell: vi.fn(),
    onOpenAudit: vi.fn(),
    onReviewNow: vi.fn(),
    onOpenNeeds: vi.fn(),
    onOpenStatus: vi.fn(),
    onAddBidValue: vi.fn(),
    onOpenScoreboard: vi.fn(),
    onRowCount: vi.fn(),
  }
  renderWithProviders(
    <BidsRobotMirrorTab bids={humanBids} robotBids={robotBids} auditPending={2} loading={false} highlightBidId={null} rowStateFor={rowStateFor} {...mocks} />,
  )
  return mocks
}

describe('BidsRobotMirrorTab', () => {
  it('mirrors our bids by section: sealed live rows show no money, scored rows show robot / ours / delta, doors follow the audit', async () => {
    const props = renderTab()
    await waitFor(() => expect(screen.getByText('PALMER WINERY')).toBeTruthy())

    // The strip in plain words. Live-eligible: 431, 385, 483 (the no-plans, opted-out, archived and never-sent-lost bids are not live) → 2 shadowed of 3.
    expect(screen.getByText('of our bids have a robot run')).toBeTruthy()
    expect(screen.getByText('2 / 3')).toBeTruthy()
    expect(screen.getByText('live plumbing bids shadowed')).toBeTruthy()
    expect(screen.getByText('sealed, waiting on your number')).toBeTruthy()
    expect(screen.getByText('need something from a person')).toBeTruthy()
    expect(screen.getByText(/kinds of job earned first drafts/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /kinds of job earned first drafts/ }))
    expect(props.onOpenScoreboard).toHaveBeenCalledTimes(1)

    // Sealed live shadow: status word, the shell named, and NO number anywhere on the row; the practice teacher is tagged before send.
    expect(screen.getAllByText('sealed').length).toBe(3)
    expect(screen.getByText(/shadow b482 · opens when we send · vs Wendi/)).toBeTruthy()
    expect(screen.getByText(/shadow b481 · opens when we send · vs Grace · practice teacher/)).toBeTruthy()
    expect(screen.getAllByText('review at send').length).toBe(3)

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
    expect(props.onReviewNow).toHaveBeenCalledTimes(1)
    expect(props.onReviewNow.mock.calls[0]?.[0]).toMatchObject({ id: 'h397' })
    expect(props.onReviewNow.mock.calls[0]?.[1]).toMatchObject({ status: 'scored', robotTotal: 72854, deltaPct: 44.2 })
  })

  it('lists the live bids with no run — needs a person (with the fix door), queued, off — and hides archived / decided leads (v2.3225)', async () => {
    const props = renderTab()
    await waitFor(() => expect(screen.getByText('MEDINA VALLEY ISD')).toBeTruthy())

    // The unsent header counts the person-blocked rows; the listed count feeds the lens label.
    expect(screen.getByText(/1 needs a person before a robot can start/)).toBeTruthy()
    // The rows pair through the shadow rows, which arrive async after the first
    // paint — wait for the count rather than read it at the moment a row renders.
    await waitFor(() => expect(props.onRowCount).toHaveBeenLastCalledWith(8))

    // Needs row: gap label, its fix, and the door to the needs sheet.
    expect(screen.getByText('No plans link')).toBeTruthy()
    expect(screen.getByText('Paste the plan set on the Edit form under Job Plans.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Paste the plans →' }))
    expect(props.onOpenNeeds).toHaveBeenCalledWith(expect.objectContaining({ id: 'h380' }))

    // Queued row: next batch, with the status-sheet door.
    expect(screen.getByText('Laynes Chicken Fingers')).toBeTruthy()
    expect(screen.getByText('queued')).toBeTruthy()
    const statusButtons = screen.getAllByRole('button', { name: 'Robot status' })
    fireEvent.click(statusButtons[statusButtons.length - 1]!)
    expect(props.onOpenStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'h483' }))

    // Off row: muted, no door.
    expect(screen.getByText('opted out')).toBeTruthy()

    // Archived and never-sent-lost bids never list.
    expect(screen.queryByText('Archived lead')).toBeNull()
    expect(screen.queryByText('Never-sent lost lead')).toBeNull()
  })

  it('"Paste the plans" goes straight to Edit bid on Job Plans when the page offers that door (v2.3334)', async () => {
    const onPasteThePlans = vi.fn()
    const onOpenNeeds = vi.fn()
    renderWithProviders(
      <BidsRobotMirrorTab
        bids={humanBids}
        robotBids={robotBids}
        auditPending={0}
        loading={false}
        highlightBidId={null}
        rowStateFor={rowStateFor}
        onEditBid={vi.fn()}
        onCompare={vi.fn()}
        onOpenShell={vi.fn()}
        onOpenAudit={vi.fn()}
        onReviewNow={vi.fn()}
        onOpenNeeds={onOpenNeeds}
        onPasteThePlans={onPasteThePlans}
      />,
    )
    await waitFor(() => expect(screen.getByText('MEDINA VALLEY ISD')).toBeTruthy())
    const door = screen.getByRole('button', { name: 'Paste the plans →' })
    expect(door.getAttribute('title')).toBe('Opens Edit bid on the Job Plans field')
    fireEvent.click(door)
    expect(onPasteThePlans).toHaveBeenCalledWith(expect.objectContaining({ id: 'h380' }))
    expect(onOpenNeeds).not.toHaveBeenCalled()
  })

  it('a sealed run on a bid sent without a value gets the Add bid value door (v2.3225)', async () => {
    const props = renderTab()
    await waitFor(() => expect(screen.getByText('RBFCU Potranco')).toBeTruthy())
    expect(screen.getByText(/no bid value on record/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add bid value →' }))
    expect(props.onAddBidValue).toHaveBeenCalledWith(expect.objectContaining({ id: 'h391' }))
  })

  it('a scored row expands into where the delta lives and the robot\'s own note (v2.3225)', async () => {
    renderTab()
    await waitFor(() => expect(screen.getByText('TAKE 5 BROWNSVILLE')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'where the delta lives' }))
    await waitFor(() => expect(screen.getByText('Where the delta lives')).toBeTruthy())
    // missed: our 1IN WATER row (33 × 14.4 ≈ −$475); added: the robot's heaters (4 × 2462.5 = +$9,850); the rest is "everything else".
    expect(screen.getByText('−$475')).toBeTruthy()
    expect(screen.getByText('+$9,850')).toBeTruthy()
    expect(screen.getByText(/everything else/)).toBeTruthy()
    expect(screen.getByText(/= \+\$22,326 vs ours/)).toBeTruthy()
    expect(screen.getByText(/Least sure about the travel line/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'hide the details' }))
    expect(screen.queryByText('Where the delta lives')).toBeNull()
  })
})
