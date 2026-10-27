import { describe, expect, it } from 'vitest'
import { firstName, kindWord, unnamedOnLine, unnamedWords } from './names'

describe('unnamedWords: the line under a contact nobody has named', () => {
  it('names the way they reached us, a number before an address', () => {
    expect(unnamedWords({ phones: 1, emails: 0 })).toBe('A number nobody has named')
    expect(unnamedWords({ phones: 1, emails: 1 })).toBe('A number nobody has named')
    expect(unnamedWords({ phones: 0, emails: 2 })).toBe('An address nobody has named')
  })

  it('still reads as a fact with no channel at all', () => {
    expect(unnamedWords({ phones: 0, emails: 0 })).toBe('Nobody has named them')
  })

  it('never repeats the question the button asks', () => {
    for (const reach of [{ phones: 1, emails: 0 }, { phones: 0, emails: 1 }, { phones: 0, emails: 0 }]) {
      expect(unnamedWords(reach)).not.toMatch(/who is this/i)
    }
    expect(kindWord('unknown')).toBe('who is this?')
  })
})

describe('unnamedOnLine: the same fact on one line of a lane, by the way the line went (v2.5994)', () => {
  it('an email names an address, a text or a call a number (Wendi, 2026-10-27: her email to an unnamed address read as a number)', () => {
    expect(unnamedOnLine('email')).toBe('An address nobody has named')
    expect(unnamedOnLine('text')).toBe('A number nobody has named')
    expect(unnamedOnLine('call')).toBe('A number nobody has named')
  })
  it('a line with no channel reads as a text, the lanes’ default, and never reads the no-channel words', () => {
    expect(unnamedOnLine(null)).toBe('A number nobody has named')
    expect(unnamedOnLine(undefined)).toBe('A number nobody has named')
    expect(unnamedOnLine('email')).toBe(unnamedWords({ phones: 0, emails: 1 }))
  })
})

describe('firstName: the word a greeting opens on', () => {
  it("a company's record name keeps no comma (live check 2026-10-20: \"Structura,, this is Wendi\")", () => {
    expect(firstName({ name: 'Structura, Inc. – Austin', kind: 'customer' })).toBe('Structura')
    expect(firstName({ name: 'Dana Whitfield', kind: 'customer' })).toBe('Dana')
    expect(firstName({ name: 'Dr. Priya Raman', kind: 'customer' })).toBe('Dr. Raman')
  })
})
