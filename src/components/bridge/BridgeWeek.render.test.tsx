// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeWeek } from './BridgeWeek'
import type { WeekCallModel, WeekMove } from '../../lib/bridge/weekCall'

// Made-up numbers: the model is built by hand so the smoke reads the drawing, not the kernel.

const move = (over: Partial<WeekMove>): WeekMove => ({ key: 'other', kind: 'step', title: '', why: '', door: null, who: '', then: null, done: null, doneText: null, ...over })

const tiles: WeekCallModel['tiles'] = [
  { id: 'made', label: 'Made last week', value: '$31.0k', sub: '8 settled weeks ran $22.0k to $41.0k.', tone: 'plain', bars: [{ share: 0.8, current: false, waiting: false, label: 'Nov 1' }, { share: 0.2, current: true, waiting: true, label: 'Nov 8' }] },
  { id: 'cash', label: 'Cash low point, 8 weeks', value: '$12.0k', sub: 'On Nov 27. The floor is $10.0k.', tone: 'green' },
  { id: 'step', label: 'Slowest step', value: 'Bill', sub: '7.5 weeks to bill what is already finished.', tone: 'red' },
]

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

const friday: WeekCallModel = {
  ...propose,
  state: 'friday',
  card: {
    label: 'Friday’s question',
    lead: 'Did Bill move?',
    line: 'It was 7.5 weeks and $142k when called. Today it is 5.9 weeks and $112k.',
    moves: [move({ key: 'bill', title: 'Bill the 11 finished jobs.', why: 'It was $142k. Today it is $64k.', who: 'Dana', then: 142_000, done: 'yes', doneText: 'done' })],
    press: null,
    foot: 'The numbers say it moved. Your answer is the one kept.',
    tone: 'ask',
  },
}

describe('BridgeWeek', () => {
  it('draws the three tiles, the call and its moves, and records what is left on', () => {
    const onRecord = vi.fn()
    renderWithProviders(<BridgeWeek model={propose} recording={false} answering={false} onRecord={onRecord} onAnswer={() => {}} onPickStep={() => {}} onCashNote={() => {}} />)
    expect(screen.getByTestId('bridge-week-tile-step').textContent).toContain('Bill')
    expect(screen.getByTestId('bridge-week-tile-cash').textContent).toContain('$12.0k')
    expect(screen.getByTestId('bridge-week-lead').textContent).toBe('Bill is the slowest step.')
    expect(screen.getAllByTestId('bridge-week-move').length).toBe(3)
    // A move with a door is a link to it.
    expect(screen.getByRole('link', { name: /Bill the 11 finished jobs/ }).getAttribute('href')).toBe('/jobs?tab=stages')
    // Until a first call exists, the desk says how the week runs.
    // The side panel that said how the week runs is off the page.
    expect(screen.queryByTestId('bridge-week-how')).toBeNull()
    // Take the third move off, rename the second move's person, record.
    fireEvent.click(screen.getByRole('button', { name: /Take off the call: Take bank sorting/ }))
    fireEvent.click(screen.getByRole('button', { name: /Sam does: Price the 4 jobs/ }))
    const box = screen.getByRole('textbox', { name: 'Who does: Price the 4 jobs with no price.' })
    fireEvent.change(box, { target: { value: 'Jorge' } })
    fireEvent.blur(box)
    fireEvent.click(screen.getByTestId('bridge-week-record'))
    expect(onRecord).toHaveBeenCalledWith(
      'bill',
      [
        { key: 'bill', title: 'Bill the 11 finished jobs.', who: 'Dana', whoId: null, then: 142_000 },
        { key: 'price', title: 'Price the 4 jobs with no price.', who: 'Jorge', whoId: null, then: 4 },
      ],
      null,
    )
  })

  it('picks a person from the accounts, so the move carries who it reaches (PR 4)', () => {
    const onRecord = vi.fn()
    // Made-up accounts; the first move is proposed for Dana's account.
    const people = [{ id: 'u-dana', name: 'Dana Reyes' }, { id: 'u-jorge', name: 'Jorge Luna' }, { id: 'u-sam', name: 'Sam Holt' }]
    const withIds: WeekCallModel = { ...propose, card: { ...propose.card, moves: propose.card.moves.map((m, i) => (i === 0 ? { ...m, whoId: 'u-dana' } : m)) } }
    renderWithProviders(<BridgeWeek model={withIds} recording={false} answering={false} onRecord={onRecord} onAnswer={() => {}} onPickStep={() => {}} onCashNote={() => {}} people={people} />)
    // The second move was proposed for a name with no account: its chip says so.
    expect(screen.getByRole('button', { name: /Sam does: Price the 4 jobs/ }).getAttribute('title')).toBe('No account, so this move reaches nobody’s Needs you.')
    expect(screen.getByRole('button', { name: /Dana does: Bill the 11 finished jobs/ }).getAttribute('title')).toBeNull()
    // Press it: a pick from the accounts, not a box to type in.
    fireEvent.click(screen.getByRole('button', { name: /Sam does: Price the 4 jobs/ }))
    const pick = screen.getByRole('combobox', { name: 'Who does: Price the 4 jobs with no price.' })
    expect(Array.from(pick.querySelectorAll('option')).map((o) => o.textContent)).toEqual(['Nobody', 'Dana Reyes', 'Jorge Luna', 'Sam Holt', 'Type a name…'])
    fireEvent.change(pick, { target: { value: 'u-jorge' } })
    expect(screen.getByRole('button', { name: /Jorge does: Price the 4 jobs/ })).toBeTruthy()
    // The third move: a typed name, which reaches nobody.
    fireEvent.click(screen.getByRole('button', { name: /Name who does: Take bank sorting/ }))
    fireEvent.change(screen.getByRole('combobox', { name: /Who does: Take bank sorting/ }), { target: { value: '__type_a_name__' } })
    const box = screen.getByRole('textbox', { name: /Who does: Take bank sorting/ })
    fireEvent.change(box, { target: { value: 'the office' } })
    fireEvent.blur(box)
    fireEvent.click(screen.getByTestId('bridge-week-record'))
    expect(onRecord.mock.calls[0]?.[1].map((m: { who: string; whoId: string | null }) => [m.who, m.whoId])).toEqual([['Dana', 'u-dana'], ['Jorge', 'u-jorge'], ['the office', null]])
  })

  it('takes a note with the call, and shows it under a call that stands (v2.6840)', () => {
    const onRecord = vi.fn()
    const { unmount } = renderWithProviders(<BridgeWeek model={propose} recording={false} answering={false} onRecord={onRecord} onAnswer={() => {}} onPickStep={() => {}} onCashNote={() => {}} />)
    expect(screen.queryByTestId('bridge-week-note-input')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add a note ›' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'A note on the call' }), { target: { value: '  Ridgeway pays on the 20th if billed by Friday.  ' } })
    fireEvent.click(screen.getByTestId('bridge-week-record'))
    expect(onRecord.mock.calls[0]?.[2]).toBe('Ridgeway pays on the 20th if billed by Friday.')
    unmount()
    renderWithProviders(<BridgeWeek model={{ ...friday, card: { ...friday.card, note: 'Ridgeway pays on the 20th if billed by Friday.' } }} recording={false} answering={false} onRecord={() => {}} onAnswer={() => {}} onPickStep={() => {}} onCashNote={() => {}} />)
    expect(screen.getByTestId('bridge-week-note').textContent).toBe('Note. Ridgeway pays on the 20th if billed by Friday.')
    expect(screen.queryByRole('button', { name: 'Add a note ›' })).toBeNull()
  })

  it('brings the next move on when one is taken off, and keeps the one taken off with its way back (v2.6840)', () => {
    const four: WeekCallModel = { ...propose, card: { ...propose.card, moves: [...propose.card.moves, move({ title: 'Mark a job ready to bill the day it finishes.' })] } }
    const onRecord = vi.fn()
    renderWithProviders(<BridgeWeek model={four} recording={false} answering={false} onRecord={onRecord} onAnswer={() => {}} onPickStep={() => {}} onCashNote={() => {}} />)
    expect(screen.getAllByTestId('bridge-week-move').length).toBe(3)
    expect(screen.queryByText('Mark a job ready to bill the day it finishes.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Take off the call: Price the 4 jobs/ }))
    expect(screen.getAllByTestId('bridge-week-move').length).toBe(4)
    expect(screen.getByText('Mark a job ready to bill the day it finishes.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Put back on the call: Price the 4 jobs/ })).toBeTruthy()
    fireEvent.click(screen.getByTestId('bridge-week-record'))
    expect(onRecord.mock.calls[0]?.[1].map((m: { title: string }) => m.title)).toEqual(['Bill the 11 finished jobs.', 'Take bank sorting off whoever bills, so billing is never idle.', 'Mark a job ready to bill the day it finishes.'])
  })

  it('says under the cash tile which account is left out, and the sentence opens the list', () => {
    const note = 'Leaves out Accounts Payable 2222, $12.4k.'
    const left: WeekCallModel = { ...propose, tiles: tiles.map((t) => (t.id === 'cash' ? { ...t, note } : t)) }
    const onCashNote = vi.fn()
    const onPickStep = vi.fn()
    renderWithProviders(<BridgeWeek model={left} recording={false} answering={false} onRecord={() => {}} onAnswer={() => {}} onPickStep={onPickStep} onCashNote={onCashNote} />)
    const press = screen.getByTestId('bridge-week-tile-note')
    expect(press.textContent).toBe(note)
    fireEvent.click(press)
    expect(onCashNote).toHaveBeenCalledTimes(1)
    // Pick another step opens The flow, where a press on a step makes it the proposal.
    fireEvent.click(screen.getByRole('button', { name: 'Pick another step ›' }))
    expect(onPickStep).toHaveBeenCalledTimes(1)
  })

  it('draws the strip of pipe under the tiles in a usual week, and under the card in a week cash leads (PR 3)', () => {
    const strip = <div data-testid="the-strip">pipe</div>
    const { unmount } = renderWithProviders(<BridgeWeek model={propose} recording={false} answering={false} onRecord={() => {}} onAnswer={() => {}} onPickStep={() => {}} onCashNote={() => {}} strip={strip} />)
    const before = (a: HTMLElement, b: HTMLElement): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(before(screen.getByTestId('bridge-week-tile-step'), screen.getByTestId('the-strip'))).toBe(true)
    expect(before(screen.getByTestId('the-strip'), screen.getByTestId('bridge-week-card'))).toBe(true)
    unmount()
    renderWithProviders(<BridgeWeek model={{ ...propose, cashLeads: true }} recording={false} answering={false} onRecord={() => {}} onAnswer={() => {}} onPickStep={() => {}} onCashNote={() => {}} strip={strip} />)
    expect(screen.getAllByTestId('the-strip').length).toBe(1)
    expect(before(screen.getByTestId('bridge-week-card'), screen.getByTestId('the-strip'))).toBe(true)
  })

  it('sets the standing pipe beside the card at a desk, once, in a usual week and in a week cash leads (#318)', () => {
    const strip = <div data-testid="the-strip">pipe</div>
    const before = (a: HTMLElement, b: HTMLElement): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    for (const model of [propose, { ...propose, cashLeads: true }]) {
      const { unmount } = renderWithProviders(<BridgeWeek model={model} recording={false} answering={false} onRecord={() => {}} onAnswer={() => {}} onPickStep={() => {}} onCashNote={() => {}} strip={strip} stripSide />)
      expect(screen.getAllByTestId('the-strip').length).toBe(1)
      // The pipe and the card share one row: the pipe's column comes first.
      const row = screen.getByTestId('the-strip').parentElement?.parentElement
      expect(row?.style.gridTemplateColumns).toBe('minmax(260px, 340px) minmax(0, 1fr)')
      expect(row?.contains(screen.getByTestId('bridge-week-card'))).toBe(true)
      expect(before(screen.getByTestId('the-strip'), screen.getByTestId('bridge-week-card'))).toBe(true)
      unmount()
    }
  })

  it('never records an empty call', () => {
    const onRecord = vi.fn()
    renderWithProviders(<BridgeWeek model={propose} recording={false} answering={false} onRecord={onRecord} onAnswer={() => {}} onPickStep={() => {}} onCashNote={() => {}} />)
    for (const b of screen.getAllByRole('button', { name: /Take off the call/ })) fireEvent.click(b)
    const press = screen.getByTestId('bridge-week-record') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.title).toBe('Put a move on the call first.')
    fireEvent.click(press)
    expect(onRecord).not.toHaveBeenCalled()
  })

  it('asks on Friday and takes the answer', () => {
    const onAnswer = vi.fn()
    renderWithProviders(<BridgeWeek model={friday} recording={false} answering={false} onRecord={() => {}} onAnswer={onAnswer} onPickStep={() => {}} onCashNote={() => {}} />)
    expect(screen.getByTestId('bridge-week-lead').textContent).toBe('Did Bill move?')
    expect(screen.queryByTestId('bridge-week-record')).toBeNull()
    expect(screen.getByTestId('bridge-week-move').textContent).toContain('done')
    fireEvent.click(screen.getByRole('button', { name: 'It did not' }))
    expect(onAnswer).toHaveBeenCalledWith('did_not_move')
  })

  it('asks for the answer an earlier call never got, beside this week’s proposal', () => {
    const onAnswer = vi.fn()
    const withLast: WeekCallModel = { ...propose, last: { linkName: 'Collect', text: 'The last call was Collect. Did it move?', tone: 'amber', asks: true, consequence: '', moves: [{ title: 'Chase the 6 late invoices.', who: 'Dana', doneText: 'done', done: 'yes' }] } }
    renderWithProviders(<BridgeWeek model={withLast} recording={false} answering={false} onRecord={() => {}} onAnswer={onAnswer} onPickStep={() => {}} onCashNote={() => {}} />)
    expect(screen.getByTestId('bridge-week-last').textContent).toContain('The last call was Collect. Did it move?')
    expect(screen.queryByTestId('bridge-week-how')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'It moved' }))
    expect(onAnswer).toHaveBeenCalledWith('moved')
  })
})
