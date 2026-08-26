import { describe, expect, it } from 'vitest'
import {
  applyPaste,
  appendEntry,
  deserializeTape,
  filterTape,
  formatAmount,
  formatTyped,
  formatWhen,
  initialCalcState,
  isNoteStarterKey,
  keyboardCalcKey,
  parsePastedNumbers,
  pressBackspace,
  pressClear,
  pressDigit,
  pressEquals,
  pressOp,
  pressPercent,
  rollBackTo,
  type CalcState,
  type TapeEntry,
} from './tapeCalculator'

const NOW = new Date(2026, 7, 26, 15, 52).getTime() // 3:52 PM local

function type(state: CalcState, keys: string): CalcState {
  let s = state
  for (const k of keys) {
    const action = keyboardCalcKey(k)
    if (!action) throw new Error(`not a calc key: ${k}`)
    if (action.kind === 'digit') s = pressDigit(s, action.d)
    else if (action.kind === 'op') s = pressOp(s, action.op)
    else if (action.kind === 'percent') s = pressPercent(s)
    else throw new Error(`use pressEquals directly for: ${k}`)
  }
  return s
}

describe('tape calculator math', () => {
  it('multiplies like the desk calculator: 8 × 1599.03 = 12792.24', () => {
    const s = type(initialCalcState, '8*1599.03')
    const { state, entry } = pressEquals(s, NOW)
    expect(entry?.result).toBeCloseTo(12792.24, 10)
    expect(entry?.expr).toBe('8 × 1,599.03')
    expect(state.current).toBe('12792.24')
    expect(state.justEvaluated).toBe(true)
  })

  it('evaluates left to right with no precedence: 2 + 3 × 4 = 20', () => {
    const { entry } = pressEquals(type(initialCalcState, '2+3*4'), NOW)
    expect(entry?.result).toBe(20)
  })

  it('chains from a result: = then × 2', () => {
    const first = pressEquals(type(initialCalcState, '6*7'), NOW)
    const chained = pressEquals(type(first.state, '*2'), NOW)
    expect(chained.entry?.result).toBe(84)
    expect(chained.entry?.expr).toBe('42 × 2')
  })

  it('a digit right after = starts fresh instead of appending', () => {
    const first = pressEquals(type(initialCalcState, '6*7'), NOW)
    const s = pressDigit(first.state, '5')
    expect(s.current).toBe('5')
  })

  it('divide by zero prints — not Infinity', () => {
    const { entry } = pressEquals(type(initialCalcState, '5/0'), NOW)
    expect(formatAmount(entry!.result)).toBe('—')
  })

  it('equals without a pending op is a no-op', () => {
    const { state, entry } = pressEquals(initialCalcState, NOW)
    expect(entry).toBeNull()
    expect(state).toBe(initialCalcState)
  })

  it('percent converts the current entry: 45 % → 0.45', () => {
    expect(pressPercent(type(initialCalcState, '45')).current).toBe('0.45')
  })

  it('backspace trims a digit and stops at 0; clear resets everything', () => {
    const s = type(initialCalcState, '12')
    expect(pressBackspace(s).current).toBe('1')
    expect(pressBackspace(pressBackspace(s)).current).toBe('0')
    expect(pressClear()).toEqual(initialCalcState)
  })

  it('only one decimal point per entry', () => {
    const s = pressDigit(
      pressDigit(pressDigit(initialCalcState, '.'), '.'),
      '5',
    )
    expect(s.current).toBe('0.5')
  })

  it('rollBackTo loads an old result as the next starting value', () => {
    const entry: TapeEntry = { id: 'x', expr: '6 × 7', result: 42, at: NOW }
    const s = rollBackTo(entry)
    expect(s.current).toBe('42')
    expect(s.justEvaluated).toBe(true)
  })
})

describe('formatting', () => {
  it('comma-groups typed numbers without eating a trailing decimal', () => {
    expect(formatTyped('1599.03')).toBe('1,599.03')
    expect(formatTyped('1234567')).toBe('1,234,567')
    expect(formatTyped('0.5')).toBe('0.5')
  })

  it('formatWhen speaks minutes-ago and time of day', () => {
    expect(formatWhen(NOW, NOW)).toBe('just now · 3:52 PM')
    expect(formatWhen(NOW - 4 * 60000, NOW)).toBe('4m ago · 3:48 PM')
    expect(formatWhen(NOW - 72 * 60000, NOW)).toBe('1h 12m ago · 2:40 PM')
  })
})

describe('paste parsing', () => {
  it('reads money formats and accounting negatives', () => {
    expect(parsePastedNumbers('$1,599.03')).toEqual([1599.03])
    expect(parsePastedNumbers('(617.97)')).toEqual([-617.97])
  })

  it('ignores part codes glued to letters or hyphens', () => {
    expect(
      parsePastedNumbers(
        'WH-1 Water Heater  $1,599.03\nFS-1 Floor Sink  $6,437.19\ncredit  (617.97)',
      ),
    ).toEqual([1599.03, 6437.19, -617.97])
  })

  it('single number lands in the display as if typed', () => {
    const { state, entry } = applyPaste(initialCalcState, '$1,599.03', NOW)
    expect(entry).toBeNull()
    expect(state.current).toBe('1599.03')
  })

  it('a column sums into one transparent tape entry', () => {
    const { state, entry } = applyPaste(
      initialCalcState,
      '1,599.03\n617.97\n892.40',
      NOW,
    )
    expect(entry?.result).toBeCloseTo(3109.4, 10)
    expect(entry?.expr).toBe('1,599.03 + 617.97 + 892.4 (pasted)')
    expect(state.justEvaluated).toBe(true)
  })

  it('text with no numbers is a no-op', () => {
    const before = initialCalcState
    const { state, entry } = applyPaste(
      before,
      'call the GC about lockhart',
      NOW,
    )
    expect(entry).toBeNull()
    expect(state).toBe(before)
  })
})

describe('tape search', () => {
  const entries: TapeEntry[] = [
    {
      id: 'a',
      expr: '3 × 6,437.19',
      result: 19311.57,
      at: NOW - 14 * 60000,
      note: 'floor sinks · Lockhart',
    },
    {
      id: 'b',
      expr: '19,311.57 × 0.62',
      result: 11973.17,
      at: NOW - 9 * 60000,
    },
    { id: 'c', expr: '8 × 1,599.03', result: 12792.24, at: NOW - 4 * 60000 },
  ]

  it('is comma-insensitive: 1599 finds 1,599.03', () => {
    expect(filterTape(entries, '1599', NOW).map((e) => e.id)).toEqual(['c'])
  })

  it('searches notes', () => {
    expect(filterTape(entries, 'lockhart', NOW).map((e) => e.id)).toEqual(['a'])
  })

  it('empty query returns everything', () => {
    expect(filterTape(entries, '  ', NOW)).toEqual(entries)
  })
})

describe('tape persistence and cap', () => {
  it('round-trips through JSON and drops malformed rows', () => {
    const entries: TapeEntry[] = [
      { id: 'a', expr: '6 × 7', result: 42, at: NOW, note: 'hi' },
    ]
    expect(deserializeTape(JSON.stringify(entries))).toEqual(entries)
    expect(
      deserializeTape(JSON.stringify([...entries, { bogus: true }])),
    ).toEqual(entries)
    expect(deserializeTape('not json')).toEqual([])
    expect(deserializeTape(null)).toEqual([])
  })

  it('caps the tape at 200 lines, dropping the oldest', () => {
    let entries: TapeEntry[] = []
    for (let i = 0; i < 205; i++) {
      entries = appendEntry(entries, {
        id: String(i),
        expr: 'x',
        result: i,
        at: NOW + i,
      })
    }
    expect(entries).toHaveLength(200)
    expect(entries[0]?.id).toBe('5')
    expect(entries[199]?.id).toBe('204')
  })
})

describe('keyboard mapping', () => {
  it('maps operators, Enter, and Backspace', () => {
    expect(keyboardCalcKey('*')).toEqual({ kind: 'op', op: '×' })
    expect(keyboardCalcKey('x')).toEqual({ kind: 'op', op: '×' })
    expect(keyboardCalcKey('Enter')).toEqual({ kind: 'equals' })
    expect(keyboardCalcKey('Backspace')).toEqual({ kind: 'backspace' })
    expect(keyboardCalcKey('q')).toBeNull()
  })

  it('note-starter letters exclude x (multiply) and c (clear)', () => {
    expect(isNoteStarterKey('w')).toBe(true)
    expect(isNoteStarterKey('x')).toBe(false)
    expect(isNoteStarterKey('c')).toBe(false)
    expect(isNoteStarterKey('5')).toBe(false)
  })
})
