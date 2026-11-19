/**
 * Named numbers on the Pricing Tape: a number dragged in from the bid keeps its name, and a sum
 * that is one named group times one plain number carries the rule a Percent row can follow.
 * The plain math is pinned in `tapeCalculator.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { applyNamed, deserializeTape, initialCalcState, keyboardCalcKey, pressBackspace, pressDigit, pressEquals, pressOp, pressPercent, rollBackTo, tapeRuleOf, type CalcState, type TapeSource } from './tapeCalculator'

const NOW = 1_795_000_000_000
const PIPE: TapeSource = { words: 'Pipe revenue', basis: 'revenue', sourceKey: 'kind:pipe' }
const PIPE_FEET: TapeSource = { words: 'Pipe count', basis: 'count', sourceKey: 'kind:pipe' }
const WC: TapeSource = { words: 'WC revenue', basis: 'revenue', sourceKey: null }

/** Types keys as the keyboard would; `=` returns the state after it. */
function type(state: CalcState, keys: string): CalcState {
  let s = state
  for (const k of keys) {
    const a = keyboardCalcKey(k)
    if (!a) continue
    if (a.kind === 'digit') s = pressDigit(s, a.d)
    else if (a.kind === 'op') s = pressOp(s, a.op)
    else if (a.kind === 'percent') s = pressPercent(s)
    else if (a.kind === 'backspace') s = pressBackspace(s)
  }
  return s
}
const drop = (state: CalcState, source: TapeSource, value: number) => applyNamed(state, source, value, NOW)

describe('a number dragged in from the bid', () => {
  it('prints its own line and stands on the display, named', () => {
    const { state, entry } = drop(initialCalcState, PIPE, 6200)
    expect(entry).toMatchObject({ expr: 'Pipe revenue', result: 6200, source: PIPE })
    expect(state).toMatchObject({ current: '6200', pending: null, justEvaluated: true, named: PIPE })
  })

  it('in the middle of a sum it is the next number and prints no line of its own', () => {
    const { state, entry } = drop(type(initialCalcState, '.4*'), PIPE, 6200)
    expect(entry).toBeNull()
    expect(state).toMatchObject({ current: '6200', named: PIPE, justEvaluated: false })
    expect(state.pending).toEqual({ acc: 0.4, op: '×' })
  })

  it('a number that is not one is refused', () => {
    expect(drop(initialCalcState, PIPE, Number.NaN)).toEqual({ state: initialCalcState, entry: null })
  })

  it('a typed digit, a backspace or % makes the display a plain number again', () => {
    const named = drop(type(initialCalcState, '2*'), PIPE, 6200).state
    expect(pressDigit(named, '5').named).toBeNull()
    expect(pressBackspace(named).named).toBeNull()
    expect(pressPercent(named).named).toBeNull()
  })
})

describe('the rule behind a sum', () => {
  it('Pipe revenue × 0.4 is 40% of the pipe’s revenue, and the tape line says so', () => {
    const s = type(drop(initialCalcState, PIPE, 6200).state, '*.4')
    expect(tapeRuleOf(s)).toEqual({ pct: 40, basis: 'revenue', sourceKey: 'kind:pipe' })
    const { state, entry } = pressEquals(s, NOW)
    expect(entry).toMatchObject({ expr: 'Pipe revenue × 0.4', result: 2480, rule: { pct: 40, basis: 'revenue', sourceKey: 'kind:pipe' } })
    expect(state).toMatchObject({ current: '2480', justEvaluated: true, named: null, firstNamed: null })
  })

  it('reads the same in the other order, and with the % key', () => {
    const other = drop(type(initialCalcState, '.375*'), PIPE, 6200).state
    expect(pressEquals(other, NOW).entry).toMatchObject({ expr: '0.375 × Pipe revenue', result: 2325, rule: { pct: 37.5, basis: 'revenue', sourceKey: 'kind:pipe' } })
    const percentKey = type(drop(initialCalcState, PIPE, 6200).state, '*40%')
    expect(pressEquals(percentKey, NOW).entry?.rule).toEqual({ pct: 40, basis: 'revenue', sourceKey: 'kind:pipe' })
  })

  it.each([
    ['a plus in place of a times', (s: CalcState) => type(s, '+.4')],
    ['a third number', (s: CalcState) => type(s, '*.4*2')],
    ['a factor of zero', (s: CalcState) => type(s, '*0')],
    ['a percent over 1,000', (s: CalcState) => type(s, '*11')],
  ])('has no rule with %s', (_what, keys) => {
    const { entry } = pressEquals(keys(drop(initialCalcState, PIPE, 6200).state), NOW)
    expect(entry).not.toBeNull()
    expect(entry).not.toHaveProperty('rule')
  })

  it('has no rule for a count, for one row’s number, or for two named numbers', () => {
    expect(pressEquals(type(drop(initialCalcState, PIPE_FEET, 300).state, '*.4'), NOW).entry).not.toHaveProperty('rule')
    expect(pressEquals(type(drop(initialCalcState, WC, 5000).state, '*.4'), NOW).entry).not.toHaveProperty('rule')
    const two = drop(type(drop(initialCalcState, PIPE, 6200).state, '*'), WC, 5000).state
    expect(pressEquals(two, NOW).entry).toMatchObject({ expr: 'Pipe revenue × WC revenue' })
    expect(pressEquals(two, NOW).entry).not.toHaveProperty('rule')
  })

  it('a plain sum never has one', () => {
    expect(pressEquals(type(initialCalcState, '6200*.4'), NOW).entry).not.toHaveProperty('rule')
  })
})

describe('the tape keeps what a line was', () => {
  it('a named line rolled back comes back named, so × .4 = makes the rule again', () => {
    const line = drop(initialCalcState, PIPE, 6200).entry!
    const back = rollBackTo(line)
    expect(back.named).toEqual(PIPE)
    expect(pressEquals(type(back, '*.4'), NOW).entry?.rule).toEqual({ pct: 40, basis: 'revenue', sourceKey: 'kind:pipe' })
  })

  it('a saved tape reads back with its sources and rules', () => {
    const named = drop(initialCalcState, PIPE, 6200).entry!
    const ruled = pressEquals(type(rollBackTo(named), '*.4'), NOW).entry!
    const read = deserializeTape(JSON.stringify([named, ruled]))
    expect(read[0]!.source).toEqual(PIPE)
    expect(read[1]!.rule).toEqual({ pct: 40, basis: 'revenue', sourceKey: 'kind:pipe' })
  })
})
