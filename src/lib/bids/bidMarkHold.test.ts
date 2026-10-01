import { describe, expect, it } from 'vitest'
import { HOLD_IDLE, holdStep, type HoldState } from './bidMarkHold'

const down = (x = 10, y = 10, primary = true) => ({ type: 'down' as const, x, y, primary })

function run(events: Parameters<typeof holdStep>[1][], from: HoldState = HOLD_IDLE) {
  let state = from
  const out: ReturnType<typeof holdStep>[] = []
  for (const ev of events) {
    const r = holdStep(state, ev)
    out.push(r)
    state = r.state
  }
  return { state, out, last: out[out.length - 1] }
}

describe('holdStep', () => {
  it('a primary press arms the timer; the timer fires once and the following click is swallowed', () => {
    const { out, state } = run([down(), { type: 'timer' }, { type: 'up' }, { type: 'click' }])
    expect(out[0]).toMatchObject({ startTimer: true, fire: false, state: { phase: 'holding', x: 10, y: 10 } })
    expect(out[1]).toMatchObject({ fire: true, state: { phase: 'fired' } })
    expect(out[2]).toMatchObject({ fire: false, swallowClick: false, state: { phase: 'fired' } })
    expect(out[3]).toMatchObject({ swallowClick: true, state: { phase: 'idle' } })
    expect(state).toEqual(HOLD_IDLE)
  })

  it('letting go early stops the timer and the click opens the row as usual', () => {
    const { out } = run([down(), { type: 'up' }, { type: 'click' }])
    expect(out[1]).toMatchObject({ stopTimer: true, state: { phase: 'idle' } })
    expect(out[2]).toMatchObject({ swallowClick: false })
  })

  it('a late timer after an early release does nothing', () => {
    const { last } = run([down(), { type: 'up' }, { type: 'timer' }])
    expect(last).toMatchObject({ fire: false, state: { phase: 'idle' } })
  })

  it('moving further than the slop is a scroll: the hold cancels, a small drift does not', () => {
    const drift = run([down(), { type: 'move', x: 14, y: 12 }])
    expect(drift.last).toMatchObject({ stopTimer: false, state: { phase: 'holding' } })
    const scroll = run([down(), { type: 'move', x: 10, y: 40 }])
    expect(scroll.last).toMatchObject({ stopTimer: true, state: { phase: 'idle' } })
  })

  it('pointer cancel and leave read as a release', () => {
    expect(run([down(), { type: 'cancel' }]).last).toMatchObject({ stopTimer: true, state: { phase: 'idle' } })
  })

  it('a right click or a second finger never starts a hold, and cancels one that was running', () => {
    expect(run([down(10, 10, false)]).last).toMatchObject({ startTimer: false, state: { phase: 'idle' } })
    expect(run([down(), down(10, 10, false)]).last).toMatchObject({ stopTimer: true, state: { phase: 'idle' } })
  })

  it('a click with no hold behind it is never swallowed, and a fresh press after a fire resets the row', () => {
    expect(run([{ type: 'click' }]).last).toMatchObject({ swallowClick: false })
    const { out } = run([down(), { type: 'timer' }, down(20, 20)])
    expect(out[2]).toMatchObject({ startTimer: true, state: { phase: 'holding', x: 20, y: 20 } })
  })

  it('a release or a move after the fire leaves the fired phase alone until the click', () => {
    const { out } = run([down(), { type: 'timer' }, { type: 'move', x: 90, y: 90 }, { type: 'up' }])
    expect(out[2]?.state.phase).toBe('fired')
    expect(out[3]?.state.phase).toBe('fired')
  })
})
