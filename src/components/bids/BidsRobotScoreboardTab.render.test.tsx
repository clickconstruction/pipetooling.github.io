// @vitest-environment jsdom
/**
 * Render smokes for BidsRobotScoreboardTab (v2.2560; every audit role since
 * v2.3221) — the rule and the recent-runs strip, the "Your part" sentences
 * with doors, job types in plain words ranked closest to ready, live-bid runs
 * with the sealed envelope, practice runs folded under, and the dev-only
 * robot-notes toggle.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { RobotRowState } from '../../lib/bids/robotRowState'
import { BidsRobotScoreboardTab, type ScoreboardBid } from './BidsRobotScoreboardTab'

const scoreRows = [
  {
    id: 's1', run_label: 'BT-12', kind: 'backtest', axis: 'small TI',
    project_name: 'AutoZone 1604', twin_bid_number: '415', reference_bid_number: '67',
    locked_total: 31758, reference_value: 32600, delta_pct: -2.6, counts_note: 'FS 9/9',
    scope_verdict: 'pass', gate_eligible: true, note: null, scored_at: '2026-08-31T14:00:00Z',
    teacher_user_id: 'wendi', teacher_name: 'Wendi',
  },
  {
    id: 's2', run_label: 'BT-15', kind: 'backtest', axis: 'institutional',
    project_name: 'TSAOG campus', twin_bid_number: '421', reference_bid_number: '323',
    locked_total: 290839, reference_value: 404092, delta_pct: -28, counts_note: 'scope FAIL',
    scope_verdict: 'fail', gate_eligible: false, note: 'VOID — wrong package', scored_at: '2026-08-31T18:00:00Z',
    teacher_user_id: 'wendi', teacher_name: 'Wendi',
  },
]

const shadowRows = [
  {
    id: 'sh1', status: 'locked', axis: 'small TI', created_at: '2026-08-31T20:00:00Z',
    locked_at: '2026-08-31T21:00:00Z', scored_at: null, shadow_bid_number: '423',
    reference_bid_number: '381', project_name: 'La Villita', requested_by_name: 'Robert',
    reference_sent_at: null, locked_total: null, reference_value: null, delta_pct: null,
  },
]

const receiptRows = [
  { bid_id: 'twin-415', audit_id: 'audit-1', body: '🤖 Learned: the small-TI residual now carries branch footage.', created_at: '2026-09-04T00:00:00Z' },
]

// One chainable stub per table: every builder method returns the chain, and
// awaiting it resolves the table's rows.
function chain(data: unknown) {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'order', 'limit']) q[m] = () => q
  q.then = (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data, error: null })
  return q
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) =>
      table === 'twin_run_scores'
        ? chain(scoreRows)
        : table === 'users'
          ? chain([{ id: 'wendi', name: 'Wendi' }])
          : table === 'bid_audit_notes'
            ? chain(receiptRows)
            : table === 'bid_audits'
              ? chain([{ id: 'audit-1', completed_by: 'wendi' }])
              : chain([]),
    rpc: () => Promise.resolve({ data: shadowRows, error: null }),
  },
}))

const liveBids: ScoreboardBid[] = [
  { id: 'b381', bid_number: '381', bid_date_sent: null, outcome: null, estimator_id: 'grace', plans_link: 'https://drive/x', project_name: 'La Villita' },
  { id: 'b382', bid_number: '382', bid_date_sent: null, outcome: null, estimator_id: 'grace', plans_link: 'https://drive/y', project_name: 'Broadway TI' },
  { id: 'b383', bid_number: '383', bid_date_sent: '2026-08-30', outcome: null, estimator_id: 'wendi', plans_link: 'https://drive/z', project_name: 'Sent already' },
  { id: 'b384', bid_number: '384', bid_date_sent: null, outcome: null, estimator_id: 'wendi', plans_link: null, project_name: 'No plans yet' },
]

const states: Record<string, RobotRowState> = {
  b381: { kind: 'sealed', title: '', lockedAt: null, twinBidNumber: '423' },
  b382: { kind: 'queued', title: '' },
  b383: { kind: 'grade', title: '', grade: 'B' },
  b384: { kind: 'needs', badge: '?', title: '', questions: 0, gaps: [{ key: 'plans', label: 'No plans link', fix: '', required: true }] },
}

describe('BidsRobotScoreboardTab', () => {
  it('renders the rule, your part, plain job types, live and practice runs', async () => {
    const onOpenBid = vi.fn()
    const onOpenAudits = vi.fn()
    renderWithProviders(
      <BidsRobotScoreboardTab
        auditPending={18}
        questionsWaiting={1}
        bids={liveBids}
        robotBids={[{ id: 'twin-415', bid_number: '415' }]}
        viewerId="grace"
        stateFor={(b) => states[b.id] ?? { kind: 'none', title: '' }}
        onOpenBid={onOpenBid}
        onOpenAudits={onOpenAudits}
      />,
    )
    await waitFor(() => expect(screen.getByText('Small tenant finish-out')).toBeTruthy())

    // the rule, in words — no "Gate B", no "axis"
    expect(screen.getByText(/A job type is ready for robot first drafts/)).toBeTruthy()
    expect(screen.queryByText(/Gate B/)).toBeNull()
    expect(screen.queryByText(/axis/i)).toBeNull()

    // your part: sealed on the viewer's bid, queued, can't see, waiting on anyone
    expect(screen.getByText('The robot has a sealed number on one of your bids.')).toBeTruthy()
    expect(screen.getByText('b382 Broadway TI is queued for the next weekday batch.')).toBeTruthy()
    expect(screen.getByText('Robots can’t see 1 live bid.')).toBeTruthy()
    expect(screen.getByText('18 audits and 1 question are waiting on anyone.')).toBeTruthy()
    fireEvent.click(screen.getByText('Open b381'))
    expect(onOpenBid).toHaveBeenCalledWith('b381')
    fireEvent.click(screen.getByText('Open Audits'))
    expect(onOpenAudits).toHaveBeenCalled()

    // job types: plain status, plain slots, the sealed run pending, the receipt as the lesson
    expect(screen.getByText('1 of 5 in a row')).toBeTruthy()
    expect(screen.getAllByText('3% low').length).toBeGreaterThan(0)
    expect(screen.getByText('b423 🔒')).toBeTruthy()
    expect(screen.getByText(/The small-TI residual now carries branch footage\. After Wendi’s audit\./)).toBeTruthy()
    // the operator's raw note never shows without the dev toggle
    expect(screen.queryByText(/robot notes/i)).toBeNull()

    // live run: sealed, waiting on the viewer's own send
    expect(screen.getByText(/sealed · waiting on you to send b381/)).toBeTruthy()

    // practice runs: the voided run stays, marked, with its reason on expand
    await waitFor(() => expect(screen.getAllByText('voided').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('TSAOG campus'))
    expect(screen.getByText(/Why it didn’t count: VOID — wrong package/)).toBeTruthy()

    // the ledger's old columns are gone
    expect(screen.queryByText('Teacher')).toBeNull()
    expect(screen.queryByText('no holdout evidence yet')).toBeNull()
  })

  it('shows the operator notes to devs behind a toggle', async () => {
    renderWithProviders(<BidsRobotScoreboardTab isDev bids={liveBids} viewerId="robert" stateFor={() => ({ kind: 'none', title: '' })} />)
    await waitFor(() => expect(screen.getByText('Schools & libraries')).toBeTruthy())
    fireEvent.click(screen.getByText('Show robot notes'))
    expect(screen.getAllByText(/robot notes/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/VOID — wrong package/)).toBeTruthy()
  })
})
