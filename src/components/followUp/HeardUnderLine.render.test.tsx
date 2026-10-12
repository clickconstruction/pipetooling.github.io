// @vitest-environment jsdom
/**
 * Messages, cut 2's screens, C3: what a line was heard as, on its own (v2.5324). A plans question on a line on no GC
 * project offers only Answer it myself, since there is no project for the architect to answer on; a day heard from a
 * customer offers a customer's kinds.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeardUnderLine, type HeardUnderLineProps } from './HeardUnderLine'

afterEach(cleanup)

function under(over: Partial<HeardUnderLineProps>) {
  const props: HeardUnderLineProps = {
    line: { messageId: 'm1', contactId: 'greg', at: '2026-10-01T14:00:00.000Z', kind: 'question', state: 'offered' },
    person: { kind: 'trade', name: 'Greg Paulk', company: 'Hillside Excavation', trade: 'Sitework' },
    jobName: null,
    onGcProject: false,
    busy: false,
    onWrite: vi.fn(),
    onJustTalk: vi.fn(),
    onAsk: vi.fn(),
    onAnswerMyself: vi.fn(),
    ...over,
  }
  render(<HeardUnderLine {...props} />)
  return props
}

describe('HeardUnderLine', () => {
  it('a plans question on no GC project offers only Answer it myself', () => {
    const p = under({})
    expect(screen.queryByRole('button', { name: 'Ask the architect' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Answer it myself' }))
    expect(p.onAnswerMyself).toHaveBeenCalledTimes(1)
  })

  it('a day heard from a customer offers a customer’s kinds, the likely one first', () => {
    const p = under({
      line: { messageId: 'm2', contactId: 'elena', at: '2026-10-01T14:00:00.000Z', kind: null, state: 'offered', dayYmd: '2026-10-09' },
      person: { kind: 'customer', name: 'Elena Marchetti', company: 'Cibolo Creek Partners' },
      jobName: 'Fair Oaks Shops',
    })
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['A payment', 'Their answer on our bid', 'A day we can be on site', 'just talk'])
    fireEvent.click(screen.getByRole('button', { name: 'A payment' }))
    expect(vi.mocked(p.onWrite).mock.calls[0]![0]).toMatchObject({ kind: 'payment', what: 'a payment on Fair Oaks Shops' })
  })
})
