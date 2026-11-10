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
    renderWithProviders(<BridgeWeek model={propose} softCount={5} recording={false} answering={false} onRecord={onRecord} onAnswer={() => {}} />)
    expect(screen.getByTestId('bridge-week-tile-step').textContent).toContain('Bill')
    expect(screen.getByTestId('bridge-week-tile-cash').textContent).toContain('$12.0k')
    expect(screen.getByTestId('bridge-week-lead').textContent).toBe('Bill is the slowest step.')
    expect(screen.getAllByTestId('bridge-week-move').length).toBe(3)
    // A move with a door is a link to it.
    expect(screen.getByRole('link', { name: /Bill the 11 finished jobs/ }).getAttribute('href')).toBe('/jobs?tab=stages')
    expect(screen.getByTestId('bridge-week-soft').textContent).toContain('5 soft numbers')
    // Until a first call exists, the desk says how the week runs.
    expect(screen.getByTestId('bridge-week-how').textContent).toContain('Monday you make the call.')
    // Take the third move off, rename the second move's person, record.
    fireEvent.click(screen.getByRole('button', { name: /Take off the call: Take bank sorting/ }))
    fireEvent.click(screen.getByRole('button', { name: /Sam does: Price the 4 jobs/ }))
    const box = screen.getByRole('textbox', { name: 'Who does: Price the 4 jobs with no price.' })
    fireEvent.change(box, { target: { value: 'Jorge' } })
    fireEvent.blur(box)
    fireEvent.click(screen.getByTestId('bridge-week-record'))
    expect(onRecord).toHaveBeenCalledWith('bill', [
      { key: 'bill', title: 'Bill the 11 finished jobs.', who: 'Dana', then: 142_000 },
      { key: 'price', title: 'Price the 4 jobs with no price.', who: 'Jorge', then: 4 },
    ])
  })

  it('never records an empty call', () => {
    const onRecord = vi.fn()
    renderWithProviders(<BridgeWeek model={propose} softCount={0} recording={false} answering={false} onRecord={onRecord} onAnswer={() => {}} />)
    for (const b of screen.getAllByRole('button', { name: /Take off the call/ })) fireEvent.click(b)
    const press = screen.getByTestId('bridge-week-record') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.title).toBe('Put a move on the call first.')
    fireEvent.click(press)
    expect(onRecord).not.toHaveBeenCalled()
    expect(screen.queryByTestId('bridge-week-soft')).toBeNull()
  })

  it('asks on Friday and takes the answer', () => {
    const onAnswer = vi.fn()
    renderWithProviders(<BridgeWeek model={friday} softCount={0} recording={false} answering={false} onRecord={() => {}} onAnswer={onAnswer} />)
    expect(screen.getByTestId('bridge-week-lead').textContent).toBe('Did Bill move?')
    expect(screen.queryByTestId('bridge-week-record')).toBeNull()
    expect(screen.getByTestId('bridge-week-move').textContent).toContain('done')
    fireEvent.click(screen.getByRole('button', { name: 'It did not' }))
    expect(onAnswer).toHaveBeenCalledWith('did_not_move')
  })

  it('asks for the answer an earlier call never got, beside this week’s proposal', () => {
    const onAnswer = vi.fn()
    const withLast: WeekCallModel = { ...propose, last: { linkName: 'Collect', text: 'The last call was Collect. Did it move?', tone: 'amber', asks: true, consequence: '', moves: [{ title: 'Chase the 6 late invoices.', who: 'Dana', doneText: 'done', done: 'yes' }] } }
    renderWithProviders(<BridgeWeek model={withLast} softCount={0} recording={false} answering={false} onRecord={() => {}} onAnswer={onAnswer} />)
    expect(screen.getByTestId('bridge-week-last').textContent).toContain('The last call was Collect. Did it move?')
    expect(screen.queryByTestId('bridge-week-how')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'It moved' }))
    expect(onAnswer).toHaveBeenCalledWith('moved')
  })
})
