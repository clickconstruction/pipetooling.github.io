// @vitest-environment jsdom
/**
 * Render smoke for the robot fixtures window (punch list #221, PR 3): the buckets drawn from the kernel's
 * review, a sure row ticked and a flagged one not, the button naming its count and the foot its price, a row
 * opening into its backing text, Set aside asking why, Put back on a set-aside row, and the before-sealed state.
 * The kernel's own tests pin the sorting and the words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { FixturePull, FixturePullRow, HerCountRow } from '../../lib/bids/robotFixtures'
import { RobotFixturesWindow } from './RobotFixturesWindow'

afterEach(() => cleanup())

const pull: FixturePull = { id: 'p1', bid_id: 'b1', plan_link: null, ct_link: null, sheet_count: 31, source: 'robot', check_summary: {}, robot_total: 3100, read_at: '2026-10-30T19:40:00Z' }
const row = (p: Partial<FixturePullRow> & Pick<FixturePullRow, 'id' | 'tag' | 'name' | 'count' | 'sequence_order'>): FixturePullRow => ({ pull_id: 'p1', unit: 'ea', confidence: 0.9, agreement: 'agree', robot_unit_price: null, ...p })
const rows: FixturePullRow[] = [
  row({ id: 'wc', tag: 'WC-1', name: 'Water closet', count: 5, sequence_order: 1, robot_unit_price: 412, per_sheet: [{ sheet: 'P-201', page: 14, count: 3 }, { sheet: 'P-202', page: 15, count: 2 }], backing: [{ kind: 'schedule', sheet: 'P-601', page: 28, text: 'WC-1 WATER CLOSET', flags: [] }], remark: 'Five drawn.' }),
  row({ id: 'bfp', tag: 'BFP-1', name: 'Backflow preventer', count: 1, sequence_order: 2, scope_flag: 'by_others', robot_unit_price: 1940 }),
  row({ id: 'fd', tag: 'FD-1', name: 'Floor drain', count: 8, sequence_order: 3, robot_unit_price: 212 }),
  row({ id: 'ms', tag: 'MS-1', name: 'Mop sink', count: 1, sequence_order: 4, set_aside_at: '2026-10-31T14:00:00Z', set_aside_reason: 'not_sure' }),
]
const hers: HerCountRow[] = [{ id: 'h1', fixture: 'Floor drain', count: 6 }, { id: 'h2', fixture: 'Lav', count: 5 }]

function setup(over: Partial<Parameters<typeof RobotFixturesWindow>[0]> = {}) {
  const onTake = vi.fn()
  const onSetAside = vi.fn()
  const onPutBack = vi.fn()
  const onOpenSheet = vi.fn()
  render(<RobotFixturesWindow bidLabel="b641 · Brushy Creek" pull={pull} rows={rows} herRows={hers} setName="Issued set" readWhen="Thu 2:40 PM" busy={false} phone={false} onTake={onTake} onSetAside={onSetAside} onPutBack={onPutBack} onOpenSheet={onOpenSheet} onOpenPlans={null} onClose={() => {}} {...over} />)
  return { onTake, onSetAside, onPutBack, onOpenSheet }
}
const take = () => screen.getByTestId('robot-fixtures-take') as HTMLButtonElement

describe('RobotFixturesWindow', () => {
  it('draws the buckets, ticks the sure row and not the one the plans give away, and names the count and the price', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Fixtures the robot found on b641 · Brushy Creek' })).toBeTruthy()
    expect(screen.getByTestId('robot-fixtures-set-line').textContent).toContain('From the set the robot read: Issued set, 31 sheets, read Thu 2:40 PM. 4 fixtures, 3 sure, $5,696 at the robot\u2019s prices. Your count has 2 rows.')
    expect(screen.getByTestId('robot-fixtures-new').textContent).toContain('New · 2')
    expect(screen.getByTestId('robot-fixtures-on-count').textContent).toContain('On your count · 1')
    expect((screen.getByRole('checkbox', { name: 'Add WC-1' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('checkbox', { name: 'Add BFP-1' }) as HTMLInputElement).checked).toBe(false)
    expect(take().textContent).toBe('Add 1 fixture')
    expect(screen.getByTestId('robot-fixtures-foot').textContent).toContain('$2,060 at the robot’s prices')
  })

  it('an update tick changes the button, and the press hands back the ticks', () => {
    const { onTake } = setup()
    // Keep mine leaves her count standing: nothing is struck until the row is ticked for Update.
    expect(screen.getByTestId('robot-fixtures-on-count').querySelector('s')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Update Floor drain' }))
    expect(take().textContent).toBe('Add 1 · update 1')
    expect(screen.getByTestId('robot-fixtures-on-count').querySelector('s')?.textContent).toBe('6')
    fireEvent.click(take())
    expect(onTake).toHaveBeenCalledTimes(1)
    const [ticks] = onTake.mock.calls[0]!
    expect([...ticks.add]).toEqual(['wc'])
    expect([...ticks.update]).toEqual(['fd'])
  })

  it('nothing ticked holds the button and names the act', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'None' }))
    expect(take().disabled).toBe(true)
    expect(take().textContent).toBe('Add fixtures')
  })

  it('a row opens into its backing text with Open sheet, and Set aside asks why', () => {
    const { onSetAside, onOpenSheet } = setup()
    fireEvent.click(screen.getAllByRole('button', { name: '▸ text' })[0]!)
    expect(screen.getByText(/WC-1 WATER CLOSET/).textContent).toContain('WC-1 WATER CLOSET')
    fireEvent.click(screen.getAllByRole('button', { name: 'Open sheet' })[0]!)
    expect(onOpenSheet).toHaveBeenCalledWith(28)
    fireEvent.click(screen.getByRole('button', { name: 'Set aside' }))
    fireEvent.click(screen.getByRole('button', { name: 'by others' }))
    expect(onSetAside).toHaveBeenCalledWith(['wc'], 'by_others')
  })

  it('a set-aside row waits with its reason and comes back with Put back', () => {
    const { onPutBack } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Show them' }))
    expect(screen.getByTestId('robot-fixtures-set-aside').textContent).toContain('not sure')
    fireEvent.click(screen.getByRole('button', { name: 'Put back' }))
    expect(onPutBack).toHaveBeenCalledWith(['ms'])
  })

  it('before the robot seals, says when the fixtures open', () => {
    setup({ pull: null, rows: [] })
    expect(screen.getByText(/Its fixtures open when it seals its number/)).toBeTruthy()
    expect(screen.queryByTestId('robot-fixtures-take')).toBeNull()
  })
})
