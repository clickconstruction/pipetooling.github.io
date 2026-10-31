// @vitest-environment jsdom
/**
 * Render smoke for the robot fixtures wiring on the Counts tab (punch list #221, PR 3): the door draws only once
 * the run is sealed and a pull is there, the window opens on the kernel's buckets and Add N fixtures presses the
 * take door with the ticks; a robot row is shaded and its trash can reads Set aside; the fold line under the sheet
 * lists a set-aside row and Put back presses its door. The hooks are mocked at their module boundary; the window
 * and the kernels have their own tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { BidsCountsTab } from './BidsCountsTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'

const robot = vi.hoisted(() => ({
  progressRow: null as Record<string, unknown> | null,
  pull: null as Record<string, unknown> | null,
  rows: [] as Array<Record<string, unknown>>,
  take: vi.fn(async () => ({ added: 2, updated: 0, pull_id: 'pull-1' })),
  untake: vi.fn(async () => ({ removed: 2, restored: 0, kept: 0 })),
  setAside: vi.fn(async () => ({ set_aside: 1 })),
  putBack: vi.fn(async () => ({ put_back: 1, landed: 0 })),
}))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})
vi.mock('../../hooks/useRobotProgress', () => ({
  useRobotProgress: () => ({ rows: robot.progressRow ? [robot.progressRow] : [], byBid: new Map(), reload: () => {} }),
}))
vi.mock('../../hooks/useRobotFixtures', () => ({
  useRobotFixtures: (_bidId: string | null, enabled: boolean) => ({
    state: enabled && robot.pull ? { kind: 'ready', pull: robot.pull, rows: robot.rows } : { kind: 'idle' },
    reload: () => {},
    take: robot.take,
    untake: robot.untake,
    setAside: robot.setAside,
    putBack: robot.putBack,
    price: async () => ({ priced_by_book: 0, priced_by_robot: 0 }),
  }),
}))

const ISO = '2026-10-30T19:41:00Z'
const sealedRow = { bid_id: 'zz-1', shell_bid_id: 'zz-1', shell_bid_number: '555', run_status: 'locked', claimed_at: ISO, plans_filed: true, read_at: ISO, counted_at: null, priced_at: null, locked_at: ISO, scored_at: null, questions_at: null, heartbeat_at: null, heartbeat_state: null, heartbeat_stage: null, heartbeat_progress: null, heartbeat_is_round: false, key_label: null, key_last_seen_at: null, median_minutes: null, fixtures_at: ISO, fixtures_found: 5, fixtures_sure: 3, fixtures_taken: 0, fixtures_set_aside: 0, assisted_at: null }
const pull = { id: 'pull-1', bid_id: 'zz-1', plan_link: null, ct_link: null, sheet_count: 31, source: 'robot', check_summary: {}, robot_total: 6038, read_at: ISO }
const pr = (p: Record<string, unknown>) => ({ pull_id: 'pull-1', unit: 'ea', confidence: 0.9, agreement: 'agree', robot_unit_price: null, per_sheet: [], backing: [], ...p })
const pullRows = [
  pr({ id: 'pr-wc', tag: 'WC-1', name: 'Water closet', count: 5, sequence_order: 1, robot_unit_price: 412 }),
  pr({ id: 'pr-ms', tag: 'MS-1', name: 'Mop sink', count: 1, sequence_order: 2, robot_unit_price: 386 }),
  pr({ id: 'pr-fd', tag: 'FD-1', name: 'Floor drain', count: 8, sequence_order: 3, robot_unit_price: 212 }),
  pr({ id: 'pr-hb2', tag: 'HB-2', name: 'Hose bibb', count: 0, sequence_order: 4, confidence: 0.4, agreement: 'conflict' }),
  pr({ id: 'pr-bfp', tag: 'BFP-1', name: 'Backflow preventer', count: 1, sequence_order: 5, scope_flag: 'by_others', robot_unit_price: 1940 }),
]

const bid = { id: 'zz-1', bid_number: '555', project_name: 'ZZ Test Robot fixtures', address: null, customers: null, bids_gc_builders: null, alternate_group_tags: [], count_tooling_plans_link: null, bid_date_sent: null } as unknown as BidWithBuilder
const row = (p: Partial<BidCountRow> & Pick<BidCountRow, 'id' | 'fixture' | 'count'>): BidCountRow => ({ bid_id: 'zz-1', sequence_order: 1, created_at: ISO, page: null, group_tag: null, unit: 'ea', source_shares: null, bid_version_id: null, plan_tag: null, ...p }) as BidCountRow

function renderTab(countRows: BidCountRow[]) {
  return renderWithProviders(
    <BidsCountsTab
      bids={[bid]}
      selectedBidForCounts={bid}
      narrowViewport640={false}
      bidPreview={{ openBidPreviewFromBid: () => {} } as unknown as Parameters<typeof BidsCountsTab>[0]['bidPreview']}
      countRows={countRows}
      setCountRows={() => {}}
      refreshAfterCountsChange={() => {}}
      skipNextLoadCountRowsRef={{ current: false }}
      activeBidVersionId={null}
      onSelectBid={() => {}}
      onClose={() => {}}
      ledgerPrefixMap={{} as Parameters<typeof BidsCountsTab>[0]['ledgerPrefixMap']}
      onlyMyBids={false}
      setOnlyMyBids={() => {}}
      isMyBid={() => true}
    />,
  )
}

beforeEach(() => {
  robot.progressRow = sealedRow
  robot.pull = pull
  robot.rows = pullRows
  robot.take.mockClear()
  robot.setAside.mockClear()
  robot.putBack.mockClear()
})

describe('BidsCountsTab · robot fixtures', () => {
  it('draws no door before the run is sealed', () => {
    robot.progressRow = { ...sealedRow, locked_at: null }
    renderTab([row({ id: 'c-fd', fixture: 'Floor drain', count: 6 })])
    expect(screen.queryByTestId('counts-robot-fixtures')).toBeNull()
  })

  it('the door opens the window on the buckets, and Add presses the take door with the ticks', async () => {
    renderTab([row({ id: 'c-fd', fixture: 'Floor drain', count: 6 }), row({ id: 'c-lav', fixture: 'Lav', count: 5, sequence_order: 2 })])
    const door = await screen.findByTestId('counts-robot-fixtures')
    expect(door.textContent).toBe('Robot fixtures · 5')
    fireEvent.click(door)
    expect(screen.getByRole('dialog', { name: 'Fixtures the robot found on b555 · ZZ Test Robot fixtures' })).toBeTruthy()
    expect(screen.getByTestId('robot-fixtures-new').textContent).toContain('New · 4')
    expect(screen.getByTestId('robot-fixtures-on-count').textContent).toContain('On your count · 1')
    const take = screen.getByTestId('robot-fixtures-take') as HTMLButtonElement
    expect(take.textContent).toBe('Add 2 fixtures')
    fireEvent.click(take)
    await waitFor(() => expect(robot.take).toHaveBeenCalledTimes(1))
    expect(robot.take).toHaveBeenCalledWith(['pr-wc', 'pr-ms'], null, [])
    await screen.findByText('2 fixtures added from the robot.')
  })

  it('a robot row is shaded, its trash can reads Set aside, and the fold line puts a set-aside row back', async () => {
    robot.rows = [
      pr({ id: 'pr-wc', tag: 'WC-1', name: 'Water closet', count: 5, sequence_order: 1, taken_at: ISO, taken_as: 'added', count_row_id: 'c-wc' }),
      pr({ id: 'pr-hb2', tag: 'HB-2', name: 'Hose bibb', count: 0, sequence_order: 4, set_aside_at: ISO, set_aside_reason: 'wrong_count' }),
    ]
    renderTab([row({ id: 'c-fd', fixture: 'Floor drain', count: 6 }), row({ id: 'c-wc', fixture: 'Water closet', count: 5, sequence_order: 2, plan_tag: 'WC-1', source_shares: { 'src-robot': 5 } })])
    await screen.findByTestId('counts-robot-fixtures')
    const aside = await screen.findByRole('button', { name: 'Set aside Water closet' })
    fireEvent.click(aside)
    fireEvent.click(screen.getByRole('button', { name: 'Set aside' }))
    await waitFor(() => expect(robot.setAside).toHaveBeenCalledWith(['pr-wc'], null))
    expect(screen.getByRole('button', { name: 'Delete Floor drain' })).toBeTruthy()
    const fold = screen.getByTestId('counts-robot-set-aside')
    expect(fold.textContent).toContain('Robot · 1 set aside')
    expect(fold.textContent).toContain('HB-2 wrong count')
    fireEvent.click(screen.getByRole('button', { name: 'Show them' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put back' }))
    await waitFor(() => expect(robot.putBack).toHaveBeenCalledWith(['pr-hb2']))
  })
})
