import { describe, expect, it } from 'vitest'
import { newPress, type OutboxPress, type OutboxState } from './outbox'
import { clockPressStates, clockReadsAgain, clockReadWithKeptPresses, pressSessionId } from './pendingSession'

const AT = Date.parse('2026-10-30T15:57:00.000Z')
const MIN = 60 * 1000

function clockIn(id: string, seq: number, pressedAt: number, state: OutboxState = 'waiting'): OutboxPress {
  return { ...newPress({ id, seq, kind: 'clock-in', userId: 'u1', pressedAt, payload: { jobLedgerId: 'job-1', bidId: null, notes: 'Rough-in', travel: null } }), state }
}

function clockOut(id: string, seq: number, pressedAt: number, on: { sessionId?: string; pressId?: string }, state: OutboxState = 'waiting'): OutboxPress {
  return {
    ...newPress({ id, seq, kind: 'clock-out', userId: 'u1', pressedAt, dependsOn: on.pressId ?? null, payload: { sessionId: on.sessionId ?? null, sessionPressId: on.pressId ?? null, jobLedgerId: 'job-1', bidId: null, notes: 'Rough-in' } }),
    state,
  }
}

function note(id: string, seq: number): OutboxPress {
  return newPress({ id, seq, kind: 'job-note', userId: 'u1', pressedAt: AT, payload: { jobId: 'job-1', body: 'Done' } })
}

const open = { id: 's1', clocked_in_at: new Date(AT - 120 * MIN).toISOString(), clocked_out_at: null }
const earlier = { id: 's0', clocked_in_at: new Date(AT - 240 * MIN).toISOString(), clocked_out_at: new Date(AT - 180 * MIN).toISOString() }

describe('clockReadWithKeptPresses · the clock as the phone knows it', () => {
  it('a read with nothing on the phone is the read', () => {
    expect(clockReadWithKeptPresses({ open, today: [earlier, open] }, [])).toEqual({ open, today: [earlier, open] })
  })

  it('a clock-out still on the phone closes its session at the moment it was pressed, though the server still has it open', () => {
    const view = clockReadWithKeptPresses({ open, today: [earlier, open] }, [clockOut('o1', 1, AT, { sessionId: 's1' })])
    expect(view.open).toBeNull()
    expect(view.today).toEqual([earlier, { ...open, clocked_out_at: new Date(AT).toISOString() }])
  })

  it('so does one in flight; a refused or a landed clock-out lays nothing over the read', () => {
    expect(clockReadWithKeptPresses({ open, today: [open] }, [clockOut('o1', 1, AT, { sessionId: 's1' }, 'sending')]).open).toBeNull()
    expect(clockReadWithKeptPresses({ open, today: [open] }, [clockOut('o1', 1, AT, { sessionId: 's1' }, 'refused')]).open).toEqual(open)
    expect(clockReadWithKeptPresses({ open, today: [open] }, [clockOut('o1', 1, AT, { sessionId: 's1' }, 'sent')]).open).toEqual(open)
  })

  it('a clock-in still on the phone is the open session when the server has none, and joins today', () => {
    const view = clockReadWithKeptPresses({ open: null, today: [earlier] }, [clockIn('i1', 1, AT)])
    expect(view.open?.id).toBe(pressSessionId('i1'))
    expect(view.open?.clocked_in_at).toBe(new Date(AT).toISOString())
    expect(view.today.map((s) => s.id)).toEqual(['s0', pressSessionId('i1')])
  })

  it('the server’s open session stands over a clock-in still on the phone', () => {
    const view = clockReadWithKeptPresses({ open, today: [open] }, [clockIn('i1', 1, AT)])
    expect(view.open).toEqual(open)
    expect(view.today).toEqual([open])
  })

  it('a clock-in and its clock-out both on the phone: nothing open, and the stretch between them is part of today', () => {
    const view = clockReadWithKeptPresses({ open: null, today: [earlier] }, [clockIn('i1', 1, AT), clockOut('o1', 2, AT + 30 * MIN, { pressId: 'i1' })])
    expect(view.open).toBeNull()
    expect(view.today).toHaveLength(2)
    expect(view.today[1]).toMatchObject({ id: pressSessionId('i1'), clocked_in_at: new Date(AT).toISOString(), clocked_out_at: new Date(AT + 30 * MIN).toISOString() })
  })

  it('laid over the clock as drawn, when no read landed, it changes nothing that is already there', () => {
    for (const presses of [[clockIn('i1', 1, AT)], [clockOut('o1', 1, AT, { sessionId: 's1' }), clockIn('i2', 2, AT + 1)], [clockIn('i1', 1, AT), clockOut('o1', 2, AT + MIN, { pressId: 'i1' })]]) {
      const once = clockReadWithKeptPresses({ open, today: [earlier, open] }, presses)
      expect(clockReadWithKeptPresses(once, presses)).toEqual(once)
    }
  })

  it('a Dashboard opened with no signal draws a kept clock-in over an empty clock', () => {
    const view = clockReadWithKeptPresses({ open: null, today: [] }, [clockIn('i1', 1, AT)])
    expect(view.open?.id).toBe(pressSessionId('i1'))
    expect(view.today.map((s) => s.id)).toEqual([pressSessionId('i1')])
  })

  it('a row drawn for a press goes once the press is dropped or refused, and stays once it landed', () => {
    const drawn = clockReadWithKeptPresses({ open: null, today: [earlier] }, [clockIn('i1', 1, AT)])
    expect(clockReadWithKeptPresses(drawn, [])).toEqual({ open: null, today: [earlier] })
    expect(clockReadWithKeptPresses(drawn, [clockIn('i1', 1, AT, 'refused')])).toEqual({ open: null, today: [earlier] })
    const landed = clockReadWithKeptPresses(drawn, [clockIn('i1', 1, AT, 'sent')])
    expect(landed.open?.id).toBe(pressSessionId('i1'))
    expect(landed.today.map((s) => s.id)).toEqual(['s0', pressSessionId('i1')])
  })

  it('the hourly switch on the phone: the old session closed at the press, the new one open from it', () => {
    const view = clockReadWithKeptPresses({ open, today: [open] }, [clockOut('o1', 1, AT, { sessionId: 's1' }), clockIn('i1', 2, AT + 1)])
    expect(view.open?.id).toBe(pressSessionId('i1'))
    expect(view.today.map((s) => [s.id, s.clocked_out_at])).toEqual([
      ['s1', new Date(AT).toISOString()],
      [pressSessionId('i1'), null],
    ])
  })
})

describe('clockReadsAgain · when the clock reads again', () => {
  it('a press it already knew landing, refused or gone reads again, signal or not', () => {
    const before = clockPressStates([clockOut('o1', 1, AT, { sessionId: 's1' })])
    for (const online of [true, false]) {
      expect(clockReadsAgain(before, clockPressStates([clockOut('o1', 1, AT, { sessionId: 's1' }, 'sent')]), online)).toBe(true)
      expect(clockReadsAgain(before, clockPressStates([clockOut('o1', 1, AT, { sessionId: 's1' }, 'refused')]), online)).toBe(true)
      expect(clockReadsAgain(before, clockPressStates([]), online)).toBe(true)
    }
  })

  it('a press kept with no signal reads nothing: it drew itself, and the read could only fail under it', () => {
    expect(clockReadsAgain(clockPressStates([]), clockPressStates([clockIn('i1', 1, AT)]), false)).toBe(false)
    const before = clockPressStates([clockIn('i1', 1, AT)])
    expect(clockReadsAgain(before, clockPressStates([clockIn('i1', 1, AT), clockOut('o1', 2, AT + MIN, { pressId: 'i1' })]), false)).toBe(false)
  })

  it('a press it had not seen, appearing while the browser says online, reads again: one read back from the device', () => {
    expect(clockReadsAgain(clockPressStates([]), clockPressStates([clockIn('i1', 1, AT)]), true)).toBe(true)
  })

  it('a try in flight or a try that failed reads nothing', () => {
    const waiting = clockPressStates([clockIn('i1', 1, AT)])
    const sending = clockPressStates([clockIn('i1', 1, AT, 'sending')])
    expect(clockReadsAgain(waiting, sending, true)).toBe(false)
    expect(clockReadsAgain(sending, waiting, true)).toBe(false)
  })

  it('a note or a report is not the clock’s', () => {
    expect(clockReadsAgain(clockPressStates([note('n1', 1)]), clockPressStates([]), true)).toBe(false)
    expect(clockReadsAgain(clockPressStates([]), clockPressStates([note('n1', 1)]), true)).toBe(false)
  })
})
