// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeLastCall } from './BridgeLastCall'
import { BridgeLinkDesk } from './BridgeLinkDesk'
import { buildScorecard, type BridgeCall } from '../../lib/bridge/calls'

const call: BridgeCall = {
  id: 'c1',
  weekStart: '2026-10-04',
  calledOn: '2026-10-03',
  calledByName: 'Todd',
  link: 'decision',
  moves: [
    { key: 'approve', title: 'Approve the hours waiting on the schedule.', who: 'Todd', then: 585 },
    { key: 'price', title: 'Price the unpriced jobs this week.', who: 'Todd', then: 2 },
  ],
  measures: { linkWeeks: null, stageWeeks: {}, keys: { approve: 585, price: 2 } },
  note: null,
  outcome: null,
  outcomeAt: null,
  outcomeNote: null,
}

describe('BridgeLastCall', () => {
  it('draws the scorecard and takes Friday’s answer', () => {
    const card = buildScorecard({ call, calls: [call], now: { stageWeeks: {}, keys: { approve: 585, price: 2 } }, todayYmd: '2026-10-10', dayLabel: (y) => y })
    const onAnswer = vi.fn()
    renderWithProviders(<BridgeLastCall card={card} answering={false} onAnswer={onAnswer} />)
    expect(screen.getByTestId('bridge-last-call-verdict').textContent).toBe('open')
    expect(screen.getAllByText('585h').length).toBe(2)
    expect(screen.getByTestId('bridge-last-call-friday')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'It did not' }))
    expect(onAnswer).toHaveBeenCalledWith('did_not_move', null)
  })
  it('says there is no call yet', () => {
    renderWithProviders(<BridgeLastCall card={null} answering={false} onAnswer={() => {}} />)
    expect(screen.getByTestId('bridge-last-call').textContent).toContain('No call yet')
  })
})

describe('BridgeLinkDesk', () => {
  it('lists the moves with an owner each and records the ones left on', () => {
    const onRecord = vi.fn()
    renderWithProviders(<BridgeLinkDesk link="bill" status="nominated by the page" todayReading="$233k finished and not yet billed." moveNumbers={{ bill: 233_000, price: 6 }} thisWeekCall={null} recording={false} onRecord={onRecord} dayLabel={(y) => y} />)
    expect(screen.getByTestId('bridge-link-desk-today').textContent).toBe('$233k finished and not yet billed.')
    fireEvent.change(screen.getByLabelText('Owner of: Bill the finished work.'), { target: { value: 'Taunya' } })
    fireEvent.click(screen.getByTestId('bridge-link-desk-record'))
    expect(onRecord).toHaveBeenCalledTimes(1)
    const [moves, note] = onRecord.mock.calls[0]!
    expect(note).toBeNull()
    expect(moves[0]).toEqual({ key: 'bill', title: 'Bill the finished work.', who: 'Taunya', then: 233_000 })
    expect(moves.length).toBe(4)
  })
  it('shows the recorded call instead of the button', () => {
    renderWithProviders(<BridgeLinkDesk link="decision" status="recorded as the link this week" todayReading="Four piles." moveNumbers={{}} thisWeekCall={call} recording={false} onRecord={() => {}} dayLabel={(y) => y} />)
    expect(screen.getByTestId('bridge-link-desk-recorded').textContent).toContain('This week\'s call: Decision, recorded 2026-10-03 by Todd')
    expect(screen.queryByTestId('bridge-link-desk-record')).toBeNull()
  })
})
