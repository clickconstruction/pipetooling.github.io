import { describe, expect, it } from 'vitest'
import { normalizeName, suggestSubSheetAssignee } from './subSheetNameSuggestion'

const JESSE = { personId: 'p1', name: 'Jesse Ramos' }
const BEHAR = { personId: 'p2', name: 'Behar Kraja' }
const KYLE = { personId: 'p3', name: 'Kyle' }
const ROSTER = [JESSE, BEHAR, KYLE]

describe('normalizeName', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeName('  Jesse   RAMOS. ')).toBe('jesse ramos')
    expect(normalizeName("J. O'Brien-Smith")).toBe('j o brien smith')
    expect(normalizeName('')).toBe('')
  })
})

describe('suggestSubSheetAssignee', () => {
  it('suggests on exact normalized match (case/punctuation/whitespace noise)', () => {
    expect(suggestSubSheetAssignee('  jesse RAMOS. ', ROSTER)).toEqual(JESSE)
    expect(suggestSubSheetAssignee('Behar  Kraja', ROSTER)).toEqual(BEHAR)
  })

  it('suggests on first-initial + last-name, both directions', () => {
    expect(suggestSubSheetAssignee('J Ramos', ROSTER)).toEqual(JESSE)
    expect(suggestSubSheetAssignee('J. Ramos', ROSTER)).toEqual(JESSE)
    // Raw has the full first name, roster has the initial.
    expect(suggestSubSheetAssignee('Jesse Ramos', [{ personId: 'p9', name: 'J Ramos' }])).toEqual({
      personId: 'p9',
      name: 'J Ramos',
    })
  })

  it('suggests on single-token containment when unambiguous', () => {
    expect(suggestSubSheetAssignee('Ramos', ROSTER)).toEqual(JESSE)
    // Roster single-token name contained in the raw tokens.
    expect(suggestSubSheetAssignee('Kyle B', ROSTER)).toEqual(KYLE)
  })

  it('never suggests on zero or multiple candidates', () => {
    expect(suggestSubSheetAssignee('Mike Rodriguez', ROSTER)).toBeNull()
    // Two Ramoses → containment ambiguous.
    expect(suggestSubSheetAssignee('Ramos', [...ROSTER, { personId: 'p4', name: 'Ana Ramos' }])).toBeNull()
    // Two exact matches → ambiguous even though looser tiers exist.
    expect(
      suggestSubSheetAssignee('Jesse Ramos', [JESSE, { personId: 'p5', name: 'jesse ramos' }]),
    ).toBeNull()
  })

  it('does not treat short tokens or initials as containment', () => {
    expect(suggestSubSheetAssignee('JR', ROSTER)).toBeNull()
    expect(suggestSubSheetAssignee('K', ROSTER)).toBeNull()
  })

  it('never suggests for multi-name (shared) raw strings or blanks', () => {
    expect(suggestSubSheetAssignee('Behar Kraja | Kyle', ROSTER)).toBeNull()
    expect(suggestSubSheetAssignee('', ROSTER)).toBeNull()
    expect(suggestSubSheetAssignee('   ', ROSTER)).toBeNull()
  })
})
