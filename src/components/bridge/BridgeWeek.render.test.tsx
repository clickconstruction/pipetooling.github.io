// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeWeek } from './BridgeWeek'
import type { WeekCallModel, WeekMove } from '../../lib/bridge/weekCall'
import type { MoneyLine } from '../../lib/bridge/moneyCard'
import type { DiveFacts } from '../../lib/bridge/callDive'

// Made-up numbers: the model is built by hand so the smoke reads the drawing, not the kernel.

const move = (over: Partial<WeekMove>): WeekMove => ({ key: 'other', kind: 'step', title: '', why: '', door: null, who: '', then: null, done: null, doneText: null, ...over })

const tiles: WeekCallModel['tiles'] = [
  { id: 'made', label: 'Made last week', value: '$31.0k', sub: '8 settled weeks ran $22.0k to $41.0k.', tone: 'plain', bars: [{ share: 0.8, current: false, waiting: false, label: 'Nov 1' }, { share: 0.2, current: true, waiting: true, label: 'Nov 8' }] },
  { id: 'cash', label: 'Cash low point, 8 weeks', value: '$12.0k', sub: 'On Nov 27. The floor is $10.0k.', tone: 'green' },
  { id: 'step', label: 'Slowest step', value: 'Bill', sub: '7.5 weeks to bill what is already finished.', tone: 'red' },
]

// The two balances, as `moneyCard.ts` would word them.
const cash: MoneyLine = { id: 'cash', label: 'Cash balance', value: '$12.0k', sub: 'Stays over the $10.0k floor. Low point $11.0k on Nov 27.', tone: 'green', runway: '8 days of runway' }
const accrual: MoneyLine = { id: 'accrual', label: 'Accrual balance', value: '$64.0k', sub: 'Adds $80.0k owed to you. Takes off $28.0k you owe, subs included.', tone: 'plain', runway: '42 days of runway' }
const money = { cash, accrual, foot: 'Runway counts payroll and overhead, $1.5k a day.' }

const propose: WeekCallModel = {
  state: 'propose',
  link: 'bill',
  cashLeads: false,
  tiles,
  last: null,
  card: {
    label: 'This week’s call',
    lead: 'Bill is the slowest step.',
    line: '$142k finished, not yet billed. The field finishes $33k a week. The office bills $19k a week.',
    moves: [
      move({ key: 'bill', title: 'Bill the 11 finished jobs.', why: '$142k is finished and not billed.', door: { to: '/jobs?tab=stages', label: 'Open Stages' }, who: 'Dana', then: 142_000 }),
      move({ key: 'price', title: 'Price the 4 jobs with no price.', why: 'Their hours earn nothing until then.', door: { to: '/jobs?tab=stages', label: 'Open the jobs' }, who: 'Sam', then: 4 }),
      move({ title: 'Take bank sorting off whoever bills, so billing is never idle.' }),
    ],
    press: 'Make Bill this week’s call',
    foot: 'Friday asks if it moved.',
    tone: 'lit',
  },
}

// A week cash leads, as the kernel words it.
const cashWeek: WeekCallModel = {
  ...propose,
  link: 'capital',
  cashLeads: true,
  card: {
    ...propose.card,
    lead: 'Keep cash above the floor.',
    line: 'Cash is under the $10.0k floor. Bill is still the slowest step.',
    moves: [move({ key: 'chase', kind: 'cash', title: 'Chase the 9 late invoices.', why: '$41.0k is late. The forecast leans on it.', door: { to: '/jobs?tab=billing', label: 'Open Billing' }, then: 41_000 }), move({ key: 'bill', title: 'Bill the 11 finished jobs.', why: '$142k is finished and not billed.', door: { to: '/jobs?tab=stages', label: 'Open Stages' }, then: 142_000 })],
    press: 'Make this the week’s call',
    foot: 'Friday asks if the day moved.',
  },
}

const week = (model: WeekCallModel, over: Partial<Parameters<typeof BridgeWeek>[0]> = {}) => <BridgeWeek money={money} onAccrual={() => {}} model={model} onCashNote={() => {}} {...over} />

describe('BridgeWeek', () => {
  it('draws the tiles and the card What to do now with its moves, each a door', () => {
    renderWithProviders(week(propose))
    expect(screen.getByTestId('bridge-week-tile-step').textContent).toContain('Bill')
    expect(screen.getByTestId('bridge-week-tile-cash').textContent).toContain('$12.0k')
    expect(screen.getByTestId('bridge-week-label').textContent).toBe('What to do now')
    expect(screen.getByTestId('bridge-week-lead').textContent).toBe('Bill is the slowest step.')
    expect(screen.getByTestId('bridge-week-line').textContent).toContain('$142k finished, not yet billed.')
    expect(screen.getAllByTestId('bridge-week-move').length).toBe(3)
    // A move with a door is a link to it.
    expect(screen.getByRole('link', { name: /Bill the 11 finished jobs/ }).getAttribute('href')).toBe('/jobs?tab=stages')
    // The side panel that said how the week runs is off the page.
    expect(screen.queryByTestId('bridge-week-how')).toBeNull()
  })

  it('is a pulse: no call to make, to pick, to hand over or to answer (#334, PR 7)', () => {
    const { unmount } = renderWithProviders(week(propose))
    for (const id of ['bridge-week-record', 'bridge-week-pick', 'bridge-week-add-note', 'bridge-week-who', 'bridge-week-who-pick', 'bridge-week-last', 'bridge-week-note']) expect(screen.queryByTestId(id)).toBeNull()
    expect(screen.queryByRole('button', { name: /Take off the call/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'It moved' })).toBeNull()
    // The kernel still words a press and a Friday foot for the Monday email. The card draws neither, nor a name on a move.
    const card = screen.getByTestId('bridge-week-card').textContent ?? ''
    expect(card).not.toMatch(/Friday|call|Dana|Sam/)
    unmount()
    // The steps not read yet: the line speaks of the list, not of a call.
    renderWithProviders(week({ ...propose, link: null, card: { ...propose.card, lead: 'The five steps are not read yet.', line: 'The call opens once they are.', moves: [], press: null, foot: '', tone: 'plain' } }))
    expect(screen.getByTestId('bridge-week-card').textContent).toContain('The list opens once they are.')
    expect(screen.getByTestId('bridge-week-card').textContent).not.toContain('The call opens')
    expect(screen.queryAllByTestId('bridge-week-move').length).toBe(0)
  })

  it('shows the first three moves at a desk: the step’s desk lists the rest', () => {
    const four: WeekCallModel = { ...propose, card: { ...propose.card, moves: [...propose.card.moves, move({ title: 'Ask the field for the day each job finishes.' })] } }
    renderWithProviders(week(four))
    expect(screen.getAllByTestId('bridge-week-move').length).toBe(3)
    expect(screen.getByTestId('bridge-week-card').textContent).not.toContain('Ask the field for the day each job finishes.')
  })

  it('reads a week cash leads: the cash moves carry their chip, and nothing is recorded', () => {
    renderWithProviders(week(cashWeek))
    expect(screen.getByTestId('bridge-week-lead').textContent).toBe('Keep cash above the floor.')
    const moves = screen.getAllByTestId('bridge-week-move')
    expect(moves.length).toBe(2)
    expect(moves[0]!.textContent).toMatch(/^1cashChase the 9 late invoices\./)
    expect(moves[1]!.textContent).not.toContain('cash')
    expect(screen.queryByTestId('bridge-week-record')).toBeNull()
    expect(screen.getByTestId('bridge-week-card').textContent).not.toMatch(/Friday|week’s call/)
  })

  it('names the things behind each move as a table, with the move’s one press on its heading (#334, PR 8)', () => {
    // Made-up customers and jobs.
    const dives: DiveFacts = {
      payers: [{ key: 'c1', name: 'Alder Builders', lateUsd: 40_000, usd: 52_000, oldestAgeDays: 71, promise: { state: 'none', ymd: null } }],
      billJobs: [{ id: 'j201', label: '201 · Maple Lofts', usd: 18_000 }],
      noPctJobs: [],
      noPriceJobs: [{ id: 'j401', label: '401 · Willow Walk' }],
      supplyBills: [],
      dayLabel: (ymd) => ymd,
    }
    const onDive = vi.fn()
    renderWithProviders(week(propose, { dives, onDive }))
    const moves = screen.getAllByTestId('bridge-week-move')
    // The bill move: its heading, its press, and its jobs under their headings.
    expect(moves[0]!.textContent).toContain('Bill the 11 finished jobs.')
    fireEvent.click(within(moves[0]!).getByTestId('bridge-week-dive-press'))
    expect(onDive).toHaveBeenLastCalledWith({ kind: 'desk', stage: 'bill' })
    expect(within(moves[0]!).getAllByRole('columnheader').map((h) => h.textContent).filter(Boolean)).toEqual(['Job', 'To bill'])
    expect(within(moves[0]!).getByRole('link', { name: '201 · Maple Lofts' }).getAttribute('href')).toBe('/jobs?tab=stages&edit=j201')
    // With its things named, the move's title is no longer a link to a whole page.
    expect(within(moves[0]!).queryByRole('link', { name: /Bill the 11 finished jobs/ })).toBeNull()
    // The price move names its job and carries no press of its own: the Jobs page would add nothing.
    expect(within(moves[1]!).queryByTestId('bridge-week-dive-press')).toBeNull()
    expect(within(moves[1]!).getByRole('link', { name: '401 · Willow Walk' }).getAttribute('href')).toBe('/jobs?tab=stages&edit=j401')
    // A move the page names nothing for is its heading alone.
    expect(within(moves[2]!).queryByTestId('bridge-week-dive')).toBeNull()
    // The card is framed by a rule down its left side, not a box.
    const card = screen.getByTestId('bridge-week-card')
    expect(card.style.borderLeft).toBe('4px solid rgb(220, 38, 38)')
  })

  it('says under the cash balance which account is left out, and the sentence opens the list', () => {
    const note = 'Leaves out Accounts Payable 2222, $12.4k.'
    const onCashNote = vi.fn()
    renderWithProviders(week(propose, { money: { ...money, cash: { ...cash, note } }, onCashNote }))
    const press = screen.getByTestId('bridge-week-tile-note')
    expect(press.textContent).toBe(note)
    fireEvent.click(press)
    expect(onCashNote).toHaveBeenCalledTimes(1)
  })

  it('reads Made last week, Slowest step, then the two balances with their runway (#334, PR 6)', () => {
    const onAccrual = vi.fn()
    const { unmount } = renderWithProviders(week(propose, { onAccrual }))
    const before = (a: HTMLElement, b: HTMLElement): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(before(screen.getByTestId('bridge-week-tile-made'), screen.getByTestId('bridge-week-tile-step'))).toBe(true)
    expect(before(screen.getByTestId('bridge-week-tile-step'), screen.getByTestId('bridge-week-tile-money'))).toBe(true)
    expect(screen.getByTestId('bridge-week-tile-cash').textContent).toContain('Cash balance')
    expect(screen.getByTestId('bridge-week-runway-cash').textContent).toBe('8 days of runway')
    expect(screen.getByTestId('bridge-week-runway-accrual').textContent).toBe('42 days of runway')
    expect(screen.getByTestId('bridge-week-runway-foot').textContent).toBe('Runway counts payroll and overhead, $1.5k a day.')
    // The accrual balance is a press that says its whole reading, and opens Money owed.
    const press = screen.getByTestId('bridge-week-tile-accrual')
    expect(press.getAttribute('aria-label')).toBe('Accrual balance $64.0k. 42 days of runway. Adds $80.0k owed to you. Takes off $28.0k you owe, subs included. Open Money owed.')
    fireEvent.click(press)
    expect(onAccrual).toHaveBeenCalledTimes(1)
    unmount()
    // A week cash leads: the kernel still hands its red band as a wide cash tile, and the page does not draw it.
    const band: WeekCallModel = { ...propose, cashLeads: true, tiles: [{ id: 'cash', label: 'Cash comes first this week', value: 'Under the floor today', sub: 'Cash goes under the $10.0k floor today.', tone: 'red', wide: true }, ...tiles.filter((t) => t.id !== 'cash')] }
    renderWithProviders(week(band, { money: { cash: { ...cash, runway: undefined }, accrual: { ...accrual, runway: undefined }, foot: '' } }))
    expect(screen.getByTestId('bridge-week').textContent).not.toContain('Under the floor today')
    expect(screen.getAllByTestId(/^bridge-week-tile-(made|step|money)$/).length).toBe(3)
    // With no burn read, no runway is printed and the foot is left off.
    for (const id of ['bridge-week-runway-cash', 'bridge-week-runway-accrual', 'bridge-week-runway-foot']) expect(screen.queryByTestId(id)).toBeNull()
  })

  it('draws the strip of pipe under the tiles in a usual week, and under the card in a week cash leads (PR 3)', () => {
    const strip = <div data-testid="the-strip">pipe</div>
    const { unmount } = renderWithProviders(week(propose, { strip }))
    const before = (a: HTMLElement, b: HTMLElement): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(before(screen.getByTestId('bridge-week-tile-step'), screen.getByTestId('the-strip'))).toBe(true)
    expect(before(screen.getByTestId('the-strip'), screen.getByTestId('bridge-week-card'))).toBe(true)
    unmount()
    renderWithProviders(week(cashWeek, { strip }))
    expect(screen.getAllByTestId('the-strip').length).toBe(1)
    expect(before(screen.getByTestId('bridge-week-card'), screen.getByTestId('the-strip'))).toBe(true)
  })

  it('sets the standing pipe beside the card at a desk, once, in a usual week and in a week cash leads (#318)', () => {
    const strip = <div data-testid="the-strip">pipe</div>
    const before = (a: HTMLElement, b: HTMLElement): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    for (const model of [propose, cashWeek]) {
      const { unmount } = renderWithProviders(week(model, { strip, stripSide: true }))
      expect(screen.getAllByTestId('the-strip').length).toBe(1)
      // The pipe and the card share one row: the pipe's column comes first.
      const row = screen.getByTestId('the-strip').parentElement?.parentElement
      expect(row?.style.gridTemplateColumns).toBe('minmax(260px, 340px) minmax(0, 1fr)')
      expect(row?.contains(screen.getByTestId('bridge-week-card'))).toBe(true)
      expect(before(screen.getByTestId('the-strip'), screen.getByTestId('bridge-week-card'))).toBe(true)
      unmount()
    }
  })
})
