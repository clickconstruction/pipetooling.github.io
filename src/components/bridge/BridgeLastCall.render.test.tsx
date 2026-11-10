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
  it('says what the step is and today’s reading, and sends the reader up to the call', () => {
    const onGoToCall = vi.fn()
    renderWithProviders(<BridgeLinkDesk link="bill" status="nominated by the page" todayReading="$233k finished and not yet billed." thisWeekCall={null} dayLabel={(y) => y} onGoToCall={onGoToCall} />)
    expect(screen.getByTestId('bridge-link-desk-today').textContent).toBe('$233k finished and not yet billed.')
    expect(screen.getByTestId('bridge-link-desk-call').textContent).toBe('The card at the top proposes the call on Bill, with a person on each move.')
    // The moves, the owner box on each and the record press left for the first screen's card (punch list #303, cut 5).
    expect(screen.queryByLabelText('Owner of: Bill the finished work.')).toBeNull()
    expect(screen.queryByTestId('bridge-link-desk-record')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Go to this week’s call ↑' }))
    expect(onGoToCall).toHaveBeenCalledTimes(1)
  })
  it('says which step this week’s call is on', () => {
    renderWithProviders(<BridgeLinkDesk link="decision" status="recorded as the link this week" todayReading="Four piles." thisWeekCall={call} dayLabel={(y) => y} onGoToCall={() => {}} />)
    expect(screen.getByTestId('bridge-link-desk-recorded').textContent).toContain('This week\'s call: Decision, recorded 2026-10-03 by Todd')
    renderWithProviders(<BridgeLinkDesk link="bill" status="picked" todayReading="x" thisWeekCall={call} dayLabel={(y) => y} onGoToCall={() => {}} />)
    expect(screen.getAllByTestId('bridge-link-desk-call')[0]?.textContent).toBe('This week’s call is Decision.')
  })
})
