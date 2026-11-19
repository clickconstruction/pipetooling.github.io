// @vitest-environment jsdom
/**
 * The Percent row window as its own piece. It draws and reports, so every case is props in and a
 * call out: the row drawn live at the top, the press that names its act and its number, and the
 * reasons it is held. The numbers themselves are pinned in `lib/bids/percentRow.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { percentWindowStart, type PercentGridRow, type PercentRowLast } from '../../lib/bids/percentRow'
import { PercentRowWindow } from './PercentRowWindow'

afterEach(cleanup)

const row = (over: Partial<PercentGridRow> & { id: string; name: string }): PercentGridRow => ({ kind: 'fixture', tags: [], count: 1, revenue: 0, cost: 0, unitPrice: 0, priced: false, isFixedPrice: false, rule: null, ...over })
const pipe = (id: string, name: string, count: number, unit: number, tags: string[] = []): PercentGridRow => row({ id, name, kind: 'pipe', count, unitPrice: unit, revenue: count * unit, priced: true, tags })

/** The mock-up's bid: two fixtures and five pipe rows that sell for $6,200.00. */
const BID: PercentGridRow[] = [
  row({ id: 'wc', name: 'WC', count: 2, unitPrice: 2500, revenue: 5000, cost: 620, priced: true }),
  row({ id: 'lav', name: 'LAV', count: 2, unitPrice: 2000, revenue: 4000, cost: 1680, priced: true }),
  pipe('w34', 'ft of 3/4IN WATER', 60, 30, ['water']),
  pipe('w12', 'ft of 1/2IN WATER', 80, 15, ['water']),
  pipe('v2', 'ft of 2IN VENT', 50, 20),
  pipe('w4', 'ft of 4IN WASTE', 90, 20),
  pipe('w3', 'ft of 3IN WASTE', 20, 20),
]
const LAST: PercentRowLast = { name: 'Connections', kind: 'fitting', pct: '40', basis: 'revenue', sourceKey: 'kind:pipe' }

function setup(over: Partial<Parameters<typeof PercentRowWindow>[0]> & { last?: PercentRowLast | null } = {}) {
  const { last = LAST, ...props } = over
  const rows = props.rows ?? BID
  const self = props.self ?? null
  const calls = { close: vi.fn(), submit: vi.fn() }
  render(
    <PercentRowWindow rows={rows} self={self} start={percentWindowStart({ rows, self, last, from: props.from ?? null })} from={null} sent={false} narrow={false} busy={false} onClose={calls.close} onSubmit={calls.submit} {...props} />,
  )
  return calls
}
const win = () => screen.getByRole('dialog', { name: 'Percent row' })
const drawn = () => within(screen.getByTestId('percent-row-preview'))

describe('PercentRowWindow', () => {
  it('opens filled with the last rule and draws the new row as the grid will show it', () => {
    setup()
    expect(drawn().getByText('Connections')).toBeTruthy()
    expect(drawn().getByText('40% of Pipe revenue · $6,200.00')).toBeTruthy()
    expect(drawn().getAllByText('$2,480.00')).toHaveLength(2)
    expect(drawn().getByText('no cost')).toBeTruthy()
    expect(drawn().getByText('$17,680.00')).toBeTruthy()
    expect((drawn().getByLabelText('The new row’s kind') as HTMLSelectElement).value).toBe('fitting')
    expect(screen.getByRole('button', { name: 'Add Connections at $2,480.00' })).toBeTruthy()
  })

  it('the first time it suggests no percent: the press is held and says why', () => {
    const calls = setup({ last: null })
    const press = screen.getByRole('button', { name: 'Add Connections' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('Type a percent above 0.')
    fireEvent.click(press)
    fireEvent.keyDown(screen.getByLabelText('Percent'), { key: 'Enter' })
    expect(calls.submit).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Percent'), { target: { value: '40' } })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add Connections at $2,480.00' })).toBeTruthy()
  })

  it('the drawn row and the press move as she types, picks other rows, or unticks Keep following', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Percent'), { target: { value: '35' } })
    expect(drawn().getByText('35% of Pipe revenue · $6,200.00')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add Connections at $2,170.00' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: 'tag:water' } })
    expect(drawn().getByText('35% of water revenue · $3,000.00')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add Connections at $1,050.00' })).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Keep following these rows until the bid is sent'))
    expect(drawn().queryByText(/% of water revenue/)).toBeNull()
    expect(drawn().getByText('a typed price')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add Connections at $1,050.00' })).toBeTruthy()
  })

  it('shows each number she can take a percent of, and holds Cost where the rows carry none', () => {
    setup()
    const group = within(screen.getByRole('group', { name: 'Which number of those rows' }))
    expect(group.getByRole('button', { name: 'Revenue $6,200.00' }).getAttribute('aria-pressed')).toBe('true')
    expect((group.getByRole('button', { name: 'Cost none yet' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: 'kind:fixture' } })
    const cost = group.getByRole('button', { name: 'Cost $2,300.00' }) as HTMLButtonElement
    expect(cost.disabled).toBe(false)
    fireEvent.click(cost)
    expect(drawn().getByText('40% of Fixtures cost · $2,300.00')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add Connections at $920.00' })).toBeTruthy()
  })

  it('the press reports what was typed and what it comes to', () => {
    const calls = setup()
    fireEvent.change(drawn().getByLabelText('The new row’s kind'), { target: { value: 'allowance' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Connections at $2,480.00' }))
    expect(calls.submit).toHaveBeenCalledTimes(1)
    const [value, preview] = calls.submit.mock.calls[0]!
    expect(value).toEqual({ name: 'Connections', kind: 'allowance', pct: '40', basis: 'revenue', sourceKey: 'kind:pipe', follow: true })
    expect(preview).toMatchObject({ ruleToSave: { pct: 40, basis: 'revenue', source: { kind: 'pipe' } }, target: null, hold: null })
    expect(preview.answer).toEqual({ sourceCount: 5, base: 6200, revenue: 2480, unitPrice: 2480 })
  })

  it('a name already on the bid sets that row, and says so', () => {
    const typed = row({ id: 'conn', name: 'Connections', kind: 'fitting', priced: true, unitPrice: 2000, revenue: 2000 })
    const calls = setup({ rows: [...BID, typed] })
    expect(screen.getByText('Connections is already a row on this bid, so this sets its price.')).toBeTruthy()
    expect(drawn().queryByLabelText('The new row’s kind')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Set Connections to $2,480.00' }))
    expect(calls.submit.mock.calls[0]![1].target.id).toBe('conn')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gas connections' } })
    expect(screen.getByRole('button', { name: 'Add Gas connections at $2,480.00' })).toBeTruthy()
  })

  it('opened on a row it has no Name box and sets that row', () => {
    const self = row({ id: 'conn', name: 'Connections', kind: 'fitting', count: 1, priced: true, unitPrice: 2480, revenue: 2480, rule: { pct: 40, basis: 'revenue', source: { kind: 'pipe' } } })
    setup({ rows: [...BID, self], self })
    expect(screen.queryByLabelText('Name')).toBeNull()
    expect((screen.getByLabelText('Percent') as HTMLInputElement).value).toBe('40')
    expect(drawn().getByText('The row, as Pricing will show it')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set Connections to $2,480.00' })).toBeTruthy()
  })

  it('sent from the calculator it names the tape, and a plain number is a typed price', () => {
    setup({ last: null, from: { revenue: 1234.5, pct: null, basis: null, sourceKey: null, words: '900 + 334.5 = 1,234.50' } })
    expect(screen.getByTestId('percent-row-from-tape').textContent).toBe('From the tape: 900 + 334.5 = 1,234.50')
    expect((screen.getByLabelText('Keep following these rows until the bid is sent') as HTMLInputElement).checked).toBe(false)
    expect(drawn().getByText('a typed price')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add Connections at $1,234.50' })).toBeTruthy()
  })

  it('Put on a row… lists the bid’s rows where the name box was, and holds until one is picked', () => {
    const from = { revenue: 900, pct: null, basis: null, sourceKey: null, words: '900' }
    const calls = setup({ last: null, from, pickRow: true, start: percentWindowStart({ rows: BID, self: null, last: null, from, pickRow: true }) })
    expect(screen.queryByLabelText('Name')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Pick the row first.')
    // No row yet, so no row is drawn: the strip asks for one, the bid reads as it stands and the dead press never says Add.
    expect(drawn().getByText('Pick a row below')).toBeTruthy()
    expect(drawn().getByText('The row, as Pricing will show it')).toBeTruthy()
    expect(screen.queryByLabelText('The new row’s kind')).toBeNull()
    expect(drawn().queryByText('$16,100.00')).toBeNull()
    expect(drawn().getByText('$15,200.00')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Set a row to $900.00' }) as HTMLButtonElement).disabled).toBe(true)
    const list = screen.getByLabelText('Row') as HTMLSelectElement
    expect([...list.options].map((o) => o.textContent)).toEqual(['Pick a row on this bid…', 'WC · now $5,000.00', 'LAV · now $4,000.00', 'ft of 3/4IN WATER · now $1,800.00', 'ft of 1/2IN WATER · now $1,200.00', 'ft of 2IN VENT · now $1,000.00', 'ft of 4IN WASTE · now $1,800.00', 'ft of 3IN WASTE · now $400.00'])
    fireEvent.change(list, { target: { value: 'lav' } })
    // $900.00 over two lavatories, in place of their $4,000.00.
    expect(drawn().getByText('$450.00')).toBeTruthy()
    expect(drawn().getByText('$12,100.00')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set LAV to $900.00' }))
    expect(calls.submit.mock.calls[0]![1]).toMatchObject({ ruleToSave: null, hold: null })
    expect(calls.submit.mock.calls[0]![1].target.id).toBe('lav')
  })

  it('on a sent bid the tick box says the price is set once', () => {
    setup({ sent: true })
    expect(screen.getByLabelText('Keep the rule on the row. This bid is sent, so its price is set once.')).toBeTruthy()
  })

  it('Cancel, Escape and a press outside close; a press inside does not; a busy window holds still', () => {
    const calls = setup()
    fireEvent.click(win())
    expect(calls.close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(win(), { key: 'Escape' })
    fireEvent.click(win().parentElement!)
    expect(calls.close).toHaveBeenCalledTimes(3)
    cleanup()
    const busy = setup({ busy: true })
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(win().parentElement!)
    fireEvent.keyDown(win(), { key: 'Escape' })
    expect(busy.close).not.toHaveBeenCalled()
  })

  it('on a phone the row is drawn as a card with its price, and the bid line sits under it', () => {
    setup({ narrow: true })
    expect(drawn().queryByRole('table')).toBeNull()
    expect(drawn().getByText('Count 1 · no cost')).toBeTruthy()
    expect(drawn().getByText('40% of Pipe revenue · $6,200.00')).toBeTruthy()
    expect(drawn().getByText('$2,480.00')).toBeTruthy()
    expect(drawn().getByText('$17,680.00')).toBeTruthy()
  })
})
