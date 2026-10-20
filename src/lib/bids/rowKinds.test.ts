import { describe, expect, it } from 'vitest'
import { cleanTag, guessRowKind, rowKindOf } from './rowKinds'

describe('guessRowKind', () => {
  it('reads equipment and allowances out of the name, and the rest as the composition bar does', () => {
    expect(guessRowKind('Scissor lift, 1 wk')).toBe('equipment')
    expect(guessRowKind('Trench shoring rental')).toBe('equipment')
    expect(guessRowKind('Materials/Labor/Travel')).toBe('allowance')
    expect(guessRowKind('Permit')).toBe('allowance')
    expect(guessRowKind('ft of 2" PVC')).toBe('pipe')
    expect(guessRowKind('Cleanout')).toBe('fitting')
    expect(guessRowKind('WC - WATER CLOSET')).toBe('fixture')
    expect(guessRowKind('')).toBe('allowance')
  })
})

describe('rowKindOf', () => {
  it('is the saved kind when known, else the guess, and says which', () => {
    expect(rowKindOf('Scissor lift', 'fixture')).toEqual({ kind: 'fixture', guessed: false })
    expect(rowKindOf('Scissor lift', null)).toEqual({ kind: 'equipment', guessed: true })
    expect(rowKindOf('Scissor lift', 'other' as never)).toEqual({ kind: 'equipment', guessed: true })
  })
})

describe('cleanTag', () => {
  it('lowercases, squeezes spaces and caps at 40 letters', () => {
    expect(cleanTag('  Bldg  C   Bathrooms ')).toBe('bldg c bathrooms')
    expect(cleanTag('x'.repeat(50))).toHaveLength(40)
    expect(cleanTag('   ')).toBe('')
  })
})
