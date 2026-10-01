import { describe, expect, it } from 'vitest'
import { moneyTypingCaret, moneyTypingDeleteAcrossComma, moneyTypingEdit, moneyTypingGroup, moneyTypingSanitize, moneyTypingSettle } from './moneyTyping'

/** The box after one edit, with the cursor drawn as "|". */
const show = (r: { text: string; caret: number }) => r.text.slice(0, r.caret) + '|' + r.text.slice(r.caret)
/** Type `raw` with the cursor at the "|" in it. */
const type = (withCursor: string) => {
  const at = withCursor.indexOf('|')
  return moneyTypingEdit(withCursor.replace('|', ''), at)
}

describe('moneyTypingGroup', () => {
  it('puts commas in the whole-dollar part only', () => {
    expect(moneyTypingGroup('17777.51')).toBe('17,777.51')
    expect(moneyTypingGroup('1234567')).toBe('1,234,567')
    expect(moneyTypingGroup('999')).toBe('999')
    expect(moneyTypingGroup('1000.5')).toBe('1,000.5')
    expect(moneyTypingGroup('')).toBe('')
    expect(moneyTypingGroup('.5')).toBe('.5')
  })
})

describe('moneyTypingEdit — typing', () => {
  it('typing digit by digit at the end: the commas arrive and the cursor stays at the end', () => {
    expect(show(type('1777|'))).toBe('1,777|')
    expect(show(type('17777|'))).toBe('17,777|')
    expect(show(type('17777.|'))).toBe('17,777.|')
    expect(show(type('17777.5|'))).toBe('17,777.5|')
    expect(show(type('17777.51|'))).toBe('17,777.51|')
  })

  it('typing in the middle keeps the cursor just after the new digit', () => {
    // "17,777.51" with a 2 typed after "17,7"
    expect(show(type('17,72|77.51'))).toBe('177,2|77.51')
    // a digit typed at the very start
    expect(show(type('9|17,777.51'))).toBe('9|17,777.51')
    expect(show(type('9|1,777.51'))).toBe('9|1,777.51')
  })

  it('the plain value never carries commas', () => {
    expect(type('17,777.51|').plain).toBe('17777.51')
  })

  it('a pasted amount with a dollar sign and commas reads as the number', () => {
    expect(type('$17,777.51|')).toEqual({ plain: '17777.51', text: '17,777.51', caret: 9 })
    expect(type(' 9 022.49 |').plain).toBe('9022.49')
  })

  it('a second dot, letters and minus signs are dropped without moving the cursor', () => {
    expect(show(type('17,777.5.|1'))).toBe('17,777.5|1')
    expect(show(type('17,77a|7.51'))).toBe('17,77|7.51')
    expect(type('-500|').plain).toBe('500')
  })

  it('at most two digits after the dot', () => {
    expect(show(type('17,777.519|'))).toBe('17,777.51|')
  })

  it('leading zeros drop; a single zero before the dot stays', () => {
    expect(type('007|').plain).toBe('7')
    expect(type('0|').plain).toBe('0')
    expect(type('0.5|').plain).toBe('0.5')
    expect(type('00.5|').plain).toBe('0.5')
    expect(show(type('00|17'))).toBe('|17')
  })

  it('emptying the box leaves it empty', () => {
    expect(type('|')).toEqual({ plain: '', text: '', caret: 0 })
  })
})

describe('moneyTypingDeleteAcrossComma', () => {
  it('Backspace just after a comma removes the digit before it', () => {
    const r = moneyTypingDeleteAcrossComma('17,777.51', 3, 3, 'Backspace')!
    expect(show(r)).toBe('1|,777.51')
    expect(r.plain).toBe('1777.51')
  })
  it('Delete just before a comma removes the digit after it', () => {
    const r = moneyTypingDeleteAcrossComma('17,777.51', 2, 2, 'Delete')!
    expect(show(r)).toBe('1,7|77.51')
    expect(r.plain).toBe('1777.51')
  })
  it('every other key, or a selection, is left to the box', () => {
    expect(moneyTypingDeleteAcrossComma('17,777.51', 4, 4, 'Backspace')).toBeNull()
    expect(moneyTypingDeleteAcrossComma('17,777.51', 1, 5, 'Backspace')).toBeNull()
    expect(moneyTypingDeleteAcrossComma('17,777.51', 3, 3, 'ArrowLeft')).toBeNull()
  })
})

describe('moneyTypingSettle — leaving the box', () => {
  it('shows cents', () => {
    expect(moneyTypingSettle('9000')).toBe('9000.00')
    expect(moneyTypingSettle('17777.5')).toBe('17777.50')
    expect(moneyTypingSettle('17777.51')).toBe('17777.51')
    expect(moneyTypingSettle('.5')).toBe('0.50')
    expect(moneyTypingSettle('17777.')).toBe('17777.00')
  })
  it('an empty box stays empty', () => {
    expect(moneyTypingSettle('')).toBe('')
    expect(moneyTypingSettle('.')).toBe('')
  })
})

describe('the pieces', () => {
  it('sanitize counts the kept characters before the cursor', () => {
    expect(moneyTypingSanitize('$1,2', 4)).toEqual({ plain: '12', keptBefore: 2 })
  })
  it('caret lands after the n-th kept character, skipping commas', () => {
    expect(moneyTypingCaret('17,777.51', 2)).toBe(2)
    expect(moneyTypingCaret('17,777.51', 3)).toBe(4)
    expect(moneyTypingCaret('17,777.51', 0)).toBe(0)
  })
})
