import { describe, expect, it } from 'vitest'
import { foldOwnerName, ownerNameLetterMatch } from '../../../supabase/functions/_shared/ownerNameMatch'

describe('the owner’s name, letter for letter', () => {
  it('folds case, spaces, punctuation and accents', () => {
    expect(foldOwnerName('Umar  Khan')).toBe('umarkhan')
    expect(foldOwnerName('umar-khan')).toBe('umarkhan')
    expect(foldOwnerName('José Peña, Jr.')).toBe('josepenajr')
    expect(foldOwnerName('   ')).toBe('')
  })
  it('matches the roll’s name or a second allowed name, and nothing shorter', () => {
    const allowed = ['Umar Khan', 'Bangash Shazmeena']
    expect(ownerNameLetterMatch('UMAR KHAN', allowed)).toBe(true)
    expect(ownerNameLetterMatch('umar-khan', allowed)).toBe(true)
    expect(ownerNameLetterMatch('Bangash Shazmeena', allowed)).toBe(true)
    expect(ownerNameLetterMatch('U. Khan', allowed)).toBe(false)
    expect(ownerNameLetterMatch('Umar Khan Jr', allowed)).toBe(false)
    expect(ownerNameLetterMatch('', allowed)).toBe(false)
    expect(ownerNameLetterMatch('Umar Khan', [''])).toBe(false)
  })
})
